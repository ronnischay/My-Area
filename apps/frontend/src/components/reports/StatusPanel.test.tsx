import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StatusPanel } from "./StatusPanel";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

beforeEach(() => refresh.mockClear());
afterEach(() => vi.unstubAllGlobals());

describe("StatusPanel", () => {
  it("offers only the allowed next statuses", () => {
    const { rerender } = render(<StatusPanel reportId="r1" status="OPEN" />);
    expect(screen.getAllByRole("radio").map((r) => r.getAttribute("value"))).toEqual(["IN_PROGRESS", "REJECTED"]);

    rerender(<StatusPanel reportId="r1" status="IN_PROGRESS" />);
    expect(screen.getAllByRole("radio").map((r) => r.getAttribute("value"))).toEqual(["RESOLVED", "REJECTED", "OPEN"]);

    rerender(<StatusPanel reportId="r1" status="RESOLVED" />);
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(screen.getByText(/That's final/)).toBeInTheDocument();
  });

  it("starts work straight away with the note, then refreshes the page", async () => {
    const fetchMock = vi.fn(async () => json(200, { data: {} }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<StatusPanel reportId="r1" status="OPEN" />);

    await user.click(screen.getByRole("radio", { name: /Start work/ }));
    await user.type(screen.getByLabelText(/Note for residents/), "Electrician booked for Friday");
    await user.click(screen.getByRole("button", { name: "Save status" }));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/reports/r1/status",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ status: "IN_PROGRESS", note: "Electrician booked for Friday" }) }),
    );
    expect(await screen.findByText("Status changed to In progress.")).toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
  });

  it("asks before a final status and uploads the resolution photo after resolving", async () => {
    const fetchMock = vi.fn(async () => json(200, { data: {} }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<StatusPanel reportId="r1" status="IN_PROGRESS" />);

    await user.click(screen.getByRole("radio", { name: /Mark as resolved/ }));
    await user.upload(document.getElementById("resolution-photo") as HTMLInputElement, new File([new Uint8Array([0xff, 0xd8, 0xff])], "fixed.jpg", { type: "image/jpeg" }));
    await user.click(screen.getByRole("button", { name: "Save status" }));

    expect(screen.getByRole("heading", { name: "Mark as resolved?" })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();

    await user.click(screen.getAllByRole("button", { name: "Mark as resolved" }).at(-1)!);
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/reports/r1/status", expect.objectContaining({ body: '{"status":"RESOLVED"}' }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/reports/r1/media", expect.objectContaining({ method: "POST" }));
    expect(await screen.findByText("Status changed to Resolved.")).toBeInTheDocument();
  });

  it("explains a refused change and shows the current state", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(409, { error: { code: "INVALID_STATUS_TRANSITION", message: "A report that is in progress can't be changed to in progress." } })));
    const user = userEvent.setup();
    render(<StatusPanel reportId="r1" status="OPEN" />);
    await user.click(screen.getByRole("radio", { name: /Start work/ }));
    await user.click(screen.getByRole("button", { name: "Save status" }));
    expect(await screen.findByText(/can't be changed to in progress/)).toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
  });
});
