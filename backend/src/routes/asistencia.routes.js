const { Router } = require('express');
const { verifyToken } = require('../middleware/auth.middleware');
const {
  getAsistencia,
  getAsistenciaHoy,
  registrarEntrada,
  registrarSalida,
  getReporteAsistencia,
} = require('../controllers/asistencia.controller');

const router = Router();

router.use(verifyToken);

router.get('/', getAsistencia);
router.get('/hoy', getAsistenciaHoy);
router.post('/entrada', registrarEntrada);
router.post('/salida', registrarSalida);
router.get('/reporte/:repartidor_id', getReporteAsistencia);

module.exports = router;
