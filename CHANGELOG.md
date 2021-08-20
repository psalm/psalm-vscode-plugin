# 2.2.1 - 2021-08-20

-   Set `untrustedWorkspaces.supported` to `false` in `capabilities`. Reasoning: Since this runs Psalm, and Psalm can be configured to execute code on your computer, you should avoid opening untrusted projects while using this plugin

# 2.2.0 - 2021-08-19

-   Add better tracing/debug/logging
-   Deprecates `enableDebugLog` in favor of split settings `trace.server`, `logLevel` and `enableVerbose`. See settings for more information
-   Consolidates OUTPUT log window into one view instead of two

# 2.1.0 - 2021-08-14

-   Fixes "Support for absolute paths for Psalm Client Script Path and Psalm Script Path" (#71) [@ thomasbley]
-   Deprecates `psalmClientScriptPath` setting in favor of `psalmScriptPath` since `psalmClientScriptPath` fell back to `psalmScriptPath` anyways

# 2.0.6 - 2021-08-13

-   Fixes "Set vscode minimum version to 1.57.1" (#77) [@thomasbley]

# 2.0.5 - 2021-08-03

-   Fixes fix "--use-ini-defaults" option feature (typo?) (#70) [@yaegassy]

# 2.0.4 - 2021-08-02

-   Fix settings pane to be more graphical
-   Mock StreamWriter so that logging of output from language server actually logs in verbose mode
-   Fix #30 to not blow up because of vimeo/psalm#6007
-   Add setting to "Index" workspace (Just calls same method as in #30 for now)
-   Add support for onSave, onOpen, onClose (see vimeo/psalm#6010)
-   Add support for workspace/didChangeWatchedFiles (see vimeo/psalm#6014) Fixes #32
-   Update dependencies
-   Look at #36
-   Look at #11
-   Run prettier on save (vscode for this project only)
-   Bundle Extension using webpack (https://code.visualstudio.com/api/working-with-extensions/bundling-extension)
-   While running Psalm should not show status bar message (Which is useless and takes up space)

# 1.2.1 - 2020-04-21

-   Added help links to error and warnings codes using new command line options from the Psalm Language Server.
-   Added new configuration options.
-   Added status to the VSCode status bar.
-   Various bug fixes.

# 0.1.0 - 2018-10-19

-   First version released

# 0.5.0 - 2018-11-19

-   Windows support added
