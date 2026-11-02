import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { reloadTo } from "@/lib/navigate";
import { ForgotPasswordForm } from "./ForgotPasswordForm";
import { ResetPasswordForm } from "./ResetPasswordForm";

vi.mock("@/lib/navigate", () => ({ reloadTo: vi.fn() }));

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

beforeEach(() => vi.mocked(reloadTo).mockClear());
afterEach(() => vi.unstubAllGlobals());

describe("ForgotPasswordForm", () => {
  it("asks for a link and confirms without saying whether the account exists", async () => {
    const fetchMock = vi.fn(async () => json(202, { data: { requested: true } }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);

    await user.type(screen.getByLabelText("Email"), "meera@example.com");
    await user.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(fetchMock).toHaveBeenCalledWith("/api/auth/password-reset/request", expect.objectContaining({ method: "POST", body: '{"email":"meera@example.com"}' }));
    expect(await screen.findByText(/If an account exists for meera@example.com/)).toBeInTheDocument();
  });

  it("checks the email before sending", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);

    await user.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(screen.getByText("Enter the email you sign in with")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveFocus();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("ResetPasswordForm", () => {
  const account = { name: "Meera Iyer", email: "meera@example.com" };

  it("looks the link up, sets the new password and reloads signed in", async () => {
    const fetchMock = vi.fn(async (url: string) => (url.endsWith("/lookup") ? json(200, { data: account }) : json(200, { data: { id: "u1" } })));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<ResetPasswordForm token="tok.sig" />);

    expect(await screen.findByText(/For Meera Iyer \(meera@example.com\)/)).toBeInTheDocument();
    await user.type(screen.getByLabelText(/^New password/), "a brand new password");
    await user.type(screen.getByLabelText(/^Confirm new password/), "a brand new password");
    await user.click(screen.getByRole("button", { name: "Save password and sign in" }));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/password-reset/confirm",
      expect.objectContaining({ method: "POST", body: '{"token":"tok.sig","password":"a brand new password"}' }),
    );
    expect(reloadTo).toHaveBeenCalledWith("/");
  });

  it("checks the password rules before sending", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(200, { data: account })));
    const user = userEvent.setup();
    render(<ResetPasswordForm token="tok.sig" />);

    await user.type(await screen.findByLabelText(/^New password/), "meera@example.com");
    await user.click(screen.getByRole("button", { name: "Save password and sign in" }));
    expect(screen.getByText("Your password can't be your email")).toBeInTheDocument();

    await user.clear(screen.getByLabelText(/^New password/));
    await user.type(screen.getByLabelText(/^New password/), "a brand new password");
    await user.type(screen.getByLabelText(/^Confirm new password/), "something else here");
    await user.click(screen.getByRole("button", { name: "Save password and sign in" }));
    expect(screen.getByText("The passwords don't match")).toBeInTheDocument();
  });

  it("shows the invalid-link state with a way to get a new link", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(410, { error: { code: "RESET_LINK_INVALID", message: "gone" } })));
    render(<ResetPasswordForm token="old" />);

    expect(await screen.findByRole("heading", { level: 1, name: "This reset link doesn't work" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Get a new link" })).toHaveAttribute("href", "/forgot-password");
    expect(screen.queryByLabelText(/^New password/)).not.toBeInTheDocument();
  });

  it("treats a missing token as an invalid link without calling the API", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<ResetPasswordForm token="" />);
    expect(screen.getByRole("heading", { level: 1, name: "This reset link doesn't work" })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
