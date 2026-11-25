from sqlalchemy import Boolean, Column, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from .database import Base


class Expediente(Base):
    __tablename__ = "expedientes"

    id = Column(Integer, primary_key=True, index=True)
    codigo = Column(String(40), unique=True, index=True, nullable=False)
    objeto = Column(String(300), nullable=False)
    rubro = Column(String(100), nullable=False)
    area_usuaria = Column(String(50), index=True, nullable=False)
    modalidad = Column(String(80), nullable=False)
    monto_estimado = Column(Float, nullable=False)
    fecha_creacion = Column(String(35), nullable=False)
    estado_expediente = Column(String(40), nullable=False, default="Pagado")
    tdr_texto = Column(Text, nullable=False)
    proveedor_adjudicado_codigo = Column(String(40), index=True, nullable=True)
    nivel_riesgo = Column(String(20), nullable=False, default="LIMPIO")
    puntaje_riesgo = Column(Integer, nullable=False, default=5)
    integridad_valida = Column(Boolean, nullable=False, default=True)
    es_caso_trampa = Column(Boolean, nullable=False, default=False)
    tipo_trampa = Column(String(80), nullable=True)

    actuaciones = relationship(
        "Actuacion",
        back_populates="expediente",
        cascade="all, delete-orphan",
        order_by="Actuacion.orden",
    )
    postulaciones = relationship(
        "Postulacion",
        back_populates="expediente",
        cascade="all, delete-orphan",
    )
    alertas = relationship(
        "AlertaGestion",
        back_populates="expediente",
        cascade="all, delete-orphan",
    )
    entregables_tdr = relationship(
        "EntregableTDR",
        back_populates="expediente",
        cascade="all, delete-orphan",
        order_by="EntregableTDR.orden",
    )
    conflictos_interes = relationship(
        "ConflictoInteres",
        back_populates="expediente",
        cascade="all, delete-orphan",
    )


class Actuacion(Base):
    __tablename__ = "actuaciones"

    id = Column(Integer, primary_key=True, index=True)
    expediente_id = Column(Integer, ForeignKey("expedientes.id", ondelete="CASCADE"), nullable=False, index=True)
    orden = Column(Integer, nullable=False)
    etapa = Column(String(40), nullable=False)
    usuario_rol = Column(String(50), nullable=False)
    timestamp = Column(String(35), nullable=False)
    version_doc = Column(String(20), nullable=False, default="v1.0")
    tiene_sustento = Column(Boolean, nullable=False, default=True)
    documento_texto = Column(Text, nullable=False)
    hash_anterior = Column(String(64), nullable=False)
    hash_actual = Column(String(64), nullable=False)

    expediente = relationship("Expediente", back_populates="actuaciones")


class Proveedor(Base):
    __tablename__ = "proveedores"

    id = Column(Integer, primary_key=True, index=True)
    codigo = Column(String(40), unique=True, index=True, nullable=False)
    alias_comercial = Column(String(120), nullable=False)
    rubro = Column(String(100), nullable=False)
    representante_id = Column(String(60), index=True, nullable=False)
    direccion_hash = Column(String(60), index=True, nullable=False)
    telefono_hash = Column(String(60), index=True, nullable=False)
    catalogo_texto = Column(Text, nullable=False)
    es_colusorio = Column(Boolean, nullable=False, default=False)

    postulaciones = relationship(
        "Postulacion",
        back_populates="proveedor",
        cascade="all, delete-orphan",
    )


class Postulacion(Base):
    __tablename__ = "postulaciones"

    id = Column(Integer, primary_key=True, index=True)
    expediente_id = Column(Integer, ForeignKey("expedientes.id", ondelete="CASCADE"), nullable=False, index=True)
    proveedor_id = Column(Integer, ForeignKey("proveedores.id", ondelete="CASCADE"), nullable=False, index=True)
    monto_ofertado = Column(Float, nullable=False)
    es_ganador = Column(Boolean, nullable=False, default=False)
    fecha_presentacion = Column(String(35), nullable=False)

    expediente = relationship("Expediente", back_populates="postulaciones")
    proveedor = relationship("Proveedor", back_populates="postulaciones")


class AlertaGestion(Base):
    __tablename__ = "alertas_gestion"

    id = Column(Integer, primary_key=True, index=True)
    expediente_id = Column(Integer, ForeignKey("expedientes.id", ondelete="CASCADE"), nullable=False, index=True)
    codigo_regla = Column(String(40), nullable=False)
    categoria = Column(String(80), nullable=False)
    titulo = Column(String(220), nullable=False)
    severidad = Column(String(20), nullable=False)
    regla_activada = Column(Text, nullable=False)
    evidencia_exacta = Column(Text, nullable=False)
    base_normativa = Column(Text, nullable=False)
    estado_revision = Column(String(40), nullable=False, default="PENDIENTE")
    area_asignada = Column(String(80), nullable=False, default="OCI — Órgano de Control Institucional")
    accion_correctiva = Column(Text, nullable=True)
    fecha_limite = Column(String(20), nullable=True)
    comentario_descargo = Column(Text, nullable=True)
    rol_ultimo_cambio = Column(String(60), nullable=True)
    fecha_actualizacion = Column(String(35), nullable=True)

    expediente = relationship("Expediente", back_populates="alertas")
    historial = relationship(
        "HistorialAlerta",
        back_populates="alerta",
        cascade="all, delete-orphan",
        order_by="HistorialAlerta.id.asc()",
    )


class HistorialAlerta(Base):
    __tablename__ = "historial_alertas"

    id = Column(Integer, primary_key=True, index=True)
    alerta_id = Column(Integer, ForeignKey("alertas_gestion.id", ondelete="CASCADE"), nullable=False, index=True)
    estado_anterior = Column(String(40), nullable=True)
    estado_nuevo = Column(String(40), nullable=False)
    area_asignada = Column(String(80), nullable=True)
    comentario = Column(Text, nullable=False)
    accion_correctiva = Column(Text, nullable=True)
    rol_usuario = Column(String(80), nullable=False)
    timestamp = Column(String(35), nullable=False)

    alerta = relationship("AlertaGestion", back_populates="historial")


class AuditLog(Base):
    """
    Bitácora global inmutable (append-only) encadenada con SHA-256.
    Registra quién (código funcional seudonimizado), bajo qué rol, qué acción ejecutó
    (o intentó ejecutar y fue bloqueada con 403), sobre qué recurso, cuándo y desde qué IP.
    """
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(String(35), nullable=False, index=True)
    usuario_codigo = Column(String(40), nullable=False, index=True)
    rol_usuario = Column(String(80), nullable=False)
    accion = Column(String(60), nullable=False, index=True)
    recurso = Column(String(120), nullable=False)
    resultado = Column(String(30), nullable=False, index=True)  # PERMITIDO | BLOQUEADO_403
    detalle = Column(Text, nullable=False)
    ip_origen = Column(String(60), nullable=False, default="127.0.0.1")
    hash_anterior = Column(String(64), nullable=False)
    hash_actual = Column(String(64), nullable=False)


class EntregableTDR(Base):
    """
    Entregables obligatorios definidos en los TDR de un expediente.
    Impide conformidades genéricas y bloquea preventivamente el desembolso en Tesorería
    cuando falta verificar un entregable o su sustento técnico/fotográfico (Caso 2 UNT).
    """
    __tablename__ = "entregables_tdr"

    id = Column(Integer, primary_key=True, index=True)
    expediente_id = Column(Integer, ForeignKey("expedientes.id", ondelete="CASCADE"), nullable=False, index=True)
    orden = Column(Integer, nullable=False)
    nombre = Column(String(220), nullable=False)
    obligatorio = Column(Boolean, nullable=False, default=True)
    cumplido = Column(Boolean, nullable=False, default=True)
    evidencia_tecnica = Column(Text, nullable=True)
    verificado_por = Column(String(60), nullable=True)
    fecha_verificacion = Column(String(35), nullable=True)

    expediente = relationship("Expediente", back_populates="entregables_tdr")


class ConflictoInteres(Base):
    """
    Registro preventivo de Conflictos de Interés (D.S. N° 148-2024-PCM, Ley N° 27815 y
    Resolución Rectoral N° 0490-2026/UNT). Soporta declaración oportuna, abstención
    y reasignación auditable de funcionario seudonimizado.
    """
    __tablename__ = "conflictos_interes"

    id = Column(Integer, primary_key=True, index=True)
    expediente_id = Column(Integer, ForeignKey("expedientes.id", ondelete="CASCADE"), nullable=False, index=True)
    funcionario_codigo = Column(String(50), nullable=False, index=True)
    proveedor_vinculado_codigo = Column(String(50), nullable=False)
    tipo_vinculo = Column(String(120), nullable=False)
    descripcion = Column(Text, nullable=False)
    estado = Column(String(40), nullable=False, default="DETECTADO")  # DETECTADO | DECLARADO_OPORTUNO | ABSTENIDO_Y_REASIGNADO
    funcionario_reasignado = Column(String(50), nullable=True)
    fecha_registro = Column(String(35), nullable=False)
    fecha_resolucion = Column(String(35), nullable=True)
    resuelto_por = Column(String(80), nullable=True)

    expediente = relationship("Expediente", back_populates="conflictos_interes")


class DenunciaReservada(Base):
    """
    Canal de Denuncia con Reserva de Identidad (Directiva N° 001-2026-PCM/SIP - Componente 7,
    D.S. N° 148-2024-PCM y D.L. N° 1327 Protección al Denunciante).
    No almacena DNI ni datos personales reales; usa código cifrado de seguimiento y hash SHA-256.
    """
    __tablename__ = "denuncias_reservadas"

    id = Column(Integer, primary_key=True, index=True)
    codigo_seguimiento = Column(String(40), unique=True, index=True, nullable=False)
    hash_reserva = Column(String(64), nullable=False)
    categoria = Column(String(120), nullable=False)
    area_involucrada = Column(String(80), nullable=False, default="Por determinar")
    expediente_codigo = Column(String(50), nullable=True)
    descripcion_hechos = Column(Text, nullable=False)
    solicita_proteccion = Column(Boolean, nullable=False, default=True)
    medida_proteccion = Column(
        String(140),
        nullable=False,
        default="Reserva de Identidad (D.L. N° 1327)",
    )
    estado = Column(String(40), nullable=False, default="RECIBIDA")  # RECIBIDA | EN_EVALUACION | DERIVADA | ATENDIDA | ARCHIVADA_MOTIVADA
    organo_derivado = Column(
        String(140),
        nullable=False,
        default="Oficina de Integridad — Evaluación de Admisibilidad",
    )
    fecha_registro = Column(String(35), nullable=False)
    fecha_limite_sla = Column(String(20), nullable=False)
    ultima_actualizacion = Column(String(35), nullable=False)
    respuesta_seguimiento = Column(Text, nullable=False)
    nota_interna_oci = Column(Text, nullable=True)
    gestionado_por = Column(String(80), nullable=True)
