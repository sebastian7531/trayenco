const { Router } = require('express');
const { verifyToken, requireAdmin } = require('../middleware/auth.middleware');
const { getZonas, createZona, updateZona, deleteZona, getZonasRecurrentes } = require('../controllers/zonas.controller');

const router = Router();

router.use(verifyToken);
router.use(requireAdmin);

router.get('/recurrentes', getZonasRecurrentes);
router.get('/', getZonas);
router.post('/', createZona);
router.put('/:id', updateZona);
router.delete('/:id', deleteZona);

module.exports = router;
