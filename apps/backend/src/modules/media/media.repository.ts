import { and, eq } from "drizzle-orm";
import type { Database } from "../../db/client.js";
import { reportMedia, reports } from "../../db/schema/index.js";

export interface StoredMediaRef {
  providerPublicId: string;
  mimeType: string;
}

/** Like reports, media is only found through the caller's society (via its report). */
export interface MediaRepository {
  findForSociety(societyId: string, mediaId: string): Promise<StoredMediaRef | null>;
}

export function createMediaRepository(db: Database): MediaRepository {
  return {
    async findForSociety(societyId, mediaId) {
      const [row] = await db
        .select({ providerPublicId: reportMedia.providerPublicId, mimeType: reportMedia.mimeType })
        .from(reportMedia)
        .innerJoin(reports, eq(reports.id, reportMedia.reportId))
        .where(and(eq(reportMedia.id, mediaId), eq(reports.societyId, societyId)))
        .limit(1);
      return row ?? null;
    },
  };
}
