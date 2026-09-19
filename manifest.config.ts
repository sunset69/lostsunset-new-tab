import { defineManifest } from '@crxjs/vite-plugin'

// Manifest V3 配置，设计文档见 docs/superpowers/specs/2026-09-18-new-tab-extension-design.md
export default defineManifest({
  manifest_version: 3,
  name: 'LostSunset New Tab',
  version: '0.1.0',
  description: '沉浸式壁纸、快捷方式与内网环境地址管理的新标签页扩展。',
  icons: {
    16: 'icons/icon-16.png',
    32: 'icons/icon-32.png',
    48: 'icons/icon-48.png',
    128: 'icons/icon-128.png',
  },
  chrome_url_overrides: {
    newtab: 'src/newtab/index.html',
  },
  background: {
    service_worker: 'src/background/service-worker.ts',
    type: 'module',
  },
  permissions: ['storage', 'unlimitedStorage'],
  // 安装时不授予广域权限；配置 WebDAV 时按需请求具体源。
  optional_host_permissions: ['*://*/*'],
})
