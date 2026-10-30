# Developing AITrace

Open this folder in VS Code and press F5 to launch an Extension Development Host. On Windows, `Open-Demo.cmd` also launches the prototype. Run **AITrace: Start Demo** in that window.

The extension has no runtime dependencies. Node.js is needed for the development commands below.

```sh
npm run check
node scripts/smoke.js
```

Run `npm run samples` after changing the prepared cases in `samples/cases.js` to regenerate the bundled Python samples.

For integration checks, launch VS Code with this folder as `--extensionDevelopmentPath` and `scripts/integration.js` as `--extensionTestsPath`. The runner writes its result to `.runtime/integration-report.json`. Use a separate VS Code profile for testing.

Package with the VS Code extension packaging tool:

```sh
npx @vscode/vsce package --no-dependencies --allow-missing-repository --skip-license --out dist/aitrace-prototype-0.4.2.vsix
```

The latest VSIX in `dist/` is included in Git. Older packages, `.cache/`, `.runtime/`, and `node_modules/` are ignored. Sample sessions, local logs and test profiles stay in `.runtime/` and are excluded from the installation package.
