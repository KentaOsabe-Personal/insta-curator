import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { AccountLookup, LookupPost } from './accountsDto'
import Avatar from './Avatar'
import { formatFollowers } from './formatters'
import { previewImageUrl } from './postsDto'

type Props = {
  lookup: AccountLookup
  tabName: string
  onRegister: (memo: string) => Promise<void>
  onClose: () => void
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '登録に失敗しました。'
}

/** 登録前の確認ダイアログ。スマホでは画面下から出るシート、PC では中央に表示する。 */
export default function AccountConfirmDialog({ lookup, tabName, onRegister, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const [memo, setMemo] = useState('')
  const [registering, setRegistering] = useState(false)
  const [registerError, setRegisterError] = useState('')
  const registeredHere = lookup.registration === 'this_tab'

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) {
      dialog.showModal()
      // showModal は先頭のリンク（投稿サムネイル）にフォーカスするため、キャンセルへ移す。
      cancelRef.current?.focus()
    }
  }, [])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (registeredHere) {
      return
    }
    setRegistering(true)
    setRegisterError('')
    try {
      await onRegister(memo)
    } catch (error) {
      setRegisterError(errorMessage(error))
      setRegistering(false)
    }
  }

  const stats = [
    lookup.followersCount !== null && `${formatFollowers(lookup.followersCount)}フォロワー`,
    lookup.mediaCount !== null && `投稿 ${lookup.mediaCount.toLocaleString('ja-JP')}件`,
  ].filter(Boolean)

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="account-confirm-heading"
      onCancel={(event) => {
        // Esc で閉じるとき、登録中なら閉じない。
        event.preventDefault()
        if (!registering) {
          onClose()
        }
      }}
      onClick={(event) => {
        // 背景（dialog 要素そのもの）のクリックで閉じる。
        if (event.target === event.currentTarget && !registering) {
          onClose()
        }
      }}
      className="mx-auto mt-auto mb-0 w-full max-w-none rounded-t-2xl bg-panel p-0 text-ink backdrop:bg-black/40 md:my-auto md:max-w-md md:rounded-2xl"
    >
      <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4 p-5">
        <div className="mx-auto h-1 w-10 rounded-full bg-line md:hidden" aria-hidden="true" />
        <h2 id="account-confirm-heading" className="sr-only">
          @{lookup.username} を「{tabName}」に登録
        </h2>

        <div className="flex items-center gap-3">
          <Avatar
            username={lookup.username}
            profilePictureUrl={lookup.profilePictureUrl}
            size="lg"
          />
          <div className="min-w-0">
            <p className="truncate text-lg font-bold">@{lookup.username}</p>
            {lookup.displayName && (
              <p className="truncate text-sm text-muted">{lookup.displayName}</p>
            )}
            {stats.length > 0 && <p className="text-xs text-muted">{stats.join('・')}</p>}
          </div>
        </div>

        {lookup.posts.length > 0 ? (
          <ul className="grid grid-cols-3 gap-1" aria-label="最新の投稿">
            {lookup.posts.map((post) => (
              <li key={post.mediaId}>
                <PostThumbnail post={post} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">表示できる投稿がありません。</p>
        )}

        {lookup.registration === 'this_tab' && (
          <p role="status" className="rounded-md bg-accent-soft p-2 text-sm">
            このアカウントは「{tabName}」タブに登録済みです。
          </p>
        )}
        {lookup.registration === 'other_tab' && (
          <p className="rounded-md bg-accent-soft p-2 text-sm">
            別のタブに登録済みです。このタブにも追加できます（投稿は共有されます）。
          </p>
        )}

        {!registeredHere && (
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
        )}

        {registerError && (
          <p role="alert" className="text-sm break-words text-danger">
            {registerError}
          </p>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            ref={cancelRef}
            onClick={onClose}
            disabled={registering}
            className="flex-1 rounded-md border border-line px-3 py-2 text-sm hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-60"
          >
            キャンセル
          </button>
          <button
            type="submit"
            disabled={registeredHere || registering}
            className="flex-1 rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white hover:bg-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60"
          >
            {registering ? '登録中…' : 'このタブに登録'}
          </button>
        </div>
      </form>
    </dialog>
  )
}

function PostThumbnail({ post }: { post: LookupPost }) {
  const imageUrl = previewImageUrl(post)
  return (
    <a
      href={post.permalink || undefined}
      target="_blank"
      rel="noreferrer"
      className="block aspect-square overflow-hidden rounded-md bg-accent-soft"
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt=""
          referrerPolicy="no-referrer"
          loading="lazy"
          className="size-full object-cover"
        />
      ) : (
        <span className="grid size-full place-items-center text-xs text-muted">
          {post.mediaType === 'VIDEO' ? '動画' : '画像なし'}
        </span>
      )}
    </a>
  )
}
