import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SocietyMember } from "@/types/api";
import { InviteMemberForm } from "./InviteMemberForm";
import { MembersList } from "./MembersList";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const member = (overrides: Partial<SocietyMember>): SocietyMember => ({
  id: "m1",
  name: "Meera Iyer",
  email: "meera@example.com",
  role: "RESIDENT",
  status: "ACTIVE",
  inviteExpiresAt: null,
  lastLoginAt: null,
  createdAt: "2026-10-01T10:00:00.000Z",
  ...overrides,
});

beforeEach(() => refresh.mockClear());
afterEach(() => vi.unstubAllGlobals());

describe("InviteMemberForm", () => {
  async function fill(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByLabelText("Full name"), "Priya Menon");
    await user.type(screen.getByLabelText("Email"), "priya@example.com");
    await user.click(screen.getByRole("radio", { name: "Manager" }));
    await user.click(screen.getByRole("button", { name: "Send invite" }));
  }

  it("invites with the chosen role, confirms, clears the form and refreshes the list", async () => {
    const fetchMock = vi.fn(async () => json(201, { data: member({}), meta: { invite: "SENT" } }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<InviteMemberForm />);

    await fill(user);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/users",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ name: "Priya Menon", email: "priya@example.com", role: "MANAGER" }) }),
    );
    expect(await screen.findByText("Invite sent to Priya.")).toBeInTheDocument();
    expect(screen.getByLabelText("Full name")).toHaveValue("");
    expect(refresh).toHaveBeenCalled();
  });

  it("warns when the member was saved but the email failed", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(201, { data: member({}), meta: { invite: "FAILED" } })));
    const user = userEvent.setup();
    render(<InviteMemberForm />);
    await fill(user);
    expect(await screen.findByText(/the invite email could not be sent\. Use Resend/)).toBeInTheDocument();
  });

  it("puts an already-registered email on the email field", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        json(409, { error: { code: "EMAIL_TAKEN", message: "x", details: { fieldErrors: { email: ["This email already has a MyArea account."] } } } }),
      ),
    );
    const user = userEvent.setup();
    render(<InviteMemberForm />);
    await fill(user);

    expect(await screen.findByText("This email already has a MyArea account.")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Email")).toHaveFocus();
    expect(screen.getByLabelText("Full name")).toHaveValue("Priya Menon");
  });
});

describe("MembersList", () => {
  const members = [
    member({ id: "admin", name: "Asha Rao", role: "ADMIN" }),
    member({ id: "other-admin", name: "Vikram Das", role: "ADMIN" }),
    member({ id: "m1", name: "Meera Iyer" }),
    member({ id: "m2", name: "Priya Menon", status: "INVITED", inviteExpiresAt: "2026-10-31T13:10:00.000Z" }),
    member({ id: "m3", name: "Farhan Qureshi", status: "DISABLED", role: "MANAGER" }),
  ];

  it("shows status as text and no actions on your own row or other admins", () => {
    render(<MembersList members={members} currentUserId="admin" filtered={false} />);
    const rows = screen.getAllByRole("listitem");

    expect(within(rows[0]!).getByText("(you)")).toBeInTheDocument();
    expect(within(rows[0]!).queryByRole("button")).not.toBeInTheDocument();
    expect(within(rows[1]!).queryByRole("button")).not.toBeInTheDocument();
    expect(within(rows[2]!).getByRole("button", { name: "Manage Meera Iyer" })).toBeInTheDocument();
    expect(within(rows[3]!).getByText("Invited")).toBeInTheDocument();
    expect(within(rows[3]!).getByText("Invite expires 31 Oct")).toBeInTheDocument();
    expect(within(rows[3]!).getByRole("button", { name: "Resend invite to Priya Menon" })).toBeInTheDocument();
    expect(within(rows[4]!).getByText("Disabled")).toBeInTheDocument();
    expect(within(rows[4]!).getByRole("button", { name: "Enable Farhan Qureshi" })).toBeInTheDocument();
  });

  it("asks for confirmation before disabling, then sends the change", async () => {
    const fetchMock = vi.fn(async () => json(200, { data: member({ status: "DISABLED" }) }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<MembersList members={[member({})]} currentUserId="admin" filtered={false} />);

    await user.click(screen.getByRole("button", { name: "Manage Meera Iyer" }));
    await user.click(screen.getByRole("button", { name: "Disable member…" }));
    expect(screen.getByText("Meera will be signed out and can't sign in until you enable them again.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Disable member" }));
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/users/m1", expect.objectContaining({ method: "PATCH", body: '{"disabled":true}' }));
    expect(await screen.findByText("Meera is disabled and signed out.")).toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
  });

  it("explains an empty filtered result", () => {
    render(<MembersList members={[]} currentUserId="admin" filtered />);
    expect(screen.getByRole("heading", { name: "No members match" })).toBeInTheDocument();
  });
});
