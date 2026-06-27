"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import type { ClassroomAssignmentActionState } from "@/components/classroom/classroom-assignment-action-state";
import { initialClassroomAssignmentActionState } from "@/components/classroom/classroom-assignment-action-state";
import { ClassroomImageFileInput } from "@/components/classroom/classroom-image-file-input";

type ClassroomAssignmentFormClientProps = {
  action: (prevState: ClassroomAssignmentActionState, formData: FormData) => Promise<ClassroomAssignmentActionState>;
};

export function ClassroomAssignmentFormClient({ action }: ClassroomAssignmentFormClientProps) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(action, initialClassroomAssignmentActionState);
  const previousStatusRef = useRef(state.status);

  useEffect(() => {
    if (previousStatusRef.current !== "success" && state.status === "success") {
      router.refresh();
    }

    previousStatusRef.current = state.status;
  }, [router, state.status]);

  return (
    <form action={formAction} className="mt-4 grid gap-3">
      <input className="rounded-md border border-slate-300 px-3 py-2 text-sm" name="title" placeholder="Tiêu đề bài tập" required />
      <textarea className="min-h-24 rounded-md border border-slate-300 px-3 py-2 text-sm" name="instructions" placeholder="Hướng dẫn làm bài" />
      <label className="text-sm text-slate-700">
        Ảnh đính kèm
        <ClassroomImageFileInput name="imageFile" />
        <span className="mt-1 block text-xs text-slate-500">Chỉ chấp nhận file ảnh dưới 3MB.</span>
      </label>
      {state.message ? (
        <p className={state.status === "error" ? "text-sm text-red-600" : "text-sm text-emerald-700"}>
          {state.message}
        </p>
      ) : null}
      <button className="w-fit rounded-md bg-emerald-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-60" disabled={isPending} type="submit">
        {isPending ? "Đang thêm..." : "Thêm Bài tập"}
      </button>
    </form>
  );
}
