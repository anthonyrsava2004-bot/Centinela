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


class Actuacion(Base):
    __tablename__ = "actuaciones"

    id = Column(Integer, primary_key=True, index=True)
    expediente_id = Column(Integer, ForeignKey("expedientes.id", ondelete="CASCADE"), nullable=False, index=True)
    orden = Column(Integer, nullable=False)
    etapa = Column(String(40), nullable=False)
    usuario_rol = Column(String(50), nullable=False)
    timestamp = Column(String(35), nullable=False)
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
    comentario_descargo = Column(Text, nullable=True)
    rol_ultimo_cambio = Column(String(60), nullable=True)
    fecha_actualizacion = Column(String(35), nullable=True)

    expediente = relationship("Expediente", back_populates="alertas")
