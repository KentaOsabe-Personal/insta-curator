import { parseAccount, parseAccountList, parseFetchResults } from './accountsDto'
import type { Account, FetchResult } from './accountsDto'
import { requestJson } from './httpClient'

export async function listAccounts(signal?: AbortSignal): Promise<Account[]> {
  return parseAccountList(await requestJson('/api/accounts', { signal }))
}

export async function createAccount(username: string, memo: string): Promise<Account> {
  return parseAccount(
    await requestJson('/api/accounts', { method: 'POST', body: { username, memo } }),
  )
}

export async function updateAccount(
  id: number,
  patch: Partial<Pick<Account, 'memo' | 'isActive'>>,
): Promise<Account> {
  return parseAccount(await requestJson(`/api/accounts/${id}`, { method: 'PATCH', body: patch }))
}

export async function deleteAccount(id: number): Promise<void> {
  await requestJson(`/api/accounts/${id}`, { method: 'DELETE' })
}

export async function fetchAccountPosts(id: number): Promise<FetchResult[]> {
  return parseFetchResults(await requestJson(`/api/accounts/${id}/fetch`, { method: 'POST' }))
}

export async function fetchAllAccounts(force: boolean): Promise<FetchResult[]> {
  return parseFetchResults(await requestJson('/api/fetch', { method: 'POST', body: { force } }))
}
