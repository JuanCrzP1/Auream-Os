# quick-replies — respuestas rápidas del chat (bounded context)

Mensajes guardados de la cuenta que el equipo pone en un chat sin copiar y pegar. Se **organizan en Configuración › Respuestas rápidas** (dueños y administradores), y en el chat **solo se buscan y se envían**, como en Intercom o Zendesk.

Web:
- `apps/web/src/features/conversations/quick-replies/`: la página de Configuración, el editor con vista previa y los textos compartidos.
- `apps/web/src/features/conversations/components/composer/QuickReplyPicker.tsx`: el selector del chat.
- `apps/web/src/shared/quick-replies/`: la API y el hook.

## Responsabilidad
Guardar, por cuenta, cada respuesta rápida: su **atajo** («saludo», único en la cuenta), su **categoría** opcional («Saludos», «Precios»…; «precios» se une a «Precios» si ya existe) y sus **piezas** en orden (de 1 a 10: textos, fotos, videos, audios o documentos con leyenda), y cuánto se usa cada una.

## Configuración › Respuestas rápidas
- Lista por categoría (alfabética, con «Sin categoría» al final), las más usadas primero. Tiene buscador y filtro por categoría, y cada fila dice cuántas veces se usó.
- Crear, editar, **duplicar** (con un atajo libre: `saludo-copia`) y borrar. El editor muestra la **vista previa en WhatsApp**, con `{nombre}` como «María».
- Los asesores ven la lista sin poder cambiarla.

## Cómo se usa en el chat
- **Buscar:** con ⚡ o escribiendo `/` al empezar el mensaje (`/salu`). Se elige con el mouse o con ↑ ↓ y Enter. Primero salen las que coinciden por atajo y luego por categoría o contenido, agrupadas por categoría. Quien puede organizarlas ve «Administrar →».
- **Un solo texto** va al cuadro de texto y se puede retocar antes de enviar. **Varias piezas o archivos** quedan en espera y salen en orden, antes de lo que se escriba.
- **`{nombre}`** se cambia por el primer nombre del cliente. Si no tiene nombre, se quita junto con el espacio de antes.
- Las más usadas hace poco salen primero (`POST /quick-replies/:id/use`).

## Capas
- `domain/QuickReply.ts`: atajo, categoría y piezas válidos. Es puro: devuelve qué está mal, sin lanzar errores.
- `application/QuickReplyServices.ts`: listar, crear, editar, borrar y marcar uso. Un atajo no se repite. Máximo 500 respuestas por cuenta.
- Infraestructura: `infrastructure/persistence/sql/SqlQuickReplyRepository.ts` (`038_chat_tools.sql`, tabla `quick_replies`; `039_quick_reply_categories.sql`, columna `category`).
- API: `apps/api/routes/routeQuickRepliesRequest.ts`.
  - Verlas: `conversations.read`.
  - Marcar que se usaron: `conversations.write`.
  - Crearlas, editarlas y borrarlas: `conversations.manage` (dueños y administradores). Antes bastaba `conversations.write`.

## No le pertenece
- Enviar al cliente: lo hace la bandeja (`domains/conversations`) con las piezas que arma la web.
- Los archivos: se suben con `/media` y aquí solo se guarda su enlace.
