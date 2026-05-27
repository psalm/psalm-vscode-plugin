import { EOL } from 'node:os';
import * as path from 'node:path';
import * as semver from 'semver';
import * as vscode from 'vscode';
import { ExitNotification } from 'vscode-languageclient/node';
import type { ConfigurationService } from './ConfigurationService';
import { EXTENSION_ROOT_DIR } from './constants';
import type { LanguageServer } from './LanguageServer';
import type { LoggingService } from './LoggingService';
import { formatFromTemplate } from './utils';

interface Command {
    id: string;
    execute(): void;
}

async function restartSever(client: LanguageServer, configurationService: ConfigurationService) {
    const languageServerVersion = await client.getPsalmLanguageServerVersion();
    if (languageServerVersion === null) {
        const reload = await vscode.window.showWarningMessage(
            `This version of Psalm has a bug in that the only wayto force the Language Server to re-analyze the workspaceis to forcefully crash it. VSCode limitations only allow us to do this ${configurationService.get(
                'maxRestartCount'
            )} times per session. Consider upgrading to at least 4.9.0 of Psalm`,
            'Ok',
            'Cancel'
        );
        if (reload === 'Ok') {
            client.getClient().sendNotification(ExitNotification.type);
        }
    } else if (semver.gte(languageServerVersion, '4.9.0')) {
        await client.stop();
        client.start();
    }
}

function analyzeWorkSpace(client: LanguageServer, configurationService: ConfigurationService): Command {
    return {
        id: 'psalm.analyzeWorkSpace',
        async execute() {
            return await restartSever(client, configurationService);
        },
    };
}

function restartPsalmServer(client: LanguageServer, configurationService: ConfigurationService): Command {
    return {
        id: 'psalm.restartPsalmServer',
        async execute() {
            return await restartSever(client, configurationService);
        },
    };
}

function reportIssue(client: LanguageServer, configurationService: ConfigurationService, loggingService: LoggingService): Command {
    return {
        id: 'psalm.reportIssue',
        async execute() {
            const templatePath = path.join(EXTENSION_ROOT_DIR, 'resources', 'report_issue_template.md');

            const userSettings = Object.entries(configurationService.getAll())
                .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
                .join(EOL);
            const psalmLogs = loggingService.getContent().join(EOL);

            let phpVersion = 'unknown';
            try {
                phpVersion = (await client.getPHPVersion()) ?? 'unknown';
            } catch (err) {
                phpVersion = err instanceof Error ? err.message : String(err);
            }

            let psalmVersion: string | null = 'unknown';
            try {
                psalmVersion = (await client.getPsalmLanguageServerVersion()) ?? 'unknown';
            } catch (err) {
                psalmVersion = err instanceof Error ? err.message : String(err);
            }

            await vscode.commands.executeCommand('workbench.action.openIssueReporter', {
                extensionId: 'getpsalm.psalm-vscode-plugin',
                issueBody: await formatFromTemplate(
                    templatePath,
                    phpVersion, // 0
                    psalmVersion, // 1
                    psalmLogs, // 2
                    userSettings // 3
                ),
            });
        },
    };
}

function showOutput(loggingService: LoggingService): Command {
    return {
        id: 'psalm.showOutput',
        async execute() {
            loggingService.show();
        },
    };
}

export function registerCommands(
    client: LanguageServer,
    configurationService: ConfigurationService,
    loggingService: LoggingService
): vscode.Disposable[] {
    const commands: Command[] = [
        restartPsalmServer(client, configurationService),
        analyzeWorkSpace(client, configurationService),
        reportIssue(client, configurationService, loggingService),
        showOutput(loggingService),
    ];

    const disposables = commands.map((command) => vscode.commands.registerCommand(command.id, command.execute));

    return disposables;
}
