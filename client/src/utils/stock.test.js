import test from 'node:test'
import assert from 'node:assert/strict'
import { calcularSaldosStock, fechaHoySantiago } from './stock.js'

test('calcula planta disponible y stock en ruta por formato sin ocultar negativos', () => {
  const stock20L = {
    bidones_planta: 90,
    bidones_cargados: 27,
    bidones_entregados: 15,
    bidones_retornados: 12,
  }
  const stock10L = {
    bidones_planta: 32,
    bidones_cargados: 4,
    bidones_entregados: 0,
    bidones_retornados: 4,
  }

  const saldos20L = calcularSaldosStock(stock20L)
  const saldos10L = calcularSaldosStock(stock10L)

  assert.deepEqual(saldos20L, {
    plantaDisponible: 75,
    enRuta: 0,
  })
  assert.deepEqual(saldos10L, {
    plantaDisponible: 32,
    enRuta: 0,
  })
  assert.equal(saldos20L.plantaDisponible + saldos10L.plantaDisponible, 107)
  assert.equal(saldos20L.enRuta + saldos10L.enRuta, 0)
  assert.equal(calcularSaldosStock({
    bidones_planta: 0,
    bidones_cargados: 1,
    bidones_entregados: 1,
    bidones_retornados: 1,
  }).enRuta, -1)
})

test('obtiene hoy en America/Santiago aunque UTC ya esté en el día siguiente', () => {
  assert.equal(fechaHoySantiago(new Date('2026-07-29T01:00:00.000Z')), '2026-07-28')
})
