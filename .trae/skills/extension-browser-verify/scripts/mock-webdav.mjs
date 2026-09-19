#!/usr/bin/env node
/**
 * 本地 WebDAV mock，供扩展页面浏览器验证使用。
 * 用法：node scripts/mock-webdav.mjs [port=8899] [user=test] [pass=test]
 *
 * 行为：
 * - CORS：允许 http://localhost:5173 与 http://localhost:4174（dev / preview）
 * - Basic Auth：凭据不匹配返回 401 + WWW-Authenticate
 * - HEAD 根路径 / 与 /dav/ 恒 200；其他路径按是否已 PUT 过返回 200/404
 * - GET 已存文件返回内容，否则 404；PUT 存内存并返回 201；OPTIONS 204
 * 所有请求打印 METHOD URL -> STATUS，便于核对客户端实际拼出的地址。
 */
import http from 'node:http'

const [portArg, username = 'test', password = 'test'] = process.argv.slice(2)
const PORT = Number(portArg || 8899)

const files = new Map()
const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:4174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:4174',
]

function applyCors(req, res) {
  const origin = req.headers.origin
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, HEAD, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type')
  res.setHeader('Access-Control-Max-Age', '86400')
}

const expectedAuth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`

const server = http.createServer((req, res) => {
  applyCors(req, res)
  if (req.method === 'OPTIONS') {
    res.writeHead(204).end()
    return
  }

  if (req.headers.authorization !== expectedAuth) {
    res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="mock-webdav"' })
    res.end('unauthorized')
    console.log(`${req.method} ${req.url} -> 401`)
    return
  }

  const key = new URL(req.url ?? '/', 'http://x').pathname

  if (req.method === 'HEAD') {
    const status = files.has(key) || key === '/' || key === '/dav/' ? 200 : 404
    res.writeHead(status).end()
    console.log(`HEAD ${key} -> ${status}`)
    return
  }

  if (req.method === 'GET') {
    if (!files.has(key)) {
      res.writeHead(404).end('not found')
      console.log(`GET ${key} -> 404`)
      return
    }
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(files.get(key))
    console.log(`GET ${key} -> 200 (${files.get(key).length}b)`)
    return
  }

  if (req.method === 'PUT') {
    let body = ''
    req.on('data', (chunk) => (body += chunk))
    req.on('end', () => {
      files.set(key, body)
      res.writeHead(201).end('created')
      console.log(`PUT ${key} -> 201 (${body.length}b)`)
    })
    return
  }

  res.writeHead(405).end()
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`mock webdav on http://127.0.0.1:${PORT} (user=${username})`)
})
