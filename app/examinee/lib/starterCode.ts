export function getStarterCodeMap(starterCode: unknown): Record<string, string> {
  try {
    const parsed = starterCode;
    if (parsed != null && typeof parsed === 'object' && !Array.isArray(parsed))
      return parsed as Record<string, string>;
  } catch {
    return {};
  }
  return {};
}
