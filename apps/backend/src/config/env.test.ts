import { describe, expect, it } from "vitest";
import { ConfigError, loadConfig } from "./env.js";

describe("loadConfig", () => {
  it("applies development defaults when nothing is set", () => {
    expect(loadConfig({})).toEqual({
      nodeEnv: "development",
      port: 4000,
      frontendOrigins: ["http://localhost:3000"],
      logLevel: "info",
    });
  });

  it("parses a comma-separated list of frontend origins", () => {
    const config = loadConfig({ FRONTEND_ORIGIN: "http://localhost:3000, https://myarea.example " });
    expect(config.frontendOrigins).toEqual(["http://localhost:3000", "https://myarea.example"]);
  });

  it("reports every invalid variable by name without echoing secret values", () => {
    let error: unknown;
    try {
      loadConfig({ PORT: "not-a-port", FRONTEND_ORIGIN: "javascript:alert(1)", LOG_LEVEL: "loud" });
    } catch (e) {
      error = e;
    }

    expect(error).toBeInstanceOf(ConfigError);
    const { issues, message } = error as ConfigError;
    expect(issues).toHaveLength(3);
    expect(message).toMatch(/PORT/);
    expect(message).toMatch(/FRONTEND_ORIGIN/);
    expect(message).toMatch(/LOG_LEVEL/);
    expect(message).not.toContain("javascript:alert(1)");
  });
});
