import type { ClassroomAnnouncement } from "@/lib/types/classroom";

type ClassroomBoardPanelProps = {
  announcements: ClassroomAnnouncement[];
  canCreateAnnouncement: boolean;
  createAnnouncementAction?: (formData: FormData) => Promise<void>;
  errorMessage?: string;
};

export function ClassroomBoardPanel({
  announcements,
  canCreateAnnouncement,
  createAnnouncementAction,
  errorMessage,
}: ClassroomBoardPanelProps) {
  return (
    <section className="rounded-xl border border-emerald-900/20 bg-emerald-950 px-4 py-4 text-emerald-50">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">Bảng đen</h2>
        <span className="rounded-full bg-emerald-800/80 px-2 py-1 text-xs">{announcements.length} thông báo</span>
      </div>

      {canCreateAnnouncement && createAnnouncementAction ? (
        <form action={createAnnouncementAction} className="mt-3 grid gap-2 md:grid-cols-2">
          <input
            className="rounded-md border border-emerald-700 bg-emerald-900/60 px-3 py-2 text-sm text-emerald-50 placeholder:text-emerald-200"
            name="title"
            placeholder="Tiêu đề thông báo"
            required
          />
          <input
            className="rounded-md border border-emerald-700 bg-emerald-900/60 px-3 py-2 text-sm text-emerald-50 placeholder:text-emerald-200"
            name="content"
            placeholder="Nội dung thông báo"
            required
          />
          <div className="md:col-span-2">
            <button className="rounded-md bg-emerald-500 px-3 py-2 text-sm font-medium text-emerald-950" type="submit">
              Đăng thông báo
            </button>
          </div>
        </form>
      ) : null}

      {errorMessage ? <p className="mt-3 text-sm text-amber-200">{errorMessage}</p> : null}

      {announcements.length === 0 ? (
        <p className="mt-3 text-sm text-emerald-100/90">Chưa có thông báo mới.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {announcements.slice(0, 5).map((announcement) => (
            <li className="rounded-md border border-emerald-800/70 bg-emerald-900/50 px-3 py-2" key={announcement.id}>
              <p className="text-sm font-semibold">{announcement.title}</p>
              <p className="mt-1 text-xs text-emerald-100/90">{announcement.content}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
