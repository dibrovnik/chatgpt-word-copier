import * as esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';

const isWatch = process.argv.includes('--watch');

// Ensure dist directory exists
if (!fs.existsSync('dist')) {
  fs.mkdirSync('dist', { recursive: true });
}

// Copy static files
function copyStaticFiles() {
  // Copy manifest.json
  fs.copyFileSync('src/manifest.json', 'dist/manifest.json');

  // Copy popup HTML/CSS
  if (!fs.existsSync('dist/popup')) fs.mkdirSync('dist/popup', { recursive: true });
  fs.copyFileSync('src/popup/popup.html', 'dist/popup/popup.html');
  fs.copyFileSync('src/popup/popup.css', 'dist/popup/popup.css');

  // Copy content CSS
  if (!fs.existsSync('dist/content')) fs.mkdirSync('dist/content', { recursive: true });
  fs.copyFileSync('src/content/content.css', 'dist/content/content.css');

  // Copy icons
  if (fs.existsSync('src/icons')) {
    if (!fs.existsSync('dist/icons')) fs.mkdirSync('dist/icons', { recursive: true });
    const iconFiles = fs.readdirSync('src/icons');
    for (const file of iconFiles) {
      fs.copyFileSync(path.join('src/icons', file), path.join('dist/icons', file));
    }
  }

  console.log('✓ Static files copied');
}

copyStaticFiles();

// Bundle configurations
const bundles = [
  {
    entryPoints: ['src/content/content.js'],
    outfile: 'dist/content/content.js',
    format: 'iife',
  },
  {
    entryPoints: ['src/popup/popup.js'],
    outfile: 'dist/popup/popup.js',
    format: 'iife',
  },
  {
    entryPoints: ['src/background/background.js'],
    outfile: 'dist/background/background.js',
    format: 'iife',
  },
];

async function build() {
  for (const bundle of bundles) {
    const options = {
      ...bundle,
      bundle: true,
      minify: !isWatch,
      sourcemap: isWatch ? 'inline' : false,
      target: ['chrome110'],
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
