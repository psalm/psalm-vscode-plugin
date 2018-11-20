
import * as path from 'path';
import { spawn, execFile, ChildProcess } from 'mz/child_process';
import * as vscode from 'vscode';
import { LanguageClient, LanguageClientOptions, StreamInfo } from 'vscode-languageclient';
import * as semver from 'semver';
import * as net from 'net';
import * as url from 'url';
import * as fs from 'fs';

async function showOpenSettingsPrompt(errorMessage: string): Promise<void> {
    const selected = await vscode.window.showErrorMessage(
        errorMessage,
        'Open settings'
    );
    if (selected === 'Open settings') {
        await vscode.commands.executeCommand('workbench.action.openGlobalSettings');
    }
}

function isFile(path: string): boolean {
    try {
        let stat = fs.statSync(path);
        return stat.isFile();
    } catch (e) {
        return false;
    }
}

// Returns true if psalm.psalmScriptPath supports the language server protocol.
async function checkPsalmHasLanguageServer(context: vscode.ExtensionContext, phpExecutablePath: string, psalmScriptPath: string): Promise<boolean> {
    const exists: boolean = isFile(psalmScriptPath);

    if (!exists) {
        await showOpenSettingsPrompt('The setting psalm.psalmScriptPath refers to a path that does not exist. path: ' + psalmScriptPath);
        return false;
    }

    return true;
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    const conf = vscode.workspace.getConfiguration('psalm');
    const phpExecutablePath = conf.get<string>('phpExecutablePath') || 'php';
    const workspaceFolders = vscode.workspace.workspaceFolders;
    const defaultPsalmScriptPath = path.join('vendor', 'bin', 'psalm-language-server');
    let psalmScriptPath = conf.get<string>('psalmScriptPath') || defaultPsalmScriptPath;
    const unusedVariableDetection = conf.get<boolean>('unusedVariableDetection') || false;
    const enableDebugLog = conf.get<boolean>('enableDebugLog') || false;
    const connectToServerWithTcp = conf.get<boolean>('connectToServerWithTcp');
    let analyzedFileExtensions: string[] = conf.get<string[]>('analyzedFileExtensions') || ['php'];

    // Check if the psalmScriptPath setting was provided.
    if (!psalmScriptPath) {
        await showOpenSettingsPrompt('The setting psalm.psalmScriptPath must be provided (e.g. vendor/bin/psalm-language-server)');
        return;
    }

    if (!workspaceFolders) {
        await showOpenSettingsPrompt('Psalm must be run in a workspace');
        return;
    }

    const workspacePath = workspaceFolders[0].uri.fsPath;

    if (!isFile(psalmScriptPath)) {
        psalmScriptPath = path.join(workspacePath, psalmScriptPath);
    }

    if (!isFile(path.join(workspacePath, 'psalm.xml')) && !isFile(path.join(workspacePath, 'psalm.xml.dist'))) {
        vscode.window.showErrorMessage('No psalm.xml config found in project root');
        return;
    }

    // Check if psalm is installed and supports the language server protocol.
    const isValidPsalmVersion: boolean = await checkPsalmHasLanguageServer(context, phpExecutablePath, psalmScriptPath);
    if (!isValidPsalmVersion) {
        return;
    }

    // Check path (if PHP is available and version is ^7.0.0)
    let stdout: string;
    try {
        [stdout] = await execFile(phpExecutablePath, ['--version']);
    } catch (err) {
        if (err.code === 'ENOENT') {
            await showOpenSettingsPrompt('PHP executable not found. Install PHP 7 and add it to your PATH or set the php.executablePath setting');
        } else {
            vscode.window.showErrorMessage('Error spawning PHP: ' + err.message);
            console.error(err);
        }
        return;
    }
    
    // Parse version and discard OS info like 7.0.8--0ubuntu0.16.04.2
    const match = stdout.match(/^PHP ([^\s]+)/m);
    if (!match) {
        vscode.window.showErrorMessage('Error parsing PHP version. Please check the output of php --version');
        return;
    }
    let version = match[1].split('-')[0];
    // Convert PHP prerelease format like 7.0.0rc1 to 7.0.0-rc1
    if (!/^\d+.\d+.\d+$/.test(version)) {
        version = version.replace(/(\d+.\d+.\d+)/, '$1-');
    }
    if (semver.lt(version, '7.0.0')) {
        vscode.window.showErrorMessage('The language server needs at least PHP 7 installed. Version found: ' + version);
        return;
    }

    const serverOptionsCallbackForDirectory = (dirToAnalyze: string) => (() => new Promise<ChildProcess | StreamInfo>((resolve, reject) => {
        // Listen on random port
        const spawnServer = (...args: string[]): ChildProcess => {
            if (unusedVariableDetection) {
                args.unshift('--find-dead-code');
            }

            // The server is implemented in PHP
            args.unshift(psalmScriptPath);
            console.log('starting Psalm Language Server', phpExecutablePath, args);
            
            const childProcess = spawn(phpExecutablePath, args, {cwd: dirToAnalyze});
            childProcess.stderr.on('data', (chunk: Buffer) => {
                console.error(chunk + '');
            });
            if (enableDebugLog) {
                childProcess.stdin.on('data', (chunk: Buffer) => {
                    console.log('in: ' + chunk);
                });
                childProcess.stdout.on('data', (chunk: Buffer) => {
                    console.log('out: ' + chunk);
                });
            }
            return childProcess;
        };
        // Use a TCP socket on Windows because of problems with blocking STDIO
        // stdio locks up for large responses
        // (based on https://github.com/felixfbecker/vscode-php-intellisense/commit/ddddf2a178e4e9bf3d52efb07cd05820ce109f43)
        if (connectToServerWithTcp || process.platform === 'win32') {
            const server = net.createServer(socket => {
                // 'connection' listener
                console.log('PHP process connected');
                socket.on('end', () => {
                    console.log('PHP process disconnected');
                });
                server.close();
                resolve({ reader: socket, writer: socket });
            });
            server.listen(0, '127.0.0.1', () => {
                // Start the language server and make the language server connect to the client listening on <addr> (e.g. 127.0.0.1:<port>)
                spawnServer('--tcp=127.0.0.1:' + server.address().port);
            });
        } else {
            // Use STDIO on Linux / Mac if the user set
            // the override `"psalm.connectToServerWithTcp": false` in their config.
            resolve(spawnServer());
        }
    }));

    // Options to control the language client
    const clientOptions: LanguageClientOptions = {
        // Register the server for php (and maybe HTML) documents
        documentSelector: analyzedFileExtensions,
        uriConverters: {
            // VS Code by default %-encodes even the colon after the drive letter
            // NodeJS handles it much better
            code2Protocol: uri => url.format(url.parse(uri.toString(true))),
            protocol2Code: str => vscode.Uri.parse(str)
        },
        synchronize: {
            // Synchronize the setting section 'psalm' to the server (TODO: server side support)
            configurationSection: 'psalm',
            fileEvents: vscode.workspace.createFileSystemWatcher('**/psalm.xml')
        }
    };
    
    // Create the language client and start the client.
    const disposable = new LanguageClient(
        'Psalm Language Server',
        serverOptionsCallbackForDirectory(workspacePath),
        clientOptions
    ).start();

    // Push the disposable to the context's subscriptions so that the
    // client can be deactivated on extension deactivation
    context.subscriptions.push(disposable);
}
