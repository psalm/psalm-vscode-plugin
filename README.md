# psalm-vscode-plugin

Visual Studio Code plugin for Psalm.

## Features

-   Runs [Psalm's analysis](https://getpsalm.org) when opening and saving files using the Language Server Protocol for communication.

## Known Security Issues

Since this runs Psalm, and Psalm can be configured to execute code on your computer, you should avoid opening untrusted projects while using this plugin.

## Contributing

You can build and test locally in Visual Studio this locally using `npm`:

```
npm install
npm run build
```
