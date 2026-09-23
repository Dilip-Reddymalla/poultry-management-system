export class AppError extends Error {
  public readonly statusCode: number;
  public readonly details?: Record<string, any> | undefined;
  public readonly code?: string | undefined;

  constructor(
    message: string,
    statusCode: number,
    details?: Record<string, any> | undefined,
    code?: string | undefined,
  ) {
    super(message);

    this.name = "AppError";
    this.statusCode = statusCode;
    if (details !== undefined) {
      this.details = details;
    }
    if (code !== undefined) {
      this.code = code;
    }
  }
}