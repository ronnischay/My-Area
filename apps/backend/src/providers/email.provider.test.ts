import { describe, expect, it, vi } from "vitest";
import { createFakeLogger } from "../../test/helpers/app.js";
import { createBrevoEmailSender, createEmailSender, parseSender } from "./email.provider.js";

const message = { to: "priya@example.com", subject: "Hello", text: "Link: http://localhost:3000/invite?token=abc", html: "<p>Hi</p>" };

describe("createEmailSender", () => {
  it("console provider logs the message (with the link) instead of sending", async () => {
    const logger = createFakeLogger();
    const sender = createEmailSender({ provider: "console", from: "MyArea <no-reply@localhost>" }, logger);

    await sender.send(message);

    expect(logger.info).toHaveBeenCalledWith("email not sent (EMAIL_PROVIDER=console)", {
      from: "MyArea <no-reply@localhost>",
      to: "priya@example.com",
      subject: "Hello",
      text: message.text,
    });
  });

  it("smtp provider surfaces connection failures to the caller (which reports FAILED)", async () => {
    const sender = createEmailSender(
      // Port 9 on localhost is not an SMTP server: fails fast without touching the network.
      { provider: "smtp", from: "MyArea <no-reply@localhost>", smtp: { host: "127.0.0.1", port: 9, secure: false } },
      createFakeLogger(),
    );

    await expect(sender.send(message)).rejects.toThrow();
  });
});

describe("createBrevoEmailSender", () => {
  const KEY = "xkeysib-test-key";
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

  it("posts the message to Brevo's API with the key in a header, and returns the message id", async () => {
    const fetchImpl = vi.fn(async () => json(201, { messageId: "<20261101.123@smtp-relay.mailin.fr>" }));
    const sender = createBrevoEmailSender({ apiKey: KEY, from: "MyArea <myarea.alerts@gmail.com>", fetchImpl });

    await expect(sender.send(message)).resolves.toEqual({ messageId: "<20261101.123@smtp-relay.mailin.fr>" });

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.brevo.com/v3/smtp/email");
    expect(url).not.toContain(KEY);
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({ "api-key": KEY, "Content-Type": "application/json" });
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(String(init.body))).toEqual({
      sender: { name: "MyArea", email: "myarea.alerts@gmail.com" },
      to: [{ email: "priya@example.com" }],
      subject: "Hello",
      htmlContent: "<p>Hi</p>",
      textContent: message.text,
    });
  });

  it("is what createEmailSender returns for EMAIL_PROVIDER=brevo", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(json(201, { messageId: "m1" }));
    try {
      const sender = createEmailSender({ provider: "brevo", from: "no-reply@example.com", apiKey: KEY }, createFakeLogger());
      await expect(sender.send(message)).resolves.toEqual({ messageId: "m1" });
      expect(fetchSpy).toHaveBeenCalledWith("https://api.brevo.com/v3/smtp/email", expect.anything());
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("rejects with Brevo's status, code and message (never the key), so the caller reports FAILED", async () => {
    const fetchImpl = vi.fn(async () => json(400, { code: "invalid_parameter", message: "sender is not valid" }));
    const sender = createBrevoEmailSender({ apiKey: KEY, from: "no-reply@example.com", fetchImpl });

    const error = await sender.send(message).catch((err: Error) => err);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe("Brevo HTTP 400 (invalid_parameter: sender is not valid)");
    expect((error as Error).message).not.toContain(KEY);

    const unauthorized = createBrevoEmailSender({ apiKey: KEY, from: "a@b.co", fetchImpl: vi.fn(async () => new Response("nope", { status: 401 })) });
    await expect(unauthorized.send(message)).rejects.toThrow("Brevo HTTP 401");
  });

  it("reports a timeout or a network failure without details", async () => {
    const timeout = createBrevoEmailSender({ apiKey: KEY, from: "a@b.co", timeoutMs: 1, fetchImpl: (_url, init) => new Promise((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(init.signal?.reason))) });
    await expect(timeout.send(message)).rejects.toThrow("Brevo timed out");

    const offline = createBrevoEmailSender({ apiKey: KEY, from: "a@b.co", fetchImpl: vi.fn(async () => { throw new TypeError("fetch failed"); }) });
    await expect(offline.send(message)).rejects.toThrow("Brevo unreachable");
  });
});

describe("parseSender", () => {
  it("splits a display name from the address, or takes a bare address", () => {
    expect(parseSender("MyArea <no-reply@example.com>")).toEqual({ name: "MyArea", email: "no-reply@example.com" });
    expect(parseSender('"My Area" <no-reply@example.com>')).toEqual({ name: "My Area", email: "no-reply@example.com" });
    expect(parseSender("<no-reply@example.com>")).toEqual({ email: "no-reply@example.com" });
    expect(parseSender(" no-reply@example.com ")).toEqual({ email: "no-reply@example.com" });
  });
});
