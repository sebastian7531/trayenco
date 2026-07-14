const service = require('../services/stock.service');
const { success, error } = require('../utils/response');

const getStock = async (req, res) => {
  try {
    return success(res, await service.getStock());
  } catch (err) {
    return error(res, err.message);
  }
};

const getStockHoy = async (req, res) => {
  try {
    const cod_bidon = req.query.cod_bidon ? Number(req.query.cod_bidon) : null;
    return success(res, await service.getStockHoy(cod_bidon));
  } catch (err) {
    return error(res, err.message);
  }
};

const validarCantidadEntera = (valor, nombre) => {
  if (valor === undefined || valor === null || valor === '') return `${nombre} es requerido`;
  const num = Number(valor);
  if (!Number.isInteger(num) || num < 1 || num > 999) {
    return `${nombre} debe ser un número entero entre 1 y 999`;
  }
  return null;
};

const actualizarPlanta = async (req, res) => {
  try {
    const { bidones_planta, cod_bidon } = req.body;
    const mensajeError = validarCantidadEntera(bidones_planta, 'La cantidad');
    if (mensajeError) return error(res, mensajeError, 400);
    if (!cod_bidon) return error(res, 'cod_bidon es requerido', 400);
    return success(res, await service.actualizarPlanta(Number(bidones_planta), Number(cod_bidon)), 'Producción registrada');
  } catch (err) {
    return error(res, err.message);
  }
};

const cargarFurgon = async (req, res) => {
  try {
    const { cantidad, cod_bidon } = req.body;
    const mensajeError = validarCantidadEntera(cantidad, 'La cantidad');
    if (mensajeError) return error(res, mensajeError, 400);
    if (!cod_bidon) return error(res, 'cod_bidon es requerido', 400);
    return success(res, await service.cargarFurgon(Number(cantidad), Number(cod_bidon)), 'Furgón cargado');
  } catch (err) {
    const status = err.message.includes('No hay suficientes') ? 400 : 500;
    return error(res, err.message, status);
  }
};

const confirmarEntrega = async (req, res) => {
  try {
    const { cantidad, cod_bidon } = req.body;
    const mensajeError = validarCantidadEntera(cantidad, 'La cantidad');
    if (mensajeError) return error(res, mensajeError, 400);
    if (!cod_bidon) return error(res, 'cod_bidon es requerido', 400);
    return success(res, await service.confirmarEntrega(Number(cantidad), Number(cod_bidon)), 'Entrega confirmada');
  } catch (err) {
    const status = err.message.includes('insuficientes') ? 400 : 500;
    return error(res, err.message, status);
  }
};

const registrarRetorno = async (req, res) => {
  try {
    const { cantidad, cod_bidon } = req.body;
    const mensajeError = validarCantidadEntera(cantidad, 'La cantidad');
    if (mensajeError) return error(res, mensajeError, 400);
    if (!cod_bidon) return error(res, 'cod_bidon es requerido', 400);
    return success(res, await service.registrarRetorno(Number(cantidad), Number(cod_bidon)), 'Retorno registrado');
  } catch (err) {
    return error(res, err.message);
  }
};

module.exports = { getStock, getStockHoy, actualizarPlanta, cargarFurgon, confirmarEntrega, registrarRetorno };
