import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PillNav, TabBar } from "./AppNav";

vi.mock("next/navigation", () => ({ usePathname: () => "/", useSearchParams: () => new URLSearchParams() }));

describe("navigation by role", () => {
  it("residents see Mine and no management or admin links", () => {
    render(
      <>
        <PillNav role="RESIDENT" hasSociety />
        <TabBar role="RESIDENT" hasSociety />
      </>,
    );
    expect(screen.getByRole("link", { name: "Mine" })).toHaveAttribute("href", "/reports?mine=true");
    expect(screen.queryByRole("link", { name: /Management|Queue|Members|Society/ })).not.toBeInTheDocument();
  });

  it("managers get Management and the Queue tab, but not admin pages", () => {
    render(
      <>
        <PillNav role="MANAGER" hasSociety />
        <TabBar role="MANAGER" hasSociety />
      </>,
    );
    expect(screen.getByRole("link", { name: "Management" })).toHaveAttribute("href", "/management");
    expect(screen.getByRole("link", { name: "Queue" })).toHaveAttribute("href", "/management");
    expect(screen.queryByRole("link", { name: "Members" })).not.toBeInTheDocument();
  });

  it("admins also get Members and Society; nothing before the society exists", () => {
    const { rerender } = render(<PillNav role="ADMIN" hasSociety />);
    expect(screen.getAllByRole("link").map((l) => l.textContent)).toEqual(["Home", "Reports", "Management", "Members", "Society"]);
    rerender(<PillNav role="ADMIN" hasSociety={false} />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
