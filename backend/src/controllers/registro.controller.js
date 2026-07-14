const service = require('../services/registro.service');
const { success, error } = require('../utils/response');

const getRegistros = async (req, res) => {
  try {
    const { fecha } = req.query;
    return success(res, await service.getRegistros(fecha || null));
  } catch (err) {
    return error(res, err.message);
  }
};

const getResumen = async (req, res) => {
  try {
    const { fecha } = req.query;
    return success(res, await service.getResumen(fecha || null));
  } catch (err) {
    return error(res, err.message);
  }
};

module.exports = { getRegistros, getResumen };
