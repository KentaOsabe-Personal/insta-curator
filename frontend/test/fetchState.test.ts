import type { FetchResult } from '../src/accountsDto'
import { describeFetchState, fetchReducer, initialFetchState } from '../src/fetchState'

const results: FetchResult[] = [
  { accountId: 1, username: 'a', status: 'ok', newPosts: 3, error: '' },
  { accountId: 2, username: 'b', status: 'skipped', newPosts: 0, error: '' },
  { accountId: 3, username: 'c', status: 'error', newPosts: 0, error: '見つかりません' },
]

describe('fetchReducer', () => {
  // テストケース: 起動時取得を開始し、混在した結果で完了する
  // 期待値: 取得数・スキップ数・新着数・エラーが集計され、説明文に反映される
  it('summarizes mixed results', () => {
    const running = fetchReducer(initialFetchState, { type: 'start', trigger: 'startup' })
    expect(describeFetchState(running)).toBe('最新の投稿を確認しています…')

    const done = fetchReducer(running, { type: 'succeed', results })
    expect(done).toEqual({
      phase: 'done',
      trigger: 'startup',
      summary: {
        fetched: 1,
        skipped: 1,
        newPosts: 3,
        errors: [{ username: 'c', error: '見つかりません' }],
      },
    })
    expect(describeFetchState(done)).toBe(
      '1件のアカウントを取得（新着 3件）、1件は最近取得済みのためスキップ、1件でエラー',
    )
  })

  // テストケース: 取得中に別の開始イベント、待機中に完了イベントを送る
  // 期待値: どちらも無視され状態が変わらない
  it('ignores out-of-order events', () => {
    const running = fetchReducer(initialFetchState, {
      type: 'start',
      trigger: 'account',
      accountId: 5,
    })
    expect(fetchReducer(running, { type: 'start', trigger: 'manual' })).toBe(running)
    expect(fetchReducer(initialFetchState, { type: 'succeed', results })).toBe(initialFetchState)
  })

  // テストケース: 取得対象が0件で完了する
  // 期待値: 対象アカウントがない旨を表示する
  it('describes empty results', () => {
    const running = fetchReducer(initialFetchState, { type: 'start', trigger: 'manual' })
    const done = fetchReducer(running, { type: 'succeed', results: [] })
    expect(describeFetchState(done)).toBe('取得対象のアカウントがありません。')
  })
})
