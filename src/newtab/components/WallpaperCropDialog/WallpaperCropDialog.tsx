import { useCallback, useEffect, useRef, useState } from 'react'
import { MAX_WALLPAPER_SIZE } from '../../../shared/services/wallpaper-service'
import type { WallpaperImageInput } from '../../../shared/services/wallpaper-service'
import {
  type CropAnchor,
  type CropBox,
  type CropRatio,
  computeCropRect,
  fitDisplayedSize,
  initialCropBox,
  moveCropBox,
  resizeCropBox,
} from '../../../shared/utils/image-crop'
import './WallpaperCropDialog.css'

export type WallpaperCropDialogProps = {
  file: File
  /** 确认裁剪：携带裁剪产物（blob 已通过 10MB 校验）。 */
  onConfirm: (input: WallpaperImageInput) => void
  onCancel: () => void
}

const STAGE_MAX_WIDTH = 640
const STAGE_MAX_HEIGHT = 360
const PREVIEW_WIDTH = 128
const PREVIEW_HEIGHT = 72

const RATIOS: Array<{ value: CropRatio; label: string }> = [
  { value: 'free', label: '自由' },
  { value: '1:1', label: '1:1' },
  { value: '16:9', label: '16:9' },
]

const ANCHORS: CropAnchor[] = ['nw', 'ne', 'sw', 'se']

/** 本地壁纸裁剪弹层（0001 改善 1）：拖拽/角部缩放选框，比例快捷键与实时预览。 */
export default function WallpaperCropDialog({ file, onConfirm, onCancel }: WallpaperCropDialogProps) {
  const imageUrlRef = useRef<string>('')
  const imageRef = useRef<HTMLImageElement | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 })
  const [box, setBox] = useState<CropBox | null>(null)
  const [ratio, setRatio] = useState<CropRatio>('free')
  const [error, setError] = useState<string | null>(null)
  const [working, setWorking] = useState(false)
  const confirmButtonRef = useRef<HTMLButtonElement>(null)
  const previewCanvasRef = useRef<HTMLCanvasElement>(null)

  // 载入图片并初始化选框。
  useEffect(() => {
    const url = URL.createObjectURL(file)
    imageUrlRef.current = url
    const image = new Image()
    imageRef.current = image
    image.onload = () => {
      const size = fitDisplayedSize(image.naturalWidth, image.naturalHeight, STAGE_MAX_WIDTH, STAGE_MAX_HEIGHT)
      setDisplaySize(size)
      setBox(initialCropBox(size.width, size.height, 'free'))
      setLoaded(true)
    }
    image.onerror = () => setError('图片读取失败，请重新选择')
    image.src = url
    return () => URL.revokeObjectURL(url)
  }, [file])

  // 实时预览。
  useEffect(() => {
    const canvas = previewCanvasRef.current
    const image = imageRef.current
    if (!loaded || !canvas || !image || !box || displaySize.width === 0) return
    const context = canvas.getContext('2d')
    if (!context) return
    const rect = computeCropRect({
      box,
      displayWidth: displaySize.width,
      displayHeight: displaySize.height,
      imageWidth: image.naturalWidth,
      imageHeight: image.naturalHeight,
    })
    context.clearRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, rect.sx, rect.sy, rect.sw, rect.sh, 0, 0, canvas.width, canvas.height)
  }, [box, displaySize, loaded])

  useEffect(() => {
    confirmButtonRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCancel()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onCancel])

  // 指针拖拽：移动 / 角部缩放。
  const startDrag = useCallback(
    (anchor: CropAnchor | 'move') => (event: React.PointerEvent) => {
      if (!box) return
      event.preventDefault()
      const startX = event.clientX
      const startY = event.clientY
      const startBox = box

      const onMove = (moveEvent: PointerEvent) => {
        const dx = moveEvent.clientX - startX
        const dy = moveEvent.clientY - startY
        setBox(
          anchor === 'move'
            ? moveCropBox(startBox, dx, dy, displaySize.width, displaySize.height)
            : resizeCropBox({
                box: startBox,
                anchor,
                dx,
                dy,
                containerWidth: displaySize.width,
                containerHeight: displaySize.height,
                ratio,
              }),
        )
      }
      const onUp = () => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [box, displaySize, ratio],
  )

  function chooseRatio(next: CropRatio) {
    setRatio(next)
    if (!box || displaySize.width === 0 || next === 'free') return
    // 切换比例：保持选框中心，按新比例重建并钳制在舞台内。
    const factor = next === '1:1' ? 1 : 9 / 16
    let width = box.width
    let height = width * factor
    if (height > displaySize.height) {
      height = displaySize.height
      width = height / factor
    }
    if (width > displaySize.width) {
      width = displaySize.width
      height = width * factor
    }
    const centerX = box.x + box.width / 2
    const centerY = box.y + box.height / 2
    setBox({
      x: Math.min(Math.max(0, centerX - width / 2), displaySize.width - width),
      y: Math.min(Math.max(0, centerY - height / 2), displaySize.height - height),
      width,
      height,
    })
  }

  async function handleConfirm() {
    const image = imageRef.current
    if (!image || !box || working) return
    const rect = computeCropRect({
      box,
      displayWidth: displaySize.width,
      displayHeight: displaySize.height,
      imageWidth: image.naturalWidth,
      imageHeight: image.naturalHeight,
    })

    setWorking(true)
    setError(null)
    try {
      const blob = await cropToBlob(image, rect, file.type)
      if (!blob) {
        setError('裁剪失败，请重试')
        return
      }
      if (blob.size > MAX_WALLPAPER_SIZE) {
        setError('裁剪结果超过 10 MB，请缩小选区后重试')
        return
      }
      onConfirm({
        blob,
        mimeType: blob.type,
        name: file.name,
        width: rect.sw,
        height: rect.sh,
      })
    } finally {
      setWorking(false)
    }
  }

  return (
    <div className="crop-backdrop" onClick={onCancel}>
      <div
        className="crop-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="crop-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="crop-dialog__title" id="crop-dialog-title">
          裁剪壁纸
        </h2>

        <div className="crop-dialog__stage-wrap">
          <div
            className="crop-dialog__stage"
            style={{ width: displaySize.width, height: displaySize.height }}
          >
            <img className="crop-dialog__image" src={imageUrlRef.current || undefined} alt="" draggable={false} />
            {box && (
              <div
                className="crop-dialog__box"
                style={{ left: box.x, top: box.y, width: box.width, height: box.height }}
                onPointerDown={startDrag('move')}
                data-testid="crop-box"
              >
                {ANCHORS.map((anchor) => (
                  <span
                    key={anchor}
                    className={`crop-dialog__handle crop-dialog__handle--${anchor}`}
                    data-testid={`crop-handle-${anchor}`}
                    onPointerDown={startDrag(anchor)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="crop-dialog__toolbar">
          <div className="crop-dialog__ratios" role="radiogroup" aria-label="裁剪比例">
            {RATIOS.map((item) => (
              <button
                key={item.value}
                type="button"
                role="radio"
                aria-checked={ratio === item.value}
                className={`crop-dialog__ratio${ratio === item.value ? ' crop-dialog__ratio--active' : ''}`}
                onClick={() => chooseRatio(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="crop-dialog__preview-wrap">
            <span className="crop-dialog__preview-label">预览</span>
            <canvas
              ref={previewCanvasRef}
              className="crop-dialog__preview"
              width={PREVIEW_WIDTH}
              height={PREVIEW_HEIGHT}
              aria-hidden="true"
            />
          </div>
        </div>

        {error && (
          <p className="crop-dialog__error" role="alert">
            {error}
          </p>
        )}

        <div className="crop-dialog__actions">
          <button type="button" className="btn" onClick={onCancel}>
            取消
          </button>
          <button
            ref={confirmButtonRef}
            type="button"
            className="btn btn--primary"
            disabled={!loaded || working || box === null}
            onClick={() => void handleConfirm()}
          >
            {working ? '正在裁剪…' : '确认裁剪'}
          </button>
        </div>
      </div>
    </div>
  )
}

/** Canvas 裁剪输出：优先保持原格式，编码失败时回退 PNG。 */
function cropToBlob(
  image: HTMLImageElement,
  rect: { sx: number; sy: number; sw: number; sh: number },
  preferredMime: string,
): Promise<Blob | null> {
  const canvas = document.createElement('canvas')
  canvas.width = rect.sw
  canvas.height = rect.sh
  const context = canvas.getContext('2d')
  if (!context) return Promise.resolve(null)
  context.drawImage(image, rect.sx, rect.sy, rect.sw, rect.sh, 0, 0, rect.sw, rect.sh)

  const mime = ['image/png', 'image/jpeg', 'image/webp'].includes(preferredMime) ? preferredMime : 'image/png'
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        if (blob && blob.type === mime) {
          resolve(blob)
          return
        }
        // 部分环境不支持目标格式时回退 PNG。
        canvas.toBlob((pngBlob) => resolve(pngBlob), 'image/png')
      },
      mime,
      0.92,
    )
  })
}
