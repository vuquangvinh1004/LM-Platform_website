import { describe, expect, it } from "vitest";
import { read, utils } from "xlsx";

import {
  createCsvBuffer,
  createWorkbookBuffer,
  normalizeSpreadsheetHeader,
  readSpreadsheetMatrixFromCsv,
} from "@/lib/spreadsheets/spreadsheet-utils";

describe("spreadsheet-utils", () => {
  it("normalizes Vietnamese spreadsheet headers for lookup", () => {
    expect(normalizeSpreadsheetHeader("  Mã sinh viên  ")).toBe("ma sinh vien");
    expect(normalizeSpreadsheetHeader('"Họ tên sinh viên"')).toBe("ho ten sinh vien");
  });

  it("creates csv buffers with utf-8 bom and quoted values", () => {
    const csvBuffer = createCsvBuffer({
      headers: ["Mã sinh viên", "Ghi chú"],
      rows: [["SV001", 'Nội dung có dấu, cần "giữ" nguyên']],
    });

    expect(csvBuffer[0]).toBe(0xef);
    expect(csvBuffer.toString("utf8")).toContain("SV001");
    expect(csvBuffer.toString("utf8")).toContain('Nội dung có dấu, cần ""giữ"" nguyên');
  });

  it("reads the first sheet matrix from csv content", () => {
    const matrix = readSpreadsheetMatrixFromCsv(
      "Mã sinh viên,Họ tên sinh viên,Email\nSV001,Nguyễn Văn A,student@example.com\n",
      "Tệp CSV không hợp lệ hoặc không có dữ liệu.",
    );

    expect(matrix[0]?.[0]).toBe("Mã sinh viên");
    expect(matrix[1]?.[1]).toBe("Nguyễn Văn A");
  });

  it("creates an xlsx workbook buffer that round-trips through excel readers", () => {
    const workbookBuffer = createWorkbookBuffer({
      sheetName: "template",
      rows: [
        {
          "Mã sinh viên": "SV001",
          "Họ tên sinh viên": "Nguyễn Văn A",
        },
      ],
    });

    const workbook = read(workbookBuffer, { type: "buffer" });
    expect(workbook.SheetNames).toContain("template");
    const rows = utils.sheet_to_json<Record<string, string>>(workbook.Sheets.template);
    expect(rows[0]?.["Họ tên sinh viên"]).toBe("Nguyễn Văn A");
  });
});
