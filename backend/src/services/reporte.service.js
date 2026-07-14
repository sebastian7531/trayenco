const pool = require('../config/db');

const resumenDiario = async (fecha) => {
  const [pedidos, stock] = await Promise.all([
    pool.query(
      `WITH estado_actual AS (
         SELECT pe.id_pedido, ep.descripcion AS estado
         FROM pedido_estado pe
         JOIN estado_pedido ep ON ep.cod = pe.cod_estado
       )
       SELECT
         COUNT(p.id_pedido)::int AS total,
         COUNT(*) FILTER (WHERE ea.estado = 'entregado')::int         AS entregados,
         COUNT(*) FILTER (WHERE ea.estado = 'problema_entrega')::int  AS problemas_entrega,
         COUNT(*) FILTER (WHERE ea.estado = 'pendiente')::int         AS pendientes
       FROM pedidos p
       JOIN ruta r ON r.cod_ruta = p.cod_ruta
       LEFT JOIN estado_actual ea ON ea.id_pedido = p.id_pedido
       WHERE r.fecha = $1`,
      [fecha]
    ),
    pool.query(
      `SELECT
         COALESCE(SUM(bidones_planta), 0)::int      AS bidones_planta,
         COALESCE(SUM(bidones_entregados), 0)::int  AS bidones_entregados,
         COALESCE(SUM(bidones_retornados), 0)::int  AS bidones_retornados
       FROM stock WHERE fecha = $1`,
      [fecha]
    ),
  ]);

  const p = pedidos.rows[0];
  const s = stock.rows[0];

  return {
    fecha,
    pedidos: {
      total:             p.total,
      entregados:        p.entregados,
      problemas_entrega: p.problemas_entrega,
      pendientes:        p.pendientes,
    },
    stock: {
      bidones_planta:      s.bidones_planta,
      bidones_entregados:  s.bidones_entregados,
      bidones_retornados:  s.bidones_retornados,
    },
  };
};

const pedidosPorPeriodo = async (fecha_inicio, fecha_fin) => {
  const result = await pool.query(
    `SELECT r.fecha::date AS fecha, COUNT(p.id_pedido)::int AS total
     FROM pedidos p
     JOIN ruta r ON r.cod_ruta = p.cod_ruta
     WHERE r.fecha BETWEEN $1 AND $2
     GROUP BY r.fecha
     ORDER BY r.fecha ASC`,
    [fecha_inicio, fecha_fin]
  );
  return result.rows;
};

const rendimientoReparto = async (fecha_inicio, fecha_fin) => {
  const result = await pool.query(
    `WITH estado_actual AS (
       SELECT pe.id_pedido, ep.descripcion AS estado
       FROM pedido_estado pe
       JOIN estado_pedido ep ON ep.cod = pe.cod_estado
     )
     SELECT
       r.fecha::date AS fecha,
       COUNT(p.id_pedido)::int AS total,
       COUNT(*) FILTER (WHERE ea.estado = 'entregado')::int         AS entregados,
       COUNT(*) FILTER (WHERE ea.estado = 'problema_entrega')::int  AS problemas_entrega,
       ROUND(
         COUNT(*) FILTER (WHERE ea.estado = 'entregado') * 100.0 /
         NULLIF(COUNT(p.id_pedido), 0),
         2
       ) AS porcentaje_exito
     FROM ruta r
     LEFT JOIN pedidos p ON p.cod_ruta = r.cod_ruta
     LEFT JOIN estado_actual ea ON ea.id_pedido = p.id_pedido
     WHERE r.fecha BETWEEN $1 AND $2
     GROUP BY r.fecha
     ORDER BY r.fecha ASC`,
    [fecha_inicio, fecha_fin]
  );
  return result.rows;
};

const stockHistorico = async (fecha_inicio, fecha_fin) => {
  const result = await pool.query(
    `SELECT
       fecha,
       SUM(bidones_planta)::int      AS bidones_planta,
       SUM(bidones_cargados)::int    AS bidones_cargados,
       SUM(bidones_entregados)::int  AS bidones_entregados,
       SUM(bidones_retornados)::int  AS bidones_retornados
     FROM stock
     WHERE fecha BETWEEN $1 AND $2
     GROUP BY fecha
     ORDER BY fecha ASC`,
    [fecha_inicio, fecha_fin]
  );
  return result.rows;
};

const clientesFrecuentes = async () => {
  const result = await pool.query(
    `SELECT
       c.id_cliente,
       c.nombre,
       z.nombre AS zona,
       COUNT(DISTINCT s.id_pedido)::int AS total_pedidos
     FROM clientes c
     JOIN solicita s ON s.id_cliente = c.id_cliente
     LEFT JOIN zona z ON z.cod_zona = c.cod_zona
     GROUP BY c.id_cliente, c.nombre, z.nombre
     ORDER BY total_pedidos DESC
     LIMIT 10`
  );
  return result.rows;
};

module.exports = { resumenDiario, pedidosPorPeriodo, rendimientoReparto, stockHistorico, clientesFrecuentes };
