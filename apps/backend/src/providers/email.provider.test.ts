import { describe, expect, it } from "vitest";
import { createFakeLogger } from "../../test/helpers/app.js";
import { createEmailSender } from "./email.provider.js";

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
