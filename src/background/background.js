/**
 * Background Service Worker - handles downloads and coordination
 */

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // Set default settings
    chrome.storage.local.set({
      showButtons: true,
      mathMode: 'omml',
      darkThemeDocx: false,
    });
    console.log('[ChatGPT→Word Copier] Extension installed');
  }
});

// Handle messages from content script or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'download') {
    // Handle file downloads
    handleDownload(message.data, message.filename, message.mimeType);
    sendResponse({ success: true });
  }
  return false;
});

/**
 * Trigger a file download
 */
function handleDownload(dataUrl, filename, mimeType) {
  chrome.downloads.download({
    url: dataUrl,
    filename: filename,
    saveAs: true,
  });
}

console.log('[ChatGPT→Word Copier] Background service worker loaded');
