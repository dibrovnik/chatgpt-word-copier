/**
 * PDF Generator - exports ChatGPT responses as clean PDF files.
 * Uses html2canvas + jsPDF for high-quality rendering.
 */

import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { getMarkdownContent } from './dom-extractor';

/**
 * Generate a PDF from a message element
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
    // Wait for any images/fonts to load
    await new Promise(r => setTimeout(r, 500));

    // Render to canvas
    const canvas = await html2canvas(container, {
      scale: 2, // Higher quality
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      width: container.scrollWidth,
      height: container.scrollHeight,
    });

    // Calculate PDF dimensions
    const imgWidth = 190; // mm (A4 width minus margins)
    const pageHeight = 277; // mm (A4 height minus margins)
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    // Create PDF
    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgData = canvas.toDataURL('image/png');

    let heightLeft = imgHeight;
    let position = 10; // Top margin

    // First page
    pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    // Additional pages if content is longer
    while (heightLeft > 0) {
      position = heightLeft - imgHeight + 10;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    return pdf.output('blob');
  } finally {
    // Clean up
    document.body.removeChild(container);
  }
}

/**
 * Alternative: Generate PDF using window.print() for better quality
 */
export function generatePdfViaPrint(messageEl) {
  const content = getMarkdownContent(messageEl);
  if (!content) {
    throw new Error('No content found');
  }

  const html = content.innerHTML;

  // Open a new window with clean styling
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    throw new Error('Popup blocked - please allow popups');
  }

  printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>ChatGPT Response - PDF</title>
  <style>
    @page {
      margin: 2cm;
      size: A4;
    }
    body {
      font-family: 'Segoe UI', Calibri, Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.6;
      color: #1a1a1a;
      max-width: 100%;
      padding: 0;
      margin: 0;
    }
    h1 { font-size: 20pt; font-weight: 600; margin: 16pt 0 8pt; color: #1a1a2e; }
    h2 { font-size: 16pt; font-weight: 600; margin: 14pt 0 6pt; color: #1a1a2e; }
    h3 { font-size: 13pt; font-weight: 600; margin: 12pt 0 4pt; color: #1a1a2e; }
    h4 { font-size: 11pt; font-weight: 600; margin: 10pt 0 4pt; }
    p { margin: 0 0 8pt; }
    strong { font-weight: 600; }
    em { font-style: italic; }
    code {
      font-family: Consolas, 'Courier New', monospace;
      font-size: 9.5pt;
      background: #f5f5f5;
      padding: 1px 4px;
      border-radius: 3px;
      border: 1px solid #e0e0e0;
    }
    pre {
      font-family: Consolas, 'Courier New', monospace;
      font-size: 9pt;
      background: #f8f8f8;
      padding: 10pt;
      margin: 8pt 0;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
      overflow-x: auto;
      white-space: pre-wrap;
      word-wrap: break-word;
    }
    pre code {
      background: none;
      border: none;
      padding: 0;
    }
    table {
      border-collapse: collapse;
      margin: 8pt 0;
      width: 100%;
      font-size: 10pt;
    }
    th, td {
      border: 1px solid #bbb;
      padding: 6pt 10pt;
      text-align: left;
    }
    th {
      background: #f0f0f0;
      font-weight: 600;
    }
    blockquote {
      border-left: 3px solid #ccc;
      padding-left: 12pt;
      margin: 8pt 0;
      color: #555;
      font-style: italic;
    }
    ul, ol {
      margin: 4pt 0 8pt;
      padding-left: 24pt;
    }
    li { margin: 2pt 0; }
    img { max-width: 100%; height: auto; }
    
    /* KaTeX styling for print */
    .katex { font-size: 1em; }
    .katex-display { margin: 8pt 0; text-align: center; }
    
    /* Hide non-content elements */
    .code-block-header button,
    .flex.items-center.text-token-text-secondary button {
      display: none !important;
    }

    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
  ${getKatexStyles()}
</head>
<body>
  ${html}
  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
        setTimeout(function() { window.close(); }, 1000);
      }, 500);
    };
  </script>
</body>
</html>`);

  printWindow.document.close();
  return true;
}

/**
 * Create a clean print-ready container
 */
function createPrintContainer(sourceContent) {
  const container = document.createElement('div');
  container.style.cssText = `
    position: absolute;
    left: -9999px;
    top: 0;
    width: 720px;
    padding: 40px;
    background: white;
    font-family: 'Segoe UI', Calibri, Arial, sans-serif;
    font-size: 14px;
    line-height: 1.6;
    color: #1a1a1a;
  `;

  // Clone content
  const clone = sourceContent.cloneNode(true);

  // Apply print-friendly styles
  const style = document.createElement('style');
  style.textContent = `
    h1 { font-size: 24px; font-weight: 600; margin: 16px 0 8px; }
    h2 { font-size: 20px; font-weight: 600; margin: 14px 0 6px; }
    h3 { font-size: 16px; font-weight: 600; margin: 12px 0 4px; }
    p { margin: 0 0 8px; }
    code { font-family: Consolas, monospace; font-size: 13px; background: #f5f5f5; padding: 1px 4px; border-radius: 3px; }
    pre { font-family: Consolas, monospace; font-size: 12px; background: #f8f8f8; padding: 12px; margin: 8px 0; border-radius: 4px; overflow: hidden; }
    pre code { background: none; padding: 0; }
    table { border-collapse: collapse; margin: 8px 0; width: 100%; }
    th, td { border: 1px solid #bbb; padding: 6px 10px; text-align: left; }
    th { background: #f0f0f0; font-weight: 600; }
    blockquote { border-left: 3px solid #ccc; padding-left: 12px; margin: 8px 0; color: #555; }
    ul, ol { margin: 4px 0 8px; padding-left: 24px; }
    li { margin: 2px 0; }
  `;
  container.appendChild(style);
  container.appendChild(clone);

  return container;
}

/**
 * Get KaTeX styles for the print window (extract from current page)
 */
function getKatexStyles() {
  const katexStyles = [];
  for (const sheet of document.styleSheets) {
    try {
      if (sheet.href && sheet.href.includes('katex')) {
        katexStyles.push(`<link rel="stylesheet" href="${sheet.href}">`);
      }
    } catch (e) {
      // Cross-origin stylesheet
    }
  }

  // If no external KaTeX styles found, include inline
  if (katexStyles.length === 0) {
    const katexStyleEl = document.querySelector('style[data-katex]');
    if (katexStyleEl) {
      katexStyles.push(`<style>${katexStyleEl.textContent}</style>`);
    }
  }

  return katexStyles.join('\n');
}
