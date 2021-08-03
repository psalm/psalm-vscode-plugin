import { LanguageClient, StreamInfo } from 'vscode-languageclient/node';
import { StatusBar, LanguageServerStatus } from './StatusBar';
import { spawn, ChildProcess } from 'child_process';
import { workspace, Uri, Disposable, ExtensionContext } from 'vscode';
import { format, URL } from 'url';
import { DocumentSelector } from 'vscode-languageserver-protocol';
import { join } from 'path';
import { execFile } from 'promisify-child-process';
import { ConfigurationService } from './ConfigurationService';
import { statSync, constants } from 'fs';
import { access } from 'fs/promises';
import * as semver from 'semver';
import { LoggingService } from './LoggingService';
import { Writable } from 'stream';
import { createServer } from 'net';
import { showOpenSettingsPrompt, showErrorMessage } from './utils';
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
    private context: ExtensionContext;

    public static async getInstance(
        context: ExtensionContext,
        workspacePath: string,
        statusBar: StatusBar,
        configurationService: ConfigurationService,
        loggingService: LoggingService
    ): Promise<LanguageServer | null> {
        await configurationService.init();

        const configPaths = configurationService.get<string[]>('configPaths');

        if (!configPaths.length) {
            loggingService.logError(
                `No Config Paths defined. Define some and try again`
            );
            return null;
        }

        const psalmXML = await workspace.findFiles(
            `{${configPaths.join(',')}}`
            // `**/vendor/**/{${configPaths.join(',')}}`
        );
        if (!psalmXML.length) {
            // no psalm.xml found
            loggingService.logError(
                `No Config file found in: ${configPaths.join(',')}`
            );
            return null;
        }
        const configXml = psalmXML[0].path;

        loggingService.logDebug(`Found config file: ${configXml}`);

        const configWatcher = workspace.createFileSystemWatcher(configXml);

        const languageServer = new LanguageServer(
            context,
            workspacePath,
            configXml,
            statusBar,
            configurationService,
            loggingService
        );

        const onConfigChange = () => {
            loggingService.logInfo(`Config file changed: ${configXml}`);
            languageServer.restart();
        };

        const onConfigDelete = () => {
            loggingService.logInfo(`Config file deleted: ${configXml}`);
            languageServer.stop();
        };

        // Restart the language server when the tracked config file changes
        configWatcher.onDidChange(onConfigChange);
        configWatcher.onDidCreate(onConfigChange);
        configWatcher.onDidDelete(onConfigDelete);

        // Start Lanuage Server
        await languageServer.start();

        return languageServer;
    }

    constructor(
        context: ExtensionContext,
        workspacePath: string,
        psalmConfigPath: string,
        statusBar: StatusBar,
        configurationService: ConfigurationService,
        loggingService: LoggingService
    ) {
        this.context = context;
        this.workspacePath = workspacePath;
        this.statusBar = statusBar;
        this.configurationService = configurationService;
        this.psalmConfigPath = psalmConfigPath;
        this.loggingService = loggingService;

        this.languageClient = new LanguageClient(
            'psalmLanguageServer',
            'Psalm Language Server',
            this.serverOptions.bind(this),
            {
                // Register the server for php (and maybe HTML) documents
                documentSelector: this.configurationService.get<
                    string[] | DocumentSelector
                >('analyzedFileExtensions'),
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
                    ],
                },
                progressOnInitialization: true,
            },
            this.debug
        );

        this.languageClient.onReady().then(() => {
            this.initalizing = false;
            this.ready = true;
            this.loggingService.logInfo('The Language Server is ready');
        });

        this.languageClient.onTelemetry(this.onTelemetry.bind(this));
    }

    private onTelemetry(params: any) {
        if (
            typeof params === 'object' &&
            'message' in params &&
            typeof params.message === 'string'
        ) {
            // each time we get a new telemetry, we are going to check the config, and update as needed
            const hideStatusMessageWhenRunning =
                this.configurationService.get<boolean>(
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
                'Server is in the process of intializing will stop when ready'
            );
            await this.languageClient.onReady();
        }
        this.loggingService.logInfo('Stopping language server');
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
        this.loggingService.logInfo('Starting language server');
        this.disposable = this.languageClient.start();
        this.context.subscriptions.push(this.disposable);
    }

    public async restart() {
        this.loggingService.logInfo('Restarting language server');
        await this.stop();
        await this.start();
    }

    public getLanguageClient(): LanguageClient {
        return this.languageClient;
    }

    private serverOptions(): Promise<ChildProcess | StreamInfo> {
        return new Promise<ChildProcess | StreamInfo>((resolve, reject) => {
            const connectToServerWithTcp =
                this.configurationService.get<boolean>(
                    'connectToServerWithTcp'
                );

            // Use a TCP socket on Windows because of problems with blocking STDIO
            // stdio locks up for large responses
            // (based on https://github.com/felixfbecker/vscode-php-intellisense/commit/ddddf2a178e4e9bf3d52efb07cd05820ce109f43)
            if (connectToServerWithTcp || process.platform === 'win32') {
                const server = createServer((socket) => {
                    // 'connection' listener
                    this.loggingService.logDebug('PHP process connected');
                    socket.on('end', () => {
                        this.loggingService.logDebug(
                            'PHP process disconnected'
                        );
                    });
                    socket.on('data', (chunk: Buffer) => {
                        this.loggingService.logDebug(`SERVER ==> ${chunk}\n`);
                    });

                    const writeable = new Writable();

                    // @ts-ignore
                    writeable.write = (chunk, encoding, callback) => {
                        this.loggingService.logDebug(
                            chunk.toString
                                ? `SERVER <== ${chunk.toString()}\n`
                                : chunk
                        );
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

        const unusedVariableDetection = this.configurationService.get<boolean>(
            'unusedVariableDetection'
        );

        if (unusedVariableDetection) {
            args.unshift('--find-dead-code');
        }

        const enableDebugLog =
            this.configurationService.get<boolean>('enableDebugLog');

        if (enableDebugLog) {
            args.unshift('--verbose');
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
                enableDebugLog &&
                (await this.checkPsalmLanguageServerHasOption(
                    psalmScriptArgs,
                    '--verbose'
                ))
            ) {
                psalmScriptArgs.unshift('--verbose');
            }
        } else if (semver.gte(languageServerVersion, '4.9.0')) {
            this.loggingService.logDebug(
                `Psalm Language Server Version: ${languageServerVersion}`
            );
            psalmScriptArgs.unshift('--use-extended-diagnostic-codes');
            if (enableDebugLog) {
                psalmScriptArgs.unshift('--verbose');
            }

            const enableUseIniDefaults =
                this.configurationService.get<boolean>('enableUseIniDefaults');

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
        const psalmScriptPath =
            this.configurationService.get<string>('psalmScriptPath');
        args.unshift('-f', join(this.workspacePath, psalmScriptPath));

        this.loggingService.logInfo('Starting Psalm Language Server');

        const { file, args: fileArgs } = await this.getPhpArgs(args);

        const childProcess = spawn(file, fileArgs, {
            cwd: this.workspacePath,
        });
        this.serverProcess = childProcess;
        childProcess.stderr.on('data', (chunk: Buffer) => {
            this.loggingService.logError(chunk + '');
        });
        if (enableDebugLog) {
            const orig = childProcess.stdin;

            childProcess.stdin = new Writable();
            // @ts-ignore
            childProcess.stdin.write = (chunk, encoding, callback) => {
                this.loggingService.logDebug(
                    chunk.toString ? `SERVER <== ${chunk.toString()}\n` : chunk
                );
                return orig.write(chunk, encoding, callback);
            };

            childProcess.stdout.on('data', (chunk: Buffer) => {
                this.loggingService.logDebug(`SERVER ==> ${chunk}\n`);
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
        const psalmScriptPath =
            this.configurationService.get<string>('psalmScriptPath');

        if (!psalmScriptPath) {
            throw new Error('psalmScriptPath is not set');
        }

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
     * Get the Psalm Language Server version
     * @return Promise<string> A promise that resolves to the language server version (Or null)
     */
    public async getPsalmLanguageServerVersion(): Promise<string | null> {
        const psalmScriptPath =
            this.configurationService.get<string>('psalmScriptPath');

        if (!psalmScriptPath.length) {
            await showErrorMessage(
                `Unable to find Psalm Language Server. Please set psalm.psalmScriptPath`
            );
            throw new Error('psalmScriptPath is not set');
        }

        try {
            await access(
                `${this.workspacePath}/${psalmScriptPath}`,
                constants.F_OK
            );
        } catch {
            const msg = `${psalmScriptPath} does not exist. Please set a valid path to psalm.psalmScriptPath`;
            await showErrorMessage(`Psalm can not start: ${msg}`);
            throw new Error(msg);
        }

        try {
            const args: string[] = ['-f', psalmScriptPath, '--', '--version'];
            const out = await this.executePhp(args);
            // Psalm 4.8.1@f73f2299dbc59a3e6c4d66cff4605176e728ee69
            const ret = out.match(/^Psalm\s*((?:[0-9]+\.?)+)@([0-9a-f]{40})/);
            if (ret === null || ret.length !== 3) {
                return null;
            }
            const [, version] = ret;
            return version;
        } catch (err) {
            if (
                /Use of undefined constant PSALM_VERSION - assumed 'PSALM_VERSION'/g.test(
                    String(err.message)
                )
            ) {
                // Could technically return  4.8.1
                return null;
            }
            return null;
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
            this.configurationService.get<string>('phpExecutablePath');

        if (!phpExecutablePath.length) {
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
            this.configurationService.get<string[]>('phpExecutableArgs');

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
        const psalmScriptPath = join(
            this.workspacePath,
            this.configurationService.get<string>('psalmScriptPath')
        );

        if (!psalmScriptPath.length) {
            this.loggingService.logError(
                `The setting psalm.psalmScriptPath is not set`
            );
            return false;
        }

        const exists: boolean = this.isFile(psalmScriptPath);

        if (!exists) {
            this.loggingService.logError(
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
}
