import { createLobbyServer } from './createServer.js'
import { createAccountsService } from './accounts.js'
import { loadEnvFile } from 'node:process'

try { loadEnvFile('.env') } catch (error) { if (error.code!=='ENOENT') throw error }

const port = Number(process.env.PORT || 2567)
const host = process.env.HOST || '127.0.0.1'
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer between 1 and 65535.')
const accounts = createAccountsService()
const { server } = createLobbyServer({ accounts })
let stopping = false
async function stop() {
  if (stopping) return
  stopping = true
  await server.gracefullyShutdown(false)
  accounts.close()
}
process.once('SIGINT',() => { stop().catch(console.error) })
process.once('SIGTERM',() => { stop().catch(console.error) })
await server.listen(port,host)
console.log(`PROJECT DUEL lobby listening at http://${host}:${port}`)
