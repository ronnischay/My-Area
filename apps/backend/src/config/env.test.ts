import { describe, expect, it } from "vitest";
import { ConfigError, loadConfig } from "./env.js";

const DATABASE_URL = "postgres://dev@localhost:5432/myarea_dev";

function configError(source: NodeJS.ProcessEnv): ConfigError {
  try {
    loadConfig(source);
  } catch (error) {
    if (error instanceof ConfigError) return error;
    throw error;
  }
  throw new Error("expected loadConfig to throw");
}

describe("loadConfig", () => {
  it("applies development defaults when only DATABASE_URL is set", () => {
    expect(loadConfig({ DATABASE_URL })).toEqual({
      nodeEnv: "development",
      port: 4000,
      frontendOrigins: ["http://localhost:3000"],
      logLevel: "info",
      databaseUrl: DATABASE_URL,
      appUrl: "http://localhost:3000",
      email: { provider: "console", from: "MyArea <no-reply@localhost>" },
    });
  });

  it("requires DATABASE_URL", () => {
    expect(configError({}).message).toMatch(/DATABASE_URL/);
  });

  it("parses a comma-separated list of frontend origins", () => {
    const config = loadConfig({ DATABASE_URL, FRONTEND_ORIGIN: "http://localhost:3000, https://myarea.example " });
    expect(config.frontendOrigins).toEqual(["http://localhost:3000", "https://myarea.example"]);
  });

  it("strips a trailing slash from APP_URL", () => {
    expect(loadConfig({ DATABASE_URL, APP_URL: "https://myarea.example/" }).appUrl).toBe("https://myarea.example");
  });

  it("builds SMTP settings, with auth only when user and password are both set", () => {
    const withAuth = loadConfig({
      DATABASE_URL,
      EMAIL_PROVIDER: "smtp",
      SMTP_HOST: "smtp.example.com",
      SMTP_PORT: "465",
      SMTP_SECURE: "true",
      SMTP_USER: "mailer",
      SMTP_PASS: "s3cret",
    });
    expect(withAuth.email).toEqual({
      provider: "smtp",
      from: "MyArea <no-reply@localhost>",
      smtp: { host: "smtp.example.com", port: 465, secure: true, auth: { user: "mailer", pass: "s3cret" } },
    });

    const noAuth = loadConfig({ DATABASE_URL, EMAIL_PROVIDER: "smtp", SMTP_HOST: "localhost", SMTP_PORT: "1025" });
    expect(noAuth.email).toEqual({
      provider: "smtp",
      from: "MyArea <no-reply@localhost>",
      smtp: { host: "localhost", port: 1025, secure: false },
    });
  });

  it("rejects incomplete or unsafe email settings", () => {
    expect(configError({ DATABASE_URL, EMAIL_PROVIDER: "smtp" }).message).toMatch(/SMTP_HOST/);
    expect(configError({ DATABASE_URL, NODE_ENV: "production" }).message).toMatch(/EMAIL_PROVIDER/);
    expect(
      configError({ DATABASE_URL, EMAIL_PROVIDER: "smtp", SMTP_HOST: "localhost", SMTP_USER: "only-user" }).message,
    ).toMatch(/SMTP_USER/);
  });

  it("reports every invalid variable by name without echoing secret values", () => {
    const { issues, message } = configError({
      DATABASE_URL: "mysql://root:hunter2@db/app",
      PORT: "not-a-port",
      FRONTEND_ORIGIN: "javascript:alert(1)",
      LOG_LEVEL: "loud",
    });

    expect(issues).toHaveLength(4);
    expect(message).toMatch(/PORT/);
    expect(message).toMatch(/FRONTEND_ORIGIN/);
    expect(message).toMatch(/LOG_LEVEL/);
    expect(message).toMatch(/DATABASE_URL/);
    expect(message).not.toContain("javascript:alert(1)");
    expect(message).not.toContain("hunter2");
  });
});
