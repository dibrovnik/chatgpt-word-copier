import * as esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';

const isWatch = process.argv.includes('--watch');
const isFirefox = process.argv.includes('--firefox');
const distDir = isFirefox ? 'dist-firefox' : 'dist';

// Ensure dist directory exists
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Copy static files
function copyStaticFiles() {
  // Copy manifest.json (use Firefox manifest when building for Firefox)
  const manifestSrc = isFirefox ? 'src/manifest.firefox.json' : 'src/manifest.json';
  const manifestDst = path.join(distDir, 'manifest.json');
  fs.copyFileSync(manifestSrc, manifestDst);

  // Copy popup HTML/CSS
  const popupDir = path.join(distDir, 'popup');
  if (!fs.existsSync(popupDir)) fs.mkdirSync(popupDir, { recursive: true });
  fs.copyFileSync('src/popup/popup.html', path.join(popupDir, 'popup.html'));
  fs.copyFileSync('src/popup/popup.css', path.join(popupDir, 'popup.css'));

  // Copy content CSS
  const contentDir = path.join(distDir, 'content');
  if (!fs.existsSync(contentDir)) fs.mkdirSync(contentDir, { recursive: true });
  fs.copyFileSync('src/content/content.css', path.join(contentDir, 'content.css'));

  // Copy icons
  if (fs.existsSync('src/icons')) {
    const iconsDir = path.join(distDir, 'icons');
    if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true });
    const iconFiles = fs.readdirSync('src/icons');
    for (const file of iconFiles) {
      fs.copyFileSync(path.join('src/icons', file), path.join(iconsDir, file));
    }
  }

  const label = isFirefox ? 'Firefox' : 'Chrome';
  console.log(`✓ Static files copied (${label})`);
}

copyStaticFiles();

// Bundle configurations
const bundles = [
  {
    entryPoints: ['src/content/content.js'],
    outfile: path.join(distDir, 'content/content.js'),
    format: 'iife',
  },
  {
    entryPoints: ['src/popup/popup.js'],
    outfile: path.join(distDir, 'popup/popup.js'),
    format: 'iife',
  },
  {
    entryPoints: ['src/background/background.js'],
    outfile: path.join(distDir, 'background/background.js'),
    format: 'iife',
  },
];

async function build() {
  const target = isFirefox ? ['firefox109'] : ['chrome110'];

  for (const bundle of bundles) {
    const options = {
      ...bundle,
      bundle: true,
      minify: !isWatch,
      sourcemap: isWatch ? 'inline' : false,
      target,
      define: {
        'process.env.NODE_ENV': isWatch ? '"development"' : '"production"',
      },
    };

    if (isWatch) {
      const ctx = await esbuild.context(options);
      await ctx.watch();
      console.log(`👀 Watching ${bundle.entryPoints[0]}...`);
    } else {
      await esbuild.build(options);
      console.log(`✓ Built ${bundle.outfile}`);
    }
  }
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
