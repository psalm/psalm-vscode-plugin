import { workspace, WorkspaceConfiguration } from 'vscode';
import which from 'which';
import { join } from 'path';
import { DocumentSelector, integer } from 'vscode-languageserver-protocol';
import { showOpenSettingsPrompt } from './utils';
import { LogLevel } from './LoggingService';

interface Config {
    phpExecutablePath?: string;
    phpExecutableArgs?: string[];
    psalmVersion?: string;
    psalmScriptPath?: string;
    psalmScriptArgs?: string[];
    disableAutoComplete: boolean;
    maxRestartCount: integer;
    unusedVariableDetection: boolean;
    enableVerbose: boolean;
    connectToServerWithTcp: boolean;
    enableUseIniDefaults: boolean;
    logLevel: LogLevel;
    analyzedFileExtensions?: string[] | DocumentSelector;
    configPaths?: string[];
    hideStatusMessageWhenRunning: boolean;
    psalmServerScriptPath?: string;
}

export class ConfigurationService {
    private config: Config = {
        maxRestartCount: 5,
        disableAutoComplete: false,
        unusedVariableDetection: false,
        enableVerbose: false,
        connectToServerWithTcp: false,
        enableUseIniDefaults: false,
        hideStatusMessageWhenRunning: false,
        logLevel: 'INFO',
    };

    public constructor() {}

    public async init() {
        const workspaceConfiguration: WorkspaceConfiguration =
            workspace.getConfiguration('psalm');

        //Work around until types are updated
        let whichPHP: Config['phpExecutablePath'] = undefined;
        try {
            whichPHP = await which('php');
        } catch (err) {}

        // PHP Executable Path or default to which
        this.config.phpExecutablePath = workspaceConfiguration.get(
            'phpExecutablePath',
            whichPHP
        );

        // The Executable Arguments
        this.config.phpExecutableArgs = workspaceConfiguration.get(
            'phpExecutableArgs',
            [
                '-dxdebug.remote_autostart=0',
                '-dxdebug.remote_enable=0',
                '-dxdebug_profiler_enable=0',
            ]
        );

        this.config.psalmVersion =
            workspaceConfiguration.get<string>('psalmVersion');

        this.config.psalmScriptPath = workspaceConfiguration.get(
            'psalmScriptPath',
            join('vendor', 'vimeo', 'psalm', 'psalm-language-server')
        );

        this.config.psalmScriptArgs = workspaceConfiguration.get(
            'psalmScriptArgs',
            []
        );

        this.config.disableAutoComplete = workspaceConfiguration.get(
            'disableAutoComplete',
            false
        );

        this.config.maxRestartCount = workspaceConfiguration.get(
            'maxRestartCount',
            5
        );

        this.config.unusedVariableDetection = workspaceConfiguration.get(
            'unusedVariableDetection',
            false
        );

        this.config.enableVerbose = workspaceConfiguration.get(
            'enableVerbose',
            false
        );

        this.config.connectToServerWithTcp = workspaceConfiguration.get(
            'connectToServerWithTcp',
            false
        );

        this.config.enableUseIniDefaults = workspaceConfiguration.get(
            'enableUseIniDefaults',
            false
        );

        this.config.logLevel = workspaceConfiguration.get('logLevel', 'INFO');

        this.config.analyzedFileExtensions = workspaceConfiguration.get(
            'analyzedFileExtensions',
            [{ scheme: 'file', language: 'php' }]
        );

        this.config.configPaths = workspaceConfiguration.get('configPaths', [
            'psalm.xml',
            'psalm.xml.dist',
        ]);

        this.config.hideStatusMessageWhenRunning = workspaceConfiguration.get(
            'hideStatusMessageWhenRunning',
            false
        );
    }

    public async validate(): Promise<boolean> {
        // Check if the psalmServerScriptPath setting was provided.
        if (!this.config.psalmServerScriptPath) {
            await showOpenSettingsPrompt(
                'The setting psalm.psalmScriptPath must be provided (e.g. vendor/bin/psalm-language-server)'
            );
            return false;
        }
        return true;
    }

    public get<S extends keyof Config>(key: S): Config[S] {
        if (!(key in this.config)) {
            throw new Error(`Key ${key} not found in configuration`);
        }
        return this.config[key];
    }

    public getAll(): Config {
        return this.config;
    }
}
