import type { Request, Response, NextFunction } from "express";
import { Prisma } from "@prisma/client";
import type { JsonWebTokenError, TokenExpiredError } from "jsonwebtoken";

interface ErrorResponseBody {
  success: false;
  message: string;
  code: string;
}

function buildError(
  message: string,
  code: string
): ErrorResponseBody {
  return { success: false, message, code };
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): Response<ErrorResponseBody> {
  // Prisma known errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const message = "Database operation failed";
    return res.status(400).json(buildError(message, `PRISMA_${err.code}`));
  }

  // JWT errors
  const jwtError = err as JsonWebTokenError | TokenExpiredError | undefined;
  if (jwtError && jwtError.name === "TokenExpiredError") {
    return res.status(401).json(buildError("Token expired", "TOKEN_EXPIRED"));
  }
  if (jwtError && jwtError.name === "JsonWebTokenError") {
    return res.status(401).json(buildError("Invalid token", "TOKEN_INVALID"));
  }

  // Generic validation errors (can be extended for Zod/Joi, etc.)
  if (err instanceof Error && err.name === "ValidationError") {
    return res.status(400).json(buildError(err.message, "VALIDATION_ERROR"));
  }

  // express.json / urlencoded body size exceeded
  if (
    err instanceof Error &&
    (err.name === "PayloadTooLargeError" ||
      (err as { type?: string }).type === "entity.too.large" ||
      /request entity too large/i.test(err.message))
  ) {
    return res
      .status(413)
      .json(
        buildError(
          "Request body is too large. Upload media separately or reduce image/PDF size.",
          "PAYLOAD_TOO_LARGE"
        )
      );
  }

  // Fallback
  const isProd = process.env.NODE_ENV === "production";
  if (!isProd && err instanceof Error) {
    // eslint-disable-next-line no-console
    console.error("[errorHandler]", err.stack || err);
  }

  return res
    .status(500)
    .json(buildError("Internal server error", "INTERNAL_SERVER_ERROR"));
}

