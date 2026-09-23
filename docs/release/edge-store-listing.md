# Edge Add-ons 上架清单（Microsoft Edge 合作伙伴中心）

包：`release/lostsunset-new-tab-v0.2.0.zip`（351 KB，MV3，与 Chrome Web Store 同包）｜ 商店资料通用文案见 [web-store-listing.md](./web-store-listing.md)

## 0. 前置条件（一次性）

1. Microsoft 账号（个人即可）。
2. 注册 Edge 扩展开发者计划：<https://partner.microsoft.com/dashboard/microsoftedge/overview> → 勾选注册开发者计划，一次性注册费 **$19**（个人或公司账户均同价）。
3. 注册审核通常即时到数小时内通过，随后进入「合作伙伴中心」仪表板。

## 1. 创建扩展与上传

1. 合作伙伴中心 → **Edge 扩展** → 概述 → **创建新扩展**。
2. 上传 `release/lostsunset-new-tab-v0.2.0.zip`。
3. Edge 直接兼容 Chrome MV3 清单，本包无需任何改动。

## 2. 商店资料（逐字段）

| 表单字段 | 填写内容 | 限制 |
| --- | --- | --- |
| 显示名称 | `LostSunset New Tab（落日起始页）` | ≤50 字符 |
| 简短说明 | `沉浸式壁纸新标签页：时钟搜索、快捷方式 Dock、内网环境变量，配置可本地/WebDAV 备份。` | ≤200 字符 |
| 详细说明 | 复制 [web-store-listing.md](./web-store-listing.md) 第 1 节「详细描述」全文（约 700 字） | ≤3000 字符（如超限按官方表单提示精简） |
| 类别 | Productivity（效率） | — |
| 隐私政策 URL | `https://github.com/sunset69/lostsunset-new-tab/blob/main/docs/privacy-policy.md` | 必填 |
| 网站 URL | `https://github.com/sunset69/lostsunset-new-tab` | 可选 |
| 支持联系 URL | `https://github.com/sunset69/lostsunset-new-tab/issues` | 建议填 |

## 3. 商店资产

| 资产 | 规格 | 文件 |
| --- | --- | --- |
| 商店徽标 | 300×300 PNG | `docs/store-assets/store-logo-300.png` |
| 屏幕截图 | 1280×800 PNG，1–10 张 | `docs/store-assets/screenshots/` |

截图清单（按展示顺序）：

1. `home.png` — 首页全景：时钟、问候语、搜索框、快捷方式 Dock
2. `settings-wallpaper.png` — 设置抽屉·壁纸：预设/上传/随机池
3. `dock-context-menu.png` — 快捷方式右键菜单：编辑/删除
4. `settings-backup.png` — 设置抽屉·备份与同步：JSON 导出 + WebDAV
5. `settings-shortcuts.png` — 设置抽屉·快捷方式：分组与编辑

## 4. 数据使用声明

- 「你的扩展是否收集个人信息？」→ **否**（全部数据仅存本机，详见隐私政策）。
- 若表单要求按权限逐条说明，粘贴 [web-store-listing.md](./web-store-listing.md) 第 3 节表格。

## 5. 提交审核备注（可选字段，建议填写）

> 本扩展覆盖浏览器新标签页，为用户提供可自定义的起始页（时钟、搜索、快捷方式）。配置仅保存在本机 chrome.storage.local 与 IndexedDB，无任何数据收集与遥测。`optional_host_permissions` 仅在用户主动配置 WebDAV 备份时，针对用户填写的具体服务器地址弹窗申请；拒绝授权不影响其余功能。未申请 tabs/history 等敏感权限。

## 6. 提交与审核

1. 检查「认证说明」与全部资产 → **提交**。
2. 认证一般 1–7 个工作日；状态在仪表板「概述」页跟踪（`In review` → `In the Microsoft Edge Add-ons store`）。
3. 被拒时按反馈修改后重新上传同一版本或升 patch 版本再提交。

## 7. 发布前自查

- [ ] ZIP 为最新构建（`node -p "require('./dist/manifest.json').version"` = 0.2.0，包内 manifest 一致）
- [ ] 商店徽标 300×300、截图 1280×800 均为最终版
- [ ] 隐私政策 URL 在浏览器无痕窗口可公开访问（GitHub 仓库为 public）
- [ ] 截图中不含真实内网地址 / 用户凭据
- [ ] 按 [manual-acceptance-checklist.md](./manual-acceptance-checklist.md) 在 Edge 上手工过一遍
