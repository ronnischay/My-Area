import { describe, expect, it } from "vitest";
import { readCookie } from "./cookies.js";

describe("readCookie", () => {
  it("finds a cookie among others and decodes it", () => {
    expect(readCookie("theme=dark; myarea_session=abc%2D123; other=1", "myarea_session")).toBe("abc-123");
  });

  it("does not match on a name prefix", () => {
    expect(readCookie("myarea_session_old=stale", "myarea_session")).toBeUndefined();
  });

  it("returns undefined for a missing header, a missing cookie or a malformed value", () => {
    expect(readCookie(undefined, "myarea_session")).toBeUndefined();
    expect(readCookie("a=1; b=2", "myarea_session")).toBeUndefined();
    expect(readCookie("myarea_session=%E0%A4%A", "myarea_session")).toBeUndefined();
  });
});
