# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.5.0] - 2022-01-03

### Added

-   Option to disable autocomplete on methods and properties

### Changed

-   Updated LoggingService to support new replace method
-   Updated underlying libraries

## [2.4.0] - 2021-11-15

### Added

-   Allow setting arbitrary language server parameters (#123) [@Nadyita]

## [2.3.0] - 2021-09-17

### Added

-   New "Report Issue" command (#93)
-   New "Show Output" command
-   Extend OutputChannel to be able to buffer output internally for error reporting (up to 1000 lines)
-   Add button to report server crashes
-   Abstract out Max Restart Count into a setting `psalm.maxRestartCount`

## [2.2.3] - 2021-09-17

### Fixed

-   Could not resolve path to config on windows (#84) [@glen-84]

## [2.2.2] - 2021-08-20

### Added

-   Adjust how changelog is created to that releases can be automatically created

## [2.2.1] - 2021-08-20

### Added

-   Set `untrustedWorkspaces.supported` to `false` in `capabilities`. Reasoning: Since this runs Psalm, and Psalm can be configured to execute code on your computer, you should avoid opening untrusted projects while using this plugin

## [2.2.0] - 2021-08-19

### Added

-   Add better tracing/debug/logging

### Changed

-   Consolidates OUTPUT log window into one view instead of two

### Deprecated

-   Deprecates `enableDebugLog` in favor of split settings `trace.server`, `logLevel` and `enableVerbose`. See settings for more information

## [2.1.0] - 2021-08-14

### Fixed

-   Fixes "Support for absolute paths for Psalm Client Script Path and Psalm Script Path" (#71) [@ thomasbley]

### Deprecated

-   Deprecates `psalmClientScriptPath` setting in favor of `psalmScriptPath` since `psalmClientScriptPath` fell back to `psalmScriptPath` anyways

## [2.0.6] - 2021-08-13

### Fixed

-   Fixes "Set vscode minimum version to 1.57.1" (#77) [@thomasbley]

## [2.0.5] - 2021-08-03

### Fixed

-   Fixes fix "--use-ini-defaults" option feature (typo?) (#70) [@yaegassy]

## [2.0.4] - 2021-08-02

### Added

-   Mock StreamWriter so that logging of output from language server actually logs in verbose mode
-   Add setting to "Index" workspace (Just calls same method as in #30 for now)
-   Add support for onSave, onOpen, onClose (see vimeo/psalm#6010)
-   Add support for workspace/didChangeWatchedFiles (see vimeo/psalm#6014) Fixes #32
-   Run prettier on save (vscode for this project only)
-   Bundle Extension using webpack (https://code.visualstudio.com/api/working-with-extensions/bundling-extension)

### Fixed

-   Fix settings pane to be more graphical
-   Fix #30 to not blow up because of vimeo/psalm#6007

## [1.2.1] - 2020-04-21

### Added

-   Added help links to error and warnings codes using new command line options from the Psalm Language Server.
-   Added new configuration options.
-   Added status to the VSCode status bar.

## [0.1.0] - 2018-10-19

### Added

-   First version released

## [0.5.0] - 2018-11-19

### Added

-   Windows support added
