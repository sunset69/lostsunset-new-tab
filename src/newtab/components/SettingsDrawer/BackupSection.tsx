import { useEffect, useMemo, useRef, useState } from 'react'
import { useConfig } from '../../config/config-context'
import { browserStorage } from '../../../shared/storage/browser-storage'
import { downloadTextFile } from '../../../shared/utils/download'
import { ensureHostPermission, describeConnectionRisk } from '../../../shared/utils/permissions'
import type {
  AutoBackupReason,
  ConfigBackupFile,
  WebDavProfile,
} from '../../../shared/models/backup'
import type { WallpaperMode } from '../../../shared/models/config'
import type { AppError } from '../../../shared/utils/result'
import {
  BACKUP_ERROR_MESSAGES,
  backupFileName,
  createBackup,
  parseBackupText,
  saveLocalAutoBackup,
  summarizeBackup,
} from '../../../shared/services/backup-service'
import {
  createWebDavClient,
  validateWebDavProfile,
  webdavErrorMessage,
} from '../../../shared/services/webdav-client'
import { createBrowserExecutor } from '../../../shared/services/webdav-transport'
import {
  loadWebDavProfile,
  saveWebDavProfile,
} from '../../../shared/services/webdav-profile-store'

const WALLPAPER_MODE_LABELS: Record<WallpaperMode, string> = {
  gradient: '渐变背景',
  builtin: '内置壁纸',
  upload: '本地壁纸',
}

type WebDavForm = {
  baseUrl: string
  remotePath: string
  username: string
  credential: string
  rememberCredential: boolean
}

const EMPTY_FORM: WebDavForm = {
  baseUrl: '',
  remotePath: '',
  username: '',
  credential: '',
  rememberCredential: false,
}

type Status = { tone: 'success' | 'error'; text: string }

type PendingImport = {
  backup: ConfigBackupFile
  reason: AutoBackupReason
}

function describeError(error: AppError): string {
  return BACKUP_ERROR_MESSAGES[error.code] ?? webdavErrorMessage(error)
}

function formatTime(iso: string): string {
  const time = Date.parse(iso)
  return Number.isFinite(time) ? new Date(time).toLocaleString() : iso
}

/** 备份与 WebDAV（设计文档 2.1.6 / 6.5–6.8）。 */
export default function BackupSection() {
  const { config, commitConfig } = useConfig()
  const importInputRef = useRef<HTMLInputElement>(null)

  const client = useMemo(() => createWebDavClient(createBrowserExecutor()), [])

  const [form, setForm] = useState<WebDavForm>(EMPTY_FORM)
  const [localStatus, setLocalStatus] = useState<Status | null>(null)
  const [remoteStatus, setRemoteStatus] = useState<Status | null>(null)
  const [pending, setPending] = useState<PendingImport | null>(null)
  const [overwrite, setOverwrite] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void loadWebDavProfile(browserStorage).then((stored) => {
      if (cancelled || !stored) return
      setForm({
        baseUrl: stored.baseUrl,
        remotePath: stored.remotePath,
        username: stored.username,
        credential: stored.credential,
        rememberCredential: stored.rememberCredential,
      })
    })
    return () => {
      cancelled = true
    }
  }, [])

  function patchForm(patch: Partial<WebDavForm>) {
    setForm((current) => ({ ...current, ...patch }))
  }

  function handleExport() {
    const backup = createBackup(config!)
    downloadTextFile(backupFileName(), JSON.stringify(backup, null, 2))
    setLocalStatus({ tone: 'success', text: '已导出配置 JSON 文件。' })
  }

  async function handleImportFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setPending(null)
    const text = await file.text()
    const parsed = parseBackupText(text)
    if (!parsed.ok) {
      setLocalStatus({ tone: 'error', text: describeError(parsed.error) })
      return
    }
    setPending({ backup: parsed.data, reason: 'manual-import' })
  }

  async function confirmImport() {
    if (!pending) return
    setBusy('import')
    try {
      await saveLocalAutoBackup(browserStorage, config!, pending.reason)
      await commitConfig(pending.backup.config)
      const text =
        pending.reason === 'webdav-restore'
          ? '已从 WebDAV 恢复配置，恢复前的配置已自动备份。'
          : '配置导入成功，导入前的配置已自动备份。'
      setPending(null)
      setLocalStatus({ tone: 'success', text })
    } finally {
      setBusy(null)
    }
  }

  function validatedProfile(): WebDavProfile | null {
    const result = validateWebDavProfile(form)
    if (!result.ok) {
      setRemoteStatus({ tone: 'error', text: describeError(result.error) })
      return null
    }
    return result.data
  }

  async function withBusyAction(
    key: string,
    action: (profile: WebDavProfile) => Promise<void>,
  ): Promise<boolean> {
    const profile = validatedProfile()
    if (!profile) return false
    setBusy(key)
    try {
      await action(profile)
      return true
    } finally {
      setBusy(null)
    }
  }

  async function ensurePermission(profile: WebDavProfile): Promise<boolean> {
    const granted = await ensureHostPermission(profile.baseUrl)
    if (!granted.ok) {
      setRemoteStatus({ tone: 'error', text: describeError(granted.error) })
      return false
    }
    return true
  }

  async function handleTestConnection() {
    await withBusyAction('test', async (profile) => {
      if (!(await ensurePermission(profile))) return
      const result = await client.testConnection(profile)
      if (result.ok) {
        setRemoteStatus({ tone: 'success', text: '连接成功，WebDAV 服务可用。' })
      } else {
        setRemoteStatus({ tone: 'error', text: describeError(result.error) })
      }
    })
  }

  async function handleSaveProfile() {
    await withBusyAction('save', async (profile) => {
      if (!(await ensurePermission(profile))) return
      await saveWebDavProfile(browserStorage, profile)
      setRemoteStatus({
        tone: 'success',
        text: profile.rememberCredential ? 'WebDAV 配置已保存（含凭据）。' : 'WebDAV 配置已保存（未记住密码）。',
      })
    })
  }

  async function runUpload(profile: WebDavProfile) {
    const content = JSON.stringify(createBackup(config!))
    const result = await client.putBackupText(profile, content)
    if (!result.ok) {
      setRemoteStatus({ tone: 'error', text: describeError(result.error) })
      return
    }
    await saveWebDavProfile(browserStorage, profile)
    setOverwrite(null)
    setRemoteStatus({ tone: 'success', text: '备份已上传到 WebDAV。' })
  }

  async function handleUpload() {
    await withBusyAction('upload', async (profile) => {
      if (!(await ensurePermission(profile))) return
      if (overwrite === null) {
        const head = await client.headBackup(profile)
        if (!head.ok) {
          setRemoteStatus({ tone: 'error', text: describeError(head.error) })
          return
        }
        if (head.data.exists) {
          const time = head.data.lastModified ? formatTime(new Date(head.data.lastModified).toISOString()) : '未知时间'
          setOverwrite(time)
          setRemoteStatus({
            tone: 'error',
            text: `远端已存在备份（修改时间：${time}），上传会覆盖它。`,
          })
          return
        }
      }
      await runUpload(profile)
    })
  }

  async function handleRestore() {
    await withBusyAction('restore', async (profile) => {
      if (!(await ensurePermission(profile))) return
      const text = await client.getBackupText(profile)
      if (!text.ok) {
        setRemoteStatus({ tone: 'error', text: describeError(text.error) })
        return
      }
      const parsed = parseBackupText(text.data)
      if (!parsed.ok) {
        setRemoteStatus({
          tone: 'error',
          text: `远端文件无效：${describeError(parsed.error)}`,
        })
        return
      }
      setPending({ backup: parsed.data, reason: 'webdav-restore' })
      setRemoteStatus({ tone: 'success', text: '已获取远端备份，请在下方确认恢复内容。' })
    })
  }

  const httpWarning = form.baseUrl ? describeConnectionRisk({ baseUrl: form.baseUrl }) : null
  const summary = pending ? summarizeBackup(pending.backup) : null

  return (
    <div className="backup-settings">
      <div className="field">
        <span className="field__label">本地备份</span>
        <div className="backup-actions">
          <button type="button" className="btn btn--ghost" onClick={handleExport}>
            导出配置
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => importInputRef.current?.click()}
          >
            从 JSON 导入
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept=".json,application/json"
            className="visually-hidden"
            onChange={(event) => void handleImportFileChange(event)}
          />
        </div>
        <p className="field__help">
          导出仅包含结构化配置，不含 WebDAV 凭据和本地上传的壁纸图片；新设备导入后缺失的壁纸会回退默认背景。
        </p>
        {localStatus && (
          <p className={`backup-status backup-status--${localStatus.tone}`} role="status">
            {localStatus.text}
          </p>
        )}
      </div>

      {pending && summary && (
        <div className="backup-confirm" role="group" aria-label="导入确认">
          <p className="backup-confirm__title">
            {pending.reason === 'webdav-restore' ? '确认从 WebDAV 恢复以下备份？' : '确认导入以下备份？'}
          </p>
          <dl className="backup-confirm__list">
            <dt>备份时间</dt>
            <dd>{formatTime(summary.exportedAt)}</dd>
            <dt>导出版本</dt>
            <dd>{summary.appVersion}</dd>
            <dt>搜索引擎</dt>
            <dd>{summary.searchEngineName}</dd>
            <dt>环境</dt>
            <dd>{summary.environmentCount} 个</dd>
            <dt>快捷方式</dt>
            <dd>{summary.shortcutCount} 个（{summary.shortcutGroupCount} 个分组）</dd>
            <dt>壁纸</dt>
            <dd>{WALLPAPER_MODE_LABELS[summary.wallpaperMode]}</dd>
          </dl>
          <p className="field__help">
            确认后会先把当前配置自动备份到本地，再写入该配置；整个过程在页面本地完成。
          </p>
          <div className="backup-actions">
            <button
              type="button"
              className="btn btn--primary"
              disabled={busy === 'import'}
              onClick={() => void confirmImport()}
            >
              {busy === 'import' ? '正在导入…' : '确认导入'}
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              disabled={busy === 'import'}
              onClick={() => setPending(null)}
            >
              取消
            </button>
          </div>
        </div>
      )}

      <div className="field">
        <span className="field__label">WebDAV 同步（仅手动触发）</span>

        <label className="field__label backup-form-label" htmlFor="webdav-base">
          服务地址
        </label>
        <input
          id="webdav-base"
          type="text"
          className="field__input field__input--mono"
          placeholder="http://192.168.1.20:5244"
          value={form.baseUrl}
          onChange={(event) => {
            patchForm({ baseUrl: event.target.value })
            setOverwrite(null)
          }}
        />

        <label className="field__label backup-form-label" htmlFor="webdav-path">
          远端文件路径
        </label>
        <input
          id="webdav-path"
          type="text"
          className="field__input field__input--mono"
          placeholder="/backup/lostsunset.json"
          value={form.remotePath}
          onChange={(event) => {
            patchForm({ remotePath: event.target.value })
            setOverwrite(null)
          }}
        />

        <label className="field__label backup-form-label" htmlFor="webdav-user">
          用户名
        </label>
        <input
          id="webdav-user"
          type="text"
          className="field__input"
          autoComplete="username"
          value={form.username}
          onChange={(event) => patchForm({ username: event.target.value })}
        />

        <label className="field__label backup-form-label" htmlFor="webdav-credential">
          应用专用密码或密码
        </label>
        <input
          id="webdav-credential"
          type="password"
          className="field__input"
          autoComplete="current-password"
          value={form.credential}
          onChange={(event) => patchForm({ credential: event.target.value })}
        />

        <label className="backup-checkbox">
          <input
            type="checkbox"
            checked={form.rememberCredential}
            onChange={(event) => patchForm({ rememberCredential: event.target.checked })}
          />
          <span>在本机记住密码</span>
        </label>
        <p className="field__help">
          扩展本地存储不是加密保险箱，建议使用 WebDAV 应用专用密码；不勾选时密码仅本次页面有效。
        </p>
        {httpWarning && <p className="backup-status backup-status--error">{httpWarning}</p>}

        <div className="backup-actions">
          <button
            type="button"
            className="btn btn--ghost"
            disabled={busy !== null}
            onClick={() => void handleTestConnection()}
          >
            {busy === 'test' ? '正在测试…' : '测试连接'}
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            disabled={busy !== null}
            onClick={() => void handleSaveProfile()}
          >
            保存设置
          </button>
        </div>

        <div className="backup-actions backup-actions--spaced">
          {overwrite === null ? (
            <button
              type="button"
              className="btn btn--primary"
              disabled={busy !== null}
              onClick={() => void handleUpload()}
            >
              {busy === 'upload' ? '正在上传…' : '上传到 WebDAV'}
            </button>
          ) : (
            <>
              <button
                type="button"
                className="btn btn--danger"
                disabled={busy !== null}
                onClick={() => void withBusyAction('upload', runUpload)}
              >
                {busy === 'upload' ? '正在上传…' : '确认覆盖上传'}
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                disabled={busy !== null}
                onClick={() => setOverwrite(null)}
              >
                取消覆盖
              </button>
            </>
          )}
          <button
            type="button"
            className="btn btn--ghost"
            disabled={busy !== null}
            onClick={() => void handleRestore()}
          >
            {busy === 'restore' ? '正在读取…' : '从 WebDAV 恢复'}
          </button>
        </div>

        {remoteStatus && (
          <p className={`backup-status backup-status--${remoteStatus.tone}`} role="status">
            {remoteStatus.text}
          </p>
        )}
      </div>
    </div>
  )
}
