import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { reloadTo } from "@/lib/navigate";
import { AcceptInviteForm } from "./AcceptInviteForm";

vi.mock("@/lib/navigate", () => ({ reloadTo: vi.fn() }));

const invite = {
  name: "Priya Menon",
  email: "priya@example.com",
  role: "RESIDENT",
  societyName: "Green Park Residency",
  expiresAt: "2026-10-31T13:10:00.000Z",
};

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

beforeEach(() => {
  vi.mocked(reloadTo).mockClear();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AcceptInviteForm", () => {
  it("looks the token up in a POST body and shows who is joining which society", async () => {
    const fetchMock = vi.fn(async () => json(200, { data: invite }));
    vi.stubGlobal("fetch", fetchMock);
    render(<AcceptInviteForm token="tok_123" />);

    expect(await screen.findByRole("heading", { level: 1, name: "Join Green Park Residency" })).toBeInTheDocument();
    expect(screen.getByText("priya@example.com")).toBeInTheDocument();
    expect(screen.getByText("Resident")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/invites/lookup", expect.objectContaining({ method: "POST", body: '{"token":"tok_123"}' }));
  });

  it("shows the invalid-link state without a form", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(410, { error: { code: "INVITE_INVALID", message: "gone" } })));
    render(<AcceptInviteForm token="expired" />);

    expect(await screen.findByRole("heading", { level: 1, name: "This invite link doesn't work" })).toBeInTheDocument();
    expect(screen.getByText(/Ask your society admin to send a new one/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Create a password")).not.toBeInTheDocument();
  });

  it("treats a missing token as invalid without calling the API", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<AcceptInviteForm token="" />);
    expect(screen.getByRole("heading", { name: "This invite link doesn't work" })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("checks the password rules and the confirmation before submitting", async () => {
    const fetchMock = vi.fn(async () => json(200, { data: invite }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<AcceptInviteForm token="tok_123" />);
    await screen.findByLabelText("Create a password");

    await user.type(screen.getByLabelText("Create a password"), "short");
    await user.click(screen.getByRole("button", { name: "Join and sign in" }));
    expect(screen.getByText("Use at least 10 characters")).toBeInTheDocument();
    expect(screen.getByLabelText("Create a password")).toHaveFocus();

    await user.clear(screen.getByLabelText("Create a password"));
    await user.type(screen.getByLabelText("Create a password"), "long enough password");
    await user.type(screen.getByLabelText("Confirm password"), "different password!");
    await user.click(screen.getByRole("button", { name: "Join and sign in" }));
    expect(screen.getByText("The passwords don't match")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1); // only the lookup
  });

  it("joins and signs in", async () => {
    const fetchMock = vi.fn(async () => json(200, { data: invite }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<AcceptInviteForm token="tok_123" />);
    await screen.findByLabelText("Create a password");

    await user.type(screen.getByLabelText("Create a password"), "long enough password");
    await user.type(screen.getByLabelText("Confirm password"), "long enough password");
    await user.click(screen.getByRole("button", { name: "Join and sign in" }));

    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/auth/invites/accept",
      expect.objectContaining({ body: JSON.stringify({ token: "tok_123", password: "long enough password" }) }),
    );
    expect(reloadTo).toHaveBeenCalledWith("/");
  });
});
