import { describe, expect, it } from "vitest";
import { inviteEmail } from "./invite.js";

const input = {
  memberName: "Priya Menon",
  inviterName: "Asha Rao",
  societyName: "Green Park Residency",
  role: "MANAGER" as const,
  link: "http://localhost:3000/invite?token=abc_DEF-123",
  expiresAt: new Date("2026-10-31T10:00:00.000Z"),
};

describe("inviteEmail", () => {
  it("names the society, inviter, role, link and exact expiry", () => {
    const { subject, text, html } = inviteEmail(input);

    expect(subject).toBe("You're invited to Green Park Residency on MyArea");
    expect(text).toContain("Asha Rao has invited you to join Green Park Residency on MyArea as a manager.");
    expect(text).toContain("Set your password and join: http://localhost:3000/invite?token=abc_DEF-123");
    expect(text).toContain("expires on 31 Oct 2026, 10:00 UTC");
    expect(html).toContain('href="http://localhost:3000/invite?token=abc_DEF-123"');
  });

  it("escapes user-supplied text in the HTML part", () => {
    const { html } = inviteEmail({ ...input, memberName: "<script>alert(1)</script>", societyName: 'Tom & "Jerry" Towers' });

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("Tom &amp; &quot;Jerry&quot; Towers");
  });
});
