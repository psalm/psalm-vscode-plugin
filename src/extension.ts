import * as vscode from 'vscode';
import { StatusBar } from './StatusBar';
import { LoggingService } from './LoggingService';
import { ConfigurationService } from './ConfigurationService';
import { LanguageServer } from './LanguageServer';
import { registerCommands } from './commands';
import { showWarningMessage } from './utils';

/**
 * Activate the extension.
 *
 * NOTE: This is only ever run once so it's safe to listen to events here
 */
export async function activate(
    context: vscode.ExtensionContext
): Promise<void> {
    // @ts-ignore
    const loggingService = new LoggingService();
    // @ts-ignore
    const configurationService = new ConfigurationService();
    await configurationService.init();
    // @ts-ignore
    const statusBar = new StatusBar();

    const workspaceFolders = vscode.workspace.workspaceFolders;

    if (!workspaceFolders) {
        loggingService.logError(
            'Psalm must be run in a workspace. Select a workspace and reload the window'
        );
        return;
    }

    const workspacePath = workspaceFolders[0].uri.fsPath;

    const configPaths = configurationService.get<string[]>('configPaths') || [];

    if (!configPaths.length) {
        loggingService.logError(
            'No Config Paths defined. Define some and reload the window'
        );
        return;
    }

    const psalmXML = await vscode.workspace.findFiles(
        `{${configPaths.join(',')}}`
        // `**/vendor/**/{${configPaths.join(',')}}`
    );
    if (!psalmXML.length) {
        // no psalm.xml found
        loggingService.logError(
            `No Config file found in: ${configPaths.join(',')}`
        );
        return;
    }
    const configXml = psalmXML[0].path;

    loggingService.logDebug(`Found config file: ${configXml}`);

    const configWatcher = vscode.workspace.createFileSystemWatcher(configXml);

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

    context.subscriptions.push(...registerCommands(languageServer));

    vscode.workspace.onDidChangeConfiguration(async (change) => {
        if (
            !change.affectsConfiguration('psalm') ||
            change.affectsConfiguration('psalm.hideStatusMessageWhenRunning')
        ) {
            return;
        }
        loggingService.logDebug('Configuration changed');
        showWarningMessage(
            'You will need to reload this window for the new configuration to take effect'
        );

        await configurationService.init();
    });

    loggingService.logDebug('Finished Extension Activation');

    /*
    const phpExecutablePath =
        conf.get<string>('phpExecutablePath') || (await which('php'));
    let phpExecutableArgs = conf.get<string[]>('phpExecutableArgs') || [
        '-dxdebug.remote_autostart=0',
        '-dxdebug.remote_enable=0',
        '-dxdebug_profiler_enable=0',
    ];
    const workspaceFolders = vscode.workspace.workspaceFolders;
    const defaultPsalmClientScriptPath = path.join(
        'vendor',
        'vimeo',
        'psalm',
        'psalm'
    );
    const defaultPsalmServerScriptPath = path.join(
        'vendor',
        'vimeo',
        'psalm',
        'psalm-language-server'
    );
    let psalmClientScriptPath =
        conf.get<string>('psalmClientScriptPath') ||
        defaultPsalmClientScriptPath;
    let psalmServerScriptPath =
        conf.get<string>('psalmScriptPath') || defaultPsalmServerScriptPath;
    const unusedVariableDetection =
        conf.get<boolean>('unusedVariableDetection') || false;
    const enableDebugLog = true; // conf.get<boolean>('enableDebugLog') || false;
    const connectToServerWithTcp = conf.get<boolean>('connectToServerWithTcp');
    const analyzedFileExtensions: undefined | string[] | DocumentSelector =
        conf.get<string[] | DocumentSelector>('analyzedFileExtensions') || [
            { scheme: 'file', language: 'php' },
        ];
    const psalmConfigPaths: string[] = conf.get<string[]>('configPaths') || [
        'psalm.xml',
        'psalm.xml.dist',
    ];
    let hideStatusMessageWhenRunning: boolean =
        conf.get<boolean>('hideStatusMessageWhenRunning') || false;

    // Check if the psalmServerScriptPath setting was provided.
    if (!psalmServerScriptPath) {
        await showOpenSettingsPrompt(
            'The setting psalm.psalmScriptPath must be provided (e.g. vendor/bin/psalm-language-server)'
        );
        return;
    }

    // Check if the psalmClientScriptPath setting was provided.
    if (!psalmClientScriptPath) {
        await showOpenSettingsPrompt(
            'The setting psalm.psalmClientScriptPath must be provided (e.g. vendor/bin/psalm)'
        );
        return;
    }

    if (!workspaceFolders) {
        await showOpenSettingsPrompt('Psalm must be run in a workspace');
        return;
    }

    const workspacePath = workspaceFolders[0].uri.fsPath;

    if (!isFile(psalmServerScriptPath)) {
        psalmServerScriptPath = path.join(workspacePath, psalmServerScriptPath);
    }
    if (!isFile(psalmClientScriptPath)) {
        psalmClientScriptPath = path.join(workspacePath, psalmClientScriptPath);
    }

    // Check if psalm is installed and supports the language server protocol.
    const isValidPsalmVersion: boolean = await checkPsalmHasLanguageServer(
        context,
        phpExecutablePath,
        psalmServerScriptPath
    );
    if (!isValidPsalmVersion) {
        return;
    }

    // Check path (if PHP is available and version is ^7.0.0)
    let stdout: string | Buffer | null | undefined;
    try {
        ({ stdout } = await execFile(phpExecutablePath, ['--version']));
    } catch (err) {
        if (err.code === 'ENOENT') {
            await showOpenSettingsPrompt(
                'PHP executable not found. Install PHP 7+ and add it to your PATH or set the psalm.phpExecutablePath setting'
            );
        } else {
            vscode.window.showErrorMessage(
                'Error spawning PHP: ' + err.message
            );
            console.error(err);
        }
        return;
    }

    // Parse version and discard OS info like 7.0.8--0ubuntu0.16.04.2
    const match = String(stdout).match(/^PHP ([^\s]+)/m);
    if (!match) {
        vscode.window.showErrorMessage(
            'Error parsing PHP version. Please check the output of php --version'
        );
        return;
    }
    let phpVersion = match[1].split('-')[0];
    // Convert PHP prerelease format like 7.0.0rc1 to 7.0.0-rc1
    if (!/^\d+.\d+.\d+$/.test(phpVersion)) {
        phpVersion = phpVersion.replace(/(\d+.\d+.\d+)/, '$1-');
    }
    if (semver.lt(phpVersion, '7.0.0')) {
        vscode.window.showErrorMessage(
            'The language server needs at least PHP 7 installed. Version found: ' +
                phpVersion
        );
        return;
    }

    if (phpExecutableArgs) {
        if (
            typeof phpExecutableArgs === 'string' &&
            phpExecutableArgs.trim().length > 0
        ) {
            phpExecutableArgs = phpExecutableArgs.trim();
            if (phpExecutableArgs === '--') {
                phpExecutableArgs = [];
            }
        } else if (
            Array.isArray(phpExecutableArgs) &&
            phpExecutableArgs.length > 0
        ) {
            phpExecutableArgs = phpExecutableArgs
                .map((v) => v.trim())
                .filter((v) => v.length > 0 && v !== '--');
        }
    } else {
        phpExecutableArgs = [];
    }

    const psalmConfigPath = filterPath(psalmConfigPaths, workspacePath);
    if (psalmConfigPath === null) {
        const res = await vscode.window.showWarningMessage(
            'No psalm.xml config found in project root. Want to configure one?',
            'Yes',
            'No'
        );

        if (res === 'Yes') {
            await execFile(
                phpExecutablePath,
                [psalmClientScriptPath, '--init'],
                { cwd: workspacePath }
            );
            const res1 = await vscode.window.showInformationMessage(
                'Psalm configuration has been initialized. Reload window in order for configuration to take effect.',
                'Reload window'
            );
            if (res1 === 'Reload window') {
                vscode.commands.executeCommand('workbench.action.reloadWindow');
            }
        }
        return;
    }

    const languageServerVersion: string | null =
        await getPsalmLanguageServerVersion(
            context,
            phpExecutablePath,
            phpExecutableArgs,
            psalmServerScriptPath
        );

    // Are we running psalm or psalm-language-server
    // if we are runing psalm them we need to forward to psalm-language-server
    const psalmHasLanguageServerOption: boolean =
        await checkPsalmLanguageServerHasOption(
            context,
            phpExecutablePath,
            phpExecutableArgs,
            psalmServerScriptPath,
            [],
            '--language-server'
        );

    let psalmScriptArgs: string[] = psalmHasLanguageServerOption
        ? ['--language-server']
        : [];
    let psalmHasExtendedDiagnosticCodes = false;
    let psalmHasVerbose = false;
    if (
        languageServerVersion === null ||
        semver.lt('4.8.2', languageServerVersion)
    ) {
        psalmHasExtendedDiagnosticCodes =
            await checkPsalmLanguageServerHasOption(
                context,
                phpExecutablePath,
                phpExecutableArgs,
                psalmServerScriptPath,
                psalmScriptArgs,
                '--use-extended-diagnostic-codes'
            );
        psalmHasVerbose = enableDebugLog
            ? await checkPsalmLanguageServerHasOption(
                  context,
                  phpExecutablePath,
                  phpExecutableArgs,
                  psalmServerScriptPath,
                  psalmScriptArgs,
                  '--verbose'
              )
            : false;
    } else if (semver.gt('4.8.1', languageServerVersion)) {
        console.log(`Psalm Language Server Version: ${languageServerVersion}`);
        psalmHasExtendedDiagnosticCodes = true;
        psalmScriptArgs = ['--language-server'];
        psalmHasVerbose = enableDebugLog;
    }

    const serverOptionsCallbackForDirectory =
        (dirToAnalyze: string, statusBar: StatusBar): ServerOptions =>
        () =>
            new Promise<ChildProcess | StreamInfo>((resolve, reject) => {
                // Listen on random port
                const spawnServer = (...args: string[]): ChildProcess => {
                    if (unusedVariableDetection) {
                        args.unshift('--find-dead-code');
                    }

                    if (psalmHasVerbose && enableDebugLog) {
                        args.unshift('--verbose');
                    }

                    if (psalmHasExtendedDiagnosticCodes) {
                        // this will add the help link to the diagnostic issue
                        args.unshift('--use-extended-diagnostic-codes');
                    }

                    args.unshift('-r', workspacePath);

                    args.unshift(
                        '-c',
                        path.join(workspacePath, psalmConfigPath)
                    );

                    args.unshift(...psalmScriptArgs);

                    // end of the psalm language server arguments, so we use the php cli argument separator
                    args.unshift('--');

                    // The server is implemented in PHP
                    // this goes before the cli argument separator
                    args.unshift('-f', psalmServerScriptPath);

                    if (phpExecutableArgs) {
                        if (Array.isArray(phpExecutableArgs)) {
                            args.unshift(...phpExecutableArgs);
                        } else {
                            args.unshift(phpExecutableArgs);
                        }
                    }

                    console.log(
                        'starting Psalm Language Server',
                        phpExecutablePath,
                        args
                    );

                    const childProcess = spawn(phpExecutablePath, args, {
                        cwd: dirToAnalyze,
                    });
                    childProcess.stderr.on('data', (chunk: Buffer) => {
                        console.error(chunk + '');
                    });
                    if (enableDebugLog) {
                        const orig = childProcess.stdin;

                        childProcess.stdin = new Writable();
                        // @ts-ignore
                        childProcess.stdin.write = (
                            chunk,
                            encoding,
                            callback
                        ) => {
                            console.log(
                                chunk.toString
                                    ? `in: ${chunk.toString()}`
                                    : chunk
                            );
                            return orig.write(chunk, encoding, callback);
                        };

                        childProcess.stdout.on('data', (chunk: Buffer) => {
                            console.log('out: ' + chunk);
                        });
                    }

                    childProcess.on('exit', (code, signal) => {
                        statusBar.update(
                            LanguageServerStatus.Exited,
                            'Exited (Should Restart)'
                        );
                    });
                    return childProcess;
                };
                // Use a TCP socket on Windows because of problems with blocking STDIO
                // stdio locks up for large responses
                // (based on https://github.com/felixfbecker/vscode-php-intellisense/commit/ddddf2a178e4e9bf3d52efb07cd05820ce109f43)
                if (connectToServerWithTcp || process.platform === 'win32') {
                    const server = net.createServer((socket) => {
                        // 'connection' listener
                        console.log('PHP process connected');
                        socket.on('end', () => {
                            console.log('PHP process disconnected');
                        });
                        server.close();
                        resolve({ reader: socket, writer: socket });
                    });
                    server.listen(0, '127.0.0.1', () => {
                        // Start the language server
                        // make the language server connect to the client listening on <addr> (e.g. 127.0.0.1:<port>)
                        // @ts-ignore
                        spawnServer('--tcp=127.0.0.1:' + server.address().port);
                    });
                } else {
                    // Use STDIO on Linux / Mac if the user set
                    // the override `"psalm.connectToServerWithTcp": false` in their config.
                    resolve(spawnServer());
                }
            });

    // Options to control the language client
    const clientOptions: LanguageClientOptions = {
        // Register the server for php (and maybe HTML) documents
        documentSelector: analyzedFileExtensions,
        uriConverters: {
            // VS Code by default %-encodes even the colon after the drive letter
            // NodeJS handles it much better
            code2Protocol: (uri) => url.format(url.parse(uri.toString(true))),
            protocol2Code: (str) => vscode.Uri.parse(str),
        },
        synchronize: {
            // Synchronize the setting section 'psalm' to the server
            configurationSection: 'psalm',
            fileEvents: [
                vscode.workspace.createFileSystemWatcher(
                ),
                // this is for when files get changed outside of vscode
            ],
        },
        progressOnInitialization: true,
    };

    const psalmStatusBar = new StatusBar();

    // Create the language client and start the client.
    const lc = new LanguageClient(
        'psalmLanguageServer',
        'Psalm Language Server',
        serverOptionsCallbackForDirectory(workspacePath, psalmStatusBar),
        clientOptions,
        true
    );

    lc.onTelemetry((params) => {
        if (
            typeof params === 'object' &&
            'message' in params &&
            typeof params.message === 'string'
        ) {
            // each time we get a new telemetry, we are going to check the config, and update as needed
            hideStatusMessageWhenRunning =
                conf.get<boolean>('hideStatusMessageWhenRunning') || false;

            let status: string = params.message;

            if (params.message.indexOf(':') >= 0) {
                status = params.message.split(':')[0];
            }

            switch (status) {
                case 'initializing':
                    psalmStatusBar.update(
                        LanguageServerStatus.Initializing,
                        params.message
                    );
                    break;
                case 'initialized':
                    psalmStatusBar.update(
                        LanguageServerStatus.Initialized,
                        params.message
                    );
                    break;
                case 'running':
                    psalmStatusBar.update(
                        LanguageServerStatus.Running,
                        params.message
                    );
                    break;
                case 'analyzing':
                    psalmStatusBar.update(
                        LanguageServerStatus.Analyzing,
                        params.message
                    );
                    break;
                case 'closing':
                    psalmStatusBar.update(
                        LanguageServerStatus.Closing,
                        params.message
                    );
                    break;
                case 'closed':
                    psalmStatusBar.update(
                        LanguageServerStatus.Closed,
                        params.message
                    );
                    break;
            }

            if (hideStatusMessageWhenRunning && status === 'running') {
                psalmStatusBar.hide();
            } else {
                psalmStatusBar.show();
            }
        }
    });

    // Push the disposable to the context's subscriptions so that the
    // client can be deactivated on extension deactivation
    const disposable = lc.start();
    context.subscriptions.push(
        ...registerCommands(lc, languageServerVersion),
        disposable
    );

    await lc.onReady();

    psalmStatusBar.update(LanguageServerStatus.Running, 'Running');
    if (hideStatusMessageWhenRunning) {
        psalmStatusBar.hide();
    } else {
        psalmStatusBar.show();
    }
    */
}
