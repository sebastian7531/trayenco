const jwt = require('jsonwebtoken');
const { error } = require('../utils/response');

const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return error(res, 'Token requerido', 401);
  }

  const token = authHeader.split(' ')[1];
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (_) {
    return error(res, 'Token inválido o expirado', 401);
  }
};

const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.rol !== 'administrador') {
    return error(res, 'Acceso denegado: se requiere rol administrador', 403);
  }
  next();
};

module.exports = { verifyToken, requireAdmin };
