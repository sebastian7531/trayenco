import { io } from 'socket.io-client'

const SOCKET_URL = `http://${window.location.hostname}:3001`

const socket = io(SOCKET_URL, {
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
