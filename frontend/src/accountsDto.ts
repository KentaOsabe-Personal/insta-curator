import {
  asArray,
  asRecord,
  DtoError,
  readBoolean,
  readNullableNumber,
  readNullableString,
  readNumber,
  readString,
} from './dtoGuards'

export type Account = {
  id: number
  username: string
  memo: string
  isActive: boolean
  displayName: string
  profilePictureUrl: string
  followersCount: number | null
  mediaCount: number | null
  lastFetchedAt: string | null
  lastFetchError: string
  postCount: number
}

export type FetchStatus = 'ok' | 'skipped' | 'error'

export type FetchResult = {
  accountId: number
  username: string
  status: FetchStatus
  newPosts: number
  error: string
}

export function parseAccount(value: unknown): Account {
  const record = asRecord(value, 'account')
  return {
    id: readNumber(record, 'id'),
    username: readString(record, 'username'),
    memo: readString(record, 'memo'),
    isActive: readBoolean(record, 'isActive'),
    displayName: readString(record, 'displayName'),
    profilePictureUrl: readString(record, 'profilePictureUrl'),
    followersCount: readNullableNumber(record, 'followersCount'),
    mediaCount: readNullableNumber(record, 'mediaCount'),
    lastFetchedAt: readNullableString(record, 'lastFetchedAt'),
    lastFetchError: readString(record, 'lastFetchError'),
    postCount: readNumber(record, 'postCount'),
  }
}

export function parseAccountList(value: unknown): Account[] {
  return asArray(value, 'accounts').map(parseAccount)
}

function parseFetchStatus(value: string): FetchStatus {
  if (value === 'ok' || value === 'skipped' || value === 'error') {
    return value
  }
  throw new DtoError(`status が不明な値です: ${value}`)
}

export function parseFetchResults(value: unknown): FetchResult[] {
  const record = asRecord(value, 'fetch response')
  return asArray(record.results, 'results').map((item) => {
    const result = asRecord(item, 'result')
    return {
      accountId: readNumber(result, 'accountId'),
      username: readString(result, 'username'),
      status: parseFetchStatus(readString(result, 'status')),
      newPosts: readNumber(result, 'newPosts'),
      error: readString(result, 'error'),
    }
  })
}
