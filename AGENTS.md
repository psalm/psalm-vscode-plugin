# AGENTS.md

## Project Overview

PSalm VS Code plugin that integrates [Psalm](https://psalm.dev) PHP static analysis into VS Code via the Language Server Protocol. Provides inline diagnostics, type-aware autocompletion, and hover definitions for PHP projects.

- **Language**: TypeScript
- **Platform**: VS Code Extension (Node.js)
- **Build Tool**: esbuild
- **Linter/Formatter**: Biome
- **Node Version**: 24.x (see `.nvmrc`)

## Setup Commands

- Install dependencies: `npm install`
- Compile development build: `npm run compile`
- Watch mode: `npm run watch`
- Production package: `npm run package`
- Lint and type-check: `npm run lint`

## Development Workflow

- Use `npm run watch` for continuous builds during development.
- Debug extension: Open project in VS Code and press F5 (uses `.vscode/launch.json` which opens `test-project/` as the debug target).
- The extension entry point is `src/extension.ts`. Source files are in `src/`.
- Compiled output goes to `dist/extension.js` (bundled with esbuild).

## Testing Instructions

- CI runs `npm run lint` and `npm run package` on every push and PR.
- No dedicated test suite currently. Linting and compilation serve as the quality gate.
- `npm run lint` runs Biome checks on `src/` and `tsc --noEmit` for type checking.

## Code Style

- Biome handles linting and formatting (`biome.json` at root).
- 4-space indentation, single quotes, semicolons always, trailing commas (es5 style).
- Line width: 140.
- Biome rules include: `useConst`, `noNonNullAssertion`, `useShorthandFunctionType`, `noInferrableTypes`, `useBlockStatements`, `useThrowOnlyError`.
- TypeScript strict mode is enabled (`tsconfig.json`): `noImplicitAny`, `strictNullChecks`, `noImplicitThis`, `noImplicitReturns`, `noUnusedLocals`.
- Run `npm run lint` before committing to check both Biome and TypeScript.

## Build and Deployment

- Development compile: `npm run compile` (esbuild bundle to `dist/extension.js` with sourcemap).
- Production package: `npm run package` (minified bundle, no sourcemap).
- VSIX package: `npm run vsce:package`.
- Publish to marketplaces: `npm run vsce:publish` (requires personal access token).
- CI/CD: GitHub Actions handle lint, build, tagged releases, and marketplace publishing (see `.github/workflows/`).

## Pull Request Guidelines

- Run `npm run lint` and `npm run package` before pushing.
- CI will fail if either command fails.
- See `.github/pull_request_template.md` for PR template.

## Additional Notes

- The extension requires a workspace with a `psalm.xml` or `psalm.xml.dist` config file.
- `test-project/` is used as the debug target folder containing a minimal PHP project.
- Extension settings are defined in `package.json` under `contributes.configuration`.
- The extension does not support untrusted workspaces (runs external Psalm processes).
