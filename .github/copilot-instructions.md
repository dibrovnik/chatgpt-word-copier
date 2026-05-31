# Project Guidelines

## Code Style
- **Vanilla JavaScript with ES Modules**: Use `.mjs` for Node scripts and `.js` for browser files.
- **Cross-Browser abstraction**: Always use `src/lib/browser-api.js` to abstract Chrome vs. Firefox extension API differences instead of calling `chrome.*` or `browser.*` directly.
- **DOM Manipulations**: Prefer explicit DOM querying and manipulation when interacting with ChatGPT's UI (e.g., checking `data-message-author-role`).

## Architecture
This is a cross-browser extension (Chrome MV3 and Firefox MV2) utilizing a three-layer architecture:
- **Content Scripts (`src/content/`)**: Injected into ChatGPT pages. Handles UI elements (copy/export buttons) and extracts content/DOM.
- **Background Worker (`src/background/`)**: Manages downloads and cross-script messaging.
- **Popup UI (`src/popup/`)**: Manages user settings (math mode, theme, language).
- **Shared Libraries (`src/lib/`)**: Core utilities like `docx-builder.js`, `dom-extractor.js`, and `mathml-to-omml.js`.

## Build and Test
- **Build**: Use `npm run build` for Chrome (outputs to `dist/`) or `npm run build:firefox` for Firefox (outputs to `dist-firefox/`). The build is orchestrated by `scripts/build.mjs` using `esbuild`.
- **Development**: Use `npm run watch` or `npm run watch:firefox` for incremental builds with inline source maps.
- **Test**: Run `npm test` or `npm run test:watch`. Tests use Vitest with a `jsdom` environment. Globals (`describe`, `it`, `expect`) are automatically enabled. Tests simulate ChatGPT's actual DOM structure.
- **Version Management**: Use `npm run version:patch` (or minor/major) which automatically syncs `package.json` versions into both Chrome and Firefox manifests via `scripts/version.mjs`.

## Conventions
- **Message IPC**: Communication between Content Scripts and the Background Worker must use message-based IPC (`chrome.runtime.sendMessage`).
- **Settings**: Store user preferences via the browser storage API abstraction.
- **DOM Dependencies**: Tests for DOM extraction must simulate the actual structure of ChatGPT messages.
