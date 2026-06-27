export type AppErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "CONFLICT"
  | "EXTERNAL_PROVIDER_ERROR"
  | "STORAGE_ERROR"
  | "UNKNOWN_ERROR";

export type AppError = {
  code: AppErrorCode;
  message: string;
  field?: string;
  details?: unknown;
};

export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: AppError };
