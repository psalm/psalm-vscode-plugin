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

    /** @deprecated */
    const configurationService = configurationServices[0];

    const statusBar = new StatusBar();

    /** @deprecated */
    const getCurrentWorkspace = (
        workspaceFolders1: readonly vscode.WorkspaceFolder[]
    ) => {
        const { uri } = vscode.window.activeTextEditor?.document ?? {
            uri: undefined,
        };
        const activeWorkspace = uri
            ? vscode.workspace.getWorkspaceFolder(uri)
            : workspaceFolders1[0];

        const workspacePath1 = activeWorkspace
            ? activeWorkspace.uri.fsPath
            : workspaceFolders1[0].uri.fsPath;

        return { workspacePath: workspacePath1 };
    };

    const getOptions = async () => {
        const configPaths1 = configurationService.get('configPaths') || [];

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

        const { workspacePath: workspacePath1 } =
            getCurrentWorkspace(workspaceFolders);

        const configXml1 =
            psalmXMLPaths1.find((path) => path.startsWith(workspacePath1)) ??
            psalmXMLPaths1[0];

        return {
            configPaths: configPaths1,
            psalmXMLFiles,
            psalmXMLPaths: psalmXMLPaths1,
            configXml: configXml1,
            workspacePath: workspacePath1,
        };
    };

    let {
        configPaths,
        // psalmXMLFiles,
        psalmXMLPaths,
        configXml,
        workspacePath,
    } = await getOptions();

    if (!configPaths.length) {
        loggingService.logError(
            configurationService,
            'No Config Paths defined. Define some and reload the window'
        );
        return;
    }

    if (!psalmXMLPaths.length) {
        // no psalm.xml found
        loggingService.logError(
            configurationService,
            `No Config file found in: ${configPaths.join(',')}`
        );
        return;
    }

    loggingService.logDebug(
        configurationService,
        'Found the following Psalm XML Configs:',
        psalmXMLPaths
    );

    loggingService.logDebug(
        configurationService,
        `Selecting first found config file: ${configXml}`
    );

    let configWatcher = vscode.workspace.createFileSystemWatcher(configXml);

    const languageServer = new LanguageServer(
        workspacePath,
        configXml,
        statusBar,
        configurationService,
        loggingService
    );

    // restart the language server when changing workspaces
    const onWorkspacePathChange = async () => {
        // kill the previous watcher
        configWatcher.dispose();
        configWatcher = vscode.workspace.createFileSystemWatcher(configXml);
        loggingService.logInfo(
            configurationService,
            `Workspace changed: ${workspacePath}`
        );
        languageServer.setWorkspacePath(workspacePath);
        languageServer.setPsalmConfigPath(configXml);
        languageServer.restart();
    };

    const onConfigChange = () => {
        loggingService.logInfo(
            configurationService,
            `Config file changed: ${configXml}`
        );
        languageServer.restart();
    };

    const onConfigDelete = () => {
        loggingService.logInfo(
            configurationService,
            `Config file deleted: ${configXml}`
        );
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
        loggingService.logDebug(configurationService, 'Configuration changed');
        showWarningMessage(
            'You will need to reload this window for the new configuration to take effect'
        );

        await configurationService.init();
    });

    vscode.window.onDidChangeActiveTextEditor(async (e) => {
        if (!e) {
            return;
        }

        const options = await getOptions();

        if (!options.workspacePath || workspacePath === options.workspacePath) {
            return;
        }

        configPaths = options.configPaths;
        configXml = options.configXml;
        // psalmXMLFiles = options.psalmXMLFiles;
        psalmXMLPaths = options.psalmXMLPaths;
        workspacePath = options.workspacePath;

        onWorkspacePathChange();
    });

    loggingService.logRaw('Finished Extension Activation', 'DEBUG');
}

export async function deactivate() {
    // Extensions should now implement a deactivate function in
    // their extension main file and correctly return the stop
    // promise from the deactivate call.
}
