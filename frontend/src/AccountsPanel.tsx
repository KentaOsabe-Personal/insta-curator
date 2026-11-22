import { useState } from 'react'
import type { FormEvent } from 'react'
import AccountConfirmDialog from './AccountConfirmDialog'
import type { Account, AccountLookup } from './accountsDto'
import Avatar from './Avatar'
import { formatFollowers, formatRelativeTime } from './formatters'
import type { Tab } from './tabsDto'

type Props = {
  tab: Tab
  tabs: Tab[]
  accounts: Account[]
  error: string
  selectedAccountId: number | null
  fetchingAccountId: number | null
  fetching: boolean
  onSelect: (accountId: number | null) => void
  onLookup: (username: string) => Promise<AccountLookup>
  onCreate: (username: string, memo: string) => Promise<void>
  onToggleActive: (account: Account) => Promise<void>
  onUpdateMemo: (account: Account, memo: string) => Promise<void>
  onRemove: (account: Account) => Promise<void>
  onFetch: (account: Account) => void
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '保存に失敗しました。'
}

export default function AccountsPanel(props: Props) {
  const [username, setUsername] = useState('')
  const [lookingUp, setLookingUp] = useState(false)
  const [formError, setFormError] = useState('')
  const [lookup, setLookup] = useState<AccountLookup | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (username.trim() === '') {
      setFormError('ユーザー名を入力してください。')
      return
    }
    setLookingUp(true)
    setFormError('')
    try {
      setLookup(await props.onLookup(username))
    } catch (error) {
      // 確認できないアカウントは、ダイアログを開かずに入力欄の下へエラーを表示する。
      setFormError(errorMessage(error))
    } finally {
      setLookingUp(false)
    }
  }

  const handleRegister = async (confirmed: AccountLookup, memo: string) => {
    await props.onCreate(confirmed.username, memo)
    setLookup(null)
    setUsername('')
  }

  return (
    <section aria-labelledby="accounts-heading" className="rounded-xl border border-line bg-panel">
      <div className="border-b border-line p-4">
        <h2 id="accounts-heading" className="font-bold">
          「{props.tab.name}」のアカウント（{props.accounts.length}）
        </h2>
        <p className="mt-1 text-xs text-muted">
          他のタブに登録済みのアカウントも、このタブに追加できます。
        </p>
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
          {formError && (
            <p role="alert" className="text-sm break-words text-danger">
              {formError}
            </p>
          )}
          <button
            type="submit"
            disabled={lookingUp}
            className="w-full rounded-md border border-accent px-3 py-2 text-sm font-semibold text-accent hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-60"
          >
            {lookingUp ? '確認中…' : '確認'}
          </button>
        </form>
        {lookup && (
          <AccountConfirmDialog
            lookup={lookup}
            tabName={props.tab.name}
            onRegister={(memo) => handleRegister(lookup, memo)}
            onClose={() => setLookup(null)}
          />
        )}
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
            otherTabNames={props.tabs
              .filter((tab) => tab.id !== props.tab.id && account.tabIds.includes(tab.id))
              .map((tab) => tab.name)}
            selected={props.selectedAccountId === account.id}
            fetchingThis={props.fetchingAccountId === account.id}
            fetching={props.fetching}
            onSelect={() => props.onSelect(account.id)}
            onToggleActive={() => void props.onToggleActive(account)}
            onUpdateMemo={(value) => props.onUpdateMemo(account, value)}
            onRemove={() => props.onRemove(account)}
            onFetch={() => props.onFetch(account)}
          />
        ))}
      </ul>
      {props.accounts.length === 0 && (
        <p className="p-4 text-sm text-muted">
          このタブにはまだアカウントがありません。気になるアカウントを登録してください。
        </p>
      )}
    </section>
  )
}

type RowProps = {
  account: Account
  otherTabNames: string[]
  selected: boolean
  fetchingThis: boolean
  fetching: boolean
  onSelect: () => void
  onToggleActive: () => void
  onUpdateMemo: (memo: string) => Promise<void>
  onRemove: () => Promise<void>
  onFetch: () => void
}

function AccountRow({ account, ...props }: RowProps) {
  const [editing, setEditing] = useState(false)
  const [memoDraft, setMemoDraft] = useState(account.memo)
  const [memoError, setMemoError] = useState('')
  // window.confirm はアプリ内ブラウザなどで無効化されていることがあるため、行内で確認する。
  const [confirmingRemove, setConfirmingRemove] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [removeError, setRemoveError] = useState('')
  const keepsInOtherTabs = props.otherTabNames.length > 0

  const remove = async () => {
    setRemoving(true)
    setRemoveError('')
    try {
      await props.onRemove()
    } catch (error) {
      setRemoveError(errorMessage(error))
      setRemoving(false)
    }
  }

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
        <Avatar username={account.username} profilePictureUrl={account.profilePictureUrl} />
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
          {keepsInOtherTabs && (
            <p className="mt-1 text-xs text-muted">
              {props.otherTabNames.map((name) => `「${name}」`).join('')}にも登録
            </p>
          )}
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
            {!confirmingRemove && (
              <button
                type="button"
                onClick={() => {
                  setRemoveError('')
                  setConfirmingRemove(true)
                }}
                className="text-danger hover:underline"
              >
                削除
              </button>
            )}
          </div>
          {confirmingRemove && (
            <div role="alert" className="mt-2 rounded-md bg-danger-soft p-2 text-xs text-danger">
              <p className="break-words">
                {keepsInOtherTabs
                  ? `@${account.username} をこのタブから外しますか？（他のタブには残ります）`
                  : `@${account.username} と取得済みの投稿を削除しますか？`}
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => void remove()}
                  disabled={removing}
                  className="rounded bg-danger px-2 py-1 font-semibold text-white disabled:opacity-60"
                >
                  {removing ? '処理中…' : keepsInOtherTabs ? '外す' : '削除する'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingRemove(false)}
                  disabled={removing}
                  className="rounded px-2 py-1 text-muted hover:underline"
                >
                  取消
                </button>
              </div>
              {removeError && <p className="mt-1">{removeError}</p>}
            </div>
          )}
        </div>
      </div>
    </li>
  )
}
