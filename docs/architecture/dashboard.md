# Dashboard y Meta Ads

**Dashboard** (`/dashboard`): Ventas · Anuncios · Atención. **Meta Ads** (`/meta-ads`): Píxel · Rendimiento · Cuentas.

| Pieza | Dónde vive |
|---|---|
| Dominios | [`domains/analytics`](../../domains/analytics/README.md) (solo lee) y [`domains/ads`](../../domains/ads/README.md) (conexión y sincronización con Meta) |
| Web | `features/dashboard` y `features/ads`, más la tabla compartida en `shared/ads` |

## Lo que da valor: el ROAS real

Cuando alguien toca un anuncio de clic a WhatsApp y compra en el chat, el Píxel de Meta no ve la compra completa, así que Meta muestra un ROAS más bajo del verdadero. Leona y las herramientas de atribución (Triple Whale, Hyros, RastroLead, Verdash) se diferencian justamente en eso.

Auream ya sabe de qué anuncio llegó cada contacto (`contacts.ad_origin`) y cada venta (`sales.ad_source_id`). Por eso le cuenta cada venta a su anuncio aunque el cliente compre días después, y muestra al lado:
- **ROAS real**: ventas reales ÷ gasto.
- **ROAS de Meta**: compras del Píxel ÷ gasto.

La tabla los presenta así en cada fila: «Ventas Auream / Meta» y «ROAS Auream / Meta».

## Meta Ads

### Conectar

**Inicio de sesión de Meta** (`META_APP_ID` + `META_APP_SECRET`):
1. La web pide el enlace (`POST /ads/meta/oauth`).
2. Meta vuelve a `GET /ads/meta/callback` **sin sesión**. La cuenta sale solo del `state` firmado: HMAC con el secreto de la app, vence en 10 minutos.
3. El código se cambia por un token de 60 días.

**Token pegado**: el de un usuario del sistema del Business Manager, con `ads_read`. No vence. Sirve para quien no puede usar el inicio de sesión.

En los dos casos el token se guarda **cifrado** (`AesGcmSecretCipher`, contexto `tenantId:meta`) y nunca vuelve a salir.
- Viaja en la cabecera `Authorization`, con `appsecret_proof`, y nunca en la URL.
- Los mensajes de Meta se limpian de cualquier cosa con forma de token.

**Para otros negocios:** Meta exige que la app pase su revisión antes de abrirse (como Leona). Para las cuentas propias funciona de una vez. La dirección de vuelta registrada en la app es `META_OAUTH_REDIRECT_URL`, por defecto `https://<dominio>/api/ads/meta/callback`.

### Cuentas y sincronización

- Se guardan todas las cuentas que ve el token y la persona elige cuáles usa Auream. Si hay una sola cuenta activa, se elige sola.
- Cada cuenta elegida tiene su tarea `ads.sync` en la cola (`apps/api/composition/adsSyncAdapters.ts`):
  - **La primera vez**: 31 días, y deja programada otra vuelta con los 31 anteriores, para poder comparar con el periodo anterior.
  - **Después**: cada 3 horas, los últimos 7 días, porque Meta corrige los días recientes.
  - **Si el token ya no sirve**: queda anotado, la página pide «Volver a conectar» y la tarea no insiste.
- Se trae el catálogo completo (campañas, conjuntos y anuncios, con presupuesto y miniatura) y las métricas **por anuncio y por día**:
  - gasto, impresiones y clics;
  - conversaciones de mensajería iniciadas;
  - compras y valor del Píxel. Meta repite la misma compra con varios nombres, así que se toma la mayor, no la suma.
- **Qué hacer** con cada fila (`domains/analytics/domain/adAdvice.ts`) depende de lo que vendió de verdad:

| Consejo | Cuándo |
|---|---|
| Aprendiendo | Gastó menos de lo que cuesta una venta en la cuenta |
| Apagar | Gastó lo de 3 ventas, o tuvo 15 chats, y no vendió nada |
| Escalar | ROAS de 3 o más y 3 ventas o más |
| Revisar | ROAS menor que 1,5 |
| Mantener | Todo lo demás |

## El Dashboard

### El periodo

Arriba a la derecha: las cápsulas Hoy · 7 días · 30 días · Este mes y **Fechas** (`features/dashboard/period/`), con más atajos (Ayer, Últimos 90 días, Mes pasado, Este año) y un calendario para elegir desde y hasta.
- Va en la dirección: `period=lastMonth` (un atajo, que se mueve con los días) o `from=…&to=…` (fechas a mano). Sin nada, los últimos 30 días. Unas fechas que coinciden con un atajo se guardan como el atajo.
- Hasta 366 días y nunca días futuros, igual que la API (`DashboardPeriod`). El panel avisa con qué periodo se compara (el anterior del mismo largo).
- Con más de 92 días, el gráfico de facturación suma por semana (`sales/chartBuckets`).

### Ventas

1. **La franja oscura**: ROAS real frente al de Meta («por cada $ 1 te vuelven $ 8,30»). Al lado, facturación por anuncios, gasto, ganancia (o la **ganancia real**), costo por venta, costo por chat y cuánto deja cada chat.
2. **El resumen del periodo** (`sales/summary/`): ocho tarjetas, cada una con su cambio frente al periodo anterior. Son Facturación, Ventas, Compra promedio, Ganancia, Leads nuevos, Conversión, ROAS real e Inversión en Meta.
   - `summaryCards.ts` (puro) decide qué dice cada tarjeta.
   - `SummaryIcon.tsx` tiene los íconos, con la convención de línea de Auream.
   - `SalesSummary.tsx` pinta.
   - Compra promedio y ROAS calculan su periodo anterior con lo que ya trae la respuesta (facturación ÷ ventas, ventas por anuncio ÷ gasto).
   - La conversión cambia en **puntos** («▲ 5 pts»).
   - La inversión en Meta va en gris: gastar más o menos no es bueno ni malo por sí solo.
   - Quien no ve el gasto (`ads.read`) no ve ROAS, inversión ni ganancia.
3. Facturación y gasto por día, con la ganancia punteada. La curva es monótona: nunca dibuja picos que no hubo.
4. Del anuncio a la venta (lo vieron → clic → escribieron → compraron), con el costo de cada paso.
5. Qué hacer con tus campañas.
6. Ventas por hora (con la hora pico) y por número, producto y país.
7. Últimas ventas, con el anuncio que las trajo.

### Anuncios

El resumen, la tabla con Campañas · Conjuntos · Anuncios, «¿Por qué Meta dice menos?» (las ventas que Meta no vio y qué parte compra después del primer día de chat) y lo que mejor rinde.

### Atención

- Chats nuevos.
- Chats atendidos por un asesor y en cuánto responden (mediana hasta la primera respuesta).
- Chats que atendió solo el bot y quién espera ahora.
- **Cuándo te escriben**: mapa de calor por día y franja de 2 horas.
- **Cada asesor**: chats, mensajes, tiempo de respuesta y **lo que vende**, que son sus ventas como responsable en el CRM o las que anotó él.
- Cada número de WhatsApp.

## Dinero en una sola moneda

- Todo se muestra en la **moneda de reporte**: la que la persona eligió con el botón de moneda (`currency`) o, si no eligió, la de la cuenta publicitaria con más gasto o la más vendida que se pueda convertir.
- Lo de otras monedas se convierte con la tasa **del día de cada monto** (`fx_rates`, unidades por 1 USD, con su `source` y `fetched_at`).
- **Fuentes oficiales** (`infrastructure/fx/FxSources.ts`). Para cada moneda gana la primera que la traiga:
  - **el bolívar**, la tasa oficial del **BCV** por DolarApi (`ve.dolarapi.com`, fuente «oficial»). No se acepta el paralelo ni una tasa de más de 5 días. La página del BCV tiene un certificado inválido, así que no se lee directo.
  - **las demás**, de open.er-api.com. Su VES coincide con el del BCV y sirve de respaldo.
- **Se actualizan solas** (`SqlFxRates.refresh`), aunque nadie entre:
  - las trae la revisión de cada 15 minutos (Vercel Schedules → `/internal/tasks/run` → `maintenance`) y también el Dashboard al abrirse;
  - hay un intento por hora y por instancia, y se repite mientras falten monedas que el día anterior sí tenía.
- **Si las fuentes fallan** más de un día, queda el aviso `fx.stale` en el registro y se sigue convirtiendo con la última tasa guardada.
- **En pantalla:** el menú de moneda muestra la tasa de cada una («1 USD = 904,45») y de cuándo son (`GET /dashboard/fx`).
- Si falta una tasa, ese monto no se suma y la pantalla lo dice. Nunca se inventa un número.

## Líneas de venta, filtros y moneda

A la derecha de las pestañas hay tres botones (`apps/web/src/features/dashboard/scope/`); cada uno abre su panel encima del Dashboard:

- **● Línea**: «Todo el negocio» o una **línea de venta** (`domains/sales-lines`). Desde ahí se crean y se editan.
- **Filtros**: varios números, productos y campañas de Meta a la vez. Un número dice cuántos están activos.
- **Moneda**: con la bandera y el nombre (🇨🇴 COP · Peso colombiano).

**Qué recorta cada filtro** (`DashboardScope`):

| Filtro | Recorta |
|---|---|
| Números | Ventas, leads y atención |
| Productos | Ventas y conversión |
| Campañas | El gasto, las campañas activas y las ventas «por anuncio» (las orgánicas siguen contando) |

**Cómo se combinan** (`DashboardScopeResolver`):

- Lo elegido a mano gana sobre la línea; lo que no se eligió sale de la línea. La web y el MCP mandan la línea (`line`) y lo elegido.
- `*` en una lista = «todos, a propósito»: le gana a la línea sin recortar nada.
- Ids inválidos o líneas de otra cuenta se ignoran.

**Ejemplo:** la línea «Venezuela» = productos Mega Pack + campaña «Venezuela · USD». El Dashboard muestra solo sus ventas, el gasto de esa campaña, su ROAS y su ganancia, y en bolívares si se elige VES.

**Cómo está armado:**

- Analytics recibe las líneas por un puerto (`SalesLineLookup`) que arma `composeSalesLineServices`. Ningún dominio importa al otro.
- Todo viaja en la dirección de la web: `line`, `numbers`, `products`, `campaigns`, `currency`. Así se puede compartir una vista.

## La ganancia real

El catálogo tiene ahora un **costo por país** junto a cada precio (`product_prices.cost`, opcional).

Ganancia real = ventas − costo de lo vendido − gasto en anuncios − otros gastos.

Solo se muestra si **todas** las ventas del periodo tienen costo. Si falta alguno, la pantalla invita a completarlo.

La tarjeta **Ganancia** del resumen (`profit`) siempre tiene valor para quien ve el gasto:

- Es facturación − inversión en Meta − otros gastos, y además − costo de productos si se conocen todos.
- Va con su periodo anterior.
- Para quien no ve el gasto es `null`: con la facturación a la vista, la resta delataría el gasto.

## Otros gastos

Lo que el negocio paga **fuera de Meta**: herramientas, sueldos, la comisión de la pasarela… (`domains/expenses`, tabla `other_expenses`, `045_other_expenses.sql`). Se restan de la **ganancia**; el **ROAS sigue siendo solo contra Meta**.

**Tipos de gasto:**

| Tipo | Cuándo se cobra |
|---|---|
| Monto fijo, una vez | El día que empieza (si cae en el periodo) |
| Monto fijo, cada día | Cada día vigente |
| Monto fijo, cada semana | Cada 7 días desde que empieza |
| Monto fijo, cada mes | El día del mes en que empieza (el 31 cae el último día de los meses cortos) |
| % de las ventas | Ese % de lo vendido en los días vigentes de lo que se mira |

**Reglas del cálculo** (`OtherExpenseLedger`, puro, en Analytics):

- Nada se cobra después de hoy: un gasto futuro aún no se pagó.
- Cada cobro fijo se convierte con la tasa de **su día**. Una moneda sin tasa no se suma y se avisa (`missingRates`), como las ventas.
- Un gasto es de **todo el negocio** o de **una línea**. Sin línea elegida cuentan todos; con una línea, solo los suyos. Si se borra la línea, el gasto pasa a todo el negocio.
- Los filtros a mano (números, productos, campañas) no recortan los gastos fijos; los % sí, porque van sobre lo vendido en lo que se mira.

**En la respuesta** de `/dashboard/sales`:

- `otherSpend`: total del periodo y del anterior. `null` sin gastos para lo que se mira o sin `ads.read` (con la ganancia se deducirían).
- `otherExpenses`: cuánto costó cada uno en el periodo.
- `profit` y `realProfit` ya los restan.

**En pantalla:**

- La tarjeta de inversión se llama **Inversión** y deja elegir **Meta · Otros · Todo** (sin gastos sigue siendo «Inversión en Meta», como antes).
- Su enlace **Otros gastos** abre la ventana con la lista, cuánto costó cada uno, el total y el formulario con la frase que confirma lo que se va a restar.

**Cómo está armado:** Analytics recibe los gastos por el puerto `OtherExpensesReader`, que arma `composeOtherExpenseServices`. Ningún dominio importa al otro.

## La conversión

**De los leads nuevos del periodo, cuántos compraron en el periodo** (`SqlDashboardSales.leads` → `converted`). Nunca pasa de 100 %.

- Cuenta la venta aprobada del mismo contacto. Una venta anotada a mano no tiene contacto, así que cuenta por su teléfono.
- Antes era ventas ÷ leads. Esa cuenta mezclaba compras de clientes viejos y daba números como 435 %; Leona tiene el mismo error.
- Va con la del periodo anterior (`conversionPrevious`) y cuántos compraron (`convertedLeads`).

## Permisos

| | Dueño | Administrador | Asesor | Solo lectura |
|---|---|---|---|---|
| Dashboard › Ventas y Atención (`analytics.read`) | ✓ | ✓ | ✓, sin nada de anuncios | ✓, sin nada de anuncios |
| Gasto, ROAS, ganancia, otros gastos y Anuncios (`ads.read`) | ✓ | ✓ | — | — |
| Crear, editar y borrar otros gastos (`sales.manage`) | ✓ | ✓ | — | — |
| Conectar Meta, elegir cuentas, sincronizar (`ads.manage`) | ✓ | ✓ | — | — |

## Arquitectura

```
Meta Marketing API ──AdsProvider── MetaMarketingClient (infrastructure/meta)
                                     │
AdConnectionServices · AdsSyncService (domains/ads) ──AdsRepository── SqlAdsRepository
                                     │ cola de tareas: ads.sync
SalesDashboardService · AdsDashboardService · AttentionDashboardService (domains/analytics)
   └─ SalesReader · AdsReader · AttentionReader · FxRates ── SqlDashboard* · SqlFxRates
```

- **Analytics no escribe en nada.** Lee ventas, anuncios y chats por sus puertos.
- **Ads no conoce Ventas.** La venta real se cruza al leer.
- La composición (`apps/api/composition/composeAdsServices.ts`) es el único punto que elige Meta y la base. Sin llave de cifrado, Meta Ads no se ofrece, pero el Dashboard sí funciona.

## Datos

`033_ads_and_costs.sql` (aditiva) crea:
- `meta_connections`
- `ad_accounts`
- `ad_entities`
- `ad_insights_daily`
- `fx_rates`
- `product_prices.cost`

`043_sales_lines.sql` crea `sales_lines`; `044_fx_rates_source.sql` agrega la fuente de cada tasa; `045_other_expenses.sql` crea `other_expenses` (con sus reglas también en la base: % de 0 a 100, un fijo siempre con moneda y frecuencia).

## API

| Ruta | Permiso | Para qué |
|---|---|---|
| `GET /ads/accounts` | `ads.read` | Conexión y cuentas |
| `POST /ads/meta/oauth` · `POST /ads/meta/token` | `ads.manage` | Conectar |
| `PATCH /ads/accounts/:id` · `POST /ads/accounts/:id/sync` · `DELETE /ads/connection` | `ads.manage` | Elegir, sincronizar ya (una vez cada 5 min), desconectar |
| `GET /ads/meta/callback` | — (`state` firmado) | La vuelta del inicio de sesión |
| `GET /dashboard/sales?from&to&line&connectionIds&productIds&campaignIds&currency` | `analytics.read` (el gasto, con `ads.read`) | Ventas |
| `GET /dashboard/ads?from&to&level&line&campaignIds&productIds&connectionIds&currency` | `ads.read` | Anuncios |
| `GET /dashboard/attention?from&to&line&connectionIds` | `analytics.read` | Atención |
| `GET /sales-lines` · `POST /sales-lines` · `PATCH`/`DELETE /sales-lines/:id` | `analytics.read` · `sales.manage` | Líneas de venta |
| `GET /other-expenses` · `POST /other-expenses` · `PATCH`/`DELETE /other-expenses/:id` | `ads.read` · `sales.manage` | Otros gastos |

Las listas van separadas por comas. Se siguen aceptando `connectionId` y `productId` de uno solo.

## Pruebas

**Backend:**
- `tests/unit/metaMarketing.test.ts`
- `adsConnection.test.ts`
- `dashboardServices.test.ts`
- `tests/security/routeAdsDashboard.test.ts`
- `tests/integration/dashboardPersistence.test.ts` (PostgreSQL real)
- Otros gastos: `tests/unit/otherExpenses.test.ts`, `dashboardOtherExpenses.test.ts`, `tests/security/routeOtherExpenses.test.ts`, `tests/integration/otherExpensesPersistence.test.ts`

**Web:**
- `DashboardPage.test.tsx`
- `MetaAdsPage.test.tsx`
- `MetaAdsAccounts.test.tsx`
- Otros gastos: `dashboardSummaryCards.test.ts`, `otherExpenseWords.test.ts`, `DashboardOtherExpenses.test.tsx`

## Después

- Avisos automáticos (campaña gastando sin vender, ROAS que cae).
- Gasto por país.
- Ventana de atribución configurable.
- Pausar o subir presupuesto desde Auream.
- TikTok y Google como otros proveedores del mismo puerto.
