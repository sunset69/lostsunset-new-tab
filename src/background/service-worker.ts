/**
 * 薄 Service Worker（设计文档 4.1 / 4.2）。
 *
 * - 仅保留生命周期入口，不保存任何运行时状态（MV3 Service Worker 可能随时终止）。
 * - 首次安装的默认配置由新标签页 ConfigStore 加载时写入。
 * - M4：注册用户手动触发的 WebDAV GET/PUT/HEAD 消息处理。
 */
import { registerWebDavHandler } from './webdav-handler'

registerWebDavHandler()

chrome.runtime.onInstalled.addListener((details) => {
  console.info(`[lostsunset-new-tab] onInstalled: ${details.reason}`)
})
