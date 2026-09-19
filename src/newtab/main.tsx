import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { ConfigProvider } from './config/config-context'
import './styles/global.css'

const container = document.getElementById('root')
if (!container) {
  throw new Error('根节点 #root 不存在')
}

createRoot(container).render(
  <StrictMode>
    <ConfigProvider>
      <App />
    </ConfigProvider>
  </StrictMode>,
)
