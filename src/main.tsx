import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { LocaleProvider } from './i18n'
import { applyDocumentTheme, readStoredTheme } from './theme/theme'
import './index.css'

// CSP 禁止內嵌腳本；在 React 首次渲染前套用偏好，避免錯誤主題的首幀。
applyDocumentTheme(readStoredTheme())

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <LocaleProvider>
      <App />
    </LocaleProvider>
  </React.StrictMode>,
)
