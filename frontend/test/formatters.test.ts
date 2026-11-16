import { formatFollowers, formatRelativeTime } from '../src/formatters'
import { previewImageUrl } from '../src/postsDto'
import type { Post } from '../src/postsDto'

describe('formatRelativeTime', () => {
  const now = new Date('2026-11-16T12:00:00+09:00')

  // テストケース: 現在時刻からの差が異なる複数の時刻を渡す
  // 期待値: 分・時間・日単位の相対表記、1週間以上は日付になる
  it('formats relative times', () => {
    expect(formatRelativeTime('2026-11-16T11:59:30+09:00', now)).toBe('たった今')
    expect(formatRelativeTime('2026-11-16T11:45:00+09:00', now)).toBe('15分前')
    expect(formatRelativeTime('2026-11-16T09:00:00+09:00', now)).toBe('3時間前')
    expect(formatRelativeTime('2026-11-14T12:00:00+09:00', now)).toBe('2日前')
    expect(formatRelativeTime('2026-11-01T12:00:00+09:00', now)).toBe('2026/11/01')
    expect(formatRelativeTime('invalid', now)).toBe('')
  })
})

describe('formatFollowers', () => {
  // テストケース: 1万未満・1万以上・100万以上・null を渡す
  // 期待値: 桁区切り、万単位（小数1桁、末尾 .0 は省略）、空文字になる
  it('formats follower counts', () => {
    expect(formatFollowers(9876)).toBe('9,876')
    expect(formatFollowers(12345)).toBe('1.2万')
    expect(formatFollowers(30000)).toBe('3万')
    expect(formatFollowers(1234567)).toBe('123万')
    expect(formatFollowers(null)).toBe('')
  })
})

describe('previewImageUrl', () => {
  const base: Post = {
    id: 1,
    accountId: 1,
    username: 'a',
    mediaId: 'm',
    caption: '',
    permalink: '',
    mediaType: 'IMAGE',
    mediaUrl: 'https://cdn.example/image.jpg',
    thumbnailUrl: '',
    postedAt: '2026-11-16T00:00:00Z',
  }

  // テストケース: 画像・動画・media_url 欠落の投稿を渡す
  // 期待値: 画像は media_url、動画はサムネイル、欠落時は空文字になる
  it('chooses a preview image', () => {
    expect(previewImageUrl(base)).toBe('https://cdn.example/image.jpg')
    expect(
      previewImageUrl({
        ...base,
        mediaType: 'VIDEO',
        mediaUrl: 'https://cdn.example/v.mp4',
        thumbnailUrl: 'https://cdn.example/t.jpg',
      }),
    ).toBe('https://cdn.example/t.jpg')
    expect(previewImageUrl({ ...base, mediaUrl: '' })).toBe('')
  })
})
