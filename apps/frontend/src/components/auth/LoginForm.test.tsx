import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { reloadTo } from "@/lib/navigate";
import { LoginForm } from "./LoginForm";

vi.mock("@/lib/navigate", () => ({ reloadTo: vi.fn() }));

function respond(status: number, body: unknown) {
  return vi.fn(async () => new Response(body === null ? null : JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
}

beforeEach(() => {
  vi.mocked(reloadTo).mockClear();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("LoginForm", () => {
  it("asks for both fields before calling the API", async () => {
    const fetchMock = respond(200, {});
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(screen.getByText("Enter your email")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveFocus();
    expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("signs in and goes to the requested page", async () => {
    const fetchMock = respond(200, { data: { id: "u1" } });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<LoginForm next="/reports?mine=true" />);

    await user.type(screen.getByLabelText("Email"), "meera@example.com");
    await user.type(screen.getByLabelText("Password"), "correct horse battery");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/login",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ email: "meera@example.com", password: "correct horse battery" }) }),
    );
    expect(reloadTo).toHaveBeenCalledWith("/reports?mine=true");
  });

  it("never follows an off-site next parameter", async () => {
    vi.stubGlobal("fetch", respond(200, { data: {} }));
    const user = userEvent.setup();
    render(<LoginForm next="//evil.example/phish" />);

    await user.type(screen.getByLabelText("Email"), "meera@example.com");
    await user.type(screen.getByLabelText("Password"), "x");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(reloadTo).toHaveBeenCalledWith("/");
  });

  it("shows the generic error, keeps the email and clears the password", async () => {
    vi.stubGlobal("fetch", respond(401, { error: { code: "INVALID_CREDENTIALS", message: "Email or password is incorrect." } }));
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText("Email"), "meera@example.com");
    await user.type(screen.getByLabelText("Password"), "wrong password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Email or password is incorrect.");
    expect(screen.getByLabelText("Email")).toHaveValue("meera@example.com");
    expect(screen.getByLabelText("Password")).toHaveValue("");
    expect(screen.getByLabelText("Password")).toHaveFocus();
    expect(reloadTo).not.toHaveBeenCalled();
  });

  it("shows the password on request", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);
    const toggle = screen.getByRole("button", { name: "Show password" });

    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
    await user.click(toggle);
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "text");
    expect(toggle).toHaveAttribute("aria-pressed", "true");
  });
});
