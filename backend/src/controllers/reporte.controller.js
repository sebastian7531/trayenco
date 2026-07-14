const service = require('../services/reporte.service');
const { success, error } = require('../utils/response');
const { fechaHoy } = require('../utils/fecha');

const resumenDiario = async (req, res) => {
  try {
    const fecha = req.query.fecha || fechaHoy();
    return success(res, await service.resumenDiario(fecha));
  } catch (err) {
    return error(res, err.message);
  }
};

const pedidosPorPeriodo = async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin } = req.query;
    if (!fecha_inicio || !fecha_fin) {
      return error(res, 'fecha_inicio y fecha_fin son requeridos', 400);
    }
    return success(res, await service.pedidosPorPeriodo(fecha_inicio, fecha_fin));
  } catch (err) {
    return error(res, err.message);
  }
};

const rendimientoReparto = async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin } = req.query;
    if (!fecha_inicio || !fecha_fin) {
      return error(res, 'fecha_inicio y fecha_fin son requeridos', 400);
    }
    return success(res, await service.rendimientoReparto(fecha_inicio, fecha_fin));
  } catch (err) {
    return error(res, err.message);
  }
};

const stockHistorico = async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin } = req.query;
    if (!fecha_inicio || !fecha_fin) {
      return error(res, 'fecha_inicio y fecha_fin son requeridos', 400);
    }
    return success(res, await service.stockHistorico(fecha_inicio, fecha_fin));
  } catch (err) {
    return error(res, err.message);
  }
};

const clientesFrecuentes = async (req, res) => {
  try {
    return success(res, await service.clientesFrecuentes());
  } catch (err) {
    return error(res, err.message);
  }
};

module.exports = { resumenDiario, pedidosPorPeriodo, rendimientoReparto, stockHistorico, clientesFrecuentes };
