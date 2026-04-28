## Problema

En `src/pages/Ejercicios.tsx` (línea 156-158), las tarjetas de ejercicio usan un contenedor `aspect-video` (16:9) con `object-cover`, lo que recorta las imágenes verticales.

## Solución

Cambiar el contenedor a una altura fija y la imagen a `object-contain` para que tanto horizontales como verticales se vean completas, centradas y sin recortes.

```tsx
<div className="h-56 bg-muted flex items-center justify-center overflow-hidden">
  {ex.imagen_url
    ? <img src={ex.imagen_url} alt={ex.nombre} className="max-w-full max-h-full object-contain" />
    : <ImageIcon className="h-10 w-10 text-muted-foreground" />}
</div>
```

- `h-56` → altura fija uniforme para todas las cards.
- `object-contain` → la imagen se escala para caber completa.
- `flex items-center justify-center` → centra horizontalmente la imagen vertical.
- `overflow-hidden` → evita que sobresalga.

## Archivos afectados

- `src/pages/Ejercicios.tsx` — solo el bloque del thumbnail dentro del map.
