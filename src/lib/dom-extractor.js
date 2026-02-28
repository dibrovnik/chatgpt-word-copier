/**
 * DOM Extractor - extracts structured content from ChatGPT messages.
 * Handles the ChatGPT DOM structure to find assistant responses.
 */

/**
 * Get all assistant message containers on the page
 */
export function getAssistantMessages() {
  // ChatGPT uses multiple possible selectors for messages
  const selectors = [
    '[data-message-author-role="assistant"]',
    '[data-testid^="conversation-turn-"] .agent-turn',
    '.markdown.prose',
  ];

  for (const sel of selectors) {
    const elements = document.querySelectorAll(sel);
    if (elements.length > 0) {
      return Array.from(elements);
    }
  }

  return [];
}

/**
 * Get the last assistant message element
 */
export function getLastAssistantMessage() {
  const messages = getAssistantMessages();
  return messages.length > 0 ? messages[messages.length - 1] : null;
}

/**
 * Get the markdown content container from a message element
 */
export function getMarkdownContent(messageEl) {
  // The actual content is in a div with class "markdown" or similar
  const markdownEl =
    messageEl.querySelector('.markdown.prose') ||
    messageEl.querySelector('.markdown') ||
    messageEl.querySelector('[class*="markdown"]') ||
    messageEl;

  return markdownEl;
}

/**
 * Extract structured content from a message element.
 * Returns an array of content blocks.
 */
export function extractContent(messageEl) {
  const container = getMarkdownContent(messageEl);
  if (!container) return [];

  const blocks = [];
  const children = container.children;

  for (let i = 0; i < children.length; i++) {
    const el = children[i];
    const block = parseElement(el);
    if (block) {
      blocks.push(block);
    }
  }

  return blocks;
}

/**
 * Parse a single HTML element into a structured block
 */
function parseElement(el) {
  const tag = el.tagName.toLowerCase();

  // Headings
  if (/^h[1-6]$/.test(tag)) {
    return {
      type: 'heading',
      level: parseInt(tag[1]),
      content: extractInlineContent(el),
      text: el.textContent,
    };
  }

  // Paragraphs
  if (tag === 'p') {
    return {
      type: 'paragraph',
      content: extractInlineContent(el),
      text: el.textContent,
    };
  }

  // Lists
  if (tag === 'ul' || tag === 'ol') {
    return {
      type: 'list',
      ordered: tag === 'ol',
      items: extractListItems(el),
    };
  }

  // Tables
  if (tag === 'table') {
    return {
      type: 'table',
      rows: extractTableRows(el),
    };
  }

  // Code blocks (pre > code)
  if (tag === 'pre') {
    const codeEl = el.querySelector('code');
    const lang = codeEl?.className?.match(/language-(\w+)/)?.[1] || '';
    return {
      type: 'codeBlock',
      language: lang,
      code: codeEl?.textContent || el.textContent,
    };
  }

  // Block math (display math)
  if (el.classList.contains('katex-display') || el.querySelector('.katex-display')) {
    const katexEl = el.querySelector('.katex') || el;
    return extractMathBlock(katexEl, true);
  }

  // Blockquote
  if (tag === 'blockquote') {
    return {
      type: 'blockquote',
      content: extractInlineContent(el),
      text: el.textContent,
    };
  }

  // Horizontal rule
  if (tag === 'hr') {
    return { type: 'hr' };
  }

  // Details/Summary
  if (tag === 'details') {
    return {
      type: 'details',
      summary: el.querySelector('summary')?.textContent || '',
      content: extractInlineContent(el),
    };
  }

  // Div with content (catch-all for wrapped content)
  if (tag === 'div') {
    // Check for math display
    const katexDisplay = el.querySelector('.katex-display');
    if (katexDisplay) {
      const katexEl = katexDisplay.querySelector('.katex') || katexDisplay;
      return extractMathBlock(katexEl, true);
    }

    // Otherwise treat as paragraph-like
    const inline = extractInlineContent(el);
    if (inline.length > 0) {
      return {
        type: 'paragraph',
        content: inline,
        text: el.textContent,
      };
    }
  }

  return null;
}

/**
 * Extract inline content (text, bold, italic, code, math formulas)
 */
export function extractInlineContent(el) {
  const items = [];

  function walk(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent;
      if (text) {
        items.push({ type: 'text', text });
      }
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const tag = node.tagName.toLowerCase();

    // KaTeX inline math
    if (node.classList.contains('katex')) {
      const mathBlock = extractMathBlock(node, false);
      if (mathBlock) {
        items.push(mathBlock);
      }
      return;
    }

    // Skip hidden KaTeX mathml (it's inside .katex already)
    if (node.classList.contains('katex-mathml')) {
      return;
    }

    // Bold
    if (tag === 'strong' || tag === 'b') {
      items.push({ type: 'bold', content: extractInlineContent(node) });
      return;
    }

    // Italic
    if (tag === 'em' || tag === 'i') {
      items.push({ type: 'italic', content: extractInlineContent(node) });
      return;
    }

    // Inline code
    if (tag === 'code') {
      items.push({ type: 'code', text: node.textContent });
      return;
    }

    // Links
    if (tag === 'a') {
      items.push({
        type: 'link',
        text: node.textContent,
        href: node.getAttribute('href') || '',
      });
      return;
    }

    // Superscript
    if (tag === 'sup') {
      items.push({ type: 'superscript', text: node.textContent });
      return;
    }

    // Subscript
    if (tag === 'sub') {
      items.push({ type: 'subscript', text: node.textContent });
      return;
    }

    // Recurse for other elements
    for (const child of node.childNodes) {
      walk(child);
    }
  }

  for (const child of el.childNodes) {
    walk(child);
  }

  return items;
}

/**
 * Extract MathML and LaTeX from a KaTeX element
 */
function extractMathBlock(katexEl, display) {
  // KaTeX embeds MathML in .katex-mathml > math
  const mathmlContainer = katexEl.querySelector('.katex-mathml');
  const mathEl = mathmlContainer?.querySelector('math');

  // Get the LaTeX source from annotation
  const annotation = mathEl?.querySelector('annotation[encoding="application/x-tex"]');
  const latex = annotation?.textContent || '';

  // Get MathML as string
  let mathml = '';
  if (mathEl) {
    // Clone and clean up the math element
    const clone = mathEl.cloneNode(true);
    // Remove annotation (we keep it separate)
    const anno = clone.querySelector('annotation');
    // Keep annotation for MathML compatibility
    mathml = new XMLSerializer().serializeToString(clone);
  }

  return {
    type: 'math',
    display,
    latex,
    mathml,
  };
}

/**
 * Extract list items recursively
 */
function extractListItems(listEl) {
  const items = [];
  for (const li of listEl.children) {
    if (li.tagName.toLowerCase() === 'li') {
      const item = {
        content: extractInlineContent(li),
        text: '',
      };

      // Check for nested lists
      const nestedList = li.querySelector('ul, ol');
      if (nestedList) {
        item.nestedList = {
          ordered: nestedList.tagName.toLowerCase() === 'ol',
          items: extractListItems(nestedList),
        };
      }

      // Get text without nested list text
      const clone = li.cloneNode(true);
      const nested = clone.querySelector('ul, ol');
      if (nested) nested.remove();
      item.text = clone.textContent.trim();

      items.push(item);
    }
  }
  return items;
}

/**
 * Extract table rows
 */
function extractTableRows(tableEl) {
  const rows = [];

  // Header rows
  const thead = tableEl.querySelector('thead');
  if (thead) {
    for (const tr of thead.querySelectorAll('tr')) {
      rows.push({
        isHeader: true,
        cells: Array.from(tr.querySelectorAll('th, td')).map(cell => ({
          content: extractInlineContent(cell),
          text: cell.textContent.trim(),
        })),
      });
    }
  }

  // Body rows
  const tbody = tableEl.querySelector('tbody') || tableEl;
  for (const tr of tbody.querySelectorAll('tr')) {
    if (thead && tr.closest('thead')) continue;
    rows.push({
      isHeader: false,
      cells: Array.from(tr.querySelectorAll('td, th')).map(cell => ({
        content: extractInlineContent(cell),
        text: cell.textContent.trim(),
      })),
    });
  }

  return rows;
}

/**
 * Get clean HTML for clipboard copy, replacing KaTeX with MathML
 */
export function getCleanHtmlWithMathML(messageEl) {
  const container = getMarkdownContent(messageEl);
  if (!container) return '';

  // Clone the container
  const clone = container.cloneNode(true);

  // Replace all KaTeX elements with their MathML
  const katexElements = clone.querySelectorAll('.katex');
  for (const katex of katexElements) {
    const mathml = katex.querySelector('.katex-mathml math');
    if (mathml) {
      const mathClone = mathml.cloneNode(true);

      // Check if this is display math
      const isDisplay = katex.closest('.katex-display') !== null;
      if (isDisplay) {
        mathClone.setAttribute('display', 'block');
      }

      // Replace the katex span with the math element
      const wrapper = katex.closest('.katex-display') || katex;
      wrapper.replaceWith(mathClone);
    }
  }

  // Remove any remaining katex-html (visual rendering artifacts)
  const katexHtml = clone.querySelectorAll('.katex-html');
  for (const el of katexHtml) {
    el.remove();
  }

  // Clean up code block headers (ChatGPT adds copy buttons etc.)
  const codeHeaders = clone.querySelectorAll('.code-block-header, .flex.items-center');
  for (const header of codeHeaders) {
    // Keep only the language label
    const lang = header.textContent?.trim();
    if (lang && lang.length < 30) {
      header.textContent = lang;
    }
  }

  return clone.innerHTML;
}

/**
 * Get selected text/content within a message, if any
 */
export function getSelectedContent() {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) return null;

  const range = selection.getRangeAt(0);
  const fragment = range.cloneContents();

  // Create a temp container
  const temp = document.createElement('div');
  temp.appendChild(fragment);

  // Check if selection is within a ChatGPT message
  const messageContainer = selection.anchorNode?.parentElement?.closest?.(
    '[data-message-author-role="assistant"], .agent-turn, .markdown.prose'
  );

  if (!messageContainer) return null;

  return temp;
}
