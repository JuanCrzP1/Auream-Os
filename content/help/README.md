# Documentación de Auream

Una sola fuente para tres lectores:

- **Las personas:** el Centro de ayuda (`/help`) muestra estos artículos por módulo.
- **Los agentes de IA:** el servidor MCP los entrega con `read_platform_guide`, `search_help` y `read_help_article`.
- **Los modelos de lenguaje:** se publican en `/llms.txt` y en `/api/help/docs/<slug>.md`.

## Cómo escribir un artículo

Cada archivo es `content/help/<módulo>/<slug>.md` y empieza con sus metadatos:

```
---
title: Conectar tu WhatsApp con el código QR
module: conexiones
summary: Una frase que dice qué resuelve.
order: 1
updated: 2026-11-11
keywords: qr, vincular, número
related: numero-desconectado, varios-numeros
---
```

- `module`: uno de los de `HELP_MODULES` (`contracts/HelpContracts.ts`). `agentes` es solo para agentes.
- `##` divide el artículo en secciones (salen en «En este artículo»).
- `> **Importante:** …` y `> **Consejo:** …` se ven como avisos.
- Pasos con listas numeradas `1.`. Nada de datos inventados.
