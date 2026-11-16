import { asArray, asRecord, readNumber, readString } from './dtoGuards'

export type Tab = {
  id: number
  name: string
  accountCount: number
}

export function parseTab(value: unknown): Tab {
  const record = asRecord(value, 'tab')
  return {
    id: readNumber(record, 'id'),
    name: readString(record, 'name'),
    accountCount: readNumber(record, 'accountCount'),
  }
}

export function parseTabList(value: unknown): Tab[] {
  return asArray(value, 'tabs').map(parseTab)
}
