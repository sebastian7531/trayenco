const { Router } = require('express');
const rateLimit = require('express-rate-limit');
const { login, me } = require('../controllers/auth.controller');
const { verifyToken } = require('../middleware/auth.middleware');

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Demasiados intentos de inicio de sesión. Intente nuevamente en unos minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/login', loginLimiter, login);
router.get('/me', verifyToken, me);

module.exports = router;
