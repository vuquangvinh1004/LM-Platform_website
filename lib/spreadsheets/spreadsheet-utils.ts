import { read, utils, write } from "xlsx";

export type SpreadsheetMatrix = string[][];

export function normalizeSpreadsheetHeader(value: string): string {
  return value
    .trim()
    .replace(/^\uFEFF/, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/^"+|"+$/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function readFirstSheetMatrix(workbook: ReturnType<typeof read>, invalidFileMessage: string): SpreadsheetMatrix {
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    throw new Error(invalidFileMessage);
  }

  const worksheet = workbook.Sheets[firstSheetName];
  const matrix = utils.sheet_to_json<string[]>(worksheet, {
    header: 1,
    raw: false,
    defval: "",
    blankrows: false,
  }) as string[][];

  if (matrix.length < 2) {
    throw new Error(invalidFileMessage);
  }

  return matrix;
}

export function readSpreadsheetMatrixFromCsv(csvContent: string, invalidFileMessage: string): SpreadsheetMatrix {
  const workbook = read(csvContent, { type: "string", raw: false });
  return readFirstSheetMatrix(workbook, invalidFileMessage);
}

export function readSpreadsheetMatrixFromBase64(fileContentBase64: string, invalidFileMessage: string): SpreadsheetMatrix {
  const workbook = read(Buffer.from(fileContentBase64, "base64"), { type: "buffer", raw: false });
  return readFirstSheetMatrix(workbook, invalidFileMessage);
}

function escapeCsvValue(value: unknown): string {
  if (value === undefined || value === null) {
    return "";
  }

  const stringValue = String(value);
  if (stringValue.includes(",") || stringValue.includes("\n") || stringValue.includes("\"")) {
    return `"${stringValue.replace(/\"/g, "\"\"")}"`;
  }

  return stringValue;
}

export function createCsvBuffer(input: {
  headers: string[];
  rows: unknown[][];
}): Buffer {
  const lines = [input.headers.join(",")];

  for (const row of input.rows) {
    lines.push(row.map((value) => escapeCsvValue(value)).join(","));
  }

  return Buffer.concat([Buffer.from("\uFEFF", "utf8"), Buffer.from(lines.join("\n"), "utf8")]);
}

export function createWorkbookBuffer(input: {
  sheetName: string;
  rows: Array<Record<string, unknown>>;
}): Buffer {
  const workbook = utils.book_new();
  const worksheet = utils.json_to_sheet(input.rows);
  utils.book_append_sheet(workbook, worksheet, input.sheetName);
  const output = write(workbook, { type: "buffer", bookType: "xlsx" });
  return Buffer.isBuffer(output) ? output : Buffer.from(output);
}
