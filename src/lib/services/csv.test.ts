import { describe, it, expect } from "vitest";
import { parseCsv, stringifyCsv, parseCsvWithHeader } from "@/lib/services/csv";

describe("parseCsv", () => {
  it("splits a simple CSV into rows and cells", () => {
    expect(parseCsv("a,b,c\n1,2,3\n4,5,6")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
      ["4", "5", "6"],
    ]);
  });

  it("handles CRLF line endings", () => {
    expect(parseCsv("a,b\r\n1,2\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("quotes cells containing commas", () => {
    expect(parseCsv('name,city\n"Smith, John","New York"')).toEqual([
      ["name", "city"],
      ["Smith, John", "New York"],
    ]);
  });

  it("escapes doubled quotes inside quoted cells", () => {
    expect(parseCsv('note\n"He said ""hi"""')).toEqual([["note"], ['He said "hi"']]);
  });

  it("keeps embedded newlines inside quoted cells", () => {
    expect(parseCsv('note\n"line1\nline2"\nnext')).toEqual([
      ["note"],
      ["line1\nline2"],
      ["next"],
    ]);
  });

  it("returns an empty array for empty input", () => {
    expect(parseCsv("")).toEqual([]);
  });

  it("captures a trailing row without a newline", () => {
    expect(parseCsv("a,b\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});

describe("stringifyCsv", () => {
  it("round-trips simple rows", () => {
    expect(
      stringifyCsv([
        ["a", "b"],
        ["1", "2"],
      ])
    ).toBe("a,b\r\n1,2\r\n");
  });

  it("quotes cells with commas, quotes and newlines", () => {
    expect(stringifyCsv([['a,b', 'c"d', "e\nf"]])).toBe('"a,b","c""d","e\nf"\r\n');
  });

  it("round-trips through parseCsv", () => {
    const rows = [
      ["name", "note"],
      ['O\'Brien', 'he said "hi"'],
      ["city, NY", "line1\nline2"],
    ];
    expect(parseCsv(stringifyCsv(rows))).toEqual(rows);
  });
});

describe("parseCsvWithHeader", () => {
  it("maps rows to objects keyed by trimmed header", () => {
    const { headers, rows } = parseCsvWithHeader("name,age,city\nAlice,30,NY\nBob,25,LA");
    expect(headers).toEqual(["name", "age", "city"]);
    expect(rows).toEqual([
      { name: "Alice", age: "30", city: "NY" },
      { name: "Bob", age: "25", city: "LA" },
    ]);
  });

  it("trims whitespace around headers", () => {
    const { headers } = parseCsvWithHeader(" name , age \nx,y");
    expect(headers).toEqual(["name", "age"]);
  });

  it("handles empty input", () => {
    const { headers, rows } = parseCsvWithHeader("");
    expect(headers).toEqual([]);
    expect(rows).toEqual([]);
  });

  it("makes duplicate headers unique with a numeric suffix", () => {
    const { headers, rows } = parseCsvWithHeader("a,a,a\n1,2,3");
    expect(headers).toEqual(["a", "a__1", "a__2"]);
    expect(rows).toEqual([{ a: "1", "a__1": "2", "a__2": "3" }]);
  });
});
