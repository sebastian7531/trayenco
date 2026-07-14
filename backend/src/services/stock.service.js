const pool = require('../config/db');
const { fechaHoy } = require('../utils/fecha');

const getStock = async () => {
  const result = await pool.query(`
    SELECT s.*, b.descripcion AS bidon_descripcion, b.formato
    FROM stock s
    LEFT JOIN bidones b ON b.cod_bidon = s.cod_bidon
    ORDER BY s.fecha DESC
  `);
  return result.rows;
};

const getStockHoy = async (cod_bidon, client) => {
  const db = client || pool;
  const hoy = fechaHoy();

  if (cod_bidon) {
    const existing = await db.query(
      'SELECT * FROM stock WHERE fecha = $1 AND cod_bidon = $2',
      [hoy, cod_bidon]
    );
    if (existing.rows.length > 0) return existing.rows[0];

    const created = await db.query(
      `INSERT INTO stock (fecha, bidones_planta, bidones_cargados, bidones_entregados, bidones_retornados, cod_bidon)
       VALUES ($1, 0, 0, 0, 0, $2) RETURNING *`,
      [hoy, cod_bidon]
    );
    return created.rows[0];
  }

  const result = await db.query(
    'SELECT * FROM stock WHERE fecha = $1 ORDER BY cod_bidon',
    [hoy]
  );
  return result.rows;
};

const actualizarPlanta = async (bidones_planta, cod_bidon) => {
  const stock = await getStockHoy(cod_bidon);
  const result = await pool.query(
    'UPDATE stock SET bidones_planta = $1 WHERE id_stock = $2 RETURNING *',
    [bidones_planta, stock.id_stock]
  );
  return result.rows[0];
};

const cargarFurgon = async (cantidad, cod_bidon) => {
  const stock = await getStockHoy(cod_bidon);

  const totalCargado = stock.bidones_cargados + cantidad;
  if (totalCargado > stock.bidones_planta) {
    throw new Error(
      `No hay suficientes bidones en planta. Disponibles: ${stock.bidones_planta - stock.bidones_cargados}`
    );
  }

  const result = await pool.query(
    'UPDATE stock SET bidones_cargados = $1 WHERE id_stock = $2 RETURNING *',
    [totalCargado, stock.id_stock]
  );
  return result.rows[0];
};

const confirmarEntrega = async (cantidad, cod_bidon, client) => {
  const db = client || pool;
  const stock = await getStockHoy(cod_bidon, db);

  const disponiblesEnFurgon = stock.bidones_cargados - stock.bidones_entregados;
  if (cantidad > disponiblesEnFurgon) {
    throw new Error(`Bidones insuficientes en el furgón. Disponibles: ${disponiblesEnFurgon}`);
  }

  const result = await db.query(
    'UPDATE stock SET bidones_entregados = bidones_entregados + $1 WHERE id_stock = $2 RETURNING *',
    [cantidad, stock.id_stock]
  );
  return result.rows[0];
};

const registrarRetorno = async (cantidad, cod_bidon) => {
  const stock = await getStockHoy(cod_bidon);

  const result = await pool.query(
    'UPDATE stock SET bidones_retornados = bidones_retornados + $1 WHERE id_stock = $2 RETURNING *',
    [cantidad, stock.id_stock]
  );
  return result.rows[0];
};

module.exports = { getStock, getStockHoy, actualizarPlanta, cargarFurgon, confirmarEntrega, registrarRetorno };
