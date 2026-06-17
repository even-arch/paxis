export function orgPath(orgSlug: string, path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `/${orgSlug}${normalized}`
}
