export function createQueryParams(
  params: Record<string, string | number>
): string {
  return Object.keys(params)
    .map(key => `${key}=${encodeURIComponent(params[key])}`)
    .join('&');
}
