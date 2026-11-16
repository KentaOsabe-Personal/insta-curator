import { asRecord, DtoError, readNumber, readString } from './dtoGuards'
import { requestJson } from './httpClient'

export type AppStatus = {
  mode: 'graph' | 'fake'
  minFetchIntervalMinutes: number
  mediaLimit: number
}

export function parseStatus(value: unknown): AppStatus {
  const record = asRecord(value, 'status')
  const mode = readString(record, 'mode')
  if (mode !== 'graph' && mode !== 'fake') {
    throw new DtoError(`mode が不明な値です: ${mode}`)
  }
  return {
    mode,
    minFetchIntervalMinutes: readNumber(record, 'minFetchIntervalMinutes'),
    mediaLimit: readNumber(record, 'mediaLimit'),
  }
}

export async function getStatus(signal?: AbortSignal): Promise<AppStatus> {
  return parseStatus(await requestJson('/api/status', { signal }))
}
