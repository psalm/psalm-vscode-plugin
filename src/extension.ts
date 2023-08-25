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
    const loggingService = new LoggingService();
    const workspaceFolders = vscode.workspace.workspaceFolders;

    if (!workspaceFolders) {
        loggingService.logRaw(
            'Psalm must be run in a workspace. Select a workspace and reload the window',
            'ERROR'
        );
        return;
    }

    const configurationServices = workspaceFolders.map(
        (folder) => new ConfigurationService(folder)
    );

    for (const initTask of configurationServices.map((config) =>
        config.init()
    )) {
        await initTask;
    }

    const statusBar = new StatusBar(); // TODO: Share this somehow?
    for (
        let workspaceindex = 0;
        workspaceindex < workspaceFolders.length;
        workspaceindex++
    ) {
        const workspaceFolderItem = workspaceFolders[workspaceindex];
        const workspaceConfigurationService =
            configurationServices[workspaceindex];

        const getOptions = async (configService: ConfigurationService) => {
            const configPaths1 = configService.get('configPaths') || [];

            const psalmXMLFiles = await vscode.workspace.findFiles(
                `{${configPaths1.join(',')}}`
                // `**/vendor/**/{${configPaths.join(',')}}`
            );

            const psalmXMLPaths1 = psalmXMLFiles.map((uri) => {
                if (process.platform === 'win32') {
                    return uri.path.replace(/\//g, '\\').replace(/^\\/g, '');
                }
                return uri.path;
            });

            const workspacePath1 = workspaceFolderItem;

            const configXml1 =
                psalmXMLPaths1.find((path) =>
                    path.startsWith(workspacePath1.uri.fsPath)
                ) ?? psalmXMLPaths1[0];

            return {
                configPaths: configPaths1,
                psalmXMLFiles,
                psalmXMLPaths: psalmXMLPaths1,
                configXml: configXml1,
                workspacePath: workspacePath1,
            };
        };

        async function prepCreation(configService: ConfigurationService) {
            const options = await getOptions(configService);

            if (!options.configPaths.length) {
                loggingService.logError(
                    configService,
                    'No Config Paths defined. Define some and reload the window'
                );
                return;
            }

            if (!options.psalmXMLPaths.length) {
                // no psalm.xml found
                loggingService.logError(
                    configService,
                    `No Config file found in: ${options.configPaths.join(',')}`
                );
                return;
            }

            loggingService.logDebug(
                configService,
                'Found the following Psalm XML Configs:',
                options.psalmXMLPaths
            );

            loggingService.logDebug(
                configService,
                `Selecting first found config file: ${options.configXml}`
            );
            return options;
        }

        const startingoptions = await prepCreation(
            workspaceConfigurationService
        );

        if (!startingoptions) {
            return;
        }

        let {
            // configPaths,
            // psalmXMLFiles,
            // psalmXMLPaths,
            configXml,
            workspacePath,
        } = startingoptions;

        let configWatcher = vscode.workspace.createFileSystemWatcher(configXml);

        const languageServer = new LanguageServer(
            workspacePath,
            configXml,
            statusBar,
            workspaceConfigurationService,
            loggingService
        );

        // restart the language server when changing workspaces
        const onWorkspacePathChange = async () => {
            // kill the previous watcher
            configWatcher.dispose();
            configWatcher = vscode.workspace.createFileSystemWatcher(configXml);
            loggingService.logInfo(
                workspaceConfigurationService,
                `Workspace changed: ${workspacePath}`
            );
            languageServer.setWorkspacePath(workspacePath.uri.fsPath);
            languageServer.setPsalmConfigPath(configXml);
            languageServer.restart();
        };

        const onConfigChange = () => {
            loggingService.logInfo(
                workspaceConfigurationService,
                `Config file changed: ${configXml}`
            );
            languageServer.restart();
        };

        const onConfigDelete = () => {
            loggingService.logInfo(
                workspaceConfigurationService,
                `Config file deleted: ${configXml}`
            );
            languageServer.stop();
        };

        // Restart the language server when the tracked config file changes
        configWatcher.onDidChange(onConfigChange);
        configWatcher.onDidCreate(onConfigChange);
        configWatcher.onDidDelete(onConfigDelete);

        if (workspaceindex === 0) {
            // TODO: make commands work for multiple lsps
            context.subscriptions.push(
                ...registerCommands(
                    languageServer,
                    workspaceConfigurationService,
                    loggingService
                )
            );
        }

        // Start Lanuage Server
        await languageServer.start();

        vscode.workspace.onDidChangeConfiguration(async (change) => {
            if (
                !change.affectsConfiguration('psalm') ||
                change.affectsConfiguration(
                    'psalm.hideStatusMessageWhenRunning'
                )
            ) {
                return;
            }
            loggingService.logDebug(
                workspaceConfigurationService,
                'Configuration changed'
            );
            showWarningMessage(
                'You will need to reload this window for the new configuration to take effect'
            );

            await workspaceConfigurationService.init();
        });

        vscode.window.onDidChangeActiveTextEditor(async (e) => {
            if (!e) {
                return;
            }

            const options = await getOptions(workspaceConfigurationService);

            if (
                !options.workspacePath ||
                workspacePath === options.workspacePath
            ) {
                return;
            }

            // configPaths = options.configPaths;
            configXml = options.configXml;
            // psalmXMLFiles = options.psalmXMLFiles;
            // psalmXMLPaths = options.psalmXMLPaths;
            workspacePath = options.workspacePath;

            onWorkspacePathChange();
        });
    }

    loggingService.logRaw('Finished Extension Activation', 'DEBUG');
}

export async function deactivate() {
    // Extensions should now implement a deactivate function in
    // their extension main file and correctly return the stop
    // promise from the deactivate call.
}
