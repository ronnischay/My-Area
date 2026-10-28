import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiFetch, getHealth } from "./api-client";

function mockFetch(impl: () => Promise<Response>) {
  const fetchMock = vi.fn(impl);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { "Content-Type": "application/json", ...init.headers },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("apiFetch", () => {
  it("returns the parsed body on success and calls the configured base URL", async () => {
    const fetchMock = mockFetch(async () => jsonResponse({ status: "ok" }));

    await expect(getHealth()).resolves.toEqual({ status: "ok" });
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:4000/health", expect.any(Object));
  });

  it("maps the API error envelope to an ApiError with field errors and request id", async () => {
    mockFetch(async () =>
      jsonResponse(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Some fields need attention",
            details: { fieldErrors: { title: ["Title must be at least 5 characters"] } },
            requestId: "req-123",
          },
        },
        { status: 400 },
      ),
    );

    const error = await apiFetch("/api/reports").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 400,
      code: "VALIDATION_ERROR",
      message: "Some fields need attention",
      fieldErrors: { title: ["Title must be at least 5 characters"] },
      requestId: "req-123",
    });
  });

  it("falls back to a generic error when the body is not the envelope", async () => {
    mockFetch(async () => new Response("<html>Bad gateway</html>", { status: 502, headers: { "x-request-id": "r-9" } }));

    await expect(apiFetch("/health")).rejects.toMatchObject({ status: 502, code: "INTERNAL_ERROR", requestId: "r-9" });
  });

  it("reports network failures as NETWORK_ERROR without leaking the raw error", async () => {
    mockFetch(async () => {
      throw new TypeError("fetch failed: ECONNREFUSED 127.0.0.1:4000");
    });

    const error = await apiFetch("/health").catch((e: unknown) => e);
    expect(error).toMatchObject({ status: 0, code: "NETWORK_ERROR" });
    expect((error as ApiError).message).not.toContain("ECONNREFUSED");
  });
});
