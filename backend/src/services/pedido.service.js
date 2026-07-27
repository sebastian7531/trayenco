const pool = require('../config/db');
const { confirmarEntrega } = require('./stock.service');
const { fechaHoy } = require('../utils/fecha');

// cod_estado: 1=pendiente, 2=en_ruta, 3=entregado, 5=problema_entrega
const TRANSICIONES = {
  1: [2],
  2: [3, 5],
  3: [],
  5: [],
};

const SELECT_COLS = `
  SELECT p.id_pedido, p.fecha, p.cod_ruta, p.orden_entrega, p.prioridad,
         MIN(s.id_cliente) AS id_cliente,
         MIN(c.nombre) AS cliente_nombre,
         MIN(c.telefono) AS cliente_telefono,
         MIN(c.direccion) AS cliente_direccion,
         MIN(c.cod_zona) AS cod_zona,
         ep.descripcion AS estado,
         pe.cantidad_entregada,
         COALESCE(
           JSON_AGG(
             JSON_BUILD_OBJECT(
               'cod_bidon', s.cod_bidon,
               'descripcion', b.descripcion,
               'formato', b.formato,
               'cantidad', s.cantidad
             ) ORDER BY s.cod_bidon
           ) FILTER (WHERE s.cod_bidon IS NOT NULL),
           '[]'::json
         ) AS lineas
`;

const SELECT_BASE = `
  FROM pedidos p
  LEFT JOIN solicita s ON s.id_pedido = p.id_pedido
  LEFT JOIN clientes c ON c.id_cliente = s.id_cliente
  LEFT JOIN bidones b ON b.cod_bidon = s.cod_bidon
  LEFT JOIN pedido_estado pe ON pe.id_pedido = p.id_pedido
  LEFT JOIN estado_pedido ep ON ep.cod = pe.cod_estado
`;

const GROUP_BY = `
  GROUP BY p.id_pedido, p.fecha, p.cod_ruta, p.orden_entrega, p.prioridad, ep.descripcion, pe.cantidad_entregada
`;

const getPedidos = async () => {
  const result = await pool.query(
    `${SELECT_COLS} ${SELECT_BASE} ${GROUP_BY} ORDER BY p.fecha DESC`
  );
  return result.rows;
};

const getPedidoById = async (id) => {
  const result = await pool.query(
    `${SELECT_COLS} ${SELECT_BASE} WHERE p.id_pedido = $1 ${GROUP_BY}`,
    [id]
  );
  return result.rows[0] || null;
};

const createPedido = async ({ cod_ruta, id_cliente, lineas, prioridad }) => {
  const cliente_db = await pool.connect();
  try {
    await cliente_db.query('BEGIN');
    const cliente = await cliente_db.query(
      'SELECT id_cliente FROM clientes WHERE id_cliente = $1 AND activo = true',
      [id_cliente]
    );
    if (cliente.rows.length === 0) throw new Error('Cliente no encontrado');

    const codigosBidon = lineas.map(({ cod_bidon }) => Number(cod_bidon));
    const bidones = await cliente_db.query(
      'SELECT cod_bidon FROM bidones WHERE cod_bidon = ANY($1::int[])',
      [codigosBidon]
    );
    if (bidones.rows.length !== new Set(codigosBidon).size) {
      throw new Error('Uno o más tipos de bidón no existen');
    }

    const prioridadFinal = prioridad === 'urgente' ? 'urgente' : 'normal';
    const pedido = await cliente_db.query(
      'INSERT INTO pedidos (cod_ruta, prioridad) VALUES ($1, $2) RETURNING id_pedido',
      [cod_ruta || null, prioridadFinal]
    );
    const id_pedido = pedido.rows[0].id_pedido;

    for (const { cod_bidon, cantidad } of lineas) {
      await cliente_db.query(
        'INSERT INTO solicita (id_pedido, id_cliente, cod_bidon, cantidad) VALUES ($1, $2, $3, $4)',
        [id_pedido, id_cliente, Number(cod_bidon), Number(cantidad)]
      );
    }

    await cliente_db.query(
      'INSERT INTO pedido_estado (id_pedido, cod_estado, cantidad_entregada) VALUES ($1, 1, 0)',
      [id_pedido]
    );
    await cliente_db.query('COMMIT');
    return getPedidoById(id_pedido);
  } catch (err) {
    await cliente_db.query('ROLLBACK');
    throw err;
  } finally {
    cliente_db.release();
  }
};

const updatePedido = async (id, { lineas, prioridad }) => {
  const existente = await pool.query(
    'SELECT DISTINCT id_cliente FROM solicita WHERE id_pedido = $1 LIMIT 1',
    [id]
  );
  if (existente.rows.length === 0) return null;

  if (Array.isArray(lineas) && lineas.length > 0) {
    const id_cliente = existente.rows[0].id_cliente;
    await pool.query('DELETE FROM solicita WHERE id_pedido = $1', [id]);
    await Promise.all(
      lineas.map(({ cod_bidon, cantidad }) =>
        pool.query(
          'INSERT INTO solicita (id_pedido, id_cliente, cod_bidon, cantidad) VALUES ($1, $2, $3, $4)',
          [id, id_cliente, cod_bidon, cantidad]
        )
      )
    );
  }

  if (prioridad !== undefined) {
    const prioridadFinal = prioridad === 'urgente' ? 'urgente' : 'normal';
    await pool.query('UPDATE pedidos SET prioridad = $1 WHERE id_pedido = $2', [prioridadFinal, id]);
  }

  return getPedidoById(id);
};

const cambiarEstado = async (id_pedido, descripcion_nuevo, cantidad_entregada = 0, motivo = null, observacion = null, id_repartidor = null) => {
  const estadoResult = await pool.query(
    'SELECT cod FROM estado_pedido WHERE descripcion = $1',
    [descripcion_nuevo]
  );
  if (estadoResult.rows.length === 0) throw new Error('Estado inválido');

  const nuevo_cod = estadoResult.rows[0].cod;

  const actual = await pool.query(
    'SELECT cod_estado FROM pedido_estado WHERE id_pedido = $1 LIMIT 1',
    [id_pedido]
  );
  if (actual.rows.length === 0) throw new Error('Pedido no encontrado');

  const cod_actual = parseInt(actual.rows[0].cod_estado);
  const permitidos = TRANSICIONES[cod_actual] || [];
  if (!permitidos.includes(nuevo_cod)) {
    throw new Error(`Transición inválida: ${cod_actual} → ${nuevo_cod}`);
  }

  let totalBidones = 0;
  if (nuevo_cod === 3) {
    const totResult = await pool.query(
      'SELECT COALESCE(SUM(cantidad), 0)::int AS total FROM solicita WHERE id_pedido = $1',
      [id_pedido]
    );
    totalBidones = totResult.rows[0].total;
  }

  const cantidadRegistro = nuevo_cod === 3 ? totalBidones : 0;

  const cliente_db = await pool.connect();
  try {
    await cliente_db.query('BEGIN');
    await cliente_db.query('DELETE FROM pedido_estado WHERE id_pedido = $1', [id_pedido]);
    await cliente_db.query(
      'INSERT INTO pedido_estado (id_pedido, cod_estado, cantidad_entregada) VALUES ($1, $2, $3)',
      [id_pedido, nuevo_cod, 0]
    );
    if ([3, 5].includes(nuevo_cod)) {
      await cliente_db.query(
        `INSERT INTO registro_entrega
           (id_pedido, id_repartidor, resultado, motivo, observacion, cantidad_entregada, fecha)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [id_pedido, id_repartidor, descripcion_nuevo, motivo || null, observacion || null, cantidadRegistro, fechaHoy()]
      );
    }
    if (nuevo_cod === 3) {
      const lineas = await cliente_db.query(
        'SELECT cod_bidon, cantidad FROM solicita WHERE id_pedido = $1 ORDER BY cod_bidon',
        [id_pedido]
      );
      for (const l of lineas.rows) {
        await confirmarEntrega(l.cantidad, l.cod_bidon, cliente_db);
      }
    }
    await cliente_db.query('COMMIT');
  } catch (err) {
    await cliente_db.query('ROLLBACK');
    throw err;
  } finally {
    cliente_db.release();
  }

  return getPedidoById(id_pedido);
};

const deletePedido = async (id) => {
  const actual = await pool.query(
    `SELECT pe.cod_estado, p.cod_ruta
     FROM pedido_estado pe
     JOIN pedidos p ON p.id_pedido = pe.id_pedido
     WHERE pe.id_pedido = $1 LIMIT 1`,
    [id]
  );
  if (actual.rows.length === 0) throw new Error('Pedido no encontrado');
  if (actual.rows[0].cod_ruta !== null) {
    throw new Error('No se puede eliminar un pedido que ya está asignado a una ruta');
  }
  if (parseInt(actual.rows[0].cod_estado) !== 1) {
    throw new Error('Solo se pueden eliminar pedidos en estado pendiente');
  }

  await pool.query('DELETE FROM pedido_estado WHERE id_pedido = $1', [id]);
  await pool.query('DELETE FROM solicita WHERE id_pedido = $1', [id]);
  await pool.query('DELETE FROM pedidos WHERE id_pedido = $1', [id]);
};

const getPedidosPendientesPorZonas = async (cod_zonas) => {
  const result = await pool.query(`
    SELECT p.id_pedido, p.fecha, p.prioridad,
           MIN(s.id_cliente) AS id_cliente,
           MIN(c.nombre) AS cliente_nombre,
           MIN(c.direccion) AS cliente_direccion,
           MIN(c.cod_zona) AS cod_zona,
           MIN(z.nombre) AS zona_nombre,
           COALESCE(
             JSON_AGG(
               JSON_BUILD_OBJECT(
                 'cod_bidon', s.cod_bidon,
                 'descripcion', b.descripcion,
                 'formato', b.formato,
                 'cantidad', s.cantidad
               ) ORDER BY s.cod_bidon
             ) FILTER (WHERE s.cod_bidon IS NOT NULL),
             '[]'::json
           ) AS lineas
    FROM pedidos p
    JOIN solicita s ON s.id_pedido = p.id_pedido
    JOIN clientes c ON c.id_cliente = s.id_cliente
    JOIN zona z ON z.cod_zona = c.cod_zona
    JOIN pedido_estado pe ON pe.id_pedido = p.id_pedido
    LEFT JOIN bidones b ON b.cod_bidon = s.cod_bidon
    WHERE pe.cod_estado = 1
      AND p.cod_ruta IS NULL
      AND c.cod_zona = ANY($1::int[])
    GROUP BY p.id_pedido, p.fecha, p.prioridad
    ORDER BY p.fecha DESC
  `, [cod_zonas]);
  return result.rows;
};

const getPedidosPendientes = async () => {
  const result = await pool.query(`
    SELECT p.id_pedido, p.fecha, p.prioridad,
           MIN(s.id_cliente) AS id_cliente,
           MIN(c.nombre) AS cliente_nombre,
           MIN(c.direccion) AS cliente_direccion,
           MIN(c.cod_zona) AS cod_zona,
           MIN(z.nombre) AS zona_nombre,
           COALESCE(
             JSON_AGG(
               JSON_BUILD_OBJECT(
                 'cod_bidon', s.cod_bidon,
                 'descripcion', b.descripcion,
                 'formato', b.formato,
                 'cantidad', s.cantidad
               ) ORDER BY s.cod_bidon
             ) FILTER (WHERE s.cod_bidon IS NOT NULL),
             '[]'::json
           ) AS lineas
    FROM pedidos p
    JOIN solicita s ON s.id_pedido = p.id_pedido
    JOIN clientes c ON c.id_cliente = s.id_cliente
    JOIN zona z ON z.cod_zona = c.cod_zona
    JOIN pedido_estado pe ON pe.id_pedido = p.id_pedido
    LEFT JOIN bidones b ON b.cod_bidon = s.cod_bidon
    WHERE pe.cod_estado = 1
      AND p.cod_ruta IS NULL
    GROUP BY p.id_pedido, p.fecha, p.prioridad
    ORDER BY p.fecha DESC
  `);
  return result.rows;
};

const getPedidoRutaRepartidor = async (id_pedido, id_repartidor) => {
  const result = await pool.query(
    `SELECT EXISTS (
       SELECT 1
       FROM pedidos p
       JOIN ruta r ON r.cod_ruta = p.cod_ruta
       WHERE p.id_pedido = $1
         AND (
           EXISTS (
             SELECT 1
             FROM ruta_repartidor rr
             WHERE rr.cod_ruta = r.cod_ruta
               AND rr.id_repartidor = $2
           )
           OR (
             r.id_repartidor = $2
             AND NOT EXISTS (
               SELECT 1 FROM ruta_repartidor rr_legacy WHERE rr_legacy.cod_ruta = r.cod_ruta
             )
           )
         )
     ) AS asignado
    `,
    [id_pedido, id_repartidor]
  );
  return result.rows[0] || null;
};

module.exports = { getPedidos, getPedidoById, createPedido, updatePedido, cambiarEstado, deletePedido, getPedidosPendientesPorZonas, getPedidosPendientes, getPedidoRutaRepartidor };
