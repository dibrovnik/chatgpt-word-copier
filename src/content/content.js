/**
 * Content Script - runs on ChatGPT pages.
 * Adds copy/export buttons to each assistant message.
 * Handles message extraction and clipboard operations.
 */

import { copyForWord, copyMessageForWord } from '../lib/clipboard-helper';
import {
  getAssistantMessages,
  getLastAssistantMessage,
  getUserMessages,
  extractContent,
  getMarkdownContent,
} from '../lib/dom-extractor';
import { buildDocx } from '../lib/docx-builder';
import { generatePdfViaPrint } from '../lib/pdf-generator';
import { storageGet, storageSet, onMessage } from '../lib/browser-api';
import { getSystemLanguage, t } from '../lib/i18n';

// Settings
let settings = {
  showButtons: true,
  gptButtonsLimit: 0,
  mathMode: 'omml',
  darkThemeDocx: false,
  language: getSystemLanguage(),
};

// Load settings
storageGet(['showButtons', 'gptButtonsLimit', 'mathMode', 'darkThemeDocx', 'language']).then((result) => {
  if (result) {
    settings = { ...settings, ...result };
    settings.gptButtonsLimit = normalizeGptButtonsLimit(settings.gptButtonsLimit);
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

function tr(key) {
  return t(settings.language, key);
}

async function handleMessage(message) {
  switch (message.type) {
    case 'copyForWord':
      return await copyForWord();

    case 'exportDocx':
      return await handleExportDocx(message.settings || settings);

    case 'exportPdf':
      return await handleExportPdf();

    case 'settingsChanged':
      {
      const previousLanguage = settings.language;
      settings = { ...settings, ...message.settings };
      settings.gptButtonsLimit = normalizeGptButtonsLimit(settings.gptButtonsLimit);
      if (settings.showButtons) {
        if (previousLanguage !== settings.language) {
          removeButtons();
        }
        injectButtons();
      } else {
        removeButtons();
      }
      return { success: true };
      }

    default:
      return { success: false, error: tr('unknownMessageType') };
  }
}

// ===== Export Handlers =====

async function handleExportDocx(exportSettings) {
  try {
    const lastMessage = getLastAssistantMessage();
    if (!lastMessage) {
      return { success: false, error: tr('noResponsesOnPage') };
    }

    const blocks = extractContent(lastMessage);
    if (blocks.length === 0) {
      return { success: false, error: tr('emptyResponse') };
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
      return { success: false, error: tr('noResponsesOnPage') };
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
  
  // Inject prompt copy buttons for last 3 user messages
  syncPromptCopyButtons();

  // Watch for new messages
  startObserver();
}

function removeButtons() {
  const buttons = document.querySelectorAll(`.${BUTTON_CONTAINER_CLASS}`);
  buttons.forEach(el => el.remove());

  const processed = document.querySelectorAll(`[${PROCESSED_ATTR}]`);
  processed.forEach(el => el.removeAttribute(PROCESSED_ATTR));
  
  const promptProcessed = document.querySelectorAll('[data-prompt-copy-processed]');
  promptProcessed.forEach(el => el.removeAttribute('data-prompt-copy-processed'));
}

function processMessages() {
  const messages = getAssistantMessages();
  const limit = normalizeGptButtonsLimit(settings.gptButtonsLimit);
  const limitedMessages = limit > 0 ? new Set(messages.slice(-limit)) : null;

  for (const msg of messages) {
    const shouldRenderButtons = !limitedMessages || limitedMessages.has(msg);

    if (!shouldRenderButtons) {
      removeButtonsFromMessage(msg);
      msg.removeAttribute(PROCESSED_ATTR);
      continue;
    }

    if (msg.hasAttribute(PROCESSED_ATTR) && messageHasButtons(msg)) continue;

    msg.setAttribute(PROCESSED_ATTR, 'true');
    removeButtonsFromMessage(msg);
    addButtonsToMessage(msg);
  }
}

function normalizeGptButtonsLimit(value) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 0) return 0;
  return Math.min(parsed, 200);
}

function messageHasButtons(messageEl) {
  return Boolean(messageEl.querySelector(`.${BUTTON_CONTAINER_CLASS}`));
}

function removeButtonsFromMessage(messageEl) {
  const containers = messageEl.querySelectorAll(`.${BUTTON_CONTAINER_CLASS}`);
  containers.forEach((container) => container.remove());
}

function addButtonsToMessage(messageEl) {
  // Find where to insert buttons - at the top of the message
  const contentEl = getMarkdownContent(messageEl);
  if (!contentEl) return;

  if (messageEl.closest('details, summary') || contentEl.closest('details, summary')) {
    return;
  }
  
  // Create button container
  const container = document.createElement('div');
  container.className = BUTTON_CONTAINER_CLASS;

  // Copy button
  const copyBtn = createActionButton(
    tr('copyForWord'),
    copyIcon(),
    async () => {
      copyBtn.classList.add('loading');
      try {
        const result = await copyMessageForWord(messageEl);
        if (result.success) {
          showToast(tr('copiedForWord'), 'success');
        } else {
          showToast(result.error || tr('copyError'), 'error');
        }
      } catch (e) {
        showToast(`${tr('errorPrefix')}: ${e.message}`, 'error');
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
          showToast(tr('emptyResponse'), 'error');
          return;
        }
        const blob = await buildDocx(blocks, {
          title: 'ChatGPT Response',
          mathMode: settings.mathMode,
        });
        downloadBlob(blob, `chatgpt-response-${getTimestamp()}.docx`);
        showToast(tr('docxDownloadedShort'), 'success');
      } catch (e) {
        showToast(`${tr('errorPrefix')}: ${e.message}`, 'error');
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
        showToast(tr('pdfReadyToPrint'), 'success');
      } catch (e) {
        showToast(`${tr('errorPrefix')}: ${e.message}`, 'error');
      } finally {
        pdfBtn.classList.remove('loading');
      }
    }
  );

  container.appendChild(copyBtn);
  container.appendChild(docxBtn);
  container.appendChild(pdfBtn);

  // Insert buttons under the GPT response
  if (contentEl.nextSibling) {
    contentEl.parentNode.insertBefore(container, contentEl.nextSibling);
  } else {
    contentEl.parentNode.appendChild(container);
  }
}

function syncPromptCopyButtons() {
  const PROMPT_BUTTON_ATTR = 'data-prompt-copy-processed';
  const promptContainers = document.querySelectorAll('.cgpt-word-copier-prompt-buttons');
  promptContainers.forEach((container) => container.remove());

  const processedPrompts = document.querySelectorAll(`[${PROMPT_BUTTON_ATTR}]`);
  processedPrompts.forEach((el) => el.removeAttribute(PROMPT_BUTTON_ATTR));

  const userMessages = getUserMessages();
  const lastThreeMessages = userMessages.slice(-3);

  lastThreeMessages.forEach((msgEl) => {
    msgEl.setAttribute(PROMPT_BUTTON_ATTR, 'true');

    const promptBtn = createActionButton(
      tr('savePrompt'),
      promptIcon(),
      async () => {
        promptBtn.classList.add('loading');
        try {
          const promptText = extractUserPromptText(msgEl);
          if (!promptText) {
            showToast(tr('emptyMessage'), 'error');
            return;
          }

          const saveResult = await savePromptToStorage(promptText);
          if (saveResult === 'duplicate') {
            showToast(tr('promptAlreadySavedShort'), 'success');
          } else {
            showToast(tr('promptSaved'), 'success');
          }
        } catch (e) {
          showToast(`${tr('errorPrefix')}: ${e.message}`, 'error');
        } finally {
          promptBtn.classList.remove('loading');
        }
      },
      'cgpt-wc-btn-prompt'
    );

    const buttonContainer = document.createElement('div');
    buttonContainer.className = `${BUTTON_CONTAINER_CLASS} cgpt-word-copier-prompt-buttons cgpt-word-copier-prompt-buttons-floating`;
    buttonContainer.appendChild(promptBtn);

    msgEl.appendChild(buttonContainer);
  });
}

function extractUserPromptText(messageEl) {
  const cloned = messageEl.cloneNode(true);
  cloned
    .querySelectorAll('.cgpt-word-copier-buttons, .cgpt-word-copier-prompt-buttons')
    .forEach((el) => el.remove());

  const content = getUserMessageContent(cloned);
  const raw = (content?.innerText || content?.textContent || '').trim();
  return raw.replace(/\s+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

async function savePromptToStorage(promptText) {
  const result = await storageGet(['savedPrompts']);
  let savedPrompts = Array.isArray(result?.savedPrompts) ? result.savedPrompts : [];

  if (savedPrompts.includes(promptText)) {
    return 'duplicate';
  }

  savedPrompts.unshift(promptText);
  savedPrompts = savedPrompts.slice(0, 20);
  await storageSet({ savedPrompts });
  return 'saved';
}

function getUserMessageContent(messageEl) {
  const candidates = [
    messageEl.querySelector('.whitespace-pre-wrap'),
    messageEl.querySelector('[class*="whitespace-pre-wrap"]'),
    messageEl.querySelector('[class*="prose"]'),
    messageEl.querySelector('[dir="auto"]'),
    messageEl.querySelector('[class*="text"]'),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if ((candidate.textContent || '').trim().length > 0) {
      return candidate;
    }
  }

  return messageEl;
}

function createActionButton(text, iconSvg, onClick, extraClass = '') {
  const btn = document.createElement('button');
  btn.className = `cgpt-wc-btn ${extraClass}`.trim();
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

function promptIcon() {
  return `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M2 2h12l-1 4H3L2 2z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M3 6v8a1 1 0 001 1h8a1 1 0 001-1V6" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M6 9v3M10 9v3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`;
}

// ===== MutationObserver =====

let observer = null;

function startObserver() {
  if (observer) return;

  observer = new MutationObserver((mutations) => {
    const shouldProcess = mutations.some((mutation) =>
      hasRelevantAddedOrRemovedNode(mutation.addedNodes) || hasRelevantAddedOrRemovedNode(mutation.removedNodes)
    );

    if (shouldProcess) {
      // Debounce
      clearTimeout(startObserver._timeout);
      startObserver._timeout = setTimeout(() => {
        processMessages();
        syncPromptCopyButtons();
      }, 250);
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

function hasRelevantAddedOrRemovedNode(nodeList) {
  for (const node of nodeList) {
    if (nodeCouldAffectButtons(node)) {
      return true;
    }
  }
  return false;
}

function nodeCouldAffectButtons(node) {
  if (!node || node.nodeType !== Node.ELEMENT_NODE) {
    return false;
  }

  const selector = '[data-message-author-role="assistant"], [data-message-author-role="user"], [data-testid^="conversation-turn-"], .agent-turn, .markdown, [class*="markdown"]';
  const el = /** @type {Element} */ (node);
  return el.matches(selector) || Boolean(el.querySelector(selector));
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
