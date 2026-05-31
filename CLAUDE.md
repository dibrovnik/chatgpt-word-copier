# CLAUDE.md

Read `AGENTS.md` before modifying this repository. It is the authoritative
project guide and contains the architecture map, browser compatibility rules,
verification matrix, and release constraints.

## Project Summary

**ChatGPT -> Word Copier** is a vanilla JavaScript browser extension that copies
ChatGPT responses into Microsoft Word while preserving formatting, tables, code
blocks, and equations. It also exports DOCX and PDF files and stores reusable
prompts.

The source lives under `src/`. Browser entrypoints are bundled with `esbuild`.
Generated `dist/`, `dist-firefox/`, and ZIP files are ignored artifacts; do not
edit them manually.

## Critical Rules

1. Chrome, Edge, and Brave use `src/manifest.json`, which is **Manifest V3**.
2. Firefox uses `src/manifest.firefox.json`, which is currently **Manifest V2**.
3. Keep browser-specific manifest keys separate. Do not migrate manifest
   versions as part of unrelated work.
4. Chrome MV3 packages must not contain remote executable code.
5. Direct PDF export uses locally bundled `pdfmake` and `html-to-pdfmake`.
   Keep external resource downloads disabled and the MV3 build transform
   enabled in that path.
6. Use `src/lib/browser-api.js` for new extension API access so Chromium callback
   APIs and Firefox Promise APIs remain compatible.
7. Treat ChatGPT DOM selectors as unstable external dependencies. Update DOM
   extraction tests with selector-related changes.
8. Treat generated DOCX XML carefully: escape text and add focused archive/XML
   tests when changing the builder.
9. The canonical version is `package.json#version`; `scripts/version.mjs`
   synchronizes both manifests.
10. Do not bump versions unless the task explicitly requires a release.

## Main Areas

- `src/content/`: ChatGPT page integration and injected action buttons.
- `src/popup/`: popup UI, settings, and saved prompts.
- `src/background/`: installation defaults and download handling.
- `src/lib/dom-extractor.js`: response DOM parsing.
- `src/lib/clipboard-helper.js`: rich clipboard output.
- `src/lib/docx-builder.js`: DOCX ZIP and XML generation.
- `src/lib/mathml-to-omml.js`: Word equation conversion.
- `src/lib/pdf-generator.js`: print view and direct PDF download.
- `src/lib/pdf-document.js`: text-based direct PDF document conversion.
- `scripts/`: build, packaging, versioning, icons, and MV3 compliance tooling.
- `tests/`: Vitest and jsdom tests.

## Required Checks

For normal changes:

```bash
npm test
npm run build:all
git diff --check
```

For dependency, PDF, build, manifest, packaging, or release changes:

```bash
npm test
npm run package:all
git diff --check
rg -n "createElement\\(['\\\"]script|importScripts\\(|eval\\(|new\\s+Function|Function\\s*\\(\\s*['\\\"]" dist dist-firefox
```

Review any final scan matches in context. See `AGENTS.md` for the full
verification guidance.
