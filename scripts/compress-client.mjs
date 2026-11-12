import { readdir,readFile,writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { brotliCompressSync,gzipSync,constants } from 'node:zlib'
import { fileURLToPath } from 'node:url'

async function compress(directory) {
  for (const entry of await readdir(directory,{ withFileTypes:true })) {
    const file = join(directory,entry.name)
    if (entry.isDirectory()) { if (!entry.name.startsWith('.')) await compress(file); continue }
    if (!/\.(js|css|html|svg|wasm)$/.test(entry.name)) continue
    const data = await readFile(file)
    await Promise.all([
      writeFile(`${file}.br`,brotliCompressSync(data,{ params:{ [constants.BROTLI_PARAM_QUALITY]:9 } })),
      writeFile(`${file}.gz`,gzipSync(data,{ level:9 })),
    ])
  }
}
await compress(fileURLToPath(new URL('../client/dist/',import.meta.url)))
