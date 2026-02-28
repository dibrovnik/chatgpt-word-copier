/**
 * Tests for MathML to OMML converter
 */
import { describe, it, expect } from 'vitest';
import { mathmlToOmml, latexToOmml, escapeXml } from '../src/lib/mathml-to-omml.js';

// ===== escapeXml tests =====

describe('escapeXml', () => {
  it('should escape & < > " \'', () => {
    expect(escapeXml('a & b')).toBe('a &amp; b');
    expect(escapeXml('<tag>')).toBe('&lt;tag&gt;');
    expect(escapeXml('"hello"')).toBe('&quot;hello&quot;');
    expect(escapeXml("it's")).toBe('it&apos;s');
  });

  it('should remove XML-illegal control characters', () => {
    // NULL, BEL, BS, etc.
    expect(escapeXml('abc\x00def')).toBe('abcdef');
    expect(escapeXml('abc\x01def')).toBe('abcdef');
    expect(escapeXml('abc\x08def')).toBe('abcdef');
    expect(escapeXml('abc\x0Bdef')).toBe('abcdef');
    expect(escapeXml('abc\x0Cdef')).toBe('abcdef');
    expect(escapeXml('abc\x0Edef')).toBe('abcdef');
    expect(escapeXml('abc\x1Fdef')).toBe('abcdef');
    expect(escapeXml('abc\x7Fdef')).toBe('abcdef');
  });

  it('should preserve valid control characters (tab, newline, CR)', () => {
    expect(escapeXml('a\tb')).toBe('a\tb');
    expect(escapeXml('a\nb')).toBe('a\nb');
    expect(escapeXml('a\rb')).toBe('a\rb');
  });

  it('should preserve Unicode characters (Greek, math symbols)', () => {
    expect(escapeXml('Π=⟨S,N⟩')).toBe('Π=⟨S,N⟩');
    expect(escapeXml('Δlatency')).toBe('Δlatency');
    expect(escapeXml('α β γ δ')).toBe('α β γ δ');
    expect(escapeXml('∑∏∫∞')).toBe('∑∏∫∞');
  });

  it('should handle empty and null input', () => {
    expect(escapeXml('')).toBe('');
    expect(escapeXml(null)).toBe('');
    expect(escapeXml(undefined)).toBe('');
  });

  it('should handle complex mixed input', () => {
    const input = '\x00Hello & <World> "π"\x01';
    const expected = 'Hello &amp; &lt;World&gt; &quot;π&quot;';
    expect(escapeXml(input)).toBe(expected);
  });
});

// ===== mathmlToOmml tests =====

describe('mathmlToOmml', () => {
  it('should convert simple variable to OMML math run', () => {
    const mathml = '<math xmlns="http://www.w3.org/1998/Math/MathML"><mi>x</mi></math>';
    const result = mathmlToOmml(mathml);
    expect(result).toContain('<m:oMath>');
    expect(result).toContain('</m:oMath>');
    expect(result).toContain('<m:t>x</m:t>');
    expect(result).toContain('Cambria Math');
  });

  it('should convert fraction (mfrac)', () => {
    const mathml = '<math xmlns="http://www.w3.org/1998/Math/MathML"><mfrac><mi>a</mi><mi>b</mi></mfrac></math>';
    const result = mathmlToOmml(mathml);
    expect(result).toContain('<m:f>');
    expect(result).toContain('<m:num>');
    expect(result).toContain('<m:den>');
    expect(result).toContain('<m:t>a</m:t>');
    expect(result).toContain('<m:t>b</m:t>');
    expect(result).toContain('</m:f>');
  });

  it('should convert superscript (msup)', () => {
    const mathml = '<math xmlns="http://www.w3.org/1998/Math/MathML"><msup><mi>x</mi><mn>2</mn></msup></math>';
    const result = mathmlToOmml(mathml);
    expect(result).toContain('<m:sSup>');
    expect(result).toContain('<m:e>');
    expect(result).toContain('<m:sup>');
    expect(result).toContain('<m:t>x</m:t>');
    expect(result).toContain('<m:t>2</m:t>');
  });

  it('should convert subscript (msub)', () => {
    const mathml = '<math xmlns="http://www.w3.org/1998/Math/MathML"><msub><mi>S</mi><mi>auth</mi></msub></math>';
    const result = mathmlToOmml(mathml);
    expect(result).toContain('<m:sSub>');
    expect(result).toContain('<m:sub>');
    expect(result).toContain('<m:t>S</m:t>');
  });

  it('should convert sqrt (msqrt)', () => {
    const mathml = '<math xmlns="http://www.w3.org/1998/Math/MathML"><msqrt><mi>x</mi></msqrt></math>';
    const result = mathmlToOmml(mathml);
    expect(result).toContain('<m:rad>');
    expect(result).toContain('<m:degHide m:val="1"/>');
    expect(result).toContain('<m:e>');
  });

  it('should handle semantics with annotation (KaTeX format)', () => {
    const mathml = `<math xmlns="http://www.w3.org/1998/Math/MathML">
      <semantics>
        <mrow><mi>x</mi><mo>=</mo><mn>1</mn></mrow>
        <annotation encoding="application/x-tex">x=1</annotation>
      </semantics>
    </math>`;
    const result = mathmlToOmml(mathml);
    expect(result).toContain('<m:oMath>');
    expect(result).toContain('<m:t>x</m:t>');
    expect(result).toContain('<m:t>=</m:t>');
    expect(result).toContain('<m:t>1</m:t>');
    // Annotation should be skipped
    expect(result).not.toContain('x=1');
  });

  it('should handle complex formula with Greek letters and brackets', () => {
    const mathml = `<math xmlns="http://www.w3.org/1998/Math/MathML">
      <semantics>
        <mrow>
          <mi mathvariant="normal">Π</mi>
          <mo>=</mo>
          <mo stretchy="false">⟨</mo>
          <mi>S</mi>
          <mo separator="true">,</mo>
          <mi>N</mi>
          <mo stretchy="false">⟩</mo>
        </mrow>
        <annotation encoding="application/x-tex">\\Pi=\\langle S,N\\rangle</annotation>
      </semantics>
    </math>`;
    const result = mathmlToOmml(mathml);
    expect(result).toContain('<m:t>Π</m:t>');
    expect(result).toContain('<m:t>=</m:t>');
    expect(result).toContain('<m:t>⟨</m:t>');
    expect(result).toContain('<m:t>S</m:t>');
    expect(result).toContain('<m:t>⟩</m:t>');
  });

  it('should handle msubsup (combined sub+superscript)', () => {
    const mathml = '<math xmlns="http://www.w3.org/1998/Math/MathML"><msubsup><mi>x</mi><mi>i</mi><mn>2</mn></msubsup></math>';
    const result = mathmlToOmml(mathml);
    expect(result).toContain('<m:sSubSup>');
    expect(result).toContain('<m:sub>');
    expect(result).toContain('<m:sup>');
  });

  it('should handle mfenced delimiters', () => {
    const mathml = '<math xmlns="http://www.w3.org/1998/Math/MathML"><mfenced open="[" close="]"><mi>a</mi></mfenced></math>';
    const result = mathmlToOmml(mathml);
    expect(result).toContain('<m:d>');
    expect(result).toContain('<m:begChr');
    expect(result).toContain('<m:endChr');
  });

  it('should return fallback for invalid MathML', () => {
    const result = mathmlToOmml('not valid xml <<>>');
    expect(result).toContain('<m:oMath>');
    // Should still produce valid OMML (fallback plain text)
  });

  it('should produce well-formed XML (no unclosed tags)', () => {
    const mathml = '<math xmlns="http://www.w3.org/1998/Math/MathML"><mfrac><mrow><mi>a</mi><mo>+</mo><mi>b</mi></mrow><mi>c</mi></mfrac></math>';
    const result = mathmlToOmml(mathml);

    // Count opening and closing tags
    const openF = (result.match(/<m:f>/g) || []).length;
    const closeF = (result.match(/<\/m:f>/g) || []).length;
    expect(openF).toBe(closeF);

    const openR = (result.match(/<m:r>/g) || []).length;
    const closeR = (result.match(/<\/m:r>/g) || []).length;
    expect(openR).toBe(closeR);
  });
});

// ===== latexToOmml tests =====

describe('latexToOmml', () => {
  it('should convert simple variable', () => {
    const result = latexToOmml('x');
    expect(result).toContain('<m:oMath>');
    expect(result).toContain('<m:t>x</m:t>');
  });

  it('should convert fraction', () => {
    const result = latexToOmml('\\frac{a}{b}');
    expect(result).toContain('<m:f>');
    expect(result).toContain('<m:num>');
    expect(result).toContain('<m:den>');
  });

  it('should convert sqrt', () => {
    const result = latexToOmml('\\sqrt{x}');
    expect(result).toContain('<m:rad>');
    expect(result).toContain('<m:degHide');
  });

  it('should convert Greek letters', () => {
    const result = latexToOmml('\\alpha + \\beta');
    expect(result).toContain('<m:t>α</m:t>');
    expect(result).toContain('<m:t>β</m:t>');
  });

  it('should convert superscript', () => {
    const result = latexToOmml('x^{2}');
    expect(result).toContain('<m:sSup>');
    expect(result).toContain('<m:sup>');
  });

  it('should convert subscript', () => {
    const result = latexToOmml('x_{i}');
    expect(result).toContain('<m:sSub>');
    expect(result).toContain('<m:sub>');
  });

  it('should convert combined sub-superscript', () => {
    const result = latexToOmml('x_{i}^{2}');
    expect(result).toContain('<m:sSubSup>');
  });

  it('should convert math operators', () => {
    const result = latexToOmml('\\sum \\prod \\int');
    expect(result).toContain('<m:t>∑</m:t>');
    expect(result).toContain('<m:t>∏</m:t>');
    expect(result).toContain('<m:t>∫</m:t>');
  });

  it('should convert accents (hat, vec, bar)', () => {
    const resultHat = latexToOmml('\\hat{x}');
    expect(resultHat).toContain('<m:acc>');

    const resultVec = latexToOmml('\\vec{v}');
    expect(resultVec).toContain('<m:acc>');

    const resultBar = latexToOmml('\\bar{x}');
    expect(resultBar).toContain('<m:acc>');
  });

  it('should wrap display math in m:oMathPara', () => {
    const result = latexToOmml('x', true);
    expect(result).toContain('<m:oMathPara>');
    expect(result).toContain('<m:oMath>');
  });

  it('should NOT wrap inline math in m:oMathPara', () => {
    const result = latexToOmml('x', false);
    expect(result).not.toContain('<m:oMathPara>');
    expect(result).toContain('<m:oMath>');
  });

  it('should handle relation operators', () => {
    const result = latexToOmml('\\leq \\geq \\neq \\approx');
    expect(result).toContain('<m:t>≤</m:t>');
    expect(result).toContain('<m:t>≥</m:t>');
    expect(result).toContain('<m:t>≠</m:t>');
    expect(result).toContain('<m:t>≈</m:t>');
  });

  it('should handle arrows', () => {
    const result = latexToOmml('\\rightarrow \\leftarrow \\Rightarrow');
    expect(result).toContain('<m:t>→</m:t>');
    expect(result).toContain('<m:t>←</m:t>');
    expect(result).toContain('<m:t>⇒</m:t>');
  });
});
