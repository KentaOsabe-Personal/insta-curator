const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const time = new Date(iso)
  if (Number.isNaN(time.getTime())) {
    return ''
  }
  const diff = now.getTime() - time.getTime()
  if (diff < MINUTE) {
    return 'たった今'
  }
  if (diff < HOUR) {
    return `${Math.floor(diff / MINUTE)}分前`
  }
  if (diff < DAY) {
    return `${Math.floor(diff / HOUR)}時間前`
  }
  if (diff < 7 * DAY) {
    return `${Math.floor(diff / DAY)}日前`
  }
  return formatDate(time)
}

export function formatDate(time: Date): string {
  const month = String(time.getMonth() + 1).padStart(2, '0')
  const day = String(time.getDate()).padStart(2, '0')
  return `${time.getFullYear()}/${month}/${day}`
}

export function formatFollowers(count: number | null): string {
  if (count === null) {
    return ''
  }
  if (count >= 10000) {
    const man = count / 10000
    return `${man >= 100 ? Math.round(man) : man.toFixed(1).replace(/\.0$/, '')}万`
  }
  return count.toLocaleString('ja-JP')
}
