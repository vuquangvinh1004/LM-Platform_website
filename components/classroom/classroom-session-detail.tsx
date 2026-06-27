import Image from "next/image";
import Link from "next/link";

import type { ClassroomAssignmentActionState } from "@/components/classroom/classroom-assignment-action-state";
import type { ClassroomMaterialItem, ClassroomSessionDetail as ClassroomSessionDetailModel, ClassroomSessionLectureItem } from "@/lib/types/classroom";
import { ClassroomAssignmentFormClient } from "@/components/classroom/classroom-assignment-form-client";
import { ClassroomQuickReviewClient } from "@/components/classroom/classroom-quick-review-client";
import { isInternalMaterialViewerUrl, normalizeClassroomEmbeddableUrl, resolveClassroomMediaPreview } from "@/lib/utils/classroom-media";
import { parseStructuredText } from "@/lib/utils/classroom-rich-text";

type SessionAction = (formData: FormData) => Promise<void>;
type AssignmentAction = (prevState: ClassroomAssignmentActionState, formData: FormData) => Promise<ClassroomAssignmentActionState>;

type ClassroomSessionDetailProps = {
  session: ClassroomSessionDetailModel;
  audience: "student" | "manager";
  updateOverviewAction?: SessionAction;
  updateAccessAction?: SessionAction;
  addLectureItemAction?: SessionAction;
  addExtraMaterialAction?: SessionAction;
  addAssignmentAction?: AssignmentAction;
  addQuickReviewQuestionAction?: SessionAction;
  removeItemAction?: SessionAction;
  classId?: string;
  availableMaterials?: ClassroomMaterialItem[];
};

const lectureTypeLabels: Record<string, string> = {
  slide: "Slide trình chiếu",
  video: "Video",
  audio: "Audio",
  reading: "Bài đọc",
};

const sidebarItems = [
  { href: "#overview", label: "Nội dung và mục tiêu" },
  { href: "#lecture", label: "Bài giảng" },
  { href: "#extra-materials", label: "Tài liệu đọc thêm" },
  { href: "#assignments", label: "Bài tập" },
  { href: "#quick-review", label: "Ôn tập nhanh" },
];

function RemoveButton({ collection, itemId, removeItemAction }: { collection: string; itemId: string; removeItemAction?: SessionAction }) {
  if (!removeItemAction) {
    return null;
  }

  return (
    <form action={removeItemAction}>
      <input name="collection" type="hidden" value={collection} />
      <input name="itemId" type="hidden" value={itemId} />
      <button className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-700" type="submit">
        Bớt
      </button>
    </form>
  );
}

function getMaterialViewerHref(audience: "student" | "manager", classId: string | undefined, materialId: string): string {
  const basePath = audience === "manager" ? "/classes/materials" : "/my-classes/materials";
  const query = new URLSearchParams({ embed: "1" });

  if (classId) {
    query.set("classId", classId);
  }

  return `${basePath}/${materialId}?${query.toString()}`;
}

function normalizeVietnameseText(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .trim();
}

function isCategory(material: ClassroomMaterialItem, categoryName: "Bài giảng" | "Tham khảo"): boolean {
  return normalizeVietnameseText(material.categoryName) === normalizeVietnameseText(categoryName);
}

function getClassResourcePickerHref(
  classId: string | undefined,
  sessionId: string,
  categoryName: "Bài giảng" | "Tham khảo",
): string | undefined {
  if (!classId) {
    return undefined;
  }

  const returnTo = `/classes/${classId}/sessions/${sessionId}`;
  return `/classes/${classId}/resources?returnTo=${encodeURIComponent(returnTo)}&materialCategory=${encodeURIComponent(categoryName)}`;
}

function StructuredText({ value, emptyText }: { value: string | null | undefined; emptyText: string }) {
  const blocks = parseStructuredText(value);

  if (blocks.length === 0) {
    return <p className="text-sm text-slate-600">{emptyText}</p>;
  }

  return (
    <div className="space-y-3 text-sm text-slate-700">
      {blocks.map((block, index) => {
        if (block.type === "paragraph") {
          return <p className="whitespace-pre-line leading-6" key={`paragraph-${index}`}>{block.text}</p>;
        }

        if (block.type === "unordered-list") {
          return (
            <ul className="list-disc space-y-1 pl-5 leading-6" key={`ul-${index}`}>
              {block.items.map((item, itemIndex) => <li key={`ul-${index}-${itemIndex}`}>{item}</li>)}
            </ul>
          );
        }

        return (
          <ol className="list-decimal space-y-1 pl-5 leading-6" key={`ol-${index}`}>
            {block.items.map((item, itemIndex) => <li key={`ol-${index}-${itemIndex}`}>{item}</li>)}
          </ol>
        );
      })}
    </div>
  );
}

function LectureItemPreview({ item }: { item: ClassroomSessionLectureItem }) {
  if (!item.url) {
    return null;
  }

  const preview = resolveClassroomMediaPreview(item.url, item.type);

  if (!preview) {
    return null;
  }

  const isInternalMaterialViewer = isInternalMaterialViewerUrl(preview.src);

  if (preview.kind === "video") {
    return (
      <video className="mt-3 aspect-video w-full rounded-lg border border-slate-200 bg-black" controls src={preview.src}>
        Trình duyệt không hỗ trợ phát video này.
      </video>
    );
  }

  if (preview.kind === "audio") {
    return (
      <audio className="mt-3 w-full" controls src={preview.src}>
        Trình duyệt không hỗ trợ phát audio này.
      </audio>
    );
  }

  return (
    <iframe
      className={
        isInternalMaterialViewer
          ? "mt-3 h-[62vh] min-h-[420px] w-full rounded-md border border-slate-200 bg-white"
          : "mt-3 aspect-video w-full rounded-lg border border-slate-200 bg-white"
      }
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowFullScreen
      src={preview.src}
      title={item.title}
    />
  );
}

function ExtraMaterialPreview({ title, url }: { title: string; url: string }) {
  const embeddableUrl = normalizeClassroomEmbeddableUrl(url);
  const isInternalMaterialViewer = isInternalMaterialViewerUrl(embeddableUrl);

  return (
    <iframe
      className={
        isInternalMaterialViewer
          ? "mt-3 h-[62vh] min-h-[420px] w-full rounded-md border border-slate-200 bg-white"
          : "mt-3 aspect-video w-full rounded-lg border border-slate-200 bg-white"
      }
      src={embeddableUrl}
      title={title}
    />
  );
}

export function ClassroomSessionDetail({
  session,
  audience,
  updateOverviewAction,
  updateAccessAction,
  addLectureItemAction,
  addExtraMaterialAction,
  addAssignmentAction,
  addQuickReviewQuestionAction,
  removeItemAction,
  classId,
  availableMaterials = [],
}: ClassroomSessionDetailProps) {
  const canManage = audience === "manager";
  const lectureResourcePickerHref = getClassResourcePickerHref(classId, session.id, "Bài giảng");
  const extraMaterialResourcePickerHref = getClassResourcePickerHref(classId, session.id, "Tham khảo");
  const lectureMaterials = availableMaterials.filter((material) => isCategory(material, "Bài giảng"));
  const extraReadingMaterials = availableMaterials.filter((material) => isCategory(material, "Tham khảo"));

  return (
    <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="lg:sticky lg:top-6 lg:h-fit">
        <nav className="rounded-lg border border-slate-200 bg-white p-2.5">
          <p className="hidden px-2 text-xs font-semibold uppercase text-slate-500 lg:block">Thành phần buổi học</p>
          <div className="mt-2 space-y-1">
            {sidebarItems.map((item, index) => (
              <a
                className="flex items-start gap-2 rounded-md px-2 py-2 text-[15px] text-slate-700 hover:bg-slate-100"
                href={item.href}
                key={item.href}
                title={item.label}
              >
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-300 text-xs font-semibold text-slate-600">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1 leading-5">{item.label}</span>
              </a>
            ))}
          </div>
        </nav>
      </aside>

      <div className="space-y-6">
        <section className="rounded-lg border border-slate-200 bg-white p-5" id="overview">
          <h2 className="text-lg font-semibold text-slate-900">Nội dung và mục tiêu của buổi học</h2>
          {canManage && updateOverviewAction ? (
            <form action={updateOverviewAction} className="mt-4 grid gap-3">
              <label className="text-sm text-slate-700">
                Tiêu đề buổi học
                <input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" name="title" defaultValue={session.title} required />
              </label>
              <label className="text-sm text-slate-700">
                Nội dung chính
                <textarea className="mt-1 min-h-28 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" name="overviewContent" defaultValue={session.overviewContent ?? ""} />
              </label>
              <label className="text-sm text-slate-700">
                Mục tiêu học tập
                <textarea className="mt-1 min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" name="overviewObjectives" defaultValue={session.overviewObjectives ?? ""} />
              </label>
              <button className="w-fit rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white" type="submit">Lưu nội dung</button>
            </form>
          ) : (
            <div className="mt-3 space-y-3 text-sm text-slate-700">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Nội dung chính</p>
                <StructuredText emptyText="Chưa có nội dung chính." value={session.overviewContent} />
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Mục tiêu học tập</p>
                <StructuredText emptyText="Chưa có mục tiêu học tập." value={session.overviewObjectives} />
              </div>
            </div>
          )}
          {canManage && updateAccessAction ? (
            <form action={updateAccessAction} className="mt-5 grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 md:grid-cols-[220px_1fr_auto]">
              <label className="text-sm text-slate-700">
                Truy cập của sinh viên
                <select className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" defaultValue={session.studentAccess} name="studentAccess">
                  <option value="open">Mở ngay</option>
                  <option value="locked">Khóa</option>
                  <option value="scheduled">Mở theo lịch</option>
                </select>
              </label>
              <label className="text-sm text-slate-700">
                Thời điểm mở tự động
                <input
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  defaultValue={session.availableFrom ? new Date(new Date(session.availableFrom).getTime() - new Date(session.availableFrom).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ""}
                  name="availableFrom"
                  type="datetime-local"
                />
              </label>
              <button className="self-end rounded-md bg-indigo-700 px-4 py-2 text-sm font-medium text-white" type="submit">
                Lưu mở/khóa
              </button>
            </form>
          ) : null}
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5" id="lecture">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">Thành phần của bài giảng</h2>
          </div>
          {canManage && addLectureItemAction ? (
            <form action={addLectureItemAction} className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="text-sm text-slate-700">
                Loại thành phần
                <select className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" name="type">
                  <option value="slide">Slide trình chiếu</option>
                  <option value="video">Video</option>
                  <option value="audio">Audio</option>
                  <option value="reading">Bài đọc</option>
                </select>
              </label>
              <label className="text-sm text-slate-700">
                Tiêu đề
                <input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" name="title" required />
              </label>
              <label className="text-sm text-slate-700">
                Liên kết
                <input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" name="url" placeholder="https://..." />
              </label>
              <label className="text-sm text-slate-700">
                Nội dung ghi chú
                <input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" name="content" />
              </label>
              <div className="flex flex-wrap gap-2 md:col-span-2">
                <button className="rounded-md bg-sky-700 px-3 py-2 text-sm font-medium text-white" type="submit">Thêm slide/video/audio/bài đọc</button>
              </div>
            </form>
          ) : null}
          <div className="mt-4 space-y-3">
            {canManage && addLectureItemAction && (Boolean(lectureResourcePickerHref) || lectureMaterials.length > 0) ? (
              <div className="rounded-lg border border-sky-100 bg-sky-50 p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-sky-900">Tài liệu đã chọn từ Thư viện</p>
                    <p className="mt-1 text-xs text-sky-800">Chọn tài liệu để thêm vào thành phần bài giảng của buổi học này.</p>
                  </div>
                  {lectureResourcePickerHref ? (
                    <Link className="rounded-md border border-sky-300 bg-white px-3 py-2 text-sm font-medium text-sky-800" href={lectureResourcePickerHref}>
                      Chọn từ Thư viện
                    </Link>
                  ) : null}
                </div>
                {lectureMaterials.length === 0 ? (
                  <p className="mt-3 text-sm text-sky-800">Chưa có tài liệu nào được chọn cho danh mục này.</p>
                ) : (
                  <div className="mt-2 grid gap-2 md:grid-cols-2">
                    {lectureMaterials.map((material) => (
                      <form action={addLectureItemAction} className="flex items-center justify-between gap-3 rounded-md border border-sky-100 bg-white p-2" key={material.id}>
                        <input name="type" type="hidden" value="slide" />
                        <input name="title" type="hidden" value={material.title} />
                        <input name="url" type="hidden" value={getMaterialViewerHref(audience, classId, material.id)} />
                        <input name="content" type="hidden" value="Tài liệu được thêm từ Thư viện." />
                        <span className="text-sm text-slate-700">{material.title}</span>
                        <button className="rounded-md bg-sky-700 px-3 py-1.5 text-xs font-medium text-white" type="submit">
                          Thêm vào buổi học
                        </button>
                      </form>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
            {session.lectureItems.length === 0 ? <p className="text-sm text-slate-600">Chưa có thành phần bài giảng.</p> : null}
            {session.lectureItems.map((item) => (
              <article className="rounded-md border border-slate-200 p-3" key={item.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900">{lectureTypeLabels[item.type]}: {item.title}</p>
                    {item.url ? <a className="mt-1 block text-xs text-sky-700" href={item.url} rel="noreferrer" target="_blank">Mở liên kết</a> : null}
                    {item.content ? <div className="mt-2"><StructuredText emptyText="" value={item.content} /></div> : null}
                    <LectureItemPreview item={item} />
                  </div>
                  <RemoveButton collection="lectureItems" itemId={item.id} removeItemAction={canManage ? removeItemAction : undefined} />
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5" id="extra-materials">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">Tài liệu đọc thêm</h2>
          </div>
          {canManage && addExtraMaterialAction ? (
            <form action={addExtraMaterialAction} className="mt-4 grid gap-3 md:grid-cols-2">
              <input className="rounded-md border border-slate-300 px-3 py-2 text-sm" name="title" placeholder="Tiêu đề tài liệu" required />
              <input className="rounded-md border border-slate-300 px-3 py-2 text-sm" name="url" placeholder="https://..." />
              <input className="rounded-md border border-slate-300 px-3 py-2 text-sm md:col-span-2" name="note" placeholder="Ghi chú" />
              <button className="w-fit rounded-md bg-amber-700 px-3 py-2 text-sm font-medium text-white" type="submit">Thêm Tài liệu đọc thêm</button>
            </form>
          ) : null}
          <div className="mt-4 space-y-3">
            {canManage && addExtraMaterialAction && (Boolean(extraMaterialResourcePickerHref) || extraReadingMaterials.length > 0) ? (
              <div className="rounded-lg border border-amber-100 bg-amber-50 p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-amber-900">Tài liệu đã chọn từ Thư viện</p>
                    <p className="mt-1 text-xs text-amber-800">Chọn tài liệu để thêm vào mục đọc thêm của buổi học này.</p>
                  </div>
                  {extraMaterialResourcePickerHref ? (
                    <Link className="rounded-md border border-amber-300 bg-white px-3 py-2 text-sm font-medium text-amber-800" href={extraMaterialResourcePickerHref}>
                      Chọn từ Thư viện
                    </Link>
                  ) : null}
                </div>
                {extraReadingMaterials.length === 0 ? (
                  <p className="mt-3 text-sm text-amber-800">Chưa có tài liệu nào được chọn cho danh mục này.</p>
                ) : (
                  <div className="mt-2 grid gap-2 md:grid-cols-2">
                    {extraReadingMaterials.map((material) => (
                      <form action={addExtraMaterialAction} className="flex items-center justify-between gap-3 rounded-md border border-amber-100 bg-white p-2" key={material.id}>
                        <input name="title" type="hidden" value={material.title} />
                        <input name="url" type="hidden" value={getMaterialViewerHref(audience, classId, material.id)} />
                        <input name="note" type="hidden" value="Tài liệu được thêm từ Thư viện." />
                        <span className="text-sm text-slate-700">{material.title}</span>
                        <button className="rounded-md bg-amber-700 px-3 py-1.5 text-xs font-medium text-white" type="submit">
                          Thêm vào buổi học
                        </button>
                      </form>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
            {session.extraMaterials.length === 0 ? <p className="text-sm text-slate-600">Chưa có tài liệu đọc thêm.</p> : null}
            {session.extraMaterials.map((material) => (
              <article className="flex items-start justify-between gap-3 rounded-md border border-slate-200 p-3" key={material.id}>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900">{material.title}</p>
                  {material.url ? <a className="mt-1 block text-xs text-sky-700" href={material.url} rel="noreferrer" target="_blank">Mở tài liệu</a> : null}
                  {material.note ? <div className="mt-2"><StructuredText emptyText="" value={material.note} /></div> : null}
                  {material.url ? <ExtraMaterialPreview title={material.title} url={material.url} /> : null}
                </div>
                <RemoveButton collection="extraMaterials" itemId={material.id} removeItemAction={canManage ? removeItemAction : undefined} />
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5" id="assignments">
          <h2 className="text-lg font-semibold text-slate-900">Bài tập</h2>
          {canManage && addAssignmentAction ? (
            <ClassroomAssignmentFormClient action={addAssignmentAction} />
          ) : null}
          <div className="mt-4 space-y-3">
            {session.assignments.length === 0 ? <p className="text-sm text-slate-600">Chưa có bài tập.</p> : null}
            {session.assignments.map((assignment) => (
              <article className="flex items-start justify-between gap-3 rounded-md border border-slate-200 p-3" key={assignment.id}>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{assignment.title}</p>
                  {assignment.instructions ? <div className="mt-2"><StructuredText emptyText="" value={assignment.instructions} /></div> : null}
                  {assignment.imageDataUrl ? (
                    <div className="mt-3 w-full">
                      <p className="mb-2 text-xs text-slate-500">{assignment.imageName ?? "Ảnh đính kèm"}</p>
                      <Image
                        alt={assignment.imageName ?? assignment.title}
                        className="h-auto w-full rounded-lg border border-slate-200 object-contain"
                        height={800}
                        src={assignment.imageDataUrl}
                        unoptimized
                        width={1200}
                        sizes="100vw"
                      />
                    </div>
                  ) : null}
                </div>
                <RemoveButton collection="assignments" itemId={assignment.id} removeItemAction={canManage ? removeItemAction : undefined} />
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5" id="quick-review">
          <h2 className="text-lg font-semibold text-slate-900">Ôn tập nhanh</h2>
          {canManage && addQuickReviewQuestionAction ? (
            <form action={addQuickReviewQuestionAction} className="mt-4 grid gap-3">
              <select className="w-fit rounded-md border border-slate-300 px-3 py-2 text-sm" name="type">
                <option value="multiple_choice">Multiple choice - chọn một đáp án</option>
                <option value="multiple_answer">Multiple answer - chọn nhiều đáp án</option>
              </select>
              <input className="rounded-md border border-slate-300 px-3 py-2 text-sm" name="question" placeholder="Nội dung câu hỏi" required />
              {[0, 1, 2, 3].map((index) => (
                <div className="grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 md:grid-cols-[minmax(0,1fr)_220px_auto] md:items-start" key={index}>
                  <div className="grid gap-2">
                    <input className="rounded-md border border-slate-300 px-3 py-2 text-sm" name="options" placeholder={`Đáp án ${index + 1}`} required={index < 2} />
                    <textarea className="min-h-20 rounded-md border border-slate-300 px-3 py-2 text-sm" name="optionGuidances" placeholder={`Gợi ý cho đáp án ${index + 1}`} />
                  </div>
                  <label className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700">
                    <input name="correctOptionIndexes" type="checkbox" value={index} />
                    Đánh dấu đáp án đúng
                  </label>
                </div>
              ))}
              <label className="text-sm text-slate-700">
                Hướng dẫn và gợi ý
                <textarea className="mt-1 min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" name="guidance" placeholder="Nội dung hiển thị cho sinh viên khi trả lời sai để ôn tập lại." />
              </label>
              <button className="w-fit rounded-md bg-violet-700 px-3 py-2 text-sm font-medium text-white" type="submit">
                Thêm câu hỏi ôn tập
              </button>
            </form>
          ) : null}
          <div className="mt-4">
            {canManage ? (
              <div className="space-y-3">
                {session.quickReviewQuestions.length === 0 ? <p className="text-sm text-slate-600">Chưa có câu hỏi ôn tập.</p> : null}
                {session.quickReviewQuestions.map((question, index) => (
                  <article className="rounded-md border border-slate-200 p-3" key={question.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Câu {index + 1}: {question.question}</p>
                        <div className="mt-3 space-y-2">
                          {question.options.map((option) => (
                            <div className={option.isCorrect ? "rounded-md border border-emerald-200 bg-emerald-50 p-2" : "rounded-md border border-slate-200 bg-white p-2"} key={option.id}>
                              <p className="text-sm text-slate-800">{option.isCorrect ? "✓ " : ""}{option.label}</p>
                              {option.guidance ? <p className="mt-1 text-xs leading-5 text-slate-600">{option.guidance}</p> : null}
                            </div>
                          ))}
                        </div>
                        {question.guidance ? (
                          <div className="mt-3 rounded-md border border-violet-100 bg-violet-50 p-3">
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-violet-700">Hướng dẫn và gợi ý</p>
                            <StructuredText emptyText="" value={question.guidance} />
                          </div>
                        ) : null}
                      </div>
                      <RemoveButton collection="quickReviewQuestions" itemId={question.id} removeItemAction={removeItemAction} />
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <ClassroomQuickReviewClient questions={session.quickReviewQuestions} />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
