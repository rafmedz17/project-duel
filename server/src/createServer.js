import { createServer } from 'node:http'
import { createEndpoint, createRouter, defineRoom, defineServer } from '@colyseus/core'
import { WebSocketTransport } from '@colyseus/ws-transport'
import { DuelLobbyRoom } from './rooms/DuelLobbyRoom.js'
import { LOBBY } from './config.js'

export function createLobbyServer({ accounts=null } = {}) {
  const httpServer = createServer()
  const server = defineServer({
    greet:false,
    gracefullyShutdown:false,
    transport:new WebSocketTransport({ server:httpServer,maxPayload:4096,pingInterval:3000,pingMaxRetries:2 }),
    rooms:{ [LOBBY.roomType]:defineRoom(class extends DuelLobbyRoom { accounts = accounts }) },
    routes:createRouter({
      health:createEndpoint('/health',{ method:'GET' },async () => ({ status:'ok',service:'project-duel-lobby' })),
    }),
  })
  return { server,httpServer }
}
