<p align="center">
  <img src="icon.png" alt="Psalm" width="128" />
</p>

# Psalm — PHP Static Analysis for VS Code

[![VS Marketplace version](https://img.shields.io/visual-studio-marketplace/v/getpsalm.psalm-vscode-plugin)](https://marketplace.visualstudio.com/items?itemName=getpsalm.psalm-vscode-plugin)
[![VS Code Version](https://img.shields.io/badge/VS_Code-%3E%3D1.80.2-blue?style=flat-square&logo=visualstudiocode)](https://code.visualstudio.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-blue?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![License MIT](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)

Integrates [Psalm](https://psalm.dev) — a static analysis tool for PHP — directly into VS Code via the Language Server Protocol. Get inline diagnostics, type-aware autocompletion, and hover definitions as you type, all powered by Psalm's analysis engine.

## Requirements

- PHP 7.0 or later (with `pcntl` module recommended)
- [Psalm](https://psalm.dev/docs/running_psalm/installation/) installed in your project (`vendor/bin/psalm-language-server`)
- A `psalm.xml` or `psalm.xml.dist` configuration file at the root of your workspace

## Installation

**Via VS Code Marketplace:**

```
ext install getpsalm.psalm-vscode-plugin
```

Or search for `Psalm` in the Extensions view (`Ctrl+Shift+X` / `Cmd+Shift+X`).

**Via Open VSX Registry:**

Search for `Psalm (PHP Static Analysis Linting Machine)` at [open-vsx.org](https://open-vsx.org/extension/getpsalm/psalm-vscode-plugin).

> [!NOTE]
> This extension only runs in workspace trust mode. Opening untrusted workspaces with this extension enabled is not supported, since Psalm can execute code as part of its analysis.

## Features

- **Inline diagnostics** — Psalm errors and warnings appear directly in the editor as you open and save files
- **Autocompletion** — Type-aware completions for methods and properties
- **Hover definitions** — See inferred types and documentation on hover
- **Unused variable detection** — Optionally surface unused variables and parameters
- **Multi-workspace support** — Automatically switches the active Psalm config when you move between workspace folders
- **Config file watching** — Restarts the language server automatically when `psalm.xml` changes

## Commands

All commands are available from the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) under the `Psalm` category.

| Command                                | Description                                           |
| -------------------------------------- | ----------------------------------------------------- |
| `Psalm: Restart Psalm Language server` | Restart the language server                           |
| `Psalm: Analyze Workspace`             | Re-analyze the entire workspace                       |
| `Psalm: Show Output`                   | Open the Psalm output channel                         |
| `Psalm: Report Issue`                  | Open a pre-filled GitHub issue with logs and settings |

## Configuration

| Setting                              | Default                                    | Description                                                                |
| ------------------------------------ | ------------------------------------------ | -------------------------------------------------------------------------- |
| `psalm.phpExecutablePath`            | `php` (from `$PATH`)                       | Path to the PHP executable                                                 |
| `psalm.phpExecutableArgs`            | xdebug disabled                            | Additional CLI arguments for the PHP executable                            |
| `psalm.psalmScriptPath`              | `vendor/vimeo/psalm/psalm-language-server` | Path to the Psalm language server script                                   |
| `psalm.psalmScriptArgs`              | `[]`                                       | Additional arguments passed to the language server                         |
| `psalm.psalmVersion`                 | auto-detected                              | Override Psalm version detection                                           |
| `psalm.configPaths`                  | `["psalm.xml", "psalm.xml.dist"]`          | Config file locations to search (relative to workspace root)               |
| `psalm.analyzedFileExtensions`       | `php`                                      | File types to send to Psalm for analysis                                   |
| `psalm.unusedVariableDetection`      | `false`                                    | Enable unused variable and parameter detection                             |
| `psalm.disableAutoComplete`          | `false`                                    | Disable method and property autocompletion                                 |
| `psalm.disableProvideHover`          | `false`                                    | Disable hover type information                                             |
| `psalm.connectToServerWithTcp`       | `false`                                    | Use TCP instead of stdio to connect to the language server                 |
| `psalm.enableUseIniDefaults`         | `false`                                    | Use PHP's default ini values for memory and error display                  |
| `psalm.enableVerbose`                | `false`                                    | Pass `--verbose` to the language server                                    |
| `psalm.logLevel`                     | `INFO`                                     | Extension log verbosity: `NONE`, `ERROR`, `WARN`, `INFO`, `DEBUG`, `TRACE` |
| `psalm.trace.server`                 | `off`                                      | Trace LSP traffic: `off`, `messages`, `verbose`                            |
| `psalm.hideStatusMessageWhenRunning` | `true`                                     | Hide the status bar item once Psalm is running                             |
| `psalm.maxRestartCount`              | `5`                                        | Max number of automatic restarts after a language server crash             |

> [!TIP]
> Most settings require a window reload to take effect. VS Code will prompt you when a relevant setting changes.

## Contributing

Clone the repository and install dependencies:

```bash
npm install
```

To launch the extension in a development host window, open the project in VS Code and use **Run and Debug** → **Launch Extension** (or press `F5`).

To compile a production bundle:

```bash
npm run package
```
