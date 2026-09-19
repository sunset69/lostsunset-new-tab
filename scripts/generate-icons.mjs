#!/usr/bin/env node
/**
 * 依据 public/newtab.svg 的设计零依赖生成扩展 PNG 图标（16/32/48/128）。
 * 设计：深蓝圆角底 (#0b1020) + 金蓝渐变圆 (#fbbf24 -> #2563eb) + 白色地平线。
 * 采用 4x 超采样后盒式滤波缩小，保证小尺寸边缘平滑。
 * 用法：node scripts/generate-icons.mjs
 */
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// SVG 设计空间为 64x64，下面所有几何常量均处于该坐标系。
const DESIGN = 64
const SCALE = 4 // 超采样倍数

const BG = { r: 0x0b, g: 0x10, b: 0x20, a: 255 }
const GOLD = [0xfb, 0xbf, 0x24]
const BLUE = [0x25, 0x63, 0xeb]
const LINE = { r: 255, g: 255, b: 255, a: 217 } // 0.85 不透明度

/** 点是否位于圆角矩形内。 */
function insideRoundedRect(x, y, rx, ry, w, h, r) {
  if (x < rx || x > rx + w || y < ry || y > ry + h) return false
  const cx = Math.min(Math.max(x, rx + r), rx + w - r)
  const cy = Math.min(Math.max(y, ry + r), ry + h - r)
  const dx = x - cx
  const dy = y - cy
  return dx * dx + dy * dy <= r * r
}

function lerp(a, b, t) {
  return Math.round(a + (b - a) * t)
}

/** 在 64x64 设计坐标系某点合成颜色（预乘 alpha）。 */
function sampleDesign(x, y) {
  let color = { r: 0, g: 0, b: 0, a: 0 }

  // 底板
  if (insideRoundedRect(x, y, 0, 0, DESIGN, DESIGN, 14)) {
    color = { ...BG }
  }

  // 渐变圆
  const dx = x - 32
  const dy = y - 30
  if (dx * dx + dy * dy <= 14 * 14) {
    const t = Math.min(1, Math.max(0, (y - (30 - 14)) / 28))
    color = {
      r: lerp(GOLD[0], BLUE[0], t),
      g: lerp(GOLD[1], BLUE[1], t),
      b: lerp(GOLD[2], BLUE[2], t),
      a: 255,
    }
  }

  // 白色地平线
  if (insideRoundedRect(x, y, 14, 46, 36, 4, 2)) {
    color = {
      r: (LINE.r * LINE.a + color.r * color.a * (1 - LINE.a / 255)) / 255,
      g: (LINE.g * LINE.a + color.g * color.a * (1 - LINE.a / 255)) / 255,
      b: (LINE.b * LINE.a + color.b * color.a * (1 - LINE.a / 255)) / 255,
      a: LINE.a + (color.a * (255 - LINE.a)) / 255,
    }
  }

  return color
}

/** 超采样渲染单个尺寸，返回 RGBA。小尺寸用 2x 避免过度发虚。 */
function render(size, supersample = size <= 32 ? 2 : SCALE) {
  const pixels = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      for (let my = 0; my < supersample; my++) {
        for (let mx = 0; mx < supersample; mx++) {
          // 主采样点中心 -> 设计坐标
          const dxFinal = (x + (mx + 0.5) / supersample) * (DESIGN / size)
          const dyFinal = (y + (my + 0.5) / supersample) * (DESIGN / size)
          const c = sampleDesign(dxFinal, dyFinal)
          r += c.r
          g += c.g
          b += c.b
          a += c.a
        }
      }
      const samples = supersample ** 2
      const i = (y * size + x) * 4
      pixels[i] = Math.round(r / samples)
      pixels[i + 1] = Math.round(g / samples)
      pixels[i + 2] = Math.round(b / samples)
      pixels[i + 3] = Math.round(a / samples)
    }
  }
  return pixels
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[n] = c >>> 0
  }
  return table
})()

function crc32(buf) {
  let c = 0xffffffff
  for (const byte of buf) {
    c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  }
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii')
  const lenBuf = Buffer.alloc(4)
  lenBuf.writeUInt32BE(data.length)
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])))
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf])
}

function encodePng(size, rgba) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  // 每行前置 filter 0。
  const stride = size * 4
  const raw = Buffer.alloc((stride + 1) * size)
  for (let y = 0; y < size; y++) {
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }
  const idat = deflateSync(raw, { level: 9 })
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons')
mkdirSync(outDir, { recursive: true })
for (const size of [16, 32, 48, 128]) {
  const png = encodePng(size, Buffer.from(render(size)))
  const target = join(outDir, `icon-${size}.png`)
  writeFileSync(target, png)
  console.log(`generated ${target} (${png.length} bytes)`)
}
