const service = require('../services/ruta.service');
const { success, error } = require('../utils/response');

const obtenerRepartidorIds = (body) => {
  const valor = body.repartidor_ids !== undefined
    ? body.repartidor_ids
    : body.id_repartidor !== undefined
      ? [body.id_repartidor]
      : null;

  if (!Array.isArray(valor) || valor.length === 0) {
    return { mensaje: 'Debe seleccionar al menos un repartidor' };
  }

  const repartidor_ids = valor.map(Number);
  if (repartidor_ids.some(id => !Number.isInteger(id) || id <= 0)) {
    return { mensaje: 'Todos los identificadores de repartidor deben ser enteros válidos' };
  }
  if (new Set(repartidor_ids).size !== repartidor_ids.length) {
    return { mensaje: 'No se permiten identificadores de repartidor repetidos' };
  }
  return { repartidor_ids };
};

const estadoErrorRepartidores = (err) =>
  err.message.includes('no encontrada') ? 404
    : err.message.includes('no encontrados') || err.message.includes('sin rol repartidor') ? 400
      : 500;

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

const getHistorialRutas = async (req, res) => {
  try {
    return success(res, await service.getHistorialRutas());
  } catch (err) {
    return error(res, err.message);
  }
};

const getRutaById = async (req, res) => {
  try {
    const data = await service.getRutaById(req.params.id);
    if (!data) return error(res, 'Ruta no encontrada', 404);
    if (
      req.user.rol === 'repartidor' &&
      !await service.esRepartidorAsignado(req.params.id, req.user.id)
    ) {
      return error(res, 'Solo puedes consultar una ruta que tengas asignada', 403);
    }
    return success(res, data);
  } catch (err) {
    return error(res, err.message);
  }
};

const createRuta = async (req, res) => {
  try {
    const { fecha, cod_zonas, texto, cantidad_bidones } = req.body;
    if (!Array.isArray(cod_zonas) || cod_zonas.length === 0) {
      return error(res, 'Debe seleccionar al menos una zona', 400);
    }
    const seleccion = obtenerRepartidorIds(req.body);
    if (seleccion.mensaje) return error(res, seleccion.mensaje, 400);

    const data = await service.createRuta({
      fecha,
      repartidor_ids: seleccion.repartidor_ids,
      cod_zonas,
      texto,
      cantidad_bidones,
    });
    const io = req.app.get('io');
    io.to('repartidores').emit('ruta_actualizada', data);
    io.to('administradores').emit('ruta_actualizada', data);
    return success(res, data, 'Ruta creada', 201);
  } catch (err) {
    return error(res, err.message, estadoErrorRepartidores(err));
  }
};

const actualizarRepartidores = async (req, res) => {
  try {
    const seleccion = obtenerRepartidorIds(req.body);
    if (seleccion.mensaje) return error(res, seleccion.mensaje, 400);

    const data = await service.actualizarRepartidores(req.params.id, seleccion.repartidor_ids);
    const io = req.app.get('io');
    io.to('repartidores').emit('ruta_actualizada', data);
    io.to('administradores').emit('ruta_actualizada', data);
    return success(res, data, 'Repartidores actualizados');
  } catch (err) {
    const status = err.message.includes('ruta cerrada')
      ? 400
      : estadoErrorRepartidores(err);
    return error(res, err.message, status);
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
    if (
      req.user.rol === 'repartidor' &&
      !await service.esRepartidorAsignado(req.params.id, req.user.id)
    ) {
      return error(res, 'Solo puedes cerrar una ruta que tengas asignada', 403);
    }
    const data = await service.cerrarReparto(req.params.id);
    const io = req.app.get('io');
    io.to('repartidores').emit('ruta_actualizada', data);
    io.to('administradores').emit('ruta_actualizada', data);
    return success(res, data, 'Reparto cerrado');
  } catch (err) {
    const status = err.message.includes('no encontrada') ? 404
      : err.message.includes('ya está cerrada') || err.message.includes('pedidos pendientes') ? 400 : 500;
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

module.exports = {
  getRutas,
  getHistorialRutas,
  getRutaById,
  miRutaHoy,
  createRuta,
  actualizarRepartidores,
  asignarPedidos,
  generarOrdenOptimo,
  actualizarOrden,
  cerrarReparto,
};
