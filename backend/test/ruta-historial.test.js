const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

const dbPath = require.resolve('../src/config/db');

const cargarConPool = (modulo, pool, dependencias = []) => {
  const moduloPath = require.resolve(modulo);
  delete require.cache[moduloPath];
  for (const dependencia of dependencias) {
    delete require.cache[require.resolve(dependencia)];
  }
  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: pool,
  };
  return require(moduloPath);
};

const respuestaMock = () => ({
  codigo: 200,
  cuerpo: null,
  status(codigo) {
    this.codigo = codigo;
    return this;
  },
  json(cuerpo) {
    this.cuerpo = cuerpo;
    return this;
  },
});
test('una ruta nueva registra su activación en Santiago y conserva múltiples repartidores', async () => {
  const consultas = [];
  const client = {
    async query(sql, params) {
      consultas.push({ sql, params });
      if (sql.includes('FROM repartidor') && sql.includes('ANY')) {
        return {
          rows: [
            { id_repartidor: 2, nombre: 'Repartidor Dos', rol: 'repartidor' },
            { id_repartidor: 3, nombre: 'Repartidor Tres', rol: 'repartidor' },
          ],
        };
      }
      if (sql.includes('INSERT INTO ruta (')) {
        return { rows: [{ cod_ruta: 10, estado: 'activa' }] };
      }
      if (sql.includes('INSERT INTO tiene_ruta')) {
        return {
          rows: [{
            cod_ruta: 10,
            cod_estado: 1,
            fecha: '2026-07-28',
            hora: '09:12:04',
          }],
        };
      }
      return { rows: [] };
    },
    release() {},
  };
  const pool = {
    connect: async () => client,
    query: async () => ({ rows: [] }),
  };
  const service = cargarConPool('../src/services/ruta.service', pool);

  await service.createRuta({
    fecha: '2026-07-28',
    repartidor_ids: [2, 3],
    cod_zonas: [1],
    texto: null,
    cantidad_bidones: 8,
  });

  assert.ok(consultas.some(({ sql }) =>
    sql.includes("SET LOCAL TIME ZONE 'America/Santiago'")
  ));
  const activacion = consultas.find(({ sql }) => sql.includes('INSERT INTO tiene_ruta'));
  assert.deepEqual(activacion.params, [10, 'activa']);
  assert.match(activacion.sql, /CURRENT_DATE, LOCALTIME\(0\)/);

  const asignaciones = consultas.filter(({ sql }) =>
    sql.includes('INSERT INTO ruta_repartidor')
  );
  assert.deepEqual(asignaciones.map(({ params }) => params), [[10, 2], [10, 3]]);

  const indiceActivacion = consultas.findIndex(({ sql }) => sql.includes('INSERT INTO tiene_ruta'));
  const indiceCommit = consultas.findIndex(({ sql }) => sql === 'COMMIT');
  assert.ok(indiceActivacion > -1 && indiceActivacion < indiceCommit);
});

test('el cierre registra término en la misma transacción y un segundo cierre no lo reemplaza', async () => {
  const consultas = [];
  let estado = 'activa';
  let horaCierre = null;

  const client = {
    async query(sql, params) {
      consultas.push({ sql, params });
      if (sql.startsWith('SELECT cod_ruta')) {
        return { rows: [{ cod_ruta: 10, estado }] };
      }
      if (sql.includes('COUNT(DISTINCT p.id_pedido)')) {
        return { rows: [{ total: 0 }] };
      }
      if (sql.startsWith('UPDATE ruta')) {
        estado = 'cerrada';
        return { rows: [] };
      }
      if (sql.includes('INSERT INTO tiene_ruta')) {
        horaCierre = horaCierre || '09:44:31';
        return {
          rows: [{
            cod_ruta: 10,
            cod_estado: 2,
            fecha: '2026-07-28',
            hora: horaCierre,
          }],
        };
      }
      return { rows: [] };
    },
    release() {},
  };
  const pool = {
    connect: async () => client,
    query: async () => ({ rows: [] }),
  };
  const service = cargarConPool('../src/services/ruta.service', pool);

  await service.cerrarReparto(10);
  const primeraHora = horaCierre;

  await assert.rejects(
    service.cerrarReparto(10),
    /La ruta ya est/
  );

  assert.equal(horaCierre, primeraHora);
  assert.equal(
    consultas.filter(({ sql }) => sql.includes('INSERT INTO tiene_ruta')).length,
    1
  );
  assert.ok(consultas.some(({ sql }) => sql.includes('FOR UPDATE')));

  const indiceUpdate = consultas.findIndex(({ sql }) => sql.startsWith('UPDATE ruta'));
  const indiceCierre = consultas.findIndex(({ sql }) => sql.includes('INSERT INTO tiene_ruta'));
  const indiceCommit = consultas.findIndex(({ sql }) => sql === 'COMMIT');
  assert.ok(indiceUpdate < indiceCierre && indiceCierre < indiceCommit);
});

test('un cierre rechazado no registra término y revierte la transacción', async () => {
  const consultas = [];
  const client = {
    async query(sql) {
      consultas.push(sql);
      if (sql.startsWith('SELECT cod_ruta')) {
        return { rows: [{ cod_ruta: 12, estado: 'activa' }] };
      }
      if (sql.includes('COUNT(DISTINCT p.id_pedido)')) {
        return { rows: [{ total: 2 }] };
      }
      return { rows: [] };
    },
    release() {},
  };
  const pool = {
    connect: async () => client,
    query: async () => ({ rows: [] }),
  };
  const service = cargarConPool('../src/services/ruta.service', pool);

  await assert.rejects(
    service.cerrarReparto(12),
    /pedidos pendientes/
  );

  assert.ok(consultas.includes('ROLLBACK'));
  assert.equal(consultas.some(sql => sql.includes('INSERT INTO tiene_ruta')), false);
  assert.equal(consultas.some(sql => sql.startsWith('UPDATE ruta')), false);
});

test('el historial conserva rutas antiguas, duración, múltiples repartidores y fallback legacy', async () => {
  let consulta = '';
  const esperado = [
    {
      cod_ruta: 9,
      fecha: '2026-07-28',
      hora_inicio: '09:12:04',
      hora_termino: '09:44:31',
      duracion_segundos: 1947,
      estado: 'cerrada',
      repartidores: [
        { id_repartidor: 2, nombre: 'Repartidor Dos' },
        { id_repartidor: 3, nombre: 'Repartidor Tres' },
      ],
    },
    {
      cod_ruta: 8,
      fecha: '2026-07-27',
      hora_inicio: null,
      hora_termino: null,
      duracion_segundos: null,
      estado: 'activa',
      repartidores: [{ id_repartidor: 4, nombre: 'Repartidor Legacy' }],
    },
  ];
  const pool = {
    async query(sql) {
      consulta = sql;
      return { rows: esperado };
    },
  };
  const service = cargarConPool('../src/services/ruta.service', pool);

  const historial = await service.getHistorialRutas();

  assert.deepEqual(historial, esperado);
  assert.match(consulta, /LEFT JOIN tiene_ruta inicio/);
  assert.match(consulta, /LEFT JOIN tiene_ruta termino/);
  assert.match(consulta, /AT TIME ZONE 'America\/Santiago'/);
  assert.match(consulta, /termino\.fecha \+ termino\.hora/);
  assert.match(consulta, /inicio\.fecha \+ inicio\.hora/);
  assert.match(consulta, /UNION ALL/);
  assert.match(consulta, /ORDER BY r\.fecha DESC, r\.cod_ruta DESC/);
  assert.doesNotMatch(consulta, /email|password/);
});

test('la duración SQL contempla correctamente un cierre después de medianoche', async () => {
  const pool = {
    async query(sql) {
      assert.match(sql, /termino\.fecha \+ termino\.hora/);
      assert.match(sql, /inicio\.fecha \+ inicio\.hora/);
      return {
        rows: [{
          cod_ruta: 20,
          fecha: '2026-07-28',
          hora_inicio: '23:55:00',
          hora_termino: '00:15:00',
          duracion_segundos: 1200,
          estado: 'cerrada',
          repartidores: [],
        }],
      };
    },
  };
  const service = cargarConPool('../src/services/ruta.service', pool);

  const [ruta] = await service.getHistorialRutas();
  assert.equal(ruta.duracion_segundos, 20 * 60);
});

test('no se pueden modificar los repartidores de una ruta cerrada', async () => {
  const consultas = [];
  const client = {
    async query(sql) {
      consultas.push(sql);
      if (sql.startsWith('SELECT cod_ruta')) {
        return { rows: [{ cod_ruta: 4, estado: 'cerrada' }] };
      }
      return { rows: [] };
    },
    release() {},
  };
  const pool = {
    connect: async () => client,
    query: async () => ({ rows: [] }),
  };
  const service = cargarConPool('../src/services/ruta.service', pool);

  await assert.rejects(
    service.actualizarRepartidores(4, [2]),
    /ruta cerrada/
  );

  assert.ok(consultas.includes('ROLLBACK'));
  assert.equal(consultas.some(sql => sql.startsWith('DELETE FROM ruta_repartidor')), false);
  assert.equal(consultas.some(sql => sql.startsWith('UPDATE ruta')), false);
});

test('GET /historial está antes de /:id y exige autenticación de administrador', async () => {
  const anteriorSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'secreto-pruebas-historial';

  const pool = {
    query: async () => ({
      rows: [{
        cod_ruta: 9,
        fecha: '2026-07-28',
        hora_inicio: null,
        hora_termino: null,
        duracion_segundos: null,
        estado: 'activa',
        repartidores: [],
      }],
    }),
  };

  try {
    const router = cargarConPool(
      '../src/routes/ruta.routes',
      pool,
      ['../src/controllers/ruta.controller', '../src/services/ruta.service']
    );
    const middlewareToken = router.stack.find(layer => !layer.route).handle;
    const capasRutas = router.stack.filter(layer => layer.route);
    const rutas = capasRutas.map(layer => layer.route.path);
    assert.ok(rutas.indexOf('/historial') < rutas.indexOf('/:id'));

    const historial = capasRutas.find(layer => layer.route.path === '/historial');
    const [requireAdmin, controlador] = historial.route.stack.map(layer => layer.handle);

    const sinToken = respuestaMock();
    middlewareToken({ headers: {} }, sinToken, () => {
      assert.fail('La solicitud sin token no debe continuar');
    });
    assert.equal(sinToken.codigo, 401);

    const tokenRepartidor = jwt.sign(
      { id: 2, rol: 'repartidor' },
      process.env.JWT_SECRET
    );
    const reqRepartidor = { headers: { authorization: `Bearer ${tokenRepartidor}` } };
    const resRepartidor = respuestaMock();
    middlewareToken(reqRepartidor, resRepartidor, () => {});
    requireAdmin(reqRepartidor, resRepartidor, () => {
      assert.fail('El repartidor no debe acceder al historial');
    });
    assert.equal(resRepartidor.codigo, 403);

    const tokenAdmin = jwt.sign(
      { id: 1, rol: 'administrador' },
      process.env.JWT_SECRET
    );
    const reqAdmin = { headers: { authorization: `Bearer ${tokenAdmin}` } };
    const resAdmin = respuestaMock();
    let adminAutorizado = false;
    middlewareToken(reqAdmin, resAdmin, () => {
      requireAdmin(reqAdmin, resAdmin, () => {
        adminAutorizado = true;
      });
    });
    assert.equal(adminAutorizado, true);
    await controlador(reqAdmin, resAdmin);
    assert.equal(resAdmin.codigo, 200);
    assert.equal(resAdmin.cuerpo.success, true);
    assert.equal(resAdmin.cuerpo.data.length, 1);
  } finally {
    if (anteriorSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = anteriorSecret;
    }
  }
});
