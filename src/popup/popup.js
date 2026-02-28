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
