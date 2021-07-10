import * as vscode from 'vscode';
import { ExitNotification } from 'vscode-languageclient/node';
import * as semver from 'semver';
import { LanguageServer } from './LanguageServer';
interface Command {
    id: string;
    execute(): void;
}

async function restartSever(client: LanguageServer) {
    const languageServerVersion = await client.getPsalmLanguageServerVersion();
    if (languageServerVersion === null) {
        const reload = await vscode.window.showWarningMessage(
            'This version of Psalm has a bug in that the only way to force the Language Server to re-analyze the workspace is to forcefully crash it. VSCode limitations only allow us to do this 5 times per session',
            'Ok',
            'Cancel'
        );
        if (reload === 'Ok') {
            client.getClient().sendNotification(ExitNotification.type);
        }
    } else if (semver.gt('4.8.1', languageServerVersion)) {
        await client.stop();
        client.start();
    }
}

function analyzeWorkSpace(client: LanguageServer): Command {
    return {
        id: 'psalm.analyzeWorkSpace',
        async execute() {
            return await restartSever(client);
        },
    };
}

function restartPsalmServer(client: LanguageServer): Command {
    return {
        id: 'psalm.restartPsalmServer',
        async execute() {
            return await restartSever(client);
        },
    };
}

export function registerCommands(client: LanguageServer): vscode.Disposable[] {
    const commands: Command[] = [
        restartPsalmServer(client),
        analyzeWorkSpace(client),
    ];

    const disposables = commands.map((command) => {
        return vscode.commands.registerCommand(command.id, command.execute);
    });

    return disposables;
}
