export function normalizeRouterBasename(baseUrl: string): string | undefined {
  const trimmed = baseUrl.trim().replace(/^\/+|\/+$/g, "");
  return trimmed.length === 0 ? undefined : `/${trimmed}`;
}
