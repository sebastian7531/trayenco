const pool = require('../config/db');
const { success, error } = require('../utils/response');

const getClientes = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.*, z.nombre AS zona_nombre
      FROM clientes c
      LEFT JOIN zona z ON z.cod_zona = c.cod_zona
      WHERE c.activo = true
      ORDER BY c.nombre ASC
    `);
    return success(res, result.rows);
  } catch (err) {
    return error(res, err.message);
  }
};

const getClienteById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT * FROM clientes WHERE id_cliente = $1 AND activo = true',
      [id]
    );
    if (result.rows.length === 0) return error(res, 'Cliente no encontrado', 404);
    return success(res, result.rows[0]);
  } catch (err) {
    return error(res, err.message);
  }
};

const createCliente = async (req, res) => {
  try {
    const { nombre, telefono, direccion, cod_zona } = req.body;

    if (!nombre || !nombre.trim()) return error(res, 'El nombre es requerido', 400);
    if (nombre.trim().length > 100) return error(res, 'El nombre no puede superar 100 caracteres', 400);
    if (!direccion || !direccion.trim()) return error(res, 'La dirección es requerida', 400);
    if (telefono && telefono.trim() && !/^\d+$/.test(telefono.trim())) {
      return error(res, 'El teléfono solo puede contener números', 400);
    }
    if (cod_zona) {
      const zonaCheck = await pool.query('SELECT cod_zona FROM zona WHERE cod_zona = $1', [cod_zona]);
      if (zonaCheck.rows.length === 0) return error(res, 'La zona indicada no existe', 400);
    }

    let latitud = null;
    let longitud = null;

    try {
      const query = encodeURIComponent(`${direccion}, Tomé, Biobío, Chile`);
      const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`;
      const response = await fetch(url, { headers: { 'User-Agent': 'trayenco-app' } });
      const data = await response.json();
      if (data.length > 0) {
        latitud = parseFloat(data[0].lat);
        longitud = parseFloat(data[0].lon);
      }
    } catch (_) {}

    const result = await pool.query(
      `INSERT INTO clientes (nombre, telefono, direccion, cod_zona, latitud, longitud)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [nombre.trim(), telefono || null, direccion.trim(), cod_zona || null, latitud, longitud]
    );
    return success(res, result.rows[0], 'Cliente creado', 201);
  } catch (err) {
    return error(res, err.message);
  }
};

const updateCliente = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, telefono, direccion, cod_zona } = req.body;

    if (!nombre || !nombre.trim()) return error(res, 'El nombre es requerido', 400);
    if (nombre.trim().length > 100) return error(res, 'El nombre no puede superar 100 caracteres', 400);
    if (!direccion || !direccion.trim()) return error(res, 'La dirección es requerida', 400);
    if (telefono && telefono.trim() && !/^\d+$/.test(telefono.trim())) {
      return error(res, 'El teléfono solo puede contener números', 400);
    }
    if (cod_zona) {
      const zonaCheck = await pool.query('SELECT cod_zona FROM zona WHERE cod_zona = $1', [cod_zona]);
      if (zonaCheck.rows.length === 0) return error(res, 'La zona indicada no existe', 400);
    }

    let latitud = null;
    let longitud = null;

    try {
      const query = encodeURIComponent(`${direccion.trim()}, Tomé, Biobío, Chile`);
      const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`;
      const response = await fetch(url, { headers: { 'User-Agent': 'trayenco-app' } });
      const data = await response.json();
      if (data.length > 0) {
        latitud = parseFloat(data[0].lat);
        longitud = parseFloat(data[0].lon);
      }
    } catch (_) {}

    const result = await pool.query(
      `UPDATE clientes
       SET nombre = $1, telefono = $2, direccion = $3, cod_zona = $4, latitud = $5, longitud = $6
       WHERE id_cliente = $7 AND activo = true
       RETURNING *`,
      [nombre.trim(), telefono || null, direccion.trim(), cod_zona || null, latitud, longitud, id]
    );
    if (result.rows.length === 0) return error(res, 'Cliente no encontrado', 404);
    return success(res, result.rows[0], 'Cliente actualizado');
  } catch (err) {
    return error(res, err.message);
  }
};

const deleteCliente = async (req, res) => {
  try {
    const { id } = req.params;

    const clienteCheck = await pool.query(
      'SELECT id_cliente FROM clientes WHERE id_cliente = $1 AND activo = true',
      [id]
    );
    if (clienteCheck.rows.length === 0) return error(res, 'Cliente no encontrado', 404);

    const pedidosActivos = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM pedidos p
       JOIN solicita s ON s.id_pedido = p.id_pedido
       JOIN pedido_estado pe ON pe.id_pedido = p.id_pedido
       WHERE s.id_cliente = $1 AND pe.cod_estado IN (1, 2)`,
      [id]
    );
    if (pedidosActivos.rows[0].total > 0) {
      return error(res, 'No se puede desactivar un cliente con pedidos pendientes o en ruta', 400);
    }

    await pool.query('UPDATE clientes SET activo = false WHERE id_cliente = $1', [id]);
    return success(res, null, 'Cliente eliminado');
  } catch (err) {
    return error(res, err.message);
  }
};

const updateCoordenadas = async (req, res) => {
  try {
    const { id } = req.params;
    const { latitud, longitud } = req.body;
    const result = await pool.query(
      `UPDATE clientes SET latitud = $1, longitud = $2
       WHERE id_cliente = $3 AND activo = true RETURNING *`,
      [latitud, longitud, id]
    );
    if (result.rows.length === 0) return error(res, 'Cliente no encontrado', 404);
    return success(res, result.rows[0], 'Coordenadas actualizadas');
  } catch (err) {
    return error(res, err.message);
  }
};

const getClientesProblemasEntrega = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        c.id_cliente,
        c.nombre,
        z.nombre AS zona_nombre,
        COUNT(DISTINCT re.id_registro)::int AS incidencias,
        (
          SELECT re2.motivo
          FROM registro_entrega re2
          JOIN solicita s2 ON s2.id_pedido = re2.id_pedido
          WHERE s2.id_cliente = c.id_cliente
            AND re2.resultado = 'problema_entrega'
          ORDER BY re2.fecha DESC, re2.id_registro DESC
          LIMIT 1
        ) AS ultimo_motivo
      FROM clientes c
      LEFT JOIN zona z ON z.cod_zona = c.cod_zona
      JOIN solicita s ON s.id_cliente = c.id_cliente
      JOIN registro_entrega re
        ON re.id_pedido = s.id_pedido
       AND re.resultado = 'problema_entrega'
      WHERE c.activo = true
      GROUP BY c.id_cliente, c.nombre, z.nombre
      ORDER BY incidencias DESC, c.nombre ASC
    `);
    return success(res, result.rows);
  } catch (err) {
    return error(res, err.message);
  }
};

module.exports = { getClientes, getClienteById, createCliente, updateCliente, deleteCliente, updateCoordenadas, getClientesProblemasEntrega };
