const test = require('node:test');
const assert = require('node:assert/strict');

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

test('rechaza un retorno superior al saldo en ruta y revierte la transacción', async () => {
  const consultas = [];
  const stock = {
    id_stock: 1,
    bidones_cargados: 27,
    bidones_entregados: 15,
    bidones_retornados: 12,
  };
  const client = {
    async query(sql) {
      consultas.push(sql);
      if (sql.startsWith('SELECT * FROM stock WHERE fecha')) return { rows: [stock] };
      if (sql.includes('FOR UPDATE')) return { rows: [stock] };
      return { rows: [] };
    },
    release() {},
  };
  const pool = { connect: async () => client };
  const service = cargarConPool('../src/services/stock.service', pool);

  await assert.rejects(
    service.registrarRetorno(1, 2),
    /El retorno supera los bidones disponibles en ruta\. Disponibles: 0/
  );
  assert.ok(consultas.some(sql => sql.includes('FOR UPDATE')));
  assert.ok(consultas.includes('ROLLBACK'));
  assert.ok(!consultas.some(sql => sql.startsWith('UPDATE stock')));
});

test('registra un retorno válido con bloqueo y confirma la transacción', async () => {
  const consultas = [];
  const stock = {
    id_stock: 1,
    bidones_cargados: 27,
    bidones_entregados: 15,
    bidones_retornados: 10,
  };
  const client = {
    async query(sql) {
      consultas.push(sql);
      if (sql.startsWith('SELECT * FROM stock WHERE fecha')) return { rows: [stock] };
      if (sql.includes('FOR UPDATE')) return { rows: [stock] };
      if (sql.startsWith('UPDATE stock')) {
        return { rows: [{ ...stock, bidones_retornados: 12 }] };
      }
      return { rows: [] };
    },
    release() {},
  };
  const pool = { connect: async () => client };
  const service = cargarConPool('../src/services/stock.service', pool);

  const actualizado = await service.registrarRetorno(2, 2);

  assert.equal(actualizado.bidones_retornados, 12);
  assert.ok(consultas.some(sql => sql.includes('FOR UPDATE')));
  assert.ok(consultas.some(sql => sql.startsWith('UPDATE stock')));
  assert.ok(consultas.includes('COMMIT'));
  assert.ok(!consultas.includes('ROLLBACK'));
});

test('impide cerrar una ruta que todavía contiene pedidos pendientes', async () => {
  const consultas = [];
  const client = {
    async query(sql) {
      consultas.push(sql);
      if (sql.startsWith('SELECT cod_ruta')) {
        return { rows: [{ cod_ruta: 7, estado: 'activa' }] };
      }
      if (sql.includes('COUNT(DISTINCT p.id_pedido)')) {
        return { rows: [{ total: 1 }] };
      }
      return { rows: [] };
    },
    release() {},
  };
  const pool = { connect: async () => client };
  const service = cargarConPool('../src/services/ruta.service', pool);

  await assert.rejects(
    service.cerrarReparto(7),
    /La ruta tiene pedidos pendientes y no puede cerrarse/
  );
  assert.ok(consultas.some(sql => sql.includes('FOR UPDATE')));
  assert.ok(consultas.includes('ROLLBACK'));
  assert.ok(!consultas.some(sql => sql.startsWith('UPDATE ruta')));
});

test('el reporte diario acepta las variantes 20 L y 20 litros', async () => {
  let consultaStock = '';
  const pool = {
    async query(sql) {
      if (sql.includes('FROM stock s')) {
        consultaStock = sql;
        return {
          rows: [{
            bidones_planta: 122,
            bidones_entregados: 15,
            bidones_retornados: 16,
            bidones_planta_10l: 32,
            bidones_planta_20l: 90,
            bidones_entregados_10l: 0,
            bidones_entregados_20l: 15,
            bidones_retornados_10l: 4,
            bidones_retornados_20l: 12,
          }],
        };
      }
      return {
        rows: [{
          total: 1,
          entregados: 1,
          problemas_entrega: 0,
          pendientes: 0,
        }],
      };
    },
  };
  const service = cargarConPool('../src/services/reporte.service', pool);

  const reporte = await service.resumenDiario('2026-07-28');

  assert.equal(reporte.stock.bidones_entregados_20l, 15);
  assert.equal(reporte.stock.bidones_entregados_10l, 0);
  assert.match(
    consultaStock,
    /LOWER\(TRIM\(b\.formato\)\) IN \('20 l', '20 litros'\)/
  );
});

test('el reporte diario acepta las variantes 10 L y 10 litros', async () => {
  let consultaStock = '';
  const pool = {
    async query(sql) {
      if (sql.includes('FROM stock s')) {
        consultaStock = sql;
        return {
          rows: [{
            bidones_planta: 122,
            bidones_entregados: 15,
            bidones_retornados: 16,
            bidones_planta_10l: 32,
            bidones_planta_20l: 90,
            bidones_entregados_10l: 0,
            bidones_entregados_20l: 15,
            bidones_retornados_10l: 4,
            bidones_retornados_20l: 12,
          }],
        };
      }
      return {
        rows: [{
          total: 1,
          entregados: 1,
          problemas_entrega: 0,
          pendientes: 0,
        }],
      };
    },
  };
  const service = cargarConPool('../src/services/reporte.service', pool);

  const reporte = await service.resumenDiario('2026-07-28');

  assert.equal(reporte.stock.bidones_entregados_10l, 0);
  assert.match(
    consultaStock,
    /LOWER\(TRIM\(b\.formato\)\) IN \('10 l', '10 litros'\)/
  );
});

test('protege las mutaciones administrativas y retira POST /stock/entrega', () => {
  const pool = {
    query: async () => ({ rows: [] }),
    connect: async () => ({ query: async () => ({ rows: [] }), release() {} }),
  };
  const router = cargarConPool(
    '../src/routes/stock.routes',
    pool,
    ['../src/controllers/stock.controller', '../src/services/stock.service']
  );
  const rutas = new Map(
    router.stack
      .filter(layer => layer.route)
      .map(layer => [layer.route.path, layer.route.stack.map(handler => handler.handle.name)])
  );

  assert.equal(rutas.has('/entrega'), false);
  for (const ruta of ['/planta', '/cargar', '/retorno']) {
    assert.ok(rutas.get(ruta).includes('requireAdmin'));
  }

  const { requireAdmin } = require('../src/middleware/auth.middleware');
  let siguiente = false;
  const respuesta = {
    codigo: null,
    cuerpo: null,
    status(codigo) {
      this.codigo = codigo;
      return this;
    },
    json(cuerpo) {
      this.cuerpo = cuerpo;
      return this;
    },
  };
  requireAdmin({ user: { rol: 'repartidor' } }, respuesta, () => {
    siguiente = true;
  });

  assert.equal(siguiente, false);
  assert.equal(respuesta.codigo, 403);
  assert.equal(respuesta.cuerpo.success, false);
});
