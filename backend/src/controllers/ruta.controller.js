const service = require('../services/ruta.service');
const { success, error } = require('../utils/response');

const miRutaHoy = async (req, res) => {
  try {
    return success(res, await service.getRutaDeRepartidorHoy(req.user.id));
  } catch (err) {
    return error(res, err.message);
  }
};

const getRutas = async (req, res) => {
  try {
    return success(res, await service.getRutas());
  } catch (err) {
    return error(res, err.message);
  }
};

const getRutaById = async (req, res) => {
  try {
    const data = await service.getRutaById(req.params.id);
    if (!data) return error(res, 'Ruta no encontrada', 404);
    return success(res, data);
  } catch (err) {
    return error(res, err.message);
  }
};

const createRuta = async (req, res) => {
  try {
    const { fecha, id_repartidor, cod_zonas, texto, cantidad_bidones } = req.body;
    if (!Array.isArray(cod_zonas) || cod_zonas.length === 0) {
      return error(res, 'Debe seleccionar al menos una zona', 400);
    }
    const data = await service.createRuta({ fecha, id_repartidor, cod_zonas, texto, cantidad_bidones });
    const io = req.app.get('io');
    io.to('repartidores').emit('ruta_actualizada', data);
    io.to('administradores').emit('ruta_actualizada', data);
    return success(res, data, 'Ruta creada', 201);
  } catch (err) {
    return error(res, err.message);
  }
};

const asignarPedidos = async (req, res) => {
  try {
    const { pedido_ids } = req.body;
    if (!Array.isArray(pedido_ids) || pedido_ids.length === 0) {
      return error(res, 'pedido_ids debe ser un array con al menos un elemento', 400);
    }
    const data = await service.asignarPedidos(req.params.id, pedido_ids);
    const io = req.app.get('io');
    io.to('repartidores').emit('ruta_actualizada', data);
    io.to('administradores').emit('ruta_actualizada', data);
    return success(res, data, 'Pedidos asignados a la ruta');
  } catch (err) {
    const status = err.message.includes('no encontrada') ? 404
      : err.message.includes('no están en estado') ? 400
      : err.message.includes('ya pertenecen a otra ruta') ? 400 : 500;
    return error(res, err.message, status);
  }
};

const generarOrdenOptimo = async (req, res) => {
  try {
    const data = await service.generarOrdenOptimo(req.params.id);
    const io = req.app.get('io');
    io.to('repartidores').emit('ruta_actualizada', data);
    io.to('administradores').emit('ruta_actualizada', data);
    const mensaje = data.aviso || 'Orden óptimo generado';
    return success(res, data, mensaje);
  } catch (err) {
    const status = err.message.includes('no encontrada') ? 404
      : err.message.includes('necesita al menos') ? 400
      : err.message.includes('cerrada') ? 400 : 500;
    return error(res, err.message, status);
  }
};

const cerrarReparto = async (req, res) => {
  try {
    const data = await service.cerrarReparto(req.params.id);
    const io = req.app.get('io');
    io.to('repartidores').emit('ruta_actualizada', data);
    io.to('administradores').emit('ruta_actualizada', data);
    return success(res, data, 'Reparto cerrado');
  } catch (err) {
    const status = err.message.includes('no encontrada') ? 404
      : err.message.includes('ya está cerrada') ? 400 : 500;
    return error(res, err.message, status);
  }
};

const actualizarOrden = async (req, res) => {
  try {
    const { pedidos } = req.body;
    if (!Array.isArray(pedidos) || pedidos.length === 0) {
      return error(res, 'pedidos debe ser un array con al menos un elemento', 400);
    }
    const data = await service.actualizarOrden(req.params.id, pedidos);
    return success(res, data, 'Orden actualizado');
  } catch (err) {
    const status = err.message.includes('no encontrada') ? 404 : 500;
    return error(res, err.message, status);
  }
};

module.exports = { getRutas, getRutaById, miRutaHoy, createRuta, asignarPedidos, generarOrdenOptimo, actualizarOrden, cerrarReparto };
