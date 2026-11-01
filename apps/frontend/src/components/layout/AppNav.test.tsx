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
    expect(screen.queryByRole("link", { name: /Management|Queue|Members|Societies/ })).not.toBeInTheDocument();
  });

  it("managers get Management, the Queue tab and Members, but not Societies", () => {
    render(
      <>
        <PillNav role="MANAGER" hasSociety />
        <TabBar role="MANAGER" hasSociety />
      </>,
    );
    expect(screen.getByRole("link", { name: "Management" })).toHaveAttribute("href", "/management");
    expect(screen.getByRole("link", { name: "Queue" })).toHaveAttribute("href", "/management");
    expect(screen.getByRole("link", { name: "Members" })).toHaveAttribute("href", "/members");
    expect(screen.queryByRole("link", { name: "Societies" })).not.toBeInTheDocument();
  });

  it("admins get only Societies (and Profile on phones): no reports, report button or queue", () => {
    render(
      <>
        <PillNav role="ADMIN" hasSociety={false} />
        <TabBar role="ADMIN" hasSociety={false} />
      </>,
    );
    expect(screen.getAllByRole("link").map((l) => [l.textContent, l.getAttribute("href")])).toEqual([
      ["Societies", "/admin/societies"],
      ["Societies", "/admin/societies"],
      ["Profile", "/profile"],
    ]);
  });
});
