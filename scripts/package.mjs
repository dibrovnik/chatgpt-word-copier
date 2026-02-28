import { existsSync, readFileSync, writeFileSync, readdirSync, statSync, unlinkSync } from 'fs';
import { resolve, join, relative } from 'path';
import JSZip from 'jszip';

const isFirefox = process.argv.includes('--firefox');
const srcDir = isFirefox ? 'dist-firefox' : 'dist';
const zipName = isFirefox ? 'chatgpt-word-copier-firefox.zip' : 'chatgpt-word-copier.zip';
const zipPath = resolve(zipName);

if (!existsSync(srcDir)) {
  console.error(`✗ Directory "${srcDir}" not found. Run build first.`);
  process.exit(1);
}

if (existsSync(zipPath)) {
  unlinkSync(zipPath);
}

function collectFiles(dir, base) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith('.')) continue;
    const fullPath = join(dir, entry);
    const relPath = relative(base, fullPath);
    if (statSync(fullPath).isDirectory()) {
      results.push(...collectFiles(fullPath, base));
    } else {
      results.push({ fullPath, relPath });
    }
  }
  return results;
}

const zip = new JSZip();
const files = collectFiles(srcDir, srcDir);

for (const { fullPath, relPath } of files) {
  zip.file(relPath.replace(/\\/g, '/'), readFileSync(fullPath));
}

const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
writeFileSync(zipPath, buf);
console.log(`✓ Packaged ${files.length} files → ${zipName}`);
