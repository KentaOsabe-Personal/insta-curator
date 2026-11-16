import { parseAccount, parseAccountList, parseFetchResults } from './accountsDto'
import type { Account, FetchResult } from './accountsDto'
import { requestJson } from './httpClient'

export async function listAccounts(tabId: number, signal?: AbortSignal): Promise<Account[]> {
  return parseAccountList(await requestJson(`/api/accounts?tab=${tabId}`, { signal }))
}

/** タブにアカウントを登録する。他のタブに登録済みのアカウントなら、このタブへの追加になる。 */
export async function createAccount(
  username: string,
  memo: string,
  tabId: number,
): Promise<Account> {
  return parseAccount(
    await requestJson('/api/accounts', { method: 'POST', body: { username, memo, tabId } }),
  )
}

export async function updateAccount(
  id: number,
  patch: Partial<Pick<Account, 'memo' | 'isActive'>>,
): Promise<Account> {
  return parseAccount(await requestJson(`/api/accounts/${id}`, { method: 'PATCH', body: patch }))
}

export async function fetchAccountPosts(id: number): Promise<FetchResult[]> {
  return parseFetchResults(await requestJson(`/api/accounts/${id}/fetch`, { method: 'POST' }))
}

/** 有効なアカウントをまとめて取得する。tabId を省略すると全タブが対象。 */
export async function fetchAllAccounts(force: boolean, tabId?: number): Promise<FetchResult[]> {
  return parseFetchResults(
    await requestJson('/api/fetch', { method: 'POST', body: { force, tabId } }),
  )
}
