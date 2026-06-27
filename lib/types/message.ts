export type DirectMessage = {
  id: string;
  classId: string;
  senderId: string;
  recipientId: string;
  content: string;
  createdAt: string;
  readAt: string | null;
};

export type SendClassDirectMessageInput = {
  classId: string;
  actorId: string;
  actorRole: "admin" | "moderator" | "teacher" | "student";
  recipientId: string;
  content: string;
};

export type ClassroomMessageMutationResult = {
  ok: boolean;
  message: string;
};

export type MarkClassDirectMessagesAsReadInput = {
  classId: string;
  actorId: string;
  actorRole: "admin" | "moderator" | "teacher" | "student";
  senderId?: string;
};
