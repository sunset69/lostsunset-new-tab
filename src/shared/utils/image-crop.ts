/**
 * 裁剪几何计算（0001 改善项设计 2.1）。
 * 纯函数：坐标全部基于「显示尺寸」平面，输出映射到原图像素；
 * Canvas 绘制由弹层组件完成，便于单测与浏览器手动验证分工。
 */

export type CropRatio = 'free' | '1:1' | '16:9'

/** 选框，坐标为相对显示图像左上角的 CSS 像素。 */
export type CropBox = { x: number; y: number; width: number; height: number }

/** 拖拽手柄：nw/ne/sw/se 表示被拖动的角，对角固定。 */
export type CropAnchor = 'nw' | 'ne' | 'sw' | 'se'

/** 固定比例下 高/宽 因子。 */
export const RATIO_FACTORS: Record<Exclude<CropRatio, 'free'>, number> = {
  '1:1': 1,
  '16:9': 9 / 16,
}

/** 选框最小边长（显示像素），避免拖成不可见。 */
export const MIN_CROP_SIZE = 24

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/** 把选框钳制回容器内并应用最小尺寸/比例约束。 */
export function normalizeCropBox(
  box: CropBox,
  containerWidth: number,
  containerHeight: number,
  ratio: CropRatio,
): CropBox {
  let width = clamp(box.width, MIN_CROP_SIZE, containerWidth)
  let height =
    ratio === 'free'
      ? clamp(box.height, MIN_CROP_SIZE, containerHeight)
      : width * RATIO_FACTORS[ratio]

  if (height > containerHeight) {
    height = containerHeight
    if (ratio !== 'free') {
      width = height / RATIO_FACTORS[ratio]
    }
  }

  return {
    x: clamp(box.x, 0, containerWidth - width),
    y: clamp(box.y, 0, containerHeight - height),
    width,
    height,
  }
}

/** 整体移动选框，保持在容器内。 */
export function moveCropBox(
  box: CropBox,
  dx: number,
  dy: number,
  containerWidth: number,
  containerHeight: number,
): CropBox {
  return {
    ...box,
    x: clamp(box.x + dx, 0, containerWidth - box.width),
    y: clamp(box.y + dy, 0, containerHeight - box.height),
  }
}

/**
 * 角部缩放：anchor 为被拖动的角、对角固定；比例模式下高度随宽度推导。
 * 尺寸始终不超过「固定角到容器边界」的距离，因此固定角保持不动。
 */
export function resizeCropBox(params: {
  box: CropBox
  anchor: CropAnchor
  dx: number
  dy: number
  containerWidth: number
  containerHeight: number
  ratio: CropRatio
}): CropBox {
  const { box, anchor, dx, dy, containerWidth, containerHeight, ratio } = params
  const movesLeft = anchor === 'nw' || anchor === 'sw'
  const movesTop = anchor === 'nw' || anchor === 'ne'

  const fixedX = movesLeft ? box.x + box.width : box.x
  const fixedY = movesTop ? box.y + box.height : box.y
  const movedX = movesLeft ? box.x + dx : box.x + box.width + dx
  const movedY = movesTop ? box.y + dy : box.y + box.height + dy

  const proposedWidth = Math.abs(movedX - fixedX)
  const proposedHeight = Math.abs(movedY - fixedY)

  // 固定角必须留在容器内：宽不超过 fixedX（固定角在右）或 containerWidth-fixedX（固定角在左）。
  const maxWidth = movesLeft ? fixedX : containerWidth - fixedX
  const maxHeight = movesTop ? fixedY : containerHeight - fixedY

  let width = clamp(proposedWidth, MIN_CROP_SIZE, Math.max(MIN_CROP_SIZE, maxWidth))
  let height =
    ratio === 'free'
      ? clamp(proposedHeight, MIN_CROP_SIZE, Math.max(MIN_CROP_SIZE, maxHeight))
      : width * RATIO_FACTORS[ratio]

  if (ratio !== 'free') {
    const factor = RATIO_FACTORS[ratio]
    width = Math.min(width, maxWidth, maxHeight / factor)
    width = Math.max(width, Math.min(MIN_CROP_SIZE, maxWidth))
    height = width * factor
  } else {
    height = Math.min(height, Math.max(MIN_CROP_SIZE, maxHeight))
  }

  return {
    x: movesLeft ? fixedX - width : fixedX,
    y: movesTop ? fixedY - height : fixedY,
    width,
    height,
  }
}

/** 生成初始选框：居中、占容器 80%，比例模式下按比例适配。 */
export function initialCropBox(
  containerWidth: number,
  containerHeight: number,
  ratio: CropRatio,
): CropBox {
  if (ratio === 'free') {
    return {
      x: containerWidth * 0.1,
      y: containerHeight * 0.1,
      width: containerWidth * 0.8,
      height: containerHeight * 0.8,
    }
  }
  const factor = RATIO_FACTORS[ratio]
  let width = containerWidth * 0.8
  let height = width * factor
  if (height > containerHeight * 0.8) {
    height = containerHeight * 0.8
    width = height / factor
  }
  return {
    x: (containerWidth - width) / 2,
    y: (containerHeight - height) / 2,
    width,
    height,
  }
}

/** 显示尺寸 → 原图像素的源矩形（drawImage 参数 sx/sy/sw/sh）。 */
export function computeCropRect(params: {
  box: CropBox
  displayWidth: number
  displayHeight: number
  imageWidth: number
  imageHeight: number
}): { sx: number; sy: number; sw: number; sh: number } {
  const { box, displayWidth, displayHeight, imageWidth, imageHeight } = params
  const scaleX = displayWidth > 0 ? imageWidth / displayWidth : 1
  const scaleY = displayHeight > 0 ? imageHeight / displayHeight : 1
  return {
    sx: Math.round(box.x * scaleX),
    sy: Math.round(box.y * scaleY),
    sw: Math.max(1, Math.round(box.width * scaleX)),
    sh: Math.max(1, Math.round(box.height * scaleY)),
  }
}

/** 图片在最大舞台内的等比显示尺寸（不超过原图，避免放大模糊）。 */
export function fitDisplayedSize(
  imageWidth: number,
  imageHeight: number,
  maxWidth: number,
  maxHeight: number,
): { width: number; height: number } {
  if (imageWidth <= 0 || imageHeight <= 0) {
    return { width: 1, height: 1 }
  }
  const scale = Math.min(maxWidth / imageWidth, maxHeight / imageHeight, 1)
  return {
    width: Math.max(1, Math.round(imageWidth * scale)),
    height: Math.max(1, Math.round(imageHeight * scale)),
  }
}
