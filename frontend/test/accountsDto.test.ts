import { parseAccountList, parseFetchResults } from '../src/accountsDto'
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
