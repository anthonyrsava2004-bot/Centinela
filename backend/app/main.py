from collections import Counter
from contextlib import asynccontextmanager
from datetime import datetime
from typing import List, Optional
from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from sqlalchemy.orm import Session

from .crypto_audit import (
    restaurar_integridad_expediente,
    simular_alteracion_ex_post,
    verificar_cadena_expediente,
)
from .database import Base, SessionLocal, engine, get_db
from .graph_engine import construir_grafo_colusion
from .models import AlertaGestion, Expediente, Postulacion, Proveedor
from .nlp_tdr import analizar_similitud_tdr
from .pdf_report import generar_pdf_expediente
from .schemas import (
    AlertaGestionOut,
    AlertaUpdateInput,
    DashboardKPIsOut,
    ExpedienteDetalleOut,
    ExpedienteListOut,
    PostulacionDetalleOut,
    TamperSimulationRequest,
    VerificacionCadenaOut,
)
from .seed_synthetic import poblar_base_datos_sintetica


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Inicializa esquemas en PostgreSQL y ejecuta el seed automático de los 120 expedientes
    sintéticos si la base de datos se encuentra vacía.
    """
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        total = db.query(Expediente).count()
        if total == 0:
            poblar_base_datos_sintetica(db)
    finally:
        db.close()
    yield


app = FastAPI(
    title="CENTINELA API — Auditoría Preventiva, Trazabilidad Forense y XAI",
    description=(
        "Plataforma de integridad institucional y detección explicable de riesgos en contrataciones "
        "públicas bajo la Ley N° 32069 y la Ley N° 29733 (Hackathon Innova Norte 3G - UNT)."
    ),
    version="1.0.0",
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


@app.get("/")
def health_check():
    return {
        "sistema": "CENTINELA",
        "estado": "OPERATIVO",
        "marco_normativo": ["Ley N° 32069", "D.S. N° 009-2025-EF", "Ley N° 29733", "Ley N° 27815", "Ley N° 27444"],
        "modulos_activos": [
            "Cadena Criptográfica SHA-256",
            "Motor XAI Sin Caja Negra",
            "Grafos de Colusión NetworkX",
            "Detector Semántico TDR (TF-IDF + Coseno)",
            "Generador PDF Forense ReportLab",
        ],
    }


@app.post("/api/seed/regenerar")
def regenerar_dataset_sintetico(db: Session = Depends(get_db)):
    """
    Regenera determinísticamente los 120 expedientes sintéticos (112 limpios + 8 casos trampa)
    y restaura el estado base para demostraciones en vivo.
    """
    return poblar_base_datos_sintetica(db)


@app.get("/api/dashboard", response_model=DashboardKPIsOut)
def obtener_kpis_dashboard(db: Session = Depends(get_db)):
    expedientes = db.query(Expediente).order_by(Expediente.id.asc()).all()
    alertas = db.query(AlertaGestion).all()

    conteo_alertas_exp = Counter(a.expediente_id for a in alertas)

    total_exp = len(expedientes)
    exp_limpios = sum(1 for e in expedientes if e.nivel_riesgo == "LIMPIO" and e.integridad_valida)
    exp_observados = total_exp - exp_limpios
    exp_rotos = sum(1 for e in expedientes if not e.integridad_valida)

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
        {"categoria": cat, "cantidad": cant} for cat, cant in cat_counter.items()
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
        if e.es_caso_trampa or not e.integridad_valida
    ][:10]

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
        query = query.filter(Expediente.es_caso_trampa.is_(True))

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


@app.get("/api/expedientes/{expediente_id}", response_model=ExpedienteDetalleOut)
def obtener_detalle_expediente(expediente_id: int, db: Session = Depends(get_db)):
    exp = db.query(Expediente).filter(Expediente.id == expediente_id).first()
    if not exp:
        raise HTTPException(status_code=404, detail="Expediente no encontrado")

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
    alertas_out = [
        AlertaGestionOut(
            id=a.id,
            expediente_id=a.expediente_id,
            expediente_codigo=exp.codigo,
            expediente_objeto=exp.objeto,
            expediente_monto=exp.monto_estimado,
            area_usuaria=exp.area_usuaria,
            codigo_regla=a.codigo_regla,
            categoria=a.categoria,
            titulo=a.titulo,
            severidad=a.severidad,
            regla_activada=a.regla_activada,
            evidencia_exacta=a.evidencia_exacta,
            base_normativa=a.base_normativa,
            estado_revision=a.estado_revision,
            comentario_descargo=a.comentario_descargo,
            rol_ultimo_cambio=a.rol_ultimo_cambio,
            fecha_actualizacion=a.fecha_actualizacion,
        )
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


@app.post(
    "/api/expedientes/{expediente_id}/simular-alteracion",
    response_model=VerificacionCadenaOut,
)
def endpoint_simular_alteracion(
    expediente_id: int,
    payload: Optional[TamperSimulationRequest] = None,
    db: Session = Depends(get_db),
):
    exp = db.query(Expediente).filter(Expediente.id == expediente_id).first()
    if not exp:
        raise HTTPException(status_code=404, detail="Expediente no encontrado")

    etapa_obj = payload.etapa_objetivo if payload and payload.etapa_objetivo else "Cotizaciones"
    nuevo_txt = payload.nuevo_texto_alterado if payload else None
    return simular_alteracion_ex_post(db, exp, etapa_objetivo=etapa_obj, nuevo_texto=nuevo_txt)


@app.post(
    "/api/expedientes/{expediente_id}/restaurar-integridad",
    response_model=VerificacionCadenaOut,
)
def endpoint_restaurar_integridad(expediente_id: int, db: Session = Depends(get_db)):
    exp = db.query(Expediente).filter(Expediente.id == expediente_id).first()
    if not exp:
        raise HTTPException(status_code=404, detail="Expediente no encontrado")
    return restaurar_integridad_expediente(db, exp)


@app.get("/api/expedientes/{expediente_id}/reporte-pdf")
def descargar_reporte_pdf(expediente_id: int, db: Session = Depends(get_db)):
    exp = db.query(Expediente).filter(Expediente.id == expediente_id).first()
    if not exp:
        raise HTTPException(status_code=404, detail="Expediente no encontrado")

    pdf_bytes = generar_pdf_expediente(db, exp)
    filename = f"Reporte_Forense_{exp.codigo}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
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

    resultado = []
    for a in alertas:
        exp = exp_map.get(a.expediente_id)
        resultado.append(
            AlertaGestionOut(
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
                comentario_descargo=a.comentario_descargo,
                rol_ultimo_cambio=a.rol_ultimo_cambio,
                fecha_actualizacion=a.fecha_actualizacion,
            )
        )
    return resultado


@app.patch("/api/alertas/{alerta_id}", response_model=AlertaGestionOut)
@app.put("/api/alertas/{alerta_id}", response_model=AlertaGestionOut)
def actualizar_alerta_xai(
    alerta_id: int,
    payload: AlertaUpdateInput,
    db: Session = Depends(get_db),
):
    alerta = db.query(AlertaGestion).filter(AlertaGestion.id == alerta_id).first()
    if not alerta:
        raise HTTPException(status_code=404, detail="Señal de alerta no encontrada")

    alerta.estado_revision = payload.estado_revision
    alerta.comentario_descargo = payload.comentario_descargo
    alerta.rol_ultimo_cambio = payload.rol_usuario
    alerta.fecha_actualizacion = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S")

    db.commit()
    db.refresh(alerta)

    exp = db.query(Expediente).filter(Expediente.id == alerta.expediente_id).first()
    return AlertaGestionOut(
        id=alerta.id,
        expediente_id=alerta.expediente_id,
        expediente_codigo=exp.codigo if exp else "",
        expediente_objeto=exp.objeto if exp else "",
        expediente_monto=exp.monto_estimado if exp else 0.0,
        area_usuaria=exp.area_usuaria if exp else "",
        codigo_regla=alerta.codigo_regla,
        categoria=alerta.categoria,
        titulo=alerta.titulo,
        severidad=alerta.severidad,
        regla_activada=alerta.regla_activada,
        evidencia_exacta=alerta.evidencia_exacta,
        base_normativa=alerta.base_normativa,
        estado_revision=alerta.estado_revision,
        comentario_descargo=alerta.comentario_descargo,
        rol_ultimo_cambio=alerta.rol_ultimo_cambio,
        fecha_actualizacion=alerta.fecha_actualizacion,
    )
