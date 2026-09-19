// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { downloadTextFile } from './download'

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('downloadTextFile', () => {
  it('通过带 download 属性的锚点触发保存，并在随后释放对象 URL', () => {
    vi.useFakeTimers()
    const createSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock')
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {})

    downloadTextFile('lostsunset-backup.json', '{"kind":"x"}')

    expect(createSpy).toHaveBeenCalledTimes(1)
    const blob = createSpy.mock.calls[0][0] as Blob
    expect(blob.type).toBe('application/json;charset=utf-8')

    expect(clickSpy).toHaveBeenCalledTimes(1)
    const anchor = clickSpy.mock.instances[0] as HTMLAnchorElement
    expect(anchor.download).toBe('lostsunset-backup.json')
    expect(anchor.href).toBe('blob:mock')
    expect(anchor.isConnected).toBe(false)
    expect(revokeSpy).not.toHaveBeenCalled()

    vi.advanceTimersByTime(0)
    expect(revokeSpy).toHaveBeenCalledWith('blob:mock')
  })
})
