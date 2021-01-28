import * as vscode from 'vscode';
import { LanguageClient } from 'vscode-languageclient';

interface Command {
    id: string;
    execute(): Promise<vscode.Disposable>;
}

function restartPsalmServer(client: LanguageClient): Command {
    return {
        id: 'psalm.restartPsalmServer',
        async execute() {
            await client.stop();
            return client.start();
        },
    };
}

export function registerCommands(client: LanguageClient): vscode.Disposable[] {
    const commands: Command[] = [restartPsalmServer(client)];

    const disposables = commands.map((command) => {
        return vscode.commands.registerCommand(command.id, command.execute);
    });

    return disposables;
}
