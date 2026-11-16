export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

type JsonRequest = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  signal?: AbortSignal
}

/** Backend の `/api` を呼び、JSON を `unknown` として返す。検証は各 `*Dto.ts` が行う。 */
export async function requestJson(path: string, request: JsonRequest = {}): Promise<unknown> {
  let response: Response
  try {
    response = await fetch(path, {
      method: request.method ?? 'GET',
      headers: request.body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: request.body === undefined ? undefined : JSON.stringify(request.body),
      signal: request.signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error
    }
    throw new ApiError('サーバーに接続できませんでした。', 0)
  }

  if (response.status === 204) {
    return null
  }

  const payload: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    throw new ApiError(extractErrorMessage(payload, response.status), response.status)
  }
  return payload
}

/** DRF のエラー形式（`{detail}` または `{field: [message]}`）から表示用メッセージを取り出す。 */
export function extractErrorMessage(payload: unknown, status: number): string {
  if (typeof payload === 'object' && payload !== null && !Array.isArray(payload)) {
    const record = payload as Record<string, unknown>
    if (typeof record.detail === 'string') {
      return record.detail
    }
    for (const value of Object.values(record)) {
      if (Array.isArray(value) && typeof value[0] === 'string') {
        return value[0]
      }
      if (typeof value === 'string') {
        return value
      }
    }
  }
  return `リクエストに失敗しました（HTTP ${status}）。`
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}
