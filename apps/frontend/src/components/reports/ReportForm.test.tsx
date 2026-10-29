import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReportForm } from "./ReportForm";

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const photo = () => new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], "pothole.jpg", { type: "image/jpeg" });

afterEach(() => vi.unstubAllGlobals());

async function fillValid(user: ReturnType<typeof userEvent.setup>) {
  await user.upload(document.getElementById("report-photo") as HTMLInputElement, photo());
  await user.type(screen.getByLabelText(/^Title/), "Pothole outside Gate 2");
  await user.selectOptions(screen.getByLabelText("Category"), "ROADS");
  await user.type(screen.getByLabelText(/^Location/), "Gate 2, service road");
  await user.type(screen.getByLabelText(/^Description/), "Deep pothole, bikes swerve around it.");
}

describe("ReportForm", () => {
  it("shows an error summary that takes focus and links to each field, without calling the API", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<ReportForm />);

    await user.click(screen.getByRole("button", { name: "Submit report" }));

    const summary = await screen.findByRole("alert");
    expect(summary).toHaveTextContent("Please fix these 5 things");
    await vi.waitFor(() => expect(summary).toHaveFocus());
    expect(screen.getByRole("link", { name: "Photo: Add a photo of the problem" })).toHaveAttribute("href", "#report-photo");
    expect(screen.getByRole("link", { name: "Category: Choose a category" })).toBeInTheDocument();
    expect(screen.getByLabelText(/^Title/)).toHaveAttribute("aria-invalid", "true");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("validates a field when you leave it", async () => {
    const user = userEvent.setup();
    render(<ReportForm />);
    await user.type(screen.getByLabelText(/^Title/), "Hole");
    await user.tab();
    expect(screen.getByText("Use at least 5 characters")).toBeInTheDocument();
  });

  it("refuses a photo that isn't JPEG, PNG or WebP", async () => {
    const user = userEvent.setup({ applyAccept: false });
    render(<ReportForm />);
    await user.upload(document.getElementById("report-photo") as HTMLInputElement, new File(["GIF89a"], "a.gif", { type: "image/gif" }));
    expect(screen.getByText("Use a JPEG, PNG or WebP photo.")).toBeInTheDocument();
  });

  it("sends multipart with the photo and shows the success panel", async () => {
    const fetchMock = vi.fn(async () => json(201, { data: { id: "7d0f3c2e-8a51-4c43-9d55-2f4c6a1b9e10", title: "Pothole outside Gate 2" } }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<ReportForm />);

    await fillValid(user);
    await user.click(screen.getByRole("button", { name: "Submit report" }));

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/reports");
    const body = init.body as FormData;
    expect(body.get("title")).toBe("Pothole outside Gate 2");
    expect(body.get("category")).toBe("ROADS");
    expect((body.get("photo") as File).name).toBe("pothole.jpg");

    const heading = await screen.findByRole("heading", { name: "Report submitted" });
    await vi.waitFor(() => expect(heading).toHaveFocus());
    expect(screen.getByRole("link", { name: "View report" })).toHaveAttribute("href", "/reports/7d0f3c2e-8a51-4c43-9d55-2f4c6a1b9e10");
    expect(screen.getByText("Reference: 7D0F3C2E")).toBeInTheDocument();
  });

  it("keeps everything, including the photo, when the server fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(502, { error: { code: "MEDIA_UPLOAD_FAILED", message: "We couldn't save your photo, so nothing was submitted. Please try again." } })));
    const user = userEvent.setup();
    render(<ReportForm />);

    await fillValid(user);
    await user.click(screen.getByRole("button", { name: "Submit report" }));

    expect(await screen.findByText(/nothing was submitted/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Title/)).toHaveValue("Pothole outside Gate 2");
    expect(screen.getByText("pothole.jpg")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit report" })).toBeEnabled();
  });

  it("shows server field errors on the matching fields", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        json(415, { error: { code: "UNSUPPORTED_MEDIA_TYPE", message: "x", details: { fieldErrors: { photo: ["Use a JPEG, PNG or WebP photo."] } } } }),
      ),
    );
    const user = userEvent.setup();
    render(<ReportForm />);
    await fillValid(user);
    await user.click(screen.getByRole("button", { name: "Submit report" }));

    expect(await screen.findByRole("link", { name: "Photo: Use a JPEG, PNG or WebP photo." })).toBeInTheDocument();
  });
});
