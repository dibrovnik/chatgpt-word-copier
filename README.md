# ChatGPT → Word Copier

<div align="left">
  <h3>Copy ChatGPT responses with formatting, math formulas, and tables straight into Microsoft Word!</h3>
  <br>
  ⭐️ <strong>If you find this extension helpful, please give it a ⭐️ on GitHub! It helps others find the project.</strong> ⭐️
</div>

<p align="left">
  <a href="https://github.com/dibrovnik/chatgpt-word-copier/actions/workflows/ci.yml"><img src="https://github.com/dibrovnik/chatgpt-word-copier/actions/workflows/ci.yml/badge.svg" alt="CI — Build & Test"></a>
  <a href="https://github.com/dibrovnik/chatgpt-word-copier/actions/workflows/release.yml"><img src="https://github.com/dibrovnik/chatgpt-word-copier/actions/workflows/release.yml/badge.svg" alt="Release"></a>
  <a href="https://github.com/dibrovnik/chatgpt-word-copier/releases/latest"><img src="https://img.shields.io/github/v/release/dibrovnik/chatgpt-word-copier?label=release&logo=github" alt="GitHub Release"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT"></a>
  <br>
  <a href="https://chromewebstore.google.com/detail/chatgpt-%E2%86%92-word-copier/jebfnecffngjbiapaholakanfcoeajfo"><img src="https://img.shields.io/chrome-web-store/v/jebfnecffngjbiapaholakanfcoeajfo?label=Chrome%20Web%20Store&logo=googlechrome&color=blue&logoColor=white" alt="Chrome Web Store"></a>
  <a href="https://addons.mozilla.org/ru/firefox/addon/chatgpt-word-copier/"><img src="https://img.shields.io/amo/v/chatgpt-word-copier?label=Firefox%20Add-ons&logo=firefox&color=FF7139&logoColor=white" alt="Firefox Add-ons"></a>
</p>

## 📥 Download / Скачать

| Browser                         | Link                                                                                                                                  |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Chrome / Edge / Brave** | [Install from Chrome Web Store](https://chromewebstore.google.com/detail/chatgpt-%E2%86%92-word-copier/jebfnecffngjbiapaholakanfcoeajfo) |
| **Firefox**               | [Install from Firefox Add-ons](https://addons.mozilla.org/ru/firefox/addon/chatgpt-word-copier/)                                         |
| **Manual Install**        | [Download latest ZIP from GitHub](https://github.com/dibrovnik/chatgpt-word-copier/releases/latest)                                      |

---

## 🇺🇸 About This Extension (English)

**ChatGPT → Word Copier** is a cross-browser extension (for Chrome, Edge, Firefox, Brave) that allows you to seamlessly copy ChatGPT responses and paste them into Microsoft Word without losing the original **tables, code blocks, formatting, and most importantly — math equations (LaTeX/KaTeX to OMML/MathML)**.

### ✨ Key Features

- **📋 Copy for Word** — Copies the ChatGPT response directly to your clipboard with math equations natively compatible with MS Word.
- **📄 Export to DOCX** — Download any ChatGPT response instantly as a fully formatted `.docx` file.
- **📑 Export to PDF** — Opens a clean print-ready view to save the response directly to PDF.
- **🔢 Native Math Formulas** — Accurately converts complex LaTeX/KaTeX equations into native Microsoft Word formats.
- **📊 Keep Tables Intact** — Maintains the structure and formatting of all tables.
- **💻 Clean Code Blocks** — Keeps your source code nicely formatted with a monospaced font.
- **🌙 Dark Mode Support** — Seamlessly matches the active ChatGPT theme.

---

## 🇷🇺 О расширении (Русский)

**ChatGPT → Word Copier** — это кроссбраузерное расширение (Chrome, Edge, Firefox, Brave), которое позволяет копировать ответы ChatGPT **сохраняя формулы, таблицы и форматирование** для идеальной вставки в Microsoft Word.

### ✨ Ключевые возможности

- **📋 Копирование для Word** — копирует ответ ChatGPT вместе с формулами (MathML), которые Word сразу преобразует в нативные математические уравнения.
- **📄 Экспорт в DOCX** — создаёт полноценный .docx файл в один клик.
- **📑 Экспорт в PDF** — позволяет мгновенно распечатать или сохранить ответ в PDF.
- **🔢 Формулы** — сложная математика LaTeX/KaTeX конвертируется в формат, понятный MS Word.
- **📊 Таблицы** — таблицы полностью сохраняют свою структуру.
- **💻 Код** — блоки с кодом копируются вместе с удобным для чтения моноширинным шрифтом.

---

## 📥 How to Install / Как установить

### Install from Web Store (Recommended)

- **Chrome / Edge / Brave**: [Install from the Chrome Web Store](https://chromewebstore.google.com/detail/chatgpt-%E2%86%92-word-copier/jebfnecffngjbiapaholakanfcoeajfo)
- **Firefox**: [Install from Firefox Add-ons](https://addons.mozilla.org/ru/firefox/addon/chatgpt-word-copier/)

### Manual Installation (from GitHub Releases)

> **Tip:** You can download the latest official version directly from the **[Releases](https://github.com/dibrovnik/chatgpt-word-copier/releases/latest)** tab!

#### For Chrome / Edge / Brave

1. Go to the **[Releases](../../releases/latest)** page.
2. Download the `chatgpt-word-copier-vX.Y.Z.zip` file.
3. Unzip the downloaded file to any folder on your computer.
4. Open your browser and go to `chrome://extensions/` (or `edge://extensions/`).
5. Turn on **Developer mode** (top right corner).
6. Click **Load unpacked** and select the folder you just extracted.
7. You are all set! Open [chat.openai.com](https://chat.openai.com) and test it out.

### For Firefox

1. Go to the **[Releases](../../releases/latest)** page.
2. Download the `chatgpt-word-copier-firefox-vX.Y.Z.zip` file.
3. Open Firefox and go to `about:debugging#/runtime/this-firefox`.
4. Click **Load Temporary Add-on**.
5. Select the `manifest.json` inside the unzipped folder.

---

## 📖 Usage / Использование

Once installed, just hover over any response in ChatGPT. You will see new action buttons below the text:

- **Copy for Word** (Копировать для Word)
- **DOCX**
- **PDF**

You can also click on the extension's **Popup Icon** in your browser's top menu bar to export the very last generated response instantly!

---

## 🤝 Contributing / Разработчикам

If you want to build this extension from source, run tests, or contribute directly, please read our **[Contributing Guidelines](.github/CONTRIBUTING.md)**.

Make sure you also check out our [Code of Conduct](.github/CODE_OF_CONDUCT.md) and [Security Policy](.github/SECURITY.md).

---

<details>
<summary><b>🔍 SEO Keywords (Ignore)</b></summary>
<p>
ChatGPT to Word, ChatGPT Word Copier, Copy ChatGPT with format, ChatGPT Math to Word, ChatGPT LaTeX to Word, ChatGPT Tables to Word, export ChatGPT response to docx, download ChatGPT as pdf, save ChatGPT conversation, ChatGPT extension for MS Word, ChatGPT equations Word, Chrome extension ChatGPT Word, Firefox ChatGPT Word plugin, paste chatgpt inside word.
</p>
</details>

## 📄 License

This project is licensed under the [MIT License](LICENSE).
