import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests', timeout: 60000, workers: 1,
  use: { baseURL: 'http://127.0.0.1:5173', viewport: { width: 1280, height: 800 },
    launchOptions: { executablePath: globalThis.process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined, args: ['--enable-unsafe-swiftshader'] },
  },
  webServer: [
    { command:'npm run dev -- --host 127.0.0.1',url:'http://127.0.0.1:5173',reuseExistingServer:true },
    { command:'npm --prefix ../server start',url:'http://127.0.0.1:2567/health',reuseExistingServer:true },
  ],
})
