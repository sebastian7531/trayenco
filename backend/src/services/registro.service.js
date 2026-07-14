const pool = require('../config/db');
const { fechaHoy } = require('../utils/fecha');

const hoy = () => fechaHoy();

const getRegistros = async (fecha) => {
  const f = fecha || hoy();
  const result = await pool.query(`
    SELECT re.id_registro,
           re.id_pedido,
           re.resultado,
           re.motivo,
           re.observacion,
           re.cantidad_entregada,
           re.fecha,
           r.nombre  AS repartidor_nombre,
           MIN(c.nombre) AS cliente_nombre
    FROM registro_entrega re
    LEFT JOIN repartidor  r ON r.id_repartidor = re.id_repartidor
    LEFT JOIN solicita    s ON s.id_pedido      = re.id_pedido
    LEFT JOIN clientes    c ON c.id_cliente     = s.id_cliente
    WHERE re.fecha = $1
    GROUP BY re.id_registro, re.id_pedido, re.resultado, re.motivo,
             re.observacion, re.cantidad_entregada, re.fecha, r.nombre
    ORDER BY re.fecha, re.id_registro
  `, [f]);
  return result.rows;
};

const getResumen = async (fecha) => {
  const f = fecha || hoy();
  const [totalesResult, erroresResult] = await Promise.all([
    pool.query(`
      SELECT
        COUNT(*)::int                                                     AS total,
        COUNT(*) FILTER (WHERE resultado = 'entregado')::int             AS entregados,
        COUNT(*) FILTER (WHERE resultado = 'problema_entrega')::int      AS problemas_entrega,
        COALESCE(SUM(cantidad_entregada), 0)::int                        AS total_bidones
      FROM registro_entrega
      WHERE fecha = $1
    `, [f]),
    pool.query(`
      WITH registros_cliente AS (
        SELECT re.id_registro,
               MIN(s.id_cliente) AS id_cliente,
               MIN(c.nombre)     AS cliente_nombre
        FROM registro_entrega re
        JOIN solicita s ON s.id_pedido = re.id_pedido
        JOIN clientes c ON c.id_cliente = s.id_cliente
        WHERE re.fecha = $1
          AND re.resultado = 'problema_entrega'
        GROUP BY re.id_registro
      )
      SELECT cliente_nombre, COUNT(*)::int AS incidencias
      FROM registros_cliente
      GROUP BY id_cliente, cliente_nombre
      HAVING COUNT(*) > 1
      ORDER BY incidencias DESC
    `, [f]),
  ]);
  return {
    ...totalesResult.rows[0],
    errores_frecuentes: erroresResult.rows,
  };
};

module.exports = { getRegistros, getResumen };
