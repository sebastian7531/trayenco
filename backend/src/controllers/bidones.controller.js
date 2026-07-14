const pool = require('../config/db');
const { success, error } = require('../utils/response');

const getBidones = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM bidones ORDER BY cod_bidon');
    return success(res, result.rows);
  } catch (err) {
    return error(res, err.message);
  }
};

module.exports = { getBidones };
