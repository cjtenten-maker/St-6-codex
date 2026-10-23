import fs from "fs";
import zlib from "zlib";
import path from "path";

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type), data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

function png(size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    const row = y * (size * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x, y, size);
      const i = row + 1 + x * 4;
      raw[i] = r;
      raw[i + 1] = g;
      raw[i + 2] = b;
      raw[i + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function insideDodecagon(x, y, size, radius) {
  const dx = x - size / 2 + 0.5;
  const dy = y - size / 2 + 0.5;
  const angle = Math.atan2(dy, dx);
  const sector = Math.PI / 6;
  const local = ((angle % sector) + sector) % sector - sector / 2;
  const limit = radius / Math.cos(local);
  return Math.hypot(dx, dy) <= limit;
}

function pixel(x, y, size) {
  const ink = [12, 15, 13, 255];
  const brass = [224, 164, 90, 255];
  const outer = insideDodecagon(x, y, size, size * 0.36);
  const inner = insideDodecagon(x, y, size, size * 0.3);
  if (outer && !inner) return brass;
  const dx = x - size / 2 + 0.5;
  const dy = y - size / 2 + 0.5;
  const six = glyph6(dx / size, dy / size);
  if (six) return brass;
  return ink;
}

/** A small "6" drawn in normalized coordinates around the center. */
function glyph6(nx, ny) {
  const x = nx;
  const y = ny;
  const inRing = (cx, cy, r, thickness) => {
    const d = Math.hypot(x - cx, y - cy);
    return d <= r && d >= r - thickness;
  };
  const loop = inRing(0, 0.045, 0.09, 0.035);
  const stem = x > -0.02 && x < 0.02 && y > -0.12 && y < 0.04 && Math.abs(x + 0.07) > 0.04
    ? false
    : x > -0.095 && x < -0.055 && y > -0.11 && y < 0.05;
  const cap = y > -0.13 && y < -0.09 && x > -0.09 && x < 0.04;
  return loop || stem || cap;
}

const publicDir = path.join(process.cwd(), "public");
fs.writeFileSync(path.join(publicDir, "icon-512.png"), png(512, pixel));
fs.writeFileSync(path.join(publicDir, "icon-192.png"), png(192, pixel));
fs.writeFileSync(path.join(publicDir, "apple-touch-icon.png"), png(180, pixel));
