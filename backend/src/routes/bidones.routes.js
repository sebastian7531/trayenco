const { Router } = require('express');
const { verifyToken, requireAdmin } = require('../middleware/auth.middleware');
const { getBidones } = require('../controllers/bidones.controller');

const router = Router();

router.use(verifyToken);
router.use(requireAdmin);
router.get('/', getBidones);

module.exports = router;
