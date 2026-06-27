"use client";

import { useId, useState } from "react";

type ClassroomImageFileInputProps = {
  name: string;
  accept?: string;
};

export function ClassroomImageFileInput({
  name,
  accept = "image/*",
}: ClassroomImageFileInputProps) {
  const inputId = useId();
  const [selectedFileName, setSelectedFileName] = useState("Chưa có ảnh được chọn");

  return (
    <div className="mt-1 flex flex-wrap items-center gap-4">
      <input
        accept={accept}
        className="sr-only"
        id={inputId}
        name={name}
        onChange={(event) => {
          const fileName = event.target.files?.[0]?.name?.trim();
          setSelectedFileName(fileName && fileName.length > 0 ? fileName : "Chưa có ảnh được chọn");
        }}
        type="file"
      />
      <label
        className="inline-flex cursor-pointer rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-800"
        htmlFor={inputId}
      >
        Chọn ảnh
      </label>
      <span className="text-sm text-slate-700">{selectedFileName}</span>
    </div>
  );
}
