# 浏览器起始页插件项目开发文档

- 日期：2026-09-18
- 项目名称：lostsunset-new-tab
- 目标平台：Chrome / Edge（Chromium）
- 扩展规范：Manifest V3
- 技术栈：React + TypeScript + Vite
- 文档状态：已完成需求与设计确认，待拆解实施计划

## 1. 项目背景与目标

开发一个浏览器新标签页扩展，在用户打开新标签时展示沉浸式、美观、低干扰的个人起始页。首期重点不是信息聚合，而是提供可靠的视觉体验、搜索入口、常用站点访问，以及面向内网域名/IP 的环境地址管理。

### 1.1 核心目标

1. 打开新标签页即显示全屏沉浸式壁纸与高可读性时钟。
2. 通过底部 Dock 快速使用搜索和常用站点。
3. 支持多套环境地址管理，可在开发、测试、生产、家庭内网等环境之间切换。
4. 快捷方式支持环境变量，切换环境后自动解析到对应域名或 IP。
5. 配置默认保存在本地，支持 JSON 导入导出和手动 WebDAV 备份恢复。
6. 以最小必要权限运行，不读取浏览历史、书签或当前页面内容。

### 1.2 成功标准

- Chrome 和 Edge 能以未打包扩展方式加载并覆盖新标签页。
- 用户可完成搜索引擎、环境、快捷方式和壁纸的基础配置。
- 浏览器重启后配置和壁纸仍可正常使用。
- 环境切换能正确影响绑定变量的快捷方式 URL。
- JSON 导出后清空配置，再导入可恢复结构化配置。
- 用户可通过一个自行配置的 WebDAV 服务完成手动上传和下载恢复。
- 首次安装和核心使用流程不需要常驻 `<all_urls>` 权限。

## 2. 产品范围

### 2.1 首期功能

#### 2.1.1 时钟问候

- 显示本地时间、日期、星期。
- 根据时段显示问候语：早上好、下午好、晚上好等。
- 使用浏览器本地时区，不进行网络时间校准。

#### 2.1.2 搜索

- 首期支持一个可配置搜索引擎。
- 设置项包含搜索引擎名称和搜索 URL 模板，例如：
  - `https://www.bing.com/search?q={{query}}`
  - `https://www.google.com/search?q={{query}}`
- 用户提交搜索后，在当前新标签页跳转到搜索结果。
- URL 模板必须包含 `{{query}}`，查询词需进行 `encodeURIComponent` 编码。

#### 2.1.3 快捷方式

- 支持新增、编辑、删除、排序快捷方式。
- 快捷方式字段包含标题、URL 模板、图标、分组和排序值。
- URL 模板支持：
  - 完整地址：`https://example.com/admin`
  - 环境变量地址：`{{baseUrl}}/admin`
- 图标支持：
  - 自动 favicon
  - 内置图标
  - 文字/Emoji 标识
  - 后续可扩展自定义图标
- 内网地址 favicon 加载失败时，使用标题首字或内置默认图标兜底。

#### 2.1.4 环境地址管理

用户可维护多个环境，每个环境包含名称、颜色和变量表。

示例：

```json
{
  "id": "env-dev",
  "name": "开发环境",
  "color": "#38bdf8",
  "variables": {
    "baseUrl": "http://192.168.1.10:8080",
    "adminUrl": "http://dev.example.internal"
  }
}
```

快捷方式 `{{baseUrl}}/admin` 在该环境下解析为：

```text
http://192.168.1.10:8080/admin
```

环境管理规则：

- 同一时间只有一个激活环境。
- 至少保留一个环境；删除当前环境前必须先切换到其他环境。
- 变量名只允许字母、数字、下划线。
- 变量值必须能组成合法的 `http:` 或 `https:` URL。
- 变量缺失、URL 非法或协议不受允许时禁止跳转，并提示具体原因。

#### 2.1.5 壁纸与视觉

- 视觉方向：沉浸式壁纸。
- 首页布局：全屏壁纸 + 底部毛玻璃 Dock。
- 壁纸来源：
  - 内置壁纸
  - 本地上传图片
  - 纯色或渐变背景
- 支持遮罩透明度调节，保证时钟和搜索框可读。
- 后续可扩展每日在线壁纸，但不纳入首期。

#### 2.1.6 数据备份与 WebDAV

- 结构化配置保存在浏览器本地。
- 支持导出 JSON 文件。
- 支持从 JSON 文件恢复。
- 支持配置 WebDAV 服务地址、用户名、应用专用密码或密码、远端文件路径。
- WebDAV 同步仅手动触发：
  - 上传到 WebDAV
  - 从 WebDAV 下载并恢复
- 首期不做自动同步、实时双向同步和复杂三方合并。

### 2.2 明确不做

- 不做账号体系和自建后端。
- 不做新闻、天气、日历、待办、数据仪表盘。
- 不做自由拖拽小组件画布。
- 不做浏览器书签或历史记录读取。
- 不做内容脚本注入。
- 不做自动 WebDAV 同步和实时冲突合并。
- 不做在线壁纸市场。
- 不做 Firefox 专项适配。

## 3. 首页信息架构

### 3.1 布局

```text
┌──────────────────────────────────────────────┐
│ [开发环境 ▾]                         [设置] │
│                                              │
│                                              │
│                                              │
│ 21:08                                        │
│ 9月18日 星期五 · 晚上好                       │
│                                              │
│ ┌──────────────────────────────────────────┐ │
│ │ 搜索或输入网址                             │ │
│ │ [站点] [站点] [站点] [站点] [站点]        │ │
│ └──────────────────────────────────────────┘ │
└──────────────────────────────────────────────┘
```

### 3.2 区域职责

- 左上：环境切换器，显示当前环境名称和颜色。
- 左下：时钟、日期、星期和问候语。
- 底部：毛玻璃 Dock，包含搜索框与快捷方式。
- 右上：设置入口和壁纸快捷入口。
- 设置：使用抽屉或弹层，不另建复杂后台页面。

### 3.3 响应式要求

- 主要适配桌面浏览器新标签页。
- 最低验证宽度：1280×800。
- 常规验证宽度：1366×768、1440×900、1920×1080。
- 窄窗口下 Dock 允许换行或横向滚动，但不得遮挡时钟。
- 壁纸使用 `object-fit: cover` 或等效策略铺满屏幕，避免明显拉伸。

## 4. 技术架构

### 4.1 架构原则

采用“本地优先单页应用 + 薄 Service Worker”。

- React 新标签页负责所有用户交互。
- 领域服务负责配置、环境解析、壁纸、备份和 WebDAV 业务逻辑。
- 浏览器 API 通过适配层访问，避免组件直接散落调用。
- Service Worker 只处理安装初始化和用户手动触发的 WebDAV 请求。
- 不依赖服务端，不做后台轮询，不依赖 Service Worker 保存运行时状态。

### 4.2 逻辑分层

```text
New Tab React UI
  ├─ WallpaperLayer
  ├─ ClockGreeting
  ├─ SearchBar
  ├─ EnvironmentSwitcher
  ├─ ShortcutDock
  └─ SettingsDrawer
        ↓
Domain Services
  ├─ ConfigStore
  ├─ EnvironmentResolver
  ├─ WallpaperService
  ├─ BackupService
  └─ WebDavClient
        ↓
Browser Adapters
  ├─ chrome.storage.local
  ├─ IndexedDB
  ├─ chrome.permissions
  └─ chrome.runtime messaging
        ↓
Thin Service Worker
  └─ Manual WebDAV GET/PUT
```

### 4.3 建议目录结构

```text
src/
  newtab/
    main.tsx
    App.tsx
    components/
      WallpaperLayer/
      ClockGreeting/
      SearchBar/
      EnvironmentSwitcher/
      ShortcutDock/
      SettingsDrawer/
    hooks/
    styles/
  background/
    service-worker.ts
    webdav-handler.ts
  shared/
    models/
      config.ts
      environment.ts
      shortcut.ts
      wallpaper.ts
      backup.ts
    services/
      config-store.ts
      environment-resolver.ts
      wallpaper-service.ts
      backup-service.ts
      webdav-client.ts
    storage/
      chrome-storage.ts
      wallpaper-db.ts
      storage-keys.ts
    utils/
      url.ts
      time.ts
      schema.ts
      migration.ts
      result.ts
    test/
```

### 4.4 Manifest V3 设计

示意配置：

```json
{
  "manifest_version": 3,
  "name": "LostSunset New Tab",
  "version": "0.1.0",
  "description": "沉浸式壁纸、快捷方式与内网环境地址管理新标签页。",
  "chrome_url_overrides": {
    "newtab": "newtab.html"
  },
  "permissions": ["storage", "unlimitedStorage"],
  "optional_host_permissions": ["*://*/*"],
  "background": {
    "service_worker": "src/background/service-worker.ts",
    "type": "module"
  }
}
```

说明：

- `storage` 用于读写结构化配置。
- `unlimitedStorage` 用于避免本地上传壁纸占用常规存储配额。
- `optional_host_permissions` 声明可选广域匹配，但安装时不授权；用户配置 WebDAV 时只请求具体源。
- 不声明 `tabs`、`bookmarks`、`history`、`cookies`、`downloads` 等权限。
- 图标文件未生成前不在 Manifest 中引用图标，避免出现不存在的资源路径。

### 4.5 WebDAV 权限流程

1. 用户在设置中填写 WebDAV 根地址和远端文件路径。
2. 用户点击“测试连接”或“保存并授权”。
3. 前端从用户填写的地址中提取源，例如 `http://192.168.1.20:5244`。
4. 在用户点击手势中调用 `chrome.permissions.request` 请求该源权限。
5. 授权成功后，前端通过 `chrome.runtime.sendMessage` 请求 Service Worker 执行网络请求。
6. Service Worker 返回明确的成功或错误结果，不保存临时同步状态。

内网 HTTP 允许使用，但界面必须提示：HTTP 不加密，可能暴露 WebDAV 凭据；公网地址应使用 HTTPS。

## 5. 数据模型与存储

### 5.1 配置结构

```ts
export type UserConfig = {
  version: 1
  updatedAt: string
  settings: {
    activeEnvironmentId: string
    searchEngine: {
      id: string
      name: string
      searchUrlTemplate: string
    }
    wallpaper: {
      mode: 'builtin' | 'upload' | 'gradient'
      assetId?: string
      value: string
      overlayOpacity: number
      blur?: number
    }
    dock: {
      iconSize: number
      showLabels: boolean
    }
  }
  environments: Environment[]
  shortcutGroups: ShortcutGroup[]
  shortcuts: Shortcut[]
}

export type Environment = {
  id: string
  name: string
  color?: string
  variables: Record<string, string>
}

export type ShortcutGroup = {
  id: string
  name: string
  order: number
}

export type Shortcut = {
  id: string
  groupId: string
  title: string
  urlTemplate: string
  icon: {
    type: 'favicon' | 'builtin' | 'emoji' | 'custom'
    value: string
  }
  order: number
}
```

### 5.2 存储位置

| 数据 | 存储位置 | 说明 |
| --- | --- | --- |
| 用户配置 | `chrome.storage.local` | 环境、快捷方式、搜索引擎、壁纸元数据 |
| 上传壁纸二进制 | IndexedDB | 通过 `assetId` 与配置关联 |
| WebDAV 连接信息 | `chrome.storage.local` | 与用户配置分离保存 |
| 导入前自动备份 | `chrome.storage.local` | 保存最近一次安全回滚副本 |
| 损坏配置快照 | `chrome.storage.local` | schema 校验失败时保留原数据 |

### 5.3 配置存储键

```ts
export const STORAGE_KEYS = {
  userConfig: 'userConfig.v1',
  webdavProfile: 'webdavProfile.v1',
  localBackupBeforeImport: 'localBackup.beforeImport',
  corruptedConfigSnapshot: 'diagnostics.corruptedConfig'
} as const
```

### 5.4 WebDAV 凭据

WebDAV 凭据不放入 `UserConfig`，不进入 JSON 导出内容。

```ts
export type WebDavProfile = {
  baseUrl: string
  remotePath: string
  username: string
  credential: string
  rememberCredential: boolean
  lastUpdatedAt?: string
}
```

- 如果用户选择记住凭据，凭据保存在 `chrome.storage.local`。
- 设置页需提示扩展本地存储不是加密保险箱，建议使用 WebDAV 应用专用密码。
- 如果用户不选择记住凭据，则当前页面内存中临时使用，浏览器重启后重新输入。

### 5.5 备份文件格式

```ts
export type ConfigBackupFile = {
  kind: 'lostsunset-new-tab-backup'
  backupVersion: 1
  appVersion: string
  exportedAt: string
  config: UserConfig
}
```

备份文件规则：

- 仅包含结构化配置，不包含 WebDAV 凭据。
- 首期不内嵌本地上传壁纸二进制；壁纸配置保留 `assetId`，在新设备上若资产缺失则回退到默认壁纸。
- 导入时必须校验 `kind`、`backupVersion`、`config.version` 和必填字段。
- 导入成功前不覆盖当前配置。

## 6. 关键业务流程

### 6.1 启动流程

1. 加载新标签页。
2. `ConfigStore` 从 `chrome.storage.local` 读取配置。
3. 如果没有配置，写入默认配置。
4. 如果配置存在，执行 schema 校验。
5. 校验成功后按迁移函数升级到当前版本。
6. 校验失败时保存损坏数据快照并加载默认配置。
7. `WallpaperService` 根据壁纸配置读取内置图、渐变或 IndexedDB 资产。
8. React 渲染首页。

### 6.2 快捷方式打开流程

1. 用户点击快捷方式。
2. `EnvironmentResolver` 读取当前环境变量。
3. 将 `{{变量名}}` 替换为对应变量值。
4. 使用 URL 构造器校验最终地址。
5. 仅允许 `http:` 和 `https:`。
6. 校验通过后打开链接；失败时显示错误，不跳转。

### 6.3 切换环境流程

1. 用户在左上角选择环境。
2. 设置 `settings.activeEnvironmentId`。
3. 持久化新配置。
4. 重新解析所有使用环境变量的快捷方式。
5. 环境标签颜色同步更新。
6. 无效快捷方式显示错误状态，不影响其他快捷方式。

### 6.4 上传壁纸流程

1. 用户选择本地图片。
2. 前端检查文件类型和大小。
3. 读取图片二进制并写入 IndexedDB，生成 `assetId`。
4. 更新配置中的 `wallpaper.mode` 和 `wallpaper.assetId`。
5. 页面立即预览新壁纸。
6. 保存成功后替换旧壁纸引用；旧资产在确认无引用后清理。

### 6.5 导出配置流程

1. 用户点击“导出配置”。
2. 系统读取当前配置并生成 `ConfigBackupFile`。
3. 触发浏览器下载 JSON 文件。
4. 导出文件不包含 WebDAV 凭据和壁纸二进制。

### 6.6 导入配置流程

1. 用户选择 JSON 文件。
2. 完整解析并校验文件。
3. 展示将导入的环境、快捷方式和壁纸设置摘要。
4. 用户确认后，将当前配置保存为本地自动备份。
5. 写入新配置。
6. 若壁纸资产不存在，使用默认壁纸兜底并提示。

### 6.7 手动上传 WebDAV

1. 用户点击“上传到 WebDAV”。
2. 检查 WebDAV 配置和主机权限。
3. 生成不含凭据的备份 JSON。
4. Service Worker 执行 `PUT`。
5. 如果远端文件已存在且元数据更新时间更新，先提示覆盖风险。
6. 成功后更新本地记录的远端更新时间；失败时显示可操作错误信息。

### 6.8 手动下载 WebDAV

1. 用户点击“从 WebDAV 恢复”。
2. Service Worker 执行 `GET`。
3. 前端校验 JSON 和 schema。
4. 展示远端备份摘要。
5. 用户确认后生成本地自动备份。
6. 写入恢复配置，缺失壁纸资产使用默认壁纸兜底。

## 7. 错误处理

| 场景 | 用户提示 | 系统行为 |
| --- | --- | --- |
| 配置损坏 | 配置已安全回退，可导出诊断数据 | 保存原始数据，加载默认配置 |
| 存储不可用 | 浏览器存储不可用，请检查扩展权限 | 禁用保存操作，允许重试 |
| 壁纸资产缺失 | 原壁纸不存在，已切换默认背景 | 回退到默认壁纸或渐变 |
| 上传文件类型不支持 | 请选择 PNG、JPG、WebP 等图片文件 | 拒绝写入 |
| 环境变量缺失 | 缺少变量 baseUrl，请检查当前环境 | 阻止跳转 |
| URL 协议不合法 | 仅支持 http 或 https 地址 | 阻止跳转 |
| 导入 JSON 格式错误 | 文件不是有效的配置备份 | 不覆盖当前配置 |
| 导入版本不支持 | 备份版本过高或过低 | 不覆盖当前配置 |
| WebDAV 未授权 | 用户名或密码错误 | 保留当前配置 |
| WebDAV 权限未授予 | 需要授权访问该服务器地址 | 重新发起权限请求 |
| WebDAV 网络不可达 | 无法连接服务器，请检查地址和网络 | 允许重试 |
| WebDAV 远端文件无效 | 远端文件不是有效备份 | 不覆盖当前配置 |

所有异步服务返回统一结果形态：

```ts
type AsyncResult<T, E = AppError> =
  | { ok: true; data: T }
  | { ok: false; error: E }
```

UI 只根据错误码展示文案，不直接依赖底层异常字符串。

## 8. 安全与隐私

1. 不收集分析数据。
2. 不接入远程脚本。
3. 不使用 `eval`、`new Function` 或内联事件处理器。
4. 不读取用户标签页、历史记录、书签、Cookie 或页面内容。
5. 所有外链跳转只允许 `http:` 和 `https:`。
6. WebDAV 凭据不进入备份文件。
7. 对 HTTP WebDAV 地址显示明文传输风险提示。
8. 可选主机权限按用户填写的具体源请求，不安装时常驻授权。
9. 导入文件必须经过 schema 校验后才能写入本地。
10. 扩展图标和通知图标在真实文件生成前不引用，避免无效资源。

## 9. 测试策略

### 9.1 单元测试

覆盖：

- 时间和问候语格式化
- 搜索 URL 模板生成与查询词编码
- 环境变量替换
- 非法 URL 拦截
- schema 校验
- 配置版本迁移
- 导入文件校验
- WebDAV 路径拼接
- WebDAV 错误码映射

### 9.2 组件测试

覆盖：

- 时钟和问候语渲染
- 搜索输入、提交和空查询处理
- Dock 快捷方式渲染
- 环境切换交互
- 壁纸遮罩和加载失败状态
- 快捷方式表单校验
- WebDAV 设置表单校验
- 导入确认和错误提示

### 9.3 服务与集成测试

- 使用内存存储模拟 `chrome.storage.local`。
- 使用 fake IndexedDB 验证壁纸写入、读取和缺失回退。
- mock `fetch` 验证 WebDAV：
  - 成功上传
  - 成功下载
  - 401/403
  - 网络中断
  - 非 JSON 响应
  - schema 校验失败
- 验证导入前自动备份确实生成。

### 9.4 手工验收

在 Chrome 和 Edge 中分别验证：

1. 加载未打包扩展。
2. 新标签页被正确覆盖。
3. 默认首页正常显示。
4. 修改搜索引擎后可搜索。
5. 新增环境和内网 IP/域名快捷方式。
6. 切换环境后 URL 正确变化。
7. 上传本地壁纸并重启浏览器。
8. 导出配置、清空扩展数据、重新导入恢复。
9. 配置 WebDAV 并完成上传和下载。
10. 拒绝主机权限时出现明确提示。
11. 断网时首页仍可正常打开。
12. 写入损坏配置后能安全回退。

### 9.5 视觉和可访问性

- 验证 1280×800、1366×768、1440×900、1920×1080。
- 保证搜索框可通过键盘聚焦和提交。
- 图标按钮提供可读标签。
- 壁纸遮罩下时钟和搜索文字达到足够对比度。
- 表单错误信息与对应输入项关联。

## 10. 开发里程碑

### M0：工程骨架

- 初始化 Vite + React + TypeScript。
- 配置 MV3 构建和 CRXJS。
- 能在 Chrome/Edge 加载空白新标签页。
- 建立代码规范、类型检查和测试命令。

### M1：沉浸式首页

- 实现壁纸层和遮罩。
- 实现时钟、日期、问候语。
- 实现搜索框。
- 实现底部 Dock 基础布局。

### M1 验收标准

- 新标签页视觉结构符合底部 Dock 方案。
- 搜索能跳转到搜索引擎结果。
- 窗口缩放时没有明显布局破坏。

### M2：配置、快捷方式与环境

- 实现配置存储和默认配置。
- 实现设置抽屉。
- 实现快捷方式增删改查和排序。
- 实现环境管理和环境切换。
- 实现 URL 模板解析和错误提示。

### M2 验收标准

- 浏览器重启后配置保留。
- 环境切换能改变绑定变量的快捷方式地址。
- 非法地址不会跳转。

### M3：壁纸能力

- 接入内置壁纸和渐变。
- 实现本地上传。
- 使用 IndexedDB 保存壁纸资产。
- 实现遮罩调节和加载失败回退。

### M3 验收标准

- 本地壁纸重启后仍显示。
- 资产缺失时自动回退。
- 壁纸不影响主要文字可读性。

### M4：备份与 WebDAV

- 实现 JSON 导出和导入。
- 实现导入前自动备份。
- 实现 WebDAV 配置、授权、测试连接。
- 实现手动上传和下载恢复。

### M4 验收标准

- 配置可通过 JSON 备份恢复。
- WebDAV 成功上传并可下载恢复。
- 权限拒绝、认证失败、网络失败均有明确提示。

### M5：测试、打包与发布准备

- 补齐核心单元测试和组件测试。
- 完成 Chrome/Edge 手工验收。
- 准备生产构建和 ZIP 包。
- 生成真实 PNG 图标后再加入 Manifest。
- 准备 Chrome Web Store 发布材料和权限说明。

### M5 验收标准

- 生产构建无 TypeScript 和构建错误。
- 核心测试通过。
- 扩展包不包含 `.git`、`node_modules`、环境变量文件和无关文档。
- 权限说明能清楚解释 `storage`、`unlimitedStorage` 和可选主机权限的用途。

## 11. 主要风险与应对

| 风险 | 影响 | 应对 |
| --- | --- | --- |
| WebDAV 服务 CORS 或权限限制 | 无法连接用户的服务 | 通过 Service Worker 和主机权限请求处理；提供详细错误提示 |
| 内网使用 HTTP | 凭据可能暴露 | 明确风险提示，建议仅在可信网络使用或使用 HTTPS/反代 |
| 壁纸文件过大 | IndexedDB 占用增加 | 限制上传大小，提示压缩，后续再做客户端压缩 |
| 备份版本演进 | 旧配置无法恢复 | 保留 version 字段和显式迁移函数 |
| 不同浏览器存储差异 | Edge/Chrome 表现不一致 | 抽象存储适配层，并在双浏览器验收 |
| 壁纸影响文字可读性 | 首页不好用 | 强制遮罩层并提供透明度调节 |
| 环境变量配置错误 | 快捷方式无法打开 | 编辑时预览最终 URL，点击前显示解析错误 |

## 12. 后续增强候选

以下能力不进入首期，只在架构上预留方向：

- 多搜索引擎和快捷搜索词。
- 自动 WebDAV 同步和冲突合并。
- 在线每日壁纸。
- 壁纸客户端压缩。
- 自定义快捷方式图标上传。
- 小组件画布。
- 天气、待办、日历等可选小组件。
- Firefox 兼容层。
- 配置加密备份。

## 13. 实施前置约束

- 所有扩展代码必须遵循 Manifest V3。
- 不先创建图标文件，就不在 Manifest 中引用图标。
- 不把 WebDAV 凭据写入备份文件。
- 不在首期扩大到自动同步或小组件平台。
- 新增依赖前应确认其与 Manifest V3、Vite 构建和扩展 CSP 兼容。
- 任何需要访问外部源的能力都必须保持用户主动触发和可解释。
