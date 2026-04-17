
# Corpore10 — Plataforma de gestión de gimnasio y preparación física

Plataforma web completa (vertical slice) para Corpore10, con tres roles (usuario/deportista, entrenador, superadmin) y todos los módulos del PRD en versión funcional mínima. Idioma: **español**. Branding: **rojo #e70505 / negro #333**, estética gym fuerte y motivadora.

## 🎨 Identidad visual

- **Colores**: Rojo Corpore10 `#e70505` (primario/accentos), Negro `#333` (texto/superficies oscuras), blanco y grises neutros para contraste.
- **Tipografía**: Sans bold para titulares (estilo deportivo), Inter para cuerpo.
- **Logo/marca**: header con "CORPORE10" en mayúsculas + acento rojo.
- **Componentes**: shadcn/ui adaptado al tema, cards con bordes definidos, badges de estado, tablas densas para entrenador, vistas limpias y grandes para deportista.
- Modo claro por defecto, mobile-friendly.

## 🔐 Autenticación

- **Email + contraseña + PIN**. PIN único global (default `942`) requerido en el login después de email/contraseña.
- Sin signup público. Solo el **superadmin** crea entrenadores; **entrenadores y superadmin** crean usuarios.
- El superadmin puede editar el PIN global desde su panel.
- Roles en tabla `user_roles` separada (`usuario`, `entrenador`, `superadmin`) con función `has_role` y RLS.

## 🗃️ Modelo de datos (Lovable Cloud)

Tablas principales:
- `profiles` (datos personales/deportivos) + `user_roles`
- `coach_assignments` (entrenador↔usuario), `app_settings` (PIN global, etc.)
- `oposiciones`, `user_oposiciones`
- `mark_categories`, `marks` (tipo de valor, unidad, mejor mayor/menor, archivada)
- `simulacro_templates`, `simulacro_template_marks`, `simulacro_executions`, `simulacro_results`
- `mark_records` (histórico unificado, con `origin`)
- `exercise_categories`, `exercises` (con imagen)
- `routines`, `routine_days`, `routine_exercises`, `routine_assignments`
- `session_types`, `diary_field_configs`, `diary_entries`, `diary_entry_values`
- `personalized_trainings`, `personalized_training_versions` (bloques JSON configurables)
- `forum_threads`, `forum_messages`
- `private_conversations`, `private_messages`
- `bulk_imports` (registro de cargas)
- `attachments` (Storage para imágenes/documentos)

Toda la privacidad por **RLS**: usuarios solo ven sus datos; entrenadores ven solo sus asignados; superadmin ve todo. Archivado en lugar de borrado para preservar histórico.

## 🧩 Módulos y vistas

### Layout común
- Sidebar con navegación adaptada al rol.
- Header con marca, usuario actual, notificaciones, logout.
- Breadcrumbs en vistas profundas.

### Panel del **deportista**
1. **Mi panel** — resumen: próximos entrenamientos, última marca, mensajes nuevos, rutinas activas.
2. **Mis oposiciones** — tarjetas con imagen y estado.
3. **Mis simulacros** — listado + ficha de resultados + histórico.
4. **Mis rutinas** — vista por día, ejercicios con imagen, series/reps/descanso.
5. **Mi diario** — formulario con campos configurables (sueño, RPE, molestias, completado, marca clave, observaciones) + historial.
6. **Mis entrenamientos personalizados** — fichas (versiones) en bloques.
7. **Mi evolución** — gráficas por marca, mejor/última marca, tendencia, comparativa por simulacro.
8. **Foro** — hilos generales.
9. **Chat privado** — con sus entrenadores.

### Panel del **entrenador**
1. **Dashboard** — usuarios asignados, alertas (molestias, no completados), actividad reciente.
2. **Usuarios** — CRUD, asignación de oposiciones, rutinas, simulacros; acceso a su diario y evolución.
3. **Oposiciones** — gestión + simulacros asociados (variantes por sexo).
4. **Catálogo de marcas** — categorías + marcas configurables (tipo valor, unidad, mejor mayor/menor, ranking).
5. **Simulacros** — plantillas por oposición/sexo, registro individual de resultados.
6. **Ejercicios** — categorías + ejercicios con imagen, archivado.
7. **Rutinas** — constructor 1–7 días, duplicar, asignar a uno o varios.
8. **Diario** — config de tipos de sesión y campos; revisión de entradas y comentarios.
9. **Entrenamientos personalizados** — editor por bloques, versionado.
10. **Carga masiva tipo Excel** — grid editable por grupo/test, columnas según marcas seleccionadas, cálculo automático de métricas derivadas (VAM, VO2max, ritmos, recuperación cardíaca), comparativa entre tests, vista de referencia. Cada usuario solo verá sus filas.
11. **Foro y chat** — moderación + conversaciones.
12. **Analítica** — evolución individual y grupal con filtros.

### Panel del **superadmin**
- Todo lo anterior + gestión de **roles/permisos**, entrenadores, **catálogos globales**, **PIN global**, plantillas maestras, métricas globales.

## 📊 Cálculos automáticos (carga masiva)

Implementados en cliente al editar/guardar el grid:
- VAM, VO2max, nivel automático, ritmos automáticos, recuperación cardíaca, mejor VAM, comparativa entre tests, estado de evolución.

## ✅ Reglas de negocio aplicadas

- 1 usuario solo ve sus datos (RLS).
- Marcas/ejercicios con histórico → archivado, no borrado.
- Simulacros validan sexo si la plantilla es específica.
- Rutinas 1–7 días con aviso al reducir.
- Trazabilidad: `created_by`, `updated_by`, `created_at` en registros críticos.
- Versionado en entrenamientos personalizados.

## 🚀 Plan de entrega (esta iteración)

Construiremos la **versión vertical** completa: esquema de BD + RLS, autenticación con PIN, los tres paneles con todos los módulos descritos en su forma mínima funcional, branding Corpore10, y datos seed (oposiciones de ejemplo: Policía Nacional, Guardia Civil, Bomberos, Policía Local; categorías y marcas tipo 100m, 1000m, dominadas, salto longitud; categorías de ejercicio).

Tras esta entrega, iteramos profundizando los módulos que más uses (probablemente carga masiva y simulacros).
