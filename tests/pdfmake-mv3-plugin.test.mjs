import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  assertMv3BundleSafe,
  transformJszipForMv3,
  transformPdfmakeForMv3,
  transformSetImmediateForMv3,
} from '../scripts/pdfmake-mv3-plugin.mjs';

const jszipSource = fs.readFileSync(path.resolve('node_modules/jszip/dist/jszip.min.js'), 'utf8');
const pdfmakeSource = fs.readFileSync(path.resolve('node_modules/pdfmake/build/pdfmake.js'), 'utf8');
const setImmediateSource = fs.readFileSync(path.resolve('node_modules/setimmediate/setImmediate.js'), 'utf8');

describe('pdfmake MV3 transform', () => {
  it('removes dynamic Function constructors from the bundled pdfmake source', () => {
    const transformed = transformPdfmakeForMv3(pdfmakeSource);

    expect(transformed).not.toMatch(/\bnew\s+Function\s*\(/);
    expect(transformed).not.toMatch(/\bFunction\s*\(\s*['"`]/);
    expect(transformed).not.toContain('$Function(');
    expect(transformed).toContain('var $Function = Function;');
  });

  it('rejects string callbacks instead of compiling them in setImmediate', () => {
    const transformed = transformSetImmediateForMv3(setImmediateSource);

    expect(transformed).not.toMatch(/\bnew\s+Function\s*\(/);
    expect(transformed).toContain('setImmediate callback must be a function');
  });

  it('removes the embedded setImmediate string callback from JSZip', () => {
    const transformed = transformJszipForMv3(jszipSource);

    expect(transformed).not.toMatch(/\bnew\s+Function\s*\(/);
    expect(transformed).toContain('setImmediate callback must be a function');
  });

  it('fails when a generated bundle contains dynamic execution', () => {
    expect(() => assertMv3BundleSafe('new Function("return 1")()', 'fixture.js'))
      .toThrow('fixture.js contains MV3-incompatible code: new Function');
  });
});
