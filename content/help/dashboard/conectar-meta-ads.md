---
title: Conectar Meta Ads
module: dashboard
summary: Conecta tu cuenta publicitaria con un token de tu negocio en Meta para traer gasto, clics y conversaciones cada 3 horas. Paso a paso completo.
order: 2
updated: 2026-11-12
keywords: meta ads, facebook ads, conectar, token, identificador, usuario del sistema, business manager, cuenta publicitaria, ads_read, app de meta, desarrollador
related: roas-real, que-hacer-con-cada-campana
---

Auream lee el gasto de tus campañas con un **token** que sacas de tu negocio en Meta. Se hace **una sola vez** (unos 15 minutos) y el token **no vence**. Auream solo lo usa para **leer** tus anuncios: no crea, no cambia ni apaga nada.

> **Antes de empezar:** entra con el Facebook que es **administrador del negocio** donde están tus anuncios, es decir, el negocio que tiene la **cuenta publicitaria**. Si tienes varios negocios, revisa en business.facebook.com cuál dice «1 cuenta publicitaria» o más.

## Parte 1. Crear la app (Meta la pide para dar el token)

1. Entra a **developers.facebook.com** y toca **Mis apps** (o **Empezar**, si es la primera vez).
2. Si Meta te pide **crear tu cuenta de desarrollador**: toca **Continuar**, escribe el código que te llega por SMS o correo, y en «¿Qué te describe mejor?» elige **Propietario/fundador**.
3. Toca **Crear app** y llena:
   - **Nombre:** por ejemplo «Auream mi negocio».
   - **Caso de uso:** en **Anuncios y monetización**, elige **«Mide los datos de rendimiento de tus anuncios con la API de marketing»**.
   - **Empresa:** elige **tu negocio**, el que tiene la cuenta publicitaria.
4. Toca **Crear aplicación**. Meta puede pedirte tu contraseña de Facebook.

> La app que Meta crea sola cuando conectas un píxel («Conversions API Application») **no sirve** para esto. Necesitas esta.

## Parte 2. Crear el usuario del sistema

5. Entra a **business.facebook.com**, elige tu negocio y abre **Configuración** (la rueda) → **Usuarios del sistema**.
6. Toca **Añadir**. Si Meta te muestra su **política de no discriminación** en anuncios, léela y toca **Acepto**.
7. Nombre: **Auream**. Rol: **Empleado** (Employee). Toca **Crear**.

## Parte 3. Darle acceso a tu cuenta publicitaria y a la app

8. Con «Auream» seleccionado, toca **Asignar activos** → **Cuentas publicitarias** → marca tu cuenta → activa solo **«Ver rendimiento»** → **Asignar activos**.
9. Ve a **Configuración** → **Aplicaciones** → elige la app de la parte 1 → **Asignar personas** → marca **Auream (System user)** → activa **«Desarrollar la aplicación»** → **Asignar**.

## Parte 4. Sacar el token y pegarlo en Auream

10. Vuelve a **Usuarios del sistema** → **Auream** → **Generar identificador**. En algunos idiomas dice **Generar token**.
11. Elige tu app, vencimiento **Nunca**, marca el permiso **ads_read** y toca **Generar**.
12. **Copia el token**: es un texto largo que empieza por «EAA». Meta **no lo vuelve a mostrar**, así que pégalo enseguida.
13. En Auream, ve a **Meta Ads → Cuentas** → **Conectar con un token** → pégalo → **Conectar**.

Auream trae tus cuentas publicitarias. Si tienes una sola, se elige sola. Los últimos días llegan enseguida y después se actualiza **cada 3 horas**; también puedes tocar **Actualizar ahora**.

El token se guarda **cifrado** y nunca se vuelve a mostrar. No lo compartas por chat ni por correo: es como una contraseña.

## Si algo no funciona

| Lo que ves | Qué pasa y qué hacer |
|---|---|
| El botón **Añadir** de usuarios del sistema está **gris** | El negocio no tiene una app. Haz la **parte 1**. |
| **Generar identificador** está **gris** | El usuario «Auream» no tiene la app asignada. Haz el **paso 9**. |
| No aparece tu cuenta publicitaria al asignar activos | Estás en otro negocio. Cambia al que tiene la cuenta publicitaria. |
| Auream dice «Meta no acepta ese token» | Se copió incompleto, venció o lo borraron. Genera uno nuevo (pasos 10 a 12) y pégalo completo. |
| Auream dice «Le falta el permiso ads_read» | Al generarlo no se marcó **ads_read**. Genera otro y márcalo. |
| Auream dice «No ve ninguna cuenta publicitaria» | Al usuario «Auream» le falta la cuenta. Haz el **paso 8** y vuelve a pegar el token. |

Si más adelante Meta corta el token (por ejemplo, porque borraste el usuario del sistema), Meta Ads lo avisa y te pide uno nuevo.

> **Importante:** solo dueños y administradores de tu cuenta de Auream ven el gasto, el ROAS y la ganancia.
