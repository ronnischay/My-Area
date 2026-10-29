/**
 * Full page load to `path`. Used only when the session changes (sign in, sign out, joining, creating
 * the society): a full load guarantees no cached signed-in or signed-out view survives, which a
 * client-side router.push doesn't.
 */
export function reloadTo(path: string): void {
  window.location.assign(path);
}
