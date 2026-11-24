from typing import List, Optional
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
