import type { FastifyInstance } from "fastify";
import { ZodError } from "zod";

import { TodoNotFoundError } from "../repositories/todo-repository.js";

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error, _request, reply) => {
    const caught = error instanceof Error ? error : new Error(String(error));
    if (error instanceof ApiError) {
      return reply.code(error.statusCode).send({ error: { code: error.code, message: error.message } });
    }
    if (error instanceof ZodError) {
      return reply.code(400).send({
        error: {
          code: "INVALID_TODO",
          message: error.issues[0]?.message ?? "待办内容无效",
          details: error.issues,
        },
      });
    }
    if (caught instanceof TodoNotFoundError || /List '.+' not found/.test(caught.message)) {
      return reply.code(404).send({ error: { code: "NOT_FOUND", message: caught.message } });
    }
    app.log.error(caught);
    return reply.code(500).send({ error: { code: "INTERNAL_ERROR", message: "服务暂时不可用" } });
  });
}
