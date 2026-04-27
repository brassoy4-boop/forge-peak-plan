## Resumen de cambios

Voy a abordar 10 mejoras agrupadas en estas áreas: Foro, Notificaciones, Chat, Ajustes de usuario, Roles, Usuarios, Dashboard, Rutinas, Simulacros y reseteo de contraseña.

---

### 1. Foro: respuestas a mensajes concretos + notificación al autor

- Añadir columna `parent_id` (uuid, nullable, FK lógica a `forum_messages.id`) en `forum_messages` mediante migración.
- En `Foro.tsx`: 
  - Botón "Responder" en cada mensaje que fija el `parent_id` y muestra una cita previa al editor.
  - Renderizar mensajes con un nivel de indentación cuando tienen `parent_id`, mostrando "En respuesta a {autor}: ...preview".
  - Al enviar la respuesta, crear notificación tipo `foro` para el autor del mensaje padre (si no es uno mismo) con link `/app/foro`.
  - También notificar al autor del hilo cuando alguien responde al hilo principal.

### 2. Notificaciones: arreglar "Marcar todas como leídas"

- En `useNotifications.ts`, `markAllRead` y `markRead` actualmente actualizan la BD pero **no recargan ni mutan el estado local** hasta que llega el evento realtime. El bug se debe a que el filtro realtime en `notifications` puede no estar capturando UPDATEs (la tabla puede no estar en `supabase_realtime`).
- Solución: tras el `update`, refrescar localmente el estado (`setItems`) sin depender de realtime, y además incluir `notifications` en la publicación realtime mediante migración (`ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;` con `ALTER TABLE ... REPLICA IDENTITY FULL`).

### 3. Chat: seleccionar cualquier usuario destinatario

- En `Chat.tsx`, actualmente `loadContacts` solo carga personas con `coach_assignment`. Cambiar para que:
  - **Superadmin**: vea todos los perfiles.
  - **Entrenador**: vea sus deportistas asignados + otros entrenadores + superadmin.
  - **Usuario**: vea sus entrenadores asignados + superadmin + cualquier otro usuario que tenga "recibir mensajes" activado (ver punto 4).
- El selector "Nuevo..." se sustituye por un combobox con búsqueda por nombre.

### 4. Ajustes: opción de recibir mensajes de otros usuarios

- Añadir columna `acepta_mensajes_usuarios` (boolean, default true) en `profiles` vía migración.
- En `Perfil.tsx`, añadir un toggle "Recibir mensajes privados de otros usuarios" (no aplica a entrenadores/superadmin, que siempre podrán escribir).
- En `Chat.tsx` al iniciar conversación, validar:
  - Si el remitente es usuario y el destinatario es usuario con `acepta_mensajes_usuarios = false`, bloquear con toast.
  - Filtrar la lista de contactos disponibles aplicando esta regla.

### 5. Un usuario solo puede tener un rol (Configuración)

- En `Admin.tsx`, sustituir la UI de "añadir rol" + badges múltiples por un único selector de rol (igual al de `Usuarios.tsx`):
  - `Select` con valores `usuario | entrenador | superadmin`.
  - Al cambiar: borrar todos los roles previos del usuario e insertar el nuevo (misma lógica que `setRole` en Usuarios).
- Eliminar la posibilidad de añadir múltiples roles.

### 6. Eliminar acción "Asignar como entrenador" en /app/usuarios

- Quitar los botones `UserCheck` / `UserMinus` y la columna "Asignación" de la tabla en `Usuarios.tsx`.
- Eliminar las funciones `assignToCoach`, `unassign`, `isMine` y los tooltips asociados.
- (La asignación de deportistas a entrenadores se gestiona desde otra parte; si es necesario, se puede añadir más adelante).

### 7. "Mi panel" del rol usuario diferenciado

Rediseñar el Dashboard para `primaryRole === "usuario"` con datos relevantes:

- **Tarjetas de KPIs personales**: Sesiones de diario en los últimos 30 días, Simulacros realizados, Mejor marca reciente, Rutinas activas.
- **Gráfica 1 (línea)**: Evolución de RPE / sueño / estrés del diario en últimas 4 semanas (usar `MetricsChart` ya existente).
- **Gráfica 2 (línea)**: Progresión de la marca clave seleccionable (combo con sus marcas registradas).
- **Lista**: Próximos simulacros / última entrada de diario / rutina activa actual (ya existente, mejorarla).
- Mantener panel actual para entrenador/superadmin.

### 8. Rutinas: usuario solo ve sus rutinas asignadas

- Ya existe la lógica `visibleRoutines` que filtra por `assignmentsForUser` para usuarios. Verificar y reforzar:
  - Al pulsar en una rutina como usuario, abrir vista de solo lectura `viewing` (ya existe).
  - Confirmar que `loadAll` no expone otras rutinas en la UI cuando `primaryRole === "usuario"`.
  - Ajustar `loadAll` para no cargar `routines` global cuando el rol es usuario (solo a través de `assignmentsForUser`), reduciendo fugas.

### 9. Superadmin puede eliminar histórico de simulacros (con confirmación)

- En `Simulacros.tsx`, en la lista de ejecuciones (`executions`), añadir botón papelera visible solo si `isSuperadmin` (o el propio usuario).
- Wrap en `AlertDialog` con confirmación.
- Al confirmar: borrar `simulacro_results` con `execution_id` y luego `simulacro_executions`.
- Añadir además botón "Eliminar todo el histórico" (solo superadmin) con doble confirmación, opcionalmente filtrado por usuario.

### 10. Superadmin puede asignar nueva contraseña en "Editar perfil"

- En `Usuarios.tsx`, dentro del diálogo de edición de perfil, añadir sección "Resetear contraseña" (solo visible si `isSuper`):
  - Input nueva contraseña + botón "Actualizar contraseña".
  - Llamar a una nueva edge function `admin-reset-password` que use `service_role` y `admin.updateUserById(target_user_id, { password })`.
  - La edge function valida que el caller es superadmin antes de ejecutar.

---

## Cambios técnicos

**Migraciones SQL:**
1. `ALTER TABLE forum_messages ADD COLUMN parent_id uuid;`
2. `ALTER TABLE profiles ADD COLUMN acepta_mensajes_usuarios boolean NOT NULL DEFAULT true;`
3. `ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;` + `ALTER TABLE notifications REPLICA IDENTITY FULL;`

**Nueva edge function:** `supabase/functions/admin-reset-password/index.ts` (verifica superadmin, recibe `user_id` + `password`).

**Archivos a editar:**
- `src/pages/Foro.tsx` (respuestas anidadas + notificaciones)
- `src/hooks/useNotifications.ts` (refresh local en mark read)
- `src/pages/Chat.tsx` (selector amplio + validación)
- `src/pages/Perfil.tsx` (toggle recibir mensajes)
- `src/pages/Admin.tsx` (rol único)
- `src/pages/Usuarios.tsx` (eliminar asignación coach + reset password)
- `src/pages/Dashboard.tsx` (panel usuario rediseñado)
- `src/pages/Rutinas.tsx` (verificar filtro)
- `src/pages/Simulacros.tsx` (eliminar ejecuciones)

---

## Preguntas (no bloqueantes)

- Para "eliminar histórico de simulacros": ¿quieres botón individual por ejecución, o un botón global "Limpiar histórico de un deportista"? Por defecto haré ambos.
- Para el panel de usuario: ¿quieres una marca destacada concreta o que el usuario elija qué métrica ver? Por defecto haré un selector.
