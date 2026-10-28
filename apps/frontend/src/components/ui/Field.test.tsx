import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Field } from "./Field";
import { Input } from "./Input";

describe("Field", () => {
  it("labels the control and links the hint", () => {
    render(
      <Field id="location" label="Location" hint="Street, landmark or nearest address" required>
        {(control) => <Input {...control} />}
      </Field>,
    );

    const input = screen.getByLabelText("Location");
    expect(input).toBeRequired();
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(input).toHaveAccessibleDescription("Street, landmark or nearest address");
  });

  it("marks the control invalid and announces the error with the hint", () => {
    render(
      <Field id="title" label="Title" hint="Keep it short" error="Title must be at least 5 characters">
        {(control) => <Input {...control} />}
      </Field>,
    );

    const input = screen.getByLabelText("Title");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Keep it short Title must be at least 5 characters");
  });

  it("shows an optional marker in the label", () => {
    render(
      <Field id="note" label="Note" optional>
        {(control) => <Input {...control} />}
      </Field>,
    );
    expect(screen.getByLabelText("Note (optional)")).toBeInTheDocument();
  });
});
