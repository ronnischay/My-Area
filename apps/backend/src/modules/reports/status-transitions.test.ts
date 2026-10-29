import { describe, expect, it } from "vitest";
import { REPORT_STATUSES } from "./reports.types.js";
import { canTransition } from "./status-transitions.js";

const ALLOWED = new Set(["OPEN→IN_PROGRESS", "OPEN→REJECTED", "IN_PROGRESS→RESOLVED", "IN_PROGRESS→REJECTED", "IN_PROGRESS→OPEN"]);

describe("canTransition", () => {
  // Every one of the 16 pairs, so a change to the map can't slip through unnoticed.
  for (const from of REPORT_STATUSES) {
    for (const to of REPORT_STATUSES) {
      const key = `${from}→${to}`;
      it(`${key} is ${ALLOWED.has(key) ? "allowed" : "refused"}`, () => {
        expect(canTransition(from, to)).toBe(ALLOWED.has(key));
      });
    }
  }
});
