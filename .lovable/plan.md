

The user is asking what remains to be implemented given the initial PRD. Let me think about what was in the PRD vs what's been built. I'll review the pages quickly to identify gaps without implementing anything.

Looking at the schema and the work done:
- ✅ Auth + PIN + roles
- ✅ Oposiciones, Marcas (CRUD), Ejercicios (CRUD)
- ✅ Carga Masiva con VAM/VO2max
- ✅ Simulacros (templates + execution)
- ✅ Rutinas (constructor, duplicar, asignar)
- ✅ Diario con campos configurables + comentario entrenador
- ✅ Personalizado versionado
- ✅ Foro con oposición
- ✅ Chat privado realtime
- ✅ Evolución con CSV
- ✅ Dashboard por rol
- ✅ Usuarios (alta, asignación entrenador/oposiciones/rutinas)
- ✅ Admin panel (PIN, entrenadores, roles)
- ✅ Storage bucket "attachments"

Gaps vs PRD:
1. **Adjuntos/multimedia**: el bucket existe pero no hay UI para subir imágenes en ejercicios, oposiciones (imagen_url existe en schema), ni adjuntos en chat/foro/diario
2. **Validaciones de negocio**: validación de sexo en simulacros (templates tienen sexo pero no se valida contra el sexo del usuario al ejecutar), formato de tiempo en marcas tipo tiempo
3. **Errores de carga masiva detallados** (fila/columna/motivo) - la carga masiva actual no es importación de archivos, es un grid manual; falta importación real de Excel/CSV con report de errores
4. **Notificaciones**: no hay sistema de notificaciones (mensajes nuevos, comentarios del entrenador, nuevas asignaciones)
5. **Baremos/referencias por oposición y sexo**: el PRD lo menciona, no está implementado como tal
6. **Drag & drop** en simulacro builder y reordenar ejercicios en rutinas
7. **Perfil de usuario editable** (vista propia para editar datos, foto)
8. **Recuperación de contraseña** desde Auth
9. **Búsqueda/filtros globales** en listados (usuarios, marcas, ejercicios)
10. **Paginación** en tablas largas
11. **Exportación PDF/Excel** de rutinas y entrenamientos personalizados para imprimir
12. **Logs/auditoría** de acciones del entrenador (PRD habla de trazabilidad)

Let me keep the plan focused and practical. I'll group by priority.

