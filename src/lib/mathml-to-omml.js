/**
 * MathML to OMML (Office Math Markup Language) Converter
 * 
 * Converts MathML elements to OMML XML strings for embedding in .docx files.
 * Word uses OMML as its native math representation.
 * 
 * Supported MathML elements:
 * - mi, mn, mo, ms, mtext → m:r (math run)
 * - mrow → group
 * - mfrac → m:f (fraction)
 * - msup → m:sSup (superscript)
 * - msub → m:sSub (subscript)
 * - msubsup → m:sSubSup
 * - msqrt → m:rad (radical)
 * - mroot → m:rad with degree
 * - mover → m:acc or m:limUpp
 * - munder → m:limLow
 * - munderover → m:limLow + m:limUpp
 * - mtable, mtr, mtd → m:m (matrix)
 * - mfenced → m:d (delimiters)
 * - menclose → m:borderBox
 * - mspace → space
 */

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const M_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/math';

// Accent characters mapping
const ACCENT_MAP = {
  '\u0302': '\u0302', // circumflex
  '\u0303': '\u0303', // tilde
  '\u0304': '\u0304', // overline/bar
  '\u0307': '\u0307', // dot
  '\u0308': '\u0308', // double dot (dieresis)
  '\u20D7': '\u20D7', // right arrow above (vector)
  '^': '\u0302',
  '~': '\u0303',
  '¯': '\u0304',
  '→': '\u20D7',
  '˙': '\u0307',
  '¨': '\u0308',
  'ˆ': '\u0302',
  '˜': '\u0303',
  '‾': '\u0304',
  '\u23DE': '\u23DE', // top curly bracket
  '\u23DF': '\u23DF', // bottom curly bracket
};

// Operator/symbol mapping for known accents in mover/munder
const KNOWN_ACCENTS = new Set([
  '\u0302', '\u0303', '\u0304', '\u0305', '\u0306', '\u0307', '\u0308',
  '\u030C', '\u0311', '\u20D7', '\u20D6', '\u20D1', '\u20E1',
  '¯', '̄', '^', '~', '→', '⃗', '̂', '˙', '¨', 'ˆ', '˜', '‾',
  '\u23DE', '\u23DF',
]);

/**
 * Convert a MathML string to OMML XML string
 */
export function mathmlToOmml(mathmlString) {
  const parser = new DOMParser();

  // Parse MathML - handle namespace
  let doc;
  if (mathmlString.includes('xmlns')) {
    doc = parser.parseFromString(mathmlString, 'application/xml');
  } else {
    // Wrap in proper namespace
    const wrapped = mathmlString.replace('<math', '<math xmlns="http://www.w3.org/1998/Math/MathML"');
    doc = parser.parseFromString(wrapped, 'application/xml');
  }

  const mathEl = doc.querySelector('math') || doc.documentElement;
  if (!mathEl || mathEl.tagName === 'parsererror') {
    // Return plain text fallback
    return `<m:oMath><m:r><m:t>${escapeXml(mathmlString)}</m:t></m:r></m:oMath>`;
  }

  const isDisplay = mathEl.getAttribute('display') === 'block';
  const innerOmml = convertNode(mathEl);

  if (isDisplay) {
    return `<m:oMathPara><m:oMath>${innerOmml}</m:oMath></m:oMathPara>`;
  }
  return `<m:oMath>${innerOmml}</m:oMath>`;
}

/**
 * Convert a LaTeX string to OMML via intermediate MathML
 * This is a simplified LaTeX parser for common patterns
 */
export function latexToOmml(latex, display = false) {
  const ommlContent = latexToOmmlDirect(latex);
  if (display) {
    return `<m:oMathPara><m:oMath>${ommlContent}</m:oMath></m:oMathPara>`;
  }
  return `<m:oMath>${ommlContent}</m:oMath>`;
}

/**
 * Convert a MathML DOM node to OMML string
 */
function convertNode(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent.trim();
    if (!text) return '';
    return makeRun(text);
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return '';

  const tag = localName(node);

  switch (tag) {
    case 'math':
    case 'mrow':
    case 'semantics':
    case 'mstyle':
    case 'mpadded':
    case 'mphantom':
      return convertChildren(node);

    case 'annotation':
    case 'annotation-xml':
      return ''; // Skip annotations

    case 'mi':
    case 'mn':
    case 'mo':
    case 'ms':
    case 'mtext':
      return convertToken(node, tag);

    case 'mfrac':
      return convertFraction(node);

    case 'msup':
      return convertSuperscript(node);

    case 'msub':
      return convertSubscript(node);

    case 'msubsup':
      return convertSubSuperscript(node);

    case 'msqrt':
      return convertSqrt(node);

    case 'mroot':
      return convertRoot(node);

    case 'mover':
      return convertOver(node);

    case 'munder':
      return convertUnder(node);

    case 'munderover':
      return convertUnderOver(node);

    case 'mtable':
      return convertTable(node);

    case 'mtr':
    case 'mlabeledtr':
      return convertTableRow(node);

    case 'mtd':
      return convertChildren(node);

    case 'mfenced':
      return convertFenced(node);

    case 'menclose':
      return convertEnclose(node);

    case 'mspace':
      return ''; // Skip spaces

    case 'mmultiscripts':
      return convertMultiscripts(node);

    default:
      return convertChildren(node);
  }
}

function localName(node) {
  return (node.localName || node.tagName || '').toLowerCase().replace(/^[^:]+:/, '');
}

function convertChildren(node) {
  let result = '';
  for (const child of node.childNodes) {
    result += convertNode(child);
  }
  return result;
}

function getChildElements(node) {
  return Array.from(node.childNodes).filter(n => n.nodeType === Node.ELEMENT_NODE);
}

/**
 * Create an OMML math run with text
 */
function makeRun(text, italic = false, bold = false) {
  let rPr = '';
  if (italic || bold) {
    const styles = [];
    if (italic) styles.push('<m:sty m:val="p"/>'); // plain (non-italic for identifiers we want plain)
    rPr = `<m:rPr>${styles.join('')}</m:rPr>`;
  }
  return `<m:r>${rPr}<w:rPr><w:rFonts w:ascii="Cambria Math" w:hAnsi="Cambria Math"/></w:rPr><m:t>${escapeXml(text)}</m:t></m:r>`;
}

/**
 * Convert token elements (mi, mn, mo, mtext, ms)
 */
function convertToken(node, tag) {
  const text = node.textContent || '';
  if (!text.trim()) return '';

  // For operator tokens
  if (tag === 'mo') {
    return makeRun(text);
  }

  return makeRun(text);
}

/**
 * Convert mfrac to OMML fraction
 */
function convertFraction(node) {
  const children = getChildElements(node);
  const num = children[0] ? convertNode(children[0]) : makeRun('');
  const den = children[1] ? convertNode(children[1]) : makeRun('');

  const linethickness = node.getAttribute('linethickness');
  let fPr = '<m:fPr><m:ctrlPr><w:rPr><w:rFonts w:ascii="Cambria Math" w:hAnsi="Cambria Math"/></w:rPr></m:ctrlPr></m:fPr>';

  // linethickness="0" means binomial (no fraction bar)
  if (linethickness === '0') {
    fPr = '<m:fPr><m:type m:val="noBar"/><m:ctrlPr><w:rPr><w:rFonts w:ascii="Cambria Math" w:hAnsi="Cambria Math"/></w:rPr></m:ctrlPr></m:fPr>';
  }

  return `<m:f>${fPr}<m:num>${num}</m:num><m:den>${den}</m:den></m:f>`;
}

/**
 * Convert msup to OMML superscript
 */
function convertSuperscript(node) {
  const children = getChildElements(node);
  const base = children[0] ? convertNode(children[0]) : makeRun('');
  const sup = children[1] ? convertNode(children[1]) : makeRun('');

  return `<m:sSup><m:sSupPr><m:ctrlPr><w:rPr><w:rFonts w:ascii="Cambria Math" w:hAnsi="Cambria Math"/></w:rPr></m:ctrlPr></m:sSupPr><m:e>${base}</m:e><m:sup>${sup}</m:sup></m:sSup>`;
}

/**
 * Convert msub to OMML subscript
 */
function convertSubscript(node) {
  const children = getChildElements(node);
  const base = children[0] ? convertNode(children[0]) : makeRun('');
  const sub = children[1] ? convertNode(children[1]) : makeRun('');

  return `<m:sSub><m:sSubPr><m:ctrlPr><w:rPr><w:rFonts w:ascii="Cambria Math" w:hAnsi="Cambria Math"/></w:rPr></m:ctrlPr></m:sSubPr><m:e>${base}</m:e><m:sub>${sub}</m:sub></m:sSub>`;
}

/**
 * Convert msubsup to OMML sub-superscript
 */
function convertSubSuperscript(node) {
  const children = getChildElements(node);
  const base = children[0] ? convertNode(children[0]) : makeRun('');
  const sub = children[1] ? convertNode(children[1]) : makeRun('');
  const sup = children[2] ? convertNode(children[2]) : makeRun('');

  return `<m:sSubSup><m:sSubSupPr><m:ctrlPr><w:rPr><w:rFonts w:ascii="Cambria Math" w:hAnsi="Cambria Math"/></w:rPr></m:ctrlPr></m:sSubSupPr><m:e>${base}</m:e><m:sub>${sub}</m:sub><m:sup>${sup}</m:sup></m:sSubSup>`;
}

/**
 * Convert msqrt to OMML radical
 */
function convertSqrt(node) {
  const content = convertChildren(node);
  return `<m:rad><m:radPr><m:degHide m:val="1"/><m:ctrlPr><w:rPr><w:rFonts w:ascii="Cambria Math" w:hAnsi="Cambria Math"/></w:rPr></m:ctrlPr></m:radPr><m:deg/><m:e>${content}</m:e></m:rad>`;
}

/**
 * Convert mroot to OMML radical with degree
 */
function convertRoot(node) {
  const children = getChildElements(node);
  const base = children[0] ? convertNode(children[0]) : makeRun('');
  const degree = children[1] ? convertNode(children[1]) : makeRun('');

  return `<m:rad><m:radPr><m:ctrlPr><w:rPr><w:rFonts w:ascii="Cambria Math" w:hAnsi="Cambria Math"/></w:rPr></m:ctrlPr></m:radPr><m:deg>${degree}</m:deg><m:e>${base}</m:e></m:rad>`;
}

/**
 * Convert mover to OMML (accent or upper limit)
 */
function convertOver(node) {
  const children = getChildElements(node);
  const base = children[0] ? convertNode(children[0]) : makeRun('');
  const overEl = children[1];
  const overText = overEl?.textContent?.trim() || '';

  // Check if it's an accent
  const accent = node.getAttribute('accent') === 'true' || KNOWN_ACCENTS.has(overText);

  if (accent) {
    const chr = ACCENT_MAP[overText] || overText;
    return `<m:acc><m:accPr><m:chr m:val="${escapeXml(chr)}"/><m:ctrlPr><w:rPr><w:rFonts w:ascii="Cambria Math" w:hAnsi="Cambria Math"/></w:rPr></m:ctrlPr></m:accPr><m:e>${base}</m:e></m:acc>`;
  }

  // Otherwise treat as upper limit
  const over = overEl ? convertNode(overEl) : makeRun('');
  return `<m:limUpp><m:limUppPr><m:ctrlPr><w:rPr><w:rFonts w:ascii="Cambria Math" w:hAnsi="Cambria Math"/></w:rPr></m:ctrlPr></m:limUppPr><m:e>${base}</m:e><m:lim>${over}</m:lim></m:limUpp>`;
}

/**
 * Convert munder to OMML lower limit
 */
function convertUnder(node) {
  const children = getChildElements(node);
  const base = children[0] ? convertNode(children[0]) : makeRun('');
  const under = children[1] ? convertNode(children[1]) : makeRun('');

  return `<m:limLow><m:limLowPr><m:ctrlPr><w:rPr><w:rFonts w:ascii="Cambria Math" w:hAnsi="Cambria Math"/></w:rPr></m:ctrlPr></m:limLowPr><m:e>${base}</m:e><m:lim>${under}</m:lim></m:limLow>`;
}

/**
 * Convert munderover to OMML (nary or limits)
 */
function convertUnderOver(node) {
  const children = getChildElements(node);
  const base = children[0];
  const under = children[1];
  const over = children[2];

  const baseText = base?.textContent?.trim() || '';

  // Check for sum, product, integral etc. → use nary
  const narySymbols = { '∑': '∑', '∏': '∏', '∫': '∫', '∮': '∮', '⋃': '⋃', '⋂': '⋂', '∬': '∬', '∭': '∭' };
  if (narySymbols[baseText]) {
    const subOmml = under ? convertNode(under) : makeRun('');
    const supOmml = over ? convertNode(over) : makeRun('');
    return `<m:nary><m:naryPr><m:chr m:val="${escapeXml(narySymbols[baseText])}"/><m:limLoc m:val="undOvr"/><m:ctrlPr><w:rPr><w:rFonts w:ascii="Cambria Math" w:hAnsi="Cambria Math"/></w:rPr></m:ctrlPr></m:naryPr><m:sub>${subOmml}</m:sub><m:sup>${supOmml}</m:sup><m:e></m:e></m:nary>`;
  }

  // Generic: wrap as limLow(limUpp(base, over), under)
  const baseOmml = base ? convertNode(base) : makeRun('');
  const underOmml = under ? convertNode(under) : makeRun('');
  const overOmml = over ? convertNode(over) : makeRun('');

  const inner = `<m:limUpp><m:limUppPr><m:ctrlPr><w:rPr><w:rFonts w:ascii="Cambria Math" w:hAnsi="Cambria Math"/></w:rPr></m:ctrlPr></m:limUppPr><m:e>${baseOmml}</m:e><m:lim>${overOmml}</m:lim></m:limUpp>`;
  return `<m:limLow><m:limLowPr><m:ctrlPr><w:rPr><w:rFonts w:ascii="Cambria Math" w:hAnsi="Cambria Math"/></w:rPr></m:ctrlPr></m:limLowPr><m:e>${inner}</m:e><m:lim>${underOmml}</m:lim></m:limLow>`;
}

/**
 * Convert mtable to OMML matrix
 */
function convertTable(node) {
  const rows = [];
  for (const child of node.childNodes) {
    if (child.nodeType === Node.ELEMENT_NODE && (localName(child) === 'mtr' || localName(child) === 'mlabeledtr')) {
      rows.push(convertTableRow(child));
    }
  }
  return `<m:m><m:mPr><m:mcs><m:mc><m:mcPr><m:count m:val="${getMaxCols(node)}"/><m:mcJc m:val="center"/></m:mcPr></m:mc></m:mcs><m:ctrlPr><w:rPr><w:rFonts w:ascii="Cambria Math" w:hAnsi="Cambria Math"/></w:rPr></m:ctrlPr></m:mPr>${rows.join('')}</m:m>`;
}

function convertTableRow(node) {
  let cells = '';
  for (const child of node.childNodes) {
    if (child.nodeType === Node.ELEMENT_NODE && localName(child) === 'mtd') {
      cells += `<m:e>${convertChildren(child)}</m:e>`;
    }
  }
  return `<m:mr>${cells}</m:mr>`;
}

function getMaxCols(tableNode) {
  let max = 0;
  for (const child of tableNode.childNodes) {
    if (child.nodeType === Node.ELEMENT_NODE) {
      let cols = 0;
      for (const td of child.childNodes) {
        if (td.nodeType === Node.ELEMENT_NODE && localName(td) === 'mtd') cols++;
      }
      max = Math.max(max, cols);
    }
  }
  return max || 1;
}

/**
 * Convert mfenced to OMML delimiters
 */
function convertFenced(node) {
  const open = node.getAttribute('open') || '(';
  const close = node.getAttribute('close') || ')';
  const content = convertChildren(node);

  return `<m:d><m:dPr><m:begChr m:val="${escapeXml(open)}"/><m:endChr m:val="${escapeXml(close)}"/><m:ctrlPr><w:rPr><w:rFonts w:ascii="Cambria Math" w:hAnsi="Cambria Math"/></w:rPr></m:ctrlPr></m:dPr><m:e>${content}</m:e></m:d>`;
}

/**
 * Convert menclose to OMML borderBox
 */
function convertEnclose(node) {
  const content = convertChildren(node);
  return `<m:borderBox><m:borderBoxPr><m:ctrlPr><w:rPr><w:rFonts w:ascii="Cambria Math" w:hAnsi="Cambria Math"/></w:rPr></m:ctrlPr></m:borderBoxPr><m:e>${content}</m:e></m:borderBox>`;
}

/**
 * Convert mmultiscripts (simplified)
 */
function convertMultiscripts(node) {
  // Simplified: just convert children
  return convertChildren(node);
}

/**
 * Direct LaTeX to OMML converter for common patterns
 */
function latexToOmmlDirect(latex) {
  // This is a simplified parser for common LaTeX patterns
  let pos = 0;
  const len = latex.length;

  function parse() {
    let result = '';
    while (pos < len) {
      const ch = latex[pos];

      if (ch === '}') break;

      if (ch === '{') {
        pos++;
        result += parse();
        if (pos < len && latex[pos] === '}') pos++;
        continue;
      }

      if (ch === '^') {
        pos++;
        const base = result;
        result = '';
        const sup = parseGroup();
        const baseOmml = base || makeRun('');
        return `<m:sSup><m:sSupPr><m:ctrlPr><w:rPr><w:rFonts w:ascii="Cambria Math" w:hAnsi="Cambria Math"/></w:rPr></m:ctrlPr></m:sSupPr><m:e>${baseOmml}</m:e><m:sup>${sup}</m:sup></m:sSup>` + parse();
      }

      if (ch === '_') {
        pos++;
        const base = result;
        result = '';
        const sub = parseGroup();
        const baseOmml = base || makeRun('');

        // Check for ^ after _
        if (pos < len && latex[pos] === '^') {
          pos++;
          const sup = parseGroup();
          return `<m:sSubSup><m:sSubSupPr><m:ctrlPr><w:rPr><w:rFonts w:ascii="Cambria Math" w:hAnsi="Cambria Math"/></w:rPr></m:ctrlPr></m:sSubSupPr><m:e>${baseOmml}</m:e><m:sub>${sub}</m:sub><m:sup>${sup}</m:sup></m:sSubSup>` + parse();
        }

        return `<m:sSub><m:sSubPr><m:ctrlPr><w:rPr><w:rFonts w:ascii="Cambria Math" w:hAnsi="Cambria Math"/></w:rPr></m:ctrlPr></m:sSubPr><m:e>${baseOmml}</m:e><m:sub>${sub}</m:sub></m:sSub>` + parse();
      }

      if (ch === '\\') {
        const cmd = readCommand();
        result += handleCommand(cmd);
        continue;
      }

      if (ch === ' ') {
        pos++;
        continue;
      }

      result += makeRun(ch);
      pos++;
    }
    return result;
  }

  function parseGroup() {
    if (pos < len && latex[pos] === '{') {
      pos++;
      const r = parse();
      if (pos < len && latex[pos] === '}') pos++;
      return r;
    }
    if (pos < len && latex[pos] === '\\') {
      const cmd = readCommand();
      return handleCommand(cmd);
    }
    if (pos < len) {
      const ch = latex[pos];
      pos++;
      return makeRun(ch);
    }
    return '';
  }

  function readCommand() {
    pos++; // skip backslash
    let cmd = '';
    while (pos < len && /[a-zA-Z]/.test(latex[pos])) {
      cmd += latex[pos];
      pos++;
    }
    return cmd;
  }

  function handleCommand(cmd) {
    switch (cmd) {
      case 'frac': {
        const num = parseGroup();
        const den = parseGroup();
        return `<m:f><m:fPr><m:ctrlPr><w:rPr><w:rFonts w:ascii="Cambria Math" w:hAnsi="Cambria Math"/></w:rPr></m:ctrlPr></m:fPr><m:num>${num}</m:num><m:den>${den}</m:den></m:f>`;
      }
      case 'sqrt': {
        const content = parseGroup();
        return `<m:rad><m:radPr><m:degHide m:val="1"/><m:ctrlPr><w:rPr><w:rFonts w:ascii="Cambria Math" w:hAnsi="Cambria Math"/></w:rPr></m:ctrlPr></m:radPr><m:deg/><m:e>${content}</m:e></m:rad>`;
      }
      case 'sum': return makeRun('∑');
      case 'prod': return makeRun('∏');
      case 'int': return makeRun('∫');
      case 'infty': return makeRun('∞');
      case 'alpha': return makeRun('α');
      case 'beta': return makeRun('β');
      case 'gamma': return makeRun('γ');
      case 'delta': return makeRun('δ');
      case 'epsilon': return makeRun('ε');
      case 'zeta': return makeRun('ζ');
      case 'eta': return makeRun('η');
      case 'theta': return makeRun('θ');
      case 'iota': return makeRun('ι');
      case 'kappa': return makeRun('κ');
      case 'lambda': return makeRun('λ');
      case 'mu': return makeRun('μ');
      case 'nu': return makeRun('ν');
      case 'xi': return makeRun('ξ');
      case 'pi': return makeRun('π');
      case 'rho': return makeRun('ρ');
      case 'sigma': return makeRun('σ');
      case 'tau': return makeRun('τ');
      case 'upsilon': return makeRun('υ');
      case 'phi': return makeRun('φ');
      case 'chi': return makeRun('χ');
      case 'psi': return makeRun('ψ');
      case 'omega': return makeRun('ω');
      case 'Gamma': return makeRun('Γ');
      case 'Delta': return makeRun('Δ');
      case 'Theta': return makeRun('Θ');
      case 'Lambda': return makeRun('Λ');
      case 'Xi': return makeRun('Ξ');
      case 'Pi': return makeRun('Π');
      case 'Sigma': return makeRun('Σ');
      case 'Phi': return makeRun('Φ');
      case 'Psi': return makeRun('Ψ');
      case 'Omega': return makeRun('Ω');
      case 'cdot': return makeRun('⋅');
      case 'cdots': return makeRun('⋯');
      case 'ldots': return makeRun('…');
      case 'dots': return makeRun('…');
      case 'times': return makeRun('×');
      case 'div': return makeRun('÷');
      case 'pm': return makeRun('±');
      case 'mp': return makeRun('∓');
      case 'leq': case 'le': return makeRun('≤');
      case 'geq': case 'ge': return makeRun('≥');
      case 'neq': case 'ne': return makeRun('≠');
      case 'approx': return makeRun('≈');
      case 'equiv': return makeRun('≡');
      case 'sim': return makeRun('∼');
      case 'propto': return makeRun('∝');
      case 'in': return makeRun('∈');
      case 'notin': return makeRun('∉');
      case 'subset': return makeRun('⊂');
      case 'supset': return makeRun('⊃');
      case 'subseteq': return makeRun('⊆');
      case 'supseteq': return makeRun('⊇');
      case 'cup': return makeRun('∪');
      case 'cap': return makeRun('∩');
      case 'forall': return makeRun('∀');
      case 'exists': return makeRun('∃');
      case 'nabla': return makeRun('∇');
      case 'partial': return makeRun('∂');
      case 'to': case 'rightarrow': return makeRun('→');
      case 'leftarrow': return makeRun('←');
      case 'Rightarrow': return makeRun('⇒');
      case 'Leftarrow': return makeRun('⇐');
      case 'leftrightarrow': return makeRun('↔');
      case 'Leftrightarrow': return makeRun('⇔');
      case 'langle': return makeRun('⟨');
      case 'rangle': return makeRun('⟩');
      case 'lfloor': return makeRun('⌊');
      case 'rfloor': return makeRun('⌋');
      case 'lceil': return makeRun('⌈');
      case 'rceil': return makeRun('⌉');
      case 'left': {
        // Read delimiter
        if (pos < len) {
          const delim = latex[pos] === '\\' ? '' : latex[pos];
          pos++;
          return makeRun(delim || '');
        }
        return '';
      }
      case 'right': {
        if (pos < len) {
          const delim = latex[pos] === '\\' ? '' : latex[pos];
          pos++;
          return makeRun(delim || '');
        }
        return '';
      }
      case 'text': case 'mathrm': case 'textrm': {
        const content = parseGroup();
        return content;
      }
      case 'mathbf': case 'textbf': case 'bf': {
        const content = parseGroup();
        return content;
      }
      case 'bar': case 'overline': {
        const content = parseGroup();
        return `<m:acc><m:accPr><m:chr m:val="̄"/><m:ctrlPr><w:rPr><w:rFonts w:ascii="Cambria Math" w:hAnsi="Cambria Math"/></w:rPr></m:ctrlPr></m:accPr><m:e>${content}</m:e></m:acc>`;
      }
      case 'hat': {
        const content = parseGroup();
        return `<m:acc><m:accPr><m:chr m:val="̂"/><m:ctrlPr><w:rPr><w:rFonts w:ascii="Cambria Math" w:hAnsi="Cambria Math"/></w:rPr></m:ctrlPr></m:accPr><m:e>${content}</m:e></m:acc>`;
      }
      case 'vec': {
        const content = parseGroup();
        return `<m:acc><m:accPr><m:chr m:val="⃗"/><m:ctrlPr><w:rPr><w:rFonts w:ascii="Cambria Math" w:hAnsi="Cambria Math"/></w:rPr></m:ctrlPr></m:accPr><m:e>${content}</m:e></m:acc>`;
      }
      case 'dot': {
        const content = parseGroup();
        return `<m:acc><m:accPr><m:chr m:val="̇"/><m:ctrlPr><w:rPr><w:rFonts w:ascii="Cambria Math" w:hAnsi="Cambria Math"/></w:rPr></m:ctrlPr></m:accPr><m:e>${content}</m:e></m:acc>`;
      }
      case 'tilde': {
        const content = parseGroup();
        return `<m:acc><m:accPr><m:chr m:val="̃"/><m:ctrlPr><w:rPr><w:rFonts w:ascii="Cambria Math" w:hAnsi="Cambria Math"/></w:rPr></m:ctrlPr></m:accPr><m:e>${content}</m:e></m:acc>`;
      }
      default:
        return makeRun('\\' + cmd);
    }
  }

  return parse();
}

/**
 * Escape XML special characters
 */
function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export { escapeXml };
