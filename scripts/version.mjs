/**
 * Version sync script.
 * Reads version from package.json and writes it to both manifest files.
 * Used automatically during build and by `npm version` lifecycle hooks.
 *
 * Usage:
 *   node scripts/version.mjs              → sync package.json version → manifests
 *   node scripts/version.mjs 2.1.0        → set explicit version in all files
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const pkgPath = path.join(root, 'package.json');
const manifestPath = path.join(root, 'src', 'manifest.json');
const manifestFirefoxPath = path.join(root, 'src', 'manifest.firefox.json');

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
const manifestFirefox = JSON.parse(fs.readFileSync(manifestFirefoxPath, 'utf-8'));

// If an explicit version was passed as CLI arg, update package.json too
const explicitVersion = process.argv[2];
if (explicitVersion) {
  if (!/^\d+\.\d+\.\d+$/.test(explicitVersion)) {
    console.error(`✗ Invalid version format: "${explicitVersion}". Expected X.Y.Z`);
    process.exit(1);
  }
  pkg.version = explicitVersion;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
}

const version = pkg.version;

// Sync to manifest.json (Chrome)
manifest.version = version;
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

// Sync to manifest.firefox.json
manifestFirefox.version = version;
fs.writeFileSync(manifestFirefoxPath, JSON.stringify(manifestFirefox, null, 2) + '\n');

console.log(`✓ Version synced: ${version} → src/manifest.json, src/manifest.firefox.json`);
