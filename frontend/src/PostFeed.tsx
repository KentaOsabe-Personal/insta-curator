import type { Account } from './accountsDto'
import PostCard from './PostCard'
import type { Post } from './postsDto'

type Props = {
  posts: Post[]
  accounts: Account[]
  selectedAccountId: number | null
  loading: boolean
  error: string
  onSelectAccount: (accountId: number | null) => void
}

export default function PostFeed(props: Props) {
  const selected = props.accounts.find((account) => account.id === props.selectedAccountId)
  const heading = selected ? `@${selected.username} の投稿` : '新着の投稿'

  return (
    <section aria-labelledby="feed-heading" aria-busy={props.loading}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 id="feed-heading" className="text-lg font-bold">
          {heading}
          <span className="ml-2 text-sm font-normal text-muted">{props.posts.length}件</span>
        </h2>
        <label className="text-sm">
          <span className="sr-only">表示するアカウント</span>
          <select
            value={props.selectedAccountId ?? ''}
            onChange={(event) =>
              props.onSelectAccount(event.target.value === '' ? null : Number(event.target.value))
            }
            className="rounded-md border border-line bg-panel px-2 py-1"
          >
            <option value="">すべてのアカウント</option>
            {props.accounts
              .filter((account) => account.isActive)
              .map((account) => (
                <option key={account.id} value={account.id}>
                  @{account.username}
                </option>
              ))}
          </select>
        </label>
      </div>

      {props.error && (
        <p role="alert" className="mb-4 rounded-md bg-danger-soft p-3 text-sm text-danger">
          投稿を読み込めませんでした: {props.error}
        </p>
      )}

      {props.loading && props.posts.length === 0 ? (
        <p role="status" className="text-sm text-muted">
          読み込み中…
        </p>
      ) : props.posts.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-muted">
          まだ投稿がありません。左のフォームからアカウントを登録すると、ここに最新の投稿が並びます。
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {props.posts.map((post) => (
            <li key={post.id}>
              <PostCard post={post} onSelectAccount={() => props.onSelectAccount(post.accountId)} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
