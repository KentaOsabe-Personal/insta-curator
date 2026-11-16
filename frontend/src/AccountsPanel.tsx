import { useState } from 'react'
import type { FormEvent } from 'react'
import type { Account } from './accountsDto'
import { formatFollowers, formatRelativeTime } from './formatters'

type Props = {
  accounts: Account[]
  error: string
  selectedAccountId: number | null
  fetchingAccountId: number | null
  fetching: boolean
  onSelect: (accountId: number | null) => void
  onCreate: (username: string, memo: string) => Promise<void>
  onToggleActive: (account: Account) => Promise<void>
  onUpdateMemo: (account: Account, memo: string) => Promise<void>
  onDelete: (account: Account) => Promise<void>
  onFetch: (account: Account) => void
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '保存に失敗しました。'
}

export default function AccountsPanel(props: Props) {
  const [username, setUsername] = useState('')
  const [memo, setMemo] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (username.trim() === '') {
      setFormError('ユーザー名を入力してください。')
      return
    }
    setSubmitting(true)
    setFormError('')
    try {
      await props.onCreate(username, memo)
      setUsername('')
      setMemo('')
    } catch (error) {
      setFormError(errorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section aria-labelledby="accounts-heading" className="rounded-xl border border-line bg-panel">
      <div className="border-b border-line p-4">
        <h2 id="accounts-heading" className="font-bold">
          アカウント（{props.accounts.length}）
        </h2>
        <form onSubmit={(event) => void handleSubmit(event)} className="mt-3 space-y-2">
          <label className="block text-sm">
            <span className="text-muted">ユーザー名 / プロフィール URL</span>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="@ramen_tokyo"
              autoComplete="off"
              className="mt-1 w-full rounded-md border border-line px-3 py-2 focus-visible:outline-2 focus-visible:outline-accent"
            />
          </label>
          <label className="block text-sm">
            <span className="text-muted">メモ（任意）</span>
            <input
              value={memo}
              onChange={(event) => setMemo(event.target.value)}
              placeholder="ラーメン / 古着屋 など"
              maxLength={200}
              className="mt-1 w-full rounded-md border border-line px-3 py-2 focus-visible:outline-2 focus-visible:outline-accent"
            />
          </label>
          {formError && (
            <p role="alert" className="text-sm text-danger">
              {formError}
            </p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md border border-accent px-3 py-2 text-sm font-semibold text-accent hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-60"
          >
            {submitting ? '登録中…' : '登録して取得'}
          </button>
        </form>
      </div>

      {props.error && (
        <p role="alert" className="m-4 rounded-md bg-danger-soft p-3 text-sm text-danger">
          {props.error}
        </p>
      )}

      <ul className="divide-y divide-line">
        <li>
          <button
            type="button"
            onClick={() => props.onSelect(null)}
            aria-pressed={props.selectedAccountId === null}
            className="w-full px-4 py-2 text-left text-sm hover:bg-accent-soft aria-pressed:bg-accent-soft aria-pressed:font-semibold"
          >
            すべての投稿
          </button>
        </li>
        {props.accounts.map((account) => (
          <AccountRow
            key={account.id}
            account={account}
            selected={props.selectedAccountId === account.id}
            fetchingThis={props.fetchingAccountId === account.id}
            fetching={props.fetching}
            onSelect={() => props.onSelect(account.id)}
            onToggleActive={() => void props.onToggleActive(account)}
            onUpdateMemo={(value) => props.onUpdateMemo(account, value)}
            onDelete={() => {
              if (window.confirm(`@${account.username} と取得済みの投稿を削除しますか？`)) {
                void props.onDelete(account)
              }
            }}
            onFetch={() => props.onFetch(account)}
          />
        ))}
      </ul>
      {props.accounts.length === 0 && (
        <p className="p-4 text-sm text-muted">
          まだアカウントがありません。気になるアカウントを登録してください。
        </p>
      )}
    </section>
  )
}

type RowProps = {
  account: Account
  selected: boolean
  fetchingThis: boolean
  fetching: boolean
  onSelect: () => void
  onToggleActive: () => void
  onUpdateMemo: (memo: string) => Promise<void>
  onDelete: () => void
  onFetch: () => void
}

function AccountRow({ account, ...props }: RowProps) {
  const [editing, setEditing] = useState(false)
  const [memoDraft, setMemoDraft] = useState(account.memo)
  const [memoError, setMemoError] = useState('')

  const saveMemo = async () => {
    try {
      await props.onUpdateMemo(memoDraft)
      setEditing(false)
      setMemoError('')
    } catch (error) {
      setMemoError(errorMessage(error))
    }
  }

  return (
    <li className={`px-4 py-3 ${account.isActive ? '' : 'opacity-60'}`}>
      <div className="flex items-start gap-3">
        <Avatar account={account} />
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={props.onSelect}
            aria-pressed={props.selected}
            className="block max-w-full text-left hover:underline aria-pressed:text-accent"
          >
            <span className="block truncate font-semibold">@{account.username}</span>
            {account.displayName && (
              <span className="block truncate text-xs text-muted">{account.displayName}</span>
            )}
          </button>
          <p className="mt-1 text-xs text-muted">
            {account.followersCount !== null &&
              `${formatFollowers(account.followersCount)}フォロワー・`}
            保存 {account.postCount}件
            {account.lastFetchedAt
              ? `・${formatRelativeTime(account.lastFetchedAt)}に取得`
              : '・未取得'}
            {!account.isActive && '・停止中'}
          </p>
          {account.lastFetchError && (
            <p className="mt-1 text-xs break-words text-danger">⚠ {account.lastFetchError}</p>
          )}

          {editing ? (
            <div className="mt-2 flex gap-1">
              <input
                value={memoDraft}
                onChange={(event) => setMemoDraft(event.target.value)}
                maxLength={200}
                aria-label={`@${account.username} のメモ`}
                className="min-w-0 flex-1 rounded border border-line px-2 py-1 text-sm"
              />
              <button
                type="button"
                onClick={() => void saveMemo()}
                className="rounded bg-accent px-2 text-xs text-white"
              >
                保存
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false)
                  setMemoDraft(account.memo)
                }}
                className="rounded px-2 text-xs text-muted"
              >
                取消
              </button>
            </div>
          ) : (
            account.memo && <p className="mt-1 text-sm break-words">{account.memo}</p>
          )}
          {memoError && <p className="text-xs text-danger">{memoError}</p>}

          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
            <button
              type="button"
              onClick={props.onFetch}
              disabled={props.fetching || !account.isActive}
              className="text-accent hover:underline disabled:text-muted disabled:no-underline"
            >
              {props.fetchingThis ? '取得中…' : '取得'}
            </button>
            {!editing && (
              <button
                type="button"
                onClick={() => {
                  setMemoDraft(account.memo)
                  setEditing(true)
                }}
                className="text-muted hover:underline"
              >
                メモ編集
              </button>
            )}
            <button
              type="button"
              onClick={props.onToggleActive}
              className="text-muted hover:underline"
            >
              {account.isActive ? '停止' : '再開'}
            </button>
            <a
              href={`https://www.instagram.com/${account.username}/`}
              target="_blank"
              rel="noreferrer"
              className="text-muted hover:underline"
            >
              Instagram
            </a>
            <button type="button" onClick={props.onDelete} className="text-danger hover:underline">
              削除
            </button>
          </div>
        </div>
      </div>
    </li>
  )
}

function Avatar({ account }: { account: Account }) {
  if (account.profilePictureUrl) {
    return (
      <img
        src={account.profilePictureUrl}
        alt=""
        referrerPolicy="no-referrer"
        className="size-10 shrink-0 rounded-full border border-line object-cover"
      />
    )
  }
  return (
    <div
      aria-hidden="true"
      className="grid size-10 shrink-0 place-items-center rounded-full bg-accent-soft font-bold text-accent"
    >
      {account.username.charAt(0).toUpperCase()}
    </div>
  )
}
