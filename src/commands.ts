import * as vscode from 'vscode';
import { LanguageClient, ExitNotification } from 'vscode-languageclient/node';
import * as semver from 'semver';
interface Command {
    id: string;
    execute(): void;
}

let warned: boolean = false;

function analyzeWorkSpace(
    client: LanguageClient,
    languageServerVersion: string | null
): Command {
    return {
        id: 'psalm.analyzeWorkSpace',
        async execute() {
            console.log(client.info);
            if (languageServerVersion === null) {
                if (!warned) {
                    await vscode.window.showWarningMessage(
                        'This version of Psalm has a bug in that the only way to force the Language Server to re-analyze the workspace is to forcefully crash it. VSCode limitations only allow us to do this 5 times per session'
                    );
                }
                warned = true;
                client.sendNotification(ExitNotification.type);
            } else if (semver.gt('4.8.1', languageServerVersion)) {
                await client.stop();
                client.start();
            }
            return;
        },
    };
}

function restartPsalmServer(
    client: LanguageClient,
    languageServerVersion: string | null
): Command {
    return {
        id: 'psalm.restartPsalmServer',
        async execute() {
            if (languageServerVersion === null) {
                if (!warned) {
                    await vscode.window.showWarningMessage(
                        'This version of Psalm has a bug in that the only way to restart the Language Server is to forcefully crash it. VSCode limitations only allow us to do this 5 times per session'
                    );
                }
                warned = true;
                client.sendNotification(ExitNotification.type);
            } else if (semver.gt('4.8.1', languageServerVersion)) {
                await client.stop();
                client.start();
            }
            return;
        },
    };
}

export function registerCommands(
    client: LanguageClient,
    languageServerVersion: string | null
): vscode.Disposable[] {
    const commands: Command[] = [
        restartPsalmServer(client, languageServerVersion),
        analyzeWorkSpace(client, languageServerVersion),
    ];

    const disposables = commands.map((command) => {
        return vscode.commands.registerCommand(command.id, command.execute);
    });

    return disposables;
}
