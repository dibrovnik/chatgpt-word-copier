/**
 * PDF Generator - exports ChatGPT responses as clean PDF files.
 * Uses html2canvas + jsPDF for blob-based rendering,
 * and a print-based approach with visible toolbar for user-initiated print/save.
 */

import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { getMarkdownContent } from './dom-extractor';

/**
 * Generate a PDF blob from a message element (automatic, no print dialog)
 * @param {HTMLElement} messageEl - The message container element
 * @returns {Promise<Blob>} - PDF as blob
 */
export async function generatePdf(messageEl) {
  const content = getMarkdownContent(messageEl);
  if (!content) {
    throw new Error('No content found');
  }

  // Create a clean container for rendering
  const container = createPrintContainer(content);
  document.body.appendChild(container);

  try {
    await new Promise(r => setTimeout(r, 500));

    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      width: container.scrollWidth,
      height: container.scrollHeight,
    });

    const imgWidth = 190; // mm
    const pageHeight = 277; // mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgData = canvas.toDataURL('image/png');

    let heightLeft = imgHeight;
    let position = 10;

    pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position = heightLeft - imgHeight + 10;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    return pdf.output('blob');
  } finally {
    document.body.removeChild(container);
  }
}

/**
 * Generate PDF via print dialog with a visible toolbar (Download/Print + Close buttons).
 * Content is cleaned: all ChatGPT interactive buttons (copy table, etc.) are removed.
 */
export function generatePdfViaPrint(messageEl) {
  const content = getMarkdownContent(messageEl);
  if (!content) {
    throw new Error('No content found');
  }

  // Clone and clean content before rendering
  const cleanHtml = cleanContentForPdf(content);

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    throw new Error('Popup blocked - please allow popups');
  }

  const katexStylesHtml = getKatexStyles();
  const allPageStyles = extractPageStyles();

  printWindow.document.write(
    '<!DOCTYPE html>' +
    '<html>' +
    '<head>' +
    '<meta charset="utf-8">' +
    '<title>ChatGPT Response - PDF</title>' +
    '<style>' +
    '@page { margin: 2cm; size: A4; }' +
    '* { box-sizing: border-box; }' +
    'body { font-family: "Segoe UI", Calibri, Arial, sans-serif; font-size: 11pt; line-height: 1.6; color: #1a1a1a; margin: 0; padding: 0; }' +
    '.pdf-content { max-width: 800px; margin: 0 auto; padding: 20px 40px 60px; }' +
    'h1 { font-size: 20pt; font-weight: 600; margin: 16pt 0 8pt; color: #1a1a2e; }' +
    'h2 { font-size: 16pt; font-weight: 600; margin: 14pt 0 6pt; color: #1a1a2e; }' +
    'h3 { font-size: 13pt; font-weight: 600; margin: 12pt 0 4pt; color: #1a1a2e; }' +
    'h4 { font-size: 11pt; font-weight: 600; margin: 10pt 0 4pt; }' +
    'p { margin: 0 0 8pt; }' +
    'strong { font-weight: 600; }' +
    'em { font-style: italic; }' +
    'code { font-family: Consolas, "Courier New", monospace; font-size: 9.5pt; background: #f5f5f5; padding: 1px 4px; border-radius: 3px; border: 1px solid #e0e0e0; }' +
    'pre { font-family: Consolas, "Courier New", monospace; font-size: 9pt; background: #f8f8f8; padding: 10pt; margin: 8pt 0; border: 1px solid #e0e0e0; border-radius: 4pt; overflow-x: auto; white-space: pre-wrap; word-wrap: break-word; }' +
    'pre code { background: none; border: none; padding: 0; }' +
    'table { border-collapse: collapse; margin: 8pt 0; width: 100%; font-size: 10pt; }' +
    'th, td { border: 1px solid #bbb; padding: 6pt 10pt; text-align: left; }' +
    'th { background: #f0f0f0; font-weight: 600; }' +
    'blockquote { border-left: 3px solid #ccc; padding-left: 12pt; margin: 8pt 0; color: #555; font-style: italic; }' +
    'ul, ol { margin: 4pt 0 8pt; padding-left: 24pt; }' +
    'li { margin: 2pt 0; }' +
    'img { max-width: 100%; height: auto; }' +
    '.katex { font-size: 1em; }' +
    '.katex-display { margin: 8pt 0; text-align: center; }' +
    '.pdf-toolbar { position: sticky; top: 0; z-index: 1000; background: #fff; border-bottom: 1px solid #e0e0e0; padding: 12px 20px; display: flex; align-items: center; gap: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }' +
    '.pdf-toolbar-title { font-size: 14px; color: #666; margin-right: auto; }' +
    '.pdf-toolbar button { padding: 8px 18px; border: 1px solid #ccc; border-radius: 6px; cursor: pointer; font-size: 14px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; font-weight: 500; transition: all 0.15s; }' +
    '.pdf-btn-primary { background: #2563eb; color: white; border-color: #2563eb; }' +
    '.pdf-btn-primary:hover { background: #1d4ed8; }' +
    '.pdf-btn-secondary { background: #f3f4f6; color: #374151; }' +
    '.pdf-btn-secondary:hover { background: #e5e7eb; }' +
    '@media print { .pdf-toolbar { display: none !important; } .pdf-content { padding: 0; max-width: 100%; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }' +
    '</style>' +
    katexStylesHtml +
    allPageStyles +
    '</head>' +
    '<body>' +
    '<div class="pdf-toolbar">' +
    '<span class="pdf-toolbar-title">ChatGPT Response</span>' +
    '<button class="pdf-btn-primary" id="pdf-print-btn">&#128196; \u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u043A\u0430\u043A PDF / \u041F\u0435\u0447\u0430\u0442\u044C</button>' +
    '<button class="pdf-btn-secondary" id="pdf-close-btn">\u0417\u0430\u043A\u0440\u044B\u0442\u044C</button>' +
    '</div>' +
    '<div class="pdf-content">' +
    cleanHtml +
    '</div>' +
    '</body>' +
    '</html>'
  );

  printWindow.document.close();

  // Attach event listeners programmatically (inline onclick blocked by CSP)
  try {
    const printBtn = printWindow.document.getElementById('pdf-print-btn');
    if (printBtn) {
      printBtn.addEventListener('click', function () { printWindow.print(); });
    }
    const closeBtn = printWindow.document.getElementById('pdf-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', function () { printWindow.close(); });
    }
  } catch (e) {
    // If cross-origin restrictions prevent access, buttons won't work
    console.warn('Could not attach PDF toolbar handlers:', e);
  }

  return true;
}

/**
 * Clone content and remove all ChatGPT interactive elements
 * (copy buttons on tables, code block header buttons, our own injected buttons, etc.)
 */
function cleanContentForPdf(sourceContent) {
  const clone = sourceContent.cloneNode(true);

  // Selectors for interactive/non-content elements to remove
  const removeSelectors = [
    '.sticky',                                // Table copy button containers
    '.cgpt-word-copier-buttons',              // Our injected buttons
    'button',                                 // All buttons (copy, etc.)
    '[data-testid*="button"]',                // Testid-based buttons
    '.absolute.end-0',                        // Absolute-positioned utility wrappers
    '.code-block-header',                     // Code block header with copy button
    'svg.icon',                               // Standalone icon SVGs
    '[aria-label]',                           // All labeled interactive elements
    '.select-none',                           // Non-selectable utility elements (e.g., sticky wrappers)
  ];

  for (const sel of removeSelectors) {
    try {
      const elements = clone.querySelectorAll(sel);
      for (const el of elements) {
        el.remove();
      }
    } catch (e) {
      // Ignore invalid selectors
    }
  }

  return clone.innerHTML;
}

/**
 * Create a clean print-ready container (for html2canvas approach)
 */
function createPrintContainer(sourceContent) {
  const container = document.createElement('div');
  container.style.cssText =
    'position: absolute; left: -9999px; top: 0; width: 720px; padding: 40px; ' +
    'background: white; font-family: "Segoe UI", Calibri, Arial, sans-serif; ' +
    'font-size: 14px; line-height: 1.6; color: #1a1a1a;';

  // Clone and clean content
  const clone = sourceContent.cloneNode(true);

  // Remove interactive elements from clone
  const removeSelectors = ['.sticky', '.cgpt-word-copier-buttons', 'button', '.select-none', '[aria-label]'];
  for (const sel of removeSelectors) {
    try {
      const els = clone.querySelectorAll(sel);
      for (const el of els) el.remove();
    } catch (e) {}
  }

  const style = document.createElement('style');
  style.textContent =
    'h1 { font-size: 24px; font-weight: 600; margin: 16px 0 8px; }' +
    'h2 { font-size: 20px; font-weight: 600; margin: 14px 0 6px; }' +
    'h3 { font-size: 16px; font-weight: 600; margin: 12px 0 4px; }' +
    'p { margin: 0 0 8px; }' +
    'code { font-family: Consolas, monospace; font-size: 13px; background: #f5f5f5; padding: 1px 4px; border-radius: 3px; }' +
    'pre { font-family: Consolas, monospace; font-size: 12px; background: #f8f8f8; padding: 12px; margin: 8px 0; border-radius: 4px; overflow: hidden; }' +
    'pre code { background: none; padding: 0; }' +
    'table { border-collapse: collapse; margin: 8px 0; width: 100%; }' +
    'th, td { border: 1px solid #bbb; padding: 6px 10px; text-align: left; }' +
    'th { background: #f0f0f0; font-weight: 600; }' +
    'blockquote { border-left: 3px solid #ccc; padding-left: 12px; margin: 8px 0; color: #555; }' +
    'ul, ol { margin: 4px 0 8px; padding-left: 24px; }' +
    'li { margin: 2px 0; }';
  container.appendChild(style);
  container.appendChild(clone);

  return container;
}

/**
 * Get KaTeX styles for the print window (extract from current page)
 */
function getKatexStyles() {
  // 1. Try external katex stylesheets
  const externalLinks = [];
  for (const sheet of document.styleSheets) {
    try {
      if (sheet.href && sheet.href.includes('katex')) {
        externalLinks.push('<link rel="stylesheet" href="' + sheet.href + '">');
      }
    } catch (e) {
      // Cross-origin stylesheet
    }
  }
  if (externalLinks.length > 0) return externalLinks.join('\n');

  // 2. Try inline katex style element
  const katexStyleEl = document.querySelector('style[data-katex]');
  if (katexStyleEl) {
    return '<style>' + katexStyleEl.textContent + '</style>';
  }

  // 3. Extract all CSS rules targeting .katex from all accessible stylesheets
  let katexRules = '';
  for (const sheet of document.styleSheets) {
    try {
      const rules = sheet.cssRules || sheet.rules;
      if (!rules) continue;
      for (const rule of rules) {
        const text = rule.cssText || '';
        if (text.includes('.katex') || text.includes('@font-face')) {
          katexRules += text + '\n';
        }
      }
    } catch (e) {
      // Cross-origin stylesheet - try to link it
      if (sheet.href) {
        externalLinks.push('<link rel="stylesheet" href="' + sheet.href + '">');
      }
    }
  }

  if (katexRules) {
    return '<style>' + katexRules + '</style>' + (externalLinks.length > 0 ? '\n' + externalLinks.join('\n') : '');
  }

  if (externalLinks.length > 0) {
    return externalLinks.join('\n');
  }

  // 4. Fallback: minimal KaTeX-like styles so formulas don't completely break
  return '<style>' +
    '.katex { font-family: KaTeX_Main, "Times New Roman", serif; white-space: nowrap; }' +
    '.katex .katex-mathml { position: absolute; clip: rect(1px,1px,1px,1px); padding: 0; border: 0; height: 1px; width: 1px; overflow: hidden; }' +
    '.katex .mord { font-family: KaTeX_Main, serif; }' +
    '.katex .mbin, .katex .mrel, .katex .mop { font-family: KaTeX_Main, serif; }' +
    '.katex .mfrac .frac-line { border-bottom-style: solid; border-bottom-width: 1px; }' +
    '.katex .msupsub { font-size: 0.7em; }' +
    '.katex .sqrt-sign { font-family: KaTeX_Main, serif; }' +
    '.katex-display { display: block; margin: 1em 0; text-align: center; }' +
    '.katex-display > .katex { display: inline-block; }' +
    '</style>';
}

/**
 * Extract all accessible page styles for the print window.
 * This catches styles ChatGPT injects that affect formula rendering,
 * code blocks, etc. beyond just KaTeX.
 */
function extractPageStyles() {
  const parts = [];
  for (const sheet of document.styleSheets) {
    try {
      // Link external stylesheets (except katex - already handled)
      if (sheet.href) {
        if (!sheet.href.includes('katex')) {
          parts.push('<link rel="stylesheet" href="' + sheet.href + '">');
        }
        continue;
      }
      // For inline <style> tags, check if they contain relevant rules
      const rules = sheet.cssRules || sheet.rules;
      if (!rules) continue;
      let relevant = '';
      for (const rule of rules) {
        const text = rule.cssText || '';
        // Keep rules that affect math, code, or general typography
        if (
          text.includes('.katex') ||
          text.includes('.math') ||
          text.includes('@font-face') ||
          text.includes('.code') ||
          text.includes('pre') ||
          text.includes('.prose') ||
          text.includes('.markdown')
        ) {
          relevant += text + '\n';
        }
      }
      if (relevant) {
        parts.push('<style>' + relevant + '</style>');
      }
    } catch (e) {
      // Cross-origin - skip
    }
  }
  return parts.join('\n');
}
