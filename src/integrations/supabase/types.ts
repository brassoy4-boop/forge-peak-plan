export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      bulk_imports: {
        Row: {
          coach_id: string
          created_at: string
          data: Json
          id: string
          nombre: string
          test_label: string | null
          updated_at: string
        }
        Insert: {
          coach_id: string
          created_at?: string
          data?: Json
          id?: string
          nombre: string
          test_label?: string | null
          updated_at?: string
        }
        Update: {
          coach_id?: string
          created_at?: string
          data?: Json
          id?: string
          nombre?: string
          test_label?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      coach_assignments: {
        Row: {
          coach_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          coach_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          coach_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      cooper_results: {
        Row: {
          created_at: string
          cuerpo: string | null
          distancia_m: number
          fc_60s: number | null
          fc_final: number | null
          fc_meta: number | null
          fecha_nacimiento: string | null
          id: string
          observaciones: string | null
          peso: number | null
          sexo: Database["public"]["Enums"]["sexo_enum"]
          test_id: string
          tiempo_bajo_100_seg: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          cuerpo?: string | null
          distancia_m: number
          fc_60s?: number | null
          fc_final?: number | null
          fc_meta?: number | null
          fecha_nacimiento?: string | null
          id?: string
          observaciones?: string | null
          peso?: number | null
          sexo?: Database["public"]["Enums"]["sexo_enum"]
          test_id: string
          tiempo_bajo_100_seg?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          cuerpo?: string | null
          distancia_m?: number
          fc_60s?: number | null
          fc_final?: number | null
          fc_meta?: number | null
          fecha_nacimiento?: string | null
          id?: string
          observaciones?: string | null
          peso?: number | null
          sexo?: Database["public"]["Enums"]["sexo_enum"]
          test_id?: string
          tiempo_bajo_100_seg?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cooper_results_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "cooper_tests"
            referencedColumns: ["id"]
          },
        ]
      }
      cooper_tests: {
        Row: {
          condiciones: string | null
          created_at: string
          created_by: string
          fase: Database["public"]["Enums"]["cooper_fase"]
          fecha: string
          id: string
          nombre: string
          notas: string | null
          temperatura: number | null
          updated_at: string
        }
        Insert: {
          condiciones?: string | null
          created_at?: string
          created_by: string
          fase?: Database["public"]["Enums"]["cooper_fase"]
          fecha?: string
          id?: string
          nombre: string
          notas?: string | null
          temperatura?: number | null
          updated_at?: string
        }
        Update: {
          condiciones?: string | null
          created_at?: string
          created_by?: string
          fase?: Database["public"]["Enums"]["cooper_fase"]
          fecha?: string
          id?: string
          nombre?: string
          notas?: string | null
          temperatura?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      diary_entries: {
        Row: {
          comentario_entrenador: string | null
          completado: string | null
          created_at: string
          descripcion: string | null
          fecha: string
          id: string
          marca_clave: string | null
          molestias: string | null
          observaciones: string | null
          session_type_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          comentario_entrenador?: string | null
          completado?: string | null
          created_at?: string
          descripcion?: string | null
          fecha?: string
          id?: string
          marca_clave?: string | null
          molestias?: string | null
          observaciones?: string | null
          session_type_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          comentario_entrenador?: string | null
          completado?: string | null
          created_at?: string
          descripcion?: string | null
          fecha?: string
          id?: string
          marca_clave?: string | null
          molestias?: string | null
          observaciones?: string | null
          session_type_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "diary_entries_session_type_id_fkey"
            columns: ["session_type_id"]
            isOneToOne: false
            referencedRelation: "session_types"
            referencedColumns: ["id"]
          },
        ]
      }
      diary_entry_values: {
        Row: {
          entry_id: string
          field_id: string
          id: string
          valor: string | null
        }
        Insert: {
          entry_id: string
          field_id: string
          id?: string
          valor?: string | null
        }
        Update: {
          entry_id?: string
          field_id?: string
          id?: string
          valor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "diary_entry_values_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "diary_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diary_entry_values_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "diary_field_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      diary_field_configs: {
        Row: {
          config: Json
          field_type: string
          id: string
          label: string
          nombre: string
          orden: number
          status: Database["public"]["Enums"]["entity_status"]
        }
        Insert: {
          config?: Json
          field_type: string
          id?: string
          label: string
          nombre: string
          orden?: number
          status?: Database["public"]["Enums"]["entity_status"]
        }
        Update: {
          config?: Json
          field_type?: string
          id?: string
          label?: string
          nombre?: string
          orden?: number
          status?: Database["public"]["Enums"]["entity_status"]
        }
        Relationships: []
      }
      exercise_categories: {
        Row: {
          created_at: string
          id: string
          nombre: string
          orden: number
          status: Database["public"]["Enums"]["entity_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          nombre: string
          orden?: number
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          nombre?: string
          orden?: number
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Relationships: []
      }
      exercises: {
        Row: {
          category_id: string | null
          created_at: string
          descripcion: string | null
          id: string
          imagen_url: string | null
          instrucciones: string | null
          nombre: string
          status: Database["public"]["Enums"]["entity_status"]
          updated_at: string
          video_url: string | null
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          descripcion?: string | null
          id?: string
          imagen_url?: string | null
          instrucciones?: string | null
          nombre: string
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          category_id?: string | null
          created_at?: string
          descripcion?: string | null
          id?: string
          imagen_url?: string | null
          instrucciones?: string | null
          nombre?: string
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exercises_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "exercise_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_messages: {
        Row: {
          contenido: string
          created_at: string
          id: string
          parent_id: string | null
          thread_id: string
          user_id: string
        }
        Insert: {
          contenido: string
          created_at?: string
          id?: string
          parent_id?: string | null
          thread_id: string
          user_id: string
        }
        Update: {
          contenido?: string
          created_at?: string
          id?: string
          parent_id?: string | null
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "forum_messages_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "forum_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forum_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "forum_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_threads: {
        Row: {
          created_at: string
          created_by: string
          id: string
          oposicion_id: string | null
          pinned: boolean
          titulo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          oposicion_id?: string | null
          pinned?: boolean
          titulo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          oposicion_id?: string | null
          pinned?: boolean
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "forum_threads_oposicion_id_fkey"
            columns: ["oposicion_id"]
            isOneToOne: false
            referencedRelation: "oposiciones"
            referencedColumns: ["id"]
          },
        ]
      }
      mark_baremos: {
        Row: {
          created_at: string
          id: string
          mark_id: string
          nivel: string
          oposicion_id: string | null
          orden: number
          sexo: Database["public"]["Enums"]["sexo_enum"]
          updated_at: string
          valor_max: number | null
          valor_min: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          mark_id: string
          nivel: string
          oposicion_id?: string | null
          orden?: number
          sexo?: Database["public"]["Enums"]["sexo_enum"]
          updated_at?: string
          valor_max?: number | null
          valor_min?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          mark_id?: string
          nivel?: string
          oposicion_id?: string | null
          orden?: number
          sexo?: Database["public"]["Enums"]["sexo_enum"]
          updated_at?: string
          valor_max?: number | null
          valor_min?: number | null
        }
        Relationships: []
      }
      mark_categories: {
        Row: {
          created_at: string
          id: string
          nombre: string
          orden: number
          status: Database["public"]["Enums"]["entity_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          nombre: string
          orden?: number
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          nombre?: string
          orden?: number
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Relationships: []
      }
      mark_records: {
        Row: {
          created_at: string
          fecha: string
          id: string
          mark_id: string
          observaciones: string | null
          origen: Database["public"]["Enums"]["mark_record_origin"]
          origen_ref: string | null
          registrado_por: string | null
          unidad: string | null
          user_id: string
          valor_numerico: number | null
          valor_texto: string | null
        }
        Insert: {
          created_at?: string
          fecha?: string
          id?: string
          mark_id: string
          observaciones?: string | null
          origen?: Database["public"]["Enums"]["mark_record_origin"]
          origen_ref?: string | null
          registrado_por?: string | null
          unidad?: string | null
          user_id: string
          valor_numerico?: number | null
          valor_texto?: string | null
        }
        Update: {
          created_at?: string
          fecha?: string
          id?: string
          mark_id?: string
          observaciones?: string | null
          origen?: Database["public"]["Enums"]["mark_record_origin"]
          origen_ref?: string | null
          registrado_por?: string | null
          unidad?: string | null
          user_id?: string
          valor_numerico?: number | null
          valor_texto?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mark_records_mark_id_fkey"
            columns: ["mark_id"]
            isOneToOne: false
            referencedRelation: "marks"
            referencedColumns: ["id"]
          },
        ]
      }
      marks: {
        Row: {
          admite_decimal: boolean
          admite_observaciones: boolean
          category_id: string | null
          created_at: string
          descripcion: string | null
          formato: string | null
          id: string
          mejor_mayor: boolean
          nombre: string
          orden: number
          participa_ranking: boolean
          status: Database["public"]["Enums"]["entity_status"]
          tiempo_formato: string | null
          unidad: string | null
          updated_at: string
          value_type: Database["public"]["Enums"]["mark_value_type"]
        }
        Insert: {
          admite_decimal?: boolean
          admite_observaciones?: boolean
          category_id?: string | null
          created_at?: string
          descripcion?: string | null
          formato?: string | null
          id?: string
          mejor_mayor?: boolean
          nombre: string
          orden?: number
          participa_ranking?: boolean
          status?: Database["public"]["Enums"]["entity_status"]
          tiempo_formato?: string | null
          unidad?: string | null
          updated_at?: string
          value_type: Database["public"]["Enums"]["mark_value_type"]
        }
        Update: {
          admite_decimal?: boolean
          admite_observaciones?: boolean
          category_id?: string | null
          created_at?: string
          descripcion?: string | null
          formato?: string | null
          id?: string
          mejor_mayor?: boolean
          nombre?: string
          orden?: number
          participa_ranking?: boolean
          status?: Database["public"]["Enums"]["entity_status"]
          tiempo_formato?: string | null
          unidad?: string | null
          updated_at?: string
          value_type?: Database["public"]["Enums"]["mark_value_type"]
        }
        Relationships: [
          {
            foreignKeyName: "marks_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "mark_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          contenido: string | null
          created_at: string
          id: string
          leida: boolean
          link: string | null
          tipo: string
          titulo: string
          user_id: string
        }
        Insert: {
          contenido?: string | null
          created_at?: string
          id?: string
          leida?: boolean
          link?: string | null
          tipo: string
          titulo: string
          user_id: string
        }
        Update: {
          contenido?: string | null
          created_at?: string
          id?: string
          leida?: boolean
          link?: string | null
          tipo?: string
          titulo?: string
          user_id?: string
        }
        Relationships: []
      }
      oposiciones: {
        Row: {
          created_at: string
          created_by: string | null
          descripcion: string | null
          id: string
          imagen_url: string | null
          nombre: string
          status: Database["public"]["Enums"]["entity_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          id?: string
          imagen_url?: string | null
          nombre: string
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          id?: string
          imagen_url?: string | null
          nombre?: string
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Relationships: []
      }
      personalized_training_versions: {
        Row: {
          bloques: Json
          created_at: string
          created_by: string | null
          id: string
          training_id: string
          version: number
        }
        Insert: {
          bloques?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          training_id: string
          version: number
        }
        Update: {
          bloques?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          training_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "personalized_training_versions_training_id_fkey"
            columns: ["training_id"]
            isOneToOne: false
            referencedRelation: "personalized_trainings"
            referencedColumns: ["id"]
          },
        ]
      }
      personalized_trainings: {
        Row: {
          coach_id: string | null
          created_at: string
          current_version: number
          id: string
          titulo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          coach_id?: string | null
          created_at?: string
          current_version?: number
          id?: string
          titulo: string
          updated_at?: string
          user_id: string
        }
        Update: {
          coach_id?: string | null
          created_at?: string
          current_version?: number
          id?: string
          titulo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      private_conversations: {
        Row: {
          coach_id: string
          created_at: string
          id: string
          last_message_at: string
          user_id: string
        }
        Insert: {
          coach_id: string
          created_at?: string
          id?: string
          last_message_at?: string
          user_id: string
        }
        Update: {
          coach_id?: string
          created_at?: string
          id?: string
          last_message_at?: string
          user_id?: string
        }
        Relationships: []
      }
      private_messages: {
        Row: {
          contenido: string
          conversation_id: string
          created_at: string
          id: string
          leido: boolean
          sender_id: string
        }
        Insert: {
          contenido: string
          conversation_id: string
          created_at?: string
          id?: string
          leido?: boolean
          sender_id: string
        }
        Update: {
          contenido?: string
          conversation_id?: string
          created_at?: string
          id?: string
          leido?: boolean
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "private_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "private_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          acepta_mensajes_usuarios: boolean
          activo: boolean
          altura: number | null
          apellidos: string
          avatar_url: string | null
          created_at: string
          email: string | null
          fecha_nacimiento: string | null
          id: string
          nombre: string
          notas_internas: string | null
          peso: number | null
          sexo: Database["public"]["Enums"]["sexo_enum"] | null
          telefono: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          acepta_mensajes_usuarios?: boolean
          activo?: boolean
          altura?: number | null
          apellidos?: string
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          fecha_nacimiento?: string | null
          id?: string
          nombre?: string
          notas_internas?: string | null
          peso?: number | null
          sexo?: Database["public"]["Enums"]["sexo_enum"] | null
          telefono?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          acepta_mensajes_usuarios?: boolean
          activo?: boolean
          altura?: number | null
          apellidos?: string
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          fecha_nacimiento?: string | null
          id?: string
          nombre?: string
          notas_internas?: string | null
          peso?: number | null
          sexo?: Database["public"]["Enums"]["sexo_enum"] | null
          telefono?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      routine_assignments: {
        Row: {
          activa: boolean
          assigned_by: string | null
          created_at: string
          fecha_fin: string | null
          fecha_inicio: string | null
          id: string
          routine_id: string
          user_id: string
        }
        Insert: {
          activa?: boolean
          assigned_by?: string | null
          created_at?: string
          fecha_fin?: string | null
          fecha_inicio?: string | null
          id?: string
          routine_id: string
          user_id: string
        }
        Update: {
          activa?: boolean
          assigned_by?: string | null
          created_at?: string
          fecha_fin?: string | null
          fecha_inicio?: string | null
          id?: string
          routine_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "routine_assignments_routine_id_fkey"
            columns: ["routine_id"]
            isOneToOne: false
            referencedRelation: "routines"
            referencedColumns: ["id"]
          },
        ]
      }
      routine_days: {
        Row: {
          dia_num: number
          id: string
          nombre: string | null
          routine_id: string
        }
        Insert: {
          dia_num: number
          id?: string
          nombre?: string | null
          routine_id: string
        }
        Update: {
          dia_num?: number
          id?: string
          nombre?: string | null
          routine_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "routine_days_routine_id_fkey"
            columns: ["routine_id"]
            isOneToOne: false
            referencedRelation: "routines"
            referencedColumns: ["id"]
          },
        ]
      }
      routine_exercises: {
        Row: {
          carga: string | null
          descanso: string | null
          exercise_id: string
          id: string
          observaciones: string | null
          orden: number
          repeticiones: string | null
          routine_day_id: string
          series: number | null
          tiempo: string | null
        }
        Insert: {
          carga?: string | null
          descanso?: string | null
          exercise_id: string
          id?: string
          observaciones?: string | null
          orden?: number
          repeticiones?: string | null
          routine_day_id: string
          series?: number | null
          tiempo?: string | null
        }
        Update: {
          carga?: string | null
          descanso?: string | null
          exercise_id?: string
          id?: string
          observaciones?: string | null
          orden?: number
          repeticiones?: string | null
          routine_day_id?: string
          series?: number | null
          tiempo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "routine_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routine_exercises_routine_day_id_fkey"
            columns: ["routine_day_id"]
            isOneToOne: false
            referencedRelation: "routine_days"
            referencedColumns: ["id"]
          },
        ]
      }
      routines: {
        Row: {
          created_at: string
          created_by: string | null
          descripcion: string | null
          id: string
          nombre: string
          num_dias: number
          status: Database["public"]["Enums"]["entity_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          id?: string
          nombre: string
          num_dias?: number
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          id?: string
          nombre?: string
          num_dias?: number
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Relationships: []
      }
      session_types: {
        Row: {
          created_at: string
          id: string
          nombre: string
          orden: number
          status: Database["public"]["Enums"]["entity_status"]
        }
        Insert: {
          created_at?: string
          id?: string
          nombre: string
          orden?: number
          status?: Database["public"]["Enums"]["entity_status"]
        }
        Update: {
          created_at?: string
          id?: string
          nombre?: string
          orden?: number
          status?: Database["public"]["Enums"]["entity_status"]
        }
        Relationships: []
      }
      simulacro_executions: {
        Row: {
          coach_id: string | null
          created_at: string
          fecha: string
          id: string
          observaciones: string | null
          template_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          coach_id?: string | null
          created_at?: string
          fecha?: string
          id?: string
          observaciones?: string | null
          template_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          coach_id?: string | null
          created_at?: string
          fecha?: string
          id?: string
          observaciones?: string | null
          template_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "simulacro_executions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "simulacro_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      simulacro_results: {
        Row: {
          created_at: string
          execution_id: string
          id: string
          mark_id: string
          observaciones: string | null
          valor_numerico: number | null
          valor_texto: string | null
        }
        Insert: {
          created_at?: string
          execution_id: string
          id?: string
          mark_id: string
          observaciones?: string | null
          valor_numerico?: number | null
          valor_texto?: string | null
        }
        Update: {
          created_at?: string
          execution_id?: string
          id?: string
          mark_id?: string
          observaciones?: string | null
          valor_numerico?: number | null
          valor_texto?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "simulacro_results_execution_id_fkey"
            columns: ["execution_id"]
            isOneToOne: false
            referencedRelation: "simulacro_executions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simulacro_results_mark_id_fkey"
            columns: ["mark_id"]
            isOneToOne: false
            referencedRelation: "marks"
            referencedColumns: ["id"]
          },
        ]
      }
      simulacro_template_marks: {
        Row: {
          id: string
          mark_id: string
          orden: number
          template_id: string
        }
        Insert: {
          id?: string
          mark_id: string
          orden?: number
          template_id: string
        }
        Update: {
          id?: string
          mark_id?: string
          orden?: number
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "simulacro_template_marks_mark_id_fkey"
            columns: ["mark_id"]
            isOneToOne: false
            referencedRelation: "marks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simulacro_template_marks_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "simulacro_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      simulacro_templates: {
        Row: {
          created_at: string
          created_by: string | null
          descripcion: string | null
          id: string
          nombre: string
          oposicion_id: string
          sexo: Database["public"]["Enums"]["sexo_enum"]
          status: Database["public"]["Enums"]["entity_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          id?: string
          nombre: string
          oposicion_id: string
          sexo?: Database["public"]["Enums"]["sexo_enum"]
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          descripcion?: string | null
          id?: string
          nombre?: string
          oposicion_id?: string
          sexo?: Database["public"]["Enums"]["sexo_enum"]
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "simulacro_templates_oposicion_id_fkey"
            columns: ["oposicion_id"]
            isOneToOne: false
            referencedRelation: "oposiciones"
            referencedColumns: ["id"]
          },
        ]
      }
      user_oposiciones: {
        Row: {
          created_at: string
          id: string
          oposicion_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          oposicion_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          oposicion_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_oposiciones_oposicion_id_fkey"
            columns: ["oposicion_id"]
            isOneToOne: false
            referencedRelation: "oposiciones"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      coach_has_user: {
        Args: { _coach_id: string; _user_id: string }
        Returns: boolean
      }
      get_feature_flags: {
        Args: never
        Returns: {
          key: string
          value: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_coach_or_admin: { Args: { _user_id: string }; Returns: boolean }
      is_superadmin: { Args: { _user_id: string }; Returns: boolean }
      promote_to_superadmin: { Args: never; Returns: boolean }
      set_access_pin: { Args: { _pin: string }; Returns: boolean }
      superadmin_exists: { Args: never; Returns: boolean }
      verify_access_pin: { Args: { _pin: string }; Returns: boolean }
    }
    Enums: {
      app_role: "usuario" | "entrenador" | "superadmin"
      cooper_fase: "inicial" | "mesociclo_1" | "mesociclo_2" | "pre_examen"
      entity_status: "activo" | "inactivo" | "archivado" | "borrador"
      mark_record_origin:
        | "simulacro"
        | "manual"
        | "masivo"
        | "diario"
        | "importacion"
      mark_value_type:
        | "tiempo"
        | "distancia"
        | "repeticiones"
        | "peso"
        | "puntuacion"
        | "booleano"
        | "texto"
      sexo_enum: "masculino" | "femenino" | "unisex"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["usuario", "entrenador", "superadmin"],
      cooper_fase: ["inicial", "mesociclo_1", "mesociclo_2", "pre_examen"],
      entity_status: ["activo", "inactivo", "archivado", "borrador"],
      mark_record_origin: [
        "simulacro",
        "manual",
        "masivo",
        "diario",
        "importacion",
      ],
      mark_value_type: [
        "tiempo",
        "distancia",
        "repeticiones",
        "peso",
        "puntuacion",
        "booleano",
        "texto",
      ],
      sexo_enum: ["masculino", "femenino", "unisex"],
    },
  },
} as const
