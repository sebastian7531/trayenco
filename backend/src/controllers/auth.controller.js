const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { success, error } = require('../utils/response');

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await pool.query(
      'SELECT * FROM repartidor WHERE email = $1',
      [email]
    );
    if (result.rows.length === 0) {
      return error(res, 'Credenciales inválidas', 401);
    }

    const repartidor = result.rows[0];
    const passwordValido = await bcrypt.compare(password, repartidor.password);
    if (!passwordValido) {
      return error(res, 'Credenciales inválidas', 401);
    }

    const payload = { id: repartidor.id_repartidor, nombre: repartidor.nombre, email: repartidor.email, rol: repartidor.rol };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });

    return success(res, { token, repartidor: payload }, 'Login exitoso');
  } catch (err) {
    return error(res, err.message);
  }
};

const me = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id_repartidor, nombre, email, rol FROM repartidor WHERE id_repartidor = $1',
      [req.user.id]
    );
    if (result.rows.length === 0) {
      return error(res, 'Repartidor no encontrado', 404);
    }
    return success(res, result.rows[0]);
  } catch (err) {
    return error(res, err.message);
  }
};

module.exports = { login, me };
