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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      asistencias: {
        Row: {
          estado: Database["public"]["Enums"]["estado_asistencia"]
          fecha: string
          id: number
          inscripcion_id: string
          sesion_id: number
        }
        Insert: {
          estado?: Database["public"]["Enums"]["estado_asistencia"]
          fecha?: string
          id?: never
          inscripcion_id: string
          sesion_id: number
        }
        Update: {
          estado?: Database["public"]["Enums"]["estado_asistencia"]
          fecha?: string
          id?: never
          inscripcion_id?: string
          sesion_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "asistencias_inscripcion_id_fkey"
            columns: ["inscripcion_id"]
            isOneToOne: false
            referencedRelation: "inscripciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asistencias_sesion_id_fkey"
            columns: ["sesion_id"]
            isOneToOne: false
            referencedRelation: "sesiones"
            referencedColumns: ["id"]
          },
        ]
      }
      categorias: {
        Row: {
          descripcion: string | null
          id: number
          nombre: string
          slug: string
        }
        Insert: {
          descripcion?: string | null
          id?: never
          nombre: string
          slug: string
        }
        Update: {
          descripcion?: string | null
          id?: never
          nombre?: string
          slug?: string
        }
        Relationships: []
      }
      certificados: {
        Row: {
          archivo_pdf: string | null
          codigo_unico: string
          fecha_emision: string
          id: string
          inscripcion_id: string
        }
        Insert: {
          archivo_pdf?: string | null
          codigo_unico: string
          fecha_emision?: string
          id?: string
          inscripcion_id: string
        }
        Update: {
          archivo_pdf?: string | null
          codigo_unico?: string
          fecha_emision?: string
          id?: string
          inscripcion_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificados_inscripcion_id_fkey"
            columns: ["inscripcion_id"]
            isOneToOne: true
            referencedRelation: "inscripciones"
            referencedColumns: ["id"]
          },
        ]
      }
      comprobantes: {
        Row: {
          enviado_sunat: boolean
          fecha_emision: string
          id: number
          numero: string
          pago_id: string
          pdf_url: string | null
          serie: string
          tipo: Database["public"]["Enums"]["tipo_comprobante"]
        }
        Insert: {
          enviado_sunat?: boolean
          fecha_emision?: string
          id?: never
          numero: string
          pago_id: string
          pdf_url?: string | null
          serie: string
          tipo?: Database["public"]["Enums"]["tipo_comprobante"]
        }
        Update: {
          enviado_sunat?: boolean
          fecha_emision?: string
          id?: never
          numero?: string
          pago_id?: string
          pdf_url?: string | null
          serie?: string
          tipo?: Database["public"]["Enums"]["tipo_comprobante"]
        }
        Relationships: [
          {
            foreignKeyName: "comprobantes_pago_id_fkey"
            columns: ["pago_id"]
            isOneToOne: true
            referencedRelation: "pagos"
            referencedColumns: ["id"]
          },
        ]
      }
      contenidos: {
        Row: {
          id: number
          modulo_id: number
          orden: number
          tipo: Database["public"]["Enums"]["tipo_contenido"]
          titulo: string
          url_archivo: string
        }
        Insert: {
          id?: never
          modulo_id: number
          orden?: number
          tipo: Database["public"]["Enums"]["tipo_contenido"]
          titulo: string
          url_archivo: string
        }
        Update: {
          id?: never
          modulo_id?: number
          orden?: number
          tipo?: Database["public"]["Enums"]["tipo_contenido"]
          titulo?: string
          url_archivo?: string
        }
        Relationships: [
          {
            foreignKeyName: "contenidos_modulo_id_fkey"
            columns: ["modulo_id"]
            isOneToOne: false
            referencedRelation: "modulos"
            referencedColumns: ["id"]
          },
        ]
      }
      contenidos_completados: {
        Row: {
          completado_en: string
          contenido_id: number
          inscripcion_id: string
        }
        Insert: {
          completado_en?: string
          contenido_id: number
          inscripcion_id: string
        }
        Update: {
          completado_en?: string
          contenido_id?: number
          inscripcion_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contenidos_completados_contenido_id_fkey"
            columns: ["contenido_id"]
            isOneToOne: false
            referencedRelation: "contenidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contenidos_completados_inscripcion_id_fkey"
            columns: ["inscripcion_id"]
            isOneToOne: false
            referencedRelation: "inscripciones"
            referencedColumns: ["id"]
          },
        ]
      }
      cupones: {
        Row: {
          activo: boolean
          codigo: string
          fecha_vigencia: string
          id: number
          porcentaje_descuento: number
          usos_maximos: number | null
        }
        Insert: {
          activo?: boolean
          codigo: string
          fecha_vigencia: string
          id?: never
          porcentaje_descuento: number
          usos_maximos?: number | null
        }
        Update: {
          activo?: boolean
          codigo?: string
          fecha_vigencia?: string
          id?: never
          porcentaje_descuento?: number
          usos_maximos?: number | null
        }
        Relationships: []
      }
      cursos: {
        Row: {
          actualizado_en: string
          categoria_id: number | null
          creado_en: string
          cupo_maximo: number
          descripcion: string | null
          destacado: boolean
          duracion_horas: number
          estado: Database["public"]["Enums"]["estado_curso"]
          id: string
          imagen_url: string | null
          instructor_id: string | null
          modalidad: Database["public"]["Enums"]["modalidad_curso"]
          nivel: Database["public"]["Enums"]["nivel_curso"]
          precio: number
          publicar_en: string | null
          slug: string
          titulo: string
        }
        Insert: {
          actualizado_en?: string
          categoria_id?: number | null
          creado_en?: string
          cupo_maximo?: number
          descripcion?: string | null
          destacado?: boolean
          duracion_horas?: number
          estado?: Database["public"]["Enums"]["estado_curso"]
          id?: string
          imagen_url?: string | null
          instructor_id?: string | null
          modalidad?: Database["public"]["Enums"]["modalidad_curso"]
          nivel?: Database["public"]["Enums"]["nivel_curso"]
          precio?: number
          publicar_en?: string | null
          slug: string
          titulo: string
        }
        Update: {
          actualizado_en?: string
          categoria_id?: number | null
          creado_en?: string
          cupo_maximo?: number
          descripcion?: string | null
          destacado?: boolean
          duracion_horas?: number
          estado?: Database["public"]["Enums"]["estado_curso"]
          id?: string
          imagen_url?: string | null
          instructor_id?: string | null
          modalidad?: Database["public"]["Enums"]["modalidad_curso"]
          nivel?: Database["public"]["Enums"]["nivel_curso"]
          precio?: number
          publicar_en?: string | null
          slug?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "cursos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cursos_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluaciones: {
        Row: {
          curso_id: string
          id: number
          intentos_permitidos: number
          puntaje_total: number
          tiempo_limite_min: number | null
          titulo: string
        }
        Insert: {
          curso_id: string
          id?: never
          intentos_permitidos?: number
          puntaje_total?: number
          tiempo_limite_min?: number | null
          titulo: string
        }
        Update: {
          curso_id?: string
          id?: never
          intentos_permitidos?: number
          puntaje_total?: number
          tiempo_limite_min?: number | null
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "evaluaciones_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          },
        ]
      }
      inscripciones: {
        Row: {
          codigo: string
          curso_id: string
          estado: Database["public"]["Enums"]["estado_inscripcion"]
          estudiante_id: string
          fecha_inscripcion: string
          id: string
          vence_en: string | null
        }
        Insert: {
          codigo?: string
          curso_id: string
          estado?: Database["public"]["Enums"]["estado_inscripcion"]
          estudiante_id: string
          fecha_inscripcion?: string
          id?: string
          vence_en?: string | null
        }
        Update: {
          codigo?: string
          curso_id?: string
          estado?: Database["public"]["Enums"]["estado_inscripcion"]
          estudiante_id?: string
          fecha_inscripcion?: string
          id?: string
          vence_en?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inscripciones_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inscripciones_estudiante_id_fkey"
            columns: ["estudiante_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      intentos_evaluacion: {
        Row: {
          evaluacion_id: number
          fecha: string
          id: number
          inscripcion_id: string
          numero_intento: number
          puntaje_obtenido: number | null
          respuestas: Json
        }
        Insert: {
          evaluacion_id: number
          fecha?: string
          id?: never
          inscripcion_id: string
          numero_intento: number
          puntaje_obtenido?: number | null
          respuestas?: Json
        }
        Update: {
          evaluacion_id?: number
          fecha?: string
          id?: never
          inscripcion_id?: string
          numero_intento?: number
          puntaje_obtenido?: number | null
          respuestas?: Json
        }
        Relationships: [
          {
            foreignKeyName: "intentos_evaluacion_evaluacion_id_fkey"
            columns: ["evaluacion_id"]
            isOneToOne: false
            referencedRelation: "evaluaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intentos_evaluacion_inscripcion_id_fkey"
            columns: ["inscripcion_id"]
            isOneToOne: false
            referencedRelation: "inscripciones"
            referencedColumns: ["id"]
          },
        ]
      }
      modulos: {
        Row: {
          curso_id: string
          id: number
          orden: number
          titulo: string
        }
        Insert: {
          curso_id: string
          id?: never
          orden?: number
          titulo: string
        }
        Update: {
          curso_id?: string
          id?: never
          orden?: number
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "modulos_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          },
        ]
      }
      notificaciones: {
        Row: {
          enlace: string | null
          fecha_envio: string
          id: number
          leida: boolean
          mensaje: string
          tipo: Database["public"]["Enums"]["tipo_notificacion"]
          usuario_id: string
        }
        Insert: {
          enlace?: string | null
          fecha_envio?: string
          id?: never
          leida?: boolean
          mensaje: string
          tipo?: Database["public"]["Enums"]["tipo_notificacion"]
          usuario_id: string
        }
        Update: {
          enlace?: string | null
          fecha_envio?: string
          id?: never
          leida?: boolean
          mensaje?: string
          tipo?: Database["public"]["Enums"]["tipo_notificacion"]
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificaciones_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pagos: {
        Row: {
          cupon_id: number | null
          estado: Database["public"]["Enums"]["estado_pago"]
          fecha_pago: string | null
          id: string
          inscripcion_id: string
          metodo: Database["public"]["Enums"]["metodo_pago"]
          monto: number
          numero_operacion: string | null
          observacion: string | null
          referencia_pasarela: string | null
          reportado_en: string | null
          respuesta_pasarela: Json | null
          voucher_ruta: string | null
        }
        Insert: {
          cupon_id?: number | null
          estado?: Database["public"]["Enums"]["estado_pago"]
          fecha_pago?: string | null
          id?: string
          inscripcion_id: string
          metodo: Database["public"]["Enums"]["metodo_pago"]
          monto: number
          numero_operacion?: string | null
          observacion?: string | null
          referencia_pasarela?: string | null
          reportado_en?: string | null
          respuesta_pasarela?: Json | null
          voucher_ruta?: string | null
        }
        Update: {
          cupon_id?: number | null
          estado?: Database["public"]["Enums"]["estado_pago"]
          fecha_pago?: string | null
          id?: string
          inscripcion_id?: string
          metodo?: Database["public"]["Enums"]["metodo_pago"]
          monto?: number
          numero_operacion?: string | null
          observacion?: string | null
          referencia_pasarela?: string | null
          reportado_en?: string | null
          respuesta_pasarela?: Json | null
          voucher_ruta?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pagos_cupon_id_fkey"
            columns: ["cupon_id"]
            isOneToOne: false
            referencedRelation: "cupones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_inscripcion_id_fkey"
            columns: ["inscripcion_id"]
            isOneToOne: true
            referencedRelation: "inscripciones"
            referencedColumns: ["id"]
          },
        ]
      }
      perfiles: {
        Row: {
          actualizado_en: string
          apellidos: string
          avatar_url: string | null
          correo: string
          documento: string | null
          especialidad: string | null
          estado: boolean
          fecha_registro: string
          id: string
          nombres: string
          rol: Database["public"]["Enums"]["rol_usuario"]
          telefono: string | null
        }
        Insert: {
          actualizado_en?: string
          apellidos?: string
          avatar_url?: string | null
          correo: string
          documento?: string | null
          especialidad?: string | null
          estado?: boolean
          fecha_registro?: string
          id: string
          nombres?: string
          rol?: Database["public"]["Enums"]["rol_usuario"]
          telefono?: string | null
        }
        Update: {
          actualizado_en?: string
          apellidos?: string
          avatar_url?: string | null
          correo?: string
          documento?: string | null
          especialidad?: string | null
          estado?: boolean
          fecha_registro?: string
          id?: string
          nombres?: string
          rol?: Database["public"]["Enums"]["rol_usuario"]
          telefono?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "perfiles_rol_fkey"
            columns: ["rol"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["codigo"]
          },
        ]
      }
      preguntas: {
        Row: {
          enunciado: string
          evaluacion_id: number
          id: number
          opciones: Json
          puntaje: number
          respuesta_correcta: string
        }
        Insert: {
          enunciado: string
          evaluacion_id: number
          id?: never
          opciones?: Json
          puntaje?: number
          respuesta_correcta: string
        }
        Update: {
          enunciado?: string
          evaluacion_id?: number
          id?: never
          opciones?: Json
          puntaje?: number
          respuesta_correcta?: string
        }
        Relationships: [
          {
            foreignKeyName: "preguntas_evaluacion_id_fkey"
            columns: ["evaluacion_id"]
            isOneToOne: false
            referencedRelation: "evaluaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      progreso: {
        Row: {
          actualizado_en: string
          inscripcion_id: string
          lecciones_completadas: number
          porcentaje: number
          total_lecciones: number
        }
        Insert: {
          actualizado_en?: string
          inscripcion_id: string
          lecciones_completadas?: number
          porcentaje?: number
          total_lecciones?: number
        }
        Update: {
          actualizado_en?: string
          inscripcion_id?: string
          lecciones_completadas?: number
          porcentaje?: number
          total_lecciones?: number
        }
        Relationships: [
          {
            foreignKeyName: "progreso_inscripcion_id_fkey"
            columns: ["inscripcion_id"]
            isOneToOne: true
            referencedRelation: "inscripciones"
            referencedColumns: ["id"]
          },
        ]
      }
      reembolsos: {
        Row: {
          estado: Database["public"]["Enums"]["estado_reembolso"]
          fecha_solicitud: string
          id: number
          monto: number
          motivo: string
          pago_id: string
        }
        Insert: {
          estado?: Database["public"]["Enums"]["estado_reembolso"]
          fecha_solicitud?: string
          id?: never
          monto: number
          motivo: string
          pago_id: string
        }
        Update: {
          estado?: Database["public"]["Enums"]["estado_reembolso"]
          fecha_solicitud?: string
          id?: never
          monto?: number
          motivo?: string
          pago_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reembolsos_pago_id_fkey"
            columns: ["pago_id"]
            isOneToOne: false
            referencedRelation: "pagos"
            referencedColumns: ["id"]
          },
        ]
      }
      registro_actividad: {
        Row: {
          accion: string
          detalle: Json | null
          direccion_ip: unknown
          fecha_hora: string
          id: number
          usuario_id: string | null
        }
        Insert: {
          accion: string
          detalle?: Json | null
          direccion_ip?: unknown
          fecha_hora?: string
          id?: never
          usuario_id?: string | null
        }
        Update: {
          accion?: string
          detalle?: Json | null
          direccion_ip?: unknown
          fecha_hora?: string
          id?: never
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "registro_actividad_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          codigo: Database["public"]["Enums"]["rol_usuario"]
          descripcion: string | null
          nombre: string
        }
        Insert: {
          codigo: Database["public"]["Enums"]["rol_usuario"]
          descripcion?: string | null
          nombre: string
        }
        Update: {
          codigo?: Database["public"]["Enums"]["rol_usuario"]
          descripcion?: string | null
          nombre?: string
        }
        Relationships: []
      }
      sesiones: {
        Row: {
          curso_id: string
          duracion_minutos: number
          enlace_virtual: string | null
          fecha: string
          hora_inicio: string
          id: number
          modalidad: Database["public"]["Enums"]["modalidad_curso"]
        }
        Insert: {
          curso_id: string
          duracion_minutos?: number
          enlace_virtual?: string | null
          fecha: string
          hora_inicio: string
          id?: never
          modalidad?: Database["public"]["Enums"]["modalidad_curso"]
        }
        Update: {
          curso_id?: string
          duracion_minutos?: number
          enlace_virtual?: string | null
          fecha?: string
          hora_inicio?: string
          id?: never
          modalidad?: Database["public"]["Enums"]["modalidad_curso"]
        }
        Relationships: [
          {
            foreignKeyName: "sesiones_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cupo_disponible: { Args: { p_curso: string }; Returns: number }
      es_admin: { Args: never; Returns: boolean }
      instructores_publicos: {
        Args: { p_ids: string[] }
        Returns: {
          apellidos: string
          avatar_url: string
          especialidad: string
          id: string
          nombres: string
        }[]
      }
      verificar_certificado: {
        Args: { p_codigo: string }
        Returns: {
          codigo_unico: string
          curso: string
          duracion_horas: number
          estudiante: string
          fecha_emision: string
        }[]
      }
    }
    Enums: {
      estado_asistencia: "PRESENTE" | "AUSENTE" | "TARDANZA"
      estado_curso: "BORRADOR" | "PUBLICADO" | "DESPUBLICADO"
      estado_inscripcion: "PENDIENTE" | "CONFIRMADA" | "CANCELADA"
      estado_pago:
        | "PENDIENTE"
        | "APROBADO"
        | "RECHAZADO"
        | "REEMBOLSADO"
        | "VENCIDO"
      estado_reembolso: "SOLICITADO" | "APROBADO" | "RECHAZADO" | "PROCESADO"
      metodo_pago: "CULQI" | "IZIPAY" | "NIUBIZ" | "YAPE" | "PLIN"
      modalidad_curso: "PRESENCIAL" | "VIRTUAL" | "SEMIPRESENCIAL"
      nivel_curso: "BASICO" | "INTERMEDIO" | "AVANZADO"
      rol_usuario: "administrador" | "instructor" | "estudiante"
      tipo_comprobante: "BOLETA" | "FACTURA"
      tipo_contenido: "PDF" | "VIDEO" | "ENLACE"
      tipo_notificacion: "CORREO" | "IN_APP"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      estado_asistencia: ["PRESENTE", "AUSENTE", "TARDANZA"],
      estado_curso: ["BORRADOR", "PUBLICADO", "DESPUBLICADO"],
      estado_inscripcion: ["PENDIENTE", "CONFIRMADA", "CANCELADA"],
      estado_pago: [
        "PENDIENTE",
        "APROBADO",
        "RECHAZADO",
        "REEMBOLSADO",
        "VENCIDO",
      ],
      estado_reembolso: ["SOLICITADO", "APROBADO", "RECHAZADO", "PROCESADO"],
      metodo_pago: ["CULQI", "IZIPAY", "NIUBIZ", "YAPE", "PLIN"],
      modalidad_curso: ["PRESENCIAL", "VIRTUAL", "SEMIPRESENCIAL"],
      nivel_curso: ["BASICO", "INTERMEDIO", "AVANZADO"],
      rol_usuario: ["administrador", "instructor", "estudiante"],
      tipo_comprobante: ["BOLETA", "FACTURA"],
      tipo_contenido: ["PDF", "VIDEO", "ENLACE"],
      tipo_notificacion: ["CORREO", "IN_APP"],
    },
  },
} as const
