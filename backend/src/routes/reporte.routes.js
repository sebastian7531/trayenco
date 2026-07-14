const { Router } = require('express');
const { verifyToken, requireAdmin } = require('../middleware/auth.middleware');
const {
  resumenDiario,
  pedidosPorPeriodo,
  rendimientoReparto,
  stockHistorico,
  clientesFrecuentes,
} = require('../controllers/reporte.controller');

const router = Router();

router.use(verifyToken);
router.use(requireAdmin);

router.get('/diario', resumenDiario);
router.get('/pedidos', pedidosPorPeriodo);
router.get('/rendimiento', rendimientoReparto);
router.get('/stock', stockHistorico);
router.get('/clientes-frecuentes', clientesFrecuentes);

module.exports = router;
