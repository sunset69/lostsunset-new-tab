// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { installMemoryLocalStorage } from '../../test/local-storage-shim'
import { localStorageStorage } from './local-storage'

describe('localStorageStorage', () => {
  beforeEach(() => {
    installMemoryLocalStorage()
  })

  it('未写入的键返回 undefined', async () => {
    expect(await localStorageStorage.get('nope')).toBeUndefined()
  })

  it('set 后以 JSON 形式写回并可 get 出等价对象', async () => {
    const value = { version: 1, nested: { enabled: true } }
    await localStorageStorage.set('userConfig.v1', value)

    expect(window.localStorage.getItem('userConfig.v1')).toBe(JSON.stringify(value))
    expect(await localStorageStorage.get('userConfig.v1')).toEqual(value)
  })

  it('remove 删除对应键', async () => {
    await localStorageStorage.set('k', 1)
    await localStorageStorage.remove('k')
    expect(window.localStorage.getItem('k')).toBeNull()
  })
})
