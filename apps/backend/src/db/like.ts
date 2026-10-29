/** `%q%` for ILIKE with the wildcards escaped, so a search for "50%" matches literally. */
export function containsPattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, "\\$&")}%`;
}
