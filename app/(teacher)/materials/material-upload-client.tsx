"use client";

import { useState, type FormEvent } from "react";

import { useRefreshOnSuccess } from "@/lib/hooks/use-refresh-on-success";
import type { UserRole } from "@/lib/types/auth";
import type { CourseSummary } from "@/lib/types/course";
import type { LibraryCategoryItem } from "@/lib/types/library";
import { materialUploadConstraints } from "@/lib/validators/material-validator";

type MaterialUploadClientProps = {
  actorRole: UserRole;
  categories: LibraryCategoryItem[];
  courses: CourseSummary[];
};

export function MaterialUploadClient({ actorRole, categories, courses }: MaterialUploadClientProps) {
  const [selectedFileName, setSelectedFileName] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const [uploadStatus, setUploadStatus] = useState<"idle" | "success" | "error">("idle");
  const [refreshNonce, setRefreshNonce] = useState(0);
  const isStaffUploader = actorRole === "moderator" || actorRole === "admin";

  useRefreshOnSuccess({ status: uploadStatus, nonce: refreshNonce });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsUploading(true);
    setUploadMessage("");
    setUploadStatus("idle");

    try {
      const formElement = event.currentTarget;
      const formData = new FormData(formElement);
      const file = formData.get("file");

      if (!(file instanceof File) || file.size <= 0) {
        setUploadStatus("error");
        setUploadMessage("Bạn cần chọn một tệp hợp lệ để tải lên.");
        return;
      }

      const uploadResponse = await fetch("/api/library/materials/upload", {
        method: "POST",
        body: formData,
      });

      const uploadResult = (await uploadResponse.json()) as { status?: "success" | "error"; message?: string; details?: string };

      if (!uploadResponse.ok || uploadResult.status !== "success") {
        setUploadStatus("error");
        const serverMessage = uploadResult.message ?? uploadResult.details;
        setUploadMessage(
          serverMessage
            ? serverMessage
            : "Không thể tải tài liệu lên. Hãy kiểm tra quyền truy cập, loại file hoặc thử lại sau.",
        );
        return;
      }

      setUploadStatus("success");
      setUploadMessage(uploadResult.message ?? "Tải tài liệu thành công.");
      setSelectedFileName("");
      formElement.reset();
      setRefreshNonce((value) => value + 1);
    } catch (error) {
      setUploadStatus("error");
      setUploadMessage(error instanceof Error ? `Không thể tải tài liệu lên: ${error.message}` : "Không thể tải tài liệu lên.");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-semibold text-slate-900">Tải tài liệu</h2>
      <p className="mt-1 text-sm text-slate-600">
        {isStaffUploader
          ? "Tài nguyên do Mod/Admin tải lên được đưa thẳng vào Thư viện. Chọn học phần cụ thể hoặc Khác nếu tài nguyên không thuộc học phần nào."
          : "Tệp được lưu trong thư viện cá nhân của bạn; nếu chọn học phần, tài liệu sẽ được gửi duyệt để đưa vào Thư viện dùng chung."}
      </p>

      <form className="mt-4 grid gap-3 md:grid-cols-2" data-testid="upload-material-form" encType="multipart/form-data" onSubmit={handleSubmit}>
        <label className="text-sm text-slate-700">
          <span className="font-medium">Học phần</span>
          <select
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            data-testid="material-course-id"
            name="courseId"
            required={isStaffUploader}
          >
            {isStaffUploader ? (
              <>
                <option value="">Chọn học phần hoặc Khác</option>
                <option value="__other">Khác</option>
              </>
            ) : (
              <option value="">Không chọn - lưu vào thư viện cá nhân</option>
            )}
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.code} - {course.title}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-slate-500">
            {isStaffUploader
              ? "Mod/Admin cần chọn học phần hoặc Khác; tài nguyên được duyệt sẵn khi tải lên."
              : "Bỏ trống để lưu riêng tư. Chọn học phần để gửi yêu cầu duyệt vào Thư viện dùng chung."}
          </span>
        </label>

        <label className="text-sm text-slate-700">
          <span className="font-medium">Tiêu đề tài liệu</span>
          <input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" data-testid="material-title" name="title" required />
        </label>

        <label className="text-sm text-slate-700 md:col-span-2">
          <span className="font-medium">Mô tả</span>
          <textarea className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" data-testid="material-description" name="description" rows={3} />
        </label>

        <label className="text-sm text-slate-700">
          <span className="font-medium">Nhãn mục</span>
          <input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" data-testid="material-section-label" name="sectionLabel" placeholder="Ví dụ: Tuần 1" />
        </label>

        <label className="text-sm text-slate-700">
          <span className="font-medium">Danh mục</span>
          <select className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" name="categoryId">
            <option value="">Chọn danh mục</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm text-slate-700 md:col-span-2">
          <span className="font-medium">Tags</span>
          <input
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            name="tags"
            placeholder="Ví dụ: vật lý; chương 7; kiểm tra cuối kỳ"
          />
        </label>

        <div className="text-sm text-slate-700">
          <span className="font-medium">Tệp tài liệu</span>
          <div className="mt-1 flex w-full flex-wrap items-center gap-3 rounded-md border border-slate-300 px-3 py-2 text-sm">
            <label className="inline-flex cursor-pointer rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white" htmlFor="material-file-input">
              Chọn file
            </label>
            <input
              accept={materialUploadConstraints.allowedMimeTypes.join(",")}
              className="sr-only"
              data-testid="material-file"
              id="material-file-input"
              name="file"
              onChange={(event) => setSelectedFileName(event.target.files?.[0]?.name ?? "")}
              required
              type="file"
            />
            <span className="text-slate-500">{selectedFileName || "Chưa chọn file"}</span>
          </div>
        </div>

        <label className="flex items-center gap-2 self-end rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700">
          <input data-testid="material-allow-download" defaultChecked name="allowDownload" type="checkbox" />
          Cho phép sinh viên tải xuống
        </label>

        <div className="flex flex-wrap items-end justify-between gap-3 md:col-span-2">
          <p className="max-w-3xl text-xs text-slate-500">
            Định dạng hỗ trợ: PDF, PPT/PPTX, DOC/DOCX, XLS/XLSX, ZIP. Giới hạn cá nhân mặc định {Math.floor(materialUploadConstraints.maxFileSizeBytes / 1024 / 1024)} MB; Admin có thể điều chỉnh mức này ở cấu hình hệ thống.
          </p>
          <button
            className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            data-testid="upload-material-submit"
            disabled={isUploading}
            type="submit"
          >
            {isUploading ? "Đang tải lên..." : "Tải lên tài liệu"}
          </button>
        </div>
      </form>

      {uploadMessage ? (
        <p
          className={uploadStatus === "error" ? "mt-3 text-sm text-red-600" : "mt-3 text-sm text-emerald-700"}
          data-testid="upload-material-message"
        >
          {uploadMessage}
        </p>
      ) : null}
    </section>
  );
}
