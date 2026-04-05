/**
 * PDF Generator - exports ChatGPT responses as clean PDF files.
 * Supports both direct download and print flow.
 */

import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { getMarkdownContent } from './dom-extractor';

const PDF_WORDS_LIMIT = 5;
const PDF_FALLBACK_WORDS = 'chatgpt-response';
const PDF_MAX_WORDS_PART_LENGTH = 80;

/**
 * Generate PDF preview window with toolbar buttons (direct download + print + close).
 * Content is cleaned: all ChatGPT interactive buttons (copy table, etc.) are removed.
 */
export function generatePdfViaPrint(messageEl) {
  const content = getMarkdownContent(messageEl);
  if (!content) {
    throw new Error('No content found');
  }

  // Clone and clean content before rendering
  const cleanHtml = cleanContentForPdf(content);
  const pdfFilename = buildPdfFilename(messageEl);
  const pdfTitle = escapeHtml(stripPdfExtension(pdfFilename));

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
    '<title>' +
    pdfTitle +
    '</title>' +
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
    'ul { list-style-type: disc !important; list-style-position: outside !important; }' +
    'ol { list-style-type: decimal !important; list-style-position: outside !important; }' +
    'li { display: list-item !important; margin: 2pt 0; }' +
    '.cgpt-pdf-marker { display: inline-block; min-width: 1.8em; font-weight: 600; white-space: pre; }' +
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
    '.pdf-toolbar button:disabled { opacity: 0.65; cursor: not-allowed; }' +
    '@media print { .pdf-toolbar { display: none !important; } .pdf-content { padding: 0; max-width: 100%; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }' +
    '</style>' +
    katexStylesHtml +
    allPageStyles +
    '</head>' +
    '<body>' +
    '<div class="pdf-toolbar">' +
    '<span class="pdf-toolbar-title">ChatGPT Response</span>' +
    '<button class="pdf-btn-primary" id="pdf-download-btn">&#11015; \u0421\u043A\u0430\u0447\u0430\u0442\u044C PDF</button>' +
    '<button class="pdf-btn-secondary" id="pdf-print-btn">&#128424; \u041F\u0435\u0447\u0430\u0442\u044C</button>' +
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
    const downloadBtn = printWindow.document.getElementById('pdf-download-btn');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', async function () {
        const initialText = downloadBtn.textContent;
        downloadBtn.disabled = true;
        downloadBtn.textContent = '\u23F3 \u0421\u043E\u0437\u0434\u0430\u043D\u0438\u0435 PDF...';
        try {
          await generatePdfDirectDownload(messageEl);
        } catch (e) {
          console.error('Direct PDF download error:', e);
          printWindow.alert('\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0441\u043A\u0430\u0447\u0430\u0442\u044C PDF: ' + (e?.message || 'Unknown error'));
        } finally {
          downloadBtn.disabled = false;
          downloadBtn.textContent = initialText;
        }
      });
    }

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
 * Generate and download PDF directly without opening print dialog.
 */
export async function generatePdfDirectDownload(messageEl) {
  const content = getMarkdownContent(messageEl);
  if (!content) {
    throw new Error('No content found');
  }

  const cleanHtml = cleanContentForPdf(content);
  const renderRoot = createPdfRenderRoot(cleanHtml);
  const filename = buildPdfFilename(messageEl);
  document.body.appendChild(renderRoot);

  try {
    await waitForImages(renderRoot);
    await waitNextFrame();

    const canvas = await Promise.race([
      html2canvas(renderRoot, {
        scale: Math.min(2, window.devicePixelRatio || 2),
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#ffffff',
        logging: false,
        windowWidth: renderRoot.scrollWidth,
        windowHeight: renderRoot.scrollHeight,
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('html2canvas timeout')), 15000))
    ]);

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    const pageMarginMm = 10;
    const pageWidthMm = pdf.internal.pageSize.getWidth() - pageMarginMm * 2;
    const pageHeightMm = pdf.internal.pageSize.getHeight() - pageMarginMm * 2;
    const imageWidthMm = pageWidthMm;
    const imageHeightMm = (canvas.height * imageWidthMm) / canvas.width;
    const imageData = canvas.toDataURL('image/png');

    let heightLeftMm = imageHeightMm;
    let positionMm = pageMarginMm;

    pdf.addImage(imageData, 'PNG', pageMarginMm, positionMm, imageWidthMm, imageHeightMm, undefined, 'FAST');
    heightLeftMm -= pageHeightMm;

    while (heightLeftMm > 0) {
      positionMm = pageMarginMm - (imageHeightMm - heightLeftMm);
      pdf.addPage();
      pdf.addImage(imageData, 'PNG', pageMarginMm, positionMm, imageWidthMm, imageHeightMm, undefined, 'FAST');
      heightLeftMm -= pageHeightMm;
    }

    pdf.save(filename);
    return filename;
  } finally {
    renderRoot.remove();
  }
}

/**
 * Build PDF filename: date/time + first 5 words of the answer.
 */
export function buildPdfFilename(messageEl) {
  const timestampPart = getTimestampForFilename();
  const firstWordsPart = getFirstWordsForFilename(messageEl);
  return `${timestampPart}_${firstWordsPart}.pdf`;
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

function getFirstWordsForFilename(messageEl) {
  const content = getMarkdownContent(messageEl);
  const rawText = (content?.innerText || content?.textContent || '').replace(/\s+/g, ' ').trim();
  if (!rawText) return PDF_FALLBACK_WORDS;

  const words = rawText.split(' ').filter(Boolean).slice(0, PDF_WORDS_LIMIT);
  if (words.length === 0) return PDF_FALLBACK_WORDS;

  const joined = words.join(' ');
  const sanitized = sanitizeFilenamePart(joined);
  return sanitized || PDF_FALLBACK_WORDS;
}

function sanitizeFilenamePart(value) {
  return value
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, PDF_MAX_WORDS_PART_LENGTH)
    .replace(/\s+/g, '-')
    .replace(/\.+$/g, '')
    .replace(/^[.-]+|[.-]+$/g, '');
}

function getTimestampForFilename() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;
}

function stripPdfExtension(filename) {
  return filename.replace(/\.pdf$/i, '');
}

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function createPdfRenderRoot(cleanHtml) {
  const root = document.createElement('div');
  root.setAttribute('aria-hidden', 'true');
  root.style.position = 'fixed';
  root.style.left = '-100000px';
  root.style.top = '0';
  root.style.width = '794px';
  root.style.background = '#ffffff';
  root.style.zIndex = '-1';
  root.style.pointerEvents = 'none';

  root.innerHTML =
    '<style>' +
    '.cgpt-pdf-export { font-family: "Segoe UI", Calibri, Arial, sans-serif; font-size: 11pt; line-height: 1.6; color: #1a1a1a; padding: 20px 40px 60px; max-width: 800px; }' +
    '.cgpt-pdf-export * { box-sizing: border-box; }' +
    '.cgpt-pdf-export h1 { font-size: 20pt; font-weight: 600; margin: 16pt 0 8pt; color: #1a1a2e; }' +
    '.cgpt-pdf-export h2 { font-size: 16pt; font-weight: 600; margin: 14pt 0 6pt; color: #1a1a2e; }' +
    '.cgpt-pdf-export h3 { font-size: 13pt; font-weight: 600; margin: 12pt 0 4pt; color: #1a1a2e; }' +
    '.cgpt-pdf-export h4 { font-size: 11pt; font-weight: 600; margin: 10pt 0 4pt; }' +
    '.cgpt-pdf-export p { margin: 0 0 8pt; }' +
    '.cgpt-pdf-export strong { font-weight: 600; }' +
    '.cgpt-pdf-export em { font-style: italic; }' +
    '.cgpt-pdf-export code { font-family: Consolas, "Courier New", monospace; font-size: 9.5pt; background: #f5f5f5; padding: 1px 4px; border-radius: 3px; border: 1px solid #e0e0e0; }' +
    '.cgpt-pdf-export pre { font-family: Consolas, "Courier New", monospace; font-size: 9pt; background: #f8f8f8; padding: 10pt; margin: 8pt 0; border: 1px solid #e0e0e0; border-radius: 4pt; overflow-x: auto; white-space: pre-wrap; word-wrap: break-word; }' +
    '.cgpt-pdf-export pre code { background: none; border: none; padding: 0; }' +
    '.cgpt-pdf-export table { border-collapse: collapse; margin: 8pt 0; width: 100%; font-size: 10pt; }' +
    '.cgpt-pdf-export th, .cgpt-pdf-export td { border: 1px solid #bbb; padding: 6pt 10pt; text-align: left; }' +
    '.cgpt-pdf-export th { background: #f0f0f0; font-weight: 600; }' +
    '.cgpt-pdf-export blockquote { border-left: 3px solid #ccc; padding-left: 12pt; margin: 8pt 0; color: #555; font-style: italic; }' +
    '.cgpt-pdf-export ul, .cgpt-pdf-export ol { margin: 4pt 0 8pt; padding-left: 24pt; }' +
    '.cgpt-pdf-export ul { list-style-type: disc !important; list-style-position: outside !important; }' +
    '.cgpt-pdf-export ol { list-style-type: decimal !important; list-style-position: outside !important; }' +
    '.cgpt-pdf-export li { display: list-item !important; margin: 2pt 0; }' +
    '.cgpt-pdf-export .cgpt-pdf-marker { display: inline-block; min-width: 1.8em; font-weight: 600; white-space: pre; }' +
    '.cgpt-pdf-export img { max-width: 100%; height: auto; }' +
    '.cgpt-pdf-export .katex { font-size: 1em; }' +
    '.cgpt-pdf-export .katex-display { margin: 8pt 0; text-align: center; }' +
    '</style>' +
    '<div class="cgpt-pdf-export">' +
    cleanHtml +
    '</div>';

  return root;
}

function waitForImages(root) {
  const images = Array.from(root.querySelectorAll('img'));
  if (images.length === 0) {
    return Promise.resolve();
  }

  return Promise.all(
    images.map(
      (img) =>
        new Promise((resolve) => {
          if (img.complete) {
            resolve();
            return;
          }
          
          let resolved = false;
          const finish = () => {
            if (resolved) return;
            resolved = true;
            resolve();
          };

          img.addEventListener('load', finish, { once: true });
          img.addEventListener('error', finish, { once: true });
          
          // Fallback timeout in case image never fires load/error
          setTimeout(finish, 5000);
        })
    )
  );
}

function waitNextFrame() {
  return new Promise((resolve) => {
    // requestAnimationFrame could hang if the original tab is hidden. 
    // We use setTimeout to ensure it reliably resolves even in inactive tabs.
    setTimeout(() => resolve(), 100);
  });
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
