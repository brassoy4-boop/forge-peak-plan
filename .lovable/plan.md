

The user wants to import ~1796 exercises from a MySQL dump, mapping area_id to exercise_categories, and downloading images from a remote server pattern.

Let me check current state and plan the import.

Key tasks:
1. Parse `areas.sql` → upsert into `exercise_categories` (preserving area_id mapping)
2. Parse `exercises.sql` → for each exercise:
   - Map `area_id` → `category_id`
   - Build image URL from `image` field: `exercises\\February2023\\256.jpg` → `https://app.corpore10trainer.com/storage/app/public/exercises/February2023/256.jpg`
   - Download image, upload to `attachments` bucket under `exercises/`
   - Insert exercise with `nombre`, `category_id`, `imagen_url`
3. The current `exercise_categories` table has only `nombre`, `orden`, `status` — no slot for legacy area_id. I'll use a temp map (area_id → new uuid) built in the script during the same run.

Considerations:
- 1796 exercises × image download = heavy. Run as a one-off Node script in /tmp using exec, in batches with concurrency limit (e.g., 8 parallel).
- Some images may 404 → skip image, still create exercise.
- Avoid duplicates: check existing exercise by `nombre` first (or wipe relevant ones — better to skip dupes).
- Use SUPABASE_SERVICE_ROLE_KEY for direct insertion + storage upload from script (already available as secret in sandbox env).
- Categories: areas.sql has 20 areas. Insert all with the legacy area_id in a local map. We won't store area_id in DB — just need the runtime mapping. Set `orden = area_id` to keep order.
- Image storage path: `exercises/<filename>` in `attachments` bucket, public URL stored in `imagen_url`.

Plan presentation:

# Plan: importar ~1.796 ejercicios desde el SQL legado

## Qué voy a hacer

1. **Categorías (`areas.sql` → `exercise_categories`)**
   - Parsear las 20 áreas del fichero.
   - Insertarlas en `exercise_categories` (si ya existen por nombre, reutilizarlas).
   - Construir en memoria un mapa `legacy_area_id → category_uuid` para usarlo después.

2. **Ejercicios (`exercises.sql` → `exercises` + bucket `attachments`)**
   Script Node ejecutado en sandbox con `SUPABASE_SERVICE_ROLE_KEY`:
   - Parsear las 1.796 filas (nombre, area_id, image).
   - Para cada una:
     1. Si la `image` es del tipo `exercises\\February2023\\256.jpg` → construir URL pública: `https://app.corpore10trainer.com/storage/app/public/exercises/February2023/256.jpg`.
     2. Descargar la imagen.
     3. Subirla a `attachments/exercises/<nombre-fichero>` (bucket público).
     4. Obtener la `public URL`.
     5. Insertar en `exercises` con `nombre`, `category_id` (mapeado), `imagen_url`.
   - Si una imagen no existe (404) → se crea el ejercicio sin imagen y se loguea.
   - Si el ejercicio ya existe (mismo nombre exacto) → se omite, no se duplica.
   - Concurrencia: 8 descargas/uploads en paralelo para ir rápido sin saturar.

3. **Reporte final**
   - Total importados, omitidos por duplicado, fallos de imagen, fallos críticos.
   - Lo dejaré por consola para que lo veas tras la ejecución.

## Lo que NO hago

- No toco esquema de base de datos (no añado columna `legacy_id` — el mapeo solo vive durante la ejecución del script). Si en el futuro necesitas reimportar y reconciliar, lo reconsideramos.
- No borro ejercicios existentes. Solo añado y omito duplicados por nombre.
- No importo los campos `dificulty`, `machine_id`, `video_url`, `video_file`, `original_url` (quedan fuera del modelo actual). Si los quieres, dímelo y los añadimos al esquema.

## Archivos que tocaré

- Script temporal en `/tmp/import-exercises.mjs` (no se queda en el repo).
- Sin cambios en código de la app.
- Sin migraciones.

¿Apruebas y lanzo la importación?

