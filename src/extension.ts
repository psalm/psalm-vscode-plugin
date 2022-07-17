import * as vscode from 'vscode';
import { StatusBar } from './StatusBar';
import { LoggingService, LogLevel } from './LoggingService';
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

    // Set Logging Level
    loggingService.setOutputLevel(
        configurationService.get<LogLevel>('logLevel')
    );

    // @ts-ignore
    const statusBar = new StatusBar();

    const workspaceFolders = vscode.workspace.workspaceFolders;

    if (!workspaceFolders) {
        loggingService.logError(
            'Psalm must be run in a workspace. Select a workspace and reload the window'
        );
        return;
    }

    // const workspacePath = workspaceFolders[0].uri.fsPath;

    let activeWorkspace = vscode.window.activeTextEditor
        ? vscode.workspace.getWorkspaceFolder(
              vscode.window.activeTextEditor.document.uri
          )
        : undefined;

    let workspacePath = activeWorkspace
        ? activeWorkspace.uri.fsPath
        : workspaceFolders[0].uri.fsPath;

    const configPaths = configurationService.get<string[]>('configPaths') || [];

    if (!configPaths.length) {
        loggingService.logError(
            'No Config Paths defined. Define some and reload the window'
        );
        return;
    }

    const psalmXMLFiles = await vscode.workspace.findFiles(
        `{${configPaths.join(',')}}`
        // `**/vendor/**/{${configPaths.join(',')}}`
    );

    const psalmXMLPaths = psalmXMLFiles.map((uri) => {
        if (process.platform === 'win32') {
            return uri.path.replace(/\//g, '\\').replace(/^\\/g, '');
        }
        return uri.path;
    });

    if (!psalmXMLPaths.length) {
        // no psalm.xml found
        loggingService.logError(
            `No Config file found in: ${configPaths.join(',')}`
        );
        return;
    }

    loggingService.logDebug(
        `Found the following Psalm XML Configs:`,
        psalmXMLPaths
    );

    const configXml = psalmXMLPaths[0];

    loggingService.logDebug(`Selecting first found config file: ${configXml}`);

    const configWatcher = vscode.workspace.createFileSystemWatcher(configXml);

    const languageServer = new LanguageServer(
        context,
        workspacePath,
        configXml,
        statusBar,
        configurationService,
        loggingService
    );

    // restart the language server when changing workspaces
    const onWorkspacePathChange = async () => {
        loggingService.logInfo(`Workspace changed: ${workspacePath}`);
        languageServer.setWorkspacePath(workspacePath);
        languageServer.restart();
    };

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

    context.subscriptions.push(
        ...registerCommands(
            languageServer,
            configurationService,
            loggingService
        )
    );

    // Start Lanuage Server
    await languageServer.start();

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

    vscode.window.onDidChangeActiveTextEditor((e) => {
        if (!e) {
            return;
        }

        const tmpActiveWorkspace = vscode.workspace.getWorkspaceFolder(
            e.document.uri
        );

        const tmpWorkspacePath = tmpActiveWorkspace
            ? tmpActiveWorkspace.uri.fsPath
            : workspaceFolders[0].uri.fsPath;

        if (!tmpWorkspacePath || workspacePath === tmpWorkspacePath) return;

        activeWorkspace = tmpActiveWorkspace;
        workspacePath = tmpWorkspacePath;

        onWorkspacePathChange();
    });

    loggingService.logDebug('Finished Extension Activation');
}
