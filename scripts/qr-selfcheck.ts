import assert from "node:assert";
import { encodeQr, qrToSvg, rsGenerator, rsEncode, formatBits } from "../src/lib/qr";

function gfMul(a: number, b: number): number {
  let result = 0;
  while (b > 0) {
    if (b & 1) result ^= a;
    b >>= 1;
    a <<= 1;
    if (a & 0x100) a ^= 0x11d;
  }
  return result;
}

/** Independent polynomial remainder. `poly` is in transmission order (highest degree first). */
function polyRemTransmissionOrder(poly: number[], gen: number[]): number[] {
  // gen is ascending; convert poly to ascending, divide, return ascending remainder.
  const rem = [...poly].reverse();
  const n = gen.length - 1;
  for (let i = rem.length - 1; i >= n; i--) {
    const factor = rem[i];
    if (factor === 0) continue;
    for (let j = 0; j <= n; j++) {
      rem[i - n + j] ^= gfMul(gen[j], factor);
    }
  }
  return rem.slice(0, n);
}

// rsGenerator
assert.deepStrictEqual(rsGenerator(1), [1, 1], "gen1");
assert.deepStrictEqual(rsGenerator(2), [2, 3, 1], "gen2");
for (const n of [10, 16, 18, 24, 26]) {
  const gen = rsGenerator(n);
  assert.strictEqual(gen.length, n + 1, `gen len ${n}`);
  assert.strictEqual(gen[n], 1, `gen monic ${n}`);
}

// rsEncode divisibility
const cases: Array<[number[], number]> = [
  [[0x40, 0xd2, 0x75, 0x47, 0x76, 0x17, 0x32, 0x06, 0x27, 0x26, 0x96, 0xc6, 0xc6, 0x96, 0x70, 0xec], 10],
  [[1, 2, 3, 4, 5], 2],
  [[0], 10],
  [new Array(28).fill(0xec).map((v, i) => (v ^ i) & 0xff), 16],
  [new Array(32).fill(0x11).map((v, i) => (v ^ (i * 7)) & 0xff), 18],
];
for (const [data, eccCount] of cases) {
  const ecc = rsEncode(data, eccCount);
  assert.strictEqual(ecc.length, eccCount, "ecc length");
  const rem = polyRemTransmissionOrder([...data, ...ecc], rsGenerator(eccCount));
  assert.ok(rem.every((v) => v === 0), "divisibility");
}

// Known test vector replaced by a rigorous RS syndrome check below:
// a valid codeword c(x) = data·x^n + ecc must satisfy c(α^i) = 0 for i = 0..n-1.
// α^k is computed via independent shift-and-xor exponentiation (not the log tables in qr.ts).
function gfPowAlpha(k: number): number {
  let result = 1;
  for (let i = 0; i < k; i++) {
    result = gfMul(result, 2); // multiply by α = 2
  }
  return result;
}

function syndromesZero(codewordTrans: number[], eccCount: number): boolean {
  // Ascending coefficients: index = degree.
  const asc = [...codewordTrans].reverse();
  for (let s = 0; s < eccCount; s++) {
    const alphaS = gfPowAlpha(s);
    let sum = 0;
    let alphaPow = 1; // α^(s·0)
    for (let j = 0; j < asc.length; j++) {
      if (asc[j] !== 0) sum ^= gfMul(asc[j], alphaPow);
      alphaPow = gfMul(alphaPow, alphaS);
    }
    if (sum !== 0) return false;
  }
  return true;
}

for (const [data, eccCount] of cases) {
  const ecc = rsEncode(data, eccCount);
  assert.strictEqual(syndromesZero([...data, ...ecc], eccCount), true, "rs syndromes");
}

// Also verify hand-computed small case: data [1,2,3,4,5] with eccCount=2.
{
  const ecc = rsEncode([1, 2, 3, 4, 5], 2);
  assert.strictEqual(syndromesZero([1, 2, 3, 4, 5, ...ecc], 2), true, "small case syndromes");
}

// formatBits table (ECC M)
assert.strictEqual(formatBits(0), 0b101010000010010);
assert.strictEqual(formatBits(1), 0b101000100100101);
assert.strictEqual(formatBits(2), 0b101111001111100);
assert.strictEqual(formatBits(3), 0b101101101001011);
assert.strictEqual(formatBits(4), 0b100010111111001);
assert.strictEqual(formatBits(5), 0b100000011001110);
assert.strictEqual(formatBits(6), 0b100111110010111);
assert.strictEqual(formatBits(7), 0b100101010100000);

// encodeQr structure
const qr = encodeQr("https://example.com/share/ABC123"); // 33 bytes -> v3 (v2 caps at 26)
assert.strictEqual(qr.version, 3, "version for ~33 byte url");
assert.strictEqual(qr.size, 29, "v3 size");
const checkFinder = (row: number, col: number) => {
  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < 7; c++) {
      const ring = r === 0 || r === 6 || c === 0 || c === 6;
      const core = r >= 2 && r <= 4 && c >= 2 && c <= 4;
      assert.strictEqual(qr.modules[row + r][col + c], ring || core, `finder at ${row + r},${col + c}`);
    }
  }
};
checkFinder(0, 0);
checkFinder(0, qr.size - 7);
checkFinder(qr.size - 7, 0);
for (let i = 8; i < qr.size - 8; i++) {
  assert.strictEqual(qr.modules[6][i], i % 2 === 0, `timing row ${i}`);
  assert.strictEqual(qr.modules[i][6], i % 2 === 0, `timing col ${i}`);
}
assert.strictEqual(qr.modules[qr.size - 8][8], true, "dark module");

// version selection boundaries
assert.strictEqual(encodeQr("x".repeat(14)).version, 1);
assert.strictEqual(encodeQr("x".repeat(15)).version, 2);
assert.strictEqual(encodeQr("x".repeat(26)).version, 2);
assert.strictEqual(encodeQr("x".repeat(27)).version, 3);
assert.strictEqual(encodeQr("x".repeat(106)).version, 6);
assert.throws(() => encodeQr("x".repeat(107)), RangeError);

// determinism
assert.deepStrictEqual(encodeQr("abc"), encodeQr("abc"), "deterministic");

// svg
const svg = qrToSvg(qr, { moduleSize: 4, margin: 2, title: "QR <x>" });
assert.ok(svg.startsWith("<svg"), "svg start");
assert.ok(svg.endsWith("</svg>"), "svg end");
assert.ok(svg.includes("<title>QR &lt;x&gt;</title>"), "escaped title");

console.log("QR selfcheck: all assertions passed");
