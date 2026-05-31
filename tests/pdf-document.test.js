import { describe, expect, it } from 'vitest';
import {
  buildPdfDocumentDefinition,
  cleanContentForPdf,
} from '../src/lib/pdf-document.js';

function makeContent(html) {
  const content = document.createElement('div');
  content.innerHTML = html;
  return content;
}

describe('cleanContentForPdf', () => {
  it('removes ChatGPT controls and keeps readable math and image fallbacks', () => {
    const content = makeContent(`
      <button>Copy</button>
      <span class="katex">
        <span class="katex-mathml">
          <math><semantics><annotation encoding="application/x-tex">x^2</annotation></semantics></math>
        </span>
        <span class="katex-html">duplicated visual math</span>
      </span>
      <img src="https://example.com/remote.png" alt="diagram">
      <img src="data:image/png;base64,AAAA" alt="embedded">
    `);

    const cleanHtml = cleanContentForPdf(content, { normalizeForPdfmake: true });

    expect(cleanHtml).not.toContain('<button');
    expect(cleanHtml).not.toContain('duplicated visual math');
    expect(cleanHtml).toContain('<span class="cgpt-pdf-math">x^2</span>');
    expect(cleanHtml).toContain('[Image: diagram]');
    expect(cleanHtml).toContain('data:image/png;base64,AAAA');
  });
});

describe('buildPdfDocumentDefinition', () => {
  it('builds text-based lists, code blocks, and tables for pdfmake', () => {
    const content = makeContent(`
      <h2>Instructions</h2>
      <ol>
        <li>First</li>
        <li>Second<ul><li>Nested</li></ul></li>
      </ol>
      <pre><code>echo test
next line</code></pre>
      <table>
        <thead><tr><th>Name</th><th>Value</th></tr></thead>
        <tbody><tr><td>One</td><td>Two</td></tr></tbody>
      </table>
    `);

    const definition = buildPdfDocumentDefinition(content, window);
    const list = definition.content.find((node) => node.nodeName === 'OL');
    const code = definition.content.find((node) => node.nodeName === 'PRE');
    const table = definition.content.find((node) => node.nodeName === 'TABLE');

    expect(definition.pageSize).toBe('A4');
    expect(list.ol).toHaveLength(2);
    expect(list.ol[1].stack[1].ul[0].text).toBe('Nested');
    expect(code.table.body[0][0].text[0].text).toContain('echo test\nnext line');
    expect(code.table.body[0][0].preserveLeadingSpaces).toBe(true);
    expect(table.table.headerRows).toBe(1);
    expect(table.layout).toBe('lightHorizontalLines');
  });
});
