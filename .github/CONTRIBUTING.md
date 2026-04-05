# Contributing to ChatGPT → Word Copier

We love your input! We want to make contributing to this project as easy and transparent as possible, whether it's:

- Reporting a bug
- Discussing the current state of the code
- Submitting a fix
- Proposing new features
- Becoming a maintainer

## We Develop with GitHub

We use GitHub to host code, to track issues and feature requests, as well as accept pull requests.

## How to Contributing

### Report bugs using GitHub's issues

We use GitHub issues to track public bugs. Report a bug by opening a new issue; it's that easy!

### Write bug reports with detail, background, and sample code

Please use the provided issue templates. Great Bug Reports tend to have:
- A quick summary and/or background
- Steps to reproduce
- What you expected would happen
- What actually happens
- Notes (possibly including why you think this might be happening, or stuff you tried that didn't work)

### Submitting a Pull Request (PR)

1. Fork the repo and create your branch from `main`.
2. Make your changes in a new git branch.
3. If you've changed APIs, update the documentation.
4. Ensure the test suite passes (`npm test`).
5. Make sure your code lints.
6. Open a Pull Request.

---

## 🚀 Setting up Development Environment

1. **Clone the repository:**
   ```bash
   git clone https://github.com/dibrovnik/chatgpt-word-copier.git
   cd chatgpt-word-copier
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Generate icons:**
   ```bash
   npm run icons
   ```

4. **Build the extension:**
   ```bash
   # Chrome / Edge / Brave
   npm run build

   # Firefox
   npm run build:firefox
   ```

5. **Start watch mode (rebuilds on changes):**
   ```bash
   npm run watch         # for Chrome
   npm run watch:firefox # for Firefox
   ```

## ✅ Testing

Tests are written using [Vitest](https://vitest.dev/) + jsdom.

```bash
# Run tests once
npm test

# Run tests in watch mode
npm run test:watch
```

Current test coverage includes:
- Cross-browser API layer (Chrome ↔ Firefox)
- MathML → OMML conversion
- DOCX Generation (ZIP structure, numbering, styles)
- Content extraction from ChatGPT DOM

## 🏷️ Versioning & Release

We use [SemVer](https://semver.org/). Running npm version scripts automatically creates a commit and git tag.

```bash
npm run version:patch  # 1.0.0 → 1.0.1
npm run version:minor  # 1.0.0 → 1.1.0
npm run version:major  # 1.0.0 → 2.0.0
```

After bumping the version:
```bash
git push && git push --tags
```
Our GitHub Actions CI/CD pipelines will automatically build the ZIP artifacts, create a GitHub Release, and publish them to chrome and firefox web stores.

## 📄 License

By contributing, you agree that your contributions will be licensed under its MIT License.
