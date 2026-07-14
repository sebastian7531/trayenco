const service = require('../services/asistencia.service');
const { success, error } = require('../utils/response');

const getAsistencia = async (req, res) => {
  try {
    return success(res, await service.getAsistencia());
  } catch (err) {
    return error(res, err.message);
  }
};

const getAsistenciaHoy = async (req, res) => {
  try {
    return success(res, await service.getAsistenciaHoy());
  } catch (err) {
    return error(res, err.message);
  }
};

const registrarEntrada = async (req, res) => {
  try {
    const data = await service.registrarEntrada(req.user.id);
    return success(res, data, 'Entrada registrada', 201);
  } catch (err) {
    const status = err.message.includes('Ya existe') ? 409 : 500;
    return error(res, err.message, status);
  }
};

const registrarSalida = async (req, res) => {
  try {
    const data = await service.registrarSalida(req.user.id);
    return success(res, data, 'Salida registrada');
  } catch (err) {
    const status = err.message.includes('No hay entrada') ? 404
      : err.message.includes('Ya existe') ? 409 : 500;
    return error(res, err.message, status);
  }
};

const getReporteAsistencia = async (req, res) => {
  try {
    const { repartidor_id } = req.params;
    const { fecha_inicio, fecha_fin } = req.query;
    if (!fecha_inicio || !fecha_fin) {
      return error(res, 'fecha_inicio y fecha_fin son requeridos como query params', 400);
    }
    return success(res, await service.getReporteAsistencia(repartidor_id, fecha_inicio, fecha_fin));
  } catch (err) {
    return error(res, err.message);
  }
};

module.exports = { getAsistencia, getAsistenciaHoy, registrarEntrada, registrarSalida, getReporteAsistencia };
