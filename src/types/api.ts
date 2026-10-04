export interface Page<T> {
  data: T[]
  page: { hasMore: boolean; nextCursor: string | null }
  requestId?: string
}
