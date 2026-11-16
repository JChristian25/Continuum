import { spawn } from 'node:child_process'
import fs from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

function isPortOpen(host, port) {
  return new Promise(resolve => {
    const socket = net.createConnection({ host, port })
    socket.setTimeout(350)
    socket.once('connect', () => { socket.destroy(); resolve(true) })
    socket.once('timeout', () => { socket.destroy(); resolve(false) })
    socket.once('error', () => { socket.destroy(); resolve(false) })
  })
}

function readLocalEnv(envFile) {
  if (!fs.existsSync(envFile)) return {}
  const env = {}
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    if (!line || line.trim().startsWith('#')) continue
    const idx = line.indexOf('=')
    if (idx > 0) env[line.slice(0, idx).trim()] = line.slice(idx + 1)
  }
  return env
}

function localApiAutoStart() {
  let apiChild = null
  return {
    name: 'continuum-local-api-autostart',
    async configureServer(server) {
      if (process.env.CONTINUUM_API_TARGET) return
      const repoRoot = fileURLToPath(new URL('../../', import.meta.url))
      const pythonBin = path.join(repoRoot, 'services', 'api', '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python')
      if (!fs.existsSync(pythonBin)) return
      if (await isPortOpen('127.0.0.1', 8787)) return
      const localEnv = readLocalEnv(path.join(repoRoot, 'services', 'api', '.env'))
      apiChild = spawn(pythonBin, ['-m', 'uvicorn', 'continuum.main:app_factory', '--factory', '--host', '127.0.0.1', '--port', '8787'], {
        cwd: repoRoot,
        env: { ...process.env, ...localEnv, CONTINUUM_ORIGIN: 'http://localhost:5173', CONTINUUM_LOCAL_HTTP: '1' },
        stdio: 'ignore',
      })
      server.httpServer?.once('close', () => {
        if (apiChild && !apiChild.killed) apiChild.kill()
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), localApiAutoStart()],
  resolve: { dedupe: ['react', 'react-dom'] },
  // Prebundle lazy-screen primitives together so they share the renderer's React.
  optimizeDeps: {
    include: [
      'react', 'react-dom/client', 'react/jsx-runtime', 'react/jsx-dev-runtime',
      '@base-ui/react/button', '@base-ui/react/checkbox', '@base-ui/react/dialog',
      '@base-ui/react/menu', '@base-ui/react/select',
      '@radix-ui/react-slot', '@radix-ui/react-tabs', '@radix-ui/react-tooltip',
      'cmdk', 'sonner',
    ],
  },
  server: {
    host: 'localhost',
    port: 5173,
    strictPort: true,
    proxy: { '/api': { target: process.env.CONTINUUM_API_TARGET || 'http://127.0.0.1:8787' } },
  },
})
