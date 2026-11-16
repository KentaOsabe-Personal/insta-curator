import { asArray, asRecord, readNumber, readString } from './dtoGuards'

export type Post = {
  id: number
  accountId: number
  username: string
  mediaId: string
  caption: string
  permalink: string
  mediaType: string
  mediaUrl: string
  thumbnailUrl: string
  postedAt: string
}

export function parsePosts(value: unknown): Post[] {
  const record = asRecord(value, 'posts response')
  return asArray(record.posts, 'posts').map((item) => {
    const post = asRecord(item, 'post')
    return {
      id: readNumber(post, 'id'),
      accountId: readNumber(post, 'accountId'),
      username: readString(post, 'username'),
      mediaId: readString(post, 'mediaId'),
      caption: readString(post, 'caption'),
      permalink: readString(post, 'permalink'),
      mediaType: readString(post, 'mediaType'),
      mediaUrl: readString(post, 'mediaUrl'),
      thumbnailUrl: readString(post, 'thumbnailUrl'),
      postedAt: readString(post, 'postedAt'),
    }
  })
}

/** 一覧に表示する画像。動画はサムネイルを優先し、取得できない場合は空文字。 */
export function previewImageUrl(post: Post): string {
  if (post.mediaType === 'VIDEO') {
    return post.thumbnailUrl || ''
  }
  return post.mediaUrl || post.thumbnailUrl
}
