import { utils, write } from "xlsx";
import { z } from "zod";

import { getAssessmentResults } from "@/lib/services/submission-service";
import type { ServiceResult } from "@/lib/types/service-result";
import type { SubmissionSummary } from "@/lib/types/submission";

const exportAssessmentResultsSchema = z.object({
  assessmentId: z.string().uuid(),
  actorId: z.string().uuid(),
  actorRole: z.enum(["admin", "moderator", "teacher", "student"]),
  format: z.enum(["csv", "xlsx"]),
  status: z.enum(["submitted", "late", "missing", "ignored"]).optional(),
  sortBy: z.enum(["studentCode", "studentFullName", "studentEmail", "rawScore", "submittedAt", "sourceLabel", "note"]).optional(),
  sortDirection: z.enum(["asc", "desc"]).optional(),
});

export type ExportAssessmentResultsOutput = {
  fileName: string;
  contentType: string;
  content: Buffer;
};

export type ExportAssessmentResultsTemplateOutput = {
  fileName: string;
  contentType: string;
  content: Buffer;
};

function toCsv(rows: SubmissionSummary[]): Buffer {
  const header = [
    "Mã sinh viên",
    "Họ tên sinh viên",
    "Email",
    "Điểm",
    "Nộp lúc",
    "Nguồn",
    "Ghi chú",
  ];

  const escaped = (value: unknown) => {
    if (value === undefined || value === null) {
      return "";
    }

    const stringValue = String(value);
    if (stringValue.includes(",") || stringValue.includes("\n") || stringValue.includes("\"")) {
      return `"${stringValue.replace(/\"/g, "\"\"")}"`;
    }

    return stringValue;
  };

  const lines = [header.join(",")];

  for (const row of rows) {
    lines.push([
      escaped(row.studentCode),
      escaped(row.studentFullName),
      escaped(row.studentEmail),
      escaped(row.rawScore),
      escaped(row.submittedAt),
      escaped(row.sourceLabel ?? row.source),
      escaped(row.note),
    ].join(","));
  }

  return Buffer.concat([Buffer.from("\uFEFF", "utf8"), Buffer.from(lines.join("\n"), "utf8")]);
}

function toXlsx(rows: SubmissionSummary[]): Buffer {
  const workbook = utils.book_new();
  const scores = rows
    .map((row) => row.rawScore)
    .filter((score): score is number => typeof score === "number")
    .sort((left, right) => left - right);

  const totalAssessments = scores.length;
  const passingCount = scores.filter((score) => score >= 4).length;
  const failingCount = scores.filter((score) => score < 4).length;
  const averageScore = totalAssessments > 0
    ? Number((scores.reduce((total, score) => total + score, 0) / totalAssessments).toFixed(4))
    : 0;
  const medianScore = totalAssessments === 0
    ? 0
    : totalAssessments % 2 === 1
      ? scores[Math.floor(totalAssessments / 2)]!
      : Number((((scores[(totalAssessments / 2) - 1] ?? 0) + (scores[totalAssessments / 2] ?? 0)) / 2).toFixed(4));

  const frequencyByScore = new Map<number, number>();
  for (const score of scores) {
    frequencyByScore.set(score, (frequencyByScore.get(score) ?? 0) + 1);
  }

  let modeScore: number | "Không có" = "Không có";
  let highestFrequency = 1;
  for (const [score, frequency] of frequencyByScore.entries()) {
    if (frequency > highestFrequency) {
      highestFrequency = frequency;
      modeScore = score;
    }
  }

  const variance = totalAssessments > 0
    ? Number((
      scores.reduce((total, score) => total + ((score - averageScore) ** 2), 0) / totalAssessments
    ).toFixed(4))
    : 0;
  const standardDeviation = Number(Math.sqrt(variance).toFixed(4));

  const summaryRows = [
    { "Chỉ số": "Tổng số bài kiểm tra", "Giá trị": totalAssessments },
    { "Chỉ số": "Số bài có điểm >= 4", "Giá trị": passingCount },
    { "Chỉ số": "Số bài có điểm < 4", "Giá trị": failingCount },
    { "Chỉ số": "Trung bình điểm (Average)", "Giá trị": averageScore },
    { "Chỉ số": "Trung vị điểm (Median)", "Giá trị": medianScore },
    { "Chỉ số": "Yếu vị điểm (Mode)", "Giá trị": modeScore },
    { "Chỉ số": "Phương sai điểm (Variance)", "Giá trị": variance },
    { "Chỉ số": "Độ lệch chuẩn điểm (Standard Deviation)", "Giá trị": standardDeviation },
  ];

  const summarySheet = utils.json_to_sheet(summaryRows);
  utils.book_append_sheet(workbook, summarySheet, "thong_ke_ket_qua");

  const output = write(workbook, { type: "buffer", bookType: "xlsx" });
  return Buffer.isBuffer(output) ? output : Buffer.from(output);
}

function buildImportTemplateRows() {
  return [
    {
      "Mã sinh viên": "STU123",
      "Họ tên sinh viên": "Nguyễn Văn A",
      Email: "stu123@student.stu.edu.vn",
      "Điểm": 8,
      "Nộp lúc": "5/26/2026 12:00",
      "Nguồn": "Google Form",
      "Ghi chú": "Ví dụ nhập từ biểu mẫu ngoài",
    },
  ];
}

function toTemplateCsv(): Buffer {
  const header = ["Mã sinh viên", "Họ tên sinh viên", "Email", "Điểm", "Nộp lúc", "Nguồn", "Ghi chú"];
  const rows = buildImportTemplateRows();
  const escaped = (value: unknown) => {
    if (value === undefined || value === null) {
      return "";
    }

    const stringValue = String(value);
    if (stringValue.includes(",") || stringValue.includes("\n") || stringValue.includes("\"")) {
      return `"${stringValue.replace(/\"/g, "\"\"")}"`;
    }

    return stringValue;
  };

  const lines = [header.join(",")];

  for (const row of rows) {
    lines.push(header.map((column) => escaped(row[column as keyof typeof row])).join(","));
  }

  return Buffer.concat([Buffer.from("\uFEFF", "utf8"), Buffer.from(lines.join("\n"), "utf8")]);
}

function toTemplateXlsx(): Buffer {
  const workbook = utils.book_new();
  const worksheet = utils.json_to_sheet(buildImportTemplateRows());
  utils.book_append_sheet(workbook, worksheet, "template");
  const output = write(workbook, { type: "buffer", bookType: "xlsx" });
  return Buffer.isBuffer(output) ? output : Buffer.from(output);
}

export function exportAssessmentResultsImportTemplate(format: "csv" | "xlsx"): ExportAssessmentResultsTemplateOutput {
  if (format === "csv") {
    return {
      fileName: "assessment-results-import-template.csv",
      contentType: "text/csv; charset=utf-8",
      content: toTemplateCsv(),
    };
  }

  return {
    fileName: "assessment-results-import-template.xlsx",
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    content: toTemplateXlsx(),
  };
}

/**
 * Exports all manageable assessment results to CSV/XLSX for teacher dashboard workflows.
 */
export async function exportAssessmentResults(
  input: Parameters<typeof exportAssessmentResultsSchema.parse>[0],
): Promise<ServiceResult<ExportAssessmentResultsOutput>> {
  const parsedInput = exportAssessmentResultsSchema.safeParse(input);

  if (!parsedInput.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Dữ liệu export kết quả không hợp lệ.",
        details: parsedInput.error.flatten(),
      },
    };
  }

  if (parsedInput.data.actorRole !== "teacher" && parsedInput.data.actorRole !== "moderator" && parsedInput.data.actorRole !== "admin") {
    return {
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Bạn không có quyền export kết quả assessment.",
      },
    };
  }

  const pageSize = 200;
  let currentPage = 1;
  let totalPages = 1;
  const allRows: SubmissionSummary[] = [];

  while (currentPage <= totalPages) {
    const pageResult = await getAssessmentResults({
      assessmentId: parsedInput.data.assessmentId,
      actorId: parsedInput.data.actorId,
      actorRole: parsedInput.data.actorRole,
      page: currentPage,
      pageSize,
      status: parsedInput.data.status,
      sortBy: parsedInput.data.sortBy,
      sortDirection: parsedInput.data.sortDirection,
    });

    if (!pageResult.ok) {
      return pageResult;
    }

    allRows.push(...pageResult.data.items);
    totalPages = Math.max(pageResult.data.totalPages, 1);
    currentPage += 1;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

  if (parsedInput.data.format === "csv") {
    return {
      ok: true,
      data: {
        fileName: `assessment-results-${parsedInput.data.assessmentId}-${timestamp}.csv`,
        contentType: "text/csv; charset=utf-8",
        content: toCsv(allRows),
      },
    };
  }

  return {
    ok: true,
    data: {
      fileName: `assessment-results-${parsedInput.data.assessmentId}-${timestamp}.xlsx`,
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      content: toXlsx(allRows),
    },
  };
}
