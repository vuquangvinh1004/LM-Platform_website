import { ClassroomSeatCard } from "@/components/classroom/classroom-seat-card";
import type { ClassroomDirectMessage, ClassroomSeat } from "@/lib/types/classroom";
import type { ClassroomMessageMutationResult } from "@/lib/types/message";

type ClassroomSeatGridProps = {
  seats: ClassroomSeat[];
  columns: number;
  canSendMessage: boolean;
  sendMessageAction?: (formData: FormData) => Promise<ClassroomMessageMutationResult>;
  markMessagesAsReadAction?: (studentId: string) => Promise<ClassroomMessageMutationResult>;
  currentActorId?: string;
  messages?: ClassroomDirectMessage[];
};

export function ClassroomSeatGrid({
  seats,
  columns,
  canSendMessage,
  sendMessageAction,
  markMessagesAsReadAction,
  currentActorId,
  messages = [],
}: ClassroomSeatGridProps) {
  if (seats.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">
        Chưa có sinh viên đang hoạt động trong lớp để xếp chỗ ngồi.
      </div>
    );
  }

  return (
    <div
      className="grid auto-rows-min items-start grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
      style={{
        ...(columns === 4
          ? undefined
          : {
              gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
            }),
      }}
    >
      {seats.map((seat) => (
        <ClassroomSeatCard
          canSendMessage={canSendMessage}
          currentActorId={currentActorId}
          key={seat.studentId}
          markMessagesAsReadAction={markMessagesAsReadAction}
          messages={messages.filter((message) => message.senderId === seat.studentId || message.recipientId === seat.studentId)}
          seat={seat}
          sendMessageAction={sendMessageAction}
        />
      ))}
    </div>
  );
}
