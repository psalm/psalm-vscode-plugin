import { window, commands } from 'vscode';

export async function showOpenSettingsPrompt(
    errorMessage: string
): Promise<void> {
    const selected = await window.showErrorMessage(
        errorMessage,
        'Open settings'
    );
    if (selected === 'Open settings') {
        await commands.executeCommand('workbench.action.openGlobalSettings');
    }
}

export async function showErrorMessage(
    errorMessage: string
): Promise<string | undefined> {
    return window.showErrorMessage(errorMessage);
}

export async function showWarningMessage(
    errorMessage: string
): Promise<string | undefined> {
    return window.showWarningMessage(errorMessage);
}
