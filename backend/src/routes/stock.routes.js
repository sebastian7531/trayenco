const { Router } = require('express');
const { verifyToken, requireAdmin } = require('../middleware/auth.middleware');
const {
  getStock,
  getStockHoy,
  actualizarPlanta,
  cargarFurgon,
  registrarRetorno,
} = require('../controllers/stock.controller');

const router = Router();

router.use(verifyToken);

router.get('/', getStock);
router.get('/hoy', getStockHoy);
router.post('/planta', requireAdmin, actualizarPlanta);
router.post('/cargar', requireAdmin, cargarFurgon);
router.post('/retorno', requireAdmin, registrarRetorno);

module.exports = router;
