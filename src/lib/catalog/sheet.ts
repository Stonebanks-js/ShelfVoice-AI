// Reading a product list from Excel or CSV, in the browser, so
// the file never leaves the phone; only the products the owner keeps are
// sent. Billing apps (Vyapar, Marg, Tally) export either format. A small
// .xlsx reader instead of a library: an .xlsx is a zip of XML files, and
// the browser can inflate zip entries itself.

export interface SheetProduct {
  name: string;
  unit: string | null;
  category: string | null;
  price_paise: number | null;
  stock_qty: number | null;
  barcode: string | null;
}

export const MAX_FILE_BYTES = 5 * 1024 * 1024;

// ---------------------------------------------------------------------- CSV
// Comma, semicolon or tab separated, with quoted fields ("a, b" and "").
export function parseCsv(text: string): string[][] {
  const body = text.replace(/^﻿/, "");
  const firstLine = body.split(/\r?\n/, 1)[0] ?? "";
  const counts = [",", ";", "\t"].map((d) => [d, firstLine.split(d).length] as const);
  const delimiter = counts.reduce((a, b) => (b[1] > a[1] ? b : a))[0];

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (quoted) {
      if (ch === '"' && body[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"' && field === "") quoted = true;
    else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && body[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

// --------------------------------------------------------------------- XLSX
const u16 = (b: Uint8Array, at: number) => b[at] | (b[at + 1] << 8);
const u32 = (b: Uint8Array, at: number) => (b[at] | (b[at + 1] << 8) | (b[at + 2] << 16) | (b[at + 3] << 24)) >>> 0;

async function inflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// The files inside a zip, by name, read from its central directory.
async function unzip(bytes: Uint8Array, wanted: (name: string) => boolean): Promise<Map<string, string>> {
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65_557); i--) {
    if (u32(bytes, i) === 0x06054b50) {
      end = i;
      break;
    }
  }
  if (end < 0) throw new Error("not a zip file");
  const entries = u16(bytes, end + 10);
  let at = u32(bytes, end + 16);
  const files = new Map<string, string>();
  const text = new TextDecoder();
  for (let n = 0; n < entries; n++) {
    if (u32(bytes, at) !== 0x02014b50) throw new Error("broken zip directory");
    const method = u16(bytes, at + 10);
    const size = u32(bytes, at + 20);
    const nameLength = u16(bytes, at + 28);
    const extra = u16(bytes, at + 30);
    const comment = u16(bytes, at + 32);
    const offset = u32(bytes, at + 42);
    const name = text.decode(bytes.subarray(at + 46, at + 46 + nameLength));
    at += 46 + nameLength + extra + comment;
    if (!wanted(name)) continue;
    const start = offset + 30 + u16(bytes, offset + 26) + u16(bytes, offset + 28);
    const raw = bytes.subarray(start, start + size);
    if (method !== 0 && method !== 8) throw new Error("unsupported zip compression");
    files.set(name, text.decode(method === 8 ? await inflate(raw) : raw));
  }
  return files;
}

const unescape = (xml: string) =>
  xml
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");

// All the text runs of one string item, joined (rich text has several).
const texts = (xml: string) => [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => unescape(m[1])).join("");

const columnIndex = (ref: string) => {
  const letters = /^[A-Z]+/.exec(ref)?.[0] ?? "A";
  return [...letters].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
};

// The first worksheet of an .xlsx as rows of cell text.
export async function readXlsx(bytes: Uint8Array): Promise<string[][]> {
  const files = await unzip(bytes, (name) => name === "xl/sharedStrings.xml" || /^xl\/worksheets\/sheet\d+\.xml$/.test(name));
  const sheetName = [...files.keys()].filter((n) => n.startsWith("xl/worksheets/")).sort((a, b) => Number(/\d+/.exec(a)![0]) - Number(/\d+/.exec(b)![0]))[0];
  if (!sheetName) throw new Error("no worksheet");
  const shared = [...(files.get("xl/sharedStrings.xml") ?? "").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => texts(m[1]));

  const rows: string[][] = [];
  for (const rowMatch of files.get(sheetName)!.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const row: string[] = [];
    for (const cell of rowMatch[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cell[1];
      const inner = cell[2] ?? "";
      const ref = /\br="([A-Z]+)\d*"/.exec(attrs)?.[1];
      const type = /\bt="(\w+)"/.exec(attrs)?.[1];
      const value = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1];
      let textValue = "";
      if (type === "s" && value !== undefined) textValue = shared[Number(value)] ?? "";
      else if (type === "inlineStr") textValue = texts(inner);
      else if (value !== undefined) textValue = unescape(value);
      row[ref ? columnIndex(ref) : row.length] = textValue;
    }
    const filled = Array.from(row, (cell) => cell ?? "");
    if (filled.some((cell) => cell.trim() !== "")) rows.push(filled);
  }
  return rows;
}

// ---------------------------------------------------------- rows to products
type Column = "name" | "price" | "qty" | "unit" | "category" | "barcode";

// Header words billing apps and owners use, in English and Hindi.
const HEADERS: Record<Column, string[]> = {
  name: ["name", "product", "product name", "item", "item name", "items", "description", "particulars", "naam", "नाम", "सामान"],
  price: ["mrp", "price", "selling price", "sale price", "sp", "rate", "daam", "दाम", "कीमत", "मूल्य"],
  qty: ["qty", "quantity", "stock", "closing stock", "current stock", "balance", "stock qty", "मात्रा", "स्टॉक"],
  unit: ["unit", "size", "pack", "pack size", "uom", "weight", "वज़न"],
  category: ["category", "group", "item group", "type", "department", "श्रेणी"],
  barcode: ["barcode", "ean", "upc", "bar code", "item code"],
};

const clean = (cell: string) => cell.trim().toLowerCase().replace(/[^\p{L}\p{M}\p{N} ]+/gu, " ").replace(/\s+/g, " ").trim();

function findColumns(row: string[]): Partial<Record<Column, number>> {
  const found: Partial<Record<Column, number>> = {};
  row.forEach((cell, index) => {
    const header = clean(cell);
    for (const [column, names] of Object.entries(HEADERS) as Array<[Column, string[]]>) {
      // Sale price beats purchase rate when a sheet has both.
      if (names.includes(header) && (found[column] === undefined || (column === "price" && header === "mrp"))) found[column] = index;
    }
  });
  return found;
}

const rupeesToPaise = (cell: string) => {
  const n = Number.parseFloat(cell.replace(/₹|rs\.?|inr|,/gi, "").trim());
  return Number.isFinite(n) && n > 0 && n <= 100_000 ? Math.round(n * 100) : null;
};
const count = (cell: string) => {
  const n = Number.parseFloat(cell.replace(/,/g, "").trim());
  return Number.isFinite(n) && n >= 0 ? Math.min(Math.floor(n), 10_000) : null;
};
const text = (cell: string | undefined, max: number) => {
  const value = cell?.trim().replace(/\s+/g, " ") ?? "";
  return value ? value.slice(0, max) : null;
};

export interface SheetResult {
  products: SheetProduct[];
  // Rows that had no product name, or weren't products (totals, notes).
  skipped: number;
  columns: Column[];
}

// Products from a sheet's rows. The header row is the first of the top ten
// with a name column; without one, the first column is taken as names and
// a second numeric column as prices.
export function rowsToProducts(rows: string[][]): SheetResult {
  let headerAt = -1;
  let columns: Partial<Record<Column, number>> = {};
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const found = findColumns(rows[i]);
    if (found.name !== undefined) {
      headerAt = i;
      columns = found;
      break;
    }
  }
  if (headerAt < 0) columns = { name: 0, ...(rows.some((r) => rupeesToPaise(r[1] ?? "") !== null) ? { price: 1 } : {}) };

  const products: SheetProduct[] = [];
  let skipped = 0;
  for (const row of rows.slice(headerAt + 1)) {
    const name = text(row[columns.name!], 80);
    // A total line or a number in the name column isn't a product.
    if (!name || /^(total|grand total|कुल)\b/i.test(name) || /^[\d.,\s₹]+$/.test(name)) {
      skipped++;
      continue;
    }
    const barcode = columns.barcode !== undefined ? row[columns.barcode]?.replace(/\D/g, "") ?? "" : "";
    products.push({
      name,
      unit: columns.unit !== undefined ? text(row[columns.unit], 40) : null,
      category: columns.category !== undefined ? text(row[columns.category], 80) : null,
      price_paise: columns.price !== undefined ? rupeesToPaise(row[columns.price] ?? "") : null,
      stock_qty: columns.qty !== undefined ? count(row[columns.qty] ?? "") : null,
      barcode: /^[0-9]{8,14}$/.test(barcode) ? barcode : null,
    });
  }
  return { products, skipped, columns: Object.keys(columns) as Column[] };
}

// A file the owner picked, read into products.
export async function readSheet(file: File): Promise<SheetResult> {
  if (file.size > MAX_FILE_BYTES) throw new Error("too big");
  const bytes = new Uint8Array(await file.arrayBuffer());
  // .xlsx files are zips: they start "PK".
  const rows = bytes[0] === 0x50 && bytes[1] === 0x4b ? await readXlsx(bytes) : parseCsv(new TextDecoder().decode(bytes));
  return rowsToProducts(rows);
}

// A sheet to fill in, for owners without a billing app.
export const TEMPLATE_CSV = "Name,Pack size,MRP,Stock,Category\nTata Salt,1 kg,28,20,Staples\nParle-G,80 g,10,48,Biscuits\n";
