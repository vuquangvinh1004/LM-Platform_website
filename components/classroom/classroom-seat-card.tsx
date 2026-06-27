"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { ClassroomDirectMessage, ClassroomSeat } from "@/lib/types/classroom";
import type { ClassroomMessageMutationResult } from "@/lib/types/message";

type ClassroomSeatCardProps = {
  seat: ClassroomSeat;
  canSendMessage: boolean;
  sendMessageAction?: (formData: FormData) => Promise<ClassroomMessageMutationResult>;
  markMessagesAsReadAction?: (studentId: string) => Promise<ClassroomMessageMutationResult>;
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

export function ClassroomSeatCard({
  seat,
  canSendMessage,
  sendMessageAction,
  markMessagesAsReadAction,
  currentActorId,
  messages = [],
}: ClassroomSeatCardProps) {
  const router = useRouter();
  const messageListRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isPending, startTransition] = useTransition();
  const [isMarkingRead, startMarkReadTransition] = useTransition();
  const [status, setStatus] = useState<MessageStatus>(null);
  const [isReplyOpen, setIsReplyOpen] = useState(false);
  const initialUnreadCount = messages.filter(
    (message) => currentActorId === message.recipientId && message.senderId === seat.studentId && !message.readAt,
  ).length;
  const [localUnreadCount, setLocalUnreadCount] = useState(initialUnreadCount);
  const [isHighlighted, setIsHighlighted] = useState(initialUnreadCount > 0);
  const unreadCount = localUnreadCount;
  const orderedMessages = [...messages].sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());

  useEffect(() => {
    if (!isReplyOpen || !messageListRef.current) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      if (!messageListRef.current) {
        return;
      }

      messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [isReplyOpen, orderedMessages.length]);

  useEffect(() => {
    if (!isReplyOpen || !textareaRef.current) {
      return;
    }

    textareaRef.current.focus();
  }, [isReplyOpen]);

  const handleSubmit = (formData: FormData) => {
    if (!sendMessageAction) {
      return;
    }

    setStatus(null);

    startTransition(async () => {
      const result = await sendMessageAction(formData);

      setStatus({
        type: result.ok ? "success" : "error",
        message: result.message,
      });

      if (result.ok) {
        formRef.current?.reset();
        setIsHighlighted(false);
        setLocalUnreadCount(0);
        router.refresh();
      }
    });
  };

  const handleOpenReply = () => {
    setIsReplyOpen((current) => !current);

    if (!unreadCount || !markMessagesAsReadAction) {
      setIsHighlighted(false);
      setLocalUnreadCount(0);
      return;
    }

    startMarkReadTransition(async () => {
      const result = await markMessagesAsReadAction(seat.studentId);

      if (result.ok) {
        setIsHighlighted(false);
        setLocalUnreadCount(0);
      } else {
        setStatus({
          type: "error",
          message: result.message,
        });
      }
    });
  };

  const handleTextareaKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey || isPending) {
      return;
    }

    event.preventDefault();
    formRef.current?.requestSubmit();
  };

  return (
    <article
      aria-label={`Chỗ ngồi ${seat.seatOrder}: ${seat.fullName}`}
      className={
        isHighlighted
          ? "h-fit self-start rounded-lg border border-amber-300 bg-amber-50 p-3 shadow-sm ring-1 ring-amber-200 focus-within:border-sky-500"
          : "h-fit self-start rounded-lg border border-slate-300 bg-white p-3 shadow-sm focus-within:border-sky-500"
      }
      tabIndex={0}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-slate-500">Bàn #{seat.seatOrder}</p>
        <div className="flex items-center gap-2">
          {unreadCount > 0 ? <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-medium text-amber-700">{unreadCount} tin mới</span> : null}
          {canSendMessage && sendMessageAction ? (
            <button
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isMarkingRead}
              onClick={handleOpenReply}
              type="button"
            >
              {isReplyOpen ? "Ẩn nhắn tin" : "Mở nhắn tin"}
            </button>
          ) : null}
        </div>
      </div>
      <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-sm font-medium text-slate-900">
        Tên - Họ: {seat.fullName}
      </div>
      <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-sm text-slate-700">
        MSSV: {seat.studentCode ?? "Chưa cập nhật"}
      </div>

      {canSendMessage && sendMessageAction && isReplyOpen ? (
        <div className="mt-3 space-y-3 rounded-md border border-slate-200 bg-slate-50 p-3">
          {orderedMessages.length > 0 ? (
            <div className="space-y-2 rounded-md border border-slate-200 bg-white p-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tin nhắn tại bàn</p>
              <div className="max-h-72 space-y-3 overflow-y-auto rounded-lg bg-slate-50 p-2" ref={messageListRef}>
                {orderedMessages.map((message) => {
                  const isOutgoing = currentActorId === message.senderId;
                  const statusLabel = isOutgoing ? "Bạn" : "Sinh viên";

                  return (
                    <div className={isOutgoing ? "flex justify-end" : "flex justify-start"} key={message.id}>
                      <article
                        className={
                          isOutgoing
                            ? "w-full max-w-[88%] rounded-2xl rounded-br-md border border-indigo-200 bg-white px-3 py-2 shadow-sm"
                            : "w-full max-w-[88%] rounded-2xl rounded-bl-md border border-amber-200 bg-amber-50 px-3 py-2 shadow-sm"
                        }
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className={isOutgoing ? "text-xs font-semibold text-indigo-900" : "text-xs font-semibold text-amber-900"}>
                            {statusLabel}
                          </p>
                          <span className="text-[11px] text-slate-500">{formatMessageTime(message.createdAt)}</span>
                        </div>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-800">{message.content}</p>
                      </article>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">Chưa có tin nhắn nào tại bàn này.</p>
          )}

          <form action={handleSubmit} className="space-y-2" ref={formRef}>
              <input name="recipientId" type="hidden" value={seat.studentId} />
              <textarea
                className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                disabled={isPending}
                onKeyDown={handleTextareaKeyDown}
                name="content"
                placeholder="Nhắn tin nhanh cho sinh viên này"
                required
                rows={2}
                ref={textareaRef}
              />
            <div className="flex items-center gap-3">
              <button
                className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isPending}
                type="submit"
              >
                {isPending ? "Đang gửi..." : "Gửi tin nhắn"}
              </button>
              <span className="text-xs text-slate-500">Nhấn Enter để gửi, Shift+Enter để xuống dòng.</span>
            </div>
          </form>

          {status ? (
            <p className={status.type === "success" ? "text-xs text-emerald-700" : "text-xs text-red-600"} role="status">
              {status.message}
            </p>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
