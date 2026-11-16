export class DtoError extends Error {
  constructor(message: string) {
    super(`API レスポンスの形式が不正です: ${message}`)
    this.name = 'DtoError'
  }
}

export function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new DtoError(`${label} がオブジェクトではありません`)
  }
  return value as Record<string, unknown>
}

export function asArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new DtoError(`${label} が配列ではありません`)
  }
  return value
}

export function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key]
  if (typeof value !== 'string') {
    throw new DtoError(`${key} が文字列ではありません`)
  }
  return value
}

export function readNullableString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key]
  if (value === null || value === undefined) {
    return null
  }
  if (typeof value !== 'string') {
    throw new DtoError(`${key} が文字列ではありません`)
  }
  return value
}

export function readNumber(record: Record<string, unknown>, key: string): number {
  const value = record[key]
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new DtoError(`${key} が数値ではありません`)
  }
  return value
}

export function readNullableNumber(record: Record<string, unknown>, key: string): number | null {
  const value = record[key]
  if (value === null || value === undefined) {
    return null
  }
  return readNumber(record, key)
}

export function readBoolean(record: Record<string, unknown>, key: string): boolean {
  const value = record[key]
  if (typeof value !== 'boolean') {
    throw new DtoError(`${key} が真偽値ではありません`)
  }
  return value
}
