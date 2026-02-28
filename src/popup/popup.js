/**
 * Popup script - handles UI interactions and communicates with content script
 */

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
chrome.storage?.local?.get(['mathMode', 'showButtons', 'darkThemeDocx'], (result) => {
  if (result.mathMode) mathMode.value = result.mathMode;
  if (result.showButtons !== undefined) showButtons.checked = result.showButtons;
  if (result.darkThemeDocx !== undefined) darkThemeDocx.checked = result.darkThemeDocx;
});

// Save settings on change
mathMode.addEventListener('change', () => {
  chrome.storage?.local?.set({ mathMode: mathMode.value });
  sendToContent({ type: 'settingsChanged', settings: getSettings() });
});

showButtons.addEventListener('change', () => {
  chrome.storage?.local?.set({ showButtons: showButtons.checked });
  sendToContent({ type: 'settingsChanged', settings: getSettings() });
});

darkThemeDocx.addEventListener('change', () => {
  chrome.storage?.local?.set({ darkThemeDocx: darkThemeDocx.checked });
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
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
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
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) throw new Error('No active tab');
    return await chrome.tabs.sendMessage(tab.id, message);
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
