import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createFakeLogger } from "../../test/helpers/app.js";
import { AppError } from "../lib/errors.js";
import { errorHandler } from "./error-handler.js";
import { requestId } from "./request-id.js";

function buildApp(route: express.RequestHandler) {
  const logger = createFakeLogger();
  const app = express();
  app.use(requestId());
  app.get("/boom", route);
  app.use(errorHandler(logger));
  return { app, logger };
}

describe("errorHandler", () => {
  it("returns AppError status, code, message and details", async () => {
    const { app, logger } = buildApp(() => {
      throw new AppError(400, "VALIDATION_ERROR", "Some fields need attention", {
        fieldErrors: { title: ["Required"] },
      });
    });

    const res = await request(app).get("/boom");

    expect(res.status).toBe(400);
    expect(res.body.error).toEqual({
      code: "VALIDATION_ERROR",
      message: "Some fields need attention",
      details: { fieldErrors: { title: ["Required"] } },
      requestId: res.headers["x-request-id"],
    });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("hides unexpected error details and logs them with the request id", async () => {
    const { app, logger } = buildApp(() => {
      throw new Error("connect ECONNREFUSED postgres://admin:hunter2@db:5432");
    });

    const res = await request(app).get("/boom");

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe("INTERNAL_ERROR");
    expect(JSON.stringify(res.body)).not.toMatch(/ECONNREFUSED|hunter2|stack/);
    expect(logger.error).toHaveBeenCalledWith(
      "unhandled error",
      expect.objectContaining({ requestId: res.headers["x-request-id"] }),
    );
  });

  it("catches rejected promises from async handlers (Express 5)", async () => {
    const { app } = buildApp(async () => {
      await Promise.resolve();
      throw new AppError(404, "NOT_FOUND", "Report not found");
    });

    const res = await request(app).get("/boom");

    expect(res.status).toBe(404);
    expect(res.body.error).toMatchObject({ code: "NOT_FOUND", message: "Report not found" });
  });
});
