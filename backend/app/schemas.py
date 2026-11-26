from typing import Dict, List, Optional
from pydantic import BaseModel, ConfigDict


class ActuacionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    expediente_id: int
    orden: int
    etapa: str
    usuario_rol: str
    timestamp: str
    version_doc: str = "v1.0"
    tiene_sustento: bool = True
    documento_texto: str
    hash_anterior: str
    hash_actual: str
    hash_recalculado: Optional[str] = None
    es_integro: bool = True
    enlace_anterior_valido: bool = True
    detalle_estado: Optional[str] = None


class PostulacionDetalleOut(BaseModel):
    id: int
    proveedor_id: int
    proveedor_codigo: str
    proveedor_alias: str
    representante_id: str
    direccion_hash: str
    telefono_hash: str
    monto_ofertado: float
    es_ganador: bool
    fecha_presentacion: str


class HistorialAlertaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    alerta_id: int
    estado_anterior: Optional[str] = None
    estado_nuevo: str
    area_asignada: Optional[str] = None
    comentario: str
    accion_correctiva: Optional[str] = None
    rol_usuario: str
    timestamp: str


class AlertaGestionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    expediente_id: int
    expediente_codigo: Optional[str] = None
    expediente_objeto: Optional[str] = None
    expediente_monto: Optional[float] = None
    area_usuaria: Optional[str] = None
    codigo_regla: str
    categoria: str
    titulo: str
    severidad: str
    regla_activada: str
    evidencia_exacta: str
    base_normativa: str
    estado_revision: str
    area_asignada: str = "OCI — Órgano de Control Institucional"
    accion_correctiva: Optional[str] = None
    fecha_limite: Optional[str] = None
    comentario_descargo: Optional[str] = None
    rol_ultimo_cambio: Optional[str] = None
    fecha_actualizacion: Optional[str] = None
    historial: List[HistorialAlertaOut] = []


class AlertaUpdateInput(BaseModel):
    estado_revision: str
    comentario_descargo: str
    rol_usuario: str
    area_asignada: Optional[str] = None
    accion_correctiva: Optional[str] = None
    fecha_limite: Optional[str] = None


class ProveedorOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    codigo: str
    alias_comercial: str
    rubro: str
    representante_id: str
    direccion_hash: str
    telefono_hash: str
    es_colusorio: bool


class ExpedienteCreateInput(BaseModel):
    objeto: str
    rubro: str
    area_usuaria: str
    modalidad: str
    monto_estimado: float
    tdr_texto: str
    proveedor_adjudicado_codigo: str
    proveedores_postores: List[str] = []
    fecha_creacion: Optional[str] = None
    mismo_funcionario_etapas: bool = False
    pago_sin_conformidad: bool = False
    modificacion_extemporanea_tdr: bool = False
    sin_sustento_documental: bool = False
    entregable_incompleto_obra: bool = False
    conflicto_interes_familiar: bool = False
    rol_usuario: str = "Especialista Logística (DEC)"


class ExpedienteListOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    codigo: str
    objeto: str
    rubro: str
    area_usuaria: str
    modalidad: str
    monto_estimado: float
    fecha_creacion: str
    estado_expediente: str
    proveedor_adjudicado_codigo: Optional[str] = None
    nivel_riesgo: str
    puntaje_riesgo: int
    integridad_valida: bool
    es_caso_trampa: bool
    tipo_trampa: Optional[str] = None
    total_alertas: int = 0


class NlpSimilitudItem(BaseModel):
    proveedor_codigo: str
    proveedor_alias: str
    rubro: str
    es_adjudicado: bool
    porcentaje_similitud: float
    terminos_coincidentes: List[str]
    alerta_direccionamiento: bool


class NlpResultadoOut(BaseModel):
    expediente_codigo: str
    umbral_alerta: float
    max_similitud: float
    proveedor_mas_similar: str
    alerta_detectada: bool
    explicacion_xai: str
    comparaciones: List[NlpSimilitudItem]


class VerificacionCadenaOut(BaseModel):
    expediente_id: int
    expediente_codigo: str
    integridad_global: bool
    etapa_comprometida: Optional[str] = None
    orden_comprometido: Optional[int] = None
    mensaje_forense: str
    eslabones: List[ActuacionOut]


class EntregableTdrOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    expediente_id: int
    orden: int
    nombre: str
    obligatorio: bool
    cumplido: bool
    evidencia_tecnica: Optional[str] = None
    verificado_por: Optional[str] = None
    fecha_verificacion: Optional[str] = None


class EntregableVerificarInput(BaseModel):
    cumplido: bool
    evidencia_tecnica: str
    rol_usuario: Optional[str] = None


class ConflictoInteresOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    expediente_id: int
    expediente_codigo: Optional[str] = None
    expediente_objeto: Optional[str] = None
    funcionario_codigo: str
    proveedor_vinculado_codigo: str
    tipo_vinculo: str
    descripcion: str
    estado: str
    funcionario_reasignado: Optional[str] = None
    fecha_registro: str
    fecha_resolucion: Optional[str] = None
    resuelto_por: Optional[str] = None


class ConflictoCreateInput(BaseModel):
    expediente_id: int
    funcionario_codigo: str
    proveedor_vinculado_codigo: str
    tipo_vinculo: str
    descripcion: str
    abstenerse_de_inmediato: bool = False
    funcionario_reasignado: Optional[str] = None


class ConflictoAbstencionInput(BaseModel):
    funcionario_reasignado: str
    comentario: Optional[str] = None


class MapaRiesgoEtapaOut(BaseModel):
    orden: int
    etapa: str
    riesgo_principal: str
    causa_raiz: str
    probabilidad: int
    impacto: int
    puntaje_inherente: int
    nivel: str
    expedientes_afectados: int
    alertas_activas: int
    control_centinela: str
    componente_modelo_integridad: str


class MapaRiesgosOut(BaseModel):
    marco_referencia: str
    total_expedientes: int
    total_etapas_criticas: int
    etapas: List[MapaRiesgoEtapaOut]


class ExpedienteDetalleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    codigo: str
    objeto: str
    rubro: str
    area_usuaria: str
    modalidad: str
    monto_estimado: float
    fecha_creacion: str
    estado_expediente: str
    tdr_texto: str
    proveedor_adjudicado_codigo: Optional[str] = None
    nivel_riesgo: str
    puntaje_riesgo: int
    integridad_valida: bool
    es_caso_trampa: bool
    tipo_trampa: Optional[str] = None
    verificacion_sha256: VerificacionCadenaOut
    postulaciones: List[PostulacionDetalleOut]
    alertas: List[AlertaGestionOut]
    analisis_nlp: NlpResultadoOut
    entregables_tdr: List[EntregableTdrOut] = []
    pago_bloqueado_preventivo: bool = False
    conflictos_interes: List[ConflictoInteresOut] = []


class TamperSimulationRequest(BaseModel):
    etapa_objetivo: Optional[str] = "Cotizaciones"
    nuevo_texto_alterado: Optional[str] = None


class DashboardKPIsOut(BaseModel):
    total_expedientes: int
    expedientes_limpios: int
    expedientes_observados: int
    expedientes_integridad_rota: int
    monto_total_auditado: float
    monto_en_riesgo_preventivo: float
    ahorro_preventivo_estimado: float
    total_alertas_xai: int
    alertas_pendientes: int
    alertas_validadas_oci: int
    alertas_en_descargo: int
    alertas_archivadas: int = 0
    porcentaje_limpios: float = 0.0
    distribucion_riesgo: dict
    alertas_por_categoria: List[dict]
    casos_destacados: List[ExpedienteListOut]


class AuditLogItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    timestamp: str
    usuario_codigo: str
    rol_usuario: str
    accion: str
    recurso: str
    resultado: str
    detalle: str
    ip_origen: str
    hash_anterior: str
    hash_actual: str
    es_integro: bool = True


class AuditLogResumenOut(BaseModel):
    cadena_integra: bool
    total_eventos: int
    total_permitidos: int
    total_bloqueados: int
    ultimo_hash: str
    evento_comprometido_id: Optional[int] = None
    mensaje_integridad: str
    eventos: List[AuditLogItemOut]


class DenunciaCreateInput(BaseModel):
    categoria: str
    area_involucrada: str = "Por determinar"
    expediente_codigo: Optional[str] = None
    descripcion_hechos: str
    solicita_proteccion: bool = True


class DenunciaGestionInput(BaseModel):
    estado: str  # EN_EVALUACION | DERIVADA | ATENDIDA | ARCHIVADA_MOTIVADA
    organo_derivado: str
    medida_proteccion: str
    fecha_limite_sla: Optional[str] = None
    respuesta_seguimiento: str
    nota_interna_oci: str


class DenunciaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    codigo_seguimiento: str
    hash_reserva: str
    categoria: str
    area_involucrada: str
    expediente_codigo: Optional[str] = None
    descripcion_hechos: str
    solicita_proteccion: bool
    medida_proteccion: str
    estado: str
    organo_derivado: str
    fecha_registro: str
    fecha_limite_sla: str
    ultima_actualizacion: str
    respuesta_seguimiento: str
    nota_interna_oci: Optional[str] = None
    gestionado_por: Optional[str] = None


class DenunciaConsultaPublicaOut(BaseModel):
    codigo_seguimiento: str
    hash_reserva: str
    categoria: str
    area_involucrada: str
    expediente_codigo: Optional[str] = None
    estado: str
    organo_derivado: str
    medida_proteccion: str
    fecha_registro: str
    fecha_limite_sla: str
    ultima_actualizacion: str
    respuesta_seguimiento: str


class DenunciaResumenPublicoOut(BaseModel):
    total_recibidas: int
    en_tramite: int
    derivadas: int
    atendidas_o_archivadas: int
    con_medida_proteccion: int
    por_categoria: List[dict]


class ResumenMuestrasValidacionOut(BaseModel):
    expedientes_sembrados: int
    compras_limpias: int
    alertas_indebidas_en_limpias: int
    casos_en_vivo: int
    pruebas_sha256: int
    total_pruebas: int
    pruebas_aprobadas: int


class TotalesMatrizValidacionOut(BaseModel):
    TP: int
    FP: int
    FN: int
    TN: int


class MetricasReglaValidacionOut(BaseModel):
    TP: int
    FP: int
    FN: int
    TN: int
    precision: Optional[float] = None
    recall: Optional[float] = None
    f1: Optional[float] = None
    fpr: Optional[float] = None


class CasoVivoValidacionOut(BaseModel):
    caso: str
    esperado: List[str]
    detectado: List[str]


class LatenciaValidacionOut(BaseModel):
    n: int
    p50: float
    p95: float
    max: float


class VerificacionRbacItemOut(BaseModel):
    verificacion: str
    esperado: int
    obtenido: int


class PruebaEjecutadaItemOut(BaseModel):
    nombre: str
    estado: str


class ReporteValidacionOut(BaseModel):
    generado: str
    comando: str
    resumen_muestras: ResumenMuestrasValidacionOut
    totales: TotalesMatrizValidacionOut
    matriz_por_regla: Dict[str, MetricasReglaValidacionOut]
    casos_en_vivo: List[CasoVivoValidacionOut]
    latencias_ms: Dict[str, LatenciaValidacionOut]
    rbac: List[VerificacionRbacItemOut]
    pruebas_ejecutadas: List[PruebaEjecutadaItemOut]
