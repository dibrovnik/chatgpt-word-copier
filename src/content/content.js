/**
 * Content Script - runs on ChatGPT pages.
 * Adds copy/export buttons to each assistant message.
 * Handles message extraction and clipboard operations.
 */

import { copyForWord, copyMessageForWord } from '../lib/clipboard-helper';
import {
  getAssistantMessages,
  getLastAssistantMessage,
  extractContent,
  getMarkdownContent,
} from '../lib/dom-extractor';
import { buildDocx } from '../lib/docx-builder';
import { generatePdfViaPrint } from '../lib/pdf-generator';
import { storageGet, onMessage } from '../lib/browser-api';

// Settings
let settings = {
  showButtons: true,
  mathMode: 'omml',
  darkThemeDocx: false,
};

// Load settings
storageGet(['showButtons', 'mathMode', 'darkThemeDocx']).then((result) => {
  if (result) {
    settings = { ...settings, ...result };
    if (settings.showButtons) {
      injectButtons();
    }
  }
}).catch(() => {
  // Storage not available
});

// ===== Message Listener =====
onMessage((message, sender, sendResponse) => {
  handleMessage(message).then(sendResponse);
  return true; // Keep channel open for async response
});

async function handleMessage(message) {
  switch (message.type) {
    case 'copyForWord':
      return await copyForWord();

    case 'exportDocx':
      return await handleExportDocx(message.settings || settings);

    case 'exportPdf':
      return await handleExportPdf();

    case 'settingsChanged':
      settings = { ...settings, ...message.settings };
      if (settings.showButtons) {
        injectButtons();
      } else {
        removeButtons();
      }
      return { success: true };

    default:
      return { success: false, error: 'Unknown message type' };
  }
}

// ===== Export Handlers =====

async function handleExportDocx(exportSettings) {
  try {
    const lastMessage = getLastAssistantMessage();
    if (!lastMessage) {
      return { success: false, error: 'Нет ответов ChatGPT на странице' };
    }

    const blocks = extractContent(lastMessage);
    if (blocks.length === 0) {
      return { success: false, error: 'Пустой ответ' };
    }

    const blob = await buildDocx(blocks, {
      title: 'ChatGPT Response',
      mathMode: exportSettings.mathMode || 'omml',
    });

    // Download
    downloadBlob(blob, `chatgpt-response-${getTimestamp()}.docx`);
    return { success: true };
  } catch (e) {
    console.error('DOCX export error:', e);
    return { success: false, error: e.message };
  }
}

async function handleExportPdf() {
  try {
    const lastMessage = getLastAssistantMessage();
    if (!lastMessage) {
      return { success: false, error: 'Нет ответов ChatGPT на странице' };
    }

    // Use print-based PDF generation
    generatePdfViaPrint(lastMessage);
    return { success: true };
  } catch (e) {
    console.error('PDF export error:', e);
    return { success: false, error: e.message };
  }
}

// ===== Button Injection =====

const BUTTON_CONTAINER_CLASS = 'cgpt-word-copier-buttons';
const PROCESSED_ATTR = 'data-word-copier-processed';

function injectButtons() {
  // Process existing messages
  processMessages();

  // Watch for new messages
  startObserver();
}

function removeButtons() {
  const buttons = document.querySelectorAll(`.${BUTTON_CONTAINER_CLASS}`);
  buttons.forEach(el => el.remove());

  const processed = document.querySelectorAll(`[${PROCESSED_ATTR}]`);
  processed.forEach(el => el.removeAttribute(PROCESSED_ATTR));
}

function processMessages() {
  const messages = getAssistantMessages();
  for (const msg of messages) {
    if (msg.hasAttribute(PROCESSED_ATTR)) continue;
    msg.setAttribute(PROCESSED_ATTR, 'true');
    addButtonsToMessage(msg);
  }
}

function addButtonsToMessage(messageEl) {
  // Find where to insert buttons - at the top of the message
  const contentEl = getMarkdownContent(messageEl);
  if (!contentEl) return;

  // Create button container
  const container = document.createElement('div');
  container.className = BUTTON_CONTAINER_CLASS;

  // Copy button
  const copyBtn = createActionButton(
    'Копировать для Word',
    copyIcon(),
    async () => {
      copyBtn.classList.add('loading');
      try {
        const result = await copyMessageForWord(messageEl);
        if (result.success) {
          showToast('✓ Скопировано для Word!', 'success');
        } else {
          showToast(result.error || 'Ошибка копирования', 'error');
        }
      } catch (e) {
        showToast('Ошибка: ' + e.message, 'error');
      } finally {
        copyBtn.classList.remove('loading');
      }
    }
  );

  // DOCX button
  const docxBtn = createActionButton(
    'DOCX',
    docxIcon(),
    async () => {
      docxBtn.classList.add('loading');
      try {
        const blocks = extractContent(messageEl);
        if (blocks.length === 0) {
          showToast('Пустой ответ', 'error');
          return;
        }
        const blob = await buildDocx(blocks, {
          title: 'ChatGPT Response',
          mathMode: settings.mathMode,
        });
        downloadBlob(blob, `chatgpt-response-${getTimestamp()}.docx`);
        showToast('✓ DOCX скачан!', 'success');
      } catch (e) {
        showToast('Ошибка: ' + e.message, 'error');
      } finally {
        docxBtn.classList.remove('loading');
      }
    }
  );

  // PDF button
  const pdfBtn = createActionButton(
    'PDF',
    pdfIcon(),
    async () => {
      pdfBtn.classList.add('loading');
      try {
        generatePdfViaPrint(messageEl);
        showToast('✓ PDF готов к печати', 'success');
      } catch (e) {
        showToast('Ошибка: ' + e.message, 'error');
      } finally {
        pdfBtn.classList.remove('loading');
      }
    }
  );

  container.appendChild(copyBtn);
  container.appendChild(docxBtn);
  container.appendChild(pdfBtn);

  // Insert at the top of the message, or find a good parent
  const target = contentEl.parentElement || contentEl;
  if (contentEl === messageEl) {
    messageEl.insertBefore(container, messageEl.firstChild);
  } else {
    target.insertBefore(container, contentEl);
  }
}

function createActionButton(text, iconSvg, onClick) {
  const btn = document.createElement('button');
  btn.className = 'cgpt-wc-btn';
  btn.title = text;
  btn.innerHTML = `${iconSvg}<span>${text}</span>`;
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    onClick();
  });
  return btn;
}

// ===== Icons =====

function copyIcon() {
  return `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="5" y="1" width="9" height="12" rx="1" stroke="currentColor" stroke-width="1.5"/>
    <rect x="2" y="3" width="9" height="12" rx="1" fill="white" stroke="currentColor" stroke-width="1.5"/>
  </svg>`;
}

function docxIcon() {
  return `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 1h7l4 4v10H3V1z" stroke="currentColor" stroke-width="1.5"/>
    <path d="M8 8v4M6.5 10.5L8 12l1.5-1.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

function pdfIcon() {
  return `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 1h7l4 4v10H3V1z" stroke="currentColor" stroke-width="1.5"/>
    <text x="4.5" y="12" font-size="5.5" fill="currentColor" font-weight="bold" font-family="sans-serif">PDF</text>
  </svg>`;
}

// ===== MutationObserver =====

let observer = null;

function startObserver() {
  if (observer) return;

  observer = new MutationObserver((mutations) => {
    let shouldProcess = false;
    for (const mutation of mutations) {
      if (mutation.addedNodes.length > 0) {
        shouldProcess = true;
        break;
      }
    }
    if (shouldProcess) {
      // Debounce
      clearTimeout(startObserver._timeout);
      startObserver._timeout = setTimeout(processMessages, 500);
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

// ===== Utility Functions =====

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();

  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 1000);
}

function getTimestamp() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
}

function showToast(message, type = 'success') {
  // Remove existing toast
  const existing = document.querySelector('.cgpt-wc-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `cgpt-wc-toast cgpt-wc-toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  // Animate in
  requestAnimationFrame(() => {
    toast.classList.add('visible');
  });

  // Remove after 3 seconds
  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ===== Initial Setup =====
if (settings.showButtons) {
  // Wait for page to load, then inject
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(injectButtons, 1000);
    });
  } else {
    setTimeout(injectButtons, 1000);
  }
}

console.log('[ChatGPT→Word Copier] Content script loaded');
