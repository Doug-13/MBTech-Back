export type ApiResponse<T> = T | { error: string; details?: unknown };
