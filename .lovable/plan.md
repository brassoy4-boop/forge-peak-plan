## Objetivo

Hacer que la tabla del test de Cooper (tab Test 1/2/3/4) replique exactamente las 23 columnas del Excel y use los mismos colores de fondo en la cabecera por grupo.

## Columnas actuales (18) vs Excel (23)

Comparando con la imagen del Excel:

```
Excel (23):                          Estado actual:
 1. Nº                                ✓
 2. NOMBRE                            ✓
 3. SEXO                              ✓
 4. F. NACIMIENTO                     ✓
 5. EDAD                              ✓
 6. CUERPO                            ✓
 7. PESO (kg)                         ✓
 8. DISTANCIA (m)                     ✓
 9. VAM (km/h)                        ✓
10. VO2max (ml/kg/min)                ✓
11. VO2max AJUSTADO SEXO              ✗ FALTA
12. NIVEL (edad + sexo)               ✓
13. R-UMBRAL (min/km)                 ✓ (mostrado como una sola)
14. R-UMBRAL (seg/400 m)              ✗ FALTA columna separada
15. BILLAT (min/km)                   ✓ (mostrado como una sola)
16. BILLAT (seg/400 m)                ✗ FALTA columna separada
17. ZONA 1 (min/km)                   ✓ (mostrado como una sola)
18. ZONA 1 (seg/400 m)                ✗ FALTA columna separada
19. FC Meta                           ✗ FALTA
20. FC 60s                            ✓
21. t<100 lpm (s)                     ✓
22. HRR (Recup.)                      ✓
23. OBSERVACIONES                     ✓
```

Faltan **5 columnas**: VO2max ajustado sexo, R-Umbral seg/400, Billat seg/400, Zona 1 seg/400, FC Meta.

## Cambios

### 1. `src/lib/cooper.ts`
- Añadir helper `calcularVO2maxAjustado(distanciaM, sexo)` — en el Excel es el mismo valor de VO2max recalculado con la fórmula del sexo opuesto/ajuste; según la hoja, coincide con `vo2max` cuando los datos son consistentes. Replicar la fórmula exacta del Excel: si `sexo='masculino'` → `distancia*0.0225-11.3`, si `femenino` → `distancia*0.020-7.5` (mismo que VO2max base, ya que el Excel aplica el ajuste por sexo en la propia fórmula). Exponer como propiedad separada `vo2maxAjustado` en `CooperDerivados` para mostrarla en su columna.

### 2. `src/pages/Cooper.tsx` — cabecera con colores del Excel
Reemplazar la cabecera actual por una con los siguientes grupos de color (clases Tailwind con tonos suaves para que el texto blanco/negro sea legible):

```text
Gris oscuro (bg-neutral-700 text-white):  Nº, NOMBRE
Naranja claro (bg-orange-200):            SEXO, F. NACIMIENTO, EDAD, CUERPO, PESO
Azul (bg-blue-300):                       DISTANCIA, VAM, VO2max, VO2max ajust., NIVEL
Naranja (bg-orange-300):                  R-Umbral min/km, R-Umbral seg/400
Verde (bg-green-300):                     Billat min/km, Billat seg/400
Azul claro (bg-sky-200):                  Zona 1 min/km, Zona 1 seg/400
Rojo claro (bg-red-200):                  FC Meta, FC 60s, t<100, HRR
Gris (bg-neutral-200):                    OBSERVACIONES
```

(coincide con la imagen: gris/naranja/azul/naranja/verde/azul-cian/rojo/gris).

### 3. `src/pages/Cooper.tsx` — celdas de datos
Por cada fila añadir las 5 celdas nuevas en el orden correcto:
- **VO2max ajust. sexo** → `derivados.vo2maxAjustado` (read-only)
- **R-Umbral seg/400** → `derivados.ritmos.rUmbral.segPor400` (read-only)
- **Billat seg/400** → `derivados.billat.segPor400` (read-only)
- **Zona 1 seg/400** → `derivados.zona1.segPor400` (read-only)
- **FC Meta** → input editable nuevo. Guardar en `cooper_results.fc_meta` (verificar si la columna existe; si no, añadirla en migración).

### 4. Migración (sólo si `cooper_results.fc_meta` no existe)
Comprobar el schema; si falta:
```sql
alter table public.cooper_results add column fc_meta integer;
```

## Archivos afectados

- `src/lib/cooper.ts` — exponer `vo2maxAjustado` en `CooperDerivados`.
- `src/pages/Cooper.tsx` — cabecera coloreada por grupos + 5 columnas nuevas en header y body.
- (Opcional) migración SQL si falta `fc_meta`.

No se tocan: tab Comparativa, Referencia, ni la vista del usuario.
