import { AppError } from "../../lib/errors.js";
import type { SocietiesRepository } from "./societies.repository.js";
import type { Society, SocietyInput, SocietySummary } from "./societies.types.js";

export interface SocietiesService {
  list(): Promise<SocietySummary[]>;
  /** 404 NOT_FOUND for an unknown id. */
  get(societyId: string): Promise<Society>;
  create(input: SocietyInput): Promise<Society>;
  update(societyId: string, patch: Partial<SocietyInput>): Promise<Society>;
}

const notFound = () => new AppError(404, "NOT_FOUND", "Society not found");

export function createSocietiesService({ repository }: { repository: SocietiesRepository }): SocietiesService {
  return {
    list: () => repository.list(),

    async get(societyId) {
      const society = await repository.findById(societyId);
      if (!society) throw notFound();
      return society;
    },

    create: (input) => repository.create(input),

    async update(societyId, patch) {
      const society = await repository.update(societyId, patch);
      if (!society) throw notFound();
      return society;
    },
  };
}
