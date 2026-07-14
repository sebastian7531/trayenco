const success = (res, data, message = 'OK', status = 200) => {
  return res.status(status).json({ success: true, data, message });
};

const error = (res, message = 'Error interno', status = 500) => {
  return res.status(status).json({ success: false, message });
};

module.exports = { success, error };
