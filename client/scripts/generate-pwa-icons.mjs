/*
 * Generates the PWA icon set from the same two-shed mark as public/favicon.svg,
 * so the installed app, the tab and the launcher all carry one identity.
 *
 *   npm run icons:generate
 *
 * Written with only Node built-ins on purpose: an icon set is four small files
 * that change once a year, which is not worth an image-processing dependency.
 * Shapes are drawn by distance field with 4x4 supersampling, then encoded as
 * PNG (RGBA, single IDAT) with node:zlib.
 */

import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");

/* Palette — index.css tokens. */
const INK = [0x16, 0x21, 0x1c];
const PAPER = [0xf2, 0xf0, 0xe9];
const CLAY = [0xb0, 0x6c, 0x2c];

/* Geometry in the favicon's 32x32 space. */
const TILE = 32;
const TILE_RADIUS = 5;
const SHED_STROKE = 1; // half-width; the SVG uses stroke-width 2
const GROUND_STROKE = 1.25;

/** Both shed outlines, as closed polylines. */
const SHEDS = [
  [
    [6, 20],
    [6, 14],
    [11, 10],
    [16, 14],
    [16, 20],
    [6, 20],
  ],
  [
    [16, 20],
    [16, 14],
    [21, 10],
    [26, 14],
    [26, 20],
    [16, 20],
  ],
];

const GROUND = [
  [6, 21],
  [26, 21],
];

function distanceToSegment(x, y, [ax, ay], [bx, by]) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const t =
    lengthSquared === 0
      ? 0
      : Math.min(1, Math.max(0, ((x - ax) * dx + (y - ay) * dy) / lengthSquared));

  return Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
}

function distanceToPolyline(x, y, points) {
  let best = Infinity;

  for (let index = 0; index < points.length - 1; index += 1) {
    best = Math.min(best, distanceToSegment(x, y, points[index], points[index + 1]));
  }

  return best;
}

function insideRoundedTile(x, y) {
  const inset = TILE_RADIUS;
  const cx = Math.min(Math.max(x, inset), TILE - inset);
  const cy = Math.min(Math.max(y, inset), TILE - inset);

  if (x < 0 || y < 0 || x > TILE || y > TILE) {
    return false;
  }

  return Math.hypot(x - cx, y - cy) <= inset;
}

/**
 * @param {number} size pixel width/height
 * @param {{ bleed: boolean, markScale: number }} options
 *   bleed fills the whole square (maskable / Apple), otherwise the tile is a
 *   rounded rectangle on transparency. markScale shrinks the mark towards the
 *   centre so maskable icons keep their safe zone.
 */
function renderIcon(size, { bleed, markScale }) {
  const samples = 4;
  const pixels = Buffer.alloc(size * size * 4);

  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let covered = 0;

      for (let sy = 0; sy < samples; sy += 1) {
        for (let sx = 0; sx < samples; sx += 1) {
          const u = ((px + (sx + 0.5) / samples) / size) * TILE;
          const v = ((py + (sy + 0.5) / samples) / size) * TILE;

          if (!bleed && !insideRoundedTile(u, v)) {
            continue;
          }

          // Mark coordinates: scaled about the centre of the tile.
          const mu = (u - TILE / 2) / markScale + TILE / 2;
          const mv = (v - TILE / 2) / markScale + TILE / 2;

          let colour = INK;

          const shedDistance = Math.min(
            ...SHEDS.map((shed) => distanceToPolyline(mu, mv, shed)),
          );

          if (shedDistance <= SHED_STROKE) {
            colour = PAPER;
          }

          // Drawn last, exactly as in the SVG: the ground line sits on top.
          if (distanceToPolyline(mu, mv, GROUND) <= GROUND_STROKE) {
            colour = CLAY;
          }

          r += colour[0];
          g += colour[1];
          b += colour[2];
          covered += 1;
        }
      }

      const total = samples * samples;
      const offset = (py * size + px) * 4;

      if (covered > 0) {
        pixels[offset] = Math.round(r / covered);
        pixels[offset + 1] = Math.round(g / covered);
        pixels[offset + 2] = Math.round(b / covered);
        pixels[offset + 3] = Math.round((covered / total) * 255);
      }
    }
  }

  return pixels;
}

/* PNG encoding ------------------------------------------------------------ */

const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let c = index;

  for (let bit = 0; bit < 8; bit += 1) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }

  return c >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;

  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);

  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));

  return Buffer.concat([length, body, crc]);
}

function encodePng(size, pixels) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // colour type: RGBA
  header[10] = 0; // deflate
  header[11] = 0; // adaptive filtering
  header[12] = 0; // no interlace

  // One filter byte (0 = none) per scanline.
  const raw = Buffer.alloc(size * (size * 4 + 1));

  for (let y = 0; y < size; y += 1) {
    const rowStart = y * (size * 4 + 1);
    raw[rowStart] = 0;
    pixels.copy(raw, rowStart + 1, y * size * 4, (y + 1) * size * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/* Output ------------------------------------------------------------------ */

const TARGETS = [
  { file: "icon-192.png", size: 192, bleed: false, markScale: 1 },
  { file: "icon-512.png", size: 512, bleed: false, markScale: 1 },
  // Maskable icons get cropped to a circle on Android, so the mark stays well
  // inside the safe zone and the ink reaches every edge.
  { file: "icon-maskable-512.png", size: 512, bleed: true, markScale: 0.72 },
  { file: "apple-touch-icon-180.png", size: 180, bleed: true, markScale: 0.78 },
];

mkdirSync(OUT_DIR, { recursive: true });

for (const target of TARGETS) {
  const png = encodePng(
    target.size,
    renderIcon(target.size, { bleed: target.bleed, markScale: target.markScale }),
  );

  writeFileSync(join(OUT_DIR, target.file), png);
  console.log(`${target.file}  ${target.size}x${target.size}  ${png.length} bytes`);
}
