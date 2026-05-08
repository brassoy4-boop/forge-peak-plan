# Mejorar usabilidad móvil de las tablas

## Problema
En `/app/usuarios`, `/app/marcas`, `/app/baremos` y `/app/cooper` las tablas tienen muchas columnas. En móvil (≤768px) producen una barra de scroll horizontal y la lectura es incómoda.

## Estrategia general
Mantener la tabla intacta en desktop (≥md) y, en móvil, renderizar el mismo dataset como una **lista de tarjetas verticales** con la información clave (avatar, nombre, badges, acciones). Patrón Tailwind: `hidden md:block` para la tabla + `md:hidden` para las cards. Sin cambios en la lógica de datos ni en la base de datos.

## Cambios por página

### 1. `src/pages/Usuarios.tsx`
- Tabla actual visible solo en `md+`.
- Vista móvil: card por usuario con
  - Avatar + nombre + email
  - Badge de rol
  - Chips de oposiciones y rutinas activas (apilados)
  - Botón "Editar" a ancho completo
- Buscador y modales se reutilizan tal cual.

### 2. `src/pages/Marcas.tsx`
- Tabla solo en `md+`.
- Vista móvil: card por marca con nombre, badges (categoría, tipo, formato si aplica, unidad, mejor mayor/menor, estado) y acciones (editar, archivar/reactivar) en una fila inferior.
- Filtros (búsqueda, categoría, archivadas) ya son responsive — apilarlos en columna en móvil con `flex-col md:flex-row`.

### 3. `src/pages/Baremos.tsx`
- Formulario de alta: ya usa `grid-cols-1 md:grid-cols-3` / `grid-cols-2 md:grid-cols-4`, está OK.
- Tabla solo en `md+`.
- Vista móvil: card por baremo con
  - Marca (título)
  - Badges: oposición, sexo, nivel (con color)
  - Rango: `Mín – Máx`
  - Botón eliminar

### 4. `src/pages/Cooper.tsx`
- La tabla "tipo Excel" del `TestCard` tiene ~24 columnas: en móvil **no** tiene sentido convertirla a cards (perdería su naturaleza). Mantener scroll horizontal pero:
  - Añadir un aviso pequeño en móvil ("Desliza horizontalmente para ver todos los datos →").
  - Asegurar `overflow-x-auto` con `-mx-4 px-4` para que el scroll sea cómodo a sangre.
- Vista de **usuario** (`CooperUser`) revisarla y, si tiene tabla, aplicar el mismo patrón cards-en-móvil.
- `TabsList` ya tiene `flex-wrap` — OK.

## Detalles técnicos
- Componente helper opcional `MobileListCard` no es necesario; el JSX por página es corto.
- Reutilizar `Card`, `Badge`, `Avatar`, `Button` ya importados.
- Breakpoint: `md` (768px) coincide con `useIsMobile`.
- Sin cambios en BD, edge functions, RLS ni en la lógica de los modales.

## Archivos a modificar
- `src/pages/Usuarios.tsx`
- `src/pages/Marcas.tsx`
- `src/pages/Baremos.tsx`
- `src/pages/Cooper.tsx`

## Verificación
Tras implementar, revisar en preview a 375px que:
- No hay scroll horizontal en Usuarios, Marcas y Baremos.
- Cooper conserva el scroll horizontal con el aviso visible.
- En desktop (≥768px) las tablas se ven exactamente igual que ahora.
