// Erzeugt icons/icon-192.png und icons/icon-512.png ohne Abhängigkeiten (Sonne auf Türkis).
import { writeFileSync, mkdirSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
mkdirSync(join(root, "icons"), { recursive: true });

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x, y);
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0)),
  ]);
}

const BG = [15, 118, 110], SUN = [253, 224, 71], WHITE = [255, 255, 255];
function pixel(size) {
  const c = size / 2, R = size * 0.2, rayLen = size * 0.36, rayW = size * 0.045;
  return (x, y) => {
    const dx = x - c + 0.5, dy = y - c + 0.5;
    const d = Math.hypot(dx, dy);
    if (d < R) return [...SUN, 255];
    let ang = Math.atan2(dy, dx);
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      let diff = Math.abs(((ang - a + Math.PI) % (2 * Math.PI)) - Math.PI);
      const perp = d * Math.sin(diff);
      if (diff < Math.PI / 2 && d > R + size * 0.03 && d < rayLen && perp < rayW) return [...SUN, 255];
    }
    // dezenter Ring
    if (Math.abs(d - size * 0.42) < size * 0.012) return [...WHITE, 90];
    return [...BG, 255];
  };
}
for (const s of [192, 512]) writeFileSync(join(root, "icons", `icon-${s}.png`), png(s, pixel(s)));
writeFileSync(join(root, "icons", "apple-touch-icon.png"), png(180, pixel(180)));
console.log("Icons erzeugt.");
