function fechaHoy() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' });
}

module.exports = { fechaHoy };
