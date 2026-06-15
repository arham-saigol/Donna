/**
 * Parse the Dreamer's response into updated SOUL and MEMORY contents.
 * Returns null if either block is missing.
 */
export function parseDreamerResponse(response: string): { soul: string; memory: string } | null {
  const normalized = response
    .replace(/^```[a-zA-Z]*\n?/, '')
    .replace(/\n?```$/, '')
    .trim();
  const match = normalized.match(
    /<!--\s*SOUL\.md\s*-->\s*([\s\S]*?)\s*<!--\s*MEMORY\.md\s*-->\s*([\s\S]*?)$/
  );
  if (!match) return null;
  return { soul: match[1].trimEnd(), memory: match[2].trimEnd() };
}
