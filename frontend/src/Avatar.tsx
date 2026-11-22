type Props = {
  username: string
  profilePictureUrl: string
  size?: 'md' | 'lg'
}

/** プロフィール画像。取得できないときはユーザー名の頭文字を表示する。 */
export default function Avatar({ username, profilePictureUrl, size = 'md' }: Props) {
  const sizeClass = size === 'lg' ? 'size-14 text-xl' : 'size-10'
  if (profilePictureUrl) {
    return (
      <img
        src={profilePictureUrl}
        alt=""
        referrerPolicy="no-referrer"
        className={`${sizeClass} shrink-0 rounded-full border border-line object-cover`}
      />
    )
  }
  return (
    <div
      aria-hidden="true"
      className={`${sizeClass} grid shrink-0 place-items-center rounded-full bg-accent-soft font-bold text-accent`}
    >
      {username.charAt(0).toUpperCase()}
    </div>
  )
}
