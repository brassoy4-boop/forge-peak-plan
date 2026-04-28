# Plan: Módulo Test de Cooper

## Resumen funcional

Un nuevo módulo permite a entrenadores/superadmin crear **sesiones de test de Cooper** (jornadas) y registrar dentro de cada una las marcas de múltiples usuarios. La app calcula automáticamente edad, VAM, VO2max, nivel físico, ritmos derivados y valoración de recuperación cardiaca. Cada usuario solo ve sus propios resultados e histórico; los entrenadores y el superadmin gestionan todo.

## Modelo de datos (migración)

Dos tablas nuevas en `public`:

**`cooper_tests`** (la sesión / jornada)
- `id uuid pk`
- `nombre text not null`
- `fecha date not null`
- `temperatura numeric null`
- `condiciones text null`
- `notas text null`
- `created_by uuid not null`
- `created_at`, `updated_at`

**`cooper_results`** (resultado de un usuario en una sesión)
- `id uuid pk`
- `test_id uuid not null` → `cooper_tests.id` (cascade)
- `user_id uuid not null` (referencia al usuario existente)
- Datos manuales: `sexo` (enum sexo_enum), `fecha_nacimiento date`, `cuerpo text`, `peso numeric`, `distancia_m integer not null`, `fc_final integer`, `fc_60s integer`, `tiempo_bajo_100_seg integer`, `observaciones text`
- `created_at`, `updated_at`
- Único `(test_id, user_id)` para evitar duplicados.

Los **valores derivados** (edad, VAM, VO2max, nivel, ritmos, recuperación) NO se almacenan: se calculan en cliente desde un helper único, garantizando que cambios en la fórmula se reflejen siempre.

### RLS

- `cooper_tests`:
  - SELECT: cualquier autenticado (los usuarios necesitan leer la fecha/nombre del test al que pertenecen sus resultados).
  - INSERT/UPDATE/DELETE: `is_coach_or_admin(auth.uid())`.
- `cooper_results`:
  - SELECT: `auth.uid() = user_id OR is_superadmin(auth.uid()) OR (is_coach_or_admin(auth.uid()) AND coach_has_user(auth.uid(), user_id))`.
  - INSERT/UPDATE/DELETE: `is_coach_or_admin(auth.uid())` (los usuarios normales **no** introducen resultados; los registra el entrenador).

Esto cumple la restricción crítica: un usuario normal nunca puede listar marcas ajenas porque la propia política filtra por `user_id`.

## Lógica de cálculo (`src/lib/cooper.ts`)

Helper puro y testeable, fuente única de verdad:

- `calcularEdad(fechaNac, fechaTest)` → años cumplidos a la fecha del test.
- `calcularVAM(distancia)` → `distancia / 200` (km/h).
- `calcularVO2max(distancia, sexo)` → hombre: `d*0.0225 - 11.3`; mujer: `d*0.020 - 7.5`; redondeo 1 decimal.
- `clasificarNivel(vo2max, sexo, edad)` → tabla central con franjas por edad (`<25`, `25-34`, `35-44`, `45+`) y sexo, devuelve `"EXCELENTE" | "MUY BUENO" | "BUENO" | "ACEPTABLE" | "REGULAR" | "BAJO"`.
- `calcularRitmos(vam)` → para R-Umbral (0.85), Billat (1.00) y Zona 1 (0.67) devuelve `{ minPorKm, segPor400 }` con `60/v` y `1440/v`, formateados `mm:ss`.
- `clasificarRecuperacion(segundos)` → `<90 EXCELENTE`, `≤180 NORMAL`, `>180 LENTA`.

Las tablas de umbrales se exportan como constante `NIVELES_VO2` para que sean configurables en un único punto.

## UI

Ruta nueva `/app/cooper` con dos vistas según rol:

### Entrenador / Superadmin — `Cooper.tsx`
- **Listado de tests**: tabla con nombre, fecha, temperatura, nº participantes, acciones (editar / eliminar con `AlertDialog` de confirmación / abrir).
- **Crear/editar test** (Dialog): nombre, fecha, temperatura, condiciones, notas.
- **Detalle del test** (Dialog o vista expandida):
  - Tabla de participantes con columnas calculadas en vivo (edad, VAM, VO2max, nivel, ritmos, recuperación).
  - Botón "Añadir resultado" → selector de usuario (de `profiles` filtrado por `coach_assignments` para entrenador, todos para superadmin) + formulario con los campos manuales. Los valores derivados se previsualizan en el formulario mientras se escribe.
  - Editar/eliminar resultado (con confirmación).
  - **Resumen del test**: cards con media de distancia, VAM, VO2max; máx/mín distancia.

### Usuario normal — misma ruta, vista distinta
- **Mis tests de Cooper**: lista cronológica de sus propios `cooper_results`, cada fila muestra fecha del test, distancia, VAM, VO2max, nivel, ritmos, recuperación.
- **Bloque "Mi evolución"**:
  - KPIs: mejor distancia, mejor VAM, primer vs último test (delta).
  - Gráfica de evolución (reutilizando `MetricsChart`) con distancia y VO2max en el tiempo.
- No ve ningún dato de otros usuarios. Sin selector de usuario. Sin botones de creación.

### Sidebar
Añadir entrada "Test de Cooper" con icono `Timer` o `Activity`:
- En `userItems` como "Mis tests de Cooper".
- En `coachItems` y `adminItems` como "Test de Cooper".

### Routing
Registrar `/app/cooper` en `App.tsx` apuntando a `Cooper.tsx`. La página decide la vista según `primaryRole`.

## Validaciones
- `distancia_m` requerido y > 0.
- `fecha_nacimiento` requerida (necesaria para la edad y por tanto el nivel).
- `sexo` requerido (necesario para VO2max y nivel).
- `fc_final`, `fc_60s` opcionales pero positivos si se introducen.
- `tiempo_bajo_100_seg` opcional; si está vacío no se muestra recuperación.

## Detalles técnicos

- Migración SQL nueva con las dos tablas + RLS.
- Nuevo helper `src/lib/cooper.ts` con todas las fórmulas y constantes de umbrales (testeable, sin dependencias React).
- Nueva página `src/pages/Cooper.tsx` que ramifica por rol.
- Actualización de `src/App.tsx` (ruta) y `src/components/AppSidebar.tsx` (entrada de menú en los tres role-sets).
- No se tocan tablas existentes ni RLS existentes.
- No se requieren edge functions (todo client-side + RLS).
- Reutilización de componentes UI existentes (`Card`, `Dialog`, `AlertDialog`, `Table`, `Select`, `MetricsChart`).

## Archivos afectados

- **Crear**: `supabase/migrations/<timestamp>_cooper.sql`, `src/lib/cooper.ts`, `src/pages/Cooper.tsx`.
- **Editar**: `src/App.tsx`, `src/components/AppSidebar.tsx`.
