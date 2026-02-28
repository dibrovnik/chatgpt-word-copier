/**
 * Tests for DOCX Builder
 */
import { describe, it, expect } from 'vitest';
import { buildDocx } from '../src/lib/docx-builder.js';
import JSZip from 'jszip';

// Helper to extract file from docx blob
async function extractDocxFile(blob, path) {
  const arrayBuffer = await blob.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);
  const file = zip.file(path);
  if (!file) return null;
  return await file.async('string');
}

// Helper to get list of files in docx
async function listDocxFiles(blob) {
  const arrayBuffer = await blob.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);
  return Object.keys(zip.files);
}

// ===== DOCX Structure Tests =====

describe('DOCX Builder - File Structure', () => {
  it('should create a valid ZIP blob', async () => {
    const blocks = [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }];
    const blob = await buildDocx(blocks);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  });

  it('should contain all required OOXML files', async () => {
    const blocks = [{ type: 'paragraph', content: [{ type: 'text', text: 'Test' }] }];
    const blob = await buildDocx(blocks);
    const files = await listDocxFiles(blob);

    const requiredFiles = [
      '[Content_Types].xml',
      '_rels/.rels',
      'word/document.xml',
      'word/styles.xml',
      'word/settings.xml',
      'word/fontTable.xml',
      'word/numbering.xml',
      'word/_rels/document.xml.rels',
      'docProps/app.xml',
      'docProps/core.xml',
    ];

    for (const req of requiredFiles) {
      expect(files).toContain(req);
    }
  });

  it('should produce valid XML in [Content_Types].xml', async () => {
    const blocks = [{ type: 'paragraph', content: [{ type: 'text', text: 'Test' }] }];
    const blob = await buildDocx(blocks);
    const xml = await extractDocxFile(blob, '[Content_Types].xml');
    expect(xml).toContain('<?xml version="1.0"');
    expect(xml).toContain('ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"');
    expect(xml).toContain('numbering+xml');
  });

  it('should have numbering relationship in document.xml.rels', async () => {
    const blocks = [{ type: 'paragraph', content: [{ type: 'text', text: 'Test' }] }];
    const blob = await buildDocx(blocks);
    const xml = await extractDocxFile(blob, 'word/_rels/document.xml.rels');
    expect(xml).toContain('numbering');
    expect(xml).toContain('numbering.xml');
  });
});

// ===== DOCX Content Tests =====

describe('DOCX Builder - Content', () => {
  it('should render a simple paragraph', async () => {
    const blocks = [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello World' }] }];
    const blob = await buildDocx(blocks);
    const xml = await extractDocxFile(blob, 'word/document.xml');
    expect(xml).toContain('<w:t xml:space="preserve">Hello World</w:t>');
  });

  it('should render headings with correct styles', async () => {
    const blocks = [
      { type: 'heading', level: 1, content: [{ type: 'text', text: 'Title' }] },
      { type: 'heading', level: 2, content: [{ type: 'text', text: 'Subtitle' }] },
      { type: 'heading', level: 3, content: [{ type: 'text', text: 'Section' }] },
    ];
    const blob = await buildDocx(blocks);
    const xml = await extractDocxFile(blob, 'word/document.xml');
    expect(xml).toContain('<w:pStyle w:val="Heading1"/>');
    expect(xml).toContain('<w:pStyle w:val="Heading2"/>');
    expect(xml).toContain('<w:pStyle w:val="Heading3"/>');
  });

  it('should render bold and italic text', async () => {
    const blocks = [{
      type: 'paragraph',
      content: [
        { type: 'bold', content: [{ type: 'text', text: 'bold text' }] },
        { type: 'italic', content: [{ type: 'text', text: 'italic text' }] },
      ],
    }];
    const blob = await buildDocx(blocks);
    const xml = await extractDocxFile(blob, 'word/document.xml');
    expect(xml).toContain('<w:b/>');
    expect(xml).toContain('<w:i/>');
    expect(xml).toContain('bold text');
    expect(xml).toContain('italic text');
  });

  it('should render inline code with Consolas font', async () => {
    const blocks = [{
      type: 'paragraph',
      content: [{ type: 'code', text: 'console.log()' }],
    }];
    const blob = await buildDocx(blocks);
    const xml = await extractDocxFile(blob, 'word/document.xml');
    expect(xml).toContain('Consolas');
    expect(xml).toContain('console.log()');
  });

  it('should render a table with headers and cells', async () => {
    const blocks = [{
      type: 'table',
      rows: [
        { isHeader: true, cells: [
          { content: [{ type: 'text', text: 'Col1' }] },
          { content: [{ type: 'text', text: 'Col2' }] },
        ]},
        { isHeader: false, cells: [
          { content: [{ type: 'text', text: 'A' }] },
          { content: [{ type: 'text', text: 'B' }] },
        ]},
      ],
    }];
    const blob = await buildDocx(blocks);
    const xml = await extractDocxFile(blob, 'word/document.xml');
    expect(xml).toContain('<w:tbl>');
    expect(xml).toContain('<w:tc>');
    expect(xml).toContain('Col1');
    expect(xml).toContain('Col2');
    expect(xml).toContain('<w:b/>'); // Header bold
  });

  it('should render an unordered list with numId=1', async () => {
    const blocks = [{
      type: 'list',
      ordered: false,
      items: [
        { content: [{ type: 'text', text: 'Item 1' }] },
        { content: [{ type: 'text', text: 'Item 2' }] },
      ],
    }];
    const blob = await buildDocx(blocks);
    const xml = await extractDocxFile(blob, 'word/document.xml');
    expect(xml).toContain('<w:numId w:val="1"/>');
    expect(xml).toContain('Item 1');
    expect(xml).toContain('Item 2');
  });

  it('should render an ordered list with numId=2', async () => {
    const blocks = [{
      type: 'list',
      ordered: true,
      items: [
        { content: [{ type: 'text', text: 'First' }] },
        { content: [{ type: 'text', text: 'Second' }] },
      ],
    }];
    const blob = await buildDocx(blocks);
    const xml = await extractDocxFile(blob, 'word/document.xml');
    expect(xml).toContain('<w:numId w:val="2"/>');
  });

  it('should render a code block', async () => {
    const blocks = [{
      type: 'codeBlock',
      language: 'python',
      code: 'print("hello")\nx = 1',
    }];
    const blob = await buildDocx(blocks);
    const xml = await extractDocxFile(blob, 'word/document.xml');
    expect(xml).toContain('python');
    expect(xml).toContain('print(&quot;hello&quot;)');
    expect(xml).toContain('x = 1');
  });

  it('should render a blockquote', async () => {
    const blocks = [{
      type: 'blockquote',
      content: [{ type: 'text', text: 'Quote text' }],
    }];
    const blob = await buildDocx(blocks);
    const xml = await extractDocxFile(blob, 'word/document.xml');
    expect(xml).toContain('Quote text');
    expect(xml).toContain('<w:pBdr>');
  });

  it('should render a horizontal rule', async () => {
    const blocks = [{ type: 'hr' }];
    const blob = await buildDocx(blocks);
    const xml = await extractDocxFile(blob, 'word/document.xml');
    expect(xml).toContain('<w:pBdr>');
    expect(xml).toContain('<w:bottom');
  });

  it('should escape XML special chars in text content', async () => {
    const blocks = [{
      type: 'paragraph',
      content: [{ type: 'text', text: 'a < b & c > d "e"' }],
    }];
    const blob = await buildDocx(blocks);
    const xml = await extractDocxFile(blob, 'word/document.xml');
    expect(xml).toContain('a &lt; b &amp; c &gt; d &quot;e&quot;');
  });
});

// ===== DOCX Math Tests =====

describe('DOCX Builder - Math/OMML', () => {
  it('should render inline math as OMML', async () => {
    const blocks = [{
      type: 'paragraph',
      content: [{
        type: 'math',
        display: false,
        latex: 'x^2',
        mathml: '<math xmlns="http://www.w3.org/1998/Math/MathML"><msup><mi>x</mi><mn>2</mn></msup></math>',
      }],
    }];
    const blob = await buildDocx(blocks, { mathMode: 'omml' });
    const xml = await extractDocxFile(blob, 'word/document.xml');
    expect(xml).toContain('<m:oMath>');
    expect(xml).toContain('<m:sSup>');
  });

  it('should render display math block as OMML', async () => {
    const blocks = [{
      type: 'math',
      display: true,
      latex: '\\frac{a}{b}',
      mathml: '<math xmlns="http://www.w3.org/1998/Math/MathML"><mfrac><mi>a</mi><mi>b</mi></mfrac></math>',
    }];
    const blob = await buildDocx(blocks, { mathMode: 'omml' });
    const xml = await extractDocxFile(blob, 'word/document.xml');
    expect(xml).toContain('<m:f>');
    expect(xml).toContain('<m:num>');
    expect(xml).toContain('<m:den>');
  });

  it('should render math with fallback LaTeX when mathml is missing', async () => {
    const blocks = [{
      type: 'math',
      display: true,
      latex: '\\frac{a}{b}',
      mathml: '',
    }];
    const blob = await buildDocx(blocks, { mathMode: 'omml' });
    const xml = await extractDocxFile(blob, 'word/document.xml');
    expect(xml).toContain('<m:f>');
  });

  it('should render math as styled text when mathMode is not omml', async () => {
    const blocks = [{
      type: 'paragraph',
      content: [{
        type: 'math',
        display: false,
        latex: 'x^2',
        mathml: '<math xmlns="http://www.w3.org/1998/Math/MathML"><msup><mi>x</mi><mn>2</mn></msup></math>',
      }],
    }];
    const blob = await buildDocx(blocks, { mathMode: 'text' });
    const xml = await extractDocxFile(blob, 'word/document.xml');
    expect(xml).toContain('Cambria Math');
    expect(xml).toContain('x^2');
    expect(xml).not.toContain('<m:oMath>');
  });

  it('should render table with math in cells', async () => {
    const blocks = [{
      type: 'table',
      rows: [
        { isHeader: true, cells: [
          {
            content: [
              { type: 'math', display: false, latex: 'S', mathml: '<math xmlns="http://www.w3.org/1998/Math/MathML"><mi>S</mi></math>' },
              { type: 'text', text: ' (Auth)' },
            ],
          },
        ]},
        { isHeader: false, cells: [
          { content: [{ type: 'text', text: '++' }] },
        ]},
      ],
    }];
    const blob = await buildDocx(blocks, { mathMode: 'omml' });
    const xml = await extractDocxFile(blob, 'word/document.xml');
    expect(xml).toContain('<w:tbl>');
    expect(xml).toContain('<m:oMath>');
    expect(xml).toContain('<m:t>S</m:t>');
    expect(xml).toContain('(Auth)');
  });
});

// ===== DOCX Numbering Tests =====

describe('DOCX Builder - Numbering', () => {
  it('should produce valid numbering.xml with abstractNum definitions', async () => {
    const blocks = [{
      type: 'list',
      ordered: false,
      items: [{ content: [{ type: 'text', text: 'item' }] }],
    }];
    const blob = await buildDocx(blocks);
    const xml = await extractDocxFile(blob, 'word/numbering.xml');
    expect(xml).not.toBeNull();
    expect(xml).toContain('abstractNumId="0"');
    expect(xml).toContain('abstractNumId="1"');
    expect(xml).toContain('<w:num w:numId="1">');
    expect(xml).toContain('<w:num w:numId="2">');
    expect(xml).toContain('w:numFmt w:val="bullet"');
    expect(xml).toContain('w:numFmt w:val="decimal"');
  });

  it('should have 9 levels (ilvl 0-8) for bullet list', async () => {
    const blocks = [{ type: 'paragraph', content: [{ type: 'text', text: 'test' }] }];
    const blob = await buildDocx(blocks);
    const xml = await extractDocxFile(blob, 'word/numbering.xml');
    for (let i = 0; i <= 8; i++) {
      expect(xml).toContain(`w:ilvl="${i}"`);
    }
  });
});

// ===== DOCX Styles Tests =====

describe('DOCX Builder - Styles', () => {
  it('should define heading styles (1-6)', async () => {
    const blocks = [{ type: 'paragraph', content: [{ type: 'text', text: 'test' }] }];
    const blob = await buildDocx(blocks);
    const xml = await extractDocxFile(blob, 'word/styles.xml');
    expect(xml).toContain('styleId="Heading1"');
    expect(xml).toContain('styleId="Heading2"');
    expect(xml).toContain('styleId="Heading3"');
    expect(xml).toContain('styleId="Heading4"');
    expect(xml).toContain('styleId="Heading5"');
    expect(xml).toContain('styleId="Heading6"');
  });

  it('should define ListParagraph and CodeBlock styles', async () => {
    const blocks = [{ type: 'paragraph', content: [{ type: 'text', text: 'test' }] }];
    const blob = await buildDocx(blocks);
    const xml = await extractDocxFile(blob, 'word/styles.xml');
    expect(xml).toContain('styleId="ListParagraph"');
    expect(xml).toContain('styleId="CodeBlock"');
    expect(xml).toContain('styleId="TableGrid"');
    expect(xml).toContain('styleId="TableNormal"');
  });

  it('should have Cambria Math in math settings', async () => {
    const blocks = [{ type: 'paragraph', content: [{ type: 'text', text: 'test' }] }];
    const blob = await buildDocx(blocks);
    const xml = await extractDocxFile(blob, 'word/settings.xml');
    expect(xml).toContain('Cambria Math');
    expect(xml).toContain('m:mathPr');
  });
});
