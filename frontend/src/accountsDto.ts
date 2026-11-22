import {
  asArray,
  asRecord,
  DtoError,
  readBoolean,
  readNullableNumber,
  readNullableString,
  readNumber,
  readNumberArray,
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
  tabIds: number[]
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
    tabIds: readNumberArray(record, 'tabIds'),
  }
}

/** 登録前の確認で分かる登録状況。表示中のタブに登録済み / 別のタブに登録済み / 未登録。 */
export type LookupRegistration = 'this_tab' | 'other_tab' | 'none'

export type LookupPost = {
  mediaId: string
  permalink: string
  mediaType: string
  mediaUrl: string
  thumbnailUrl: string
  postedAt: string
}

export type AccountLookup = {
  username: string
  displayName: string
  profilePictureUrl: string
  followersCount: number | null
  mediaCount: number | null
  posts: LookupPost[]
  registration: LookupRegistration
}

function parseRegistration(value: string): LookupRegistration {
  if (value === 'this_tab' || value === 'other_tab' || value === 'none') {
    return value
  }
  throw new DtoError(`registration が不明な値です: ${value}`)
}

export function parseAccountLookup(value: unknown): AccountLookup {
  const record = asRecord(value, 'lookup')
  return {
    username: readString(record, 'username'),
    displayName: readString(record, 'displayName'),
    profilePictureUrl: readString(record, 'profilePictureUrl'),
    followersCount: readNullableNumber(record, 'followersCount'),
    mediaCount: readNullableNumber(record, 'mediaCount'),
    posts: asArray(record.posts, 'posts').map((item) => {
      const post = asRecord(item, 'post')
      return {
        mediaId: readString(post, 'mediaId'),
        permalink: readString(post, 'permalink'),
        mediaType: readString(post, 'mediaType'),
        mediaUrl: readString(post, 'mediaUrl'),
        thumbnailUrl: readString(post, 'thumbnailUrl'),
        postedAt: readString(post, 'postedAt'),
      }
    }),
    registration: parseRegistration(readString(record, 'registration')),
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
