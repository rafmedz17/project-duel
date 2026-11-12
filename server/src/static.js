import { readFile, stat } from 'node:fs/promises'
import { resolve, relative, extname, sep } from 'node:path'

const types = { '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.webp':'image/webp','.woff2':'font/woff2','.wasm':'application/wasm' }
const headers = {
  'x-content-type-options':'nosniff','referrer-policy':'strict-origin-when-cross-origin',
  'content-security-policy':"default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' https://*.supabase.co wss://*.supabase.co; worker-src 'self' blob:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
}

export function createStaticHandler(directory) {
  const root = resolve(directory)
  return async request => {
    if (!['GET','HEAD'].includes(request.method)) return new Response('Method not allowed',{ status:405 })
    let pathname
    try { pathname = decodeURIComponent(new URL(request.url).pathname) } catch { return new Response('Invalid path',{ status:400 }) }
    if (pathname.includes('\\') || pathname.includes('\0') || pathname.split('/').some(part => part.startsWith('.'))) return new Response('Not found',{ status:404 })
    let file = resolve(root,`.${pathname==='/' ? '/index.html' : pathname}`)
    const local = relative(root,file)
    if (local.startsWith(`..${sep}`) || local==='..') return new Response('Not found',{ status:404 })
    if (!extname(file)) file = resolve(root,'index.html')
    const type = types[extname(file)]
    if (!type) return new Response('Not found',{ status:404 })
    let encoding = ''
    const accepted = (request.headers.get('accept-encoding') || '').split(',').map(value => value.trim().split(';')).filter(([,q]) => !q || !/^\s*q=0(?:\.0*)?\s*$/.test(q)).map(([name]) => name)
    for (const [name,suffix] of [['br','.br'],['gzip','.gz']]) {
      if (!accepted.includes(name)) continue
      try { if ((await stat(file+suffix)).isFile()) { file += suffix; encoding = name; break } } catch { /* Fall back to the original file. */ }
    }
    try {
      const data = await readFile(file)
      const responseHeaders = { ...headers,'content-type':type,'cache-control':pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache','content-length':String(data.length),vary:'Accept-Encoding' }
      if (encoding) responseHeaders['content-encoding'] = encoding
      return new Response(request.method==='HEAD' ? null : data,{ headers:responseHeaders })
    } catch (error) {
      if (['ENOENT','EISDIR','ENOTDIR'].includes(error.code)) return new Response('Not found',{ status:404 })
      throw error
    }
  }
}
