/**
 * Minimal QR code encoder (byte mode, ECC level M, versions 1-6).
 *
 * Implemented from the QR/IEC 18004 spec so referral share links can be
 * rendered offline without any third-party dependency. Supports payloads up
 * to 106 bytes, which comfortably covers full https:// URLs for the share
 * page. Versions >= 7 (which add version-info blocks) are intentionally
 * out of scope.
 */

const ECC_LEVEL_M = 0; // format-info bits for level M

/** Data codewords (bytes) per version at ECC level M. */
const DATA_CODEWORDS: Record<number, number> = { 1: 16, 2: 28, 3: 44, 4: 64, 5: 86, 6: 108 };
/** ECC codewords per block at level M. */
const ECC_PER_BLOCK: Record<number, number> = { 1: 10, 2: 16, 3: 26, 4: 18, 5: 24, 6: 16 };
/** Number of blocks at level M (all equal-sized for versions 1-6). */
const BLOCKS: Record<number, number> = { 1: 1, 2: 1, 3: 1, 4: 2, 5: 2, 6: 4 };
/** Alignment pattern center coordinates per version. */
const ALIGNMENT: Record<number, number[]> = { 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34] };

const MIN_VERSION = 1;
const MAX_VERSION = 6;

/* ------------------------------------------------------------------ */
/*  Galois field GF(256) arithmetic (primitive polynomial 0x11d)      */
/* ------------------------------------------------------------------ */

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(function initGf() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

/** Reed-Solomon generator polynomial of the given degree (monic, ascending powers). */
export function rsGenerator(degree: number): number[] {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= gfMul(poly[j], GF_EXP[i]);
      next[j + 1] ^= poly[j];
    }
    // The loop above builds (poly * (x + a^i)) but with ascending order,
    // so shift coefficients into place.
    poly = next;
  }
  return poly;
}

/** Reed-Solomon remainder for data bytes; returned in transmission order (highest degree first). */
export function rsEncode(data: number[], eccCount: number): number[] {
  const gen = rsGenerator(eccCount); // ascending order, length eccCount+1, monic
  const rem = new Array<number>(eccCount).fill(0);
  for (const byte of data) {
    const factor = byte ^ rem[eccCount - 1];
    for (let i = eccCount - 1; i > 0; i--) rem[i] = rem[i - 1];
    rem[0] = 0;
    for (let i = 0; i < eccCount; i++) {
      rem[i] ^= gfMul(gen[i], factor);
    }
  }
  return rem.reverse(); // highest-degree coefficient first, matching data byte order
}

/* ------------------------------------------------------------------ */
/*  Bit stream + codeword assembly                                     */
/* ------------------------------------------------------------------ */

class BitBuffer {
  bits: number[] = [];
  put(value: number, length: number): void {
    for (let i = length - 1; i >= 0; i--) this.bits.push((value >>> i) & 1);
  }
  get length(): number {
    return this.bits.length;
  }
  toBytes(): number[] {
    const out: number[] = [];
    for (let i = 0; i < this.bits.length; i += 8) {
      let byte = 0;
      for (let j = 0; j < 8; j++) {
        byte = (byte << 1) | (this.bits[i + j] ?? 0);
      }
      out.push(byte);
    }
    return out;
  }
}

/** Choose the smallest version (1-6) that fits the payload at ECC M. */
function pickVersion(byteLength: number): number {
  for (let v = MIN_VERSION; v <= MAX_VERSION; v++) {
    // Overhead: 4-bit mode + 8-bit length = 12 bits; capacity in whole bytes.
    if (byteLength <= DATA_CODEWORDS[v] - 2) return v;
  }
  throw new RangeError(`Payload too long for this QR encoder (max ${DATA_CODEWORDS[MAX_VERSION] - 2} bytes).`);
}

/** Build the final interleaved codeword list (data + ecc) for the version. */
function buildCodewords(payload: Uint8Array, version: number): number[] {
  const dataCount = DATA_CODEWORDS[version];
  const buf = new BitBuffer();
  buf.put(0b0100, 4); // byte mode
  buf.put(payload.length, 8); // count indicator for versions 1-9
  for (const byte of payload) buf.put(byte, 8);
  // Terminator (up to 4 zero bits) then pad to byte boundary.
  const capacityBits = dataCount * 8;
  buf.put(0, Math.min(4, capacityBits - buf.length));
  while (buf.length % 8 !== 0) buf.bits.push(0);
  // Pad bytes 0xEC / 0x11.
  const data = buf.toBytes();
  const pad = [0xec, 0x11];
  let pi = 0;
  while (data.length < dataCount) data.push(pad[pi++ % 2]);

  const blockCount = BLOCKS[version];
  const dataPerBlock = dataCount / blockCount;
  const eccCount = ECC_PER_BLOCK[version];

  const dataBlocks: number[][] = [];
  const eccBlocks: number[][] = [];
  for (let b = 0; b < blockCount; b++) {
    const block = data.slice(b * dataPerBlock, (b + 1) * dataPerBlock);
    dataBlocks.push(block);
    eccBlocks.push(rsEncode(block, eccCount));
  }

  // Interleave (all blocks are equal-sized for versions 1-6 at ECC M).
  const out: number[] = [];
  for (let i = 0; i < dataPerBlock; i++) {
    for (let b = 0; b < blockCount; b++) out.push(dataBlocks[b][i]);
  }
  for (let i = 0; i < eccCount; i++) {
    for (let b = 0; b < blockCount; b++) out.push(eccBlocks[b][i]);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/*  Matrix construction                                                */
/* ------------------------------------------------------------------ */

interface Grid {
  size: number;
  modules: boolean[][];
  reserved: boolean[][];
}

function newGrid(size: number): Grid {
  const modules = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const reserved = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  return { size, modules, reserved };
}

function setFunction(g: Grid, row: number, col: number, dark: boolean): void {
  g.modules[row][col] = dark;
  g.reserved[row][col] = true;
}

function drawFinder(g: Grid, row: number, col: number): void {
  for (let r = -1; r <= 7; r++) {
    for (let c = -1; c <= 7; c++) {
      const rr = row + r;
      const cc = col + c;
      if (rr < 0 || rr >= g.size || cc < 0 || cc >= g.size) continue;
      const inRing = (r >= 0 && r <= 6 && (c === 0 || c === 6)) || (c >= 0 && c <= 6 && (r === 0 || r === 6));
      const inCore = r >= 2 && r <= 4 && c >= 2 && c <= 4;
      setFunction(g, rr, cc, inRing || inCore);
    }
  }
}

function drawAlignment(g: Grid, version: number): void {
  const centers = ALIGNMENT[version];
  if (!centers) return;
  for (const r of centers) {
    for (const c of centers) {
      // Skip patterns that overlap finder corners.
      if ((r <= 8 && c <= 8) || (r <= 8 && c >= g.size - 9) || (r >= g.size - 9 && c <= 8)) continue;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const ring = Math.max(Math.abs(dr), Math.abs(dc));
          setFunction(g, r + dr, c + dc, ring !== 1);
        }
      }
    }
  }
}

/** BCH(15,5) format info for ECC level M and the given mask. */
export function formatBits(mask: number): number {
  const data = (ECC_LEVEL_M << 3) | mask;
  let bits = data << 10;
  const g = 0b10100110111; // 0x537
  for (let i = 14; i >= 10; i--) {
    if ((bits >>> i) & 1) bits ^= g << (i - 10);
  }
  return ((data << 10) | bits) ^ 0b101010000010010;
}

function drawFormat(g: Grid, mask: number): void {
  const bits = formatBits(mask);
  const bit = (i: number): boolean => ((bits >>> i) & 1) === 1;
  for (let i = 0; i < 15; i++) {
    // Vertical copy (column 8).
    if (i < 6) setFunction(g, i, 8, bit(i));
    else if (i < 8) setFunction(g, i + 1, 8, bit(i));
    else setFunction(g, g.size - 15 + i, 8, bit(i));
    // Horizontal copy (row 8).
    if (i < 8) setFunction(g, 8, g.size - 1 - i, bit(i));
    else if (i === 8) setFunction(g, 8, 7, bit(i));
    else setFunction(g, 8, 14 - i, bit(i));
  }
  setFunction(g, g.size - 8, 8, true); // always-dark module
}

function drawFunctionPatterns(g: Grid, version: number): void {
  drawFinder(g, 0, 0);
  drawFinder(g, 0, g.size - 7);
  drawFinder(g, g.size - 7, 0);
  // Timing patterns.
  for (let i = 8; i < g.size - 8; i++) {
    const dark = i % 2 === 0;
    if (!g.reserved[6][i]) setFunction(g, 6, i, dark);
    if (!g.reserved[i][6]) setFunction(g, i, 6, dark);
  }
  drawAlignment(g, version);
  drawFormat(g, 0); // placeholder; redrawn with real mask after choosing
}

/** Place codeword bits in the zigzag data region (skips reserved modules). */
function placeData(g: Grid, codewords: number[]): void {
  const bits: number[] = [];
  for (const cw of codewords) {
    for (let i = 7; i >= 0; i--) bits.push((cw >>> i) & 1);
  }
  let idx = 0;
  let upward = true;
  for (let right = g.size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5; // skip the vertical timing column
    for (let v = 0; v < g.size; v++) {
      const row = upward ? g.size - 1 - v : v;
      for (let d = 0; d < 2; d++) {
        const col = right - d;
        if (g.reserved[row][col]) continue;
        g.modules[row][col] = idx < bits.length ? bits[idx++] === 1 : false;
      }
    }
    upward = !upward;
  }
}

/* ------------------------------------------------------------------ */
/*  Masking + penalty scoring                                          */
/* ------------------------------------------------------------------ */

const MASKS: ((row: number, col: number) => boolean)[] = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (_r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

function applyMask(g: Grid, mask: number): void {
  const fn = MASKS[mask];
  for (let r = 0; r < g.size; r++) {
    for (let c = 0; c < g.size; c++) {
      if (!g.reserved[r][c] && fn(r, c)) g.modules[r][c] = !g.modules[r][c];
    }
  }
}

const N3_PATTERN_A = [true, false, true, true, true, false, true, false, false, false, false];
const N3_PATTERN_B = [false, false, false, false, true, false, true, true, true, false, true];

function matchesAt(line: boolean[], start: number, pattern: boolean[]): boolean {
  for (let i = 0; i < pattern.length; i++) {
    if (line[start + i] !== pattern[i]) return false;
  }
  return true;
}

function penaltyScore(g: Grid): number {
  let penalty = 0;
  const size = g.size;

  const scanLine = (line: boolean[]) => {
    // N1: runs of >= 5 same-color modules.
    let runLen = 1;
    for (let i = 1; i <= line.length; i++) {
      if (i < line.length && line[i] === line[i - 1]) {
        runLen++;
      } else {
        if (runLen >= 5) penalty += 3 + (runLen - 5);
        runLen = 1;
      }
    }
    // N3: finder-like 1011101 patterns with 4 light modules on either side.
    for (let i = 0; i + 11 <= line.length; i++) {
      if (matchesAt(line, i, N3_PATTERN_A) || matchesAt(line, i, N3_PATTERN_B)) penalty += 40;
    }
  };

  for (let r = 0; r < size; r++) scanLine(g.modules[r]);
  for (let c = 0; c < size; c++) scanLine(g.modules.map((row) => row[c]));

  // N2: 2x2 blocks of the same color.
  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size - 1; c++) {
      const v = g.modules[r][c];
      if (v === g.modules[r][c + 1] && v === g.modules[r + 1][c] && v === g.modules[r + 1][c + 1]) penalty += 3;
    }
  }

  // N4: deviation of dark-module ratio from 50%.
  let dark = 0;
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (g.modules[r][c]) dark++;
  const percent = (dark * 100) / (size * size);
  penalty += 10 * Math.floor(Math.abs(percent - 50) / 5);

  return penalty;
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

export interface QrCode {
  version: number;
  size: number;
  /** Row-major matrix; true = dark module. */
  modules: boolean[][];
}

/** Encode text into a QR code (byte mode, ECC level M, versions 1-6). */
export function encodeQr(text: string): QrCode {
  const payload = new TextEncoder().encode(text);
  const version = pickVersion(payload.length);
  const codewords = buildCodewords(payload, version);
  const size = version * 4 + 17;

  const base = newGrid(size);
  drawFunctionPatterns(base, version);
  placeData(base, codewords);

  let best: Grid | null = null;
  let bestScore = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    const g: Grid = { size, modules: base.modules.map((row) => row.slice()), reserved: base.reserved };
    applyMask(g, mask);
    drawFormat(g, mask);
    const score = penaltyScore(g);
    if (score < bestScore) {
      bestScore = score;
      best = g;
    }
  }

  return { version, size, modules: best!.modules };
}

/** Render a QR code as a standalone SVG string (no external assets). */
export function qrToSvg(qr: QrCode, opts?: { moduleSize?: number; margin?: number; title?: string }): string {
  const m = opts?.moduleSize ?? 8;
  const margin = opts?.margin ?? 4;
  const dim = (qr.size + margin * 2) * m;
  const parts: string[] = [];
  for (let r = 0; r < qr.size; r++) {
    for (let c = 0; c < qr.size; c++) {
      if (qr.modules[r][c]) {
        parts.push(`M${(c + margin) * m} ${(r + margin) * m}h${m}v${m}h-${m}z`);
      }
    }
  }
  const title = opts?.title ? `<title>${escapeXml(opts.title)}</title>` : "";
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${dim}" height="${dim}" viewBox="0 0 ${dim} ${dim}" role="img">` +
    `${title}<rect width="${dim}" height="${dim}" fill="#ffffff"/><path d="${parts.join("")}" fill="#000000"/></svg>`
  );
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
