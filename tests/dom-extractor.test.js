/**
 * Tests for DOM Extractor
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  extractContent,
  extractInlineContent,
  getCleanHtmlWithMathML,
  getMarkdownContent,
  getAssistantMessages,
} from '../src/lib/dom-extractor.js';

/**
 * Helper: create a DOM container with given HTML and run extractContent on it
 */
function extract(html) {
  const el = document.createElement('div');
  el.classList.add('markdown', 'prose');
  el.innerHTML = html;
  document.body.appendChild(el);
  const result = extractContent(el);
  el.remove();
  return result;
}

/**
 * Helper: create a DOM container matching the ChatGPT message structure
 */
function makeMessage(html) {
  const msg = document.createElement('div');
  msg.setAttribute('data-message-author-role', 'assistant');
  const inner = document.createElement('div');
  inner.classList.add('markdown', 'prose');
  inner.innerHTML = html;
  msg.appendChild(inner);
  document.body.appendChild(msg);
  return msg;
}

// ===== Basic element extraction =====

describe('DOM Extractor - Basic Elements', () => {
  it('should extract a paragraph', () => {
    const blocks = extract('<p>Hello World</p>');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('paragraph');
    expect(blocks[0].content[0].type).toBe('text');
    expect(blocks[0].content[0].text).toBe('Hello World');
  });

  it('should extract headings (h1-h6)', () => {
    const blocks = extract('<h1>Title</h1><h2>Sub</h2><h3>Section</h3>');
    expect(blocks).toHaveLength(3);
    expect(blocks[0].type).toBe('heading');
    expect(blocks[0].level).toBe(1);
    expect(blocks[1].level).toBe(2);
    expect(blocks[2].level).toBe(3);
  });

  it('should extract unordered list', () => {
    const blocks = extract('<ul><li>Apple</li><li>Banana</li></ul>');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('list');
    expect(blocks[0].ordered).toBe(false);
    expect(blocks[0].items).toHaveLength(2);
    expect(blocks[0].items[0].text).toBe('Apple');
    expect(blocks[0].items[1].text).toBe('Banana');
  });

  it('should extract ordered list', () => {
    const blocks = extract('<ol><li>First</li><li>Second</li></ol>');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('list');
    expect(blocks[0].ordered).toBe(true);
  });

  it('should extract a code block', () => {
    const blocks = extract('<pre><code class="language-python">print("hi")</code></pre>');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('codeBlock');
    expect(blocks[0].language).toBe('python');
    expect(blocks[0].code).toBe('print("hi")');
  });

  it('should extract a blockquote', () => {
    const blocks = extract('<blockquote>Quote text</blockquote>');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('blockquote');
  });

  it('should extract a horizontal rule', () => {
    const blocks = extract('<hr>');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('hr');
  });
});

// ===== Inline content extraction =====

describe('DOM Extractor - Inline Content', () => {
  it('should extract bold text', () => {
    const blocks = extract('<p><strong>bold</strong> normal</p>');
    expect(blocks[0].content[0].type).toBe('bold');
    expect(blocks[0].content[0].content[0].text).toBe('bold');
    expect(blocks[0].content[1].type).toBe('text');
  });

  it('should extract italic text', () => {
    const blocks = extract('<p><em>italic</em></p>');
    expect(blocks[0].content[0].type).toBe('italic');
    expect(blocks[0].content[0].content[0].text).toBe('italic');
  });

  it('should extract inline code', () => {
    const blocks = extract('<p><code>let x = 1</code></p>');
    expect(blocks[0].content[0].type).toBe('code');
    expect(blocks[0].content[0].text).toBe('let x = 1');
  });

  it('should extract links', () => {
    const blocks = extract('<p><a href="https://example.com">Link</a></p>');
    expect(blocks[0].content[0].type).toBe('link');
    expect(blocks[0].content[0].text).toBe('Link');
    expect(blocks[0].content[0].href).toBe('https://example.com');
  });

  it('should extract superscript', () => {
    const blocks = extract('<p>x<sup>2</sup></p>');
    const items = blocks[0].content;
    expect(items[0].type).toBe('text');
    expect(items[1].type).toBe('superscript');
    expect(items[1].text).toBe('2');
  });

  it('should extract subscript', () => {
    const blocks = extract('<p>H<sub>2</sub>O</p>');
    const items = blocks[0].content;
    expect(items[1].type).toBe('subscript');
    expect(items[1].text).toBe('2');
  });
});

// ===== Table extraction =====

describe('DOM Extractor - Tables', () => {
  it('should extract a table with header and body rows', () => {
    const blocks = extract(`
      <table>
        <thead><tr><th>Col1</th><th>Col2</th></tr></thead>
        <tbody><tr><td>A</td><td>B</td></tr></tbody>
      </table>
    `);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('table');
    expect(blocks[0].rows).toHaveLength(2);
    expect(blocks[0].rows[0].isHeader).toBe(true);
    expect(blocks[0].rows[0].cells[0].text).toBe('Col1');
    expect(blocks[0].rows[1].isHeader).toBe(false);
    expect(blocks[0].rows[1].cells[0].text).toBe('A');
  });

  it('should extract table wrapped in ChatGPT div container', () => {
    const blocks = extract(`
      <div class="TyagGW_tableContainer">
        <div class="TyagGW_tableWrapper">
          <table>
            <thead><tr><th>Header</th></tr></thead>
            <tbody><tr><td>Cell</td></tr></tbody>
          </table>
          <div class="sticky h-0 select-none">
            <button aria-label="Копировать таблицу">Copy</button>
          </div>
        </div>
      </div>
    `);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('table');
    expect(blocks[0].rows[0].isHeader).toBe(true);
    expect(blocks[0].rows[0].cells[0].text).toBe('Header');
    expect(blocks[0].rows[1].cells[0].text).toBe('Cell');
  });

  it('should not include button text in table content', () => {
    const blocks = extract(`
      <div class="TyagGW_tableContainer">
        <div class="TyagGW_tableWrapper">
          <table><thead><tr><th>Data</th></tr></thead><tbody><tr><td>Val</td></tr></tbody></table>
          <div class="sticky"><button aria-label="Copy">Copy Table</button></div>
        </div>
      </div>
    `);
    // Only table content should be extracted, not button text
    const allText = blocks[0].rows.flatMap(r => r.cells.map(c => c.text)).join(' ');
    expect(allText).not.toContain('Copy Table');
  });
});

// ===== Math extraction =====

describe('DOM Extractor - Math (KaTeX)', () => {
  it('should extract inline math from KaTeX element', () => {
    const html = `
      <p>
        The formula is 
        <span class="katex">
          <span class="katex-mathml">
            <math xmlns="http://www.w3.org/1998/Math/MathML">
              <semantics>
                <mrow><mi>x</mi><mo>=</mo><mn>2</mn></mrow>
                <annotation encoding="application/x-tex">x=2</annotation>
              </semantics>
            </math>
          </span>
          <span class="katex-html"><span class="mord mathnormal">x</span></span>
        </span>
        end.
      </p>`;
    const blocks = extract(html);
    expect(blocks).toHaveLength(1);
    const mathItem = blocks[0].content.find(c => c.type === 'math');
    expect(mathItem).toBeDefined();
    expect(mathItem.display).toBe(false);
    expect(mathItem.latex).toBe('x=2');
    expect(mathItem.mathml).toContain('<math');
  });

  it('should not duplicate katex-html text in content', () => {
    const html = `
      <p>
        <span class="katex">
          <span class="katex-mathml">
            <math xmlns="http://www.w3.org/1998/Math/MathML">
              <semantics>
                <mrow><mi>y</mi></mrow>
                <annotation encoding="application/x-tex">y</annotation>
              </semantics>
            </math>
          </span>
          <span class="katex-html"><span class="mord mathnormal">y</span></span>
        </span>
      </p>`;
    const blocks = extract(html);
    // Should have only math item, not additional text "y" from katex-html
    const textItems = blocks[0].content.filter(c => c.type === 'text' && c.text.trim() === 'y');
    expect(textItems).toHaveLength(0);
  });
});

// ===== Interactive elements handling =====

describe('DOM Extractor - Skipping UI Elements', () => {
  it('should skip .cgpt-word-copier-buttons div', () => {
    const blocks = extract(`
      <div class="cgpt-word-copier-buttons">
        <button>Copy</button>
        <button>DOCX</button>
      </div>
      <p>Actual content</p>
    `);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('paragraph');
    expect(blocks[0].content[0].text).toBe('Actual content');
  });

  it('should skip .sticky elements', () => {
    const blocks = extract(`
      <p>Content</p>
      <div class="sticky">
        <button>Copy Table</button>
      </div>
    `);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('paragraph');
  });

  it('should skip button-only containers', () => {
    const blocks = extract(`
      <p>Content</p>
      <div><button aria-label="Copy">Copy</button></div>
    `);
    // The div with only a button and no content elements should be skipped
    expect(blocks.filter(b => b.type === 'paragraph')).toHaveLength(1);
  });
});

// ===== getCleanHtmlWithMathML tests =====

describe('getCleanHtmlWithMathML', () => {
  it('should replace KaTeX elements with MathML', () => {
    const msg = makeMessage(`
      <p>
        <span class="katex">
          <span class="katex-mathml">
            <math xmlns="http://www.w3.org/1998/Math/MathML">
              <semantics>
                <mrow><mi>x</mi></mrow>
                <annotation encoding="application/x-tex">x</annotation>
              </semantics>
            </math>
          </span>
          <span class="katex-html"><span class="mord">x</span></span>
        </span>
      </p>
    `);
    const html = getCleanHtmlWithMathML(msg);
    msg.remove();

    // Should contain MathML math element
    expect(html).toContain('<math');
    // Should NOT contain katex-html visual rendering
    expect(html).not.toMatch(/class="katex-html"/);
  });

  it('should remove interactive elements from HTML', () => {
    const msg = makeMessage(`
      <p>Content</p>
      <div class="sticky"><button aria-label="Copy">Copy</button></div>
      <div class="cgpt-word-copier-buttons"><button>DOCX</button></div>
    `);
    const html = getCleanHtmlWithMathML(msg);
    msg.remove();

    expect(html).toContain('Content');
    expect(html).not.toContain('Copy');
    expect(html).not.toContain('DOCX');
  });

  it('should remove buttons with aria-label', () => {
    const msg = makeMessage(`
      <div>
        <p>Real content</p>
        <button aria-label="Копировать таблицу">Copy Table</button>
      </div>
    `);
    const html = getCleanHtmlWithMathML(msg);
    msg.remove();

    expect(html).toContain('Real content');
    expect(html).not.toContain('Копировать таблицу');
    // NOTE: button text might still be present briefly if aria-label removal doesn't cover it
  });
});

// ===== getMarkdownContent tests =====

describe('getMarkdownContent', () => {
  it('should find .markdown.prose element', () => {
    const msg = document.createElement('div');
    const inner = document.createElement('div');
    inner.classList.add('markdown', 'prose');
    inner.textContent = 'Content';
    msg.appendChild(inner);
    
    const result = getMarkdownContent(msg);
    expect(result.textContent).toBe('Content');
  });

  it('should fallback to the element itself if no markdown container found', () => {
    const msg = document.createElement('div');
    msg.textContent = 'Fallback';
    
    const result = getMarkdownContent(msg);
    expect(result.textContent).toBe('Fallback');
  });
});

// ===== Mixed content test =====

describe('DOM Extractor - Complex Document', () => {
  it('should extract a ChatGPT-like document with headings, text, tables, and math', () => {
    const blocks = extract(`
      <h3>8. Сравнительный анализ</h3>
      <p>Цель раздела — свести таксономию к профилю.</p>
      <p><strong>Таблица 5.</strong></p>
      <div class="TyagGW_tableContainer">
        <div class="TyagGW_tableWrapper">
          <table>
            <thead><tr><th>Метрика</th><th>Значение</th></tr></thead>
            <tbody><tr><td>Accuracy</td><td>0.95</td></tr></tbody>
          </table>
          <div class="sticky h-0 select-none">
            <div class="absolute end-0">
              <button aria-label="Копировать таблицу">Copy</button>
            </div>
          </div>
        </div>
      </div>
      <p><strong>Итог.</strong> Всего 4 элемента.</p>
    `);

    // h3
    expect(blocks[0].type).toBe('heading');
    expect(blocks[0].level).toBe(3);

    // paragraph
    expect(blocks[1].type).toBe('paragraph');

    // table caption
    expect(blocks[2].type).toBe('paragraph');
    expect(blocks[2].content[0].type).toBe('bold');

    // table (extracted from div wrapper)
    expect(blocks[3].type).toBe('table');
    expect(blocks[3].rows).toHaveLength(2);
    expect(blocks[3].rows[0].cells[0].text).toBe('Метрика');

    // closing paragraph
    expect(blocks[4].type).toBe('paragraph');
    expect(blocks[4].content[0].type).toBe('bold');
  });
});
