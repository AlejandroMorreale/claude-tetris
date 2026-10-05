---
name: clima
description: Consulta el clima actual y el pronóstico de la ubicación local del usuario (o de una ciudad indicada). Usar cuando pida "el clima", "el tiempo", "qué temperatura hace", "va a llover" o un pronóstico.
---

# Clima local

Obtiene el clima con `curl` contra wttr.in (sin API key). Responder siempre en español.

## Pasos

1. Determinar la ubicación:
   - Si el usuario indicó una ciudad, usarla (reemplazar espacios por `+`).
   - Si no, usar por defecto `Valencia,Spain`.
2. Clima actual (una línea):

   ```bash
   curl -s "https://wttr.in/<CIUDAD>?format=%l:+%c+%t+(sensación+%f),+humedad+%h,+viento+%w,+lluvia+%p&lang=es&m"
   ```

3. Si pide pronóstico, traer 3 días:

   ```bash
   curl -s "https://wttr.in/<CIUDAD>?format=j1&lang=es"
   ```

   Del JSON usar `current_condition` (estado actual) y `weather[]` (`maxtempC`, `mintempC`, `hourly[].chanceofrain`).
4. Resumir en pocas líneas: temperatura, sensación térmica, condición, probabilidad de lluvia y viento. Unidades métricas (°C, km/h).

## Notas

- Es una consulta de red: la ciudad se envía a wttr.in (y la IP, como en cualquier request).
- En PowerShell usar `curl.exe` (no el alias `curl`) o `Invoke-RestMethod`.
- Si la respuesta está vacía o da error, avisar al usuario y no inventar datos.
