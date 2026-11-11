# quick-replies — respuestas rápidas del chat (bounded context)

Mensajes guardados de la cuenta que el equipo pone en un chat sin copiar y pegar, como en Leona. Web: `apps/web/src/features/conversations/components/composer/` (selector y editor) y `apps/web/src/shared/quick-replies/`.

## Responsabilidad
Guardar, por cuenta, cada respuesta rápida: su **atajo** («saludo», único en la cuenta) y sus **piezas** en orden (de 1 a 10: textos, fotos, videos, audios o documentos con leyenda), y cuánto se usa cada una.

## Cómo se usa en el chat
- **Buscar:** con ⚡ o escribiendo `/` al empezar el mensaje (`/salu`). Se elige con el mouse o con ↑ ↓ y Enter. Primero salen las que coinciden por atajo y luego por contenido.
- **Un solo texto** va al cuadro de texto y se puede retocar antes de enviar. **Varias piezas o archivos** quedan en espera y salen en orden, antes de lo que se escriba.
- **`{nombre}`** se cambia por el primer nombre del cliente. Si no tiene nombre, se quita junto con el espacio de antes.
- Las más usadas hace poco salen primero (`POST /quick-replies/:id/use`).

## Capas
- `domain/QuickReply.ts`: atajo y piezas válidos. Es puro: devuelve qué está mal, sin lanzar errores.
- `application/QuickReplyServices.ts`: listar, crear, editar, borrar y marcar uso. Un atajo no se repite. Máximo 500 respuestas por cuenta.
- Infraestructura: `infrastructure/persistence/sql/SqlQuickReplyRepository.ts` (`038_chat_tools.sql`, tabla `quick_replies`).
- API: `apps/api/routes/routeQuickRepliesRequest.ts`. Para verlas y usarlas hace falta `conversations.read`; para crearlas, editarlas y borrarlas, `conversations.write`.

## No le pertenece
- Enviar al cliente: lo hace la bandeja (`domains/conversations`) con las piezas que arma la web.
- Los archivos: se suben con `/media` y aquí solo se guarda su enlace.
