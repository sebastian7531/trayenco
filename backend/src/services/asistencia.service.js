const pool = require('../config/db');

const TIME_ZONE = 'America/Santiago';
const ADVISORY_LOCK_NAMESPACE = 78231;

const crearError = (message, status, code) => {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
};

const verificarRepartidorActual = async (client, id_repartidor) => {
  const result = await client.query(
    `SELECT id_repartidor, rol
     FROM repartidor
     WHERE id_repartidor = $1
     FOR SHARE`,
    [id_repartidor]
  );

  if (result.rows.length === 0) {
    throw crearError('Repartidor no encontrado', 404, 'REPARTIDOR_NO_ENCONTRADO');
  }

  if (result.rows[0].rol !== 'repartidor') {
    throw crearError(
      'Acceso denegado: se requiere rol repartidor',
      403,
      'ROL_REPARTIDOR_REQUERIDO'
    );
  }
};

const bloquearRepartidor = async (client, id_repartidor) => {
  await client.query(
    'SELECT pg_advisory_xact_lock($1, $2)',
    [ADVISORY_LOCK_NAMESPACE, id_repartidor]
  );
};

const buscarIntervaloAbierto = async (client, id_repartidor) => {
  const result = await client.query(
    `SELECT
       ra.id_registro,
       ra.id_repartidor,
       ra.id_asistencia,
       a.fecha::text AS fecha,
       ra.hora_entrada,
       EXTRACT(
         EPOCH FROM (
           CURRENT_TIMESTAMP
           - ((a.fecha + ra.hora_entrada) AT TIME ZONE '${TIME_ZONE}')
         )
       )::numeric / 3600 AS duracion_horas
     FROM repartidor_asistencia ra
     JOIN asistencia a ON a.id_asistencia = ra.id_asistencia
     WHERE ra.id_repartidor = $1
       AND ra.hora_salida IS NULL
     ORDER BY a.fecha DESC, ra.id_registro DESC
     LIMIT 1
     FOR UPDATE OF ra`,
    [id_repartidor]
  );

  return result.rows[0] || null;
};

const getTotalJornada = async (client, id_repartidor, id_asistencia) => {
  const result = await client.query(
    `SELECT
       COALESCE(
         ROUND(
           SUM(horas_trabajadas)
             FILTER (WHERE hora_salida IS NOT NULL),
           2
         ),
         0
       )::double precision AS total_horas
     FROM repartidor_asistencia
     WHERE id_repartidor = $1
       AND id_asistencia = $2`,
    [id_repartidor, id_asistencia]
  );

  return result.rows[0].total_horas;
};

const getAsistenciaHoy = async (id_repartidor = null) => {
  const result = await pool.query(
    `WITH fecha_objetivo AS (
       SELECT
         (CURRENT_TIMESTAMP AT TIME ZONE '${TIME_ZONE}')::date AS fecha
     ),
     jornada AS (
       SELECT a.id_asistencia, a.fecha
       FROM asistencia a
       CROSS JOIN fecha_objetivo f
       WHERE a.fecha = f.fecha
     ),
     intervalos_hoy AS (
       SELECT
         ra.id_registro,
         ra.id_repartidor,
         ra.id_asistencia,
         ra.hora_entrada,
         ra.hora_salida,
         ra.horas_trabajadas
       FROM repartidor_asistencia ra
       JOIN jornada j ON j.id_asistencia = ra.id_asistencia
     ),
     intervalos_abiertos AS (
       SELECT DISTINCT ON (ra.id_repartidor)
         ra.id_repartidor,
         ra.id_registro,
         ra.id_asistencia,
         a.fecha,
         ra.hora_entrada
       FROM repartidor_asistencia ra
       JOIN asistencia a ON a.id_asistencia = ra.id_asistencia
       WHERE ra.hora_salida IS NULL
       ORDER BY ra.id_repartidor, a.fecha DESC, ra.id_registro DESC
     )
     SELECT
       r.id_repartidor,
       r.nombre,
       f.fecha::text AS fecha,
       COALESCE(
         ROUND(
           SUM(ih.horas_trabajadas)
             FILTER (WHERE ih.hora_salida IS NOT NULL),
           2
         ),
         0
       )::double precision AS total_horas,
       COALESCE(
         JSONB_AGG(
           JSONB_BUILD_OBJECT(
             'id_registro', ih.id_registro,
             'id_asistencia', ih.id_asistencia,
             'hora_entrada', ih.hora_entrada,
             'hora_salida', ih.hora_salida,
             'horas_trabajadas', ih.horas_trabajadas
           )
           ORDER BY ih.hora_entrada, ih.id_registro
         ) FILTER (WHERE ih.id_registro IS NOT NULL),
         '[]'::jsonb
       ) AS intervalos,
       CASE
         WHEN ia.id_registro IS NULL THEN NULL
         ELSE JSONB_BUILD_OBJECT(
           'id_registro', ia.id_registro,
           'id_asistencia', ia.id_asistencia,
           'fecha', ia.fecha,
           'hora_entrada', ia.hora_entrada
         )
       END AS intervalo_abierto
     FROM repartidor r
     CROSS JOIN fecha_objetivo f
     LEFT JOIN intervalos_hoy ih
       ON ih.id_repartidor = r.id_repartidor
     LEFT JOIN intervalos_abiertos ia
       ON ia.id_repartidor = r.id_repartidor
     WHERE r.rol = 'repartidor'
       AND ($1::integer IS NULL OR r.id_repartidor = $1)
     GROUP BY
       r.id_repartidor,
       r.nombre,
       f.fecha,
       ia.id_registro,
       ia.id_asistencia,
       ia.fecha,
       ia.hora_entrada
     ORDER BY r.nombre ASC`,
    [id_repartidor]
  );

  return result.rows;
};

const getAsistencia = async () => {
  const result = await pool.query(
    `SELECT
       a.id_asistencia,
       a.fecha::text AS fecha,
       r.id_repartidor,
       r.nombre AS repartidor_nombre,
       r.email,
       COALESCE(
         ROUND(
           SUM(ra.horas_trabajadas)
             FILTER (WHERE ra.hora_salida IS NOT NULL),
           2
         ),
         0
       )::double precision AS total_horas,
       BOOL_OR(ra.hora_salida IS NULL) AS tiene_intervalo_abierto,
       JSONB_AGG(
         JSONB_BUILD_OBJECT(
           'id_registro', ra.id_registro,
           'hora_entrada', ra.hora_entrada,
           'hora_salida', ra.hora_salida,
           'horas_trabajadas', ra.horas_trabajadas
         )
         ORDER BY ra.hora_entrada, ra.id_registro
       ) AS intervalos
     FROM asistencia a
     JOIN repartidor_asistencia ra ON ra.id_asistencia = a.id_asistencia
     JOIN repartidor r ON r.id_repartidor = ra.id_repartidor
     WHERE r.rol = 'repartidor'
     GROUP BY
       a.id_asistencia,
       a.fecha,
       r.id_repartidor,
       r.nombre,
       r.email
     ORDER BY a.fecha DESC, r.nombre ASC`
  );

  return result.rows;
};

const registrarEntrada = async (id_repartidor) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL TIME ZONE '${TIME_ZONE}'`);
    await bloquearRepartidor(client, id_repartidor);
    await verificarRepartidorActual(client, id_repartidor);

    const abierto = await buscarIntervaloAbierto(client, id_repartidor);
    if (abierto) {
      throw crearError(
        'Ya existe un intervalo abierto',
        409,
        'INTERVALO_ABIERTO'
      );
    }

    const asistencia = await client.query(
      `INSERT INTO asistencia (fecha)
       VALUES (CURRENT_DATE)
       ON CONFLICT (fecha)
       DO UPDATE SET fecha = EXCLUDED.fecha
       RETURNING id_asistencia, fecha::text AS fecha`
    );

    const { id_asistencia, fecha } = asistencia.rows[0];
    const result = await client.query(
      `INSERT INTO repartidor_asistencia (
         id_repartidor,
         id_asistencia,
         hora_entrada
       )
       VALUES ($1, $2, LOCALTIME)
       RETURNING
         id_registro,
         id_repartidor,
         id_asistencia,
         hora_entrada,
         hora_salida,
         horas_trabajadas`,
      [id_repartidor, id_asistencia]
    );

    const total_horas = await getTotalJornada(
      client,
      id_repartidor,
      id_asistencia
    );

    await client.query('COMMIT');
    return { ...result.rows[0], fecha, total_horas };
  } catch (err) {
    await client.query('ROLLBACK');

    if (
      err.code === '23505'
      && err.constraint === 'uq_repartidor_intervalo_abierto'
    ) {
      throw crearError(
        'Ya existe un intervalo abierto',
        409,
        'INTERVALO_ABIERTO'
      );
    }

    throw err;
  } finally {
    client.release();
  }
};

const registrarSalida = async (id_repartidor) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL TIME ZONE '${TIME_ZONE}'`);
    await bloquearRepartidor(client, id_repartidor);
    await verificarRepartidorActual(client, id_repartidor);

    const abierto = await buscarIntervaloAbierto(client, id_repartidor);
    if (!abierto) {
      throw crearError(
        'No existe un intervalo abierto para registrar salida',
        404,
        'INTERVALO_ABIERTO_NO_ENCONTRADO'
      );
    }

    const duracion = Number(abierto.duracion_horas);
    if (!Number.isFinite(duracion) || duracion < 0 || duracion >= 24) {
      throw crearError(
        'El intervalo no puede tener una duración negativa ni igual o superior a 24 horas',
        409,
        'DURACION_INTERVALO_INVALIDA'
      );
    }

    const result = await client.query(
      `UPDATE repartidor_asistencia
       SET
         hora_salida = LOCALTIME,
         horas_trabajadas = ROUND($2::numeric, 2)
       WHERE id_registro = $1
         AND hora_salida IS NULL
       RETURNING
         id_registro,
         id_repartidor,
         id_asistencia,
         hora_entrada,
         hora_salida,
         horas_trabajadas`,
      [abierto.id_registro, duracion]
    );

    if (result.rows.length === 0) {
      throw crearError(
        'No existe un intervalo abierto para registrar salida',
        404,
        'INTERVALO_ABIERTO_NO_ENCONTRADO'
      );
    }

    const total_horas = await getTotalJornada(
      client,
      id_repartidor,
      abierto.id_asistencia
    );

    await client.query('COMMIT');
    return { ...result.rows[0], fecha: abierto.fecha, total_horas };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const getReporteAsistencia = async (
  id_repartidor,
  fecha_inicio,
  fecha_fin
) => {
  const repartidor = await pool.query(
    `SELECT id_repartidor
     FROM repartidor
     WHERE id_repartidor = $1
       AND rol = 'repartidor'`,
    [id_repartidor]
  );

  if (repartidor.rows.length === 0) {
    throw crearError('Repartidor no encontrado', 404, 'REPARTIDOR_NO_ENCONTRADO');
  }

  const result = await pool.query(
    `SELECT
       a.id_asistencia,
       a.fecha::text AS fecha,
       r.id_repartidor,
       r.nombre AS repartidor_nombre,
       COALESCE(
         ROUND(
           SUM(ra.horas_trabajadas)
             FILTER (WHERE ra.hora_salida IS NOT NULL),
           2
         ),
         0
       )::double precision AS total_horas,
       BOOL_OR(ra.hora_salida IS NULL) AS tiene_intervalo_abierto,
       JSONB_AGG(
         JSONB_BUILD_OBJECT(
           'id_registro', ra.id_registro,
           'hora_entrada', ra.hora_entrada,
           'hora_salida', ra.hora_salida,
           'horas_trabajadas', ra.horas_trabajadas
         )
         ORDER BY ra.hora_entrada, ra.id_registro
       ) AS intervalos
     FROM asistencia a
     JOIN repartidor_asistencia ra ON ra.id_asistencia = a.id_asistencia
     JOIN repartidor r ON r.id_repartidor = ra.id_repartidor
     WHERE r.id_repartidor = $1
       AND r.rol = 'repartidor'
       AND a.fecha BETWEEN $2 AND $3
     GROUP BY
       a.id_asistencia,
       a.fecha,
       r.id_repartidor,
       r.nombre
     ORDER BY a.fecha ASC`,
    [id_repartidor, fecha_inicio, fecha_fin]
  );

  return result.rows;
};

module.exports = {
  getAsistencia,
  getAsistenciaHoy,
  registrarEntrada,
  registrarSalida,
  getReporteAsistencia,
};
