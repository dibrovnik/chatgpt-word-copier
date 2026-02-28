/**
 * Clipboard Helper - copies HTML with MathML to clipboard for Word compatibility.
 * 
 * Word can read MathML from the clipboard and convert it to native equations.
 * KaTeX already generates MathML, so we extract it and format the HTML properly.
 */

import { getLastAssistantMessage, getCleanHtmlWithMathML, getSelectedContent, getMarkdownContent } from './dom-extractor';

/**
 * Copy the last assistant message (or selection) to clipboard with MathML for Word
 */
export async function copyForWord() {
  try {
    // Check for selection first
    const selectedEl = getSelectedContent();
    let html;

    if (selectedEl) {
      html = prepareMathMLHtml(selectedEl);
    } else {
      // Get last assistant message
      const lastMessage = getLastAssistantMessage();
      if (!lastMessage) {
        return { success: false, error: 'Нет ответов ChatGPT на странице' };
      }
      html = getCleanHtmlWithMathML(lastMessage);
    }

    if (!html || html.trim() === '') {
      return { success: false, error: 'Пустой ответ' };
    }

    // Wrap in proper HTML with MathML namespace
    const fullHtml = wrapForClipboard(html);

    // Copy to clipboard using the Clipboard API
    await copyRichHtml(fullHtml, stripHtml(html));

    return { success: true };
  } catch (e) {
    console.error('Copy error:', e);
    return { success: false, error: e.message };
  }
}

/**
 * Copy a specific message element
 */
export async function copyMessageForWord(messageEl) {
  try {
    const html = getCleanHtmlWithMathML(messageEl);
    if (!html) {
      return { success: false, error: 'Пустой ответ' };
    }

    const fullHtml = wrapForClipboard(html);
    await copyRichHtml(fullHtml, stripHtml(html));
    return { success: true };
  } catch (e) {
    console.error('Copy error:', e);
    return { success: false, error: e.message };
  }
}

/**
 * Prepare HTML from a selection container, replacing KaTeX with MathML
 */
function prepareMathMLHtml(container) {
  const clone = container.cloneNode(true);

  // Replace KaTeX elements with MathML
  const katexElements = clone.querySelectorAll('.katex');
  for (const katex of katexElements) {
    const mathml = katex.querySelector('.katex-mathml math');
    if (mathml) {
      const mathClone = mathml.cloneNode(true);
      const isDisplay = katex.closest('.katex-display') !== null;
      if (isDisplay) {
        mathClone.setAttribute('display', 'block');
      }
      const wrapper = katex.closest('.katex-display') || katex;

      // Ensure spaces are preserved around inline math (Word strips whitespace around <math>)
      if (!isDisplay) {
        const prev = wrapper.previousSibling;
        const next = wrapper.nextSibling;
        const needSpaceBefore = prev && prev.nodeType === Node.TEXT_NODE &&
          prev.textContent.length > 0 && !prev.textContent.endsWith(' ') && !prev.textContent.endsWith('\u00A0');
        const needSpaceAfter = next && next.nodeType === Node.TEXT_NODE &&
          next.textContent.length > 0 && !next.textContent.startsWith(' ') && !next.textContent.startsWith('\u00A0');

        wrapper.replaceWith(mathClone);

        if (needSpaceBefore) {
          mathClone.before(document.createTextNode('\u00A0'));
        }
        if (needSpaceAfter) {
          mathClone.after(document.createTextNode('\u00A0'));
        }
      } else {
        wrapper.replaceWith(mathClone);
      }
    }
  }

  // Remove visual-only katex elements
  const katexHtml = clone.querySelectorAll('.katex-html');
  for (const el of katexHtml) {
    el.remove();
  }

  return clone.innerHTML;
}

/**
 * Wrap content in a proper HTML document for clipboard,
 * with MathML namespace declarations that Word can read
 */
function wrapForClipboard(html) {
  return `<!DOCTYPE html>
<html xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"
      xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word">
<head>
<meta charset="utf-8">
<style>
  body { font-family: Calibri, sans-serif; font-size: 11pt; line-height: 1.5; color: #000; }
  h1 { font-size: 20pt; font-weight: bold; margin: 12pt 0 6pt; }
  h2 { font-size: 16pt; font-weight: bold; margin: 10pt 0 5pt; }
  h3 { font-size: 14pt; font-weight: bold; margin: 8pt 0 4pt; }
  h4 { font-size: 12pt; font-weight: bold; margin: 6pt 0 3pt; }
  p { margin: 0 0 6pt; }
  code { font-family: Consolas, 'Courier New', monospace; font-size: 10pt; background: #f5f5f5; padding: 1px 4px; border-radius: 3px; }
  pre { font-family: Consolas, 'Courier New', monospace; font-size: 9pt; background: #f8f8f8; padding: 8pt; margin: 6pt 0; border: 1px solid #ddd; border-radius: 4px; white-space: pre-wrap; }
  pre code { background: none; padding: 0; }
  table { border-collapse: collapse; margin: 6pt 0; width: auto; }
  th, td { border: 1px solid #999; padding: 4pt 8pt; text-align: left; }
  th { background: #f0f0f0; font-weight: bold; }
  blockquote { border-left: 3px solid #ccc; padding-left: 10pt; margin: 6pt 0; color: #555; }
  ul, ol { margin: 3pt 0 6pt 20pt; }
  li { margin: 2pt 0; }
  strong, b { font-weight: bold; }
  em, i { font-style: italic; }
  math { font-family: Cambria Math, serif; }
</style>
</head>
<body>
${html}
</body>
</html>`;
}

/**
 * Copy HTML to clipboard with both text/html and text/plain
 */
async function copyRichHtml(html, plainText) {
  try {
    // Try the modern Clipboard API first
    const htmlBlob = new Blob([html], { type: 'text/html' });
    const textBlob = new Blob([plainText], { type: 'text/plain' });

    await navigator.clipboard.write([
      new ClipboardItem({
        'text/html': htmlBlob,
        'text/plain': textBlob,
      }),
    ]);
  } catch (e) {
    // Fallback: use execCommand
    console.warn('Clipboard API failed, using fallback:', e);
    copyWithExecCommand(html, plainText);
  }
}

/**
 * Fallback copy using execCommand
 */
function copyWithExecCommand(html, plainText) {
  const listener = (e) => {
    e.preventDefault();
    e.clipboardData.setData('text/html', html);
    e.clipboardData.setData('text/plain', plainText);
  };

  document.addEventListener('copy', listener);
  document.execCommand('copy');
  document.removeEventListener('copy', listener);
}

/**
 * Strip HTML tags to get plain text
 */
function stripHtml(html) {
  const temp = document.createElement('div');
  temp.innerHTML = html;

  // Replace math elements with LaTeX notation
  const mathEls = temp.querySelectorAll('math');
  for (const math of mathEls) {
    const annotation = math.querySelector('annotation[encoding="application/x-tex"]');
    if (annotation) {
      const isDisplay = math.getAttribute('display') === 'block';
      const latex = annotation.textContent;
      math.replaceWith(isDisplay ? `\n$$${latex}$$\n` : `$${latex}$`);
    }
  }

  return temp.textContent || '';
}
