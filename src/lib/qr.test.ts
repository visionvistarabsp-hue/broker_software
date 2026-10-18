import { describe, it, expect } from "vitest";
import {
  encodeQr,
  qrToSvg,
  rsGenerator,
  rsEncode,
  formatBits,
} from "@/lib/qr";

/** Independent GF(256) multiply (Russian peasant), distinct from the log-table impl. */
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
  const rem = [...poly].reverse(); // convert to ascending (index = degree)
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

/** RS syndrome check: a valid codeword c(x) satisfies c(α^i) = 0 for i = 0..n-1. */
function syndromesZero(codewordTrans: number[], eccCount: number): boolean {
  const asc = [...codewordTrans].reverse();
  const gfPowAlpha = (k: number): number => {
    let r = 1;
    for (let i = 0; i < k; i++) r = gfMul(r, 2);
    return r;
  };
  for (let s = 0; s < eccCount; s++) {
    const alphaS = gfPowAlpha(s);
    let sum = 0;
    let alphaPow = 1;
    for (let j = 0; j < asc.length; j++) {
      if (asc[j] !== 0) sum ^= gfMul(asc[j], alphaPow);
      alphaPow = gfMul(alphaPow, alphaS);
    }
    if (sum !== 0) return false;
  }
  return true;
}

describe("rsGenerator", () => {
  it("degree 2 generator is x^2 + 3x + 2 (ascending: [2,3,1])", () => {
    expect(rsGenerator(2)).toEqual([2, 3, 1]);
  });

  it("degree 1 generator is x + 1 (ascending: [1,1])", () => {
    expect(rsGenerator(1)).toEqual([1, 1]);
  });

  it("degree n has length n+1 and monic leading coefficient", () => {
    for (const n of [1, 2, 10, 16, 18, 24, 26]) {
      const gen = rsGenerator(n);
      expect(gen.length).toBe(n + 1);
      expect(gen[n]).toBe(1);
    }
  });
});

describe("rsEncode", () => {
  it("data + ecc is divisible by the generator polynomial (syndromes all zero)", () => {
    const cases: Array<[number[], number]> = [
      [[0x40, 0xD2, 0x75, 0x47, 0x76, 0x17, 0x32, 0x06, 0x27, 0x26, 0x96, 0xC6, 0xC6, 0x96, 0x70, 0xEC], 10],
      [[1, 2, 3, 4, 5], 2],
      [[0], 10],
      [new Array(28).fill(0xEC).map((v, i) => (v ^ i) & 0xff), 16],
      [new Array(32).fill(0x11).map((v, i) => (v ^ (i * 7)) & 0xff), 18],
    ];
    for (const [data, eccCount] of cases) {
      const ecc = rsEncode(data, eccCount);
      expect(ecc.length).toBe(eccCount);
      const gen = rsGenerator(eccCount);
      const rem = polyRemTransmissionOrder([...data, ...ecc], gen);
      expect(rem.every((v) => v === 0)).toBe(true);
      expect(syndromesZero([...data, ...ecc], eccCount)).toBe(true);
    }
  });
});

describe("formatBits (ECC level M)", () => {
  it("matches the QR spec format-info table for level M", () => {
    expect(formatBits(0)).toBe(0b101010000010010);
    expect(formatBits(1)).toBe(0b101000100100101);
    expect(formatBits(2)).toBe(0b101111001111100);
    expect(formatBits(3)).toBe(0b101101101001011);
    expect(formatBits(4)).toBe(0b100010111111001);
    expect(formatBits(5)).toBe(0b100000011001110);
    expect(formatBits(6)).toBe(0b100111110010111);
    expect(formatBits(7)).toBe(0b100101010100000);
  });
});

describe("encodeQr", () => {
  it("produces version 1 (21x21) for a short payload", () => {
    const qr = encodeQr("HELLO");
    expect(qr.version).toBe(1);
    expect(qr.size).toBe(21);
    expect(qr.modules.length).toBe(21);
    expect(qr.modules.every((row) => row.length === 21)).toBe(true);
  });

  it("selects larger versions for longer payloads", () => {
    expect(encodeQr("x".repeat(14)).version).toBe(1); // v1 capacity 14 bytes
    expect(encodeQr("x".repeat(15)).version).toBe(2);
    expect(encodeQr("x".repeat(26)).version).toBe(2);
    expect(encodeQr("x".repeat(27)).version).toBe(3);
    expect(encodeQr("x".repeat(106)).version).toBe(6);
  });

  it("throws for payloads beyond version 6 capacity", () => {
    expect(() => encodeQr("x".repeat(107))).toThrow(RangeError);
  });

  it("draws finder patterns at all three corners", () => {
    const qr = encodeQr("TEST");
    const checkFinder = (row: number, col: number) => {
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 7; c++) {
          const ring = r === 0 || r === 6 || c === 0 || c === 6;
          const core = r >= 2 && r <= 4 && c >= 2 && c <= 4;
          expect(qr.modules[row + r][col + c]).toBe(ring || core);
        }
      }
    };
    checkFinder(0, 0);
    checkFinder(0, qr.size - 7);
    checkFinder(qr.size - 7, 0);
  });

  it("draws the timing pattern alternating along row 6 and column 6", () => {
    const qr = encodeQr("TIMING");
    for (let i = 8; i < qr.size - 8; i++) {
      expect(qr.modules[6][i]).toBe(i % 2 === 0);
      expect(qr.modules[i][6]).toBe(i % 2 === 0);
    }
  });

  it("sets the always-dark module at (size-8, 8)", () => {
    const qr = encodeQr("DARKMOD");
    expect(qr.modules[qr.size - 8][8]).toBe(true);
  });

  it("is deterministic for the same input", () => {
    const a = encodeQr("https://example.com/share/ABC123");
    const b = encodeQr("https://example.com/share/ABC123");
    expect(a).toEqual(b);
  });

  it("different inputs produce different matrices", () => {
    const a = encodeQr("https://example.com/share/AAA111");
    const b = encodeQr("https://example.com/share/BBB222");
    expect(a.modules).not.toEqual(b.modules);
  });
});

describe("qrToSvg", () => {
  it("renders a standalone SVG with the expected dimensions", () => {
    const qr = encodeQr("SVG");
    const svg = qrToSvg(qr, { moduleSize: 4, margin: 2, title: "QR" });
    const dim = (qr.size + 4) * 4;
    expect(svg).toContain(`<svg xmlns="http://www.w3.org/2000/svg" width="${dim}" height="${dim}"`);
    expect(svg).toContain("<path d=\"M");
    expect(svg).toContain("<title>QR</title>");
    expect(svg.endsWith("</svg>")).toBe(true);
  });

  it("escapes XML special characters in the title", () => {
    const qr = encodeQr("X");
    const svg = qrToSvg(qr, { title: `a<b>&"c"` });
    expect(svg).toContain("<title>a&lt;b&gt;&amp;&quot;c&quot;</title>");
  });
});
