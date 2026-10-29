import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { reportQueryFrom, toSearch } from "@/lib/server/reports";
import type { ReportSummary } from "@/types/api";
import { ReportCard } from "./ReportCard";
import { relativeTime } from "./RelativeTime";

const summary: ReportSummary = {
  id: "r1",
  title: "Streetlight out near Block C",
  category: "STREETLIGHTS",
  locationText: "Block C main gate",
  status: "IN_PROGRESS",
  thumbnailUrl: null,
  isMine: true,
  createdAt: "2026-10-28T10:00:00.000Z",
};

describe("ReportCard", () => {
  it("links the title and shows status as text, category, location and a placeholder photo", () => {
    render(<ReportCard report={summary} />);
    expect(screen.getByRole("link", { name: "Streetlight out near Block C" })).toHaveAttribute("href", "/reports/r1");
    expect(screen.getByText("In progress")).toBeInTheDocument();
    expect(screen.getByText("Streetlights")).toBeInTheDocument();
    expect(screen.getByText("Yours")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "No photo" })).toBeInTheDocument();
    expect(screen.getByText(/Block C main gate/)).toBeInTheDocument();
  });
});

describe("relativeTime", () => {
  const now = Date.parse("2026-10-29T10:00:00.000Z");
  it("reads naturally", () => {
    expect(relativeTime("2026-10-29T09:59:40.000Z", now)).toBe("just now");
    expect(relativeTime("2026-10-29T09:15:00.000Z", now)).toBe("45 minutes ago");
    expect(relativeTime("2026-10-29T07:00:00.000Z", now)).toBe("3 hours ago");
    expect(relativeTime("2026-10-28T10:00:00.000Z", now)).toBe("yesterday");
    expect(relativeTime("2026-08-01T10:00:00.000Z", now)).toBe("1 Aug 2026");
  });
});

describe("report URL filters", () => {
  it("keeps valid values and drops unknown ones instead of failing", () => {
    expect(reportQueryFrom({ status: "OPEN", category: "ROADS", q: " lift ", mine: "true", page: "2" })).toEqual({
      page: 2,
      pageSize: 12,
      status: "OPEN",
      category: "ROADS",
      q: "lift",
      mine: true,
    });
    expect(reportQueryFrom({ status: "CLOSED", category: ["ROADS", "WASTE"], page: "-3", mine: "yes" })).toEqual({ page: 1, pageSize: 12 });
  });

  it("builds shareable links without defaults", () => {
    expect(toSearch({ status: "OPEN", mine: true, page: 1 })).toBe("?status=OPEN&mine=true");
    expect(toSearch({})).toBe("");
  });
});

describe("ReportFilters", () => {
  it("shows the URL's filters again when it is rebuilt for a new URL (Clear filters, Back)", async () => {
    const { ReportFilters } = await import("./ReportFilters");
    const { rerender } = render(<ReportFilters key="?mine=true&status=OPEN" mine status="OPEN" />);
    expect(screen.getByRole("checkbox", { name: "Only mine" })).toBeChecked();
    expect(screen.getByLabelText("Status")).toHaveValue("OPEN");

    rerender(<ReportFilters key="" mine={false} />);
    expect(screen.getByRole("checkbox", { name: "Only mine" })).not.toBeChecked();
    expect(screen.getByLabelText("Status")).toHaveValue("");
  });
});
