-- Respuestas rápidas organizadas por categoría (Configuración › Respuestas
-- rápidas): «Saludos», «Precios», «Pagos»… Vacía = «Sin categoría».
-- Aditiva: no toca nada existente.

alter table quick_replies add column if not exists category text null;
alter table quick_replies drop constraint if exists quick_replies_category_check;
alter table quick_replies add constraint quick_replies_category_check check (category is null or char_length(category) between 1 and 40);
