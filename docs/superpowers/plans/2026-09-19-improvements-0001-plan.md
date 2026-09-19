# question/0001 改善项实施计划

- 日期：2026-09-19
- 设计文档：[2026-09-19-improvements-0001-design.md](../specs/2026-09-19-improvements-0001-design.md)
- 验证命令：`npm run test`（Vitest 全量）、`npm run typecheck`、`npm run build`
- 约定：零依赖、AsyncResult 错误模型、组件独立目录+同置 CSS、类型入 `shared/models`、工具入 `shared/utils`、测试用 `src/test` shims

---

## 阶段一：配置 v2 + 壁纸（裁剪 / 壁纸库 / 随机）

### Task 1.1 模型升级到 v2
文件：`src/shared/models/config.ts`
- `CONFIG_VERSION` 1 → 2
- `SearchEngine` 增加 `keyword?: string`
- `WallpaperMode` 增加 `'random'`；`WallpaperConfig` 增加可选 `randomPool: { gradients: string[]; builtinIds: string[]; assetIds: string[] }`
- `UserSettings`：删除 `searchEngine`，新增 `searchEngines: SearchEngine[]`、`activeSearchEngineId: string`

文件：`src/shared/models/asset.ts`
- `WallpaperAsset` 增加可选 `width?: number; height?: number`

### Task 1.2 v2 结构校验
文件：`src/shared/services/config-schema.ts`
- `WALLPAPER_MODES` 加入 `'random'`
- `settings.searchEngine` 校验替换为：`searchEngines` 非空数组（每项 id/name/template 必填、template 含 `{{query}}` 且 http(s)——模板协议校验复用 `url-search.ts` 的 `ALLOWED_SEARCH_PROTOCOLS`，抽出 `isValidSearchTemplate` 小函数供 schema 与设置 UI 共用）、`activeSearchEngineId` 非空且存在于列表
- `randomPool` 存在时：三组均为字符串数组
- 同步修复 `src/shared/services/config-schema.test.ts`

### Task 1.3 迁移链 v1→v2
文件：`src/shared/services/migration.ts`
- 重构为版本步骤链：`migrateConfig` 先判 root/version，v1 先经过 `migrateV1ToV2(raw)` 再进 `parseUserConfig`；版本已是 2 直接校验；>2 报 `CONFIG_VERSION_UNSUPPORTED`
- `migrateV1ToV2`（纯函数）：
  - `settings.searchEngine` → `searchEngines: [engine]`、`activeSearchEngineId = engine.id`
  - keyword 默认映射：id/name 含 `bing|baidu|百度|google|ddg|duckduckgo`（大小写不敏感）时填 `bing/baidu/google/ddg`
  - `wallpaper.randomPool` 缺省时：全部 `GRADIENT_PRESETS` 值 + 全部 `BUILTIN_IMAGE_PRESETS` id +（upload 模式时）现有资产 id
- 更新 `src/shared/services/migration.test.ts`：新增 v1 样例升级、v2 直通、v3 拒绝、keyword 映射用例

### Task 1.4 默认配置与工厂
文件：`src/shared/config/default-config.ts`
- `createDefaultConfig`：`searchEngines: [{ ...DEFAULT_SEARCH_ENGINE }]`、`activeSearchEngineId: 'bing'`、`wallpaper.randomPool` 默认全选渐变+内置图
- 新增 `createSearchEngineDraft()` 工厂（阶段二用，含 `keyword: ''`）
- 同步修复引用 `settings.searchEngine` 的既有测试（`default-config` 相关、`config-store.test.ts`、备份/恢复链路测试如受影响）

### Task 1.5 壁纸服务重构（壁纸库 + 随机）
文件：`src/shared/services/wallpaper-service.ts`
- `saveUploadedWallpaper` 删除，改为：
  - `addWallpaperAsset(current, file, assetStore, now?)`：校验 → `put` 新资产 → 配置切到该资产（mode='upload'），**不删旧资产**
  - `removeWallpaperAsset(current, assetId, assetStore)`：资产是当前使用中 → 配置回退 `DEFAULT_WALLPAPER` 渐变后再 `remove`；否则直接 `remove`；返回新配置（资产可能已不在配置里，仍需 commit 使 updatedAt 前进）
- `applyPresetWallpaper` 去掉删旧资产逻辑
- `resolveWallpaper`：签名增加第三参 `random: () => number = Math.random`；新增 `mode='random'` 分支——合并 `randomPool` 三组候选为 `{kind:'gradient'|'builtin'|'asset', value}[]`，`random()` 抽一项后走对应既有解析；池为空回退默认渐变；抽中资产缺失走 `recovered`
- 新增 `setRandomPool(current, pool)`：写入 `randomPool` 并返回新配置
- 同步重写 `wallpaper-service.test.ts`：多资产保留、删除保护、随机抽取（注入 fake random）、池空回退、资产缺失 recovered

### Task 1.6 裁剪工具与弹层
新建：`src/shared/utils/image-crop.ts`
- `computeCropRect({ containerW, containerH, imgW, imgH, ratio | 'free', box }) → { sx, sy, sw, sh }`（源图坐标）与拖拽/缩放选框的钳制函数；纯函数+单测
新建组件目录：`src/newtab/components/WallpaperCropDialog/`（`WallpaperCropDialog.tsx` + CSS）
- Props：`file: File`、`onConfirm(blob: Blob)`、`onCancel()`
- 图片 objectURL 预览 + 可拖拽移动/角落手柄缩放的选框；比例按钮：自由 / 1:1 / 16:9
- 确认：`canvas` 绘制裁剪区 → `toBlob(原 mime, 0.92)` → 复用 `validateImageFile` 校验（超 10 MB 报「裁剪结果过大，请缩小选区」）→ `onConfirm(blob)`
- Escape/遮罩关闭；焦点圈定；`prefers-reduced-motion` 下无过渡动画

### Task 1.7 壁纸设置区改造
文件：`src/newtab/components/SettingsDrawer/WallpaperSection.tsx`
- 上传流程接入裁剪弹层：选文件校验通过后打开 `WallpaperCropDialog`，确认后调 `addWallpaperAsset`
- 新增「我的壁纸」网格：`listWallpaperAssets()`（见下）取资产，缩略图用 `URL.createObjectURL(blob)`（卸载 revoke）；点击应用、悬停删除按钮（当前使用中需 confirm，非当前直接删）、勾选框控制参与随机
- 顶部新增「随机」模式卡片（role=radio 与现有预设组一致）
- 渐变/内置图缩略图右上角加勾选框，勾选变化即 `setRandomPool`
文件：`src/shared/services/wallpaper-service.ts` 或 `asset-store.ts`
- `AssetStore` 增加 `list(): Promise<WallpaperAsset[]>`；`browser-asset-store.ts` 用 `getAll` 实现；`src/test` 内存实现同步

### Task 1.8 阶段一收尾
- 全局搜索 `settings.searchEngine`、`saveUploadedWallpaper` 残留引用并修复（`App.tsx:51` 的 `engine={config.settings.searchEngine}` 传参、`SettingsDrawer.test.tsx` 等）
- `npm run test`、`npm run typecheck`、`npm run build` 全绿后提交

**阶段一验收**：v1 旧存储自动升级；上传→裁剪→应用→库中保留多张；随机模式每次打开新标签页换图且 `updatedAt` 不变。

---

## 阶段二：搜索（多引擎 + 关键词调用）

### Task 2.1 keyword 匹配纯函数
新建：`src/shared/utils/search-input.ts` + `search-input.test.ts`
- `matchEngineKeyword(input, engines): { engine: SearchEngine; rest: string } | null`
- 规则：`input` 以单个空格结尾前缀完全等于某引擎 `keyword`（大小写不敏感）才命中；两引擎同 keyword 取列表靠前者；命中当前引擎（调用方过滤）不在此函数处理

### Task 2.2 SearchBar 多引擎与关键词调用
文件：`src/newtab/components/SearchBar/SearchBar.tsx`、CSS、`SearchBar.test.tsx`
- Props 改为：`engines: SearchEngine[]`、`activeEngineId: string`、`onChangeEngine(id)`、`onNavigate?`
- 左端引擎徽标按钮：点击展开 radiogroup 列表（引擎名+keyword），选中调 `onChangeEngine`（由 App 落 `activeSearchEngineId`）；列表尾「管理搜索引擎…」按钮（`onManageEngines` prop → App 打开抽屉搜索区）
- 关键词调用：输入变化时检测 `输入词 + ' '`（首次空格）命中 `matchEngineKeyword` 且非当前引擎 → 设临时生效引擎、清掉前缀、徽标更新；提交搜索后**临时引擎还原为当前引擎**（不落盘）；输入恰等于某 keyword（未加空格）时下方提示「空格使用 X 搜索」
- `App.tsx` 传参同步：`engines={config.settings.searchEngines}`、`activeEngineId`、`onChangeEngine` 走 `updateConfig`

### Task 2.3 引擎设置列表 CRUD
文件：`src/newtab/components/SettingsDrawer/SearchEngineSection.tsx` + CSS
- 重构为列表视图：每行 名称 / keyword / 模板摘要 + 编辑、删除、上移/下移
- 编辑：行内展开表单（名称、keyword、模板；模板用 `isValidSearchTemplate` 校验，行内报错）
- 删除：至少保留一个（最后一条禁用删除）；删除当前使用中 → `activeSearchEngineId` 指到列表第一项
- 预设快速添加：Bing / 百度 / Google / DuckDuckGo 按钮（含默认 keyword：`bing/baidu/google/ddg`，模板见 3.1 预设表）
- keyword 与其他引擎重复时行内 warning（非阻断）
- 每次变更走 `updateConfig`

### Task 2.4 阶段二收尾
- 新增/更新测试：`search-input.test.ts`、`SearchBar.test.tsx`（徽标切换、keyword 空格触发、提交还原）、`SearchEngineSection` 组件测试（增删改排序、删除活跃引擎回退）
- 全量 test/typecheck/build 通过后提交

**阶段二验收**：默认引擎为列表第一个；手动切换后记住；`baidu `+空格即用百度搜索；设置内可增删排序引擎。

---

## 阶段三：快捷方式（「+」弹窗 / 拖拽 / 分组 tab）

### Task 3.1 URL 输入规范化与拖拽解析纯函数
新建：`src/shared/utils/url-input.ts` + 测试
- `normalizeUrlInput(input): { url: string } | { error: string }`：trim、缺协议补 `https://`、仅允许 http(s)、非法返回错误文案
新建：`src/shared/utils/dnd-link.ts` + 测试
- `parseDroppedLink({ uriList?, html?, plain? }): { url: string; title?: string } | null`：`text/uri-list` 优先 → `text/html` 中首个 `<a href>`（取锚文本为 title）→ `text/plain` 兜底；协议白名单 http(s)

### Task 3.2 快捷添加弹窗
新建组件目录：`src/newtab/components/ShortcutQuickAdd/`（`ShortcutQuickAdd.tsx` + CSS）
- Props：`initial?: { url?: string; title?: string }`、`defaultGroupId`、`onClose()`
- 表单：网址（`normalizeUrlInput` 校验，行内报错）、名称（空则取 hostname）、分组下拉（`config.shortcutGroups` 按 order）、图标（默认 favicon / emoji / 首字母三选）
- 确认：`updateConfig` 追加 `createShortcutDraft(groupId, order=max+1)` 并填值；立即生效
- Escape/遮罩关闭、焦点圈定、错误时 `aria-invalid`

### Task 3.3 Dock「+」与分组 tab
文件：`src/newtab/components/ShortcutDock/ShortcutDock.tsx` + CSS、`ShortcutDock.test.tsx`
- 列表尾部追加「+」按钮（48px 可点击区），点击本地 `useState` 打开 `ShortcutQuickAdd`
- Dock 上方 tab 条：「全部」+ 分组按 `order` 排序；**仅 `shortcutGroups.length > 1` 渲染**；本地 state 选中，默认「全部」，不持久化；选中过滤 `sorted`
- 空分组空态文案：「该分组还没有快捷方式」
- `App.tsx` 无需改动（tab 状态在 Dock 内）

### Task 3.4 拖拽链接到起始页
文件：`src/newtab/App.tsx`
- `onDragOver` preventDefault；`onDrop` 读取 `event.dataTransfer.getData('text/uri-list' | 'text/html' | 'text/plain')` → `parseDroppedLink` → 命中则打开预填的 `ShortcutQuickAdd`；未命中 toast「未能识别拖入的链接」（现有 `page__notice` 样式复用或新建轻量 toast）
- 仅在设置抽屉未打开时响应，避免冲突

### Task 3.5 阶段三收尾
- 测试：`url-input`、`dnd-link`、`ShortcutQuickAdd`（校验/预填/提交）、`ShortcutDock`（tab 过滤、多分组显示、单分组隐藏、「+」打开弹窗）
- 全量 test/typecheck/build 通过后提交

**阶段三验收**：Dock「+」添加即生效；从其他网页拖链接到起始页弹出预填表单；多分组时出现 tab 且过滤正确。

---

## 收尾（三阶段完成后）

1. 浏览器验收：按 `extension-browser-verify` skill 跑完整 UI 流程（含 v1→v2 升级场景：用旧版本配置 JSON 导入验证）
2. 回填 `question/0001.md`：改善项 1–7 逐条补【解决方式】（引用本设计文档）
3. 更新 project_memory / topics（M5 后增强轮完成）
4. `npm run release` 重新打包验证（包内无违禁文件、zip 可读）

## 风险与依赖

- `AssetStore.list()` 接口变更会触及 `src/test` 内存实现与既有资产测试——先改接口再改实现，测试同 commit
- `SearchBar` props 变更直接破坏 `SearchBar.test.tsx` 与 `App.tsx`——Task 2.2 一次性改完三处
- 随机模式不落盘依赖「resolve 只在 useWallpaper 发生」——禁止把随机结果写回 config
- Node 25 jsdom 无 Canvas：裁剪 Canvas 分支不在组件测试中断言，仅测纯函数与弹层交互（mock toBlob）
