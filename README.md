# ChatGPT → Word Copier

Кроссбраузерное расширение (Chrome, Edge, Firefox, Brave и другие), которое позволяет копировать ответы ChatGPT **с формулами, таблицами и форматированием** для вставки в Microsoft Word.

[![CI — Build & Test](https://github.com/dibrovnik/chatgpt-word-copier/actions/workflows/ci.yml/badge.svg)](https://github.com/dibrovnik/chatgpt-word-copier/actions/workflows/ci.yml)
[![Release](https://github.com/dibrovnik/chatgpt-word-copier/actions/workflows/release.yml/badge.svg)](https://github.com/dibrovnik/chatgpt-word-copier/actions/workflows/release.yml)
[![GitHub Release](https://img.shields.io/github/v/release/dibrovnik/chatgpt-word-copier?label=release&logo=github)](https://github.com/dibrovnik/chatgpt-word-copier/releases/latest)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen?logo=node.js)](https://nodejs.org/)
[![Chrome Web Store](https://img.shields.io/badge/platform-Chrome%20%7C%20Edge%20%7C%20Firefox%20%7C%20Brave-4285F4?logo=googlechrome&logoColor=white)](#-совместимость)
[![Manifest V3](https://img.shields.io/badge/manifest-v3-orange?logo=googlechrome)](src/manifest.json)
[![Firefox](https://img.shields.io/badge/Firefox-109%2B-FF7139?logo=firefox-browser&logoColor=white)](src/manifest.firefox.json)
[![Made with esbuild](https://img.shields.io/badge/built%20with-esbuild-FFCF00?logo=esbuild)](https://esbuild.github.io/)

---

## 📥 Быстрая установка из GitHub

> Самый простой способ — скачать готовый архив прямо из GitHub.

### Вариант A: Из релиза — Chrome / Edge / Brave (стабильная версия)

1. Перейдите на страницу **[Releases](../../releases/latest)**
2. Скачайте файл `chatgpt-word-copier-vX.Y.Z.zip` (Chrome-сборка)
3. Распакуйте архив в любое удобное место
4. Откройте в браузере `chrome://extensions/` (или `edge://extensions/`)
5. Включите **Режим разработчика** (переключатель в правом верхнем углу)
6. Нажмите **Загрузить распакованное расширение** (Load unpacked)
7. Выберите папку, в которую распаковали архив
8. Готово! Перейдите на [chat.openai.com](https://chat.openai.com) — при наведении на ответ ChatGPT появятся кнопки копирования

### Вариант A-2: Из релиза — Firefox

1. Перейдите на страницу **[Releases](../../releases/latest)**
2. Скачайте файл `chatgpt-word-copier-firefox-vX.Y.Z.zip`
3. Откройте в Firefox `about:debugging#/runtime/this-firefox`
4. Нажмите **Загрузить временное дополнение** (Load Temporary Add-on)
5. Выберите файл `manifest.json` из распакованного архива
6. Готово! Перейдите на [chat.openai.com](https://chat.openai.com)

> **Примечание:** временные дополнения Firefox удаляются при перезапуске браузера. Для постоянной установки используйте подписанный `.xpi` файл или `about:config` → `xpinstall.signatures.required` = `false`.

### Вариант B: Из артефакта CI (последняя dev-сборка)

1. Перейдите в раздел **[Actions](../../actions)** репозитория
2. Откройте последний успешный запуск **CI — Build & Test**
3. Внизу страницы, в секции **Artifacts**, скачайте `chatgpt-word-copier-vX.Y.Z` (Chrome) или `chatgpt-word-copier-firefox-vX.Y.Z` (Firefox)
4. Распакуйте скачанный ZIP (внутри будет ещё один `.zip` — распакуйте и его)
5. Далее действия как в Варианте A (Chrome) или A-2 (Firefox)

> **Примечание:** для скачивания артефактов из Actions нужен аккаунт GitHub.

### Обновление расширения

При выходе новой версии:

1. Скачайте новый архив
2. Распакуйте поверх старой папки (или в новую)
3. Chrome: на странице `chrome://extensions/` нажмите кнопку 🔄 (Обновить) на карточке расширения
4. Firefox: перезагрузите временное дополнение в `about:debugging`

---

## ✨ Возможности

- **📋 Копирование для Word** — копирует ответ ChatGPT с формулами (MathML), которые Word преобразует в нативные уравнения
- **📄 Экспорт в DOCX** — создаёт полноценный .docx файл с форматированием и формулами (OMML)
- **📑 Экспорт в PDF** — генерирует PDF для печати или отправки
- **🔢 Формулы** — LaTeX/KaTeX формулы конвертируются в формат, понятный Word
- **📊 Таблицы** — таблицы сохраняют структуру и форматирование
- **💻 Код** — блоки кода сохраняются с моноширинным шрифтом
- **🌙 Тёмная тема** — поддержка тёмной темы ChatGPT

## 🚀 Установка из исходного кода

1. **Клонируйте репозиторий:**

   ```bash
   git clone https://github.com/dibrovnik/chatgpt-word-copier.git
   cd chatgpt-word-copier
   ```
2. **Установите зависимости:**

   ```bash
   npm install
   ```
3. **Сгенерируйте иконки:**

   ```bash
   npm run icons
   ```
4. **Соберите расширение:**

   ```bash
   # Chrome / Edge / Brave
   npm run build

   # Firefox
   npm run build:firefox

   # Оба сразу
   npm run build:all
   ```
5. **Загрузите в браузер:**

   **Chrome / Edge / Brave:**
   - Откройте `chrome://extensions/` (или `edge://extensions/`)
   - Включите **Режим разработчика** (Developer mode)
   - Нажмите **Загрузить распакованное** (Load unpacked)
   - Выберите папку `dist/`

   **Firefox:**
   - Откройте `about:debugging#/runtime/this-firefox`
   - Нажмите **Загрузить временное дополнение**
   - Выберите файл `dist-firefox/manifest.json`

### Для разработки

```bash
# Chrome
npm run watch

# Firefox
npm run watch:firefox
```

Это запустит сборку в режиме наблюдения — файлы будут пересобираться при изменениях.

## 📖 Использование

### Кнопки на странице ChatGPT

При наведении на ответ ChatGPT появляются кнопки:

- **Копировать для Word** — копирует в буфер обмена с MathML формулами
- **DOCX** — скачивает ответ как .docx файл
- **PDF** — открывает диалог печати для сохранения как PDF

### Popup расширения

Нажмите на иконку расширения для:

- Копирования последнего ответа
- Скачивания в DOCX/PDF
- Настроек (формат формул, показ кнопок)

## 🔧 Как работает конвертация формул

### Копирование в буфер обмена

1. ChatGPT рендерит формулы через KaTeX
2. KaTeX генерирует MathML внутри элементов `.katex-mathml`
3. Расширение извлекает MathML и вставляет его в HTML для буфера обмена
4. Word автоматически преобразует MathML в нативные уравнения

### Экспорт в DOCX

1. HTML-контент парсится в структурированные блоки
2. MathML конвертируется в OMML (Office Math Markup Language)
3. Создаётся полноценный .docx файл (OOXML формат) через JSZip
4. Формулы отображаются как нативные уравнения Word

## ⚙️ Настройки

| Настройка                | Описание                                                                                     |
| --------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Формат формул в DOCX | `OMML` (редактируемые) или `Изображения` (совместимость) |
| Показывать кнопки | Показ/скрытие кнопок на странице ChatGPT                                 |
| Тёмная тема в DOCX     | Тёмный фон в экспортированных документах                         |

## 📁 Структура проекта

```
chatgpt-word-copier/
├── package.json
├── scripts/
│   ├── build.mjs            # Скрипт сборки (esbuild, --firefox)
│   ├── package.mjs          # Упаковка в ZIP (кроссплатформенная, JSZip)
│   ├── version.mjs          # Синхронизация версий (оба манифеста)
│   └── generate-icons.mjs   # Генерация иконок
├── src/
│   ├── manifest.json         # Manifest V3 (Chrome/Edge/Brave)
│   ├── manifest.firefox.json # Manifest V2 (Firefox)
│   ├── popup/
│   │   ├── popup.html        # UI popup
│   │   ├── popup.css         # Стили popup
│   │   └── popup.js          # Логика popup
│   ├── content/
│   │   ├── content.js        # Content script
│   │   └── content.css       # Стили кнопок
│   ├── background/
│   │   └── background.js     # Service worker / background script
│   ├── lib/
│   │   ├── browser-api.js       # Кросс-браузерный API (Chrome ↔ Firefox)
│   │   ├── dom-extractor.js     # Извлечение контента из DOM
│   │   ├── clipboard-helper.js  # Копирование с MathML
│   │   ├── mathml-to-omml.js    # MathML → OMML конвертер
│   │   ├── docx-builder.js      # Генерация .docx файлов
│   │   └── pdf-generator.js     # Генерация PDF
│   └── icons/
├── tests/                     # Юнит-тесты (Vitest)
├── dist/                      # Сборка Chrome
└── dist-firefox/              # Сборка Firefox
```

## 🛠️ Технологии

- **Chrome Extension Manifest V3** (Chrome/Edge/Brave) + **Manifest V2** (Firefox)
- **esbuild** — сборка и бандлинг
- **JSZip** — создание .docx (ZIP) файлов
- **Print API браузера** — экспорт в PDF через диалог печати
- **Vanilla JS** — без фреймворков
- **Кросс-браузерный слой** — `browser-api.js` нормализует `chrome.*` / `browser.*` API

## 📝 Совместимость

| Браузер | Версия | Manifest |
|---------|--------|----------|
| Google Chrome | 110+ | V3 |
| Microsoft Edge | 110+ | V3 |
| Mozilla Firefox | 109+ | V2 |
| Brave Browser | 110+ | V3 |
| Opera | 96+ | V3 |
| Другие Chromium | 110+ | V3 |

## 🐛 Известные ограничения

- Некоторые сложные LaTeX-конструкции могут не конвертироваться идеально в OMML
- Для наилучшего качества формул рекомендуется использовать функцию "Копировать для Word"
- PDF-экспорт использует встроенный диалог печати браузера
- Firefox: временные дополнения удаляются при перезапуске (для постоянной установки нужен подписанный `.xpi`)

## 📦 Упаковка в ZIP

```bash
# Chrome / Edge / Brave
npm run package

# Firefox
npm run package:firefox

# Оба сразу
npm run package:all
```

Результат — готовые архивы `chatgpt-word-copier.zip` и `chatgpt-word-copier-firefox.zip` в корне проекта. Упаковка кроссплатформенная (Windows, macOS, Linux) — использует JSZip вместо системных утилит.

## 🏷️ Версионирование

Проект использует [SemVer](https://semver.org/). Версия хранится в `package.json` и автоматически синхронизируется в `src/manifest.json` и `src/manifest.firefox.json` при сборке.

```bash
# Patch-версия: 1.0.0 → 1.0.1
npm run version:patch

# Minor-версия: 1.0.0 → 1.1.0
npm run version:minor

# Major-версия: 1.0.0 → 2.0.0
npm run version:major
```

После `npm version` автоматически создаётся git-коммит и тег. Чтобы опубликовать релиз:

```bash
git push && git push --tags
```

Пуш тега вида `v*` запускает GitHub Actions workflow, который собирает расширение и публикует его как GitHub Release с прикреплённым ZIP-архивом.

## ✅ Тестирование

```bash
# Запуск тестов
npm test

# Запуск в watch-режиме
npm run test:watch
```

Тесты написаны с использованием [Vitest](https://vitest.dev/) + jsdom и покрывают:

- Кросс-браузерный API-слой (Chrome ↔ Firefox)
- Конвертацию MathML → OMML
- Генерацию DOCX (структура ZIP, numbering.xml, стили)
- Извлечение контента из DOM ChatGPT

## 🔄 CI/CD

| Workflow                     | Триггер                            | Результат                                       |
| ---------------------------- | ----------------------------------------- | -------------------------------------------------------- |
| **CI — Build & Test** | Push в любую ветку, PR в main | Тесты + артефакты `.zip` (Chrome + Firefox) |
| **Release**            | Push тега `v*`                      | GitHub Release с архивами (Chrome + Firefox)    |

## 📄 Лицензия

MIT
