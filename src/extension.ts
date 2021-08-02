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
}
