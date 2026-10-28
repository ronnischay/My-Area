import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "./page";

describe("Home page", () => {
  it("renders a single h1 and the primary report CTA", () => {
    render(<Home />);

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Report an issue" })).toHaveAttribute("href", "/reports/new");
    expect(screen.getByRole("link", { name: "Browse reports" })).toHaveAttribute("href", "/reports");
  });

  it("explains the three steps in an ordered list", () => {
    render(<Home />);

    expect(screen.getByRole("heading", { name: "How it works" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });
});
