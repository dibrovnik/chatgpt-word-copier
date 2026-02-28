/**
 * Background Service Worker / Script - handles downloads and coordination.
 * Works in both Chrome (service worker) and Firefox (background script).
 */

import { onInstalled, onMessage, storageSet, download } from '../lib/browser-api';

// Handle extension installation
onInstalled((details) => {
  if (details.reason === 'install') {
    // Set default settings
    storageSet({
      showButtons: true,
      mathMode: 'omml',
      darkThemeDocx: false,
    });
    console.log('[ChatGPT→Word Copier] Extension installed');
  }
});

// Handle messages from content script or popup
onMessage((message, sender, sendResponse) => {
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
  download({
    url: dataUrl,
    filename: filename,
    saveAs: true,
  }).catch((err) => console.error('[ChatGPT→Word Copier] Download error:', err));
}

console.log('[ChatGPT→Word Copier] Background service worker loaded');
