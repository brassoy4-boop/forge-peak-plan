## Plan

### 1. Marcas — subtipos de "tiempo" + validación robusta

**DB (migration):** añadir columna `tiempo_formato` a `marks` (nullable text) con valores: `hh:mm:ss`, `mm:ss`, `segundos`, `segundos_centesimas`. Sin enum (más flexible).

**`src/pages/Marcas.tsx`:**
- En el modal de marca, cuando `value_type === "tiempo"`, mostrar un Select extra "Formato de tiempo" con las 4 opciones. Persistir en `tiempo_formato`.
- Mostrar el formato en la tabla (columna nueva o como sufijo en Tipo).

**`src/lib/validators.ts` (nuevo o extender):** funciones de validación/parsing por `value_type` y `tiempo_formato`:
- `tiempo` → regex según formato (`HH:MM:SS`, `MM:SS`, `SS` entero, `SS.cc`).
- `distancia`, `peso`, `puntuacion` → numérico (decimal permitido).
- `repeticiones` → entero ≥ 0.
- `booleano` → 0/1 o true/false.
- `texto` → libre.
- Devuelve `{ ok, valor_numerico, valor_texto, error }` para guardar correctamente.

**Aplicar validación** en todos los puntos de entrada:
- `src/pages/Simulacros.tsx` (saveRun y saveEditExec): reemplazar el `Number(valor) || null` por el parser unificado; el placeholder pasa a depender de `tiempo_formato`.
- `src/pages/Dashboard.tsx` y `src/pages/Personalizado.tsx` si registran marcas (revisar y aplicar).
- Cooper si introduce valores manualmente.

Errores se muestran con `toast.error` indicando marca y formato esperado.

### 2. Categorías de ejercicios — CRUD en modal

**`src/pages/Ejercicios.tsx`:**
- Reemplazar el modal "Nueva categoría" por un modal "Gestionar categorías" tipo el de Marcas: lista de chips con contador de ejercicios, botones editar/eliminar (AlertDialog de confirmación, bloquea eliminar si hay ejercicios asociados), y formulario inline para añadir/editar.
- Botón en el header pasa de "Categoría" a "Categorías" (abre modal de gestión).

### 3. Marcas — gestión de categorías también en modal (consistencia)

**`src/pages/Marcas.tsx`:**
- Mover la Card "Categorías" actual al mismo modal "Gestionar categorías" (mismo patrón que ejercicios). Botón header "Categoría" → "Categorías".
- La Card visible queda fuera, simplificando la página.

Componente reutilizable opcional: `src/components/CategoryManagerDialog.tsx` parametrizable por tabla (`mark_categories` | `exercise_categories`) y por consulta de "en uso".

### 4. Usuarios — foto de perfil

**Modal "Nuevo deportista":**
- Añadir uploader (`FileUploader` con folder `avatars/<tmp>`). Tras crear el usuario, hacer `update profiles` con `avatar_url`.
- Edge function `create-user` ya recibe campos extra: añadir `avatar_url` al body y al update de profiles.

**Modal "Editar perfil":**
- Añadir bloque Avatar (preview circular + uploader) usando `<Avatar>` y `FileUploader` con folder `avatars/<user_id>`. Persistir en `profiles.avatar_url` (ya existe la columna).

**Listado de usuarios:**
- En la columna "Nombre" mostrar `<Avatar>` (32px) con `AvatarImage src={p.avatar_url}` y `AvatarFallback` con iniciales, junto al nombre.

### 5. Usuarios — limpieza de columnas y mover acciones al modal

**`src/pages/Usuarios.tsx`:**
- Eliminar la columna **Sexo** del listado.
- Quitar de la columna Rol el `Select` inline; dejar solo un Badge.
- Quitar de la columna Acciones el `Select "+ Oposición"` y el botón `+ Rutina`. Dejar solo botón "Editar".
- Mover al **modal Editar perfil** tres nuevas secciones:
  - **Rol** (solo superadmin): Select Usuario/Entrenador/Superadmin → llama a `setRole`.
  - **Oposiciones**: lista de badges actuales con quitar (×) + Select "Añadir oposición".
  - **Rutinas**: lista de rutinas asignadas con toggle activa/inactiva + bloque "Asignar rutina" (rutina + fechas, igual que el modal `routineDialog` actual; se elimina el modal independiente).

### Archivos afectados

- **Migración nueva**: `supabase/migrations/<ts>_marks_tiempo_formato.sql` — `ALTER TABLE marks ADD COLUMN tiempo_formato text;`
- `src/lib/validators.ts` — funciones de validación/parsing por tipo.
- `src/pages/Marcas.tsx` — campo `tiempo_formato`, modal de gestión de categorías.
- `src/pages/Ejercicios.tsx` — modal de gestión de categorías (CRUD completo).
- `src/components/CategoryManagerDialog.tsx` (nuevo, opcional reutilizable).
- `src/pages/Simulacros.tsx` — usar validador unificado y placeholder según `tiempo_formato`.
- `src/pages/Personalizado.tsx`, `src/pages/Dashboard.tsx`, `src/pages/Cooper.tsx` — aplicar validación donde se introduzcan marcas (revisar).
- `src/pages/Usuarios.tsx` — avatar en form crear, avatar en lista, eliminar columna sexo, rol/oposición/rutina movidos al modal editar, eliminar modal aparte de rutina.
- `supabase/functions/create-user/index.ts` — aceptar y guardar `avatar_url`.

### Notas técnicas

- `tiempo_formato` se aplica solo si `value_type === "tiempo"`. Para marcas existentes sin formato, el validador por defecto aceptará `mm:ss[.cc]` (compat).
- Para guardar tiempo en `valor_numerico` se convertirá a segundos (decimal). `valor_texto` queda con el string original opcional para display.
- Bucket `attachments` ya es público → URLs de avatar funcionan directo.
