/**
 * Generate simple PNG icons for the extension.
 * Creates colored squares with "W" letter (for Word).
 * Pure Node.js - no dependencies.
 */
import fs from 'fs';
import zlib from 'zlib';
import path from 'path';

const ICON_DIR = 'src/icons';

function createPNG(width, height, pixelData) {
  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  const ihdrChunk = createChunk('IHDR', ihdr);

  // IDAT chunk - raw pixel data with filter bytes
  const rawData = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    rawData[y * (1 + width * 4)] = 0; // filter: None
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * 4;
      const dstIdx = y * (1 + width * 4) + 1 + x * 4;
      rawData[dstIdx] = pixelData[srcIdx];     // R
      rawData[dstIdx + 1] = pixelData[srcIdx + 1]; // G
      rawData[dstIdx + 2] = pixelData[srcIdx + 2]; // B
      rawData[dstIdx + 3] = pixelData[srcIdx + 3]; // A
    }
  }
  const compressed = zlib.deflateSync(rawData);
  const idatChunk = createChunk('IDAT', compressed);

  // IEND chunk
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const typeBuffer = Buffer.from(type, 'ascii');
  const crcData = Buffer.concat([typeBuffer, data]);

  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcData), 0);

  return Buffer.concat([length, typeBuffer, data, crc]);
}

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function generateIcon(size) {
  const pixels = new Uint8Array(size * size * 4);

  const bgR = 59, bgG = 130, bgB = 246; // Blue background
  const fgR = 255, fgG = 255, fgB = 255; // White foreground

  // Fill background with rounded corners
  const radius = Math.floor(size * 0.15);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;

      // Check if inside rounded rectangle
      let inside = true;
      // Top-left corner
      if (x < radius && y < radius) {
        inside = ((x - radius) ** 2 + (y - radius) ** 2) <= radius ** 2;
      }
      // Top-right corner
      if (x >= size - radius && y < radius) {
        inside = ((x - (size - radius - 1)) ** 2 + (y - radius) ** 2) <= radius ** 2;
      }
      // Bottom-left corner
      if (x < radius && y >= size - radius) {
        inside = ((x - radius) ** 2 + (y - (size - radius - 1)) ** 2) <= radius ** 2;
      }
      // Bottom-right corner
      if (x >= size - radius && y >= size - radius) {
        inside = ((x - (size - radius - 1)) ** 2 + (y - (size - radius - 1)) ** 2) <= radius ** 2;
      }

      if (inside) {
        pixels[idx] = bgR;
        pixels[idx + 1] = bgG;
        pixels[idx + 2] = bgB;
        pixels[idx + 3] = 255;
      } else {
        pixels[idx + 3] = 0; // transparent
      }
    }
  }

  // Draw "W" letter
  const scale = size / 128;
  drawW(pixels, size, scale, fgR, fgG, fgB);

  // Draw small "fx" math symbol in corner
  drawFx(pixels, size, scale, fgR, fgG, fgB);

  return createPNG(size, size, Buffer.from(pixels.buffer));
}

function setPixel(pixels, size, x, y, r, g, b, a = 255) {
  x = Math.round(x);
  y = Math.round(y);
  if (x < 0 || x >= size || y < 0 || y >= size) return;
  const idx = (y * size + x) * 4;
  if (pixels[idx + 3] > 0) { // only draw on existing background
    pixels[idx] = r;
    pixels[idx + 1] = g;
    pixels[idx + 2] = b;
    pixels[idx + 3] = a;
  }
}

function drawThickLine(pixels, size, x0, y0, x1, y1, thickness, r, g, b) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.sqrt(dx * dx + dy * dy);
  const steps = Math.ceil(len * 2);

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const cx = x0 + dx * t;
    const cy = y0 + dy * t;

    for (let oy = -thickness; oy <= thickness; oy++) {
      for (let ox = -thickness; ox <= thickness; ox++) {
        if (ox * ox + oy * oy <= thickness * thickness) {
          setPixel(pixels, size, cx + ox, cy + oy, r, g, b);
        }
      }
    }
  }
}

function drawW(pixels, size, scale, r, g, b) {
  const thick = Math.max(2, Math.floor(8 * scale));
  const top = Math.floor(25 * scale);
  const bottom = Math.floor(95 * scale);
  const left = Math.floor(20 * scale);
  const right = Math.floor(108 * scale);
  const midX = Math.floor(64 * scale);
  const midY = Math.floor(65 * scale);

  // W shape: 5 points connected by 4 lines
  drawThickLine(pixels, size, left, top, left + (midX - left) * 0.35, bottom, thick, r, g, b);
  drawThickLine(pixels, size, left + (midX - left) * 0.35, bottom, midX, midY, thick, r, g, b);
  drawThickLine(pixels, size, midX, midY, right - (right - midX) * 0.35, bottom, thick, r, g, b);
  drawThickLine(pixels, size, right - (right - midX) * 0.35, bottom, right, top, thick, r, g, b);
}

function drawFx(pixels, size, scale, r, g, b) {
  // Small "f(x)" indicator in bottom-right area
  if (size < 48) return; // Skip for small icons

  const thick = Math.max(1, Math.floor(3 * scale));
  const baseX = Math.floor(78 * scale);
  const baseY = Math.floor(98 * scale);
  const fSize = Math.floor(18 * scale);

  // Draw italic "f" - a small curve
  drawThickLine(pixels, size, baseX + fSize * 0.3, baseY, baseX + fSize * 0.5, baseY - fSize, thick, r, g, b);
  drawThickLine(pixels, size, baseX, baseY - fSize * 0.5, baseX + fSize * 0.7, baseY - fSize * 0.5, thick, r, g, b);
}

// Main
if (!fs.existsSync(ICON_DIR)) {
  fs.mkdirSync(ICON_DIR, { recursive: true });
}

for (const size of [16, 48, 128]) {
  const png = generateIcon(size);
  const filePath = path.join(ICON_DIR, `icon${size}.png`);
  fs.writeFileSync(filePath, png);
  console.log(`✓ Generated ${filePath} (${png.length} bytes)`);
}

console.log('✓ All icons generated');
