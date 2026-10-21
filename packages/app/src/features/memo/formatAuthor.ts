/** Resolves a memo author such as `agent:3` to its preset name when known. */
export function formatAuthor(author: string, presetById?: Map<number, string>): string {
  if (author.startsWith('agent:')) {
    const id = Number(author.slice(6));
    if (!Number.isNaN(id) && presetById?.has(id)) {
      return presetById.get(id)!;
    }
  }
  return author;
}
