/**
 * The URL stored in `report_media.url` for locally stored photos: served by GET /api/media/:id to
 * signed-in members of the report's society. Relative, so it works through the frontend's same-origin
 * /api rewrite (D015).
 */
export function mediaUrl(mediaId: string): string {
  return `/api/media/${mediaId}`;
}
