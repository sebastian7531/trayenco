const express = require('express');
const router = express.Router();
const { verifyToken, requireAdmin } = require('../middleware/auth.middleware');
const ctrl = require('../controllers/usuario.controller');

router.get('/',               verifyToken, requireAdmin, ctrl.getUsuarios);
router.post('/',              verifyToken, requireAdmin, ctrl.createUsuario);
router.put('/:id',            verifyToken, requireAdmin, ctrl.updateUsuario);
router.patch('/:id/password', verifyToken, requireAdmin, ctrl.cambiarPassword);
router.delete('/:id',         verifyToken, requireAdmin, ctrl.deleteUsuario);

module.exports = router;
