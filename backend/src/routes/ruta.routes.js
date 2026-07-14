const { Router } = require('express');
const { verifyToken, requireAdmin } = require('../middleware/auth.middleware');
const {
  getRutas,
  getRutaById,
  miRutaHoy,
  createRuta,
  asignarPedidos,
  generarOrdenOptimo,
  actualizarOrden,
  cerrarReparto,
} = require('../controllers/ruta.controller');

const router = Router();

router.use(verifyToken);

router.get('/', getRutas);
router.get('/mi-ruta-hoy', miRutaHoy);
router.get('/:id', getRutaById);
router.post('/', requireAdmin, createRuta);
router.post('/:id/pedidos', requireAdmin, asignarPedidos);
router.post('/:id/optimizar', requireAdmin, generarOrdenOptimo);
router.put('/:id/orden', requireAdmin, actualizarOrden);
router.patch('/:id/cerrar', cerrarReparto);

module.exports = router;
