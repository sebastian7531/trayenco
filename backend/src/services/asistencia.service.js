const pool = require('../config/db');
const { fechaHoy } = require('../utils/fecha');

const getAsistencia = async () => {
  const result = await pool.query(`
    SELECT a.id_asistencia, a.fecha,
           r.id_repartidor, r.nombre AS repartidor_nombre, r.email,
           ra.hora_entrada, ra.hora_salida, ra.horas_trabajadas
    FROM asistencia a
    JOIN repartidor_asistencia ra ON ra.id_asistencia = a.id_asistencia
    JOIN repartidor r ON r.id_repartidor = ra.id_repartidor
    ORDER BY a.fecha DESC, ra.hora_entrada DESC
  `);
  return result.rows;
};

const getAsistenciaHoy = async () => {
  const result = await pool.query(`
    SELECT r.id_repartidor, r.nombre,
           ra.hora_entrada, ra.hora_salida, ra.horas_trabajadas
    FROM repartidor r
    LEFT JOIN asistencia a ON a.fecha = $1
    LEFT JOIN repartidor_asistencia ra
      ON ra.id_repartidor = r.id_repartidor
      AND ra.id_asistencia = a.id_asistencia
    ORDER BY r.nombre ASC
  `, [fechaHoy()]);
  return result.rows;
};

const registrarEntrada = async (id_repartidor) => {
  const hoy = fechaHoy();

  let asistencia = await pool.query(
    'SELECT id_asistencia FROM asistencia WHERE fecha = $1',
    [hoy]
  );
  if (asistencia.rows.length === 0) {
    asistencia = await pool.query(
      'INSERT INTO asistencia (fecha) VALUES ($1) RETURNING id_asistencia',
      [hoy]
    );
  }
  const id_asistencia = asistencia.rows[0].id_asistencia;

  const existing = await pool.query(
    'SELECT id_repartidor FROM repartidor_asistencia WHERE id_repartidor = $1 AND id_asistencia = $2',
    [id_repartidor, id_asistencia]
  );
  if (existing.rows.length > 0) throw new Error('Ya existe una entrada registrada para hoy');

  const result = await pool.query(
    `INSERT INTO repartidor_asistencia (id_repartidor, id_asistencia, hora_entrada)
     VALUES ($1, $2, NOW()::time) RETURNING *`,
    [id_repartidor, id_asistencia]
  );
  return result.rows[0];
};

const registrarSalida = async (id_repartidor) => {
  const hoy = fechaHoy();

  const asistencia = await pool.query(
    'SELECT id_asistencia FROM asistencia WHERE fecha = $1',
    [hoy]
  );
  if (asistencia.rows.length === 0) throw new Error('No hay entrada registrada para hoy');

  const id_asistencia = asistencia.rows[0].id_asistencia;

  const registro = await pool.query(
    'SELECT * FROM repartidor_asistencia WHERE id_repartidor = $1 AND id_asistencia = $2',
    [id_repartidor, id_asistencia]
  );
  if (registro.rows.length === 0) throw new Error('No hay entrada registrada para hoy');
  if (registro.rows[0].hora_salida !== null) throw new Error('Ya existe una salida registrada para hoy');

  const result = await pool.query(
    `UPDATE repartidor_asistencia
     SET hora_salida = NOW()::time,
         horas_trabajadas = ROUND(
           MOD(
             EXTRACT(EPOCH FROM (NOW()::time - hora_entrada))::numeric + 86400,
             86400
           ) / 3600,
           2
         )
     WHERE id_repartidor = $1 AND id_asistencia = $2
     RETURNING *`,
    [id_repartidor, id_asistencia]
  );
  return result.rows[0];
};

const getReporteAsistencia = async (id_repartidor, fecha_inicio, fecha_fin) => {
  const result = await pool.query(
    `SELECT a.fecha, r.nombre AS repartidor_nombre,
            ra.hora_entrada, ra.hora_salida, ra.horas_trabajadas
     FROM asistencia a
     JOIN repartidor_asistencia ra ON ra.id_asistencia = a.id_asistencia
     JOIN repartidor r ON r.id_repartidor = ra.id_repartidor
     WHERE ra.id_repartidor = $1 AND a.fecha BETWEEN $2 AND $3
     ORDER BY a.fecha ASC`,
    [id_repartidor, fecha_inicio, fecha_fin]
  );
  return result.rows;
};

module.exports = { getAsistencia, getAsistenciaHoy, registrarEntrada, registrarSalida, getReporteAsistencia };
