/**
 * 内置壁纸与渐变预设（设计文档 2.1.5）。
 * 渐变离线可用；内置照片为精选在线图，加载失败时由壁纸层回退到默认渐变。
 */

const IMAGE_API = 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image'

function builtinImageUrl(prompt: string): string {
  return `${IMAGE_API}?prompt=${encodeURIComponent(prompt)}&image_size=landscape_16_9`
}

export type GradientPreset = {
  id: string
  name: string
  /** 可直接用于 CSS background-image 的渐变值。 */
  value: string
}

export type BuiltinImagePreset = {
  id: string
  name: string
  url: string
}

export const GRADIENT_PRESETS: GradientPreset[] = [
  {
    id: 'gradient-dusk',
    name: '暮色蓝金',
    value: 'linear-gradient(140deg, #0b1020 0%, #2563eb 48%, #f59e0b 100%)',
  },
  {
    id: 'gradient-aurora',
    name: '极光夜',
    value: 'linear-gradient(135deg, #020617 0%, #0f766e 55%, #312e81 100%)',
  },
  {
    id: 'gradient-ember',
    name: '余烬',
    value: 'linear-gradient(135deg, #1c0a14 0%, #9f1239 55%, #f97316 100%)',
  },
  {
    id: 'gradient-forest',
    name: '深林雾',
    value: 'linear-gradient(135deg, #052e16 0%, #166534 50%, #0e7490 100%)',
  },
]

export const BUILTIN_IMAGE_PRESETS: BuiltinImagePreset[] = [
  {
    id: 'builtin-mountain-lake',
    name: '山湖清晨',
    url: builtinImageUrl(
      'serene alpine lake at dawn, misty mountains reflection, soft golden light, cinematic landscape photography, high detail',
    ),
  },
  {
    id: 'builtin-starry-night',
    name: '星夜旷野',
    url: builtinImageUrl(
      'milky way over dark quiet grassland at night, deep blue starry sky, cinematic astrophotography landscape',
    ),
  },
]

export const DEFAULT_WALLPAPER = GRADIENT_PRESETS[0]

/** 按 id 查找渐变预设。 */
export function findGradientPreset(id: string): GradientPreset | undefined {
  return GRADIENT_PRESETS.find((preset) => preset.id === id || preset.value === id)
}

/** 按 id 查找内置图片预设。 */
export function findBuiltinImage(id: string): BuiltinImagePreset | undefined {
  return BUILTIN_IMAGE_PRESETS.find((preset) => preset.id === id)
}
