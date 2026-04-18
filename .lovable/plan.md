

El usuario pide tres cambios concretos. Reviso rápido el estado actual antes de planificar.

Cambios solicitados:
1. **PWA** — el contexto avisa que es delicado en preview. Recomendaré la versión "instalable simple" (manifest + icons + display standalone) sin service worker, que es lo que de verdad necesita el equipo de Corpore10 para "instalar en pantalla de inicio". Sin SW evitamos romper el preview.
2. **PIN solo en registro** — actualmente el PIN se pide tras login (PIN_STORAGE_KEY en sessionStorage, ProtectedRoute lo verifica). Hay que: quitar verificación de PIN en ProtectedRoute, quitar la pantalla/paso de PIN tras login, añadir campo PIN al formulario de signup en Auth.tsx, validar contra `app_settings.access_pin` antes de llamar a signUp.
3. **Quitar adjuntos del checklist pendiente** — son tareas que no quiere; solo afecta al checklist interno, no hay código de adjuntos en chat/foro/diario que retirar (nunca se implementó).

También retiro del checklist pendiente lo que ya no aplica y dejo el plan de cierre actualizado.

# Plan de implementación

## 1. PWA instalable (sin service worker)

Para evitar problemas en el preview de Lovable, NO añadiré `vite-plugin-pwa` ni service worker. Implementaré PWA "instalable simple":

- Crear `public/manifest.webmanifest` con nombre Corpore10, `display: "standalone"`, `theme_color`, `background_color` y referencias a icons.
- Crear iconos `public/icon-192.png` y `public/icon-512.png` (los genero a partir del logo/Brand existente; si no hay, uso uno generado con el primary color).
- Añadir en `index.html`:
  - `<link rel="manifest" href="/manifest.webmanifest">`
  - `<meta name="theme-color" content="...">`
  - `<link rel="apple-touch-icon" href="/icon-192.png">`
  - `<meta name="apple-mobile-web-app-capable" content="yes">`
  - `<meta name="apple-mobile-web-app-status-bar-style" content="default">`
- Actualizar `<title>` y meta description con la marca real.

Resultado: usuarios podrán "Añadir a pantalla de inicio" desde Chrome/Safari móvil y la app se abrirá en modo standalone. Sin offline, sin caché → el preview de Lovable sigue funcionando.

## 2. PIN movido al registro

**ProtectedRoute.tsx**: eliminar la comprobación `pinOk` y el redirect cuando no está. Solo valida sesión y rol.

**Auth.tsx** (formulario de Sign Up):
- Añadir campo `pin` (input 4 dígitos) visible solo en modo "Registro".
- Antes de `supabase.auth.signUp`, leer `app_settings.access_pin` y comparar con el PIN introducido. Si no coincide → toast de error y abortar.
- Si coincide → continuar con el signup normal.

**Login**: el PIN ya no se pide. Quitar cualquier referencia a `PIN_STORAGE_KEY` en el flujo post-login.

**auth.tsx (lib)**: dejar exportado `PIN_STORAGE_KEY` solo si se usa en otros sitios (lo retiro si solo lo usaba ProtectedRoute).

**Admin.tsx**: la gestión del PIN sigue igual (superadmin lo puede cambiar). Solo cambia el momento en que se exige.

## 3. Checklist actualizado (sin adjuntos)

Retiro de pendientes:
- Adjuntos en Chat, Foro, Diario.

Pendientes reales que quedan tras esta entrega:
- Notificación al recibir nueva asignación de rutina.
- Búsqueda + paginación en Usuarios.
- Auditoría (`audit_log`).
- Verificación de email obligatoria.

## Archivos que tocaré

- `index.html` — meta tags PWA, título, manifest link
- `public/manifest.webmanifest` (nuevo)
- `public/icon-192.png`, `public/icon-512.png` (nuevos, generados)
- `src/components/ProtectedRoute.tsx` — quitar chequeo PIN
- `src/pages/Auth.tsx` — añadir PIN al formulario de registro y validarlo
- `src/lib/auth.tsx` — limpiar `PIN_STORAGE_KEY` si queda huérfano

Sin migraciones de BD. Sin nuevas dependencias.

