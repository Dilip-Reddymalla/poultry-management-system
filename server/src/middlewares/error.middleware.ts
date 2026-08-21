import type { ErrorRequestHandler } from "express";
import { z } from "zod";

import { AppError } from "../utils/app-error.js";

export const errorMiddleware: ErrorRequestHandler = (
  err,
  _req,
  res,
  _next,
) => {
  console.error(err);

  if (err instanceof z.ZodError) {
    res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: z.flattenError(err).fieldErrors,
    });

    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });

    return;
  }

  res.status(500).json({
    success: false,
    message: "Internal server error",
  });
};