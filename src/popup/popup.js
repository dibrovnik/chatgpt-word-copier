/**
 * Popup script - handles UI interactions and communicates with content script.
 * Works in both Chrome and Firefox via browser-api helper.
 */

import { storageGet, storageSet, tabsQuery, tabsSendMessage } from '../lib/browser-api';
import { getSystemLanguage, normalizeLanguage, t } from '../lib/i18n';

// DOM elements
const btnCopy = document.getElementById('btnCopy');
const btnDocx = document.getElementById('btnDocx');
const btnPdf = document.getElementById('btnPdf');
const mathMode = document.getElementById('mathMode');
const showButtons = document.getElementById('showButtons');
const gptButtonsLimit = document.getElementById('gptButtonsLimit');
const darkThemeDocx = document.getElementById('darkThemeDocx');
const languageSelect = document.getElementById('languageSelect');
const statusEl = document.getElementById('status');
const statusText = document.getElementById('statusText');
const notification = document.getElementById('notification');
const versionEl = document.querySelector('.version');
const promptInput = document.getElementById('promptInput');
const btnSavePrompt = document.getElementById('btnSavePrompt');
const promptsList = document.getElementById('promptsList');

let currentLanguage = 'en';
let statusState = 'statusError';

function tr(key) {
  return t(currentLanguage, key);
}

function updateStatusText() {
  statusText.textContent = tr(statusState);
}

function applyLanguage(language) {
  currentLanguage = normalizeLanguage(language);
  document.documentElement.lang = currentLanguage;

  document.getElementById('actionsTitle').textContent = tr('actionsLastResponse');
  document.getElementById('settingsTitle').textContent = tr('settings');
  document.getElementById('languageLabel').textContent = `${tr('language')}:`;
  document.getElementById('languageOptionEn').textContent = tr('languageEnglish');
  document.getElementById('languageOptionRu').textContent = tr('languageRussian');
  document.getElementById('btnCopyLabel').textContent = tr('copyForWord');
  document.getElementById('btnDocxLabel').textContent = tr('downloadDocx');
  document.getElementById('btnPdfLabel').textContent = tr('downloadPdf');
  document.getElementById('mathModeLabel').textContent = tr('mathModeLabel');
  document.getElementById('mathModeOmml').textContent = tr('mathModeOmml');
  document.getElementById('mathModeImage').textContent = tr('mathModeImage');
  document.getElementById('showButtonsLabel').textContent = tr('showButtons');
  document.getElementById('gptButtonsLimitLabel').textContent = tr('gptButtonsLimitLabel');
  document.getElementById('darkThemeDocxLabel').textContent = tr('darkThemeDocx');
  document.getElementById('savedPromptsTitle').textContent = tr('savedPrompts');
  document.getElementById('tipTitle').textContent = tr('tipTitle');
  document.getElementById('tipText').textContent = tr('tipText');
  promptInput.placeholder = tr('promptPlaceholder');

  btnCopy.title = tr('copyForWordTitle');
  btnDocx.title = tr('downloadDocxTitle');
  btnPdf.title = tr('downloadPdfTitle');
  btnSavePrompt.title = tr('savePromptTitle');
  updateStatusText();
}

// Load and display version from manifest
try {
  const manifest = chrome.runtime.getManifest();
  if (versionEl) {
    versionEl.textContent = `v${manifest.version}`;
  }
} catch (e) {
  // Fallback if getManifest fails
  console.warn('Could not load version from manifest:', e);
}

// Load saved settings
storageGet(['language', 'mathMode', 'showButtons', 'gptButtonsLimit', 'darkThemeDocx']).then((result) => {
  const detectedLanguage = normalizeLanguage(result.language || getSystemLanguage());
  if (languageSelect) {
    languageSelect.value = detectedLanguage;
  }
  applyLanguage(detectedLanguage);

  if (result.mathMode) mathMode.value = result.mathMode;
  if (result.showButtons !== undefined) showButtons.checked = result.showButtons;
  if (gptButtonsLimit) gptButtonsLimit.value = String(normalizeGptButtonsLimit(result.gptButtonsLimit));
  if (result.darkThemeDocx !== undefined) darkThemeDocx.checked = result.darkThemeDocx;
  renderPrompts();
  checkStatus();
}).catch(() => {});

if (languageSelect) {
  languageSelect.addEventListener('change', () => {
    const selectedLanguage = normalizeLanguage(languageSelect.value);
    applyLanguage(selectedLanguage);
    storageSet({ language: selectedLanguage });
    renderPrompts();
    checkStatus();
    sendToContent({ type: 'settingsChanged', settings: getSettings() }).catch(() => {});
  });
}

// Save settings on change
mathMode.addEventListener('change', () => {
  storageSet({ mathMode: mathMode.value });
  sendToContent({ type: 'settingsChanged', settings: getSettings() });
});

showButtons.addEventListener('change', () => {
  storageSet({ showButtons: showButtons.checked });
  sendToContent({ type: 'settingsChanged', settings: getSettings() });
});

darkThemeDocx.addEventListener('change', () => {
  storageSet({ darkThemeDocx: darkThemeDocx.checked });
});

if (gptButtonsLimit) {
  const onLimitChanged = () => {
    const value = normalizeGptButtonsLimit(gptButtonsLimit.value);
    gptButtonsLimit.value = String(value);
    storageSet({ gptButtonsLimit: value });
    sendToContent({ type: 'settingsChanged', settings: getSettings() }).catch(() => {});
  };
  gptButtonsLimit.addEventListener('change', onLimitChanged);
  gptButtonsLimit.addEventListener('blur', onLimitChanged);
}

function getSettings() {
  return {
    language: currentLanguage,
    mathMode: mathMode.value,
    showButtons: showButtons.checked,
    gptButtonsLimit: normalizeGptButtonsLimit(gptButtonsLimit?.value),
    darkThemeDocx: darkThemeDocx.checked,
  };
}

function normalizeGptButtonsLimit(value) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 0) return 0;
  return Math.min(parsed, 200);
}

// Check if we're on a ChatGPT page
async function checkStatus() {
  try {
    const tabs = await tabsQuery({ active: true, currentWindow: true });
    const tab = tabs[0];
    if (tab && (tab.url?.includes('chatgpt.com') || tab.url?.includes('chat.openai.com'))) {
      statusEl.className = 'status status-ok';
      statusState = 'statusActive';
      updateStatusText();
      btnCopy.disabled = false;
      btnDocx.disabled = false;
      btnPdf.disabled = false;
    } else {
      statusEl.className = 'status status-error';
      statusState = 'statusOpenChatGpt';
      updateStatusText();
      btnCopy.disabled = true;
      btnDocx.disabled = true;
      btnPdf.disabled = true;
    }
  } catch (e) {
    statusEl.className = 'status status-error';
    statusState = 'statusError';
    updateStatusText();
  }
}

// Send message to content script
async function sendToContent(message) {
  try {
    const tabs = await tabsQuery({ active: true, currentWindow: true });
    const tab = tabs[0];
    if (!tab) throw new Error('No active tab');
    return await tabsSendMessage(tab.id, message);
  } catch (e) {
    showNotification(tr('errRefreshPage'), 'error');
    throw e;
  }
}

// Show notification
function showNotification(text, type = 'success') {
  notification.textContent = text;
  notification.className = `notification ${type}`;
  setTimeout(() => {
    notification.className = 'notification hidden';
  }, 3000);
}

// Set loading state
function setLoading(btn, loading) {
  btn.classList.toggle('loading', loading);
  btn.disabled = loading;
}

// Button handlers
btnCopy.addEventListener('click', async () => {
  setLoading(btnCopy, true);
  try {
    const response = await sendToContent({ type: 'copyForWord' });
    if (response?.success) {
      showNotification(tr('copiedToWord'), 'success');
    } else {
      showNotification(response?.error || tr('copyFailed'), 'error');
    }
  } catch (e) {
    console.error(e);
  } finally {
    setLoading(btnCopy, false);
  }
});

btnDocx.addEventListener('click', async () => {
  setLoading(btnDocx, true);
  try {
    const response = await sendToContent({
      type: 'exportDocx',
      settings: getSettings(),
    });
    if (response?.success) {
      showNotification(tr('docxDownloaded'), 'success');
    } else {
      showNotification(response?.error || tr('docxExportFailed'), 'error');
    }
  } catch (e) {
    console.error(e);
  } finally {
    setLoading(btnDocx, false);
  }
});

btnPdf.addEventListener('click', async () => {
  setLoading(btnPdf, true);
  try {
    const response = await sendToContent({ type: 'exportPdf' });
    if (response?.success) {
      showNotification(tr('pdfDownloaded'), 'success');
    } else {
      showNotification(response?.error || tr('pdfExportFailed'), 'error');
    }
  } catch (e) {
    console.error(e);
  } finally {
    setLoading(btnPdf, false);
  }
});

// Saved prompts management
function loadPrompts() {
  return storageGet(['savedPrompts']).then((result) => {
    return result.savedPrompts || [];
  }).catch(() => []);
}

function savePrompts(prompts) {
  return storageSet({ savedPrompts: prompts });
}

function renderPrompts() {
  loadPrompts().then((prompts) => {
    promptsList.innerHTML = '';

    if (prompts.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'prompts-empty';
      empty.textContent = tr('noSavedPrompts');
      promptsList.appendChild(empty);
      return;
    }

    prompts.forEach((prompt, index) => {
      const item = document.createElement('div');
      item.className = 'prompt-item';

      const promptText = document.createElement('div');
      promptText.className = 'prompt-text';
      promptText.title = prompt;
      promptText.textContent = prompt;

      const promptActions = document.createElement('div');
      promptActions.className = 'prompt-actions';

      const copyBtn = document.createElement('button');
      copyBtn.className = 'btn-prompt-action btn-prompt-copy';
      copyBtn.title = tr('copyTitle');
      copyBtn.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
          <rect x="5" y="1" width="9" height="12" rx="1" stroke="currentColor" stroke-width="1.5"/>
          <rect x="2" y="3" width="9" height="12" rx="1" fill="white" stroke="currentColor" stroke-width="1.5"/>
        </svg>
      `;

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn-prompt-action btn-prompt-delete';
      deleteBtn.title = tr('deleteTitle');
      deleteBtn.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
          <path d="M2 4h12M3 4v9a1 1 0 001 1h8a1 1 0 001-1V4m-5 3v4m2-4v4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      `;

      promptActions.appendChild(copyBtn);
      promptActions.appendChild(deleteBtn);
      item.appendChild(promptText);
      item.appendChild(promptActions);

      // Copy prompt to clipboard
      promptText.addEventListener('click', () => {
        navigator.clipboard.writeText(prompt).then(() => {
          showNotification(tr('promptCopied'), 'success');
        });
      });

      // Copy button
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(prompt).then(() => {
          showNotification(tr('promptCopied'), 'success');
        });
      });

      // Delete button
      deleteBtn.addEventListener('click', () => {
        loadPrompts().then((currentPrompts) => {
          currentPrompts.splice(index, 1);
          savePrompts(currentPrompts);
          renderPrompts();
          showNotification(tr('promptDeleted'), 'success');
        });
      });

      promptsList.appendChild(item);
    });
  });
}

// Save new prompt
function saveNewPrompt() {
  const promptText = promptInput.value.trim();

  if (!promptText) {
    showNotification(tr('enterPrompt'), 'error');
    return;
  }

  if (promptText.length > 500) {
    showNotification(tr('promptTooLong'), 'error');
    return;
  }

  loadPrompts().then((prompts) => {
    // Avoid duplicates
    if (prompts.includes(promptText)) {
      showNotification(tr('promptAlreadySaved'), 'error');
      return;
    }

    prompts.unshift(promptText); // Add to beginning
    prompts = prompts.slice(0, 20); // Keep only last 20

    savePrompts(prompts).then(() => {
      promptInput.value = '';
      renderPrompts();
      showNotification(tr('promptSaved'), 'success');
    });
  });
}

btnSavePrompt.addEventListener('click', saveNewPrompt);
promptInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    saveNewPrompt();
  }
});

// Initial fallback render before storage resolves
applyLanguage(getSystemLanguage());
renderPrompts();
checkStatus();
