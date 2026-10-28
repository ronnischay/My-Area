import { z } from "zod";

const Name = z
  .string()
  .trim()
  .min(3, "Society name must be at least 3 characters")
  .max(120, "Society name must be at most 120 characters");

const AddressText = z
  .string()
  .trim()
  .min(5, "Address must be at least 5 characters")
  .max(255, "Address must be at most 255 characters");

export const CreateSocietyBodySchema = z.object({ name: Name, addressText: AddressText });

export const UpdateSocietyBodySchema = z
  .object({ name: Name.optional(), addressText: AddressText.optional() })
  .refine((body) => body.name !== undefined || body.addressText !== undefined, "Change the name or the address");
