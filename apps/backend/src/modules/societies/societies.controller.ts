import type { RequestHandler } from "express";
import { parseInput } from "../../lib/validation.js";
import { getAuth } from "../../middleware/require-auth.js";
import { getSocietyAuth } from "../../middleware/require-society.js";
import { CreateSocietyBodySchema, UpdateSocietyBodySchema } from "./societies.schemas.js";
import type { SocietiesService } from "./societies.service.js";
import { toSocietyDto } from "./societies.types.js";

export function createSocietiesController({ service }: { service: SocietiesService }) {
  const create: RequestHandler = async (req, res) => {
    const input = parseInput(CreateSocietyBodySchema, req.body);
    const society = await service.create(getAuth(req).userId, input);
    res.status(201).json({ data: toSocietyDto(society) });
  };

  const updateCurrent: RequestHandler = async (req, res) => {
    const patch = parseInput(UpdateSocietyBodySchema, req.body);
    const society = await service.update(getSocietyAuth(req).societyId, patch);
    res.json({ data: toSocietyDto(society) });
  };

  return { create, updateCurrent };
}
