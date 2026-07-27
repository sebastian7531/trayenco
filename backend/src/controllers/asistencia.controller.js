const service = require('../services/asistencia.service');
const { success, error } = require('../utils/response');

const responderError = (res, err) => {
  if (err.status) {
    return error(res, err.message, err.status);
  }

  console.error('[Asistencia]', err);
  return error(res, 'Error interno al procesar la asistencia', 500);
};

const esFechaISOValida = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;

  const fecha = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(fecha.getTime())
    && fecha.toISOString().slice(0, 10) === value;
};

const getAsistencia = async (req, res) => {
  try {
    return success(res, await service.getAsistencia());
  } catch (err) {
    return responderError(res, err);
  }
};

const getAsistenciaHoy = async (req, res) => {
  try {
    if (req.user.rol === 'administrador') {
      return success(res, await service.getAsistenciaHoy());
    }

    if (req.user.rol === 'repartidor') {
      return success(res, await service.getAsistenciaHoy(req.user.id));
    }

    return error(res, 'Acceso denegado', 403);
  } catch (err) {
    return responderError(res, err);
  }
};

const registrarEntrada = async (req, res) => {
  try {
    const data = await service.registrarEntrada(req.user.id);
    return success(res, data, 'Entrada registrada', 201);
  } catch (err) {
    return responderError(res, err);
  }
};

const registrarSalida = async (req, res) => {
  try {
    const data = await service.registrarSalida(req.user.id);
    return success(res, data, 'Salida registrada');
  } catch (err) {
    return responderError(res, err);
  }
};

const getReporteAsistencia = async (req, res) => {
  try {
    const id_repartidor = Number(req.params.repartidor_id);
    const { fecha_inicio, fecha_fin } = req.query;

    if (!Number.isInteger(id_repartidor) || id_repartidor <= 0) {
      return error(res, 'repartidor_id debe ser un entero positivo', 400);
    }

    if (!esFechaISOValida(fecha_inicio) || !esFechaISOValida(fecha_fin)) {
      return error(
        res,
        'fecha_inicio y fecha_fin deben usar el formato YYYY-MM-DD',
        400
      );
    }

    if (fecha_inicio > fecha_fin) {
      return error(
        res,
        'fecha_inicio no puede ser posterior a fecha_fin',
        400
      );
    }

    return success(
      res,
      await service.getReporteAsistencia(
        id_repartidor,
        fecha_inicio,
        fecha_fin
      )
    );
  } catch (err) {
    return responderError(res, err);
  }
};

module.exports = {
  getAsistencia,
  getAsistenciaHoy,
  registrarEntrada,
  registrarSalida,
  getReporteAsistencia,
};
