## Objetivo

Replicar exactamente el Excel `BASE_PARA_COPIAR_COOPER_CALCULOS.xlsx` dentro del módulo Test de Cooper. Mismas pestañas, mismos campos, mismas fórmulas, pero seleccionando usuarios reales de la plataforma en vez de escribir el nombre.

## Estructura visual (pestañas)

La página `/app/cooper` para entrenador/superadmin tendrá 6 tabs replicando el Excel:

```
[ Test 1 - Inicial ] [ Test 2 - Meso 1 ] [ Test 3 - Meso 2 ] [ Test 4 - Pre-Examen ] [ Comparativa ] [ Referencia ]
```

Cada una de las 4 tabs de test agrupa **todos los `cooper_tests` cuya fase coincida**, ordenados por fecha. Dentro de cada tab se listan las sesiones de esa fase y, al abrir una, se ve la tabla tipo Excel con todos los participantes.

La tab **Comparativa** muestra, por cada usuario que haya hecho al menos un test, una fila con T1/T2/T3/T4 (último de cada fase), su mejor VAM y la evolución T1 → último.

La tab **Referencia** es una vista estática con las dos tablas ACSM (hombres/mujeres) y el bloque de fórmulas, exactamente como la hoja del Excel.

## Cambios de base de datos

Añadir a `cooper_tests` la columna `fase` para etiquetar cada sesión:

```sql
create type cooper_fase as enum ('inicial','mesociclo_1','mesociclo_2','pre_examen');
alter table public.cooper_tests
  add column fase cooper_fase not null default 'inicial';
```

No se añaden tablas nuevas. Las RLS existentes siguen siendo válidas.

## Tabla del test (replica exacta de las columnas del Excel)

Columnas mostradas, en este orden:

```
Nº | NOMBRE | SEXO | F.NACIMIENTO | EDAD | CUERPO | PESO(kg) | DISTANCIA(m) |
VAM(km/h) | VO2max | VO2max ajust. sexo | NIVEL(edad+sexo) |
R-Umbral min/km | R-Umbral seg/400 | Billat min/km | Billat seg/400 |
Zona1 min/km | Zona1 seg/400 | FC Meta | FC 60s | t<100 lpm (s) | HRR | Observaciones
```

- **NOMBRE**: select de usuario (combobox con búsqueda) entre los atletas que ve el coach (sus asignados) o todos (superadmin). No hay campo de texto libre.
- **SEXO, F.NACIMIENTO, CUERPO, PESO**: se prerrellenan al seleccionar el usuario:
  - `sexo` y `fecha_nacimiento` ← `profiles`
  - `peso` ← `profiles.peso`
  - `cuerpo` ← nombre de la primera oposición asignada en `user_oposiciones` → `oposiciones.nombre`. Si no tiene oposición, queda vacío.
  - **Todos editables in-line** y se guardan en la fila de `cooper_results` (los campos ya existen en la tabla). El perfil no se modifica.
- **EDAD, VAM, VO2max, NIVEL, ritmos, HRR**: calculados en cliente con `src/lib/cooper.ts` (no se almacenan).
- **DISTANCIA, FC Meta, FC 60s, t<100, Observaciones**: input directo.

Edición tipo hoja: cada celda editable es un input que guarda en `onBlur` (debounce). Botón "+ Añadir participante" añade fila vacía con selector de usuario al inicio. Botón papelera por fila con confirmación.

## Fórmulas (replica literal del Excel)

Ya están en `src/lib/cooper.ts`, coinciden 1:1 con las del Excel:

| Cálculo | Fórmula |
|---|---|
| Edad | `DATEDIF(fNac, fechaTest, "Y")` |
| VAM | `distancia / 200` (2 decimales) |
| VO2max H | `distancia × 0.0225 − 11.3` (1 decimal) |
| VO2max M | `distancia × 0.0200 − 7.5` (1 decimal) |
| R-Umbral min/km | `60 / (VAM × 0.85)` formato `m:ss` |
| R-Umbral seg/400 | `1440 / (VAM × 0.85)` redondeado + "s" |
| Billat min/km | `60 / VAM` formato `m:ss` |
| Billat seg/400 | `1440 / VAM` redondeado + "s" |
| Zona 1 min/km | `60 / (VAM × 0.67)` formato `m:ss` |
| Zona 1 seg/400 | `1440 / (VAM × 0.67)` redondeado + "s" |
| HRR | `<90` ⚡ EXCELENTE · `≤180` ✓ NORMAL · `>180` ⚠ LENTA |
| NIVEL | tabla ACSM por edad y sexo (ya implementada en `NIVELES_VO2`) |

Ajustes a `src/lib/cooper.ts` para fidelidad:
- Cambiar formato min/km de `m:ss` actual a string `m:ss` sin "h:" (ya está bien) y verificar redondeo.
- Añadir emojis al HRR (⚡ / ✓ / ⚠) como en el Excel.

## Tab Comparativa

Para cada usuario con resultados:

```
Nº | Nombre | Sexo | Edad | Cuerpo | T1 Dist | T1 VAM | T2 Dist | T2 VAM | T3 Dist | T3 VAM | T4 Dist | T4 VAM | Mejor VAM | Evolución T1→último
```

- Para cada fase se toma el **último** `cooper_result` del usuario en un test de esa fase.
- "Mejor VAM" = max VAM de todos sus resultados.
- "Evolución" = `(últimoVAM − T1VAM) / T1VAM × 100` con flecha ↑/↓.
- Filas con celdas vacías (`—`) si el usuario no tiene resultado en esa fase.

## Tab Referencia

Componente estático con las dos tablas ACSM y el bloque de fórmulas tal como aparecen en la hoja REFERENCIA del Excel. Es texto/markup, sin interacción.

## Vista del usuario (rol `usuario`)

Sin cambios de estructura. Sigue viendo "Mis tests de Cooper" con sus filas, KPIs y gráfica de evolución (lo que ya existe). RLS garantiza que solo ve los suyos.

## Selector de fase al crear test

Al crear/editar un test, además de nombre/fecha/temp/condiciones, se elige la **fase** (Inicial / Meso 1 / Meso 2 / Pre-Examen). Esto determina en qué tab aparece.

## Archivos afectados

- **Migración nueva**: añadir enum `cooper_fase` y columna `fase` a `cooper_tests`.
- **Editar `src/lib/cooper.ts`**: añadir emojis al HRR, asegurar formato `m:ss` exacto.
- **Reescribir `src/pages/Cooper.tsx`**: estructura con 6 tabs (Test 1/2/3/4/Comparativa/Referencia), tabla editable inline con prerrelleno desde perfil + oposición, vista comparativa y vista referencia. Vista de usuario se mantiene tal cual.
- **No se tocan**: RLS, `App.tsx`, `AppSidebar.tsx`.

## Detalles técnicos

- Para prerrellenar al seleccionar usuario: una sola query `profiles + user_oposiciones(oposiciones(nombre))` cacheada al cargar la página.
- La tabla usa los componentes existentes `Table`, `Input`, `Select`, `Combobox` (basado en `Command` + `Popover`).
- Guardado por celda con debounce 600 ms para evitar guardado en cada tecla.
- Cálculos puros en cliente, recalculados en cada render con `useMemo` por fila.
