/**
 * Version sync script.
 * Reads version from package.json and writes it to src/manifest.json.
 * Used automatically during build and by `npm version` lifecycle hooks.
 *
 * Usage:
 *   node scripts/version.mjs              → sync package.json version → manifest.json
 *   node scripts/version.mjs 2.1.0        → set explicit version in both files
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const pkgPath = path.join(root, 'package.json');
const manifestPath = path.join(root, 'src', 'manifest.json');

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

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

// Sync to manifest.json
manifest.version = version;
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

console.log(`✓ Version synced: ${version} → src/manifest.json`);
