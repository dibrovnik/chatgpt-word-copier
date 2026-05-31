import htmlToPdfmake from 'html-to-pdfmake';

const PDF_REMOVE_SELECTORS = [
  '.sticky',
  '.cgpt-word-copier-buttons',
  'button',
  '[data-testid*="button"]',
  '.absolute.end-0',
  '.code-block-header',
  'svg.icon',
  '[aria-label]',
  '.select-none',
];

const PDFMAKE_DEFAULT_ELEMENT_STYLES = {
  b: { bold: true },
  strong: { bold: true },
  i: { italics: true },
  em: { italics: true },
  p: { margin: [0, 0, 0, 8] },
  h1: { fontSize: 20, bold: true, color: '#1a1a2e', margin: [0, 12, 0, 8] },
  h2: { fontSize: 16, bold: true, color: '#1a1a2e', margin: [0, 10, 0, 6] },
  h3: { fontSize: 13, bold: true, color: '#1a1a2e', margin: [0, 8, 0, 4] },
  h4: { fontSize: 11, bold: true, margin: [0, 6, 0, 4] },
  table: { margin: [0, 4, 0, 8] },
  th: { bold: true, fillColor: '#f0f0f0' },
  ul: { margin: [0, 2, 0, 6] },
  ol: { margin: [0, 2, 0, 6] },
  blockquote: { color: '#555555', italics: true, margin: [10, 4, 0, 8] },
};

/**
 * Build a text-based pdfmake document. pdfmake handles line wrapping and page
 * layout itself, so page boundaries never slice through rendered pixels.
 */
export function buildPdfDocumentDefinition(sourceContent, windowObject = window) {
  const cleanHtml = cleanContentForPdf(sourceContent, { normalizeForPdfmake: true });
  const content = htmlToPdfmake(cleanHtml, {
    window: windowObject,
    defaultStyles: PDFMAKE_DEFAULT_ELEMENT_STYLES,
    ignoreStyles: ['font-family'],
    removeExtraBlanks: true,
    tableAutoSize: true,
  });

  return {
    pageSize: 'A4',
    pageMargins: [40, 40, 40, 48],
    content: stylePdfmakeContent(content),
    defaultStyle: {
      font: 'Roboto',
      fontSize: 11,
      lineHeight: 1.3,
      color: '#1a1a1a',
    },
  };
}

/**
 * Remove ChatGPT controls and normalize elements that pdfmake cannot render
 * safely without remote resource requests.
 */
export function cleanContentForPdf(sourceContent, options = {}) {
  const clone = sourceContent.cloneNode(true);

  for (const selector of PDF_REMOVE_SELECTORS) {
    for (const element of clone.querySelectorAll(selector)) {
      element.remove();
    }
  }

  if (options.normalizeForPdfmake) {
    normalizeKatex(clone);
    normalizeImages(clone);
  }

  return clone.innerHTML;
}

function normalizeKatex(root) {
  for (const katex of root.querySelectorAll('.katex')) {
    if (!root.contains(katex)) continue;

    const latex = katex
      .querySelector('annotation[encoding="application/x-tex"]')
      ?.textContent
      ?.trim();
    const fallback = latex || katex.textContent.trim();
    const replacement = root.ownerDocument.createElement('span');
    replacement.className = 'cgpt-pdf-math';
    replacement.textContent = fallback;
    katex.replaceWith(replacement);
  }
}

function normalizeImages(root) {
  for (const image of root.querySelectorAll('img')) {
    const src = image.getAttribute('src') || '';
    if (/^data:image\/(?:png|jpe?g);base64,/i.test(src)) continue;

    const alt = image.getAttribute('alt')?.trim();
    image.replaceWith(root.ownerDocument.createTextNode(alt ? `[Image: ${alt}]` : '[Image omitted]'));
  }
}

function stylePdfmakeContent(content) {
  if (Array.isArray(content)) {
    return content.map(stylePdfmakeContent);
  }

  if (!content || typeof content !== 'object') {
    return content;
  }

  const styled = { ...content };

  for (const key of ['text', 'stack', 'ul', 'ol']) {
    if (styled[key] !== undefined) {
      styled[key] = stylePdfmakeContent(styled[key]);
    }
  }

  if (styled.table?.body) {
    styled.table = {
      ...styled.table,
      body: stylePdfmakeContent(styled.table.body),
    };

    if (isHeaderRow(styled.table.body[0])) {
      styled.table.headerRows = 1;
    }

    styled.layout = 'lightHorizontalLines';
  }

  if (styled.nodeName === 'CODE') {
    styled.fontSize = 9;
    styled.color = '#1f2937';
    styled.background = '#f3f4f6';
    styled.preserveLeadingSpaces = true;
  }

  if (styled.nodeName === 'PRE') {
    return createCodeBlock(styled);
  }

  return styled;
}

function createCodeBlock(preNode) {
  return {
    nodeName: 'PRE',
    margin: [0, 4, 0, 8],
    table: {
      widths: ['*'],
      body: [
        [
          {
            text: preNode.text || preNode.stack || '',
            fillColor: '#f8f8f8',
            color: '#1f2937',
            fontSize: 9,
            lineHeight: 1.2,
            margin: [8, 6, 8, 6],
            preserveLeadingSpaces: true,
          },
        ],
      ],
    },
    layout: {
      hLineColor: () => '#e0e0e0',
      vLineColor: () => '#e0e0e0',
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
    },
  };
}

function isHeaderRow(row) {
  return Array.isArray(row) && row.some((cell) => cell?.nodeName === 'TH');
}
