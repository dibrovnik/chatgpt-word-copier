/**
 * Tests for browser-api.js — cross-browser API helper
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  isFirefox,
  isChromium,
  getAPI,
  storageGet,
  storageSet,
  tabsQuery,
  tabsSendMessage,
  onMessage,
  onInstalled,
  download,
} from '../src/lib/browser-api.js';

// ===== Helper to set up global mocks =====

function mockChrome() {
  const chromeObj = {
    runtime: {
      onMessage: { addListener: vi.fn() },
      onInstalled: { addListener: vi.fn() },
      lastError: null,
    },
    storage: {
      local: {
        get: vi.fn(),
        set: vi.fn(),
      },
    },
    tabs: {
      query: vi.fn(),
      sendMessage: vi.fn(),
    },
    downloads: {
      download: vi.fn(),
    },
  };
  globalThis.chrome = chromeObj;
  // Ensure browser is NOT defined (Chromium environment)
  delete globalThis.browser;
  return chromeObj;
}

function mockFirefox() {
  const browserObj = {
    runtime: {
      onMessage: { addListener: vi.fn() },
      onInstalled: { addListener: vi.fn() },
    },
    storage: {
      local: {
        get: vi.fn().mockResolvedValue({}),
        set: vi.fn().mockResolvedValue(undefined),
      },
    },
    tabs: {
      query: vi.fn().mockResolvedValue([]),
      sendMessage: vi.fn().mockResolvedValue(undefined),
    },
    downloads: {
      download: vi.fn().mockResolvedValue(42),
    },
  };
  // Firefox has both browser.* and chrome.* — but browser.runtime should exist
  globalThis.browser = browserObj;
  // chrome may also exist in Firefox, but browser takes priority
  globalThis.chrome = browserObj;
  return browserObj;
}

function cleanGlobals() {
  delete globalThis.chrome;
  delete globalThis.browser;
}

// ===== Detection tests =====

describe('Browser detection', () => {
  afterEach(cleanGlobals);

  it('isFirefox() returns true when browser.runtime exists', () => {
    mockFirefox();
    expect(isFirefox()).toBe(true);
  });

  it('isFirefox() returns false in Chrome environment', () => {
    mockChrome();
    expect(isFirefox()).toBe(false);
  });

  it('isChromium() returns true in Chrome environment', () => {
    mockChrome();
    expect(isChromium()).toBe(true);
  });

  it('isChromium() returns false in Firefox environment', () => {
    mockFirefox();
    expect(isChromium()).toBe(false);
  });

  it('isFirefox() returns false when no APIs exist', () => {
    cleanGlobals();
    expect(isFirefox()).toBe(false);
  });

  it('isChromium() returns false when no APIs exist', () => {
    cleanGlobals();
    expect(isChromium()).toBe(false);
  });

  it('getAPI() returns browser object in Firefox', () => {
    const browserObj = mockFirefox();
    expect(getAPI()).toBe(browserObj);
  });

  it('getAPI() returns chrome object in Chrome', () => {
    const chromeObj = mockChrome();
    expect(getAPI()).toBe(chromeObj);
  });

  it('getAPI() returns null when no APIs exist', () => {
    cleanGlobals();
    expect(getAPI()).toBeNull();
  });
});

// ===== Storage tests (Chrome) =====

describe('storageGet — Chrome', () => {
  afterEach(cleanGlobals);

  it('should call chrome.storage.local.get with callback', async () => {
    const chromeObj = mockChrome();
    chromeObj.storage.local.get.mockImplementation((keys, cb) => {
      cb({ showButtons: true, mathMode: 'omml' });
    });

    const result = await storageGet(['showButtons', 'mathMode']);
    expect(chromeObj.storage.local.get).toHaveBeenCalledWith(
      ['showButtons', 'mathMode'],
      expect.any(Function)
    );
    expect(result).toEqual({ showButtons: true, mathMode: 'omml' });
  });

  it('should return empty object when callback returns null', async () => {
    const chromeObj = mockChrome();
    chromeObj.storage.local.get.mockImplementation((keys, cb) => cb(null));

    const result = await storageGet(['key']);
    expect(result).toEqual({});
  });
});

describe('storageGet — Firefox', () => {
  afterEach(cleanGlobals);

  it('should call browser.storage.local.get returning a Promise', async () => {
    const browserObj = mockFirefox();
    browserObj.storage.local.get.mockResolvedValue({ darkThemeDocx: false });

    const result = await storageGet(['darkThemeDocx']);
    expect(browserObj.storage.local.get).toHaveBeenCalledWith(['darkThemeDocx']);
    expect(result).toEqual({ darkThemeDocx: false });
  });
});

describe('storageGet — no API', () => {
  afterEach(cleanGlobals);

  it('should resolve with empty object when API is unavailable', async () => {
    cleanGlobals();
    const result = await storageGet(['anything']);
    expect(result).toEqual({});
  });
});

// ===== storageSet =====

describe('storageSet — Chrome', () => {
  afterEach(cleanGlobals);

  it('should call chrome.storage.local.set with callback', async () => {
    const chromeObj = mockChrome();
    chromeObj.storage.local.set.mockImplementation((data, cb) => cb());

    await storageSet({ showButtons: false });
    expect(chromeObj.storage.local.set).toHaveBeenCalledWith(
      { showButtons: false },
      expect.any(Function)
    );
  });
});

describe('storageSet — Firefox', () => {
  afterEach(cleanGlobals);

  it('should call browser.storage.local.set returning a Promise', async () => {
    const browserObj = mockFirefox();
    await storageSet({ mathMode: 'image' });
    expect(browserObj.storage.local.set).toHaveBeenCalledWith({ mathMode: 'image' });
  });
});

// ===== tabsQuery =====

describe('tabsQuery — Chrome', () => {
  afterEach(cleanGlobals);

  it('should call chrome.tabs.query with callback', async () => {
    const chromeObj = mockChrome();
    const fakeTabs = [{ id: 1, url: 'https://chatgpt.com/c/123' }];
    chromeObj.tabs.query.mockImplementation((q, cb) => cb(fakeTabs));

    const tabs = await tabsQuery({ active: true, currentWindow: true });
    expect(tabs).toEqual(fakeTabs);
  });
});

describe('tabsQuery — Firefox', () => {
  afterEach(cleanGlobals);

  it('should call browser.tabs.query returning a Promise', async () => {
    const browserObj = mockFirefox();
    const fakeTabs = [{ id: 2, url: 'https://chatgpt.com/c/456' }];
    browserObj.tabs.query.mockResolvedValue(fakeTabs);

    const tabs = await tabsQuery({ active: true, currentWindow: true });
    expect(tabs).toEqual(fakeTabs);
  });
});

describe('tabsQuery — no API', () => {
  afterEach(cleanGlobals);

  it('should resolve with empty array when API is unavailable', async () => {
    cleanGlobals();
    const tabs = await tabsQuery({ active: true });
    expect(tabs).toEqual([]);
  });
});

// ===== tabsSendMessage =====

describe('tabsSendMessage — Chrome', () => {
  afterEach(cleanGlobals);

  it('should send message and resolve with response', async () => {
    const chromeObj = mockChrome();
    chromeObj.tabs.sendMessage.mockImplementation((tabId, msg, cb) => {
      cb({ success: true });
    });

    const response = await tabsSendMessage(1, { type: 'copyForWord' });
    expect(response).toEqual({ success: true });
  });

  it('should reject when runtime.lastError is set', async () => {
    const chromeObj = mockChrome();
    chromeObj.tabs.sendMessage.mockImplementation((tabId, msg, cb) => {
      chromeObj.runtime.lastError = { message: 'Could not establish connection' };
      cb(undefined);
      chromeObj.runtime.lastError = null;
    });

    await expect(tabsSendMessage(1, { type: 'test' })).rejects.toThrow('Could not establish connection');
  });
});

describe('tabsSendMessage — Firefox', () => {
  afterEach(cleanGlobals);

  it('should send message and resolve with response', async () => {
    const browserObj = mockFirefox();
    browserObj.tabs.sendMessage.mockResolvedValue({ success: true, data: 'ok' });

    const response = await tabsSendMessage(5, { type: 'exportDocx' });
    expect(browserObj.tabs.sendMessage).toHaveBeenCalledWith(5, { type: 'exportDocx' });
    expect(response).toEqual({ success: true, data: 'ok' });
  });
});

// ===== onMessage =====

describe('onMessage', () => {
  afterEach(cleanGlobals);

  it('should register listener on Chrome', () => {
    const chromeObj = mockChrome();
    const handler = vi.fn();
    onMessage(handler);
    expect(chromeObj.runtime.onMessage.addListener).toHaveBeenCalledWith(handler);
  });

  it('should register listener on Firefox', () => {
    const browserObj = mockFirefox();
    const handler = vi.fn();
    onMessage(handler);
    expect(browserObj.runtime.onMessage.addListener).toHaveBeenCalledWith(handler);
  });

  it('should not throw when no API exists', () => {
    cleanGlobals();
    expect(() => onMessage(vi.fn())).not.toThrow();
  });
});

// ===== onInstalled =====

describe('onInstalled', () => {
  afterEach(cleanGlobals);

  it('should register listener on Chrome', () => {
    const chromeObj = mockChrome();
    const handler = vi.fn();
    onInstalled(handler);
    expect(chromeObj.runtime.onInstalled.addListener).toHaveBeenCalledWith(handler);
  });

  it('should register listener on Firefox', () => {
    const browserObj = mockFirefox();
    const handler = vi.fn();
    onInstalled(handler);
    expect(browserObj.runtime.onInstalled.addListener).toHaveBeenCalledWith(handler);
  });

  it('should not throw when no API exists', () => {
    cleanGlobals();
    expect(() => onInstalled(vi.fn())).not.toThrow();
  });
});

// ===== download =====

describe('download — Chrome', () => {
  afterEach(cleanGlobals);

  it('should trigger a download and resolve with id', async () => {
    const chromeObj = mockChrome();
    chromeObj.downloads.download.mockImplementation((opts, cb) => cb(99));

    const id = await download({ url: 'blob:test', filename: 'test.docx', saveAs: true });
    expect(id).toBe(99);
    expect(chromeObj.downloads.download).toHaveBeenCalledWith(
      { url: 'blob:test', filename: 'test.docx', saveAs: true },
      expect.any(Function)
    );
  });

  it('should reject when runtime.lastError is set', async () => {
    const chromeObj = mockChrome();
    chromeObj.downloads.download.mockImplementation((opts, cb) => {
      chromeObj.runtime.lastError = { message: 'Download failed' };
      cb(undefined);
      chromeObj.runtime.lastError = null;
    });

    await expect(download({ url: 'x' })).rejects.toThrow('Download failed');
  });
});

describe('download — Firefox', () => {
  afterEach(cleanGlobals);

  it('should trigger a download and resolve with id', async () => {
    const browserObj = mockFirefox();
    browserObj.downloads.download.mockResolvedValue(7);

    const id = await download({ url: 'blob:test', filename: 'test.docx' });
    expect(id).toBe(7);
  });
});

describe('download — no API', () => {
  afterEach(cleanGlobals);

  it('should reject when downloads API is unavailable', async () => {
    cleanGlobals();
    await expect(download({ url: 'x' })).rejects.toThrow('downloads API unavailable');
  });
});
