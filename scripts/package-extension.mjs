#!/usr/bin/env node
/**
 * 将生产构建产物 dist/ 打成可直接上传 Chrome Web Store / Edge 加载的 ZIP。
 * 零依赖（store 压缩，商店与浏览器均接受），并在打包前校验：
 * - dist/manifest.json 存在且版本号与 package.json 一致；
 * - 不包含 .git、node_modules、环境变量文件、docs、系统垃圾文件；
 * - manifest 引用的图标文件齐备。
 * 产物：release/lostsunset-new-tab-v<version>.zip
 * 用法：npm run build && npm run package
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const distDir = join(root, 'dist')
const releaseDir = join(root, 'release')

const FORBIDDEN_PARTS = ['.git', 'node_modules', 'docs', '.DS_Store', 'Thumbs.db']
const FORBIDDEN_SUFFIXES = ['.env', '.pem', '.key', '.crt', '.zip', '.map']

function fail(message) {
  console.error(`打包失败：${message}`)
  process.exit(1)
}

function crc32(buf) {
  let table = crc32.table
  if (!table) {
    table = new Uint32Array(256)
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      table[n] = c >>> 0
    }
    crc32.table = table
  }
  let c = 0xffffffff
  for (const byte of buf) c = table[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/** 递归收集 dist 下全部文件，返回相对 POSIX 路径。 */
function collectFiles(dir, base = dir) {
  const files = []
  for (const entry of readdirSync(dir)) {
    const absolute = join(dir, entry)
    const rel = relative(base, absolute).split(sep).join('/')
    if (statSync(absolute).isDirectory()) {
      files.push(...collectFiles(absolute, base))
    } else {
      files.push({ absolute, rel })
    }
  }
  return files
}

/** 以 ZIP store（method=0）方式打包，条目名使用 POSIX 斜杠。 */
function buildZip(entries) {
  const localParts = []
  const centralParts = []
  const offsets = []
  let localLength = 0
  const now = new Date()
  const dosTime =
    ((now.getHours() & 0x1f) << 11) |
    ((now.getMinutes() & 0x3f) << 5) |
    (Math.floor(now.getSeconds() / 2) & 0x1f)
  const dosDate =
    (((now.getFullYear() - 1980) & 0x7f) << 9) |
    (((now.getMonth() + 1) & 0x0f) << 5) |
    (now.getDate() & 0x1f)

  for (const { name, data } of entries) {
    const nameBuf = Buffer.from(name, 'utf8')
    const checksum = crc32(data)

    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4) // 需要版本 2.0
    local.writeUInt16LE(0x0800, 6) // 标志：UTF-8 文件名
    local.writeUInt16LE(0, 8) // method=store
    local.writeUInt16LE(dosTime, 10)
    local.writeUInt16LE(dosDate, 12)
    local.writeUInt32LE(checksum, 14)
    local.writeUInt32LE(data.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(nameBuf.length, 26)
    local.writeUInt16LE(0, 28)

    offsets.push(localLength)
    localParts.push(local, nameBuf, data)
    localLength += local.length + nameBuf.length + data.length

    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(0x0800, 8)
    central.writeUInt16LE(0, 10)
    central.writeUInt16LE(dosTime, 12)
    central.writeUInt16LE(dosDate, 14)
    central.writeUInt32LE(checksum, 16)
    central.writeUInt32LE(data.length, 20)
    central.writeUInt32LE(data.length, 24)
    central.writeUInt16LE(nameBuf.length, 28)
    central.writeUInt32LE(offsets[offsets.length - 1], 42) // 本地头偏移
    centralParts.push(central, nameBuf)
  }

  const centralBuf = Buffer.concat(centralParts)

  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(entries.length, 8)
  eocd.writeUInt16LE(entries.length, 10)
  eocd.writeUInt32LE(centralBuf.length, 12)
  eocd.writeUInt32LE(localLength, 16)

  return Buffer.concat([...localParts, centralBuf, eocd])
}

if (!existsSync(distDir)) {
  fail('未找到 dist/，请先执行 npm run build')
}
const manifestPath = join(distDir, 'manifest.json')
if (!existsSync(manifestPath)) {
  fail('dist/manifest.json 缺失，请先执行 npm run build')
}

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
if (manifest.version !== pkg.version) {
  fail(`manifest 版本 ${manifest.version} 与 package.json 版本 ${pkg.version} 不一致`)
}

const allFiles = collectFiles(distDir)
for (const { rel } of allFiles) {
  const parts = rel.split('/')
  const base = parts[parts.length - 1]
  if (parts.some((p) => FORBIDDEN_PARTS.includes(p))) {
    fail(`产物包含禁止内容：${rel}`)
  }
  if (FORBIDDEN_SUFFIXES.some((s) => base.endsWith(s))) {
    fail(`产物包含禁止文件类型：${rel}`)
  }
}

for (const icon of Object.values(manifest.icons ?? {})) {
  if (!existsSync(join(distDir, icon))) {
    fail(`manifest 引用的图标不存在：${icon}`)
  }
}

const entries = allFiles.map(({ absolute, rel }) => ({
  name: rel,
  data: readFileSync(absolute),
}))
const zip = buildZip(entries)

mkdirSync(releaseDir, { recursive: true })
const target = join(releaseDir, `lostsunset-new-tab-v${pkg.version}.zip`)
rmSync(target, { force: true })
writeFileSync(target, zip)

console.log(`已打包 ${target}`)
console.log(`共 ${entries.length} 个文件，${(zip.length / 1024).toFixed(1)} KB`)
for (const { name } of entries) console.log(`  ${name}`)
