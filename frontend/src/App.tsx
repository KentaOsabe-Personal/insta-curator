import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import {
  createAccount,
  deleteAccount,
  fetchAccountPosts,
  fetchAllAccounts,
  listAccounts,
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

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '予期しないエラーが発生しました。'
}

export default function App() {
  const [status, setStatus] = useState<AppStatus | null>(null)
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

  const reloadAccounts = useCallback(async () => {
    try {
      setAccounts(await listAccounts())
      setAccountsError('')
    } catch (error) {
      setAccountsError(errorMessage(error))
    }
  }, [])

  const runFetch = useCallback(
    async (trigger: FetchTrigger, accountId?: number) => {
      if (fetchRunningRef.current) {
        return
      }
      fetchRunningRef.current = true
      dispatchFetch({ type: 'start', trigger, accountId })
      try {
        const results =
          accountId === undefined
            ? await fetchAllAccounts(trigger === 'manual')
            : await fetchAccountPosts(accountId)
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

  // 起動時: 状態とアカウントを読み込み、自動取得（最近取得済みはスキップ）を1回だけ行う。
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
      await reloadAccounts()
      await runFetch('startup')
    })()
  }, [reloadAccounts, runFetch])

  useEffect(() => {
    const controller = new AbortController()
    setPostsLoading(true)
    listPosts(selectedAccountId, controller.signal)
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
  }, [selectedAccountId, postsVersion])

  const handleCreate = async (username: string, memo: string) => {
    const created = await createAccount(username, memo)
    await reloadAccounts()
    await runFetch('account', created.id)
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

  const handleDelete = async (account: Account) => {
    try {
      await deleteAccount(account.id)
      if (selectedAccountId === account.id) {
        setSelectedAccountId(null)
      }
      await reloadAccounts()
      setPostsVersion((version) => version + 1)
    } catch (error) {
      setAccountsError(errorMessage(error))
    }
  }

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
            onClick={() => void runFetch('manual')}
            disabled={fetching}
            className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60"
          >
            {fetching ? '取得中…' : 'すべて更新'}
          </button>
        </div>
      </header>

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
          <AccountsPanel
            accounts={accounts}
            error={accountsError}
            selectedAccountId={selectedAccountId}
            fetchingAccountId={fetchState.phase === 'running' ? fetchState.accountId : null}
            fetching={fetching}
            onSelect={setSelectedAccountId}
            onCreate={handleCreate}
            onToggleActive={handleToggleActive}
            onUpdateMemo={handleUpdateMemo}
            onDelete={handleDelete}
            onFetch={(account) => void runFetch('account', account.id)}
          />
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
