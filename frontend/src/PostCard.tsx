import { useState } from 'react'
import { formatRelativeTime } from './formatters'
import { previewImageUrl } from './postsDto'
import type { Post } from './postsDto'

const MEDIA_TYPE_LABEL: Record<string, string> = {
  CAROUSEL_ALBUM: '複数枚',
  VIDEO: '動画',
}

type Props = {
  post: Post
  onSelectAccount: () => void
}

export default function PostCard({ post, onSelectAccount }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [imageFailed, setImageFailed] = useState(false)
  const imageUrl = previewImageUrl(post)
  const typeLabel = MEDIA_TYPE_LABEL[post.mediaType]
  const longCaption = post.caption.length > 120

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-xl border border-line bg-panel">
      <div className="relative aspect-square bg-accent-soft">
        {imageUrl && !imageFailed ? (
          <img
            src={imageUrl}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setImageFailed(true)}
            className="size-full object-cover"
          />
        ) : (
          <div className="grid size-full place-items-center text-4xl" aria-hidden="true">
            🍽️
          </div>
        )}
        {typeLabel && (
          <span className="absolute top-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white">
            {typeLabel}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="flex items-baseline justify-between gap-2 text-sm">
          <button
            type="button"
            onClick={onSelectAccount}
            className="truncate font-semibold hover:underline"
          >
            @{post.username}
          </button>
          <time dateTime={post.postedAt} className="shrink-0 text-xs text-muted">
            {formatRelativeTime(post.postedAt)}
          </time>
        </div>

        {post.caption ? (
          <p
            className={`text-sm break-words whitespace-pre-wrap ${expanded ? '' : 'line-clamp-4'}`}
          >
            {post.caption}
          </p>
        ) : (
          <p className="text-sm text-muted">（キャプションなし）</p>
        )}

        <div className="mt-auto flex items-center justify-between pt-1 text-xs">
          {longCaption ? (
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              aria-expanded={expanded}
              className="text-muted hover:underline"
            >
              {expanded ? '閉じる' : '続きを読む'}
            </button>
          ) : (
            <span />
          )}
          {post.permalink && (
            <a
              href={post.permalink}
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-accent hover:underline"
            >
              Instagram で見る ↗
            </a>
          )}
        </div>
      </div>
    </article>
  )
}
