import { describe, expect, it } from 'vitest'
import {
  MIN_CROP_SIZE,
  computeCropRect,
  fitDisplayedSize,
  initialCropBox,
  moveCropBox,
  normalizeCropBox,
  resizeCropBox,
} from './image-crop'

describe('normalizeCropBox', () => {
  it('钳制到容器内并保证最小尺寸', () => {
    const box = normalizeCropBox(
      { x: -10, y: -10, width: 20, height: 20 },
      200,
      100,
      'free',
    )
    expect(box).toEqual({ x: 0, y: 0, width: MIN_CROP_SIZE, height: MIN_CROP_SIZE })
  })

  it('比例模式下高度随宽度推导', () => {
    const box = normalizeCropBox({ x: 0, y: 0, width: 160, height: 90 }, 200, 200, '16:9')
    expect(box.width).toBe(160)
    expect(box.height).toBeCloseTo(90)
  })

  it('比例高度超出容器时收缩宽度', () => {
    const box = normalizeCropBox({ x: 0, y: 0, width: 400, height: 900 }, 400, 180, '1:1')
    expect(box.height).toBe(180)
    expect(box.width).toBe(180)
    expect(box.x).toBe(0)
    expect(box.y).toBe(0)
  })
})

describe('moveCropBox', () => {
  it('整体移动并钳制边界', () => {
    const box = { x: 50, y: 50, width: 100, height: 80 }
    expect(moveCropBox(box, 10, -20, 200, 200)).toEqual({ x: 60, y: 30, width: 100, height: 80 })
    expect(moveCropBox(box, 500, 500, 200, 200)).toEqual({ x: 100, y: 120, width: 100, height: 80 })
    expect(moveCropBox(box, -500, -500, 200, 200)).toEqual({ x: 0, y: 0, width: 100, height: 80 })
  })
})

describe('resizeCropBox', () => {
  it('se 拖大且固定角不动', () => {
    const box = { x: 10, y: 10, width: 80, height: 80 }
    const next = resizeCropBox({
      box,
      anchor: 'se',
      dx: 30,
      dy: 20,
      containerWidth: 200,
      containerHeight: 200,
      ratio: 'free',
    })
    expect(next.x).toBe(10)
    expect(next.y).toBe(10)
    expect(next.width).toBe(110)
    expect(next.height).toBe(100)
  })

  it('nw 拖动时对角固定且不出容器', () => {
    const box = { x: 50, y: 50, width: 80, height: 80 }
    const next = resizeCropBox({
      box,
      anchor: 'nw',
      dx: -100,
      dy: -100,
      containerWidth: 200,
      containerHeight: 200,
      ratio: 'free',
    })
    // 固定角 (130,130) 不动，选框被钳制在容器内。
    expect(next.x).toBe(0)
    expect(next.y).toBe(0)
    expect(next.x + next.width).toBe(130)
    expect(next.y + next.height).toBe(130)
  })

  it('1:1 模式下缩放保持正方形', () => {
    const box = { x: 0, y: 0, width: 100, height: 100 }
    const next = resizeCropBox({
      box,
      anchor: 'se',
      dx: 50,
      dy: 0,
      containerWidth: 300,
      containerHeight: 300,
      ratio: '1:1',
    })
    expect(next.width).toBe(150)
    expect(next.height).toBe(150)
  })
})

describe('initialCropBox', () => {
  it('自由比例居中占 80%', () => {
    expect(initialCropBox(200, 100, 'free')).toEqual({
      x: 20,
      y: 10,
      width: 160,
      height: 80,
    })
  })

  it('16:9 居中且不超出高度', () => {
    const box = initialCropBox(200, 80, '16:9')
    expect(box.height).toBeCloseTo(64)
    expect(box.width).toBeCloseTo(64 / (9 / 16))
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.y).toBeGreaterThanOrEqual(0)
  })
})

describe('computeCropRect', () => {
  it('按显示/原图比例映射源矩形并取整', () => {
    const rect = computeCropRect({
      box: { x: 10, y: 20, width: 50, height: 30 },
      displayWidth: 100,
      displayHeight: 100,
      imageWidth: 1000,
      imageHeight: 1000,
    })
    expect(rect).toEqual({ sx: 100, sy: 200, sw: 500, sh: 300 })
  })

  it('零尺寸输入不产生除零', () => {
    const rect = computeCropRect({
      box: { x: 0, y: 0, width: 10, height: 10 },
      displayWidth: 0,
      displayHeight: 0,
      imageWidth: 0,
      imageHeight: 0,
    })
    expect(rect.sw).toBeGreaterThan(0)
    expect(rect.sh).toBeGreaterThan(0)
  })
})

describe('fitDisplayedSize', () => {
  it('等比缩小到最大舞台内', () => {
    expect(fitDisplayedSize(2000, 1000, 800, 500)).toEqual({ width: 800, height: 400 })
    expect(fitDisplayedSize(1000, 2000, 800, 500)).toEqual({ width: 250, height: 500 })
  })

  it('小于舞台时保持原尺寸', () => {
    expect(fitDisplayedSize(400, 300, 800, 500)).toEqual({ width: 400, height: 300 })
  })

  it('非法尺寸返回 1x1', () => {
    expect(fitDisplayedSize(0, 0, 800, 500)).toEqual({ width: 1, height: 1 })
  })
})
