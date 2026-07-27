import test from 'node:test'
import assert from 'node:assert/strict'
import { construirPedidosCarga } from './pedidoPayload.js'

test('construye un pedido por cliente sin enviar líneas vacías o cantidades inválidas', () => {
  const bidones = [
    { cod_bidon: 7, formato: 'Formato pequeño' },
    { cod_bidon: 9, formato: 'Formato grande' },
  ]
  const filas = [
    {
      id_cliente: 4,
      nombre: 'Cliente válido',
      urgente: true,
      cantidades: { 7: '2', 9: '0' },
    },
    {
      id_cliente: 5,
      nombre: 'Cliente sin pedido',
      urgente: false,
      cantidades: { 7: '', 9: '1.5' },
    },
  ]

  assert.deepEqual(construirPedidosCarga(filas, bidones), [
    {
      nombre: 'Cliente válido',
      payload: {
        id_cliente: 4,
        prioridad: 'urgente',
        lineas: [{ cod_bidon: 7, cantidad: 2 }],
      },
    },
  ])
})

test('crea payloads independientes para varios clientes seleccionados', () => {
  const bidones = [{ cod_bidon: 3, formato: 'Bidón retornable' }]
  const filas = [
    { id_cliente: 10, nombre: 'Uno', urgente: false, cantidades: { 3: 1 } },
    { id_cliente: 11, nombre: 'Dos', urgente: true, cantidades: { 3: 4 } },
  ]

  const pedidos = construirPedidosCarga(filas, bidones)

  assert.equal(pedidos.length, 2)
  assert.ok(pedidos.every(pedido => pedido.payload.lineas.length > 0))
  assert.deepEqual(pedidos.map(pedido => pedido.payload.prioridad), ['normal', 'urgente'])
})
