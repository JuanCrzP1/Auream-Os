---
title: Usar inteligencia artificial en un flujo
module: automatizaciones
summary: La Extensión IA responde o entiende mensajes con tu propia clave de IA.
order: 7
updated: 2026-11-14
keywords: ia, inteligencia artificial, openai, gemini, extensión ia, audio, nota de voz, imagen, foto, pdf
related: herramientas-del-editor
---

## Antes de empezar

Conecta tu clave de IA en **Integraciones** (OpenAI, Gemini u OpenRouter). Se guarda cifrada.

## Qué puede hacer

- Responder preguntas con las instrucciones que le des.
- Entender qué quiere el cliente y guardar el resultado para un Condicional.
- Oír notas de voz, ver fotos y leer PDF (ver abajo).

## Notas de voz, fotos y PDF

En **Entender archivos** activa lo que quieras que entienda:

- **Audios**: oye la nota de voz del cliente. Si te pide «una canción para mi mamá que se llama Rosa» por audio, la IA lo entiende igual que si lo escribiera.
- **Imágenes**: ve la foto o la captura que mandó (el modelo que elijas debe aceptar imágenes).
- **PDF**: lee el texto del documento.

### Cómo funciona

1. Usa el archivo que el cliente **acaba de mandar**.
2. Si el mensaje para la IA es solo una variable con un archivo guardado (por ejemplo `{respuesta}`, la que guardó **Esperar respuesta**), usa ese.
3. Si el cliente manda un audio y **Audios** está apagado, el bloque sale por **Error** y te dice qué casilla activar.

Con OpenAI la nota de voz se pasa a texto antes de responder; con Gemini y OpenRouter el modelo la oye directo. Todo se cobra en tu propia cuenta de IA.

> **Consejo:** dale instrucciones cortas y claras, y pruébalo en el laboratorio con preguntas reales de tus clientes.
