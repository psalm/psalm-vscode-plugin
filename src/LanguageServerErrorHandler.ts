import {
    Message,
    ErrorHandler,
    ErrorAction,
    CloseAction,
} from 'vscode-languageclient/node';
import { showReportIssueErrorMessage } from './utils';

export default class LanguageServerErrorHandler implements ErrorHandler {
    private readonly restarts: number[];

    constructor(private name: string, private maxRestartCount: number) {
        this.restarts = [];
    }

    public error(_error: Error, _message: Message, count: number): ErrorAction {
        if (count && count <= 3) {
            return ErrorAction.Continue;
        }
        return ErrorAction.Shutdown;
    }
    public closed(): CloseAction {
        this.restarts.push(Date.now());
        if (this.restarts.length <= this.maxRestartCount) {
            return CloseAction.Restart;
        } else {
            let diff =
                this.restarts[this.restarts.length - 1] - this.restarts[0];
            if (diff <= 3 * 60 * 1000) {
                void showReportIssueErrorMessage(
                    `The ${this.name} server crashed ${
                        this.maxRestartCount + 1
                    } times in the last 3 minutes. The server will not be restarted.`
                );
                return CloseAction.DoNotRestart;
            } else {
                this.restarts.shift();
                return CloseAction.Restart;
            }
        }
    }
}
