---
title: Cobrar y validar el comprobante de pago
module: automatizaciones
summary: El cliente envía su comprobante, Auream lo lee y, si es válido, registra la venta.
order: 5
updated: 2026-11-11
keywords: cobrar, pago, comprobante, transferencia, validar
related: registrar-venta, por-revisar, herramientas-del-editor
---

## El recorrido

1. Un **Mensaje** con tus datos de pago.
2. **Esperar respuesta** para recibir la foto o el PDF del comprobante.
3. **Comprobante automático** revisa monto, fecha y destino.
4. Si es **válido**, **Registrar venta** guarda la venta con el producto y el precio de su país.
5. Si **no es válido**, un Mensaje pide otro comprobante o una **Notificación** avisa a tu equipo.

> **Importante:** un mismo comprobante no se registra dos veces.

> **Consejo:** si el producto no tiene precio en el país del cliente, la venta queda «Por revisar» en lugar de inventar un precio.
