import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// 未开启 vitest globals，Testing Library 不会自动注册 cleanup，需显式在每个用例后卸载组件。
afterEach(() => {
  cleanup()
})
