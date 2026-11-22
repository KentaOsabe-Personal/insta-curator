import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import {
  createAccount,
  fetchAccountPosts,
  fetchAllAccounts,
  listAccounts,
  lookupAccount,
  updateAccount,
} from './accountsApi'
import type { Account } from './accountsDto'
import AccountsPanel from './AccountsPanel'
import { describeFetchState, fetchReducer, initialFetchState } from './fetchState'
import type { FetchTrigger } from './fetchState'
import { isAbortError } from './httpClient'
import PostFeed from './PostFeed'
import { listPosts } from './postsApi'
import type { Post } from './postsDto'
import { getStatus } from './statusApi'
import type { AppStatus } from './statusApi'
import TabBar from './TabBar'
import { createTab, deleteTab, listTabs, removeAccountFromTab, renameTab } from './tabsApi'
import type { Tab } from './tabsDto'

const SELECTED_TAB_STORAGE_KEY = 'insta-curator:selectedTabId'

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '予期しないエラーが発生しました。'
}

function loadStoredTabId(): number | null {
  try {
    const stored = Number(window.localStorage.getItem(SELECTED_TAB_STORAGE_KEY))
    return Number.isInteger(stored) && stored > 0 ? stored : null
  } catch {
    return null
  }
}

function storeTabId(tabId: number): void {
  try {
    window.localStorage.setItem(SELECTED_TAB_STORAGE_KEY, String(tabId))
  } catch {
    // 保存できなくても、次回は先頭のタブを開くだけなので無視する。
  }
}

export default function App() {
  const [status, setStatus] = useState<AppStatus | null>(null)
  const [tabs, setTabs] = useState<Tab[]>([])
  const [selectedTabId, setSelectedTabId] = useState<number | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [accountsError, setAccountsError] = useState('')
  const [posts, setPosts] = useState<Post[]>([])
  const [postsLoading, setPostsLoading] = useState(true)
  const [postsError, setPostsError] = useState('')
  const [postsVersion, setPostsVersion] = useState(0)
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null)
  const [fetchState, dispatchFetch] = useReducer(fetchReducer, initialFetchState)
  const fetchRunningRef = useRef(false)
  const startedRef = useRef(false)
  // 非同期処理の完了時点で表示中のタブを参照するため、state とは別に保持する。
  const selectedTabRef = useRef<number | null>(null)

  const reloadTabs = useCallback(async () => {
    try {
      setTabs(await listTabs())
    } catch (error) {
      setAccountsError(errorMessage(error))
    }
  }, [])

  const reloadAccounts = useCallback(async () => {
    const tabId = selectedTabRef.current
    if (tabId === null) {
      return
    }
    try {
      const loaded = await listAccounts(tabId)
      // 読み込み中に別のタブへ切り替えた場合は、古いタブの結果を捨てる。
      if (selectedTabRef.current === tabId) {
        setAccounts(loaded)
        setAccountsError('')
      }
    } catch (error) {
      if (selectedTabRef.current === tabId) {
        setAccountsError(errorMessage(error))
      }
    }
  }, [])

  const selectTab = useCallback((tabId: number) => {
    if (selectedTabRef.current === tabId) {
      return
    }
    selectedTabRef.current = tabId
    storeTabId(tabId)
    setSelectedTabId(tabId)
    setSelectedAccountId(null)
    setAccounts([])
    setPosts([])
  }, [])

  const runFetch = useCallback(
    async (trigger: FetchTrigger, target: { accountId?: number; tabId?: number } = {}) => {
      if (fetchRunningRef.current) {
        return
      }
      fetchRunningRef.current = true
      dispatchFetch({ type: 'start', trigger, accountId: target.accountId })
      try {
        const results =
          target.accountId === undefined
            ? await fetchAllAccounts(trigger === 'manual', target.tabId)
            : await fetchAccountPosts(target.accountId)
        dispatchFetch({ type: 'succeed', results })
      } catch (error) {
        dispatchFetch({ type: 'fail', message: errorMessage(error) })
      } finally {
        fetchRunningRef.current = false
        await reloadAccounts()
        setPostsVersion((version) => version + 1)
      }
    },
    [reloadAccounts],
  )

  // 起動時: 状態とタブを読み込み、全タブの自動取得（最近取得済みはスキップ）を1回だけ行う。
  useEffect(() => {
    if (startedRef.current) {
      return
    }
    startedRef.current = true
    void (async () => {
      try {
        setStatus(await getStatus())
      } catch (error) {
        setAccountsError(errorMessage(error))
      }
      try {
        const loadedTabs = await listTabs()
        setTabs(loadedTabs)
        const storedTabId = loadStoredTabId()
        const initialTab = loadedTabs.find((tab) => tab.id === storedTabId) ?? loadedTabs[0] ?? null
        if (initialTab) {
          selectTab(initialTab.id)
        }
      } catch (error) {
        setAccountsError(errorMessage(error))
      }
      await runFetch('startup')
      await reloadTabs()
    })()
  }, [reloadTabs, runFetch, selectTab])

  useEffect(() => {
    void reloadAccounts()
  }, [selectedTabId, reloadAccounts])

  useEffect(() => {
    if (selectedTabId === null) {
      return
    }
    const controller = new AbortController()
    setPostsLoading(true)
    listPosts(selectedTabId, selectedAccountId, controller.signal)
      .then((loaded) => {
        setPosts(loaded)
        setPostsError('')
      })
      .catch((error: unknown) => {
        if (!isAbortError(error)) {
          setPostsError(errorMessage(error))
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setPostsLoading(false)
        }
      })
    return () => controller.abort()
  }, [selectedTabId, selectedAccountId, postsVersion])

  const handleLookup = async (username: string) => {
    if (selectedTabId === null) {
      throw new Error('タブを選択してください。')
    }
    return lookupAccount(username, selectedTabId)
  }

  const handleCreate = async (username: string, memo: string) => {
    if (selectedTabId === null) {
      return
    }
    const account = await createAccount(username, memo, selectedTabId)
    await Promise.all([reloadAccounts(), reloadTabs()])
    if (account.lastFetchedAt === null) {
      // 取得の進み具合はステータス欄に出るため、確認ダイアログは取得の完了を待たずに閉じる。
      void runFetch('account', { accountId: account.id })
    } else {
      // 他のタブで取得済みのアカウントは、手動取得せず保存済みの投稿を表示する（API 上限の節約）。
      setPostsVersion((version) => version + 1)
    }
  }

  const handleToggleActive = async (account: Account) => {
    try {
      await updateAccount(account.id, { isActive: !account.isActive })
      await reloadAccounts()
      setPostsVersion((version) => version + 1)
    } catch (error) {
      setAccountsError(errorMessage(error))
    }
  }

  const handleUpdateMemo = async (account: Account, memo: string) => {
    await updateAccount(account.id, { memo })
    await reloadAccounts()
  }

  const handleRemove = async (account: Account) => {
    if (selectedTabId === null) {
      return
    }
    await removeAccountFromTab(selectedTabId, account.id)
    if (selectedAccountId === account.id) {
      setSelectedAccountId(null)
    }
    await Promise.all([reloadAccounts(), reloadTabs()])
    setPostsVersion((version) => version + 1)
  }

  const handleCreateTab = async (name: string) => {
    const created = await createTab(name)
    await reloadTabs()
    selectTab(created.id)
  }

  const handleRenameTab = async (tab: Tab, name: string) => {
    await renameTab(tab.id, name)
    await reloadTabs()
  }

  const handleDeleteTab = async (tab: Tab) => {
    await deleteTab(tab.id)
    const remaining = await listTabs()
    setTabs(remaining)
    const next = remaining[0]
    if (next) {
      selectTab(next.id)
    }
  }

  const selectedTab = tabs.find((tab) => tab.id === selectedTabId) ?? null

  const fetching = fetchState.phase === 'running'
  const fetchMessage = describeFetchState(fetchState)
  const fetchErrors = fetchState.phase === 'done' ? fetchState.summary.errors : []

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-panel">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <h1 className="text-xl font-bold">📌 insta-curator</h1>
            <p className="text-sm text-muted">選んだアカウントの投稿だけをまとめて見る</p>
          </div>
          <button
            type="button"
            onClick={() => void runFetch('manual', { tabId: selectedTabId ?? undefined })}
            disabled={fetching || selectedTabId === null}
            title="表示中のタブのアカウントを取得します"
            className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60"
          >
            {fetching ? '取得中…' : selectedTab ? `「${selectedTab.name}」を更新` : 'すべて更新'}
          </button>
        </div>
      </header>

      <TabBar
        tabs={tabs}
        selectedTabId={selectedTabId}
        onSelect={selectTab}
        onCreate={handleCreateTab}
        onRename={handleRenameTab}
        onDelete={handleDeleteTab}
      />

      {status?.mode === 'fake' && (
        <div className="border-b border-line bg-accent-soft">
          <p className="mx-auto max-w-6xl px-4 py-2 text-sm">
            <strong>デモモード:</strong> IG_USER_ID / IG_ACCESS_TOKEN
            が未設定のため、ダミーの投稿を表示しています。
          </p>
        </div>
      )}

      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-6 md:grid-cols-[320px_1fr]">
        <div className="space-y-3 md:sticky md:top-4 md:self-start">
          <div role="status" aria-live="polite" className="min-h-5 text-sm text-muted">
            {fetchMessage}
          </div>
          {fetchErrors.length > 0 && (
            <ul
              role="alert"
              className="space-y-1 rounded-lg bg-danger-soft p-3 text-sm text-danger"
            >
              {fetchErrors.map((item) => (
                <li key={item.username} className="break-words">
                  {item.error.includes(`@${item.username}`)
                    ? item.error
                    : `@${item.username}: ${item.error}`}
                </li>
              ))}
            </ul>
          )}
          {selectedTab && (
            <AccountsPanel
              tab={selectedTab}
              tabs={tabs}
              accounts={accounts}
              error={accountsError}
              selectedAccountId={selectedAccountId}
              fetchingAccountId={fetchState.phase === 'running' ? fetchState.accountId : null}
              fetching={fetching}
              onSelect={setSelectedAccountId}
              onLookup={handleLookup}
              onCreate={handleCreate}
              onToggleActive={handleToggleActive}
              onUpdateMemo={handleUpdateMemo}
              onRemove={handleRemove}
              onFetch={(account) => void runFetch('account', { accountId: account.id })}
            />
          )}
        </div>

        <PostFeed
          posts={posts}
          accounts={accounts}
          selectedAccountId={selectedAccountId}
          loading={postsLoading}
          error={postsError}
          onSelectAccount={setSelectedAccountId}
        />
      </main>
    </div>
  )
}
