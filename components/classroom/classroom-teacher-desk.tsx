"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { ClassroomDirectMessage } from "@/lib/types/classroom";
import type { ClassroomMessageMutationResult } from "@/lib/types/message";
import { parseStructuredText } from "@/lib/utils/classroom-rich-text";

type ClassroomTeacherDeskProps = {
  classId: string;
  teacherId: string;
  teacherName: string | null;
  teacherEmail: string | null;
  teacherDeskNote: string | null;
  canSendMessage: boolean;
  sendMessageAction?: (formData: FormData) => Promise<ClassroomMessageMutationResult>;
  markMessagesAsReadAction?: () => Promise<ClassroomMessageMutationResult>;
  updateTeacherDeskNoteAction?: (formData: FormData) => Promise<ClassroomMessageMutationResult>;
  currentActorId?: string;
  messages?: ClassroomDirectMessage[];
};

type MessageStatus = {
  type: "success" | "error";
  message: string;
} | null;

function formatMessageTime(timestamp: string): string {
  const date = new Date(timestamp);

  if (!Number.isFinite(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function TeacherDeskNoteContent({ value }: { value: string | null }) {
  const blocks = parseStructuredText(value);

  if (blocks.length === 0) {
    return <p>Chưa có ghi chú từ giảng viên.</p>;
  }

  return (
    <div className="space-y-3 text-sm text-indigo-900">
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

export function ClassroomTeacherDesk({
  classId,
  teacherId,
  teacherName,
  teacherEmail,
  teacherDeskNote,
  canSendMessage,
  sendMessageAction,
  markMessagesAsReadAction,
  updateTeacherDeskNoteAction,
  currentActorId,
  messages = [],
}: ClassroomTeacherDeskProps) {
  const router = useRouter();
  const messageListRef = useRef<HTMLDivElement>(null);
  const sendFormRef = useRef<HTMLFormElement>(null);
  const noteFormRef = useRef<HTMLFormElement>(null);
  const [isSending, startSendTransition] = useTransition();
  const [isMarkingRead, startMarkReadTransition] = useTransition();
  const [isSavingNote, startSaveNoteTransition] = useTransition();
  const [status, setStatus] = useState<MessageStatus>(null);
  const unreadIncomingCount = messages.filter((message) => currentActorId === message.recipientId && !message.readAt).length;
  const orderedMessages = [...messages].sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());

  useEffect(() => {
    if (!messageListRef.current) {
      return;
    }

    messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
  }, [orderedMessages.length]);

  const handleSendMessage = (formData: FormData) => {
    if (!sendMessageAction) {
      return;
    }

    setStatus(null);

    startSendTransition(async () => {
      const result = await sendMessageAction(formData);

      setStatus({
        type: result.ok ? "success" : "error",
        message: result.message,
      });

      if (result.ok) {
        sendFormRef.current?.reset();
        router.refresh();
      }
    });
  };

  const handleMarkAsRead = () => {
    if (!markMessagesAsReadAction) {
      return;
    }

    setStatus(null);

    startMarkReadTransition(async () => {
      const result = await markMessagesAsReadAction();

      setStatus({
        type: result.ok ? "success" : "error",
        message: result.message,
      });

      if (result.ok) {
        router.refresh();
      }
    });
  };

  const autoMarkIncomingAsRead = () => {
    if (!canSendMessage || !unreadIncomingCount || !markMessagesAsReadAction || isMarkingRead) {
      return;
    }

    startMarkReadTransition(async () => {
      const result = await markMessagesAsReadAction();

      if (result.ok) {
        router.refresh();
      }
    });
  };

  const handleSaveNote = (formData: FormData) => {
    if (!updateTeacherDeskNoteAction) {
      return;
    }

    setStatus(null);

    startSaveNoteTransition(async () => {
      const result = await updateTeacherDeskNoteAction(formData);

      setStatus({
        type: result.ok ? "success" : "error",
        message: result.message,
      });

      if (result.ok) {
        router.refresh();
      }
    });
  };

  return (
    <section className="relative scroll-mt-24 rounded-xl border border-indigo-200 bg-indigo-50 p-4" id="classroom-messages">
      {!canSendMessage && unreadIncomingCount > 0 ? (
        <span className="absolute right-6 top-4 inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-200 text-lg font-bold text-amber-900">
          *
        </span>
      ) : null}
      <h2 className="text-base font-semibold text-indigo-900">Bàn giảng viên</h2>
      <p className="mt-2 text-sm text-indigo-900">{teacherName ?? "Chưa cập nhật tên giảng viên"}</p>
      <p className="mt-1 text-sm text-indigo-700">Liên hệ: {teacherEmail ?? "Chưa cập nhật email"}</p>

      {canSendMessage && sendMessageAction ? (
        <form action={handleSendMessage} className="mt-3 space-y-2 rounded-md border border-indigo-200 bg-white p-2" ref={sendFormRef}>
          <input name="recipientId" type="hidden" value={teacherId} />
          <textarea
            className="w-full rounded-md border border-indigo-300 px-2 py-1 text-sm"
            disabled={isSending}
            onFocus={autoMarkIncomingAsRead}
            name="content"
            placeholder="Gửi tin nhắn nhanh cho giảng viên"
            required
            rows={2}
          />
          <button
            className="rounded-md border border-indigo-300 px-2 py-1 text-xs font-medium text-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSending}
            type="submit"
          >
            {isSending ? "Đang gửi..." : "Gửi tin nhắn"}
          </button>
        </form>
      ) : (
        <div className="mt-3">
          <div className="rounded-md border border-indigo-200 bg-white p-3 md:max-w-md">
            <label className="block text-sm font-medium text-indigo-900" htmlFor="teacher-desk-note">
              Ghi chú thông tin
            </label>
            {updateTeacherDeskNoteAction ? (
              <form action={handleSaveNote} className="mt-2 space-y-3" ref={noteFormRef}>
                <textarea
                  className="min-h-24 w-full rounded-md border border-indigo-200 px-3 py-2 text-sm text-slate-800"
                  defaultValue={teacherDeskNote ?? ""}
                  id="teacher-desk-note"
                  name="note"
                  placeholder="Nhập ghi chú ngắn cho bàn giảng viên."
                  rows={4}
                />
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    className="rounded-md border border-indigo-300 px-3 py-1.5 text-xs font-medium text-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isSavingNote}
                    type="submit"
                  >
                    {isSavingNote ? "Đang lưu..." : "Lưu ghi chú"}
                  </button>
                  <span className="text-xs text-indigo-700">Ghi chú này sẽ hiển thị ở Bàn giảng viên của sinh viên.</span>
                </div>
              </form>
            ) : (
              <div className="mt-2 rounded-md border border-indigo-100 bg-indigo-50 px-3 py-2 text-sm text-indigo-900">
                <TeacherDeskNoteContent value={teacherDeskNote} />
              </div>
            )}
          </div>
        </div>
      )}

      {status ? (
        <p className={status.type === "success" ? "mt-3 text-sm text-emerald-700" : "mt-3 text-sm text-red-600"} role="status">
          {status.message}
        </p>
      ) : null}

      {canSendMessage ? (
        <div className="mt-4 rounded-md border border-indigo-200 bg-white p-3">
          <div className="mb-3 rounded-md border border-indigo-100 bg-indigo-50 px-3 py-2 text-sm text-indigo-900">
            <TeacherDeskNoteContent value={teacherDeskNote} />
          </div>
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-indigo-900">Tin nhắn gần đây</h3>
            <div className="flex items-center gap-2">
              {unreadIncomingCount > 0 ? (
                <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-medium text-amber-700">{unreadIncomingCount} tin mới</span>
              ) : (
                <span className="rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-medium text-emerald-700">Đã đọc hết</span>
              )}
              <span className="text-xs text-indigo-700">{messages.length} tin</span>
            </div>
          </div>

          {unreadIncomingCount > 0 && markMessagesAsReadAction ? (
            <div className="mt-3">
              <button
                className="rounded-md border border-indigo-300 px-2 py-1 text-xs font-medium text-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isMarkingRead}
                onClick={handleMarkAsRead}
                type="button"
              >
                {isMarkingRead ? "Đang cập nhật..." : "Đánh dấu tất cả là đã đọc"}
              </button>
            </div>
          ) : null}

          {messages.length === 0 ? (
            <p className="mt-2 text-xs text-indigo-700">Chưa có tin nhắn nào trong lớp này.</p>
          ) : (
            <div className="mt-3 max-h-96 space-y-3 overflow-y-auto rounded-xl border border-indigo-100 bg-slate-50 p-3" ref={messageListRef}>
              {orderedMessages.map((message) => {
                const isOutgoing = currentActorId === message.senderId;
                const statusLabel = isOutgoing
                  ? message.readAt
                    ? "Giảng viên đã đọc"
                    : "Đã gửi"
                  : message.readAt
                    ? "Đã nhận"
                    : "Tin mới";
                const statusClassName = isOutgoing
                  ? message.readAt
                    ? "rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-medium text-emerald-700"
                    : "rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600"
                  : message.readAt
                    ? "rounded-full bg-sky-100 px-2 py-1 text-[11px] font-medium text-sky-700"
                    : "rounded-full bg-amber-100 px-2 py-1 text-[11px] font-medium text-amber-700";
                const senderLabel = isOutgoing ? "Bạn" : (message.senderName ?? "Giảng viên");

                return (
                  <div className={isOutgoing ? "flex justify-end" : "flex justify-start"} key={message.id}>
                    <article
                      className={
                        isOutgoing
                          ? "w-full max-w-[85%] rounded-2xl rounded-br-md border border-indigo-200 bg-white px-4 py-3 shadow-sm md:max-w-[70%]"
                          : "w-full max-w-[85%] rounded-2xl rounded-bl-md border border-sky-200 bg-sky-50 px-4 py-3 shadow-sm md:max-w-[70%]"
                      }
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className={isOutgoing ? "text-xs font-semibold text-indigo-900" : "text-xs font-semibold text-sky-900"}>
                          {senderLabel}
                        </p>
                        <span className="text-[11px] text-slate-500">{formatMessageTime(message.createdAt)}</span>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-800">{message.content}</p>
                      <div className={isOutgoing ? "mt-3 flex justify-end" : "mt-3 flex justify-start"}>
                        <span className={statusClassName}>{statusLabel}</span>
                      </div>
                    </article>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
