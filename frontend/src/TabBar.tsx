import { useState } from 'react'
import type { FormEvent } from 'react'
import type { Tab } from './tabsDto'

type Props = {
  tabs: Tab[]
  selectedTabId: number | null
  onSelect: (tabId: number) => void
  onCreate: (name: string) => Promise<void>
  onRename: (tab: Tab, name: string) => Promise<void>
  onDelete: (tab: Tab) => Promise<void>
}

// window.prompt / confirm はアプリ内ブラウザなどで無効化されていることがあるため、すべて画面内で入力・確認する。
type Mode = 'idle' | 'creating' | 'renaming' | 'confirmingDelete'

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '保存に失敗しました。'
}

export default function TabBar(props: Props) {
  const [mode, setMode] = useState<Mode>('idle')
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  // アカウントがあるため削除できなかったタブ。空になる・別タブへ移ると表示が自然に消える。
  const [blockedTabId, setBlockedTabId] = useState<number | null>(null)
  const selected = props.tabs.find((tab) => tab.id === props.selectedTabId) ?? null
  const showBlockedMessage =
    selected !== null && selected.id === blockedTabId && selected.accountCount > 0

  const changeMode = (next: Mode) => {
    setMode(next)
    setError('')
    setBlockedTabId(null)
    setDraft(next === 'renaming' && selected ? selected.name : '')
  }

  const run = async (action: () => Promise<void>) => {
    setSaving(true)
    setError('')
    try {
      await action()
      setMode('idle')
      setDraft('')
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setSaving(false)
    }
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const name = draft.trim()
    if (name === '') {
      setError('タブ名を入力してください。')
      return
    }
    if (mode === 'creating') {
      void run(() => props.onCreate(name))
    } else if (mode === 'renaming' && selected) {
      void run(() => props.onRename(selected, name))
    }
  }

  const requestDelete = () => {
    if (!selected) {
      return
    }
    if (selected.accountCount > 0) {
      changeMode('idle')
      setBlockedTabId(selected.id)
      return
    }
    if (props.tabs.length <= 1) {
      changeMode('idle')
      setError('最後のタブは削除できません。')
      return
    }
    changeMode('confirmingDelete')
  }

  return (
    <div className="border-b border-line bg-panel">
      <div className="mx-auto max-w-6xl px-4">
        <div className="flex flex-wrap items-end gap-x-1 gap-y-2 pt-2">
          <nav aria-label="タブ" className="-mb-px flex flex-wrap gap-1">
            {props.tabs.map((tab) => {
              const active = tab.id === props.selectedTabId
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    changeMode('idle')
                    props.onSelect(tab.id)
                  }}
                  aria-current={active ? 'page' : undefined}
                  className={`rounded-t-lg border border-b-0 px-4 py-2 text-sm focus-visible:outline-2 focus-visible:outline-accent ${
                    active
                      ? 'border-line bg-surface font-semibold text-accent'
                      : 'border-transparent text-muted hover:text-ink'
                  }`}
                >
                  {tab.name}
                  <span className="ml-1 text-xs text-muted">{tab.accountCount}</span>
                </button>
              )
            })}
          </nav>
          {mode !== 'creating' && (
            <button
              type="button"
              onClick={() => changeMode('creating')}
              className="mb-1 rounded-full px-3 py-1 text-sm text-accent hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-accent"
            >
              ＋ タブを追加
            </button>
          )}
          {selected && mode === 'idle' && (
            <div className="mb-1 ml-auto flex gap-3 text-xs">
              <button
                type="button"
                onClick={() => changeMode('renaming')}
                className="text-muted hover:underline"
              >
                タブ名を変更
              </button>
              <button type="button" onClick={requestDelete} className="text-danger hover:underline">
                タブを削除
              </button>
            </div>
          )}
        </div>

        {(mode === 'creating' || mode === 'renaming') && (
          <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2 py-2">
            <label className="text-sm">
              <span className="sr-only">
                {mode === 'creating' ? '新しいタブの名前' : 'タブの新しい名前'}
              </span>
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={mode === 'creating' ? 'ファッション など' : ''}
                maxLength={30}
                autoFocus
                className="w-48 rounded-md border border-line px-3 py-1.5 focus-visible:outline-2 focus-visible:outline-accent"
              />
            </label>
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-white hover:bg-accent-strong disabled:opacity-60"
            >
              {saving ? '保存中…' : mode === 'creating' ? '作成' : '変更'}
            </button>
            <button
              type="button"
              onClick={() => changeMode('idle')}
              disabled={saving}
              className="rounded-md px-3 py-1.5 text-sm text-muted hover:underline"
            >
              取消
            </button>
          </form>
        )}

        {mode === 'confirmingDelete' && selected && (
          <div role="alert" className="flex flex-wrap items-center gap-2 py-2 text-sm">
            <span>「{selected.name}」タブを削除しますか？</span>
            <button
              type="button"
              onClick={() => void run(() => props.onDelete(selected))}
              disabled={saving}
              className="rounded-md bg-danger px-3 py-1.5 font-semibold text-white disabled:opacity-60"
            >
              {saving ? '削除中…' : '削除する'}
            </button>
            <button
              type="button"
              onClick={() => changeMode('idle')}
              disabled={saving}
              className="rounded-md px-3 py-1.5 text-muted hover:underline"
            >
              取消
            </button>
          </div>
        )}

        {(error || showBlockedMessage) && (
          <p role="alert" className="pb-2 text-sm text-danger">
            {error ||
              'アカウントが登録されているタブは削除できません。先にアカウントを外してください。'}
          </p>
        )}
      </div>
    </div>
  )
}
