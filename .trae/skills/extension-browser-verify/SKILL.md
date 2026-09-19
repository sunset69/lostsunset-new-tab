---
name: extension-browser-verify
description: Browser-verify the LostSunset new-tab extension via chrome-devtools MCP (storage reset, UI flows, downloads, WebDAV mock, console, responsive). Use for milestone acceptance or page-level regression, not unit tests.
---

# 扩展页面浏览器验证（chrome-devtools MCP）

对 LostSunset 新标签页扩展做真实浏览器验证。单元/组件测试走 vitest，本 skill 只处理必须在浏览器里闭合的链路。

## 1. 启动与打开页面

1. 开发态：后台执行 `npm run dev -- --port 5173 --strictPort`，页面地址 `http://localhost:5173/src/newtab/index.html`。
2. 生产包验证：`npm run build` 后后台执行 `npx vite preview --port 4174 --strictPort`，地址 `http://localhost:4174/src/newtab/index.html`。
3. MCP `new_page` 时带 `isolatedContext`（如 `mN-verify`）获得干净的 cookie/storage 上下文；任务结束后用 StopCommand 停后台进程。
4. PowerShell 命令串联用 `;` 不用 `&&`；npm 的 `Unknown user config "virtual-store-dir-max-length"` 警告可忽略。

## 2. 每次回归前清存储

配置在 localStorage（dev 预览）或 chrome.storage（扩展），壁纸资产在 IndexedDB（库名 `lostsunset-new-tab`）。用 `evaluate_script` 执行后再 `navigate_page` reload：

```js
async () => {
  localStorage.clear()
  const dbs = await indexedDB.databases()
  await Promise.all(dbs.map(d => new Promise(resolve => {
    const req = indexedDB.deleteDatabase(d.name)
    req.onsuccess = req.onerror = req.onblocked = () => resolve()
  })))
  return { keys: Object.keys(localStorage), dbs: dbs.map(d => d.name) }
}
```

## 3. 交互范式：快照 → uid → 操作

1. 先 `take_snapshot` 取最新 a11y 树，元素标识是其中的 `uid`（如 `18_44`）；**每次操作后旧 uid 可能失效**，需要重新快照或让 click/fill 带 `includeSnapshot`。
2. 文本输入用 `fill`（React 受控组件可直接用）；勾选 checkbox 用 `fill` value `"true"`/`"false"`，或对 checkbox 本身 `click`。
3. **该 MCP 没有 select_option 工具**（调用会报 "MCP server is not found"）。原生 `<select>` 用 evaluate 触发：
   ```js
   const sel = document.querySelector('select')
   const id = [...sel.options].find(o => o.textContent === '公司内网').value // option 值是 env-id 而非文案
   const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set
   setter.call(sel, id)
   sel.dispatchEvent(new Event('change', { bubbles: true }))
   ```
   React 状态提交有延迟，断言前等 300–500ms 再读。
4. 点击后若有异步请求，用 `evaluate_script` 内 `await new Promise(r => setTimeout(r, 800))` 再读状态，不要假设同步完成。
5. 断言优先读 DOM 文本而非截图 OCR，例如：

```js
() => [...document.querySelectorAll('#settings-section-backup .backup-status')]
  .map(e => ({ cls: e.className, text: e.textContent }))
```

6. 已知交互细节：快捷方式删除是二次点击（按钮先变「确认删除？」）；抽屉可用 Esc 关闭；搜索按钮提交会真实跳转离开页面。
7. **不要对 combobox/select 用 `click` 的 `dblClick`**——首次点击会打开原生弹层导致 "did not become interactive" 超时。排查「select 文字出现蓝色高亮」类样式问题：`appearance: none` 的 select 在 Chrome/Windows 下文字可被双击/拖选，先读 `window.getSelection()` 取证，修复用 `user-select: none`。

### 搜索跳转无法打桩

`window.location.assign` 在 `Location.prototype` 上不可写（sloppy 模式静默失败，strict 抛 TypeError）。不要试图拦截搜索跳转：直接点击搜索，MCP 的 click 返回里会带上 "Page navigated to <编码后的 URL>"，断言 URL 编码后用 `navigate_page` 回扩展页即可。

## 4. 文件上传与下载

- 导入文件：对隐藏的 `<input type=file>` 的 uid 用 `upload_file`，`filePaths` 给浏览器本机绝对路径；准备测试文件放 `%TEMP%`，结束后删除。
- 验证导出下载时浏览器不会真的弹保存框，在点击前用 `evaluate_script` 打桩：
  - `HTMLAnchorElement.prototype.click` **可写**，直接包一层捕获 `download` 文件名即可；
  - 要读内容：同时包 `URL.createObjectURL` 保存 Blob，再 `await blob.text()`；`revokeObjectURL` 包成空函数避免误释放。
- 恢复时务必断言 `localStorage.getItem('localBackup.beforeImport')` 的 `reason`（`manual-import` / `webdav-restore`），且其 config 是恢复前旧配置。
- 构造导入样本时注意数据契约：备份里 `settings.wallpaper.value`（gradient 模式）是**完整 CSS 渐变串**（如 `linear-gradient(135deg, #020617 …)`），不是预设 id（`gradient-aurora` 是错的，会被浏览器当成非法 background-image 丢弃而静默回退默认背景）；option/环境 id 才是 `env-*`。

## 5. WebDAV 链路用本地 mock

不要依赖外部 WebDAV 服务。运行 `node scripts/mock-webdav.mjs <port> <user> <pass>`（默认 8899/test/test），它实现：CORS 预检与头、Basic Auth（错误凭据返回 401）、HEAD（已存文件 200，否则 404，根路径恒 200）、GET、PUT（201，内存存储）。请求会打印到控制台便于核对实际 URL 与状态码。

典型用例顺序：
1. 错误密码 → 界面出现「用户名或密码错误」（401）。
2. 正确密码测试连接成功（客户端只 HEAD 服务根路径 `/`）；改错误端口 →「无法连接服务器，请检查地址和网络」。
3. 首次上传：HEAD 文件路径 404 → PUT 201；再次上传：HEAD 200 → 必须出现覆盖确认条 → 确认后才 PUT。
4. 恢复后检查摘要卡（时间/版本/引擎/环境数/快捷方式数/壁纸类型）、自动备份 reason、配置实际变更。
5. dev 预览页走页面 fetch 直连（mock 必须带 CORS 头）。

## 6. 扩展边界（重要，勿重复踩坑）

- MCP 的 `install_extension` 不可用，**无法通过 MCP 加载未打包扩展**；chrome.permissions 主机权限弹窗只能由人工在 `chrome://extensions` 加载 `dist/` 验收，不要反复尝试自动化安装。
- dev/preview 普通页面没有 `chrome.*`，传输层自动降级为页面 fetch、权限层直接放行——这是设计行为，不是 bug。
- Service Worker 链路（sendMessage → fetch executor）由 `webdav-handler.test.ts` 等单测覆盖，浏览器端只验收页面直连路径。

## 7. 收尾检查

1. `list_console_messages`（types 选 error/warn）：允许的预期错误只有故意用例产生的网络错误——401（错误密码）、`net::ERR_CONNECTION_REFUSED`（错误端口）、404（首次上传 HEAD 探测），以及内网假地址快捷方式的 favicon `ERR_CONNECTION_TIMED_OUT`（设计上回退标题首字）。用 `list_network_requests` 逐条核对 URL 归因，其余必须为零。
2. `resize_page` 在浏览器窗口最大化时会报 "Restore window to normal state before setting content size"；改用 `emulate` 的 `viewport: "1280x800x1"` / `"1366x768x1"`，截完图再调一次无参 `emulate` 复位。
3. `take_screenshot` 存到 `%TEMP%` 并 Read 查看布局；截图不落仓库。
4. 生产包额外用 `evaluate_script` fetch 关键资源（`/icons/icon-128.png`、`/newtab.svg`、`/manifest.json`）确认全部 200。
5. 停掉所有后台任务（dev/mock/preview），删除 `%TEMP%` 下的临时测试文件与截图。

## 8. 环境已知坑

- Node 25 自带的 `localStorage` 是需 `--localstorage-file` 的空壳，jsdom 会透传；测试里用 `src/test/local-storage-shim.ts`，浏览器 MCP 里它是真实实现不受影响。
- 不要用 `vi.stubGlobal('URL', { ...URL })`，展开会丢失构造能力导致 `new URL()` 抛错；只改静态方法（`URL.createObjectURL = vi.fn(...)`）。
- vitest 锁 4.1.11、jsdom 29.1.1；tsx 测试顶部加 `// @vitest-environment jsdom`，且必须 `import { describe, it } from 'vitest'`。
