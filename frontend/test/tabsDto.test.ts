import { DtoError } from '../src/dtoGuards'
import { parseTabList } from '../src/tabsDto'

describe('tabsDto', () => {
  // テストケース: Backend のタブ一覧を検証する
  // 期待値: 型どおりの Tab 配列として取り出せ、型が異なる項目は DtoError で拒否する
  it('parses tabs and rejects malformed ones', () => {
    const food = { id: 1, name: 'ご飯', accountCount: 3 }
    expect(parseTabList([food])).toEqual([food])
    expect(() => parseTabList([{ ...food, accountCount: '3' }])).toThrow(DtoError)
    expect(() => parseTabList({ tabs: [] })).toThrow(DtoError)
  })
})
