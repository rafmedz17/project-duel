import { createServer } from 'node:http'
import { createEndpoint, createRouter, defineRoom, defineServer } from '@colyseus/core'
import { WebSocketTransport } from '@colyseus/ws-transport'
import { DuelLobbyRoom } from './rooms/DuelLobbyRoom.js'
import { LOBBY } from './config.js'
import { createStaticHandler } from './static.js'

export function createLobbyServer({ accounts=null,clientDirectory,allowedOrigins=[] } = {}) {
  const httpServer = createServer()
  const staticHandler = clientDirectory ? createStaticHandler(clientDirectory) : null
  const checkOrigin = request => {
    const origin = request.headers.get('origin')
    if (origin && allowedOrigins.length && !allowedOrigins.includes(origin)) return new Response('Origin not allowed',{ status:403 })
  }
  const server = defineServer({
    greet:false,
    gracefullyShutdown:false,
    ...(staticHandler ? { express:app => {
      // Write static bodies directly. The installed router's Node stream adapter
      // can leave a response open after backpressure on large WASM/JS assets.
      const serve = async (req,res,next) => {
        try {
          const request = new Request(`http://localhost${req.url}`,{ method:req.method,headers:req.headers })
          const response = checkOrigin(request) || await staticHandler(request)
          const body = Buffer.from(await response.arrayBuffer())
          res.writeHead(response.status,Object.fromEntries(response.headers))
          res.end(req.method==='HEAD' ? undefined : body)
        } catch (error) { next(error) }
      }
      app.get('/',serve)
      app.use(serve)
    } } : {}),
    transport:new WebSocketTransport({ server:httpServer,maxPayload:4096,pingInterval:3000,pingMaxRetries:2,beforeUpgrade:checkOrigin }),
    rooms:{ [LOBBY.roomType]:defineRoom(class extends DuelLobbyRoom { accounts = accounts }) },
    routes:createRouter({
      health:createEndpoint('/health',{ method:'GET' },async () => ({ status:'ok',service:'project-duel-lobby' })),
    },{ onRequest:checkOrigin }),
  })
  return { server,httpServer }
}
