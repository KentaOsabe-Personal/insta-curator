import { requestJson } from './httpClient'
import { parsePosts } from './postsDto'
import type { Post } from './postsDto'

export async function listPosts(
  tabId: number,
  accountId: number | null,
  signal?: AbortSignal,
): Promise<Post[]> {
  const params = new URLSearchParams({ tab: String(tabId) })
  if (accountId !== null) {
    params.set('account', String(accountId))
  }
  return parsePosts(await requestJson(`/api/posts?${params.toString()}`, { signal }))
}
