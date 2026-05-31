# AGENTS.md

## Scope

These instructions apply to the entire repository.

This repository contains the source code for **ChatGPT -> Word Copier**, a
cross-browser extension for copying ChatGPT responses into Microsoft Word while
preserving formatting, tables, code blocks, and math. It also exports responses
to DOCX and PDF and stores reusable prompts.

Before changing code, inspect the relevant source file, its tests, both browser
manifests, and the build scripts when the change can affect packaging.

## Browser Targets and Manifests

The extension intentionally ships two different manifest formats:

| Target | Source manifest | Manifest version | Important platform details |
| --- | --- | --- | --- |
| Chrome, Edge, Brave | `src/manifest.json` | **Manifest V3** | Uses `background.service_worker`, `action`, and `host_permissions`. |
| Firefox | `src/manifest.firefox.json` | **Manifest V2** | Uses non-persistent `background.scripts`, `browser_action`, and host patterns inside `permissions`. Minimum Firefox version is `109.0`. |

Do not assume that both targets use the same manifest version. Do not copy
Chrome-only keys into the Firefox manifest or Firefox-only keys into the Chrome
manifest. A manifest migration is a separate compatibility task and must not be
done incidentally.

The canonical extension version is `package.json#version`.
`scripts/version.mjs` syncs it into both source manifests. Build and package
commands run that sync automatically. Do not edit only one manifest version and
do not bump the version unless the task requires a release.

## Manifest V3 Remote Code Rule

Chrome Web Store Manifest V3 review requires all executable extension logic to
be included in the submitted package. Do not add remote script loading, remote
WebAssembly loading, remotely hosted logic, `eval`, or equivalent execution
paths.

The direct PDF export uses locally bundled `pdfmake` and `html-to-pdfmake`.
`pdfmake` is configured to deny external resource downloads during direct PDF
generation. Do not replace that with CDN imports or allow remote resource
loading without reviewing the Manifest V3 store implications.

`scripts/pdfmake-mv3-plugin.mjs` removes optional dynamic execution fallbacks
from bundled `pdfmake` dependencies and the browser build of `jszip`, then fails
the build if forbidden patterns remain. Keep this transform enabled and update
it deliberately when upgrading either dependency.

When changing dependencies, PDF code, or packaging, run both builds and inspect
the generated packages for remote executable code. URLs used as XML namespace
identifiers or dependency license comments are not remote executable code;
review URL matches in context.

## Architecture

### Runtime Entrypoints

- `src/content/content.js`
  - Injected into ChatGPT pages.
  - Adds per-response copy, DOCX, and PDF buttons.
  - Adds prompt-copy and saved-prompt behavior for user messages.
  - Watches the page for dynamically added messages.
  - Receives popup messages and delegates to shared libraries.
- `src/popup/popup.html`, `src/popup/popup.js`, `src/popup/popup.css`
  - Extension popup for actions on the latest response.
  - Manages language, formula mode, button visibility, response-button limit,
    DOCX theme preference, and saved prompts.
- `src/background/background.js`
  - Handles installation defaults and browser download requests.
  - Runs as a service worker on Chromium and a non-persistent background script
    on Firefox.

### Shared Libraries

- `src/lib/browser-api.js`
  - Promise-based abstraction over Chromium `chrome.*` callbacks and Firefox
    `browser.*` promises.
- `src/lib/dom-extractor.js`
  - Locates ChatGPT messages, removes UI-only elements and citations, and
    converts response DOM into structured blocks or clean clipboard HTML.
- `src/lib/clipboard-helper.js`
  - Produces rich HTML and plain-text clipboard data, including MathML handling
    and a legacy clipboard fallback.
- `src/lib/mathml-to-omml.js`
  - Converts MathML and common LaTeX forms into Word OMML XML.
- `src/lib/docx-builder.js`
  - Builds DOCX ZIP packages with WordprocessingML, styles, numbering, tables,
    code blocks, links, and equations.
- `src/lib/pdf-generator.js`
  - Opens a print-ready view and delegates direct PDF downloads to pdfmake.
- `src/lib/pdf-document.js`
  - Cleans ChatGPT HTML and converts it into a text-based pdfmake document so
    the layout engine handles line wrapping, lists, tables, and page breaks.
- `src/lib/i18n.js`
  - English and Russian translations plus language normalization.

### Tooling

- `scripts/build.mjs`
  - Copies static assets and bundles each browser entrypoint with `esbuild`.
  - Produces `dist/` for Chromium and `dist-firefox/` for Firefox.
- `scripts/pdfmake-mv3-plugin.mjs`
  - Removes optional dynamic execution fallbacks from bundled dependencies and
    fails builds that still contain MV3-incompatible execution paths.
- `scripts/package.mjs`
  - Creates local ZIP archives from a generated distribution directory.
- `scripts/version.mjs`
  - Synchronizes the version from `package.json` into both manifests.
- `scripts/generate-icons.mjs`
  - Regenerates extension icons in `src/icons/`.

## Source of Truth and Generated Files

Edit files under `src/`, `scripts/`, `tests/`, and repository documentation.

Do not edit `dist/`, `dist-firefox/`, or ZIP archives manually. They are
generated, ignored by Git, and replaced by build or package commands.

`node_modules/` is also generated. If a dependency must change, update
`package.json` and `package-lock.json`; do not patch installed dependency files.

## Cross-Browser Rules

- Use helpers from `src/lib/browser-api.js` for new extension API access.
- Extend that helper when a required browser API does not have a wrapper yet.
- Keep callback-style Chromium and Promise-style Firefox behavior compatible.
- Use message-based communication between popup, content script, and background
  code.
- Preserve both Chromium and Firefox builds when changing entrypoints,
  permissions, messaging, or downloads.

The existing popup reads `chrome.runtime.getManifest()` directly only to show a
version label and catches failures. Treat that as an existing narrow exception,
not a pattern for new API calls.

## Runtime Data and IPC

Settings are stored with the browser storage abstraction. Current keys include:

- `language`
- `mathMode`
- `showButtons`
- `gptButtonsLimit`
- `darkThemeDocx`
- `savedPrompts`

The popup sends content-script actions such as `copyForWord`, `exportDocx`,
`exportPdf`, and `settingsChanged`. The background script handles `download`.
When adding or changing a message, update sender and receiver together and keep
the async response behavior compatible with both browsers.

## DOM and Document Generation Rules

ChatGPT DOM structure is an external dependency and can change. Prefer resilient
selectors based on stable attributes such as `data-message-author-role`, keep UI
cleanup explicit, and add fixtures to `tests/dom-extractor.test.js` for changed
selectors or extraction behavior.

DOCX generation emits XML manually. Escape user-controlled text, preserve valid
WordprocessingML namespaces, and inspect generated DOCX contents in tests when
changing XML generation. Math changes should cover both extraction and
MathML/LaTeX-to-OMML conversion where relevant.

## Commands

CI uses Node.js 20.

```bash
npm ci
npm test
npm run build
npm run build:firefox
npm run build:all
npm run package
npm run package:firefox
npm run package:all
npm run watch
npm run watch:firefox
```

There is currently no configured lint script. Use `git diff --check` for
whitespace validation and run the builds relevant to the change.

## Verification Expectations

For ordinary source changes:

```bash
npm test
npm run build:all
git diff --check
```

For dependency, PDF, build, manifest, packaging, or release-related changes:

```bash
npm test
npm run package:all
git diff --check
rg -n "createElement\\(['\\\"]script|importScripts\\(|eval\\(|new\\s+Function|Function\\s*\\(\\s*['\\\"]" dist dist-firefox
```

Review any matches from the final scan in context. Packaged extension code must
not fetch or execute remote scripts.

For UI behavior, also load `dist/` as an unpacked Chromium extension and test
the affected ChatGPT flow manually when a browser session is available.

## Tests

Tests use Vitest with the `jsdom` environment:

- `tests/browser-api.test.js`: Chromium and Firefox API normalization.
- `tests/dom-extractor.test.js`: ChatGPT DOM parsing and cleanup.
- `tests/mathml-to-omml.test.js`: XML escaping and equation conversion.
- `tests/docx-builder.test.js`: DOCX archive structure and generated XML.
- `tests/pdf-document.test.js`: text-based direct PDF document conversion.
- `tests/pdfmake-mv3-plugin.test.mjs`: removal of dynamic PDF dependency code.

Add or adjust focused tests when behavior changes. Do not claim a browser flow
was tested unless it was actually exercised in a browser.

## Release Notes

GitHub Actions uses Node.js 20. CI runs tests, builds both variants, and uploads
ZIP artifacts. Tags matching `v*` trigger the release workflow, which creates a
GitHub release and publishes the Chromium package to Chrome Web Store and the
Firefox distribution to AMO.

Use SemVer scripts only when a release bump is requested:

```bash
npm run version:patch
npm run version:minor
npm run version:major
```

## Common Mistakes to Avoid

- Do not describe Firefox as Manifest V3 while `src/manifest.firefox.json`
  remains Manifest V2.
- Do not add CDN scripts or remote executable code; store review scans bundled
  code, including unused dependency branches.
- Do not edit generated `dist/` files to fix a store rejection.
- Do not introduce raw `chrome.*` or `browser.*` calls for new features when the
  shared API helper should own the compatibility logic.
- Do not weaken DOM cleanup or XML escaping without focused tests.
