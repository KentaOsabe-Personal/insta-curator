import { requestJson } from './httpClient'
import { parsePosts } from './postsDto'
import type { Post } from './postsDto'

export async function listPosts(accountId: number | null, signal?: AbortSignal): Promise<Post[]> {
  const query = accountId === null ? '' : `?account=${accountId}`
  return parsePosts(await requestJson(`/api/posts${query}`, { signal }))
}
