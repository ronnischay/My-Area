import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AppearanceSetting } from "@/components/auth/AppearanceSetting";
import { readThemePreference, THEME_STORAGE_KEY, themeInitScript } from "@/lib/theme";
import { ThemeToggle } from "./ThemeToggle";

describe("ThemeToggle", () => {
  it("starts in light mode and switches to dark, saving the choice", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);
    const toggle = screen.getByRole("button", { name: "Dark mode" });

    expect(toggle).toHaveAttribute("aria-pressed", "false");
    await user.click(toggle);

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(toggle).toHaveAttribute("aria-pressed", "true");

    await user.click(toggle);
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("still switches when storage is unavailable", async () => {
    const user = userEvent.setup();
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    render(<ThemeToggle />);

    await user.click(screen.getByRole("button", { name: "Dark mode" }));
    expect(document.documentElement.dataset.theme).toBe("dark");
    setItem.mockRestore();
  });
});

describe("theme preference", () => {
  it("is light when nothing is stored or storage throws", () => {
    expect(readThemePreference()).toBe("light");
    window.localStorage.setItem(THEME_STORAGE_KEY, "purple");
    expect(readThemePreference()).toBe("light");
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    expect(readThemePreference()).toBe("light");
    getItem.mockRestore();
  });

  it("the inline script applies the stored choice before React runs", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "system");
    new Function(themeInitScript)();
    expect(document.documentElement.dataset.theme).toBe("system");

    window.localStorage.setItem(THEME_STORAGE_KEY, "<script>");
    new Function(themeInitScript)();
    expect(document.documentElement.dataset.theme).toBe("light");
  });
});

describe("AppearanceSetting", () => {
  it("offers Light / Dark / Match device as a radio group with arrow-key support", async () => {
    const user = userEvent.setup();
    render(<AppearanceSetting />);
    const group = screen.getByRole("radiogroup", { name: "Theme" });
    const light = screen.getByRole("radio", { name: "Light" });

    expect(group).toBeInTheDocument();
    expect(light).toHaveAttribute("aria-checked", "true");

    await user.click(screen.getByRole("radio", { name: "Match device" }));
    expect(document.documentElement.dataset.theme).toBe("system");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("system");

    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("radio", { name: "Dark" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Dark" })).toHaveFocus();
    expect(document.documentElement.dataset.theme).toBe("dark");
  });
});
