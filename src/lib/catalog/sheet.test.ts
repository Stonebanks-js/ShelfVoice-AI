import { deflateRawSync } from "node:zlib";

import { describe, expect, it } from "vitest";

import { parseCsv, readXlsx, rowsToProducts, TEMPLATE_CSV } from "./sheet";

// A minimal .xlsx: a zip holding the shared strings and one worksheet, the
// way Excel and billing apps write them (deflated entries).
function xlsx(files: Record<string, string>): Uint8Array {
  const local: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const nameBytes = Buffer.from(name);
    const data = deflateRawSync(Buffer.from(content));
    const head = Buffer.alloc(30);
    head.writeUInt32LE(0x04034b50, 0);
    head.writeUInt16LE(8, 8);
    head.writeUInt32LE(data.length, 18);
    head.writeUInt32LE(content.length, 22);
    head.writeUInt16LE(nameBytes.length, 26);
    local.push(head, nameBytes, data);
    const dir = Buffer.alloc(46);
    dir.writeUInt32LE(0x02014b50, 0);
    dir.writeUInt16LE(8, 10);
    dir.writeUInt32LE(data.length, 20);
    dir.writeUInt32LE(content.length, 24);
    dir.writeUInt16LE(nameBytes.length, 28);
    dir.writeUInt32LE(offset, 42);
    central.push(dir, nameBytes);
    offset += head.length + nameBytes.length + data.length;
  }
  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...local, directory, end]));
}

describe("CSV", () => {
  it("reads quoted fields, semicolons and Windows line ends", () => {
    expect(parseCsv('Name,MRP\r\n"Atta, 5 kg",290\r\n"Say ""hi""",10\r\n')).toEqual([
      ["Name", "MRP"],
      ["Atta, 5 kg", "290"],
      ['Say "hi"', "10"],
    ]);
    expect(parseCsv("﻿Name;Price\nSalt;28\n\n")).toEqual([
      ["Name", "Price"],
      ["Salt", "28"],
    ]);
  });

  it("turns the template into products", () => {
    expect(rowsToProducts(parseCsv(TEMPLATE_CSV))).toEqual({
      products: [
        { name: "Tata Salt", unit: "1 kg", category: "Staples", price_paise: 2800, stock_qty: 20, barcode: null },
        { name: "Parle-G", unit: "80 g", category: "Biscuits", price_paise: 1000, stock_qty: 48, barcode: null },
      ],
      skipped: 0,
      columns: ["name", "unit", "price", "qty", "category"],
    });
  });
});

describe("billing app exports", () => {
  it("finds the header below a title, prefers MRP over rate, and skips totals", () => {
    const rows = [
      ["Sharma Kirana", "", "", ""],
      ["Item Name", "Rate", "MRP (₹)", "Closing Stock", "Barcode"],
      ["Maggi 70g", "11.50", "₹14", "36", "8901058000290"],
      ["Loose sugar", "40", "1,046.50", "12.7", ""],
      ["", "", "", ""],
      ["Total", "", "", "48"],
    ];
    const result = rowsToProducts(rows);
    expect(result.products).toEqual([
      { name: "Maggi 70g", unit: null, category: null, price_paise: 1400, stock_qty: 36, barcode: "8901058000290" },
      { name: "Loose sugar", unit: null, category: null, price_paise: 104650, stock_qty: 12, barcode: null },
    ]);
    expect(result.skipped).toBe(2);
  });

  it("reads Hindi headers", () => {
    expect(rowsToProducts([["नाम", "दाम"], ["नमक", "28"]]).products[0]).toMatchObject({ name: "नमक", price_paise: 2800 });
  });

  it("takes names and prices from a sheet with no header", () => {
    expect(rowsToProducts([["Tata Salt", "28"], ["Parle-G", "10"]]).products.map((p) => [p.name, p.price_paise])).toEqual([
      ["Tata Salt", 2800],
      ["Parle-G", 1000],
    ]);
  });
});

describe("Excel files", () => {
  it("reads shared strings, inline strings, numbers and gaps", async () => {
    const file = xlsx({
      "[Content_Types].xml": "<Types/>",
      "xl/sharedStrings.xml":
        '<sst><si><t>Product</t></si><si><t>Price</t></si><si><r><t>Amul </t></r><r><t xml:space="preserve">Butter &amp; more</t></r></si></sst>',
      "xl/worksheets/sheet1.xml":
        '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1" t="s"><v>1</v></c></row>' +
        '<row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2" s="1"/><c r="C2"><v>58</v></c></row>' +
        '<row r="3"><c r="A3" t="inlineStr"><is><t>Bread</t></is></c><c r="C3"><v>45.5</v></c></row></sheetData></worksheet>',
    });
    const rows = await readXlsx(file);
    expect(rows).toEqual([
      ["Product", "", "Price"],
      ["Amul Butter & more", "", "58"],
      ["Bread", "", "45.5"],
    ]);
    expect(rowsToProducts(rows).products.map((p) => p.price_paise)).toEqual([5800, 4550]);
  });

  it("refuses something that isn't a zip", async () => {
    await expect(readXlsx(new Uint8Array([1, 2, 3]))).rejects.toThrow("not a zip file");
  });
});
