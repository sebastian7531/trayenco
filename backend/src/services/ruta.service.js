const pool = require('../config/db');
const { fechaHoy } = require('../utils/fecha');

const ORIGEN = { lat: -36.6108, lon: -72.9539 };

const REPARTIDORES_ASIGNADOS_SQL = `
  COALESCE(
    (
      SELECT JSON_AGG(
        JSON_BUILD_OBJECT(
          'id_repartidor', asignado.id_repartidor,
          'nombre', asignado.nombre
        )
        ORDER BY asignado.nombre
      )
      FROM (
        SELECT rep.id_repartidor, rep.nombre
        FROM ruta_repartidor rr
        JOIN repartidor rep ON rep.id_repartidor = rr.id_repartidor
        WHERE rr.cod_ruta = r.cod_ruta

        UNION ALL

        SELECT legacy.id_repartidor, legacy.nombre
        FROM repartidor legacy
        WHERE legacy.id_repartidor = r.id_repartidor
          AND NOT EXISTS (
            SELECT 1
            FROM ruta_repartidor rr_legacy
            WHERE rr_legacy.cod_ruta = r.cod_ruta
          )
      ) asignado
    ),
    '[]'::json
  )
`;

const validarRepartidores = async (cliente_db, repartidor_ids) => {
  const resultado = await cliente_db.query(
    `SELECT id_repartidor, nombre, rol
     FROM repartidor
     WHERE id_repartidor = ANY($1::int[])`,
    [repartidor_ids]
  );

  const encontrados = new Set(resultado.rows.map(r => Number(r.id_repartidor)));
  const faltantes = repartidor_ids.filter(id => !encontrados.has(id));
  if (faltantes.length > 0) {
    throw new Error(`Repartidores no encontrados: ${faltantes.join(', ')}`);
  }

  const rolesInvalidos = resultado.rows.filter(r => r.rol !== 'repartidor');
  if (rolesInvalidos.length > 0) {
    throw new Error(`Usuarios sin rol repartidor: ${rolesInvalidos.map(r => r.nombre).join(', ')}`);
  }
};

const getRutas = async () => {
  const result = await pool.query(`
    SELECT r.*,
           rep.nombre AS repartidor_nombre,
           ${REPARTIDORES_ASIGNADOS_SQL} AS repartidores,
           (SELECT COUNT(*)::int FROM pedidos p WHERE p.cod_ruta = r.cod_ruta) AS total_pedidos,
           COALESCE(
              (SELECT JSON_AGG(JSON_BUILD_OBJECT('cod_zona', z.cod_zona, 'nombre', z.nombre) ORDER BY z.nombre)
               FROM ruta_zona rz
              JOIN zona z ON z.cod_zona = rz.cod_zona
              WHERE rz.cod_ruta = r.cod_ruta),
             '[]'::json
           ) AS zonas
    FROM ruta r
    LEFT JOIN repartidor rep ON rep.id_repartidor = r.id_repartidor
    ORDER BY r.fecha DESC
  `);
  return result.rows;
};

const getRutaById = async (id) => {
  const rutaResult = await pool.query(`
    SELECT r.*, rep.nombre AS repartidor_nombre,
           ${REPARTIDORES_ASIGNADOS_SQL} AS repartidores
    FROM ruta r
    LEFT JOIN repartidor rep ON rep.id_repartidor = r.id_repartidor
    WHERE r.cod_ruta = $1
  `, [id]);

  if (rutaResult.rows.length === 0) return null;

  const [pedidosResult, zonasResult] = await Promise.all([
    pool.query(`
      SELECT p.id_pedido, p.fecha, p.orden_entrega, p.prioridad,
             s.id_cliente, c.nombre AS cliente_nombre, c.telefono AS cliente_telefono,
             c.direccion AS cliente_direccion, c.latitud, c.longitud,
             s.cod_bidon, b.descripcion AS bidon_descripcion, b.formato, s.cantidad,
             ep.descripcion AS estado, pe.cantidad_entregada
      FROM pedidos p
      LEFT JOIN solicita s ON s.id_pedido = p.id_pedido
      LEFT JOIN clientes c ON c.id_cliente = s.id_cliente
      LEFT JOIN bidones b ON b.cod_bidon = s.cod_bidon
      LEFT JOIN pedido_estado pe ON pe.id_pedido = p.id_pedido
      LEFT JOIN estado_pedido ep ON ep.cod = pe.cod_estado
      WHERE p.cod_ruta = $1
      ORDER BY p.orden_entrega ASC NULLS LAST
    `, [id]),
    pool.query(`
      SELECT z.cod_zona, z.nombre
      FROM ruta_zona rz
      JOIN zona z ON z.cod_zona = rz.cod_zona
      WHERE rz.cod_ruta = $1
      ORDER BY z.nombre
    `, [id]),
  ]);

  return { ...rutaResult.rows[0], zonas: zonasResult.rows, pedidos: pedidosResult.rows };
};

const getRutaDeRepartidorHoy = async (id_repartidor) => {
  const result = await pool.query(
    `SELECT r.cod_ruta
     FROM ruta r
     WHERE r.fecha = $2
       AND r.estado = 'activa'
       AND (
         EXISTS (
           SELECT 1
           FROM ruta_repartidor rr
           WHERE rr.cod_ruta = r.cod_ruta
             AND rr.id_repartidor = $1
         )
         OR (
           r.id_repartidor = $1
           AND NOT EXISTS (
             SELECT 1 FROM ruta_repartidor rr_legacy WHERE rr_legacy.cod_ruta = r.cod_ruta
           )
         )
       )
     ORDER BY r.cod_ruta ASC
     LIMIT 1`,
    [id_repartidor, fechaHoy()]
  );
  if (result.rows.length === 0) return null;
  return getRutaById(result.rows[0].cod_ruta);
};

const cerrarReparto = async (cod_ruta) => {
  const cliente_db = await pool.connect();
  try {
    await cliente_db.query('BEGIN');
    const ruta = await cliente_db.query(
      'SELECT cod_ruta, estado FROM ruta WHERE cod_ruta = $1 FOR UPDATE',
      [cod_ruta]
    );
    if (ruta.rows.length === 0) throw new Error('Ruta no encontrada');
    if (ruta.rows[0].estado === 'cerrada') throw new Error('La ruta ya está cerrada');

    const pendientes = await cliente_db.query(
      `SELECT COUNT(DISTINCT p.id_pedido)::int AS total
       FROM pedidos p
       LEFT JOIN pedido_estado pe ON pe.id_pedido = p.id_pedido
       LEFT JOIN estado_pedido ep ON ep.cod = pe.cod_estado
       WHERE p.cod_ruta = $1
         AND (ep.descripcion IS NULL OR ep.descripcion NOT IN ('entregado', 'problema_entrega'))`,
      [cod_ruta]
    );
    if (pendientes.rows[0].total > 0) {
      throw new Error('La ruta tiene pedidos pendientes y no puede cerrarse');
    }

    await cliente_db.query("UPDATE ruta SET estado = 'cerrada' WHERE cod_ruta = $1", [cod_ruta]);
    await cliente_db.query('COMMIT');
  } catch (err) {
    await cliente_db.query('ROLLBACK');
    throw err;
  } finally {
    cliente_db.release();
  }
  return getRutaById(cod_ruta);
};

const createRuta = async ({ fecha, repartidor_ids, cod_zonas = [], texto, cantidad_bidones }) => {
  const zonas = cod_zonas.filter(z => z != null && !isNaN(Number(z))).map(Number);
  const primeraZona = zonas.length > 0 ? zonas[0] : null;
  const fechaRuta = fecha || fechaHoy();

  const cliente_db = await pool.connect();
  try {
    await cliente_db.query('BEGIN');
    await validarRepartidores(cliente_db, repartidor_ids);
    const result = await cliente_db.query(
      `INSERT INTO ruta (fecha, id_repartidor, cod_zona, texto, cantidad_bidones)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [fechaRuta, repartidor_ids[0], primeraZona, texto || null, cantidad_bidones || null]
    );
    const ruta = result.rows[0];

    for (const id_repartidor of repartidor_ids) {
      await cliente_db.query(
        'INSERT INTO ruta_repartidor (cod_ruta, id_repartidor) VALUES ($1, $2)',
        [ruta.cod_ruta, id_repartidor]
      );
    }

    for (const cod_zona of zonas) {
      await cliente_db.query(
        'INSERT INTO ruta_zona (cod_ruta, cod_zona) VALUES ($1, $2)',
        [ruta.cod_ruta, cod_zona]
      );
    }

    await cliente_db.query('COMMIT');
    return getRutaById(ruta.cod_ruta);
  } catch (err) {
    await cliente_db.query('ROLLBACK');
    throw err;
  } finally {
    cliente_db.release();
  }
};

const actualizarRepartidores = async (cod_ruta, repartidor_ids) => {
  const cliente_db = await pool.connect();
  try {
    await cliente_db.query('BEGIN');
    const ruta = await cliente_db.query(
      'SELECT cod_ruta FROM ruta WHERE cod_ruta = $1 FOR UPDATE',
      [cod_ruta]
    );
    if (ruta.rows.length === 0) throw new Error('Ruta no encontrada');

    await validarRepartidores(cliente_db, repartidor_ids);
    await cliente_db.query('DELETE FROM ruta_repartidor WHERE cod_ruta = $1', [cod_ruta]);
    for (const id_repartidor of repartidor_ids) {
      await cliente_db.query(
        'INSERT INTO ruta_repartidor (cod_ruta, id_repartidor) VALUES ($1, $2)',
        [cod_ruta, id_repartidor]
      );
    }
    await cliente_db.query(
      'UPDATE ruta SET id_repartidor = $1 WHERE cod_ruta = $2',
      [repartidor_ids[0], cod_ruta]
    );

    await cliente_db.query('COMMIT');
    return getRutaById(cod_ruta);
  } catch (err) {
    await cliente_db.query('ROLLBACK');
    throw err;
  } finally {
    cliente_db.release();
  }
};

const esRepartidorAsignado = async (cod_ruta, id_repartidor) => {
  const resultado = await pool.query(
    `SELECT EXISTS (
       SELECT 1
       FROM ruta r
       WHERE r.cod_ruta = $1
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
     ) AS asignado`,
    [cod_ruta, id_repartidor]
  );
  return resultado.rows[0].asignado;
};

const asignarPedidos = async (cod_ruta, pedido_ids) => {
  const ruta = await pool.query('SELECT cod_ruta FROM ruta WHERE cod_ruta = $1', [cod_ruta]);
  if (ruta.rows.length === 0) throw new Error('Ruta no encontrada');

  const check = await pool.query(
    `SELECT p.id_pedido, p.cod_ruta, ep.descripcion AS estado
     FROM pedidos p
     LEFT JOIN pedido_estado pe ON pe.id_pedido = p.id_pedido
     LEFT JOIN estado_pedido ep ON ep.cod = pe.cod_estado
     WHERE p.id_pedido = ANY($1::int[])`,
    [pedido_ids]
  );

  const noValidos = check.rows.filter(p => p.estado !== 'pendiente');
  if (noValidos.length > 0) {
    const ids = noValidos.map(p => p.id_pedido).join(', ');
    throw new Error(`Pedidos no están en estado pendiente: ${ids}`);
  }

  const yaEnOtraRuta = check.rows.filter(p =>
    p.cod_ruta !== null && parseInt(p.cod_ruta) !== parseInt(cod_ruta)
  );
  if (yaEnOtraRuta.length > 0) {
    const ids = yaEnOtraRuta.map(p => p.id_pedido).join(', ');
    throw new Error(`Los siguientes pedidos ya pertenecen a otra ruta: ${ids}`);
  }

  const maxOrdenResult = await pool.query(
    'SELECT COALESCE(MAX(orden_entrega), 0) AS max_orden FROM pedidos WHERE cod_ruta = $1',
    [cod_ruta]
  );
  const maxOrden = parseInt(maxOrdenResult.rows[0].max_orden);

  await Promise.all(
    pedido_ids.map((pid, idx) =>
      pool.query(
        'UPDATE pedidos SET cod_ruta = $1, orden_entrega = $2 WHERE id_pedido = $3',
        [cod_ruta, maxOrden + idx + 1, pid]
      )
    )
  );

  await Promise.all(
    pedido_ids.map(async (pid) => {
      const cliente_db = await pool.connect();
      try {
        await cliente_db.query('BEGIN');
        await cliente_db.query('DELETE FROM pedido_estado WHERE id_pedido = $1', [pid]);
        await cliente_db.query(
          'INSERT INTO pedido_estado (id_pedido, cod_estado, cantidad_entregada) VALUES ($1, 2, 0)',
          [pid]
        );
        await cliente_db.query('COMMIT');
      } catch (err) {
        await cliente_db.query('ROLLBACK');
        throw err;
      } finally {
        cliente_db.release();
      }
    })
  );

  return getRutaById(cod_ruta);
};

const generarOrdenOptimo = async (cod_ruta) => {
  const ruta = await pool.query('SELECT cod_ruta, estado FROM ruta WHERE cod_ruta = $1', [cod_ruta]);
  if (ruta.rows.length === 0) throw new Error('Ruta no encontrada');
  if (ruta.rows[0].estado === 'cerrada') throw new Error('No se puede optimizar una ruta cerrada');

  const ESTADOS_FINALES = ['entregado', 'parcial', 'fallido'];

  const pedidosResult = await pool.query(`
    SELECT DISTINCT ON (p.id_pedido) p.id_pedido, p.orden_entrega, c.latitud, c.longitud,
           ep.descripcion AS estado
    FROM pedidos p
    JOIN solicita s ON s.id_pedido = p.id_pedido
    JOIN clientes c ON c.id_cliente = s.id_cliente
    LEFT JOIN pedido_estado pe ON pe.id_pedido = p.id_pedido
    LEFT JOIN estado_pedido ep ON ep.cod = pe.cod_estado
    WHERE p.cod_ruta = $1
  `, [cod_ruta]);

  const finalizados = pedidosResult.rows.filter(p => ESTADOS_FINALES.includes(p.estado));
  const activos     = pedidosResult.rows.filter(p => !ESTADOS_FINALES.includes(p.estado));

  if (activos.length < 2) {
    throw new Error('La ruta necesita al menos 2 pedidos pendientes para optimizar');
  }

  const maxOrdenFinalizado = finalizados.reduce(
    (max, p) => Math.max(max, p.orden_entrega || 0), 0
  );

  const activosConCoordenadas = activos.filter(p => p.latitud !== null && p.longitud !== null);
  const activosSinCoordenadas = activos.filter(p => p.latitud === null || p.longitud === null);

  if (activosConCoordenadas.length < 2) {
    throw new Error('La ruta necesita al menos 2 pedidos pendientes con coordenadas para optimizar');
  }

  let ordenado;
  let optimizacionAutomatica = true;

  try {
    const apiKey = process.env.ORS_API_KEY;
    if (!apiKey) throw new Error('ORS_API_KEY no configurada');

    const jobs = activosConCoordenadas.map(p => ({
      id: p.id_pedido,
      location: [parseFloat(p.longitud), parseFloat(p.latitud)],
    }));

    const respuesta = await fetch('https://api.openrouteservice.org/optimization', {
      method: 'POST',
      headers: {
        Authorization: apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        vehicles: [{ id: 1, profile: 'driving-car', start: [ORIGEN.lon, ORIGEN.lat], end: [ORIGEN.lon, ORIGEN.lat] }],
        jobs,
      }),
    });

    if (!respuesta.ok) throw new Error(`ORS respondió con estado ${respuesta.status}`);

    const datos = await respuesta.json();
    const pasos = datos.routes[0].steps.filter(s => s.type === 'job');
    ordenado = pasos.map(s => s.job);
  } catch (_) {
    optimizacionAutomatica = false;
    ordenado = activosConCoordenadas.map(p => p.id_pedido);
  }

  await Promise.all(
    ordenado.map((id_pedido, idx) =>
      pool.query('UPDATE pedidos SET orden_entrega = $1 WHERE id_pedido = $2',
        [maxOrdenFinalizado + idx + 1, id_pedido])
    )
  );

  await Promise.all(
    activosSinCoordenadas.map((p, idx) =>
      pool.query('UPDATE pedidos SET orden_entrega = $1 WHERE id_pedido = $2',
        [maxOrdenFinalizado + ordenado.length + idx + 1, p.id_pedido])
    )
  );

  const rutaActualizada = await getRutaById(cod_ruta);

  if (!optimizacionAutomatica) {
    return { ...rutaActualizada, aviso: 'Optimización automática no disponible. Se asignó un orden provisional; ajústelo manualmente si es necesario.' };
  }

  return rutaActualizada;
};

const actualizarOrden = async (cod_ruta, pedidos) => {
  const ruta = await pool.query('SELECT cod_ruta FROM ruta WHERE cod_ruta = $1', [cod_ruta]);
  if (ruta.rows.length === 0) throw new Error('Ruta no encontrada');

  await Promise.all(
    pedidos.map(({ id_pedido, orden_entrega }) =>
      pool.query(
        'UPDATE pedidos SET orden_entrega = $1 WHERE id_pedido = $2 AND cod_ruta = $3',
        [orden_entrega, id_pedido, cod_ruta]
      )
    )
  );

  return getRutaById(cod_ruta);
};

module.exports = {
  getRutas,
  getRutaById,
  getRutaDeRepartidorHoy,
  createRuta,
  actualizarRepartidores,
  esRepartidorAsignado,
  asignarPedidos,
  generarOrdenOptimo,
  actualizarOrden,
  cerrarReparto,
};
