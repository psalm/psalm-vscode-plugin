import {
    LanguageClient,
    StreamInfo,
    ErrorHandler,
    RevealOutputChannelOn,
    DocumentFilter,
    DynamicFeature,
} from 'vscode-languageclient/node';
import { StatusBar, LanguageServerStatus } from './StatusBar';
import { spawn, ChildProcess } from 'child_process';
import { workspace, Uri, Disposable, WorkspaceFolder } from 'vscode';
import { format, URL } from 'url';
import { join, isAbsolute } from 'path';
import { execFile } from 'promisify-child-process';
import { ConfigurationService } from './ConfigurationService';
import LanguageServerErrorHandler from './LanguageServerErrorHandler';
import { statSync, constants } from 'fs';
import { access } from 'fs/promises';
import * as semver from 'semver';
import { LoggingService } from './LoggingService';
import { Writable } from 'stream';
import { createServer } from 'net';
import { showOpenSettingsPrompt, showErrorMessage } from './utils';
import { ExecuteCommandFeature } from 'vscode-languageclient/lib/common/executeCommand';

export class LanguageServer {
    private languageClient: LanguageClient;
    private workspacePath: string;
    private statusBar: StatusBar;
    private configurationService: ConfigurationService;
    private psalmConfigPath: string;
    private debug: boolean;
    private loggingService: LoggingService;
    private ready = false;
    private initalizing = false;
    private disposable: Disposable;
    private serverProcess: ChildProcess | null = null;

    constructor(
        workspaceFolder: WorkspaceFolder,
        psalmConfigPath: string,
        statusBar: StatusBar,
        configurationService: ConfigurationService,
        loggingService: LoggingService
    ) {
        this.workspacePath = workspaceFolder.uri.fsPath;
        this.statusBar = statusBar;
        this.configurationService = configurationService;
        this.psalmConfigPath = psalmConfigPath;
        this.loggingService = loggingService;

        this.languageClient = new LanguageClient(
            'psalm',
            'Psalm Language Server',
            this.serverOptions.bind(this),
            {
                workspaceFolder: workspaceFolder,
                outputChannel: this.loggingService,
                traceOutputChannel: this.loggingService,
                revealOutputChannelOn: RevealOutputChannelOn.Never,
                // Register the server for php (and maybe HTML) documents
                documentSelector: this.configurationService
                    .get('analyzedFileExtensions')
                    ?.map((filter) => {
                        if (typeof filter == 'string') {
                            return filter;
                        }
                        const anyfilter = filter as any;
                        if (anyfilter.notebook) {
                            // keep as is
                        } else if (anyfilter.pattern) {
                            const existingPattern = anyfilter.pattern as string;
                            if (existingPattern.startsWith('**')) {
                                anyfilter.pattern = `${workspaceFolder.uri.fsPath}/${existingPattern}`;
                            } else if (existingPattern.startsWith('*')) {
                                anyfilter.pattern = `${workspaceFolder.uri.fsPath}/**/${existingPattern}`;
                            }
                            // otherwise keep as is
                        } else {
                            anyfilter.pattern = `${workspaceFolder.uri.fsPath}/**/*`;
                        }
                        return anyfilter as DocumentFilter;
                    }),
                uriConverters: {
                    // VS Code by default %-encodes even the colon after the drive letter
                    // NodeJS handles it much better
                    code2Protocol: (uri: Uri): string =>
                        format(new URL(uri.toString(true))),
                    protocol2Code: (str: string): Uri => Uri.parse(str),
                },
                synchronize: {
                    // Synchronize the setting section 'psalm' to the server
                    configurationSection: 'psalm',
                    fileEvents: [
                        // this is for when files get changed outside of vscode
                        workspace.createFileSystemWatcher('**/*.php'),
                        workspace.createFileSystemWatcher('**/composer.lock'),
                    ],
                },
                progressOnInitialization: true,
                errorHandler: this.createDefaultErrorHandler(
                    this.configurationService.get('maxRestartCount') - 1
                ),
            },
            this.debug
        );

        this.languageClient.onTelemetry(this.onTelemetry.bind(this));
    }

    /**
     * This will NOT restart the server.
     * @param workspacePath
     */
    public setWorkspacePath(workspacePath: string): void {
        this.workspacePath = workspacePath;
    }

    /**
     * This will NOT restart the server.
     * @param psalmConfigPath
     */
    public setPsalmConfigPath(psalmConfigPath: string): void {
        this.psalmConfigPath = psalmConfigPath;
    }

    public createDefaultErrorHandler(maxRestartCount?: number): ErrorHandler {
        if (maxRestartCount !== undefined && maxRestartCount < 0) {
            throw new Error(`Invalid maxRestartCount: ${maxRestartCount}`);
        }
        return new LanguageServerErrorHandler(
            'Psalm Language Server',
            maxRestartCount ?? 4
        );
    }

    public getServerProcess(): ChildProcess | null {
        return this.serverProcess;
    }

    public isReady(): boolean {
        return this.ready;
    }

    public isInitalizing(): boolean {
        return this.initalizing;
    }

    public getDisposable(): Disposable {
        return this.disposable;
    }

    public getClient(): LanguageClient {
        return this.languageClient;
    }

    public async stop() {
        if (this.initalizing) {
            this.loggingService.logWarning(
                this.configurationService,
                'Server is in the process of intializing'
            );
            return;
        }
        this.loggingService.logInfo(
            this.configurationService,
            'Stopping language server'
        );
        await this.languageClient.stop();
    }

    public async start() {
        // Check if psalm is installed and supports the language server protocol.
        const isValidPsalmVersion: boolean =
            await this.checkPsalmHasLanguageServer();
        if (!isValidPsalmVersion) {
            showOpenSettingsPrompt('Psalm is not installed');
            return;
        }

        this.initalizing = true;
        this.statusBar.update(LanguageServerStatus.Initializing, 'starting');
        this.loggingService.logInfo(
            this.configurationService,
            'Starting language server'
        );

        await this.languageClient.start();
        // #region TODO: temporary workaround. remove when https://github.com/vimeo/psalm/issues/10094 is resolved
        const executeCommandFeature = this.languageClient.getFeature(
            'workspace/executeCommand' as 'workspace/didDeleteFiles'
        ) as unknown as DynamicFeature<ExecuteCommandFeature>;
        executeCommandFeature.dispose();
        // #endregion

        // this.context.subscriptions.push(this.disposable);
        this.initalizing = false;
        this.ready = true;
        this.loggingService.logInfo(
            this.configurationService,
            'The Language Server is ready'
        );
    }

    public async restart() {
        this.loggingService.logInfo(
            this.configurationService,
            'Restarting language server'
        );
        await this.stop();
        await this.start();
    }

    public getLanguageClient(): LanguageClient {
        return this.languageClient;
    }

    /**
     * Get the PHP version
     * @return Promise<string> A promise that resolves to the php version (Or null)
     */
    public async getPHPVersion(): Promise<string | null> {
        const out = await this.executePhp(['--version']);
        return out;
    }

    /**
     * Get the Psalm Language Server version
     * @return Promise<string> A promise that resolves to the language server version (Or null)
     */
    public async getPsalmLanguageServerVersion(): Promise<string | null> {
        const psalmScriptPath = await this.resolvePsalmScriptPath();

        try {
            await access(psalmScriptPath, constants.F_OK);
        } catch {
            const msg = `${psalmScriptPath} does not exist. Please set a valid path to psalm.psalmScriptPath`;
            await showErrorMessage(`Psalm can not start: ${msg}`);
            throw new Error(msg);
        }

        const psalmVersionOverride =
            this.configurationService.get('psalmVersion');

        if (
            typeof psalmVersionOverride !== 'undefined' &&
            psalmVersionOverride !== null
        ) {
            this.loggingService.logWarning(
                this.configurationService,
                `Psalm Version was overridden to "${psalmVersionOverride}".` +
                    ' If this is not intentional please clear the Psalm Version Setting'
            );
            return psalmVersionOverride;
        }

        try {
            const args: string[] = ['-f', psalmScriptPath, '--', '--version'];
            const out = await this.executePhp(args);
            // Psalm 4.8.1@f73f2299dbc59a3e6c4d66cff4605176e728ee69
            const ret = out.match(/^Psalm\s*((?:[0-9]+\.?)+)@([0-9a-f]{40})/);
            if (ret === null || ret.length !== 3) {
                this.loggingService.logWarning(
                    this.configurationService,
                    `Psalm Version could not be parsed as a Semantic Version. Got "${out}". Assuming unknown`
                );
                return null;
            }
            const [, version] = ret;
            this.loggingService.logInfo(
                this.configurationService,
                `Psalm Version was detected as ${version}`
            );
            return version;
        } catch (err) {
            this.loggingService.logWarning(
                this.configurationService,
                `Psalm Version could not be detected. Got "${err.message}". Assuming unknown`
            );
            return null;
        }
    }

    private onTelemetry(params: any) {
        if (
            typeof params === 'object' &&
            'message' in params &&
            typeof params.message === 'string'
        ) {
            // each time we get a new telemetry, we are going to check the config, and update as needed
            const hideStatusMessageWhenRunning = this.configurationService.get(
                'hideStatusMessageWhenRunning'
            );

            let status: string = params.message;

            if (params.message.indexOf(':') >= 0) {
                status = params.message.split(':')[0];
            }

            switch (status) {
                case 'initializing':
                    this.statusBar.update(
                        LanguageServerStatus.Initializing,
                        params.message
                    );
                    break;
                case 'initialized':
                    this.statusBar.update(
                        LanguageServerStatus.Initialized,
                        params.message
                    );
                    break;
                case 'running':
                    this.statusBar.update(
                        LanguageServerStatus.Running,
                        params.message
                    );
                    break;
                case 'analyzing':
                    this.statusBar.update(
                        LanguageServerStatus.Analyzing,
                        params.message
                    );
                    break;
                case 'closing':
                    this.statusBar.update(
                        LanguageServerStatus.Closing,
                        params.message
                    );
                    break;
                case 'closed':
                    this.statusBar.update(
                        LanguageServerStatus.Closed,
                        params.message
                    );
                    break;
            }

            if (hideStatusMessageWhenRunning && status === 'running') {
                this.statusBar.hide();
            } else {
                this.statusBar.show();
            }
        }
    }

    private serverOptions(): Promise<ChildProcess | StreamInfo> {
        return new Promise<ChildProcess | StreamInfo>((resolve, reject) => {
            const connectToServerWithTcp = this.configurationService.get(
                'connectToServerWithTcp'
            );

            // Use a TCP socket on Windows because of problems with blocking STDIO
            // stdio locks up for large responses
            // (based on https://github.com/felixfbecker/vscode-php-intellisense/commit/ddddf2a178e4e9bf3d52efb07cd05820ce109f43)
            if (connectToServerWithTcp || process.platform === 'win32') {
                const server = createServer((socket) => {
                    // 'connection' listener
                    this.loggingService.logDebug(
                        this.configurationService,
                        'PHP process connected'
                    );
                    socket.on('end', () => {
                        this.loggingService.logDebug(
                            this.configurationService,
                            'PHP process disconnected'
                        );
                    });

                    if (this.configurationService.get('logLevel') === 'TRACE') {
                        socket.on('data', (chunk: Buffer) => {
                            this.loggingService.logDebug(
                                this.configurationService,
                                `SERVER ==> ${chunk}\n`
                            );
                        });
                    }

                    const writeable = new Writable();

                    // @ts-ignore
                    writeable.write = (chunk, encoding, callback) => {
                        if (
                            this.configurationService.get('logLevel') ===
                            'TRACE'
                        ) {
                            this.loggingService.logDebug(
                                this.configurationService,
                                chunk.toString
                                    ? `SERVER <== ${chunk.toString()}\n`
                                    : chunk
                            );
                        }
                        return socket.write(chunk, encoding, callback);
                    };

                    server.close();
                    resolve({ reader: socket, writer: writeable });
                });
                server.listen(0, '127.0.0.1', () => {
                    // Start the language server
                    // make the language server connect to the client listening on <addr> (e.g. 127.0.0.1:<port>)
                    this.spawnServer([
                        // @ts-ignore
                        '--tcp=127.0.0.1:' + server.address().port,
                    ]);
                });
            } else {
                // Use STDIO on Linux / Mac if the user set
                // the override `"psalm.connectToServerWithTcp": false` in their config.
                resolve(this.spawnServer());
            }
        });
    }

    /**
     * Spawn the Language Server as a child process
     * @param args Extra arguments to pass to the server
     * @return Promise<ChildProcess> A promise that resolves to the spawned process
     */
    private async spawnServer(args: string[] = []): Promise<ChildProcess> {
        const languageServerVersion: string | null =
            await this.getPsalmLanguageServerVersion();

        const extraServerArgs =
            this.configurationService.get('psalmScriptArgs');

        if (extraServerArgs) {
            if (Array.isArray(extraServerArgs)) {
                args.unshift(...extraServerArgs);
            }
        }

        const unusedVariableDetection = this.configurationService.get(
            'unusedVariableDetection'
        );

        if (unusedVariableDetection) {
            args.unshift('--find-dead-code');
        }

        const enableVerbose = this.configurationService.get('enableVerbose');

        if (enableVerbose) {
            args.unshift('--verbose');
        }

        const disableAutoComplete = this.configurationService.get(
            'disableAutoComplete'
        );

        if (disableAutoComplete) {
            args.unshift('--enable-autocomplete=false');
        }

        // Are we running psalm or psalm-language-server
        // if we are runing psalm them we need to forward to psalm-language-server
        const psalmHasLanguageServerOption: boolean =
            await this.checkPsalmLanguageServerHasOption(
                [],
                '--language-server'
            );

        const psalmScriptArgs: string[] = psalmHasLanguageServerOption
            ? ['--language-server']
            : [];

        if (
            languageServerVersion === null ||
            semver.lt(languageServerVersion, '4.9.0')
        ) {
            if (
                await this.checkPsalmLanguageServerHasOption(
                    psalmScriptArgs,
                    '--use-extended-diagnostic-codes'
                )
            ) {
                psalmScriptArgs.unshift('--use-extended-diagnostic-codes');
            }

            if (
                enableVerbose &&
                (await this.checkPsalmLanguageServerHasOption(
                    psalmScriptArgs,
                    '--verbose'
                ))
            ) {
                psalmScriptArgs.unshift('--verbose');
            }
        } else if (semver.gte(languageServerVersion, '4.9.0')) {
            this.loggingService.logDebug(
                this.configurationService,
                `Psalm Language Server Version: ${languageServerVersion}`
            );
            psalmScriptArgs.unshift('--use-extended-diagnostic-codes');
            if (enableVerbose) {
                psalmScriptArgs.unshift('--verbose');
            }

            const enableUseIniDefaults = this.configurationService.get(
                'enableUseIniDefaults'
            );

            if (enableUseIniDefaults) {
                psalmScriptArgs.unshift('--use-ini-defaults');
            }
        }

        args.unshift('-r', this.workspacePath);

        args.unshift('-c', this.psalmConfigPath);

        args.unshift(...psalmScriptArgs);

        // end of the psalm language server arguments, so we use the php cli argument separator
        args.unshift('--');

        // The server is implemented in PHP
        // this goes before the cli argument separator
        const psalmScriptPath = await this.resolvePsalmScriptPath();
        args.unshift('-f', psalmScriptPath);

        const { file, args: fileArgs } = await this.getPhpArgs(args);

        const childProcess = spawn(file, fileArgs, {
            cwd: this.workspacePath,
        });
        this.serverProcess = childProcess;
        childProcess.stderr.on('data', (chunk: Buffer) => {
            this.loggingService.logError(this.configurationService, chunk + '');
        });
        if (this.configurationService.get('logLevel') === 'TRACE') {
            const orig = childProcess.stdin;

            childProcess.stdin = new Writable();
            // @ts-ignore
            childProcess.stdin.write = (chunk, encoding, callback) => {
                this.loggingService.logDebug(
                    this.configurationService,
                    chunk.toString ? `SERVER <== ${chunk.toString()}\n` : chunk
                );
                return orig.write(chunk, encoding, callback);
            };

            childProcess.stdout.on('data', (chunk: Buffer) => {
                this.loggingService.logDebug(
                    this.configurationService,
                    `SERVER ==> ${chunk}\n`
                );
            });
        }

        childProcess.on('exit', (code, signal) => {
            this.statusBar.update(
                LanguageServerStatus.Exited,
                'Exited (Should Restart)'
            );
        });
        return childProcess;
    }

    /**
     * Check if the Psalm Language Server has an option
     * @param psalmScriptArgs The psalm script arguments
     * @param option The option to check for
     * @return Promise<boolean> A promise that resolves to true if the option is found
     */
    private async checkPsalmLanguageServerHasOption(
        psalmScriptArgs: string[],
        option: string
    ): Promise<boolean> {
        const psalmScriptPath = await this.resolvePsalmScriptPath();

        try {
            const args: string[] = [
                '-f',
                psalmScriptPath,
                '--',
                '--help',
                ...psalmScriptArgs,
            ];
            const out = await this.executePhp(args);

            const escaped = option.replace(/[.*+\-?^${}()|[\]\\]/g, '\\$&');

            return new RegExp(
                '(\\b|\\s)' + escaped + '(?![-_])(\\b|\\s)',
                'm'
            ).test(out);
        } catch (err) {
            return false;
        }
    }

    /**
     * Executes PHP with Arguments
     * @param args The arguments to pass to PHP
     * @return Promise<string> A promise that resolves to the stdout of PHP
     */
    private async executePhp(args: string[]): Promise<string> {
        let stdout: string | Buffer | null | undefined;

        const { file, args: fileArgs } = await this.getPhpArgs(args);

        // eslint-disable-next-line prefer-const
        ({ stdout } = await execFile(file, fileArgs, {
            cwd: this.workspacePath,
        }));
        return String(stdout);
    }

    /**
     * Get the PHP Executable Location and Arguments to pass to PHP
     *
     * @param args The arguments to pass to PHP
     */
    private async getPhpArgs(
        args: string[]
    ): Promise<{ file: string; args: string[] }> {
        const phpExecutablePath =
            this.configurationService.get('phpExecutablePath');

        if (!phpExecutablePath || !phpExecutablePath.length) {
            const msg =
                'Unable to find any php executable please set one in psalm.phpExecutablePath';
            await showOpenSettingsPrompt(`Psalm can not start: ${msg}`);
            throw new Error(msg);
        }

        try {
            await access(phpExecutablePath, constants.X_OK);
        } catch {
            const msg = `${phpExecutablePath} is not executable`;
            await showErrorMessage(`Psalm can not start: ${msg}`);
            throw new Error(msg);
        }

        const phpExecutableArgs =
            this.configurationService.get('phpExecutableArgs');

        if (phpExecutableArgs) {
            if (
                Array.isArray(phpExecutableArgs) &&
                phpExecutableArgs.length > 0
            ) {
                args.unshift(...phpExecutableArgs);
            }
        }

        return { file: phpExecutablePath, args };
    }

    /**
     * Returns true if psalm.psalmScriptPath supports the language server protocol.
     * @return Promise<boolean> A promise that resolves to true if the language server protocol is supported
     */
    private async checkPsalmHasLanguageServer(): Promise<boolean> {
        const psalmScriptPath = await this.resolvePsalmScriptPath();

        const exists: boolean = this.isFile(psalmScriptPath);

        if (!exists) {
            this.loggingService.logError(
                this.configurationService,
                `The setting psalm.psalmScriptPath refers to a path that does not exist. path: ${psalmScriptPath}`
            );
            return false;
        }

        return true;
    }

    /**
     * Returns true if the file exists.
     */
    private isFile(filePath: string): boolean {
        try {
            const stat = statSync(filePath);
            return stat.isFile();
        } catch (e) {
            return false;
        }
    }

    /**
     * Resolve Pslam Script Path if absolute or relative
     */
    private async resolvePsalmScriptPath(): Promise<string> {
        const psalmScriptPath =
            this.configurationService.get('psalmScriptPath');

        if (!psalmScriptPath) {
            await showErrorMessage(
                'Unable to find Psalm Language Server. Please set psalm.psalmScriptPath'
            );
            throw new Error('psalmScriptPath is not set');
        }

        if (isAbsolute(psalmScriptPath)) {
            return psalmScriptPath;
        }
        return join(this.workspacePath, psalmScriptPath);
    }
}
