/**
 * DOCX Builder - creates .docx files from structured content.
 * Uses JSZip to package the OOXML structure.
 * 
 * Supports:
 * - Text with formatting (bold, italic, code)
 * - Headings (h1-h6)
 * - Tables
 * - Lists (ordered and unordered)
 * - Code blocks
 * - Math formulas (via OMML)
 * - Blockquotes
 * - Images
 */

import JSZip from 'jszip';
import { mathmlToOmml, latexToOmml, escapeXml } from './mathml-to-omml';

// OOXML Namespaces
const NS = {
  w: 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
  r: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
  m: 'http://schemas.openxmlformats.org/officeDocument/2006/math',
  wp: 'http://schemas.openxmlformats.org/drawingDocument/2006/wordprocessingDrawing',
  a: 'http://schemas.openxmlformats.org/drawingml/2006/main',
  pic: 'http://schemas.openxmlformats.org/drawingml/2006/picture',
  mc: 'http://schemas.openxmlformats.org/markup-compatibility/2006',
};

/**
 * Build a DOCX file from structured content blocks
 * @param {Array} blocks - Array of content blocks from dom-extractor
 * @param {Object} options - Build options
 * @returns {Promise<Blob>} - DOCX file as blob
 */
export async function buildDocx(blocks, options = {}) {
  const { title = 'ChatGPT Response', mathMode = 'omml' } = options;
  const images = []; // Will collect image data
  const relationships = [];

  // Build document body XML
  let bodyContent = '';

  for (const block of blocks) {
    bodyContent += buildBlock(block, { mathMode, images, relationships });
  }

  // Create ZIP structure
  const zip = new JSZip();

  // [Content_Types].xml
  zip.file('[Content_Types].xml', generateContentTypes(images));

  // _rels/.rels
  zip.file('_rels/.rels', generateRootRels());

  // word/document.xml
  zip.file('word/document.xml', generateDocumentXml(bodyContent));

  // word/styles.xml
  zip.file('word/styles.xml', generateStyles());

  // word/settings.xml
  zip.file('word/settings.xml', generateSettings());

  // word/fontTable.xml
  zip.file('word/fontTable.xml', generateFontTable());

  // word/_rels/document.xml.rels
  zip.file('word/_rels/document.xml.rels', generateDocumentRels(relationships));

  // docProps/app.xml
  zip.file('docProps/app.xml', generateAppProps(title));

  // docProps/core.xml
  zip.file('docProps/core.xml', generateCoreProps(title));

  // Add images
  for (const img of images) {
    zip.file(`word/media/${img.filename}`, img.data);
  }

  // Generate blob
  const blob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  return blob;
}

/**
 * Build a single content block
 */
function buildBlock(block, ctx) {
  switch (block.type) {
    case 'heading': return buildHeading(block, ctx);
    case 'paragraph': return buildParagraph(block, ctx);
    case 'list': return buildList(block, ctx);
    case 'table': return buildTable(block, ctx);
    case 'codeBlock': return buildCodeBlock(block, ctx);
    case 'math': return buildMathBlock(block, ctx);
    case 'blockquote': return buildBlockquote(block, ctx);
    case 'hr': return buildHorizontalRule();
    default: return '';
  }
}

/**
 * Build a heading
 */
function buildHeading(block, ctx) {
  const level = Math.min(block.level, 6);
  const styleId = `Heading${level}`;
  const runs = buildInlineRuns(block.content, ctx);
  return `<w:p><w:pPr><w:pStyle w:val="${styleId}"/></w:pPr>${runs}</w:p>`;
}

/**
 * Build a paragraph
 */
function buildParagraph(block, ctx) {
  const runs = buildInlineRuns(block.content, ctx);
  if (!runs) return '';
  return `<w:p>${runs}</w:p>`;
}

/**
 * Build inline content runs
 */
function buildInlineRuns(contentItems, ctx) {
  if (!contentItems || contentItems.length === 0) return '';
  let result = '';

  for (const item of contentItems) {
    switch (item.type) {
      case 'text':
        result += buildTextRun(item.text);
        break;
      case 'bold':
        result += buildFormattedRuns(item.content, { bold: true }, ctx);
        break;
      case 'italic':
        result += buildFormattedRuns(item.content, { italic: true }, ctx);
        break;
      case 'code':
        result += buildCodeRun(item.text);
        break;
      case 'link':
        result += buildLinkRun(item.text, item.href);
        break;
      case 'superscript':
        result += buildVertAlignRun(item.text, 'superscript');
        break;
      case 'subscript':
        result += buildVertAlignRun(item.text, 'subscript');
        break;
      case 'math':
        result += buildInlineMath(item, ctx);
        break;
      default:
        if (item.text) result += buildTextRun(item.text);
    }
  }

  return result;
}

/**
 * Build formatted runs (bold, italic, etc.)
 */
function buildFormattedRuns(contentItems, format, ctx) {
  if (!contentItems) return '';
  let result = '';
  for (const item of contentItems) {
    if (item.type === 'text') {
      let rPr = '<w:rPr>';
      if (format.bold) rPr += '<w:b/>';
      if (format.italic) rPr += '<w:i/>';
      rPr += '</w:rPr>';
      result += `<w:r>${rPr}<w:t xml:space="preserve">${escapeXml(item.text)}</w:t></w:r>`;
    } else if (item.type === 'code') {
      result += buildCodeRun(item.text);
    } else if (item.type === 'math') {
      result += buildInlineMath(item, ctx);
    } else if (item.type === 'bold') {
      result += buildFormattedRuns(item.content, { ...format, bold: true }, ctx);
    } else if (item.type === 'italic') {
      result += buildFormattedRuns(item.content, { ...format, italic: true }, ctx);
    } else {
      result += buildInlineRuns([item], ctx);
    }
  }
  return result;
}

/**
 * Build a plain text run
 */
function buildTextRun(text) {
  if (!text) return '';
  return `<w:r><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
}

/**
 * Build a code-formatted run
 */
function buildCodeRun(text) {
  return `<w:r><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:cs="Consolas"/><w:sz w:val="20"/><w:szCs w:val="20"/><w:shd w:val="clear" w:color="auto" w:fill="F5F5F5"/></w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
}

/**
 * Build a hyperlink run
 */
function buildLinkRun(text, href) {
  // Simplified: just show text with link styling
  return `<w:r><w:rPr><w:rStyle w:val="Hyperlink"/><w:color w:val="0563C1"/><w:u w:val="single"/></w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
}

/**
 * Build superscript/subscript run
 */
function buildVertAlignRun(text, align) {
  return `<w:r><w:rPr><w:vertAlign w:val="${align}"/></w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
}

/**
 * Build inline math
 */
function buildInlineMath(item, ctx) {
  if (ctx.mathMode === 'omml') {
    if (item.mathml) {
      return mathmlToOmml(item.mathml);
    } else if (item.latex) {
      return latexToOmml(item.latex, false);
    }
  }
  // Fallback: render as styled text
  const text = item.latex || 'formula';
  return `<w:r><w:rPr><w:rFonts w:ascii="Cambria Math" w:hAnsi="Cambria Math"/><w:i/></w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
}

/**
 * Build a display math block
 */
function buildMathBlock(block, ctx) {
  if (ctx.mathMode === 'omml') {
    let omml;
    if (block.mathml) {
      omml = mathmlToOmml(block.mathml);
    } else if (block.latex) {
      omml = latexToOmml(block.latex, true);
    } else {
      return '';
    }
    // Wrap in paragraph with math
    return `<w:p><w:pPr><w:jc w:val="center"/></w:pPr>${omml}</w:p>`;
  }

  // Fallback: LaTeX as styled text
  const text = block.latex || 'formula';
  return `<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Cambria Math" w:hAnsi="Cambria Math"/><w:i/></w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;
}

/**
 * Build a list
 */
function buildList(block, ctx, level = 0) {
  let result = '';
  const numId = block.ordered ? 2 : 1;

  for (let i = 0; i < block.items.length; i++) {
    const item = block.items[i];
    const runs = buildInlineRuns(item.content, ctx);

    result += `<w:p><w:pPr><w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="${level}"/><w:numId w:val="${numId}"/></w:numPr></w:pPr>${runs}</w:p>`;

    // Handle nested list
    if (item.nestedList) {
      result += buildList(item.nestedList, ctx, level + 1);
    }
  }

  return result;
}

/**
 * Build a table
 */
function buildTable(block, ctx) {
  let result = '<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="0" w:type="auto"/><w:tblBorders>';
  result += '<w:top w:val="single" w:sz="4" w:space="0" w:color="999999"/>';
  result += '<w:left w:val="single" w:sz="4" w:space="0" w:color="999999"/>';
  result += '<w:bottom w:val="single" w:sz="4" w:space="0" w:color="999999"/>';
  result += '<w:right w:val="single" w:sz="4" w:space="0" w:color="999999"/>';
  result += '<w:insideH w:val="single" w:sz="4" w:space="0" w:color="999999"/>';
  result += '<w:insideV w:val="single" w:sz="4" w:space="0" w:color="999999"/>';
  result += '</w:tblBorders><w:tblLook w:val="04A0"/></w:tblPr>';

  // Grid columns
  if (block.rows.length > 0) {
    const colCount = block.rows[0].cells.length;
    result += '<w:tblGrid>';
    for (let i = 0; i < colCount; i++) {
      result += `<w:gridCol w:w="${Math.floor(9000 / colCount)}"/>`;
    }
    result += '</w:tblGrid>';
  }

  for (const row of block.rows) {
    result += '<w:tr>';
    for (const cell of row.cells) {
      result += '<w:tc><w:tcPr>';
      if (row.isHeader) {
        result += '<w:shd w:val="clear" w:color="auto" w:fill="F0F0F0"/>';
      }
      result += '</w:tcPr>';
      const runs = buildInlineRuns(cell.content, ctx);
      result += `<w:p>${row.isHeader ? '<w:pPr><w:rPr><w:b/></w:rPr></w:pPr>' : ''}${runs}</w:p>`;
      result += '</w:tc>';
    }
    result += '</w:tr>';
  }

  result += '</w:tbl>';
  // Add spacing after table
  result += '<w:p><w:pPr><w:spacing w:after="120"/></w:pPr></w:p>';
  return result;
}

/**
 * Build a code block
 */
function buildCodeBlock(block, ctx) {
  const lines = (block.code || '').split('\n');
  let result = '';

  // Language label
  if (block.language) {
    result += `<w:p><w:pPr><w:shd w:val="clear" w:color="auto" w:fill="E8E8E8"/><w:spacing w:after="0"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:sz w:val="18"/><w:color w:val="666666"/></w:rPr><w:t>${escapeXml(block.language)}</w:t></w:r></w:p>`;
  }

  for (const line of lines) {
    result += `<w:p><w:pPr><w:pStyle w:val="CodeBlock"/><w:shd w:val="clear" w:color="auto" w:fill="F8F8F8"/><w:spacing w:after="0" w:line="260" w:lineRule="auto"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:cs="Consolas"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r></w:p>`;
  }

  // Spacing after code block
  result += '<w:p><w:pPr><w:spacing w:after="120"/></w:pPr></w:p>';
  return result;
}

/**
 * Build a blockquote
 */
function buildBlockquote(block, ctx) {
  const runs = buildInlineRuns(block.content, ctx);
  return `<w:p><w:pPr><w:pBdr><w:left w:val="single" w:sz="12" w:space="4" w:color="CCCCCC"/></w:pBdr><w:ind w:left="360"/><w:rPr><w:color w:val="666666"/><w:i/></w:rPr></w:pPr>${runs}</w:p>`;
}

/**
 * Build a horizontal rule
 */
function buildHorizontalRule() {
  return `<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="CCCCCC"/></w:pBdr><w:spacing w:after="120"/></w:pPr></w:p>`;
}

// ===== XML Template Generators =====

function generateContentTypes(images) {
  let imageTypes = '';
  const addedExtensions = new Set();
  for (const img of images) {
    const ext = img.filename.split('.').pop();
    if (!addedExtensions.has(ext)) {
      addedExtensions.add(ext);
      imageTypes += `<Default Extension="${ext}" ContentType="image/${ext === 'jpg' ? 'jpeg' : ext}"/>`;
    }
  }

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  ${imageTypes}
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>
  <Override PartName="/word/fontTable.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.fontTable+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`;
}

function generateRootRels() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;
}

function generateDocumentXml(bodyContent) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document
  xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"
  xmlns:v="urn:schemas-microsoft-com:vml"
  xmlns:wp="http://schemas.openxmlformats.org/drawingDocument/2006/wordprocessingDrawing"
  xmlns:w10="urn:schemas-microsoft-com:office:word"
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"
  xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup"
  xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk"
  xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml"
  xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"
  mc:Ignorable="w14 wp14">
  <w:body>
    ${bodyContent}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>
      <w:cols w:space="720"/>
    </w:sectPr>
  </w:body>
</w:document>`;
}

function generateStyles() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
          xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
          mc:Ignorable="w14">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Calibri" w:eastAsia="Calibri" w:hAnsi="Calibri" w:cs="Times New Roman"/>
        <w:sz w:val="22"/>
        <w:szCs w:val="22"/>
        <w:lang w:val="ru-RU" w:eastAsia="en-US" w:bidi="ar-SA"/>
      </w:rPr>
    </w:rPrDefault>
    <w:pPrDefault>
      <w:pPr>
        <w:spacing w:after="160" w:line="276" w:lineRule="auto"/>
      </w:pPr>
    </w:pPrDefault>
  </w:docDefaults>
  
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:qFormat/>
  </w:style>
  
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:qFormat/>
    <w:pPr>
      <w:keepNext/>
      <w:spacing w:before="360" w:after="120"/>
    </w:pPr>
    <w:rPr>
      <w:rFonts w:ascii="Calibri Light" w:hAnsi="Calibri Light"/>
      <w:b/>
      <w:color w:val="2F5496"/>
      <w:sz w:val="40"/>
      <w:szCs w:val="40"/>
    </w:rPr>
  </w:style>
  
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:qFormat/>
    <w:pPr>
      <w:keepNext/>
      <w:spacing w:before="240" w:after="80"/>
    </w:pPr>
    <w:rPr>
      <w:rFonts w:ascii="Calibri Light" w:hAnsi="Calibri Light"/>
      <w:b/>
      <w:color w:val="2F5496"/>
      <w:sz w:val="32"/>
      <w:szCs w:val="32"/>
    </w:rPr>
  </w:style>
  
  <w:style w:type="paragraph" w:styleId="Heading3">
    <w:name w:val="heading 3"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:qFormat/>
    <w:pPr>
      <w:keepNext/>
      <w:spacing w:before="200" w:after="60"/>
    </w:pPr>
    <w:rPr>
      <w:rFonts w:ascii="Calibri Light" w:hAnsi="Calibri Light"/>
      <w:b/>
      <w:color w:val="2F5496"/>
      <w:sz w:val="28"/>
      <w:szCs w:val="28"/>
    </w:rPr>
  </w:style>
  
  <w:style w:type="paragraph" w:styleId="Heading4">
    <w:name w:val="heading 4"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:qFormat/>
    <w:pPr>
      <w:keepNext/>
      <w:spacing w:before="160" w:after="40"/>
    </w:pPr>
    <w:rPr>
      <w:b/>
      <w:i/>
      <w:color w:val="2F5496"/>
      <w:sz w:val="24"/>
      <w:szCs w:val="24"/>
    </w:rPr>
  </w:style>

  <w:style w:type="paragraph" w:styleId="Heading5">
    <w:name w:val="heading 5"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:qFormat/>
    <w:pPr><w:keepNext/><w:spacing w:before="120" w:after="40"/></w:pPr>
    <w:rPr><w:b/><w:color w:val="2F5496"/></w:rPr>
  </w:style>

  <w:style w:type="paragraph" w:styleId="Heading6">
    <w:name w:val="heading 6"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:qFormat/>
    <w:pPr><w:keepNext/><w:spacing w:before="120" w:after="40"/></w:pPr>
    <w:rPr><w:b/><w:i/><w:color w:val="595959"/></w:rPr>
  </w:style>
  
  <w:style w:type="paragraph" w:styleId="ListParagraph">
    <w:name w:val="List Paragraph"/>
    <w:basedOn w:val="Normal"/>
    <w:qFormat/>
    <w:pPr>
      <w:ind w:left="720"/>
    </w:pPr>
  </w:style>
  
  <w:style w:type="paragraph" w:styleId="CodeBlock">
    <w:name w:val="Code Block"/>
    <w:basedOn w:val="Normal"/>
    <w:pPr>
      <w:spacing w:after="0" w:line="260" w:lineRule="auto"/>
      <w:shd w:val="clear" w:color="auto" w:fill="F8F8F8"/>
    </w:pPr>
    <w:rPr>
      <w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:cs="Consolas"/>
      <w:sz w:val="20"/>
      <w:szCs w:val="20"/>
    </w:rPr>
  </w:style>
  
  <w:style w:type="table" w:styleId="TableGrid">
    <w:name w:val="Table Grid"/>
    <w:basedOn w:val="TableNormal"/>
    <w:tblPr>
      <w:tblBorders>
        <w:top w:val="single" w:sz="4" w:space="0" w:color="auto"/>
        <w:left w:val="single" w:sz="4" w:space="0" w:color="auto"/>
        <w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/>
        <w:right w:val="single" w:sz="4" w:space="0" w:color="auto"/>
        <w:insideH w:val="single" w:sz="4" w:space="0" w:color="auto"/>
        <w:insideV w:val="single" w:sz="4" w:space="0" w:color="auto"/>
      </w:tblBorders>
    </w:tblPr>
  </w:style>

  <w:style w:type="table" w:default="1" w:styleId="TableNormal">
    <w:name w:val="Normal Table"/>
    <w:tblPr>
      <w:tblInd w:w="0" w:type="dxa"/>
      <w:tblCellMar>
        <w:top w:w="0" w:type="dxa"/>
        <w:left w:w="108" w:type="dxa"/>
        <w:bottom w:w="0" w:type="dxa"/>
        <w:right w:w="108" w:type="dxa"/>
      </w:tblCellMar>
    </w:tblPr>
  </w:style>

  <w:style w:type="character" w:styleId="Hyperlink">
    <w:name w:val="Hyperlink"/>
    <w:rPr>
      <w:color w:val="0563C1"/>
      <w:u w:val="single"/>
    </w:rPr>
  </w:style>
</w:styles>`;
}

function generateSettings() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"
            xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
            mc:Ignorable="w14">
  <w:zoom w:percent="100"/>
  <w:defaultTabStop w:val="720"/>
  <m:mathPr>
    <m:mathFont m:val="Cambria Math"/>
    <m:brkBin m:val="before"/>
    <m:brkBinSub m:val="--"/>
    <m:smallFrac m:val="0"/>
    <m:dispDef/>
    <m:lMargin m:val="0"/>
    <m:rMargin m:val="0"/>
    <m:defJc m:val="centerGroup"/>
    <m:wrapIndent m:val="1440"/>
    <m:intLim m:val="subSup"/>
    <m:naryLim m:val="undOvr"/>
  </m:mathPr>
  <w:characterSpacingControl w:val="doNotCompress"/>
  <w:compat>
    <w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/>
  </w:compat>
</w:settings>`;
}

function generateFontTable() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:fonts xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:font w:name="Calibri">
    <w:panose1 w:val="020F0502020204030204"/>
    <w:charset w:val="CC"/>
    <w:family w:val="swiss"/>
    <w:pitch w:val="variable"/>
  </w:font>
  <w:font w:name="Calibri Light">
    <w:panose1 w:val="020F0302020204030204"/>
    <w:charset w:val="CC"/>
    <w:family w:val="swiss"/>
    <w:pitch w:val="variable"/>
  </w:font>
  <w:font w:name="Times New Roman">
    <w:panose1 w:val="02020603050405020304"/>
    <w:charset w:val="CC"/>
    <w:family w:val="roman"/>
    <w:pitch w:val="variable"/>
  </w:font>
  <w:font w:name="Consolas">
    <w:panose1 w:val="020B0609020204030204"/>
    <w:charset w:val="CC"/>
    <w:family w:val="modern"/>
    <w:pitch w:val="fixed"/>
  </w:font>
  <w:font w:name="Cambria Math">
    <w:panose1 w:val="02040503050406030204"/>
    <w:charset w:val="CC"/>
    <w:family w:val="roman"/>
    <w:pitch w:val="variable"/>
  </w:font>
</w:fonts>`;
}

function generateDocumentRels(extraRels) {
  let rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/fontTable" Target="fontTable.xml"/>`;

  for (const rel of extraRels) {
    rels += `\n  <Relationship Id="${rel.id}" Type="${rel.type}" Target="${rel.target}"/>`;
  }

  rels += '\n</Relationships>';
  return rels;
}

function generateAppProps(title) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
  <Application>ChatGPT Word Copier Extension</Application>
  <DocSecurity>0</DocSecurity>
  <ScaleCrop>false</ScaleCrop>
  <Company>ChatGPT</Company>
</Properties>`;
}

function generateCoreProps(title) {
  const now = new Date().toISOString();
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
                   xmlns:dc="http://purl.org/dc/elements/1.1/"
                   xmlns:dcterms="http://purl.org/dc/terms/"
                   xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>${escapeXml(title)}</dc:title>
  <dc:creator>ChatGPT Word Copier</dc:creator>
  <dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>
</cp:coreProperties>`;
}
