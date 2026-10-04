export function withQuery(path: string, values: object): string {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(values)) {
    if (typeof value === 'string' || typeof value === 'number') query.set(key, String(value))
  }
  const encoded = query.toString()
  return encoded ? `${path}?${encoded}` : path
}
