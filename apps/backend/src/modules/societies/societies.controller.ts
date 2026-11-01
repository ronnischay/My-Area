import type { RequestHandler } from "express";
import { IdParamSchema, parseInput } from "../../lib/validation.js";
import { CreateSocietyBodySchema, UpdateSocietyBodySchema } from "./societies.schemas.js";
import type { SocietiesService } from "./societies.service.js";
import { toSocietyDto, toSocietySummaryDto } from "./societies.types.js";

export function createSocietiesController({ service }: { service: SocietiesService }) {
  const list: RequestHandler = async (_req, res) => {
    res.json({ data: (await service.list()).map(toSocietySummaryDto) });
  };

  const get: RequestHandler = async (req, res) => {
    const { id } = parseInput(IdParamSchema, req.params);
    res.json({ data: toSocietyDto(await service.get(id)) });
  };

  const create: RequestHandler = async (req, res) => {
    const input = parseInput(CreateSocietyBodySchema, req.body);
    res.status(201).json({ data: toSocietyDto(await service.create(input)) });
  };

  const update: RequestHandler = async (req, res) => {
    const { id } = parseInput(IdParamSchema, req.params);
    const patch = parseInput(UpdateSocietyBodySchema, req.body);
    res.json({ data: toSocietyDto(await service.update(id, patch)) });
  };

  return { list, get, create, update };
}
