import { requestJson } from './httpClient'
import { parseTab, parseTabList } from './tabsDto'
import type { Tab } from './tabsDto'

export async function listTabs(signal?: AbortSignal): Promise<Tab[]> {
  return parseTabList(await requestJson('/api/tabs', { signal }))
}

export async function createTab(name: string): Promise<Tab> {
  return parseTab(await requestJson('/api/tabs', { method: 'POST', body: { name } }))
}

export async function renameTab(id: number, name: string): Promise<Tab> {
  return parseTab(await requestJson(`/api/tabs/${id}`, { method: 'PATCH', body: { name } }))
}

export async function deleteTab(id: number): Promise<void> {
  await requestJson(`/api/tabs/${id}`, { method: 'DELETE' })
}

/** タブからアカウントを外す。どのタブにも属さなくなったアカウントは投稿ごと削除される。 */
export async function removeAccountFromTab(tabId: number, accountId: number): Promise<void> {
  await requestJson(`/api/tabs/${tabId}/accounts/${accountId}`, { method: 'DELETE' })
}
