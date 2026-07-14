const pool = require('../config/db');
const { success, error } = require('../utils/response');

const getZonas = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT z.*, COUNT(c.id_cliente) FILTER (WHERE c.activo = true)::int AS total_clientes
      FROM zona z
      LEFT JOIN clientes c ON c.cod_zona = z.cod_zona
      GROUP BY z.cod_zona
      ORDER BY z.nombre ASC
    `);
    return success(res, result.rows);
  } catch (err) {
    return error(res, err.message);
  }
};

const createZona = async (req, res) => {
  const { nombre, descripcion } = req.body;
  if (!nombre?.trim()) return error(res, 'El nombre es requerido', 400);
  try {
    const result = await pool.query(
      'INSERT INTO zona (nombre, descripcion) VALUES ($1, $2) RETURNING *',
      [nombre.trim(), descripcion?.trim() || null]
    );
    return success(res, result.rows[0], 201);
  } catch (err) {
    return error(res, err.message);
  }
};

const updateZona = async (req, res) => {
  const { id } = req.params;
  const { nombre, descripcion } = req.body;
  if (!nombre?.trim()) return error(res, 'El nombre es requerido', 400);
  try {
    const result = await pool.query(
      'UPDATE zona SET nombre = $1, descripcion = $2 WHERE cod_zona = $3 RETURNING *',
      [nombre.trim(), descripcion?.trim() || null, id]
    );
    if (result.rows.length === 0) return error(res, 'Zona no encontrada', 404);
    return success(res, result.rows[0]);
  } catch (err) {
    return error(res, err.message);
  }
};

const deleteZona = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM zona WHERE cod_zona = $1 RETURNING cod_zona', [id]);
    if (result.rows.length === 0) return error(res, 'Zona no encontrada', 404);
    return success(res, null);
  } catch (err) {
    if (err.code === '23503') {
      return error(res, 'No se puede eliminar la zona porque tiene clientes o rutas asociadas.', 409);
    }
    return error(res, err.message);
  }
};

const getZonasRecurrentes = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT z.cod_zona, z.nombre,
             COUNT(DISTINCT p.id_pedido)::int AS total_pedidos
      FROM zona z
      LEFT JOIN clientes c ON c.cod_zona = z.cod_zona
      LEFT JOIN solicita s ON s.id_cliente = c.id_cliente
      LEFT JOIN pedidos p
             ON p.id_pedido = s.id_pedido
            AND p.fecha >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY z.cod_zona, z.nombre
      ORDER BY total_pedidos DESC, z.nombre ASC
    `);
    return success(res, result.rows);
  } catch (err) {
    return error(res, err.message);
  }
};

module.exports = { getZonas, createZona, updateZona, deleteZona, getZonasRecurrentes };
