export type RolUsuario =
  | 'Auditor OCI (Control Institucional)'
  | 'Especialista Logística (DEC)'
  | 'Consulta Transparencia (Solo Lectura)';

export type NivelRiesgo = 'ALTO' | 'MEDIO' | 'LIMPIO';

export interface ActuacionItem {
  id: number;
  expediente_id: number;
  orden: number;
  etapa: string;
  usuario_rol: string;
  timestamp: string;
  version_doc: string;
  tiene_sustento: boolean;
  documento_texto: string;
  hash_anterior: string;
  hash_actual: string;
  hash_recalculado?: string;
  es_integro: boolean;
  enlace_anterior_valido: boolean;
  detalle_estado?: string;
}

export interface VerificacionCadena {
  expediente_id: number;
  expediente_codigo: string;
  integridad_global: boolean;
  etapa_comprometida?: string | null;
  orden_comprometido?: number | null;
  mensaje_forense: string;
  eslabones: ActuacionItem[];
}

export interface PostulacionDetalle {
  id: number;
  proveedor_id: number;
  proveedor_codigo: string;
  proveedor_alias: string;
  representante_id: string;
  direccion_hash: string;
  telefono_hash: string;
  monto_ofertado: number;
  es_ganador: boolean;
  fecha_presentacion: string;
}

export interface HistorialAlertaItem {
  id: number;
  alerta_id: number;
  estado_anterior?: string | null;
  estado_nuevo: string;
  area_asignada?: string | null;
  comentario: string;
  accion_correctiva?: string | null;
  rol_usuario: string;
  timestamp: string;
}

export interface AlertaGestion {
  id: number;
  expediente_id: number;
  expediente_codigo?: string;
  expediente_objeto?: string;
  expediente_monto?: number;
  area_usuaria?: string;
  codigo_regla: string;
  categoria: string;
  titulo: string;
  severidad: 'ALTO' | 'MEDIO';
  regla_activada: string;
  evidencia_exacta: string;
  base_normativa: string;
  estado_revision: 'PENDIENTE' | 'EN_DESCARGO' | 'VALIDADA_OCI' | 'ARCHIVADA_SUSTENTADA';
  area_asignada: string;
  accion_correctiva?: string | null;
  fecha_limite?: string | null;
  comentario_descargo?: string | null;
  rol_ultimo_cambio?: string | null;
  fecha_actualizacion?: string | null;
  historial: HistorialAlertaItem[];
}

export interface ProveedorItem {
  id: number;
  codigo: string;
  alias_comercial: string;
  rubro: string;
  representante_id: string;
  direccion_hash: string;
  telefono_hash: string;
  es_colusorio: boolean;
}

export interface ExpedienteCreatePayload {
  objeto: string;
  rubro: string;
  area_usuaria: string;
  modalidad: string;
  monto_estimado: number;
  tdr_texto: string;
  proveedor_adjudicado_codigo: string;
  proveedores_postores: string[];
  fecha_creacion?: string;
  mismo_funcionario_etapas?: boolean;
  pago_sin_conformidad?: boolean;
  modificacion_extemporanea_tdr?: boolean;
  sin_sustento_documental?: boolean;
  entregable_incompleto_obra?: boolean;
  conflicto_interes_familiar?: boolean;
  rol_usuario: RolUsuario;
}

export interface NlpSimilitudItem {
  proveedor_codigo: string;
  proveedor_alias: string;
  rubro: string;
  es_adjudicado: boolean;
  porcentaje_similitud: number;
  terminos_coincidentes: string[];
  alerta_direccionamiento: boolean;
}

export interface NlpResultado {
  expediente_codigo: string;
  umbral_alerta: number;
  max_similitud: number;
  proveedor_mas_similar: string;
  alerta_detectada: boolean;
  explicacion_xai: string;
  comparaciones: NlpSimilitudItem[];
}

export interface ExpedienteListItem {
  id: number;
  codigo: string;
  objeto: string;
  rubro: string;
  area_usuaria: string;
  modalidad: string;
  monto_estimado: number;
  fecha_creacion: string;
  estado_expediente: string;
  proveedor_adjudicado_codigo?: string | null;
  nivel_riesgo: NivelRiesgo;
  puntaje_riesgo: number;
  integridad_valida: boolean;
  es_caso_trampa: boolean;
  tipo_trampa?: string | null;
  total_alertas: number;
}

export interface EntregableTdrItem {
  id: number;
  expediente_id: number;
  orden: number;
  nombre: string;
  obligatorio: boolean;
  cumplido: boolean;
  evidencia_tecnica?: string | null;
  verificado_por?: string | null;
  fecha_verificacion?: string | null;
}

export interface ConflictoInteresItem {
  id: number;
  expediente_id: number;
  expediente_codigo?: string;
  expediente_objeto?: string;
  funcionario_codigo: string;
  proveedor_vinculado_codigo: string;
  tipo_vinculo: string;
  descripcion: string;
  estado: 'DETECTADO' | 'DECLARADO_OPORTUNO' | 'ABSTENIDO_Y_REASIGNADO' | string;
  funcionario_reasignado?: string | null;
  fecha_registro: string;
  fecha_resolucion?: string | null;
  resuelto_por?: string | null;
}

export interface MapaRiesgoEtapa {
  orden: number;
  etapa: string;
  riesgo_principal: string;
  causa_raiz: string;
  probabilidad: number;
  impacto: number;
  puntaje_inherente: number;
  nivel: 'CRÍTICO' | 'ALTO' | 'MEDIO' | 'BAJO' | string;
  expedientes_afectados: number;
  alertas_activas: number;
  control_centinela: string;
  componente_modelo_integridad: string;
}

export interface MapaRiesgosData {
  marco_referencia: string;
  total_expedientes: number;
  total_etapas_criticas: number;
  etapas: MapaRiesgoEtapa[];
}

export interface ExpedienteDetalle extends Omit<ExpedienteListItem, 'total_alertas'> {
  tdr_texto: string;
  verificacion_sha256: VerificacionCadena;
  postulaciones: PostulacionDetalle[];
  alertas: AlertaGestion[];
  analisis_nlp: NlpResultado;
  entregables_tdr: EntregableTdrItem[];
  pago_bloqueado_preventivo: boolean;
  conflictos_interes: ConflictoInteresItem[];
}

export interface DashboardKPIs {
  total_expedientes: number;
  expedientes_limpios: number;
  expedientes_observados: number;
  expedientes_integridad_rota: number;
  monto_total_auditado: number;
  monto_en_riesgo_preventivo: number;
  ahorro_preventivo_estimado: number;
  total_alertas_xai: number;
  alertas_pendientes: number;
  alertas_validadas_oci: number;
  alertas_en_descargo: number;
  alertas_archivadas: number;
  porcentaje_limpios: number;
  distribucion_riesgo: Record<string, number>;
  alertas_por_categoria: { categoria: string; cantidad: number }[];
  casos_destacados: ExpedienteListItem[];
}

export interface ClusterColusion {
  cluster_id: string;
  nombre_red: string;
  proveedores_vinculados: string[];
  atributos_compartidos: string[];
  expedientes_afectados: {
    id: number;
    codigo: string;
    objeto: string;
    monto_estimado: number;
    area_usuaria: string;
    proveedor_adjudicado: string;
  }[];
  monto_total_afectado: number;
  explicacion_xai: string;
  base_normativa: string;
}

export interface GrafoColusionData {
  metricas_grafo: {
    total_nodos: number;
    total_enlaces: number;
    total_clusters_colusion: number;
    proveedores_en_colusion: number;
    expedientes_comprometidos: number;
  };
  clusters_detectados: ClusterColusion[];
  elements: {
    nodes: { data: Record<string, any> }[];
    edges: { data: Record<string, any> }[];
  };
}

export interface AuditLogItem {
  id: number;
  timestamp: string;
  usuario_codigo: string;
  rol_usuario: string;
  accion: string;
  recurso: string;
  resultado: 'PERMITIDO' | 'BLOQUEADO_403' | string;
  detalle: string;
  ip_origen: string;
  hash_anterior: string;
  hash_actual: string;
  es_integro: boolean;
}

export interface AuditLogResumen {
  cadena_integra: boolean;
  total_eventos: number;
  total_permitidos: number;
  total_bloqueados: number;
  ultimo_hash: string;
  evento_comprometido_id?: number | null;
  mensaje_integridad: string;
  eventos: AuditLogItem[];
}

export interface DenunciaItem {
  id: number;
  codigo_seguimiento: string;
  hash_reserva: string;
  categoria: string;
  area_involucrada: string;
  expediente_codigo?: string | null;
  descripcion_hechos: string;
  solicita_proteccion: boolean;
  medida_proteccion: string;
  estado: 'RECIBIDA' | 'EN_EVALUACION' | 'DERIVADA' | 'ATENDIDA' | 'ARCHIVADA_MOTIVADA' | string;
  organo_derivado: string;
  fecha_registro: string;
  fecha_limite_sla: string;
  ultima_actualizacion: string;
  respuesta_seguimiento: string;
  nota_interna_oci?: string | null;
  gestionado_por?: string | null;
}

export interface DenunciaConsultaPublica {
  codigo_seguimiento: string;
  hash_reserva: string;
  categoria: string;
  area_involucrada: string;
  expediente_codigo?: string | null;
  estado: string;
  organo_derivado: string;
  medida_proteccion: string;
  fecha_registro: string;
  fecha_limite_sla: string;
  ultima_actualizacion: string;
  respuesta_seguimiento: string;
}

export interface DenunciaResumenPublico {
  total_recibidas: number;
  en_tramite: number;
  derivadas: number;
  atendidas_o_archivadas: number;
  con_medida_proteccion: number;
  por_categoria: { categoria: string; cantidad: number }[];
}
