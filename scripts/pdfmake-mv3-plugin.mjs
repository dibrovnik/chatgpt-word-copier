import fs from 'node:fs/promises';

const PDFMAKE_BUILD_FILTER = /[\\/]node_modules[\\/]pdfmake[\\/]build[\\/]pdfmake\.js$/;
const JSZIP_BUILD_FILTER = /[\\/]node_modules[\\/]jszip[\\/]dist[\\/]jszip\.min\.js$/;
const SET_IMMEDIATE_FILTER = /[\\/]node_modules[\\/]setimmediate[\\/]setImmediate\.js$/;

const FORBIDDEN_BUNDLE_PATTERNS = [
  ['new Function', /\bnew\s+Function\s*\(/g],
  ['eval', /\beval\s*\(/g],
  ['string Function constructor', /\bFunction\s*\(\s*['"`]/g],
  ['importScripts', /\bimportScripts\s*\(/g],
  ['remote script source', /\.src\s*=\s*['"`]https?:\/\//g],
];

/**
 * Remove optional compatibility branches that rely on dynamic code execution.
 * Chrome MV3 disallows those branches even when modern browsers never use them.
 */
export function transformPdfmakeForMv3(contents) {
  let transformed = contents;

  transformed = replaceRequired(
    transformed,
    'g = this || new Function("return this")();',
    'g = this || (typeof window === "object" ? window : (typeof self === "object" ? self : undefined));',
    'pdfmake globalThis fallback'
  );
  transformed = replaceRequired(
    transformed,
    "bound = Function('binder', 'return function (' + joiny(boundArgs, ',') + '){ return binder.apply(this,arguments); }')(binder);",
    'bound = function () { return binder.apply(this, arguments); };',
    'pdfmake bind arity fallback'
  );
  transformed = replaceRequired(
    transformed,
    `var $Function = Function;

// eslint-disable-next-line consistent-return
var getEvalledConstructor = function (expressionSyntax) {
\ttry {
\t\treturn $Function('"use strict"; return (' + expressionSyntax + ').constructor;')();
\t} catch (e) {}
};`,
    `var $Function = Function;

var getEvalledConstructor = function () {};`,
    'pdfmake evaluated constructor fallback'
  );
  transformed = replaceRequired(
    transformed,
    "(function () { return this; })() || Function('return this')();",
    "(function () { return this; })() || (typeof globalThis === 'object' ? globalThis : undefined);",
    'pdfmake core-js global fallback'
  );
  transformed = replaceRequired(
    transformed,
    "return this || new Function('return this')();",
    "return this || (typeof window === 'object' ? window : undefined);",
    'pdfmake webpack global fallback'
  );

  return transformed;
}

export function transformSetImmediateForMv3(contents) {
  return replaceRequired(
    contents,
    'callback = new Function("" + callback);',
    'throw new TypeError("setImmediate callback must be a function");',
    'setImmediate string callback fallback'
  );
}

export function transformJszipForMv3(contents) {
  return replaceRequired(
    contents,
    '"function"!=typeof e&&(e=new Function(""+e))',
    '"function"!=typeof e&&function(){throw new TypeError("setImmediate callback must be a function")}()',
    'JSZip setImmediate string callback fallback'
  );
}

export function assertMv3BundleSafe(contents, filename = 'bundle') {
  const violations = [];

  for (const [label, pattern] of FORBIDDEN_BUNDLE_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(contents)) {
      violations.push(label);
    }
  }

  if (violations.length > 0) {
    throw new Error(`${filename} contains MV3-incompatible code: ${violations.join(', ')}`);
  }
}

export function pdfmakeMv3Plugin() {
  return {
    name: 'pdfmake-mv3',
    setup(build) {
      build.onLoad({ filter: PDFMAKE_BUILD_FILTER }, async ({ path }) => ({
        contents: transformPdfmakeForMv3(await fs.readFile(path, 'utf8')),
        loader: 'js',
      }));

      build.onLoad({ filter: SET_IMMEDIATE_FILTER }, async ({ path }) => ({
        contents: transformSetImmediateForMv3(await fs.readFile(path, 'utf8')),
        loader: 'js',
      }));

      build.onLoad({ filter: JSZIP_BUILD_FILTER }, async ({ path }) => ({
        contents: transformJszipForMv3(await fs.readFile(path, 'utf8')),
        loader: 'js',
      }));

      build.onEnd(async (result) => {
        if (result.errors.length > 0 || !build.initialOptions.outfile) return;

        try {
          const contents = await fs.readFile(build.initialOptions.outfile, 'utf8');
          assertMv3BundleSafe(contents, build.initialOptions.outfile);
        } catch (error) {
          return { errors: [{ text: error.message }] };
        }
      });
    },
  };
}

function replaceRequired(contents, searchValue, replacement, label) {
  if (!contents.includes(searchValue)) {
    throw new Error(`Cannot apply MV3 transform: ${label} was not found`);
  }

  return contents.replace(searchValue, replacement);
}
