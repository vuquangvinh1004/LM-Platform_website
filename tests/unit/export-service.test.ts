import { describe, expect, it, vi } from "vitest";
import { read, utils } from "xlsx";

import { exportAssessmentResults, exportAssessmentResultsImportTemplate } from "@/lib/services/export-service";
import { getAssessmentResults } from "@/lib/services/submission-service";

vi.mock("@/lib/services/submission-service", () => ({
  getAssessmentResults: vi.fn(),
}));

const mockedGetAssessmentResults = vi.mocked(getAssessmentResults);

describe("export-service", () => {
  it("blocks export for student role", async () => {
    const result = await exportAssessmentResults({
      assessmentId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      actorId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      actorRole: "student",
      format: "csv",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("FORBIDDEN");
    }
  });

  it("exports csv content with headers and rows", async () => {
    mockedGetAssessmentResults.mockResolvedValueOnce({
      ok: true,
      data: {
        items: [
          {
            id: "submission-1",
            assessmentId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            studentId: "student-1",
            studentFullName: "Nguyễn Văn A",
            studentIdentifier: "SV-FIX-01",
            studentCode: "SV-FIX-01",
            studentEmail: "student1@fixture.test",
            rawScore: 8,
            maxScore: 10,
            normalizedScore: 80,
            status: "submitted",
            source: "csv_import",
            sourceLabel: "Google Form",
            attemptNumber: 1,
            note: "Ghi chú có dấu",
            createdAt: "2026-05-28T00:00:00.000Z",
          },
        ],
        page: 1,
        pageSize: 200,
        totalItems: 1,
        totalPages: 1,
      },
    });

    const result = await exportAssessmentResults({
      assessmentId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      actorId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      actorRole: "teacher",
      format: "csv",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.fileName.endsWith(".csv")).toBe(true);
      expect(result.data.contentType).toContain("text/csv");
      const contentText = result.data.content.toString("utf8");
      expect(result.data.content[0]).toBe(0xef);
      expect(contentText).toContain("Mã sinh viên");
      expect(contentText).toContain("Nguyễn Văn A");
      expect(contentText).toContain("Google Form");
      expect(contentText).toContain("Ghi chú có dấu");
    }
  });

  it("exports xlsx statistics summary", async () => {
    mockedGetAssessmentResults.mockResolvedValueOnce({
      ok: true,
      data: {
        items: [
          {
            id: "submission-1",
            assessmentId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            studentId: "student-1",
            studentFullName: "Nguyễn Văn A",
            studentIdentifier: "SV-FIX-01",
            studentCode: "SV-FIX-01",
            studentEmail: "student1@fixture.test",
            rawScore: 8,
            maxScore: 10,
            normalizedScore: 80,
            status: "submitted",
            source: "csv_import",
            sourceLabel: "Google Form",
            attemptNumber: 1,
            note: "Ghi chú có dấu",
            createdAt: "2026-05-28T00:00:00.000Z",
          },
          {
            id: "submission-2",
            assessmentId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            studentId: "student-2",
            studentFullName: "Trần Thị B",
            studentIdentifier: "SV-FIX-02",
            studentCode: "SV-FIX-02",
            studentEmail: "student2@fixture.test",
            rawScore: 3,
            maxScore: 10,
            normalizedScore: 30,
            status: "submitted",
            source: "csv_import",
            sourceLabel: "Google Form",
            attemptNumber: 1,
            note: "",
            createdAt: "2026-05-28T00:10:00.000Z",
          },
          {
            id: "submission-3",
            assessmentId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            studentId: "student-3",
            studentFullName: "Lê Văn C",
            studentIdentifier: "SV-FIX-03",
            studentCode: "SV-FIX-03",
            studentEmail: "student3@fixture.test",
            rawScore: 8,
            maxScore: 10,
            normalizedScore: 80,
            status: "submitted",
            source: "csv_import",
            sourceLabel: "Google Form",
            attemptNumber: 1,
            note: "",
            createdAt: "2026-05-28T00:20:00.000Z",
          },
        ],
        page: 1,
        pageSize: 200,
        totalItems: 3,
        totalPages: 1,
      },
    });

    const result = await exportAssessmentResults({
      assessmentId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      actorId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      actorRole: "teacher",
      format: "xlsx",
    });

    expect(result.ok).toBe(true);

    if (result.ok) {
      const workbook = read(result.data.content, { type: "buffer" });
      expect(workbook.SheetNames).toContain("thong_ke_ket_qua");

      const summarySheet = workbook.Sheets.thong_ke_ket_qua;
      const summaryRows = utils.sheet_to_json<Record<string, string | number>>(summarySheet);
      expect(summaryRows.find((row) => row["Chỉ số"] === "Tổng số bài kiểm tra")?.["Giá trị"]).toBe(3);
      expect(summaryRows.find((row) => row["Chỉ số"] === "Số bài có điểm >= 4")?.["Giá trị"]).toBe(2);
      expect(summaryRows.find((row) => row["Chỉ số"] === "Số bài có điểm < 4")?.["Giá trị"]).toBe(1);
      expect(summaryRows.find((row) => row["Chỉ số"] === "Trung bình điểm (Average)")?.["Giá trị"]).toBe(6.3333);
      expect(summaryRows.find((row) => row["Chỉ số"] === "Trung vị điểm (Median)")?.["Giá trị"]).toBe(8);
      expect(summaryRows.find((row) => row["Chỉ số"] === "Yếu vị điểm (Mode)")?.["Giá trị"]).toBe(8);
    }
  });

  it("exports import template with Vietnamese sample row", () => {
    const csvTemplate = exportAssessmentResultsImportTemplate("csv");
    const xlsxTemplate = exportAssessmentResultsImportTemplate("xlsx");

    expect(csvTemplate.fileName.endsWith(".csv")).toBe(true);
    expect(csvTemplate.content.toString("utf8")).toContain("Nguyễn Văn A");
    expect(csvTemplate.content.toString("utf8")).toContain("STU123");

    const workbook = read(xlsxTemplate.content, { type: "buffer" });
    expect(workbook.SheetNames).toContain("template");
    const templateRows = utils.sheet_to_json<Record<string, string | number>>(workbook.Sheets.template);
    expect(templateRows[0]?.["Họ tên sinh viên"]).toBe("Nguyễn Văn A");
    expect(templateRows[0]?.["Mã sinh viên"]).toBe("STU123");
  });
});
