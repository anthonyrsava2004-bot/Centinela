from collections import Counter, defaultdict
from contextlib import asynccontextmanager
import csv
from datetime import datetime
import io
from typing import List, Optional
from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from sqlalchemy import inspect
from sqlalchemy.orm import Session

from .audit_log import (
    extraer_actor_request,
    inicializar_bitacora_si_vacia,
    registrar_evento_auditoria,
    resolver_usuario_codigo,
    verificar_y_listar_auditoria,
)
from .crypto_audit import (
    restaurar_integridad_expediente,
    simular_alteracion_ex_post,
    verificar_cadena_expediente,
)
from .database import Base, SessionLocal, engine, get_db
from .graph_engine import construir_grafo_colusion
from .models import AlertaGestion, AuditLog, Expediente, HistorialAlerta, Postulacion, Proveedor
from .nlp_tdr import analizar_similitud_tdr
from .pdf_report import generar_pdf_expediente, generar_pdf_reporte_institucional
from .rules_engine import evaluar_expediente_individual
from .schemas import (
    AlertaGestionOut,
    AlertaUpdateInput,
    AuditLogResumenOut,
    DashboardKPIsOut,
    ExpedienteCreateInput,
    ExpedienteDetalleOut,
    ExpedienteListOut,
    HistorialAlertaOut,
    PostulacionDetalleOut,
    ProveedorOut,
    TamperSimulationRequest,
    VerificacionCadenaOut,
)
from .seed_synthetic import crear_actuaciones_secuenciales, poblar_base_datos_sintetica


def _asegurar_esquema_actualizado():
    """
    Verifica si las tablas sintéticas cuentan con todas las columnas vigentes del modelo
    (ej. version_doc, area_asignada, historial_alertas). Si detecta una BD local de una
    versión anterior, recrea el esquema limpiamente para regenerar el dataset sintético.
    """
    inspector = inspect(engine)
    tablas = set(inspector.get_table_names())
    esquema_desactualizado = False

    if "actuaciones" in tablas:
        cols_act = {c["name"] for c in inspector.get_columns("actuaciones")}
        if "version_doc" not in cols_act or "tiene_sustento" not in cols_act:
            esquema_desactualizado = True

    if "alertas_gestion" in tablas:
        cols_al = {c["name"] for c in inspector.get_columns("alertas_gestion")}
        if "area_asignada" not in cols_al or "accion_correctiva" not in cols_al:
            esquema_desactualizado = True

    if tablas and "historial_alertas" not in tablas:
        esquema_desactualizado = True

    if esquema_desactualizado:
        Base.metadata.drop_all(bind=engine)

    Base.metadata.create_all(bind=engine)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Inicializa esquemas en PostgreSQL / SQLite y ejecuta el seed automático de los
    120 expedientes sintéticos si la base de datos se encuentra vacía o recién migrada.
    """
    _asegurar_esquema_actualizado()
    db = SessionLocal()
    try:
        total = db.query(Expediente).count()
        if total == 0:
            poblar_base_datos_sintetica(db)
        inicializar_bitacora_si_vacia(db)
    finally:
        db.close()
    yield


app = FastAPI(
    title="CENTINELA API — Auditoría Preventiva, Trazabilidad Forense y XAI",
    description=(
        "Plataforma de integridad institucional y detección explicable de riesgos en contrataciones "
        "públicas bajo la Ley N° 32069 y la Ley N° 29733 (Hackathon Innova Norte 3G - UNT)."
    ),
    version="1.1.0",
    lifespan=lifespan,
)

# Configuración CORS abierta para desarrollo local y despliegue en Render
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _es_auditor_oci(rol: str) -> bool:
    return rol.strip().startswith("Auditor OCI")


def _es_solo_lectura(rol: str) -> bool:
    r = rol.strip().lower()
    return "transparencia" in r or "solo lectura" in r or "consulta" in r


def _serializar_alerta(
    a: AlertaGestion,
    exp: Optional[Expediente],
    historial_items: List[HistorialAlerta],
) -> AlertaGestionOut:
    return AlertaGestionOut(
        id=a.id,
        expediente_id=a.expediente_id,
        expediente_codigo=exp.codigo if exp else f"EXP-{a.expediente_id}",
        expediente_objeto=exp.objeto if exp else "",
        expediente_monto=exp.monto_estimado if exp else 0.0,
        area_usuaria=exp.area_usuaria if exp else "",
        codigo_regla=a.codigo_regla,
        categoria=a.categoria,
        titulo=a.titulo,
        severidad=a.severidad,
        regla_activada=a.regla_activada,
        evidencia_exacta=a.evidencia_exacta,
        base_normativa=a.base_normativa,
        estado_revision=a.estado_revision,
        area_asignada=a.area_asignada,
        accion_correctiva=a.accion_correctiva,
        fecha_limite=a.fecha_limite,
        comentario_descargo=a.comentario_descargo,
        rol_ultimo_cambio=a.rol_ultimo_cambio,
        fecha_actualizacion=a.fecha_actualizacion,
        historial=[HistorialAlertaOut.model_validate(h) for h in historial_items],
    )


def _construir_detalle_expediente(db: Session, exp: Expediente) -> ExpedienteDetalleOut:
    verificacion = verificar_cadena_expediente(db, exp)
    nlp_res = analizar_similitud_tdr(db, exp)

    postulaciones_db = (
        db.query(Postulacion).filter(Postulacion.expediente_id == exp.id).all()
    )
    prov_map = {p.id: p for p in db.query(Proveedor).all()}

    postulaciones_out = []
    for post in postulaciones_db:
        pr = prov_map.get(post.proveedor_id)
        if pr:
            postulaciones_out.append(
                PostulacionDetalleOut(
                    id=post.id,
                    proveedor_id=pr.id,
                    proveedor_codigo=pr.codigo,
                    proveedor_alias=pr.alias_comercial,
                    representante_id=pr.representante_id,
                    direccion_hash=pr.direccion_hash,
                    telefono_hash=pr.telefono_hash,
                    monto_ofertado=post.monto_ofertado,
                    es_ganador=post.es_ganador,
                    fecha_presentacion=post.fecha_presentacion,
                )
            )

    alertas_db = (
        db.query(AlertaGestion)
        .filter(AlertaGestion.expediente_id == exp.id)
        .order_by(AlertaGestion.id.asc())
        .all()
    )
    alerta_ids = [a.id for a in alertas_db]
    hist_por_alerta: dict[int, List[HistorialAlerta]] = defaultdict(list)
    if alerta_ids:
        for h in (
            db.query(HistorialAlerta)
            .filter(HistorialAlerta.alerta_id.in_(alerta_ids))
            .order_by(HistorialAlerta.id.asc())
            .all()
        ):
            hist_por_alerta[h.alerta_id].append(h)

    alertas_out = [
        _serializar_alerta(a, exp, hist_por_alerta.get(a.id, []))
        for a in alertas_db
    ]

    return ExpedienteDetalleOut(
        id=exp.id,
        codigo=exp.codigo,
        objeto=exp.objeto,
        rubro=exp.rubro,
        area_usuaria=exp.area_usuaria,
        modalidad=exp.modalidad,
        monto_estimado=exp.monto_estimado,
        fecha_creacion=exp.fecha_creacion,
        estado_expediente=exp.estado_expediente,
        tdr_texto=exp.tdr_texto,
        proveedor_adjudicado_codigo=exp.proveedor_adjudicado_codigo,
        nivel_riesgo=exp.nivel_riesgo,
        puntaje_riesgo=exp.puntaje_riesgo,
        integridad_valida=exp.integridad_valida,
        es_caso_trampa=exp.es_caso_trampa,
        tipo_trampa=exp.tipo_trampa,
        verificacion_sha256=verificacion,
        postulaciones=postulaciones_out,
        alertas=alertas_out,
        analisis_nlp=nlp_res,
    )


@app.get("/")
def health_check():
    return {
        "sistema": "CENTINELA",
        "version": "1.1.0",
        "estado": "OPERATIVO",
        "arquitectura": "Capa de Observabilidad Externa No Intrusiva (No reemplaza SEACE/SIGA/SIAF)",
        "marco_normativo": [
            "Ley N° 32069",
            "D.S. N° 009-2025-EF",
            "Ley N° 29733",
            "Ley N° 27806",
            "Ley N° 27815",
            "Ley N° 27785",
            "Ley N° 27444",
        ],
        "modulos_activos": [
            "Cadena Criptográfica SHA-256 con Control de Versiones",
            "Motor XAI Sin Caja Negra (7 Reglas Normativas Reales)",
            "Grafos de Colusión NetworkX + Cytoscape",
            "Detector Semántico TDR (TF-IDF + Coseno Local)",
            "Panel Compliance Human-in-the-Loop con RBAC y Bitácora",
            "Evaluador de Expedientes Sintéticos en Vivo",
            "Reportes Forenses Individuales y Agregados (PDF + CSV)",
        ],
    }


@app.post("/api/seed/regenerar")
def regenerar_dataset_sintetico(request: Request, db: Session = Depends(get_db)):
    """
    Regenera determinísticamente los 120 expedientes sintéticos (111 limpios + 9 casos forenses)
    y restaura el estado base para demostraciones en vivo. Preserva la bitácora global inmutable.
    """
    usuario, rol, ip_origen = extraer_actor_request(request)
    if not _es_auditor_oci(rol):
        registrar_evento_auditoria(
            db=db,
            usuario_codigo=usuario,
            rol_usuario=rol,
            accion="ACCESO_DENEGADO_RBAC",
            recurso="DATASET-BASE-120",
            resultado="BLOQUEADO_403",
            detalle=f"Intento no autorizado de reiniciar el dataset sintético base desde el rol '{rol}'.",
            ip_origen=ip_origen,
        )
        raise HTTPException(
            status_code=403,
            detail="Acceso denegado (RBAC): Solo el Auditor OCI puede restaurar el dataset base.",
        )

    res = poblar_base_datos_sintetica(db)
    registrar_evento_auditoria(
        db=db,
        usuario_codigo=usuario,
        rol_usuario=rol,
        accion="REINICIO_DATASET",
        recurso="DATASET-BASE-120",
        resultado="PERMITIDO",
        detalle="Restauración controlada del dataset sintético base (111 limpios + 9 casos forenses).",
        ip_origen=ip_origen,
    )
    return res


@app.get("/api/proveedores", response_model=List[ProveedorOut])
def listar_proveedores(db: Session = Depends(get_db)):
    """Retorna el padrón de proveedores sintéticos anonimizados (Ley N° 29733)."""
    return db.query(Proveedor).order_by(Proveedor.codigo.asc()).all()


@app.get("/api/dashboard", response_model=DashboardKPIsOut)
def obtener_kpis_dashboard(db: Session = Depends(get_db)):
    expedientes = db.query(Expediente).order_by(Expediente.id.asc()).all()
    alertas = db.query(AlertaGestion).all()

    conteo_alertas_exp = Counter(a.expediente_id for a in alertas)

    total_exp = len(expedientes)
    exp_limpios = sum(1 for e in expedientes if e.nivel_riesgo == "LIMPIO" and e.integridad_valida)
    exp_observados = total_exp - exp_limpios
    exp_rotos = sum(1 for e in expedientes if not e.integridad_valida)
    pct_limpios = round((exp_limpios / max(1, total_exp)) * 100.0, 1)

    monto_total = round(sum(e.monto_estimado for e in expedientes), 2)
    monto_riesgo = round(
        sum(e.monto_estimado for e in expedientes if e.nivel_riesgo != "LIMPIO" or not e.integridad_valida),
        2,
    )
    # Estimación conservadora de ahorro preventivo institucional (18.5% sobre procesos intervenidos a tiempo)
    ahorro_preventivo = round(monto_riesgo * 0.185, 2)

    dist_riesgo = {
        "ALTO": sum(1 for e in expedientes if e.nivel_riesgo == "ALTO"),
        "MEDIO": sum(1 for e in expedientes if e.nivel_riesgo == "MEDIO"),
        "LIMPIO": sum(1 for e in expedientes if e.nivel_riesgo == "LIMPIO"),
    }

    cat_counter = Counter(a.categoria for a in alertas)
    alertas_por_cat = [
        {"categoria": cat, "cantidad": cant} for cat, cant in cat_counter.most_common()
    ]

    destacados = [
        ExpedienteListOut(
            id=e.id,
            codigo=e.codigo,
            objeto=e.objeto,
            rubro=e.rubro,
            area_usuaria=e.area_usuaria,
            modalidad=e.modalidad,
            monto_estimado=e.monto_estimado,
            fecha_creacion=e.fecha_creacion,
            estado_expediente=e.estado_expediente,
            proveedor_adjudicado_codigo=e.proveedor_adjudicado_codigo,
            nivel_riesgo=e.nivel_riesgo,
            puntaje_riesgo=e.puntaje_riesgo,
            integridad_valida=e.integridad_valida,
            es_caso_trampa=e.es_caso_trampa,
            tipo_trampa=e.tipo_trampa,
            total_alertas=conteo_alertas_exp.get(e.id, 0),
        )
        for e in expedientes
        if e.es_caso_trampa or e.nivel_riesgo != "LIMPIO" or not e.integridad_valida
    ][:20]

    return DashboardKPIsOut(
        total_expedientes=total_exp,
        expedientes_limpios=exp_limpios,
        expedientes_observados=exp_observados,
        expedientes_integridad_rota=exp_rotos,
        monto_total_auditado=monto_total,
        monto_en_riesgo_preventivo=monto_riesgo,
        ahorro_preventivo_estimado=ahorro_preventivo,
        total_alertas_xai=len(alertas),
        alertas_pendientes=sum(1 for a in alertas if a.estado_revision == "PENDIENTE"),
        alertas_validadas_oci=sum(1 for a in alertas if a.estado_revision == "VALIDADA_OCI"),
        alertas_en_descargo=sum(1 for a in alertas if a.estado_revision == "EN_DESCARGO"),
        alertas_archivadas=sum(1 for a in alertas if a.estado_revision == "ARCHIVADA_SUSTENTADA"),
        porcentaje_limpios=pct_limpios,
        distribucion_riesgo=dist_riesgo,
        alertas_por_categoria=alertas_por_cat,
        casos_destacados=destacados,
    )


@app.get("/api/expedientes", response_model=List[ExpedienteListOut])
def listar_expedientes(
    busqueda: Optional[str] = Query(None),
    nivel_riesgo: Optional[str] = Query(None),
    integridad: Optional[str] = Query(None),
    solo_trampas: bool = Query(False),
    db: Session = Depends(get_db),
):
    query = db.query(Expediente)

    if nivel_riesgo and nivel_riesgo != "TODOS":
        query = query.filter(Expediente.nivel_riesgo == nivel_riesgo)

    if integridad == "ROTA":
        query = query.filter(Expediente.integridad_valida.is_(False))
    elif integridad == "INTEGRA":
        query = query.filter(Expediente.integridad_valida.is_(True))

    if solo_trampas:
        query = query.filter(
            (Expediente.es_caso_trampa.is_(True))
            | (Expediente.nivel_riesgo != "LIMPIO")
            | (Expediente.integridad_valida.is_(False))
        )

    expedientes = query.order_by(Expediente.id.asc()).all()

    if busqueda:
        b_lower = busqueda.strip().lower()
        expedientes = [
            e
            for e in expedientes
            if b_lower in e.codigo.lower()
            or b_lower in e.objeto.lower()
            or b_lower in e.area_usuaria.lower()
            or b_lower in (e.proveedor_adjudicado_codigo or "").lower()
            or b_lower in e.modalidad.lower()
        ]

    alertas = db.query(AlertaGestion).all()
    conteo_alertas = Counter(a.expediente_id for a in alertas)

    return [
        ExpedienteListOut(
            id=e.id,
            codigo=e.codigo,
            objeto=e.objeto,
            rubro=e.rubro,
            area_usuaria=e.area_usuaria,
            modalidad=e.modalidad,
            monto_estimado=e.monto_estimado,
            fecha_creacion=e.fecha_creacion,
            estado_expediente=e.estado_expediente,
            proveedor_adjudicado_codigo=e.proveedor_adjudicado_codigo,
            nivel_riesgo=e.nivel_riesgo,
            puntaje_riesgo=e.puntaje_riesgo,
            integridad_valida=e.integridad_valida,
            es_caso_trampa=e.es_caso_trampa,
            tipo_trampa=e.tipo_trampa,
            total_alertas=conteo_alertas.get(e.id, 0),
        )
        for e in expedientes
    ]


@app.post("/api/expedientes/simular-registro", response_model=ExpedienteDetalleOut)
def registrar_y_auditar_expediente_vivo(
    payload: ExpedienteCreateInput,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Registra un nuevo expediente sintético en vivo, construye y sella su cadena SHA-256
    de 6 etapas y ejecuta en tiempo real el motor completo de reglas XAI, TF-IDF y grafos.
    """
    usuario, rol_req, ip_origen = extraer_actor_request(request, rol_fallback=payload.rol_usuario)
    rol_efectivo = payload.rol_usuario or rol_req
    usuario = resolver_usuario_codigo(rol_efectivo, request.headers.get("X-Centinela-User"))

    if _es_solo_lectura(rol_efectivo):
        registrar_evento_auditoria(
            db=db,
            usuario_codigo=usuario,
            rol_usuario=rol_efectivo,
            accion="ACCESO_DENEGADO_RBAC",
            recurso="NUEVO-EXPEDIENTE",
            resultado="BLOQUEADO_403",
            detalle=f"Intento bloqueado de registrar expediente '{payload.objeto[:80]}' desde perfil solo lectura.",
            ip_origen=ip_origen,
        )
        raise HTTPException(
            status_code=403,
            detail="Acceso denegado (RBAC): El rol de Consulta / Transparencia es de solo lectura.",
        )

    if payload.monto_estimado <= 0:
        raise HTTPException(status_code=400, detail="El monto estimado debe ser mayor a cero.")

    prov_ganador = (
        db.query(Proveedor)
        .filter(Proveedor.codigo == payload.proveedor_adjudicado_codigo)
        .first()
    )
    if not prov_ganador:
        raise HTTPException(
            status_code=400,
            detail=f"Proveedor adjudicado '{payload.proveedor_adjudicado_codigo}' no existe en el padrón sintético.",
        )

    total_actual = db.query(Expediente).count()
    correlativo = total_actual + 1
    codigo_exp = f"EXP-2025-UNT-{correlativo:04d}"
    while db.query(Expediente).filter(Expediente.codigo == codigo_exp).first():
        correlativo += 1
        codigo_exp = f"EXP-2025-UNT-{correlativo:04d}"

    fecha_iso = payload.fecha_creacion or datetime.utcnow().strftime("%Y-%m-%dT09:00:00")
    fecha_dia = fecha_iso[:10]

    exp = Expediente(
        codigo=codigo_exp,
        objeto=payload.objeto.strip(),
        rubro=payload.rubro.strip(),
        area_usuaria=payload.area_usuaria.strip(),
        modalidad=payload.modalidad.strip(),
        monto_estimado=round(payload.monto_estimado, 2),
        fecha_creacion=fecha_iso,
        estado_expediente="Pagado",
        tdr_texto=payload.tdr_texto.strip(),
        proveedor_adjudicado_codigo=prov_ganador.codigo,
        nivel_riesgo="LIMPIO",
        puntaje_riesgo=8,
        integridad_valida=True,
        es_caso_trampa=False,
        tipo_trampa=None,
    )
    db.add(exp)
    db.flush()

    codigos_postores = list(dict.fromkeys([prov_ganador.codigo] + list(payload.proveedores_postores)))
    postores_objs = (
        db.query(Proveedor).filter(Proveedor.codigo.in_(codigos_postores)).all()
    )
    if len(postores_objs) < 2:
        otro_prov = (
            db.query(Proveedor)
            .filter(Proveedor.codigo != prov_ganador.codigo, Proveedor.es_colusorio.is_(False))
            .first()
        )
        if otro_prov:
            postores_objs.append(otro_prov)

    etiqueta_postores = []
    for idx_p, p_obj in enumerate(postores_objs):
        es_gan = p_obj.codigo == prov_ganador.codigo
        monto_of = round(payload.monto_estimado * (1.0 if es_gan else 1.03 + idx_p * 0.015), 2)
        db.add(
            Postulacion(
                expediente_id=exp.id,
                proveedor_id=p_obj.id,
                monto_ofertado=monto_of,
                es_ganador=es_gan,
                fecha_presentacion=f"{fecha_dia}T13:30:00",
            )
        )
        etiqueta_postores.append(f"{p_obj.codigo} (S/ {monto_of:,.2f})")

    area_tag = payload.area_usuaria.split("-")[1] if "-" in payload.area_usuaria else "USU"
    rol_base_seg = "FUNC-LOG-01" if payload.mismo_funcionario_etapas else None

    etapas_data = [
        {
            "etapa": "Requerimiento",
            "usuario_rol": rol_base_seg or f"FUNC-{area_tag}-01",
            "timestamp": f"{fecha_dia}T09:00:00",
            "version_doc": "v1.0",
            "tiene_sustento": not payload.sin_sustento_documental,
            "documento_texto": (
                f"Requerimiento institucional SIGA {codigo_exp} formulado por {payload.area_usuaria} "
                f"para '{payload.objeto}'. Monto estimado: S/ {payload.monto_estimado:,.2f}."
            ),
        },
        {
            "etapa": "TDR",
            "usuario_rol": rol_base_seg or "FUNC-ESP-TEC-02",
            "timestamp": f"{fecha_dia}T15:40:00" if payload.modificacion_extemporanea_tdr else f"{fecha_dia}T11:30:00",
            "version_doc": "v2.1" if payload.modificacion_extemporanea_tdr else "v1.0",
            "tiene_sustento": not (payload.modificacion_extemporanea_tdr or payload.sin_sustento_documental),
            "documento_texto": (
                f"[MODIFICACIÓN EXTEMPORÁNEA v2.1 - SIN SUSTENTO TÉCNICO ADJUNTO]: {payload.tdr_texto}"
                if payload.modificacion_extemporanea_tdr
                else payload.tdr_texto
            ),
        },
        {
            "etapa": "Cotizaciones",
            "usuario_rol": "FUNC-LOG-01",
            "timestamp": f"{fecha_dia}T14:15:00",
            "version_doc": "v1.0",
            "tiene_sustento": True,
            "documento_texto": f"Indagación de mercado con postores: {', '.join(etiqueta_postores)}.",
        },
        {
            "etapa": "Buena Pro",
            "usuario_rol": rol_base_seg or "FUNC-COM-SEL-01",
            "timestamp": f"{fecha_dia}T16:45:00",
            "version_doc": "v1.0",
            "tiene_sustento": True,
            "documento_texto": (
                f"Acta de Otorgamiento de Buena Pro del proceso {codigo_exp} a favor de "
                f"{prov_ganador.codigo} por S/ {payload.monto_estimado:,.2f}."
            ),
        },
        {
            "etapa": "Conformidad",
            "usuario_rol": rol_base_seg or f"FUNC-{area_tag}-01",
            "timestamp": f"{fecha_dia}T19:40:00" if payload.pago_sin_conformidad else f"{fecha_dia}T18:20:00",
            "version_doc": "v1.0",
            "tiene_sustento": not payload.pago_sin_conformidad,
            "documento_texto": (
                "OBSERVADO - SIN ACTA DE RECEPCIÓN DEFINITIVA: Pendiente de verificación técnica por el área usuaria."
                if payload.pago_sin_conformidad
                else f"Acta de Conformidad Técnica favorable suscrita por {payload.area_usuaria}."
            ),
        },
        {
            "etapa": "Pago",
            "usuario_rol": "FUNC-TES-02",
            "timestamp": f"{fecha_dia}T17:50:00" if payload.pago_sin_conformidad else f"{fecha_dia}T19:30:00",
            "version_doc": "v1.0",
            "tiene_sustento": True,
            "documento_texto": (
                f"Comprobante de Pago SIAF girado a favor de {prov_ganador.codigo} "
                f"por S/ {payload.monto_estimado:,.2f}."
            ),
        },
    ]

    crear_actuaciones_secuenciales(db, exp, etapas_data)
    db.commit()

    # Evaluar en tiempo real con el motor XAI completo (sin hardcodes)
    alertas_generadas = evaluar_expediente_individual(db, exp)
    db.refresh(exp)

    codigos_al = ", ".join(a.codigo_regla for a in alertas_generadas) or "NINGUNA (LIMPIO)"
    registrar_evento_auditoria(
        db=db,
        usuario_codigo=usuario,
        rol_usuario=rol_efectivo,
        accion="REGISTRO_EXPEDIENTE",
        recurso=exp.codigo,
        resultado="PERMITIDO",
        detalle=(
            f"Registró expediente '{exp.objeto[:90]}' (S/ {exp.monto_estimado:,.2f}, {exp.area_usuaria}). "
            f"Señales XAI detectadas en vivo: {codigos_al}."
        ),
        ip_origen=ip_origen,
    )
    return _construir_detalle_expediente(db, exp)


@app.get("/api/expedientes/{expediente_id}", response_model=ExpedienteDetalleOut)
def obtener_detalle_expediente(expediente_id: int, db: Session = Depends(get_db)):
    exp = db.query(Expediente).filter(Expediente.id == expediente_id).first()
    if not exp:
        raise HTTPException(status_code=404, detail="Expediente no encontrado")
    return _construir_detalle_expediente(db, exp)


@app.post(
    "/api/expedientes/{expediente_id}/simular-alteracion",
    response_model=VerificacionCadenaOut,
)
def endpoint_simular_alteracion(
    expediente_id: int,
    request: Request,
    payload: Optional[TamperSimulationRequest] = None,
    db: Session = Depends(get_db),
):
    usuario, rol, ip_origen = extraer_actor_request(request)
    exp = db.query(Expediente).filter(Expediente.id == expediente_id).first()
    if not exp:
        raise HTTPException(status_code=404, detail="Expediente no encontrado")

    if not _es_auditor_oci(rol):
        registrar_evento_auditoria(
            db=db,
            usuario_codigo=usuario,
            rol_usuario=rol,
            accion="ACCESO_DENEGADO_RBAC",
            recurso=exp.codigo,
            resultado="BLOQUEADO_403",
            detalle=f"Intento no autorizado de ejecutar simulación de alteración SHA-256 desde rol '{rol}'.",
            ip_origen=ip_origen,
        )
        raise HTTPException(
            status_code=403,
            detail="Acceso denegado (RBAC): Solo el Auditor OCI puede ejecutar simulaciones forenses.",
        )

    etapa_obj = payload.etapa_objetivo if payload and payload.etapa_objetivo else "Cotizaciones"
    nuevo_txt = payload.nuevo_texto_alterado if payload else None
    res = simular_alteracion_ex_post(db, exp, etapa_objetivo=etapa_obj, nuevo_texto=nuevo_txt)
    registrar_evento_auditoria(
        db=db,
        usuario_codigo=usuario,
        rol_usuario=rol,
        accion="SIMULACION_ALTERACION",
        recurso=exp.codigo,
        resultado="PERMITIDO",
        detalle=f"Ejecutó prueba forense de alteración ex-post sobre etapa '{etapa_obj}' (ruptura SHA-256 verificada).",
        ip_origen=ip_origen,
    )
    return res


@app.post(
    "/api/expedientes/{expediente_id}/restaurar-integridad",
    response_model=VerificacionCadenaOut,
)
def endpoint_restaurar_integridad(
    expediente_id: int,
    request: Request,
    db: Session = Depends(get_db),
):
    usuario, rol, ip_origen = extraer_actor_request(request)
    exp = db.query(Expediente).filter(Expediente.id == expediente_id).first()
    if not exp:
        raise HTTPException(status_code=404, detail="Expediente no encontrado")

    if not _es_auditor_oci(rol):
        registrar_evento_auditoria(
            db=db,
            usuario_codigo=usuario,
            rol_usuario=rol,
            accion="ACCESO_DENEGADO_RBAC",
            recurso=exp.codigo,
            resultado="BLOQUEADO_403",
            detalle=f"Intento no autorizado de restaurar cadena SHA-256 desde rol '{rol}'.",
            ip_origen=ip_origen,
        )
        raise HTTPException(
            status_code=403,
            detail="Acceso denegado (RBAC): Solo el Auditor OCI puede restaurar la integridad tras una prueba forense.",
        )

    res = restaurar_integridad_expediente(db, exp)
    registrar_evento_auditoria(
        db=db,
        usuario_codigo=usuario,
        rol_usuario=rol,
        accion="RESTAURACION_INTEGRIDAD",
        recurso=exp.codigo,
        resultado="PERMITIDO",
        detalle=f"Restauró la cadena SHA-256 del expediente {exp.codigo} a su estado íntegro original.",
        ip_origen=ip_origen,
    )
    return res


@app.get("/api/expedientes/{expediente_id}/reporte-pdf")
def descargar_reporte_pdf(
    expediente_id: int,
    request: Request,
    db: Session = Depends(get_db),
):
    exp = db.query(Expediente).filter(Expediente.id == expediente_id).first()
    if not exp:
        raise HTTPException(status_code=404, detail="Expediente no encontrado")

    usuario, rol, ip_origen = extraer_actor_request(request)
    pdf_bytes = generar_pdf_expediente(db, exp)
    registrar_evento_auditoria(
        db=db,
        usuario_codigo=usuario,
        rol_usuario=rol,
        accion="EXPORTACION_PDF_EXPEDIENTE",
        recurso=exp.codigo,
        resultado="PERMITIDO",
        detalle=f"Descargó Reporte Forense Oficial PDF del expediente {exp.codigo}.",
        ip_origen=ip_origen,
    )
    filename = f"Reporte_Forense_{exp.codigo}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.get("/api/reportes/institucional-pdf")
def descargar_reporte_institucional_pdf(request: Request, db: Session = Depends(get_db)):
    """Descarga el reporte agregado de indicadores de integridad y transparencia en PDF."""
    usuario, rol, ip_origen = extraer_actor_request(request)
    pdf_bytes = generar_pdf_reporte_institucional(db)
    registrar_evento_auditoria(
        db=db,
        usuario_codigo=usuario,
        rol_usuario=rol,
        accion="EXPORTACION_REPORTE_INSTITUCIONAL",
        recurso="REPORTE-AGREGADO-PDF",
        resultado="PERMITIDO",
        detalle="Descargó Reporte Institucional Agregado de Integridad y Transparencia (PDF).",
        ip_origen=ip_origen,
    )
    filename = f"Reporte_Institucional_CENTINELA_{datetime.utcnow().strftime('%Y%m%d')}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.get("/api/reportes/indicadores-csv")
def descargar_indicadores_csv(request: Request, db: Session = Depends(get_db)):
    """Exporta indicadores agregados y padrón anonimizado en CSV (Ley N° 27806 y Ley N° 29733)."""
    usuario, rol, ip_origen = extraer_actor_request(request)
    expedientes = db.query(Expediente).order_by(Expediente.id.asc()).all()
    alertas = db.query(AlertaGestion).all()
    conteo_alertas = Counter(a.expediente_id for a in alertas)

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(
        [
            "codigo_expediente",
            "area_usuaria_anonimizada",
            "rubro",
            "modalidad",
            "monto_estimado_pen",
            "proveedor_adjudicado_codigo",
            "fecha_creacion",
            "estado_expediente",
            "integridad_sha256",
            "nivel_riesgo_xai",
            "puntaje_riesgo",
            "total_alertas_xai",
            "tipologia_senal",
        ]
    )
    for e in expedientes:
        writer.writerow(
            [
                e.codigo,
                e.area_usuaria,
                e.rubro,
                e.modalidad,
                f"{e.monto_estimado:.2f}",
                e.proveedor_adjudicado_codigo or "",
                e.fecha_creacion,
                e.estado_expediente,
                "INTEGRA" if e.integridad_valida else "ROTA",
                e.nivel_riesgo,
                e.puntaje_riesgo,
                conteo_alertas.get(e.id, 0),
                e.tipo_trampa or "NINGUNA",
            ]
        )

    registrar_evento_auditoria(
        db=db,
        usuario_codigo=usuario,
        rol_usuario=rol,
        accion="EXPORTACION_DATOS_CSV",
        recurso="INDICADORES-TRANSPARENCIA-CSV",
        resultado="PERMITIDO",
        detalle=f"Exportó CSV anonimizado de transparencia con {len(expedientes)} expedientes.",
        ip_origen=ip_origen,
    )
    csv_bytes = output.getvalue().encode("utf-8-sig")
    filename = f"Indicadores_Transparencia_CENTINELA_{datetime.utcnow().strftime('%Y%m%d')}.csv"
    return Response(
        content=csv_bytes,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.get("/api/grafo-colusion")
def obtener_grafo_colusion(
    solo_riesgo: bool = Query(True),
    db: Session = Depends(get_db),
):
    return construir_grafo_colusion(db, solo_riesgo=solo_riesgo)


@app.get("/api/alertas", response_model=List[AlertaGestionOut])
def listar_alertas_xai(
    estado_revision: Optional[str] = Query(None),
    categoria: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(AlertaGestion)
    if estado_revision and estado_revision != "TODOS":
        query = query.filter(AlertaGestion.estado_revision == estado_revision)
    if categoria and categoria != "TODAS":
        query = query.filter(AlertaGestion.categoria == categoria)

    alertas = query.order_by(AlertaGestion.id.asc()).all()
    exp_map = {e.id: e for e in db.query(Expediente).all()}

    hist_map: dict[int, List[HistorialAlerta]] = defaultdict(list)
    for h in db.query(HistorialAlerta).order_by(HistorialAlerta.id.asc()).all():
        hist_map[h.alerta_id].append(h)

    return [
        _serializar_alerta(a, exp_map.get(a.expediente_id), hist_map.get(a.id, []))
        for a in alertas
    ]


@app.patch("/api/alertas/{alerta_id}", response_model=AlertaGestionOut)
@app.put("/api/alertas/{alerta_id}", response_model=AlertaGestionOut)
def actualizar_alerta_xai(
    alerta_id: int,
    payload: AlertaUpdateInput,
    request: Request,
    db: Session = Depends(get_db),
):
    _, _, ip_origen = extraer_actor_request(request, rol_fallback=payload.rol_usuario)
    rol_efectivo = payload.rol_usuario
    usuario_codigo = resolver_usuario_codigo(rol_efectivo, request.headers.get("X-Centinela-User"))

    alerta = db.query(AlertaGestion).filter(AlertaGestion.id == alerta_id).first()
    exp_ref = (
        db.query(Expediente).filter(Expediente.id == alerta.expediente_id).first()
        if alerta
        else None
    )
    recurso_lbl = f"{exp_ref.codigo} / ALERTA-#{alerta_id}" if exp_ref else f"ALERTA-#{alerta_id}"

    if _es_solo_lectura(rol_efectivo):
        registrar_evento_auditoria(
            db=db,
            usuario_codigo=usuario_codigo,
            rol_usuario=rol_efectivo,
            accion="ACCESO_DENEGADO_RBAC",
            recurso=recurso_lbl,
            resultado="BLOQUEADO_403",
            detalle=(
                f"Intento bloqueado de modificar estado de alerta a '{payload.estado_revision}' "
                f"desde perfil Solo Lectura."
            ),
            ip_origen=ip_origen,
        )
        raise HTTPException(
            status_code=403,
            detail=(
                "Acceso denegado (Control de Roles): El rol 'Consulta Transparencia (Solo Lectura)' "
                "no cuenta con permisos para modificar estados, derivar alertas ni emitir dictámenes."
            ),
        )

    es_oci = _es_auditor_oci(rol_efectivo)
    estados_permitidos_dec = {"EN_DESCARGO"}
    estados_validos = {"PENDIENTE", "EN_DESCARGO", "VALIDADA_OCI", "ARCHIVADA_SUSTENTADA"}

    if payload.estado_revision not in estados_validos:
        raise HTTPException(status_code=400, detail="Estado de revisión no válido.")

    if not es_oci and payload.estado_revision not in estados_permitidos_dec:
        registrar_evento_auditoria(
            db=db,
            usuario_codigo=usuario_codigo,
            rol_usuario=rol_efectivo,
            accion="ACCESO_DENEGADO_RBAC",
            recurso=recurso_lbl,
            resultado="BLOQUEADO_403",
            detalle=(
                f"Intento no autorizado de '{usuario_codigo}' ({rol_efectivo}) para cambiar alerta "
                f"a '{payload.estado_revision}' (competencia exclusiva de Auditor OCI)."
            ),
            ip_origen=ip_origen,
        )
        raise HTTPException(
            status_code=403,
            detail=(
                "Separación de competencias (Ley N° 32069 / Ley N° 27785): El rol Especialista Logística (DEC) "
                "solo puede registrar descargos técnicos y acciones correctivas ('EN_DESCARGO'). "
                "La validación o archivo definitivo corresponde exclusivamente al Auditor OCI."
            ),
        )

    if not alerta:
        raise HTTPException(status_code=404, detail="Señal de alerta no encontrada")

    estado_anterior = alerta.estado_revision
    ahora_iso = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S")
    firma_actor = f"{usuario_codigo} ({rol_efectivo})"

    alerta.estado_revision = payload.estado_revision
    alerta.comentario_descargo = payload.comentario_descargo.strip()
    if payload.area_asignada and es_oci:
        alerta.area_asignada = payload.area_asignada.strip()
    if payload.fecha_limite and es_oci:
        alerta.fecha_limite = payload.fecha_limite.strip()
    if payload.accion_correctiva is not None and payload.accion_correctiva.strip():
        alerta.accion_correctiva = payload.accion_correctiva.strip()

    alerta.rol_ultimo_cambio = firma_actor
    alerta.fecha_actualizacion = ahora_iso

    registro_historial = HistorialAlerta(
        alerta_id=alerta.id,
        estado_anterior=estado_anterior,
        estado_nuevo=alerta.estado_revision,
        area_asignada=alerta.area_asignada,
        comentario=alerta.comentario_descargo,
        accion_correctiva=alerta.accion_correctiva,
        rol_usuario=firma_actor,
        timestamp=ahora_iso,
    )
    db.add(registro_historial)
    db.commit()
    db.refresh(alerta)

    registrar_evento_auditoria(
        db=db,
        usuario_codigo=usuario_codigo,
        rol_usuario=rol_efectivo,
        accion="REVISION_ALERTA",
        recurso=recurso_lbl,
        resultado="PERMITIDO",
        detalle=(
            f"Cambió estado de alerta {alerta.codigo_regla} ({estado_anterior} → {alerta.estado_revision}); "
            f"área asignada: '{alerta.area_asignada}'."
        ),
        ip_origen=ip_origen,
    )

    historial_items = (
        db.query(HistorialAlerta)
        .filter(HistorialAlerta.alerta_id == alerta.id)
        .order_by(HistorialAlerta.id.asc())
        .all()
    )
    return _serializar_alerta(alerta, exp_ref, historial_items)


@app.get("/api/auditoria", response_model=AuditLogResumenOut)
def obtener_bitacora_auditoria(
    request: Request,
    resultado: Optional[str] = Query(None),
    accion: Optional[str] = Query(None),
    busqueda: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """
    Bitácora global inmutable encadenada con SHA-256 (acceso exclusivo Auditor OCI).
    Verifica la cadena de eventos en tiempo real y expone quién hizo qué y cuándo.
    """
    usuario, rol, ip_origen = extraer_actor_request(request)
    if not _es_auditor_oci(rol):
        registrar_evento_auditoria(
            db=db,
            usuario_codigo=usuario,
            rol_usuario=rol,
            accion="ACCESO_DENEGADO_RBAC",
            recurso="BITACORA-AUDITORIA-GLOBAL",
            resultado="BLOQUEADO_403",
            detalle=f"Intento no autorizado de consultar la bitácora global de auditoría desde '{rol}'.",
            ip_origen=ip_origen,
        )
        raise HTTPException(
            status_code=403,
            detail="Acceso denegado (RBAC): La Bitácora Global de Auditoría es de acceso exclusivo para el Auditor OCI.",
        )

    return verificar_y_listar_auditoria(
        db=db,
        resultado=resultado,
        accion=accion,
        busqueda=busqueda,
    )


@app.get("/api/auditoria/csv")
def exportar_bitacora_auditoria_csv(request: Request, db: Session = Depends(get_db)):
    """Exporta la bitácora global de auditoría encadenada SHA-256 en formato CSV (solo OCI)."""
    usuario, rol, ip_origen = extraer_actor_request(request)
    if not _es_auditor_oci(rol):
        registrar_evento_auditoria(
            db=db,
            usuario_codigo=usuario,
            rol_usuario=rol,
            accion="ACCESO_DENEGADO_RBAC",
            recurso="BITACORA-AUDITORIA-CSV",
            resultado="BLOQUEADO_403",
            detalle=f"Intento no autorizado de exportar la bitácora de auditoría desde '{rol}'.",
            ip_origen=ip_origen,
        )
        raise HTTPException(
            status_code=403,
            detail="Acceso denegado (RBAC): Solo el Auditor OCI puede exportar la bitácora global.",
        )

    resumen = verificar_y_listar_auditoria(db=db, limit=1000)
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(
        [
            "id",
            "timestamp_utc",
            "usuario_codigo",
            "rol_usuario",
            "accion",
            "recurso",
            "resultado",
            "ip_origen",
            "detalle",
            "es_integro_sha256",
            "hash_anterior",
            "hash_actual",
        ]
    )
    for ev in resumen["eventos"]:
        writer.writerow(
            [
                ev["id"],
                ev["timestamp"],
                ev["usuario_codigo"],
                ev["rol_usuario"],
                ev["accion"],
                ev["recurso"],
                ev["resultado"],
                ev["ip_origen"],
                ev["detalle"],
                "INTEGRO" if ev["es_integro"] else "ALTERADO",
                ev["hash_anterior"],
                ev["hash_actual"],
            ]
        )

    registrar_evento_auditoria(
        db=db,
        usuario_codigo=usuario,
        rol_usuario=rol,
        accion="EXPORTACION_BITACORA_CSV",
        recurso="BITACORA-AUDITORIA-CSV",
        resultado="PERMITIDO",
        detalle=f"Exportó evidencia de bitácora global ({resumen['total_eventos']} eventos encadenados SHA-256).",
        ip_origen=ip_origen,
    )
    csv_bytes = output.getvalue().encode("utf-8-sig")
    filename = f"Bitacora_Auditoria_CENTINELA_{datetime.utcnow().strftime('%Y%m%d')}.csv"
    return Response(
        content=csv_bytes,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
