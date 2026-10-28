import { z } from "zod";
import { AppError } from "./errors.js";

/**
 * Parses request input with a Zod schema. On failure throws 400 VALIDATION_ERROR with
 * `details.fieldErrors` keyed by field name (docs/API_CONTRACT.md §1).
 */
export function parseInput<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input);
  if (result.success) return result.data;

  const { formErrors, fieldErrors } = z.flattenError(result.error);
  throw new AppError(400, "VALIDATION_ERROR", "Some fields need attention", {
    fieldErrors,
    ...(formErrors.length > 0 ? { formErrors } : {}),
  });
}

/** A UUID path parameter. */
export const IdParamSchema = z.object({ id: z.uuid({ message: "Must be a valid id" }) });
