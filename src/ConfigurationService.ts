import { workspace, WorkspaceConfiguration } from 'vscode';
import which from 'which';
import { join } from 'path';
import { DocumentSelector } from 'vscode-languageserver-protocol';
import { showOpenSettingsPrompt } from './utils';

export class ConfigurationService {
    private config: { [key: string]: any } = {};

    public constructor() {}

    public async init() {
        const workspaceConfiguration: WorkspaceConfiguration =
            workspace.getConfiguration('psalm');
        // PHP Executable Path or default to which
        this.config.phpExecutablePath =
            workspaceConfiguration.get<string>('phpExecutablePath') ||
            (await which('php'));

        // The Executable Arguments
        this.config.phpExecutableArgs = workspaceConfiguration.get<string[]>(
            'phpExecutableArgs'
        ) || [
            '-dxdebug.remote_autostart=0',
            '-dxdebug.remote_enable=0',
            '-dxdebug_profiler_enable=0',
        ];

        this.config.psalmScriptPath =
            workspaceConfiguration.get<string>('psalmScriptPath') ||
            join('vendor', 'vimeo', 'psalm', 'psalm-language-server');

        this.config.unusedVariableDetection =
            workspaceConfiguration.get<boolean>('unusedVariableDetection') ||
            false;

        this.config.enableDebugLog =
            workspaceConfiguration.get<boolean>('enableDebugLog') || false;

        this.config.connectToServerWithTcp =
            workspaceConfiguration.get<boolean>('connectToServerWithTcp') ||
            false;

        this.config.enableUseIniDefaults =
            workspaceConfiguration.get<boolean>('enableUseIniDefaults') ||
            false;

        this.config.analyzedFileExtensions = workspaceConfiguration.get<
            string[] | DocumentSelector
        >('analyzedFileExtensions') || [{ scheme: 'file', language: 'php' }];

        this.config.configPaths = workspaceConfiguration.get<string[]>(
            'configPaths'
        ) || ['psalm.xml', 'psalm.xml.dist'];

        this.config.hideStatusMessageWhenRunning =
            workspaceConfiguration.get<boolean>(
                'hideStatusMessageWhenRunning'
            ) || false;
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

    public get<T>(key: string): T {
        if (!(key in this.config)) {
            throw new Error(`Key ${key} not found in configuration`);
        }
        return this.config[key];
    }
}
