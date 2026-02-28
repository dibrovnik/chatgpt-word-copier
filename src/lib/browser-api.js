/**
 * Cross-browser API helper.
 *
 * Provides a unified interface that works in both Chrome (chrome.*)
 * and Firefox (browser.*) extensions.
 *
 * Firefox supports the `browser.*` namespace with Promises.
 * Chrome uses `chrome.*` with callbacks (and lately Promises in MV3).
 * This module normalises the differences so the rest of the codebase
 * can call a single API.
 */

/**
 * Detect whether we are running in a Firefox-based browser.
 */
export function isFirefox() {
  return typeof browser !== 'undefined' && typeof browser.runtime !== 'undefined';
}

/**
 * Detect whether we are running in a Chromium-based browser.
 */
export function isChromium() {
  return typeof chrome !== 'undefined' && typeof chrome.runtime !== 'undefined' && !isFirefox();
}

/**
 * Return the underlying extension API object (`browser` on Firefox, `chrome` on Chromium).
 */
export function getAPI() {
  if (isFirefox()) return browser;
  if (typeof chrome !== 'undefined') return chrome;
  return null;
}

// ===== Storage helpers =====

/**
 * Read values from extension local storage.
 * @param {string[]} keys
 * @returns {Promise<Object>}
 */
export function storageGet(keys) {
  const api = getAPI();
  if (!api?.storage?.local) return Promise.resolve({});

  if (isFirefox()) {
    return api.storage.local.get(keys);
  }

  // Chrome — wrap callback in Promise
  return new Promise((resolve) => {
    api.storage.local.get(keys, (result) => resolve(result || {}));
  });
}

/**
 * Write values to extension local storage.
 * @param {Object} data
 * @returns {Promise<void>}
 */
export function storageSet(data) {
  const api = getAPI();
  if (!api?.storage?.local) return Promise.resolve();

  if (isFirefox()) {
    return api.storage.local.set(data);
  }

  return new Promise((resolve) => {
    api.storage.local.set(data, () => resolve());
  });
}

// ===== Tabs helpers =====

/**
 * Query tabs.
 * @param {Object} queryInfo
 * @returns {Promise<Array>}
 */
export function tabsQuery(queryInfo) {
  const api = getAPI();
  if (!api?.tabs?.query) return Promise.resolve([]);

  if (isFirefox()) {
    return api.tabs.query(queryInfo);
  }

  return new Promise((resolve) => {
    api.tabs.query(queryInfo, (tabs) => resolve(tabs || []));
  });
}

/**
 * Send a message to a content script in a tab.
 * @param {number} tabId
 * @param {*} message
 * @returns {Promise<*>}
 */
export function tabsSendMessage(tabId, message) {
  const api = getAPI();
  if (!api?.tabs?.sendMessage) return Promise.reject(new Error('tabs API unavailable'));

  if (isFirefox()) {
    return api.tabs.sendMessage(tabId, message);
  }

  return new Promise((resolve, reject) => {
    api.tabs.sendMessage(tabId, message, (response) => {
      if (api.runtime.lastError) {
        reject(new Error(api.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}

// ===== Runtime helpers =====

/**
 * Register an onMessage listener.
 * @param {Function} handler - (message, sender, sendResponse) => boolean|Promise
 */
export function onMessage(handler) {
  const api = getAPI();
  if (!api?.runtime?.onMessage) return;

  api.runtime.onMessage.addListener(handler);
}

/**
 * Register an onInstalled listener.
 * @param {Function} handler - (details) => void
 */
export function onInstalled(handler) {
  const api = getAPI();
  if (!api?.runtime?.onInstalled) return;

  api.runtime.onInstalled.addListener(handler);
}

// ===== Downloads =====

/**
 * Trigger a download.
 * @param {Object} options - { url, filename, saveAs }
 * @returns {Promise<number>} download id
 */
export function download(options) {
  const api = getAPI();
  if (!api?.downloads?.download) return Promise.reject(new Error('downloads API unavailable'));

  if (isFirefox()) {
    return api.downloads.download(options);
  }

  return new Promise((resolve, reject) => {
    api.downloads.download(options, (downloadId) => {
      if (api.runtime.lastError) {
        reject(new Error(api.runtime.lastError.message));
      } else {
        resolve(downloadId);
      }
    });
  });
}
