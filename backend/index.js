require('dotenv').config();

if (!process.env.JWT_SECRET) {
  console.error('Falta la variable JWT_SECRET en el archivo .env. El servidor no puede iniciar.');
  process.exit(1);
}

const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const initSockets = require('./src/sockets');

const clienteRoutes = require('./src/routes/cliente.routes');
const authRoutes = require('./src/routes/auth.routes');
const pedidoRoutes = require('./src/routes/pedido.routes');
const rutaRoutes = require('./src/routes/ruta.routes');
const stockRoutes = require('./src/routes/stock.routes');
const asistenciaRoutes = require('./src/routes/asistencia.routes');
const reporteRoutes = require('./src/routes/reporte.routes');
const usuarioRoutes = require('./src/routes/usuario.routes');
const bidonesRoutes = require('./src/routes/bidones.routes');
const zonasRoutes      = require('./src/routes/zonas.routes');
const registroRoutes   = require('./src/routes/registro.routes');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;
const origenesConfigurados = (process.env.CLIENT_URL || '')
  .split(',')
  .map(origen => origen.trim())
  .filter(Boolean);
const corsOrigin = origenesConfigurados.length > 0 ? origenesConfigurados : true;
const io = initSockets(server, corsOrigin);

require('./src/config/db');

// La aplicación recibe tráfico desde un único proxy inverso Nginx.
// Esto permite que express-rate-limit use la IP original de X-Forwarded-For.
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({
  origin: corsOrigin,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '1mb' }));

// Exponer io a los controllers
app.set('io', io);

// Rutas
app.use('/api/auth', authRoutes);
app.use('/api/clientes', clienteRoutes);
app.use('/api/pedidos', pedidoRoutes);
app.use('/api/rutas', rutaRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/asistencia', asistenciaRoutes);
app.use('/api/reportes', reporteRoutes);
app.use('/api/usuarios', usuarioRoutes);
app.use('/api/bidones', bidonesRoutes);
app.use('/api/zonas',      zonasRoutes);
app.use('/api/registros',  registroRoutes);

// Health check
app.get('/', (req, res) => {
  res.json({ message: 'Trayenco API funcionando' });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Puerto ${PORT} ocupado. Liberando...`);
    const { execSync } = require('child_process');
    try {
      execSync(`for /f "tokens=5" %a in ('netstat -ano ^| findstr :${PORT}') do taskkill /PID %a /F`, { shell: 'cmd.exe', stdio: 'ignore' });
    } catch (_) {}
    setTimeout(() => server.listen(PORT), 1000);
  }
});

process.on('SIGTERM', () => server.close());
process.on('SIGINT', () => server.close());
