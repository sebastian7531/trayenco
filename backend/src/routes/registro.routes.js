const { Router } = require('express');
const { verifyToken, requireAdmin } = require('../middleware/auth.middleware');
const { getRegistros, getResumen } = require('../controllers/registro.controller');

const router = Router();

router.use(verifyToken);
router.use(requireAdmin);

router.get('/',        getRegistros);
router.get('/resumen', getResumen);

module.exports = router;
