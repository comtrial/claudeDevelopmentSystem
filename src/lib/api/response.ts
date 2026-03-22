import type { ApiResponse } from "@/types/api";
import { AppError } from "./errors";

export function successResponse<T>(data: T): ApiResponse<T> {
  return { data, error: null, status: 200 };
}

export function errorResponse(
  message: string,
  code = "UNKNOWN_ERROR",
  status = 500
): ApiResponse<never> {
  return {
    data: null,
    error: { message, code },
    status,
  };
}

export function handleError(err: unknown): {
  body: ApiResponse<never>;
  status: number;
} {
  if (err instanceof AppError) {
    return {
      body: errorResponse(err.message, err.code, err.statusCode),
      status: err.statusCode,
    };
  }

  console.error("Unhandled error:", err);
  return {
    body: errorResponse("Internal server error", "INTERNAL_ERROR", 500),
    status: 500,
  };
}
