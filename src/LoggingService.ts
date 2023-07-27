import { window, OutputChannel } from 'vscode';
import { ConfigurationService } from './ConfigurationService';

export type LogLevel = 'TRACE' | 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'NONE';
export class LoggingService implements OutputChannel {
    readonly name: string = 'Psalm Language Server';

    private outputChannel = window.createOutputChannel('Psalm Language Server');

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
        this.content.push(value);
        this.content = this.content.slice(-this.contentLimit);
        this.outputChannel.append(value);
    }

    /**
     * Append the given value and a line feed character
     * to the channel.
     *
     * @param value A string, falsy values will be printed.
     */
    appendLine(value: string): void {
        this.content.push(value);
        this.content = this.content.slice(-this.contentLimit);
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
    show(): void {
        this.outputChannel.show(...arguments);
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

    public logTrace(
        config: ConfigurationService,
        message: string,
        data?: unknown
    ): void {
        const logLevel = config.get('logLevel');
        if (
            logLevel === 'NONE' ||
            logLevel === 'INFO' ||
            logLevel === 'WARN' ||
            logLevel === 'ERROR' ||
            logLevel === 'DEBUG'
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
    public logDebug(
        config: ConfigurationService,
        message: string,
        data?: unknown
    ): void {
        const logLevel = config.get('logLevel');
        if (
            logLevel === 'NONE' ||
            logLevel === 'INFO' ||
            logLevel === 'WARN' ||
            logLevel === 'ERROR'
        ) {
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
    public logInfo(
        config: ConfigurationService,
        message: string,
        data?: unknown
    ): void {
        const logLevel = config.get('logLevel');
        if (
            logLevel === 'NONE' ||
            logLevel === 'WARN' ||
            logLevel === 'ERROR'
        ) {
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
    public logWarning(
        config: ConfigurationService,
        message: string,
        data?: unknown
    ): void {
        const logLevel = config.get('logLevel');
        if (logLevel === 'NONE' || logLevel === 'ERROR') {
            return;
        }
        this.logMessage(message, 'WARN');
        if (data) {
            this.logObject(data);
        }
    }

    public logError(
        config: ConfigurationService,
        message: string,
        error?: Error | string
    ) {
        const logLevel = config.get('logLevel');
        if (logLevel === 'NONE') {
            return;
        }
        this.logRaw(message, 'ERROR', error);
    }

    /**
     * This should only be used when a ConfigurationService isn't obvious
     */
    public logRaw(message: string, logLevel: LogLevel, error?: Error | string) {
        this.logMessage(message, logLevel);
        if (typeof error === 'string') {
            // Errors as a string usually only happen with
            // plugins that don't return the expected error.
            this.appendLine(error);
        } else if (error?.message || error?.stack) {
            if (error?.message) {
                this.logMessage(error.message, logLevel);
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
