import { parseAccountList, parseAccountLookup, parseFetchResults } from '../src/accountsDto'
import { DtoError } from '../src/dtoGuards'
import { extractErrorMessage } from '../src/httpClient'

const validAccount = {
  id: 1,
  username: 'ramen_tokyo',
  memo: '',
  isActive: true,
  displayName: '東京ラーメン',
  profilePictureUrl: '',
  followersCount: null,
  mediaCount: 3,
  lastFetchedAt: null,
  lastFetchError: '',
  postCount: 0,
  tabIds: [1, 2],
}

describe('accountsDto', () => {
  // テストケース: Backend のアカウント一覧（null を含む）を検証する
  // 期待値: 型どおりの Account 配列として取り出せる
  it('parses a valid account list', () => {
    expect(parseAccountList([validAccount])).toEqual([validAccount])
  })

  // テストケース: 必須項目の型が異なるアカウントを検証する
  // 期待値: DtoError で拒否する
  it('rejects malformed accounts', () => {
    expect(() => parseAccountList([{ ...validAccount, id: '1' }])).toThrow(DtoError)
    expect(() => parseAccountList({ results: [] })).toThrow(DtoError)
    expect(() => parseAccountList([{ ...validAccount, tabIds: ['1'] }])).toThrow(DtoError)
  })

  // テストケース: 未知の status を含む取得結果を検証する
  // 期待値: 既知の値は通し、未知の値は DtoError で拒否する
  it('validates fetch result status', () => {
    const ok = { accountId: 1, username: 'a', status: 'ok', newPosts: 2, error: '' }
    expect(parseFetchResults({ results: [ok] })[0]?.status).toBe('ok')
    expect(() => parseFetchResults({ results: [{ ...ok, status: 'unknown' }] })).toThrow(DtoError)
  })
})

const validLookup = {
  username: 'ramen_tokyo',
  displayName: '東京ラーメン',
  profilePictureUrl: '',
  followersCount: 12345,
  mediaCount: null,
  posts: [
    {
      mediaId: '180001',
      permalink: 'https://www.instagram.com/p/abc/',
      mediaType: 'VIDEO',
      mediaUrl: '',
      thumbnailUrl: 'https://cdn.example/thumb.jpg',
      postedAt: '2026-11-10T03:04:05+00:00',
    },
  ],
  registration: 'other_tab',
}

describe('parseAccountLookup', () => {
  // テストケース: 登録前の確認結果（null を含むプロフィールと投稿）を検証する
  // 期待値: 型どおりの AccountLookup として取り出せる
  it('parses a valid lookup', () => {
    expect(parseAccountLookup(validLookup)).toEqual(validLookup)
  })

  // テストケース: 未知の登録状況、または形式の異なる投稿を含む確認結果を検証する
  // 期待値: DtoError で拒否する
  it('rejects malformed lookups', () => {
    expect(() => parseAccountLookup({ ...validLookup, registration: 'unknown' })).toThrow(DtoError)
    expect(() => parseAccountLookup({ ...validLookup, posts: [{ mediaId: 1 }] })).toThrow(DtoError)
    expect(() => parseAccountLookup({ ...validLookup, posts: null })).toThrow(DtoError)
  })
})

describe('extractErrorMessage', () => {
  // テストケース: DRF の detail 形式とフィールドエラー形式、想定外の形式を渡す
  // 期待値: 先頭のメッセージを取り出し、取り出せない場合は HTTP ステータス付きの汎用文言になる
  it('extracts DRF error messages', () => {
    expect(extractErrorMessage({ detail: 'Not found.' }, 404)).toBe('Not found.')
    expect(extractErrorMessage({ username: ['@a は登録済みです。'] }, 400)).toBe(
      '@a は登録済みです。',
    )
    expect(extractErrorMessage(null, 500)).toBe('リクエストに失敗しました（HTTP 500）。')
  })
})
