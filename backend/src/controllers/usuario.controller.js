const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const { success, error } = require('../utils/response');

const getUsuarios = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id_repartidor, nombre, email, rol FROM repartidor ORDER BY nombre ASC'
    );
    return success(res, result.rows);
  } catch (err) {
    return error(res, err.message);
  }
};

const createUsuario = async (req, res) => {
  try {
    const { nombre, email, password, rol } = req.body;

    if (!nombre || !nombre.trim()) return error(res, 'El nombre es requerido', 400);
    if (!email || !email.trim()) return error(res, 'El email es requerido', 400);
    if (!password) return error(res, 'La contraseña es requerida', 400);
    if (password.length < 6) return error(res, 'La contraseña debe tener al menos 6 caracteres', 400);

    const existing = await pool.query(
      'SELECT id_repartidor FROM repartidor WHERE email = $1',
      [email.trim().toLowerCase()]
    );
    if (existing.rows.length > 0) return error(res, 'Ya existe un repartidor con ese email', 400);

    const hash = await bcrypt.hash(password, 10);
    const rolFinal = rol === 'administrador' ? 'administrador' : 'repartidor';
    const result = await pool.query(
      `INSERT INTO repartidor (nombre, email, password, rol) VALUES ($1, $2, $3, $4)
       RETURNING id_repartidor, nombre, email, rol`,
      [nombre.trim(), email.trim().toLowerCase(), hash, rolFinal]
    );
    return success(res, result.rows[0], 'Repartidor creado', 201);
  } catch (err) {
    return error(res, err.message);
  }
};

const updateUsuario = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, email, rol } = req.body;

    if (!nombre || !nombre.trim()) return error(res, 'El nombre es requerido', 400);
    if (!email || !email.trim()) return error(res, 'El email es requerido', 400);

    const existing = await pool.query(
      'SELECT id_repartidor FROM repartidor WHERE email = $1 AND id_repartidor != $2',
      [email.trim().toLowerCase(), id]
    );
    if (existing.rows.length > 0) return error(res, 'Ya existe un repartidor con ese email', 400);

    const rolFinal = rol === 'administrador' ? 'administrador' : 'repartidor';
    const result = await pool.query(
      `UPDATE repartidor SET nombre = $1, email = $2, rol = $3 WHERE id_repartidor = $4
       RETURNING id_repartidor, nombre, email, rol`,
      [nombre.trim(), email.trim().toLowerCase(), rolFinal, id]
    );
    if (result.rows.length === 0) return error(res, 'Repartidor no encontrado', 404);
    return success(res, result.rows[0], 'Repartidor actualizado');
  } catch (err) {
    return error(res, err.message);
  }
};

const cambiarPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { password_nuevo } = req.body;

    if (!password_nuevo) return error(res, 'La contraseña nueva es requerida', 400);
    if (password_nuevo.length < 6) return error(res, 'La contraseña debe tener al menos 6 caracteres', 400);

    const hash = await bcrypt.hash(password_nuevo, 10);
    const result = await pool.query(
      'UPDATE repartidor SET password = $1 WHERE id_repartidor = $2 RETURNING id_repartidor',
      [hash, id]
    );
    if (result.rows.length === 0) return error(res, 'Repartidor no encontrado', 404);
    return success(res, null, 'Contraseña actualizada');
  } catch (err) {
    return error(res, err.message);
  }
};

const deleteUsuario = async (req, res) => {
  try {
    const { id } = req.params;

    if (parseInt(id) === req.user.id) {
      return error(res, 'No puedes eliminar tu propia cuenta', 400);
    }

    const usuario = await pool.query(
      'SELECT id_repartidor, rol FROM repartidor WHERE id_repartidor = $1',
      [id]
    );
    if (usuario.rows.length === 0) return error(res, 'Repartidor no encontrado', 404);

    if (usuario.rows[0].rol === 'administrador') {
      const conteo = await pool.query(
        "SELECT COUNT(*)::int AS total FROM repartidor WHERE rol = 'administrador'"
      );
      if (conteo.rows[0].total <= 1) {
        return error(res, 'No se puede eliminar el único administrador del sistema', 400);
      }
    }

    await pool.query('DELETE FROM repartidor WHERE id_repartidor = $1', [id]);
    return success(res, null, 'Repartidor eliminado');
  } catch (err) {
    return error(res, err.message);
  }
};

module.exports = { getUsuarios, createUsuario, updateUsuario, cambiarPassword, deleteUsuario };
