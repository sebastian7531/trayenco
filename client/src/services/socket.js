import { io } from 'socket.io-client'

const socket = io({
  path: '/socket.io',
  autoConnect: false,
})

export const conectarSocket = (rol) => {
  socket.connect()
  socket.emit('unirse_sala', { rol })
}

export const desconectarSocket = () => {
  socket.disconnect()
}

export default socket
