import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ThumbsUpButton } from "./ThumbsUpButton";

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
afterEach(() => vi.unstubAllGlobals());

describe("ThumbsUpButton", () => {
  it("toggles a thumbs-up and shows the count the API returns", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json(201, { data: { voteCount: 5, hasVoted: true } }))
      .mockResolvedValueOnce(json(200, { data: { voteCount: 4, hasVoted: false } }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<ThumbsUpButton reportId="r1" initial={{ voteCount: 3, hasVoted: false }} isMine={false} closed={false} />);

    const button = screen.getByRole("button", { name: "Thumbs up, 3 thumbs-ups" });
    expect(button).toHaveAttribute("aria-pressed", "false");

    await user.click(button);
    expect(fetchMock).toHaveBeenLastCalledWith("/api/reports/r1/votes", expect.objectContaining({ method: "POST" }));
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(button).toHaveAccessibleName("Thumbs up, 5 thumbs-ups");

    await user.click(button);
    expect(fetchMock).toHaveBeenLastCalledWith("/api/reports/r1/votes", expect.objectContaining({ method: "DELETE" }));
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(button).toHaveAccessibleName("Thumbs up, 4 thumbs-ups");
  });

  it("shows only the count on your own or a closed report", () => {
    const { rerender } = render(<ThumbsUpButton reportId="r1" initial={{ voteCount: 1, hasVoted: false }} isMine closed={false} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText("1 thumbs-up")).toBeInTheDocument();
    rerender(<ThumbsUpButton reportId="r1" initial={{ voteCount: 2, hasVoted: true }} isMine={false} closed />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("says when it didn't work and keeps the old state", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(409, { error: { code: "VOTING_CLOSED", message: "This report is closed, so thumbs-up can't change any more." } })));
    const user = userEvent.setup();
    render(<ThumbsUpButton reportId="r1" initial={{ voteCount: 3, hasVoted: false }} isMine={false} closed={false} />);
    await user.click(screen.getByRole("button"));
    expect(await screen.findByText(/This report is closed/)).toBeInTheDocument();
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "false");
  });
});
