import { describe, expect, it } from "vitest";
import { initials } from "@/components/ui/Avatar";
import { safeNextPath } from "./redirect-target";

describe("safeNextPath", () => {
  it("keeps same-site paths and rejects everything else", () => {
    expect(safeNextPath("/reports?mine=true")).toBe("/reports?mine=true");
    expect(safeNextPath(undefined)).toBe("/");
    expect(safeNextPath("https://evil.example")).toBe("/");
    expect(safeNextPath("//evil.example")).toBe("/");
    expect(safeNextPath("/\\evil.example")).toBe("/");
    expect(safeNextPath("reports")).toBe("/");
  });
});

describe("initials", () => {
  it("uses the first and last name", () => {
    expect(initials("Meera Iyer")).toBe("MI");
    expect(initials("  asha  k  rao ")).toBe("AR");
    expect(initials("Rohit")).toBe("R");
    expect(initials("")).toBe("?");
  });
});
