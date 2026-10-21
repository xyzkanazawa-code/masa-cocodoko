import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    target: ['es2015', 'safari13'], // 古いスマートフォン（iOSやAndroid）でもJavaScriptエラーでクラッシュするのを防ぐ極限安全設計
    cssTarget: 'chrome61'
  }
})
