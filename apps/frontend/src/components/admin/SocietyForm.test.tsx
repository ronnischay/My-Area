import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SocietyForm } from "./SocietyForm";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const society = { id: "s1", name: "Green Park Residency", addressText: "Plot 12, Sector 45, Gurugram", createdAt: "2026-10-01T10:00:00.000Z" };

beforeEach(() => {
  push.mockClear();
  refresh.mockClear();
});
afterEach(() => vi.unstubAllGlobals());

describe("SocietyForm", () => {
  it("creates a society and opens it", async () => {
    const fetchMock = vi.fn(async () => json(201, { data: { ...society, id: "new-id" } }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<SocietyForm />);

    await user.type(screen.getByLabelText("Society name"), "Lake View Towers");
    await user.type(screen.getByLabelText(/Address/), "Sector 9, Noida");
    await user.click(screen.getByRole("button", { name: "Create society" }));

    expect(fetchMock).toHaveBeenCalledWith("/api/societies", expect.objectContaining({ method: "POST" }));
    expect(push).toHaveBeenCalledWith("/admin/societies/new-id");
  });

  it("saves changes to the society it was given", async () => {
    const fetchMock = vi.fn(async () => json(200, { data: { ...society, name: "Green Park Phase 2" } }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<SocietyForm society={society} />);

    await user.clear(screen.getByLabelText("Society name"));
    await user.type(screen.getByLabelText("Society name"), "Green Park Phase 2");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(fetchMock).toHaveBeenCalledWith("/api/societies/s1", expect.objectContaining({ method: "PATCH" }));
    expect(await screen.findByText("Society details saved.")).toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
  });
});
