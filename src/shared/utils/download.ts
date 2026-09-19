/**
 * 浏览器文件下载适配器（设计文档 6.5 第 3 步）。
 * 不声明 downloads 权限，使用 a[download] + Blob 触发本地保存。
 */
export function downloadTextFile(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  // 让浏览器有时间开始下载后再释放对象 URL。
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
