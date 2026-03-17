/**
 * Popup script - handles UI interactions and communicates with content script.
 * Works in both Chrome and Firefox via browser-api helper.
 */

import { storageGet, storageSet, tabsQuery, tabsSendMessage } from '../lib/browser-api';

// DOM elements
const btnCopy = document.getElementById('btnCopy');
const btnDocx = document.getElementById('btnDocx');
const btnPdf = document.getElementById('btnPdf');
const mathMode = document.getElementById('mathMode');
const showButtons = document.getElementById('showButtons');
const darkThemeDocx = document.getElementById('darkThemeDocx');
const statusEl = document.getElementById('status');
const statusText = document.getElementById('statusText');
const notification = document.getElementById('notification');
const versionEl = document.querySelector('.version');
const promptInput = document.getElementById('promptInput');
const btnSavePrompt = document.getElementById('btnSavePrompt');
const promptsList = document.getElementById('promptsList');

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
storageGet(['mathMode', 'showButtons', 'darkThemeDocx']).then((result) => {
  if (result.mathMode) mathMode.value = result.mathMode;
  if (result.showButtons !== undefined) showButtons.checked = result.showButtons;
  if (result.darkThemeDocx !== undefined) darkThemeDocx.checked = result.darkThemeDocx;
}).catch(() => {});

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

function getSettings() {
  return {
    mathMode: mathMode.value,
    showButtons: showButtons.checked,
    darkThemeDocx: darkThemeDocx.checked,
  };
}

// Check if we're on a ChatGPT page
async function checkStatus() {
  try {
    const tabs = await tabsQuery({ active: true, currentWindow: true });
    const tab = tabs[0];
    if (tab && (tab.url?.includes('chatgpt.com') || tab.url?.includes('chat.openai.com'))) {
      statusEl.className = 'status status-ok';
      statusText.textContent = 'Расширение активно на ChatGPT';
      btnCopy.disabled = false;
      btnDocx.disabled = false;
      btnPdf.disabled = false;
    } else {
      statusEl.className = 'status status-error';
      statusText.textContent = 'Откройте ChatGPT для работы';
      btnCopy.disabled = true;
      btnDocx.disabled = true;
      btnPdf.disabled = true;
    }
  } catch (e) {
    statusEl.className = 'status status-error';
    statusText.textContent = 'Ошибка проверки статуса';
  }
}

checkStatus();

// Send message to content script
async function sendToContent(message) {
  try {
    const tabs = await tabsQuery({ active: true, currentWindow: true });
    const tab = tabs[0];
    if (!tab) throw new Error('No active tab');
    return await tabsSendMessage(tab.id, message);
  } catch (e) {
    showNotification('Ошибка: обновите страницу ChatGPT', 'error');
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
      showNotification('✓ Скопировано! Вставьте в Word (Ctrl+V)', 'success');
    } else {
      showNotification(response?.error || 'Не удалось скопировать', 'error');
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
      showNotification('✓ DOCX файл загружен', 'success');
    } else {
      showNotification(response?.error || 'Ошибка экспорта DOCX', 'error');
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
      showNotification('✓ PDF файл загружен', 'success');
    } else {
      showNotification(response?.error || 'Ошибка экспорта PDF', 'error');
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
      promptsList.innerHTML = '<div class="prompts-empty">Нет сохраненных промтов</div>';
      return;
    }
    
    prompts.forEach((prompt, index) => {
      const item = document.createElement('div');
      item.className = 'prompt-item';
      item.innerHTML = `
        <div class="prompt-text" title="${prompt}">Нажмите для копирования: ${prompt}</div>
        <div class="prompt-actions">
          <button class="btn-prompt-action btn-prompt-copy" title="Копировать">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <rect x="5" y="1" width="9" height="12" rx="1" stroke="currentColor" stroke-width="1.5"/>
              <rect x="2" y="3" width="9" height="12" rx="1" fill="white" stroke="currentColor" stroke-width="1.5"/>
            </svg>
          </button>
          <button class="btn-prompt-action btn-prompt-delete" title="Удалить">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <path d="M2 4h12M3 4v9a1 1 0 001 1h8a1 1 0 001-1V4m-5 3v4m2-4v4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
      `;
      
      // Copy prompt to clipboard
      const promptText = item.querySelector('.prompt-text');
      promptText.addEventListener('click', () => {
        navigator.clipboard.writeText(prompt).then(() => {
          showNotification('✓ Промт скопирован', 'success');
        });
      });
      
      // Copy button
      const copyBtn = item.querySelector('.btn-prompt-copy');
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(prompt).then(() => {
          showNotification('✓ Промт скопирован', 'success');
        });
      });
      
      // Delete button
      const deleteBtn = item.querySelector('.btn-prompt-delete');
      deleteBtn.addEventListener('click', () => {
        loadPrompts().then((currentPrompts) => {
          currentPrompts.splice(index, 1);
          savePrompts(currentPrompts);
          renderPrompts();
          showNotification('✓ Промт удален', 'success');
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
    showNotification('⚠ Введите промт', 'error');
    return;
  }
  
  if (promptText.length > 500) {
    showNotification('⚠ Промт слишком длинный (макс. 500 символов)', 'error');
    return;
  }
  
  loadPrompts().then((prompts) => {
    // Avoid duplicates
    if (prompts.includes(promptText)) {
      showNotification('⚠ Этот промт уже сохранен', 'error');
      return;
    }
    
    prompts.unshift(promptText); // Add to beginning
    prompts = prompts.slice(0, 20); // Keep only last 20
    
    savePrompts(prompts).then(() => {
      promptInput.value = '';
      renderPrompts();
      showNotification('✓ Промт сохранен', 'success');
    });
  });
}

btnSavePrompt.addEventListener('click', saveNewPrompt);
promptInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    saveNewPrompt();
  }
});

// Initial render
renderPrompts();
