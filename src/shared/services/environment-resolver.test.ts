import { describe, expect, it } from 'vitest'
import {
  extractTemplateVariables,
  isValidVariableName,
  resolveShortcutUrl,
  validateUrlTemplate,
} from './environment-resolver'

describe('isValidVariableName', () => {
  it.each([
    ['baseUrl', true],
    ['_private', true],
    ['host_2', true],
    ['A1_b', true],
    ['2host', false],
    ['host-name', false],
    ['host name', false],
    ['', false],
  ])('%s -> %s', (name, expected) => {
    expect(isValidVariableName(name)).toBe(expected)
  })
})

describe('extractTemplateVariables', () => {
  it('按出现顺序提取去重后的变量名，容忍占位符内空白', () => {
    expect(extractTemplateVariables('{{host}}/{{ host }}/{{port}}/x')).toEqual(['host', 'port'])
  })

  it('忽略非法变量名片段', () => {
    expect(extractTemplateVariables('{{1bad}}/ok')).toEqual([])
  })
})

describe('resolveShortcutUrl', () => {
  it('用环境变量替换占位符并返回完整 URL', () => {
    const result = resolveShortcutUrl('{{baseUrl}}/admin?id=1', {
      baseUrl: 'http://192.168.1.10:8080',
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data).toBe('http://192.168.1.10:8080/admin?id=1')
    }
  })

  it('支持多个变量并 trim 模板首尾空白', () => {
    const result = resolveShortcutUrl('  {{scheme}}://{{host}}:{{port}}/ ', {
      scheme: 'https',
      host: 'nas.local',
      port: '5001',
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data).toBe('https://nas.local:5001/')
    }
  })

  it('不含变量的普通地址直接通过', () => {
    const result = resolveShortcutUrl('https://example.com', {})
    expect(result.ok).toBe(true)
  })

  it('空模板返回 TEMPLATE_EMPTY', () => {
    const result = resolveShortcutUrl('   ', {})
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('TEMPLATE_EMPTY')
  })

  it('缺少变量返回 VARIABLE_MISSING 并指出变量名', () => {
    const result = resolveShortcutUrl('{{baseUrl}}/x', {})
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('VARIABLE_MISSING')
      expect(result.error.cause).toMatchObject({ variable: 'baseUrl' })
    }
  })

  it('变量值为空白同样视为缺失', () => {
    const result = resolveShortcutUrl('{{baseUrl}}/x', { baseUrl: '   ' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('VARIABLE_MISSING')
  })

  it('替换后不是合法 URL 返回 URL_INVALID', () => {
    const result = resolveShortcutUrl('{{baseUrl}}/admin', { baseUrl: 'not a host' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('URL_INVALID')
  })

  it('拒绝 http/https 之外的协议', () => {
    const result = resolveShortcutUrl('javascript:alert(1)', {})
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('PROTOCOL_UNSUPPORTED')
  })

  it('拒绝以变量注入的非 http 协议', () => {
    const result = resolveShortcutUrl('{{u}}', { u: 'file:///etc/passwd' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('PROTOCOL_UNSUPPORTED')
  })
})

describe('validateUrlTemplate', () => {
  it('合法模板通过', () => {
    expect(validateUrlTemplate('{{baseUrl}}/admin').ok).toBe(true)
    expect(validateUrlTemplate('https://example.com').ok).toBe(true)
  })

  it('空模板不通过', () => {
    const result = validateUrlTemplate('')
    expect(result.ok).toBe(false)
  })

  it('非法占位符导致整体 URL 非法时不通过', () => {
    expect(validateUrlTemplate('{{bad name}}/x').ok).toBe(false)
  })

  it('禁止非 http(s) 协议', () => {
    expect(validateUrlTemplate('ftp://files.local').ok).toBe(false)
  })
})
