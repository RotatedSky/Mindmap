const zlib = require("zlib");
const fs = require("fs");
const path = require("path");

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function png(size, pixelFn) {
  const stride = 1 + size * 4;
  const raw = Buffer.alloc(size * stride);
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixelFn(x, y);
      const o = y * stride + 1 + x * 4;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

const BG = [0x2e, 0x6f, 0xb0];
const FG = [255, 255, 255];

function inCircle(px, py, cx, cy, r) {
  const dx = px - cx, dy = py - cy;
  return dx * dx + dy * dy <= r * r;
}

function drawIcon(size) {
  const k = size / 512;
  const rootX = 0.2 * size, rootY = 0.5 * size, rootR = 0.075 * size;
  const branches = [
    { x: 0.55, y: 0.28, r: 0.055 },
    { x: 0.62, y: 0.48, r: 0.045 },
    { x: 0.55, y: 0.68, r: 0.06 },
    { x: 0.63, y: 0.84, r: 0.04 }
  ];
  return (x, y) => {
    if (inCircle(x + 0.5, y + 0.5, rootX, rootY, rootR)) return [...FG, 255];
    for (const b of branches) {
      if (inCircle(x + 0.5, y + 0.5, b.x * size, b.y * size, b.r * size)) return [...FG, 255];
    }
    for (const b of branches) {
      const dx = b.x * size - rootX, dy = b.y * size - rootY;
      const len = Math.hypot(dx, dy);
      const ux = dx / len, uy = dy / len;
      const px = x + 0.5 - rootX, py = y + 0.5 - rootY;
      const t = px * ux + py * uy;
      if (t > 0 && t < len) {
        const dist = Math.abs(py * ux - px * uy);
        if (dist < 0.018 * size) return [...FG, 255];
      }
    }
    return [...BG, 255];
  };
}

for (const size of [192, 512]) {
  fs.writeFileSync(path.join(__dirname, "..", "icon-" + size + ".png"), png(size, drawIcon(size)));
  console.log("icon-" + size + ".png written");
}
