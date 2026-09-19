# question/0001 改善项设计（壁纸 / 搜索 / 快捷方式）

- 日期：2026-09-19
- 状态：已与用户逐节确认
- 来源：[question/0001.md](../../../question/0001.md) 改善区 7 项（问题 1 的样式修复已完成，不在本设计范围）
- 组织方式：单 spec 三阶段实施（壁纸 → 搜索 → 快捷方式），共享一次配置 v1→v2 迁移

## 0. 目标与非目标

**目标**（对应用户 7 项改善）
1. 本地选取壁纸可裁剪
2. 本地壁纸保存复用（壁纸库）
3. 随机壁纸：每次打开新标签页随机显示一张
4. 搜索引擎多选，默认使用第一个
5. 搜索引擎关键词快速调用（如 `baidu` + 空格）
6. 快捷方式可视化添加（Dock「+」弹窗 + 拖拽链接）
7. 快捷方式分组 tab 选择

**非目标**
- 不做壁纸自动换源（在线随机图源）
- 不改 ShortcutSection 的分组 CRUD（分组管理仍在设置抽屉）
- 不持久化「全部/分组 tab」选择与「随机抽取结果」
- 不引入第三方裁剪/拖拽依赖（保持零依赖约定）

## 1. 配置 v2 与迁移（共享基础）

### 1.1 模型变更（src/shared/models/config.ts）

```ts
export const CONFIG_VERSION = 2 as const

export type SearchEngine = {
  id: string
  name: string
  searchUrlTemplate: string // 保留 {{query}} 占位符约定
  keyword?: string          // 新增：关键词快速调用，空/缺省表示不支持
}

export type WallpaperMode = 'builtin' | 'upload' | 'gradient' | 'random' // 新增 random

export type WallpaperConfig = {
  mode: WallpaperMode
  value: string
  assetId?: string
  overlayOpacity: number
  blur?: number
  randomPool?: {
    gradients: string[]    // 渐变 CSS 值
    builtinIds: string[]   // 内置图预设 id
    assetIds: string[]     // 本地库资产 id
  }
}

export type UserSettings = {
  activeEnvironmentId: string
  searchEngines: SearchEngine[]       // 替换原 searchEngine 单对象
  activeSearchEngineId: string        // 新增
  wallpaper: WallpaperConfig
  dock: DockConfig
}
```

### 1.2 迁移链（src/shared/services/migration.ts）

- 现有 `version !== CONFIG_VERSION` 直接失败改为迁移链：`migrateConfig` 按版本逐级升级（v1 → v2 → … → 当前），每步一个纯函数，最后交给 `parseUserConfig` 校验。
- v1 → v2 步骤：
  - `settings.searchEngine` → `settings.searchEngines = [engine]`；`settings.activeSearchEngineId = engine.id`
  - 按预设映射默认 keyword：`bing`、`baidu`、`google`、`ddg`（大小写不敏感匹配 id/name，未命中则不填 keyword）
  - `wallpaper.randomPool` 缺省时默认勾选：全部渐变预设 + 全部内置图 + 现有上传资产 id
- 向后兼容：旧备份 JSON（v1）导入走同一迁移链自动升级，用户无感。

### 1.3 校验（src/shared/services/config-schema.ts）

`parseUserConfig` 同步 v2 规则：
- `searchEngines` 非空数组；`activeSearchEngineId` 必须存在于列表
- 每个 engine 的 `searchUrlTemplate` 含 `{{query}}` 且为 http(s) URL；`keyword` 若存在为非空字符串（允许重复，见 3.3 冲突规则）
- `randomPool` 若存在，三组均为字符串数组；`mode='random'` 时允许池为空（运行时回退默认渐变）

## 2. 壁纸（阶段一）

### 2.1 上传裁剪（改善 1）

- 流程：选文件 → `validateImageFile` 校验 → 裁剪弹层 → 确认 → 生成 blob → 入库 → 应用为新壁纸
- 裁剪弹层：图片居中显示 + 可拖拽/缩放选框；比例快捷键：自由 / 1:1 / 16:9；实时预览
- 纯函数 `src/shared/utils/image-crop.ts`：由容器尺寸、图片尺寸、选框状态计算源矩形（`computeCropRect`）；Canvas 绘制（`canvas.toBlob`）薄封装在组件侧
- 输出保持原格式（png/jpeg/webp），quality 0.92；结果仍过 10 MB 校验，超限提示重新裁小
- 取消裁剪不产生任何资产写入

### 2.2 壁纸库（改善 2）

`wallpaper-service.ts` 重构：
- `saveUploadedWallpaper`（换新删旧）→ `addWallpaperAsset(current, file, assetStore)`：只入库 + 切换引用，**不删**旧资产
- `applyPresetWallpaper` 不再删除旧上传资产
- 新增 `removeWallpaperAsset(current, assetId, assetStore)`：删除当前使用中的资产时先把壁纸回退为默认渐变再删；非当前资产直接删（资产删除需用户确认，UI 层负责）
- 资产元数据（`src/shared/models/asset.ts`）补充 `width/height`（裁剪后已知），用于缩略图布局

设置页新增「我的壁纸」网格：
- 缩略图由 asset blob 生成 objectURL（组件卸载时 revoke）
- 点击应用、悬停显示删除按钮、勾选框控制是否参与随机（见 2.3）

### 2.3 随机壁纸（改善 3）

- `resolveWallpaper` 增加 `mode='random'` 分支：从 `randomPool` 三类候选合并集中随机抽一项，再按 gradient/builtin/upload 既有逻辑解析；**注入 `random: () => number` 参数**（默认 `Math.random`）保证可测
- 池为空 → 回退默认渐变；抽中的上传资产缺失 → 走现有 `recovered` 回退链
- 随机结果**不落盘**：`updatedAt` 不变，不污染 WebDAV 备份
- 设置页壁纸区顶部加「随机」模式卡片；渐变/内置图缩略图右上角勾选框 + 我的壁纸每项勾选框，全部写入 `randomPool`

## 3. 搜索（阶段二）

### 3.1 多引擎（改善 4）

- 搜索框左端显示当前引擎徽标（图标/名称），点击弹出引擎列表（radiogroup）；选中即切换并持久化 `activeSearchEngineId`
- 列表尾部「管理搜索引擎…」打开设置抽屉搜索区
- 默认使用第一个：新建配置默认列表 `[Bing]`；用户手动切换后记住，不强制回到第一个
- `SearchEngineSection` 重构为列表 CRUD：
  - 每行：名称 / keyword / 模板；编辑、删除、上移/下移（键盘可达；不做拖拽排序）
  - 删除当前使用中的引擎 → `activeSearchEngineId` 自动指向列表第一项
  - 至少保留一个引擎，最后一条不可删
  - 预设快速添加：Bing / 百度 / Google / DuckDuckGo（含默认 keyword）
- 模板校验沿用 `{{query}}` + http(s) 白名单（复用 `url-search.ts`）

### 3.2 关键词快速调用（改善 5）

- 输入 `keyword` + 空格（如 `baidu `）→ 切换为该引擎、去除前缀、徽标显示生效引擎；提交搜索后恢复默认引擎
- 匹配大小写不敏感；命中当前引擎自身 keyword 不切换（防误触）；每次输入会话只触发一次
- 纯函数 `src/shared/utils/search-input.ts`：`matchEngineKeyword(input, engines) → { engine, rest } | null`
- 输入恰好等于某 keyword 时显示提示「空格使用 X 搜索」

### 3.3 冲突与边界

- 两引擎同 keyword：取列表靠前者生效
- keyword 编辑与他人重复：非阻断提示（行内 warning），允许保存

## 4. 快捷方式（阶段三）

### 4.1 Dock「+」快捷添加（改善 6a）

- Dock 末尾固定「+」按钮（48px 可点击区），点击弹出添加弹窗
- 表单：网址（必填）、名称（留空取域名）、分组（下拉，默认当前分组）、图标（默认 favicon，可改 emoji/首字母）
- URL 规范化复用现有校验（补 `https://`、http(s) 白名单），非法时行内报错
- Escape / 遮罩点击关闭；焦点圈定弹窗内；确认后立即入库生效

### 4.2 拖拽链接添加（改善 6b）

- 新标签页监听 `dragover`（preventDefault）与 `drop`
- 解析优先级：`text/uri-list` → `text/html` 中 `<a href>` → `text/plain`
- 解析成功 → 弹出与「+」相同的表单并预填 URL/标题；失败 → toast「未能识别拖入的链接」
- 纯函数 `src/shared/utils/dnd-link.ts`：`parseDroppedLink(dataTransfer) → { url, title? } | null`

### 4.3 分组 tab（改善 7）

- Dock 上方分组 tab 条：「全部」+ 各分组（按 `order` 排序）
- **仅当分组数 > 1 时显示**；默认「全部」，不跨会话持久化
- 选中 tab 过滤 Dock 图标；分组的增删改仍在设置抽屉（本次不动）

## 5. 错误处理汇总

| 场景 | 行为 |
| --- | --- |
| 随机池为空 | 回退默认渐变 |
| 随机抽中资产缺失 | 现有 `recovered` 回退链 + 提示 |
| 裁剪输出超 10 MB | 提示重新裁小，不入库 |
| 删除使用中壁纸资产 | 先回退默认渐变再删 |
| 删除使用中搜索引擎 | activeSearchEngineId 指向第一项 |
| 引擎模板非法 | 行内报错，禁止保存 |
| 拖入无法识别内容 | toast 提示，不产生数据 |
| 「+」表单 URL 非法 | 行内报错，禁止提交 |

## 6. 测试策略

- 纯函数单测：迁移 v1→v2、`matchEngineKeyword`、`parseDroppedLink`、`computeCropRect`、随机抽取（注入 fake random）
- 服务层单测：`addWallpaperAsset` 保留多资产、`removeWallpaperAsset` 删除保护、随机解析回退、v2 `parseUserConfig` 校验
- 组件测试：引擎下拉切换、keyword 空格触发、「+」弹窗校验、分组 tab 过滤、壁纸库网格删除确认
- Canvas 裁剪与拖拽投放的浏览器行为：手动验收（extension-browser-verify 流程）
- 基准：现有 160 个测试保持通过；新增约 25–35 用例；每阶段全量测试 + typecheck + build 通过

## 7. 实施阶段

1. **阶段一·壁纸**：v2 模型与迁移链、`addWallpaperAsset`/`removeWallpaperAsset`、裁剪弹层、随机模式与勾选池
2. **阶段二·搜索**：`searchEngines[]` + `activeSearchEngineId`、引擎下拉、列表 CRUD（预设/排序/keyword）、keyword 空格调用
3. **阶段三·快捷方式**：「+」弹窗、拖拽解析与添加、分组 tab 过滤

每阶段独立提交，可独立验收。
