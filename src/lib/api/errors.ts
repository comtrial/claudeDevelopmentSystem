import type { ApiError } from "@/types/api";

export const ErrorCodes = {
  BAD_REQUEST: { status: 400, code: "BAD_REQUEST" },
  UNAUTHORIZED: { status: 401, code: "UNAUTHORIZED" },
  FORBIDDEN: { status: 403, code: "FORBIDDEN" },
  NOT_FOUND: { status: 404, code: "NOT_FOUND" },
  CONFLICT: { status: 409, code: "CONFLICT" },
  UNPROCESSABLE: { status: 422, code: "UNPROCESSABLE_ENTITY" },
  INTERNAL: { status: 500, code: "INTERNAL_ERROR" },
} as const;

export class AppError extends Error {
  public statusCode: number;
  public code: string;

  constructor(statusCode: number, message: string, code: string) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
  }

  toApiError(): ApiError {
    return { message: this.message, code: this.code };
  }
}

export const Errors = {
  badRequest: (message = "Invalid request") =>
    new AppError(400, message, ErrorCodes.BAD_REQUEST.code),
  unauthorized: (message = "Unauthorized") =>
    new AppError(401, message, ErrorCodes.UNAUTHORIZED.code),
  forbidden: (message = "Access denied") =>
    new AppError(403, message, ErrorCodes.FORBIDDEN.code),
  notFound: (resource = "Resource") =>
    new AppError(404, `${resource} not found`, ErrorCodes.NOT_FOUND.code),
  conflict: (message = "Resource conflict") =>
    new AppError(409, message, ErrorCodes.CONFLICT.code),
  unprocessable: (message = "Unprocessable entity") =>
    new AppError(422, message, ErrorCodes.UNPROCESSABLE.code),
  internal: (message = "Internal server error") =>
    new AppError(500, message, ErrorCodes.INTERNAL.code),
} as const;
