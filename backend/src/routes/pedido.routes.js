const { Router } = require('express');
const { verifyToken, requireAdmin } = require('../middleware/auth.middleware');
const {
  getPedidos,
  getPedidoById,
  createPedido,
  updatePedido,
  cambiarEstado,
  deletePedido,
  getPedidosPendientesPorZonas,
} = require('../controllers/pedido.controller');

const router = Router();

router.use(verifyToken);

router.get('/', getPedidos);
router.get('/pendientes', getPedidosPendientesPorZonas);
router.get('/:id', getPedidoById);
router.post('/', requireAdmin, createPedido);
router.put('/:id', requireAdmin, updatePedido);
router.patch('/:id/estado', cambiarEstado);
router.delete('/:id', requireAdmin, deletePedido);

module.exports = router;
