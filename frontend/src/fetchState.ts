import type { FetchResult } from './accountsDto'

export type FetchTrigger = 'startup' | 'manual' | 'account'

export type FetchSummary = {
  fetched: number
  skipped: number
  newPosts: number
  errors: { username: string; error: string }[]
}

export type FetchState =
  | { phase: 'idle' }
  | { phase: 'running'; trigger: FetchTrigger; accountId: number | null }
  | { phase: 'done'; trigger: FetchTrigger; summary: FetchSummary }
  | { phase: 'failed'; trigger: FetchTrigger; message: string }

export type FetchEvent =
  | { type: 'start'; trigger: FetchTrigger; accountId?: number }
  | { type: 'succeed'; results: FetchResult[] }
  | { type: 'fail'; message: string }

export const initialFetchState: FetchState = { phase: 'idle' }

export function summarizeResults(results: FetchResult[]): FetchSummary {
  return {
    fetched: results.filter((result) => result.status === 'ok').length,
    skipped: results.filter((result) => result.status === 'skipped').length,
    newPosts: results.reduce((total, result) => total + result.newPosts, 0),
    errors: results
      .filter((result) => result.status === 'error')
      .map((result) => ({ username: result.username, error: result.error })),
  }
}

export function fetchReducer(state: FetchState, event: FetchEvent): FetchState {
  switch (event.type) {
    case 'start':
      // 取得中の二重実行は受け付けない。
      if (state.phase === 'running') {
        return state
      }
      return { phase: 'running', trigger: event.trigger, accountId: event.accountId ?? null }
    case 'succeed':
      if (state.phase !== 'running') {
        return state
      }
      return { phase: 'done', trigger: state.trigger, summary: summarizeResults(event.results) }
    case 'fail':
      if (state.phase !== 'running') {
        return state
      }
      return { phase: 'failed', trigger: state.trigger, message: event.message }
  }
}

export function describeFetchState(state: FetchState): string {
  switch (state.phase) {
    case 'idle':
      return ''
    case 'running':
      return state.trigger === 'startup' ? '最新の投稿を確認しています…' : '取得しています…'
    case 'failed':
      return `取得に失敗しました: ${state.message}`
    case 'done': {
      const { fetched, skipped, newPosts, errors } = state.summary
      if (fetched === 0 && skipped === 0 && errors.length === 0) {
        return '取得対象のアカウントがありません。'
      }
      const parts: string[] = []
      if (fetched > 0) {
        parts.push(`${fetched}件のアカウントを取得（新着 ${newPosts}件）`)
      }
      if (skipped > 0) {
        parts.push(`${skipped}件は最近取得済みのためスキップ`)
      }
      if (errors.length > 0) {
        parts.push(`${errors.length}件でエラー`)
      }
      return parts.join('、')
    }
  }
}
