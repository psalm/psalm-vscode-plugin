import { type LogLevel as ChannelLogLevel, type Event, type LogOutputChannel, type ViewColumn, window } from 'vscode';

export type LogLevel = 'TRACE' | 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'NONE';
export class LoggingService implements LogOutputChannel {
    readonly name: string = 'Psalm Language Server';

    private outputChannel = window.createOutputChannel('Psalm Language Server', { log: true });

    private outputLevel: LogLevel = 'DEBUG';

    /**
     * The log level of the channel, set by the user in VS Code.
     */
    get logLevel(): ChannelLogLevel {
        return this.outputChannel.logLevel;
    }

    readonly onDidChangeLogLevel: Event<ChannelLogLevel> = this.outputChannel.onDidChangeLogLevel;

    private content: string[] = [];

    private contentLimit = 1000;

    /**
     * Replaces all output from the channel with the given value.
     *
     * @param value A string, falsy values will not be printed.
     */
    replace(value: string): void {
        this.content = [value];
        this.outputChannel.replace(value);
    }

    /**
     * Append the given value to the channel.
     *
     * @param value A string, falsy values will not be printed.
     */
    append(value: string): void {
        this.record(value);
        this.outputChannel.append(value);
    }

    /**
     * Append the given value and a line feed character
     * to the channel.
     *
     * @param value A string, falsy values will be printed.
     */
    appendLine(value: string): void {
        this.record(value);
        this.outputChannel.appendLine(value);
    }

    /**
     * Removes all output from the channel.
     */
    clear(): void {
        this.content = [];
        this.outputChannel.clear();
    }

    /**
     * Reveal this channel in the UI.
     *
     * @param preserveFocus When `true` the channel will not take focus.
     */
    show(preserveFocus?: boolean): void;
    show(column?: ViewColumn, preserveFocus?: boolean): void;
    show(columnOrFocus?: ViewColumn | boolean, preserveFocus?: boolean): void {
        if (typeof columnOrFocus === 'boolean' || columnOrFocus === undefined) {
            this.outputChannel.show(columnOrFocus);
        } else {
            this.outputChannel.show(columnOrFocus, preserveFocus);
        }
    }

    /**
     * Hide this channel from the UI.
     */
    hide(): void {
        this.outputChannel.hide();
    }

    /**
     * Dispose and free associated resources.
     */
    dispose(): void {
        this.outputChannel.dispose();
    }

    /**
     * Outputs a trace message, such as the messages the language client traces.
     */
    trace(message: string, ...args: unknown[]): void {
        this.record(message);
        this.outputChannel.trace(message, ...args);
    }

    /**
     * Outputs a debug message.
     */
    debug(message: string, ...args: unknown[]): void {
        this.record(message);
        this.outputChannel.debug(message, ...args);
    }

    /**
     * Outputs an info message.
     */
    info(message: string, ...args: unknown[]): void {
        this.record(message);
        this.outputChannel.info(message, ...args);
    }

    /**
     * Outputs a warning message.
     */
    warn(message: string, ...args: unknown[]): void {
        this.record(message);
        this.outputChannel.warn(message, ...args);
    }

    /**
     * Outputs an error message.
     */
    error(error: string | Error, ...args: unknown[]): void {
        this.record(typeof error === 'string' ? error : (error.stack ?? error.message));
        this.outputChannel.error(error, ...args);
    }

    public setOutputLevel(logLevel: LogLevel) {
        this.outputLevel = logLevel;
    }

    public getOutputLevel(): LogLevel {
        return this.outputLevel;
    }

    public logTrace(message: string, data?: unknown): void {
        if (
            this.outputLevel === 'NONE' ||
            this.outputLevel === 'INFO' ||
            this.outputLevel === 'WARN' ||
            this.outputLevel === 'ERROR' ||
            this.outputLevel === 'DEBUG'
        ) {
            return;
        }
        this.logMessage(message, 'TRACE');
        if (data) {
            this.logObject(data);
        }
    }

    /**
     * Append messages to the output channel and format it with a title
     *
     * @param message The message to append to the output channel
     */
    public logDebug(message: string, data?: unknown): void {
        if (this.outputLevel === 'NONE' || this.outputLevel === 'INFO' || this.outputLevel === 'WARN' || this.outputLevel === 'ERROR') {
            return;
        }
        this.logMessage(message, 'DEBUG');
        if (data) {
            this.logObject(data);
        }
    }

    /**
     * Append messages to the output channel and format it with a title
     *
     * @param message The message to append to the output channel
     */
    public logInfo(message: string, data?: unknown): void {
        if (this.outputLevel === 'NONE' || this.outputLevel === 'WARN' || this.outputLevel === 'ERROR') {
            return;
        }
        this.logMessage(message, 'INFO');
        if (data) {
            this.logObject(data);
        }
    }

    /**
     * Append messages to the output channel and format it with a title
     *
     * @param message The message to append to the output channel
     */
    public logWarning(message: string, data?: unknown): void {
        if (this.outputLevel === 'NONE' || this.outputLevel === 'ERROR') {
            return;
        }
        this.logMessage(message, 'WARN');
        if (data) {
            this.logObject(data);
        }
    }

    public logError(message: string, error?: Error | string) {
        if (this.outputLevel === 'NONE') {
            return;
        }
        this.logMessage(message, 'ERROR');
        if (typeof error === 'string') {
            // Errors as a string usually only happen with
            // plugins that don't return the expected error.
            this.appendLine(error);
        } else if (error?.message || error?.stack) {
            if (error?.message) {
                this.logMessage(error.message, 'ERROR');
            }
            if (error?.stack) {
                this.appendLine(error.stack);
            }
        } else if (error) {
            this.logObject(error);
        }
    }

    public getContent(): string[] {
        return this.content;
    }

    /**
     * Keeps the last messages, for bug reports.
     */
    private record(value: string): void {
        this.content.push(value);
        this.content = this.content.slice(-this.contentLimit);
    }

    private logObject(data: unknown): void {
        this.appendLine(JSON.stringify(data, null, 2));
    }

    /**
     * Append messages to the output channel and format it with a title
     *
     * @param message The message to append to the output channel
     */
    private logMessage(message: string, logLevel: LogLevel): void {
        const title = new Date().toLocaleTimeString();
        this.appendLine(`[${logLevel}  - ${title}] ${message}`);
    }
}
