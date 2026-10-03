export function normalizeTags(names: readonly string[]): { tags: string[]; error: string | null } {
  const tags = [...new Set(names.map((name) => name.trim()).filter(Boolean))];
  const tooLong = tags.find((name) => Array.from(name).length > 50);
  return { tags, error: tooLong ? `标签「${tooLong}」超过 50 个字符，请修改后提交。` : null };
}
/** Deliberately small grammar, not a Markdown parser or a tag ontology. */
export function extractMemoTags(content: string): { tags: string[]; error: string | null } {
  const names = Array.from(content.matchAll(/(?:^|\s)#([\p{L}\p{M}\p{N}_-]+)/gu), (match) => match[1]);
  return normalizeTags(names);
}
