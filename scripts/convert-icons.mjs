/**
 * SVG → PNG icon converter for PWA manifests.
 * Reads each package's public/favicon.svg and generates icon-192x192.png
 * and icon-512x512.png in the same directory.
 *
 * Usage: node scripts/convert-icons.mjs
 */

import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const packages = ['chat-core', 'chronicle', 'council'];
const sizes = [192, 512];

for (const pkg of packages) {
  const svgPath = join(root, 'packages', pkg, 'public', 'favicon.svg');
  const svgBuffer = await readFile(svgPath);

  for (const size of sizes) {
    const pngPath = join(root, 'packages', pkg, 'public', `icon-${size}x${size}.png`);
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(pngPath);
    console.log(`  ${pkg} → icon-${size}x${size}.png`);
  }
}

console.log('\nDone! All PWA icons regenerated.');
