const { Server } = require('socket.io');

const initSockets = (server) => {
  const io = new Server(server, {
    cors: {
      origin: true,
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    console.log(`[Socket] Conectado: ${socket.id}`);

    socket.on('unirse_sala', ({ rol }) => {
      if (rol === 'administrador') {
        socket.join('administradores');
        console.log(`[Socket] ${socket.id} unido a sala: administradores`);
      } else if (rol === 'repartidor') {
        socket.join('repartidores');
        console.log(`[Socket] ${socket.id} unido a sala: repartidores`);
      }
    });

    socket.on('disconnect', () => {
      console.log(`[Socket] Desconectado: ${socket.id}`);
    });
  });

  return io;
};

module.exports = initSockets;
