import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiFetch } from "./api-client";

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
  it("calls the same-origin path with the session cookie and returns the parsed body", async () => {
    const fetchMock = mockFetch(async () => jsonResponse({ data: { id: "u1" } }));

    await expect(apiFetch("/api/auth/me")).resolves.toEqual({ data: { id: "u1" } });
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/me", expect.objectContaining({ credentials: "same-origin" }));
  });

  it("sends a plain object as JSON and FormData as multipart", async () => {
    const fetchMock = mockFetch(async () => jsonResponse({}));

    await apiFetch("/api/auth/login", { method: "POST", body: { email: "a@b.c" } });
    const [, jsonInit] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(jsonInit.body).toBe('{"email":"a@b.c"}');
    expect(jsonInit.headers).toMatchObject({ "Content-Type": "application/json" });

    const form = new FormData();
    form.set("title", "Pothole");
    await apiFetch("/api/reports", { method: "POST", body: form });
    const [, formInit] = fetchMock.mock.calls[1] as unknown as [string, RequestInit];
    expect(formInit.body).toBe(form);
    expect(formInit.headers).not.toHaveProperty("Content-Type");
  });

  it("returns undefined for 204 No Content", async () => {
    mockFetch(async () => new Response(null, { status: 204 }));
    await expect(apiFetch("/api/auth/logout", { method: "POST" })).resolves.toBeUndefined();
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

    await expect(apiFetch("/api/reports")).rejects.toMatchObject({ status: 502, code: "INTERNAL_ERROR", requestId: "r-9" });
  });

  it("reports network failures as NETWORK_ERROR without leaking the raw error", async () => {
    mockFetch(async () => {
      throw new TypeError("fetch failed: ECONNREFUSED 127.0.0.1:4000");
    });

    const error = await apiFetch("/api/reports").catch((e: unknown) => e);
    expect(error).toMatchObject({ status: 0, code: "NETWORK_ERROR" });
    expect((error as ApiError).message).not.toContain("ECONNREFUSED");
  });
});
