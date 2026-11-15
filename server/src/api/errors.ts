import type { FastifyInstance } from "fastify";

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
  }
}

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        error: error.code,
        message: error.message
      });
    }

    if (
      typeof error === "object" &&
      error !== null &&
      "validation" in error &&
      Array.isArray((error as { validation?: unknown }).validation)
    ) {
      return reply.status(400).send({
        error: "INVALID_REQUEST",
        message: "请求内容不符合要求",
        details: (error as { validation: unknown }).validation
      });
    }

    app.log.error(error);
    return reply.status(500).send({
      error: "INTERNAL_ERROR",
      message: "操作失败，请稍后重试"
    });
  });
}
