const { Router } = require('express');
const { verifyToken, requireAdmin } = require('../middleware/auth.middleware');
const { error } = require('../utils/response');
const {
  getAsistencia,
  getAsistenciaHoy,
  registrarEntrada,
  registrarSalida,
  getReporteAsistencia,
} = require('../controllers/asistencia.controller');

const router = Router();

const requireRepartidor = (req, res, next) => {
  if (!req.user || req.user.rol !== 'repartidor') {
    return error(res, 'Acceso denegado: se requiere rol repartidor', 403);
  }
  next();
};

router.use(verifyToken);

router.get('/hoy', getAsistenciaHoy);
router.get('/', requireAdmin, getAsistencia);
router.post('/entrada', requireRepartidor, registrarEntrada);
router.post('/salida', requireRepartidor, registrarSalida);
router.get(
  '/reporte/:repartidor_id',
  requireAdmin,
  getReporteAsistencia
);

module.exports = router;
