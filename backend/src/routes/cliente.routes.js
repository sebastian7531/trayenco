const { Router } = require('express');
const { verifyToken, requireAdmin } = require('../middleware/auth.middleware');
const {
  getClientes,
  getClienteById,
  createCliente,
  updateCliente,
  deleteCliente,
  updateCoordenadas,
  getClientesProblemasEntrega,
} = require('../controllers/cliente.controller');

const router = Router();

router.use(verifyToken);
router.use(requireAdmin);

router.get('/problemas-entrega', getClientesProblemasEntrega);
router.get('/', getClientes);
router.get('/:id', getClienteById);
router.post('/', createCliente);
router.put('/:id', updateCliente);
router.delete('/:id', deleteCliente);
router.patch('/:id/coordenadas', updateCoordenadas);

module.exports = router;
