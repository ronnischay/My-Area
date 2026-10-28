import { AppError } from "../../lib/errors.js";
import type { SocietiesRepository } from "./societies.repository.js";
import type { Society, SocietyInput } from "./societies.types.js";

export interface SocietiesService {
  /** An admin can create exactly one society (docs/features/society-admin.md). */
  create(adminId: string, input: SocietyInput): Promise<Society>;
  update(societyId: string, patch: Partial<SocietyInput>): Promise<Society>;
}

export function createSocietiesService({ repository }: { repository: SocietiesRepository }): SocietiesService {
  return {
    async create(adminId, input) {
      const result = await repository.createForAdmin(adminId, input);
      if (result === "ALREADY_EXISTS") {
        throw new AppError(409, "SOCIETY_ALREADY_EXISTS", "You already have a society. Edit it instead.");
      }
      return result;
    },

    async update(societyId, patch) {
      const society = await repository.update(societyId, patch);
      if (!society) throw new AppError(404, "NOT_FOUND", "Society not found");
      return society;
    },
  };
}
