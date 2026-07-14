const { Router } = require('express');
const { verifyToken } = require('../middleware/auth.middleware');
const {
  getStock,
  getStockHoy,
  actualizarPlanta,
  cargarFurgon,
  confirmarEntrega,
  registrarRetorno,
} = require('../controllers/stock.controller');

const router = Router();

router.use(verifyToken);

router.get('/', getStock);
router.get('/hoy', getStockHoy);
router.post('/planta', actualizarPlanta);
router.post('/cargar', cargarFurgon);
router.post('/entrega', confirmarEntrega);
router.post('/retorno', registrarRetorno);

module.exports = router;
