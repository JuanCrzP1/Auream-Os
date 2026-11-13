---
title: Conectar Meta Ads
module: dashboard
summary: Conecta tu cuenta publicitaria con un token de tu Business Manager para traer gasto, clics y conversaciones cada 3 horas.
order: 2
updated: 2026-11-12
keywords: meta ads, facebook ads, conectar, token, usuario del sistema, business manager, cuenta publicitaria, ads_read
related: roas-real, que-hacer-con-cada-campana
---

Auream lee el gasto de tus campañas con un **token** de tu Business Manager. Se saca una vez, toma unos 10 minutos y **no vence**. Auream solo lo usa para **leer** tus anuncios: no crea, no cambia ni apaga nada.

> Necesitas ser **administrador** de tu Business Manager (business.facebook.com) y de la cuenta publicitaria.

## Paso 1. Una app de Meta (solo si tu negocio no tiene ninguna)

Meta pide una app para generar el token. No hay que publicarla ni verificarla.

1. Entra a **developers.facebook.com** con tu Facebook y toca **Mis apps → Crear app**.
2. Ponle un nombre, por ejemplo «Auream de mi negocio», y tu correo.
3. Si te pregunta el caso de uso, elige **Otro**. Si te pregunta el tipo, elige **Negocio**.
4. Cuando te pida el portafolio comercial, elige **el de tu negocio**.

Si tu negocio ya tiene una app, usa esa.

## Paso 2. Un usuario del sistema

1. Entra a **business.facebook.com** → **Configuración** (la rueda) → **Usuarios → Usuarios del sistema**.
2. Toca **Agregar**, ponle de nombre **Auream** y el rol **Empleado**.

## Paso 3. Darle acceso a tu cuenta publicitaria y a la app

1. Con el usuario «Auream» elegido, toca **Asignar activos**.
2. **Cuentas publicitarias:** marca tu cuenta y dale el permiso de **ver el rendimiento**. Basta con ese, no hace falta control total.
3. **Apps:** marca la app del paso 1.
4. Guarda.

## Paso 4. Generar el token

1. Con el usuario «Auream» elegido, toca **Generar token**.
2. Elige la **app** del paso 1.
3. **Vencimiento: Nunca.**
4. En los permisos, marca **ads_read**.
5. Toca **Generar** y **copia el token**: es un texto largo que empieza por «EAA». Meta no lo vuelve a mostrar.

## Paso 5. Pegarlo en Auream

1. En Auream, ve a **Meta Ads → Cuentas** y toca **Conectar con un token**.
2. Pega el token y toca **Conectar**.
3. Elige qué **cuentas publicitarias** usa Auream. Si solo tienes una, se elige sola.

Auream trae los últimos días y se actualiza **cada 3 horas**. También puedes tocar **Actualizar ahora**.

El token se guarda **cifrado** y nunca se vuelve a mostrar.

## Si no conecta

| Lo que dice Auream | Qué hacer |
|---|---|
| «Meta no acepta ese token» | Se copió incompleto, venció o lo borraron. Genera uno nuevo (paso 4) y pégalo completo. |
| «Le falta el permiso ads_read» | Genera el token otra vez y marca **ads_read**. |
| «No ve ninguna cuenta publicitaria» | Asígnale tu cuenta publicitaria al usuario del sistema (paso 3) y vuelve a pegarlo. |

Si más adelante Meta corta el token (por ejemplo, porque borraste el usuario del sistema), Meta Ads lo avisa y te pide uno nuevo.

> **Importante:** solo dueños y administradores de tu cuenta de Auream ven el gasto, el ROAS y la ganancia.
