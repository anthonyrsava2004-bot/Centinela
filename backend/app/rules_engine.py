from collections import defaultdict
from datetime import datetime, timedelta
from typing import Dict, List, Set
from sqlalchemy.orm import Session
from .models import Actuacion, AlertaGestion, Expediente, HistorialAlerta, Postulacion, Proveedor
from .nlp_tdr import UMBRAL_DIRECCIONAMIENTO, analizar_similitud_tdr

TOPE_8_UIT_PEN = 42800.0  # Referencia 8 UIT (UIT = S/ 5,350)


def _fecha_limite_sla(dias: int = 5) -> str:
    return (datetime.utcnow() + timedelta(days=dias)).strftime("%Y-%m-%d")


def _evaluar_reglas_expediente(
    db: Session,
    exp: Expediente,
    actuaciones: List[Actuacion],
    postulaciones: List[Postulacion],
    proveedores_lista: List[Proveedor],
    proveedores_map: Dict[int, Proveedor],
    ahora_iso: str,
) -> List[AlertaGestion]:
    """
    Evalúa las reglas explicables individuales (R-02, R-03, R-04, R-05 y R-07)
    sobre un expediente sin depender de banderas artificiales.
    """
    nuevas_alertas: List[AlertaGestion] = []
    roles_por_etapa = {act.etapa: act.usuario_rol for act in actuaciones}
    act_por_etapa = {act.etapa: act for act in actuaciones}

    # -------------------------------------------------------------------------
    # REGLA R-02: VULNERACIÓN DE SEGREGACIÓN DE FUNCIONES
    # Incompatibilidad entre Area Usuaria (Requerimiento/TDR/Conformidad),
    # DEC/Selección (Cotizaciones/Buena Pro) y Tesorería (Pago).
    # -------------------------------------------------------------------------
    rol_req = roles_por_etapa.get("Requerimiento")
    rol_tdr = roles_por_etapa.get("TDR")
    rol_cot = roles_por_etapa.get("Cotizaciones")
    rol_buena_pro = roles_por_etapa.get("Buena Pro")
    rol_conformidad = roles_por_etapa.get("Conformidad")
    rol_pago = roles_por_etapa.get("Pago")

    rol_conflictivo = None
    if rol_buena_pro and rol_buena_pro in {rol_req, rol_tdr, rol_conformidad, rol_pago}:
        rol_conflictivo = rol_buena_pro
    elif rol_cot and rol_cot in {rol_req, rol_conformidad, rol_pago}:
        rol_conflictivo = rol_cot

    if rol_conflictivo:
        etapas_coincidentes = [
            act.etapa for act in actuaciones if act.usuario_rol == rol_conflictivo
        ]
        alerta = AlertaGestion(
            expediente_id=exp.id,
            codigo_regla="R-02-SEGREGACION",
            categoria="Segregación de Funciones",
            titulo=(
                f"Señal de riesgo que amerita revisión humana: Concentración de etapas incompatibles "
                f"en un mismo código funcional ({rol_conflictivo})"
            ),
            severidad="ALTO",
            regla_activada=(
                "Regla XAI R-02 (Matriz de Incompatibilidad Funcional): Verifica que el rol que formula "
                "el requerimiento, elabora el TDR u otorga la conformidad técnica no sea el mismo actor que "
                "conduce las cotizaciones, adjudica la Buena Pro o ejecuta el pago."
            ),
            evidencia_exacta=(
                f"En el expediente {exp.codigo} (Monto: S/ {exp.monto_estimado:,.2f}), el identificador anonimizado "
                f"'{rol_conflictivo}' aparece sellando {len(etapas_coincidentes)} etapas críticas incompatibles entre sí: "
                f"{', '.join(etapas_coincidentes)}."
            ),
            base_normativa=(
                "Ley N° 32069 (Art. 11 y Art. 25: Organización de la Entidad Contratante y autonomía entre Área Usuaria "
                "y Dependencia Encargada de las Contrataciones - DEC); "
                "Ley N° 27815 (Código de Ética de la Función Pública - Art. 6 Deber de Neutralidad y Art. 8 Prohibición de "
                "mantener intereses en conflicto); Normas de Control Interno CGR (RC N° 320-2006-CG)."
            ),
            estado_revision="PENDIENTE",
            area_asignada="OCI — Órgano de Control Institucional",
            fecha_limite=_fecha_limite_sla(5),
            comentario_descargo=None,
            rol_ultimo_cambio="MOTOR-XAI-CENTINELA",
            fecha_actualizacion=ahora_iso,
        )
        nuevas_alertas.append(alerta)
        exp.nivel_riesgo = "ALTO"
        exp.puntaje_riesgo = max(exp.puntaje_riesgo, 92)
        exp.estado_expediente = "En Revisión OCI"

    # -------------------------------------------------------------------------
    # REGLA R-03: DEVENGADO Y PAGO SIN CONFORMIDAD TÉCNICA VÁLIDA
    # -------------------------------------------------------------------------
    act_conf = act_por_etapa.get("Conformidad")
    act_pago = act_por_etapa.get("Pago")
    if act_conf and act_pago:
        texto_conf_upper = act_conf.documento_texto.upper()
        inconsistencia_conf = (
            "SIN ACTA DE RECEPCIÓN" in texto_conf_upper
            or "PENDIENTE DE VERIFICACIÓN" in texto_conf_upper
            or "OBSERVADO" in texto_conf_upper
            or (not act_conf.tiene_sustento)
            or act_pago.timestamp < act_conf.timestamp
        )
        if inconsistencia_conf:
            alerta = AlertaGestion(
                expediente_id=exp.id,
                codigo_regla="R-03-PAGO-SIN-CONF",
                categoria="Ejecución Contractual / Pago",
                titulo=(
                    "Señal de riesgo que amerita revisión humana: Ejecución de devengado y pago "
                    "con conformidad técnica incompleta, sin sustento o extemporánea"
                ),
                severidad="ALTO",
                regla_activada=(
                    "Regla XAI R-03 (Pre-requisito de Conformidad para Pago): Verifica que la etapa de Pago "
                    "esté precedida cronológicamente por un Acta de Conformidad firme, con sustento documental "
                    "completo y sin observaciones pendientes emitida por el área usuaria."
                ),
                evidencia_exacta=(
                    f"En el expediente {exp.codigo}, la etapa 5 (Conformidad, rol {act_conf.usuario_rol}, "
                    f"fecha {act_conf.timestamp}, versión {act_conf.version_doc}) registra: '{act_conf.documento_texto}'. "
                    f"Pese a ello, la etapa 6 (Pago, rol {act_pago.usuario_rol}, fecha {act_pago.timestamp}) autorizó "
                    f"el desembolso por S/ {exp.monto_estimado:,.2f} a favor de {exp.proveedor_adjudicado_codigo}."
                ),
                base_normativa=(
                    "Ley N° 32069 (Art. 67: Recepción, conformidad y pago oportuno sujeto a verificación de calidad); "
                    "D.S. N° 009-2025-EF (Requisitos previos al devengado y responsabilidad funcional por pago sin conformidad); "
                    "D.L. N° 1441 (Sistema Nacional de Tesorería - Reconocimiento del Devengado)."
                ),
                estado_revision="PENDIENTE",
                area_asignada="Tesorería / Control Previo + OCI",
                fecha_limite=_fecha_limite_sla(3),
                comentario_descargo=None,
                rol_ultimo_cambio="MOTOR-XAI-CENTINELA",
                fecha_actualizacion=ahora_iso,
            )
            nuevas_alertas.append(alerta)
            exp.nivel_riesgo = "ALTO"
            exp.puntaje_riesgo = max(exp.puntaje_riesgo, 95)
            exp.estado_expediente = "En Revisión OCI"

    # -------------------------------------------------------------------------
    # REGLA R-04: COLUSIÓN DE POSTORES POR GRAFOS (ATRIBUTOS COMPARTIDOS)
    # -------------------------------------------------------------------------
    postores_exp = [
        proveedores_map[p.proveedor_id]
        for p in postulaciones
        if p.proveedor_id in proveedores_map
    ]

    if len(postores_exp) >= 2:
        coincidencias_grafo = []
        for i in range(len(postores_exp)):
            for j in range(i + 1, len(postores_exp)):
                p1, p2 = postores_exp[i], postores_exp[j]
                if p1.representante_id == p2.representante_id:
                    coincidencias_grafo.append(
                        f"{p1.codigo} y {p2.codigo} comparten Representante Legal ({p1.representante_id})"
                    )
                if p1.direccion_hash == p2.direccion_hash:
                    coincidencias_grafo.append(
                        f"{p1.codigo} y {p2.codigo} comparten Dirección Fiscal ({p1.direccion_hash})"
                    )
                if p1.telefono_hash == p2.telefono_hash:
                    coincidencias_grafo.append(
                        f"{p1.codigo} y {p2.codigo} comparten Teléfono de Contacto ({p1.telefono_hash})"
                    )

        if coincidencias_grafo:
            alerta = AlertaGestion(
                expediente_id=exp.id,
                codigo_regla="R-04-COLUSION-GRAFO",
                categoria="Colusión en Grafos",
                titulo=(
                    "Señal de riesgo que amerita revisión humana: Co-participación de postores "
                    "con vínculos societarios o de contacto compartidos"
                ),
                severidad="ALTO",
                regla_activada=(
                    "Regla XAI R-04 (Análisis Topológico NetworkX de Postores): Detecta cuando dos o más "
                    "proveedores que presentan cotizaciones u ofertas en el mismo expediente comparten "
                    "identificadores de representante_id, direccion_hash o telefono_hash."
                ),
                evidencia_exacta=(
                    f"En el expediente {exp.codigo} ({exp.objeto}), se presentaron {len(postores_exp)} postores "
                    f"para acreditar pluralidad de ofertas. El motor de grafos detectó: "
                    + "; ".join(coincidencias_grafo)
                    + f". Resultó adjudicado {exp.proveedor_adjudicado_codigo} por S/ {exp.monto_estimado:,.2f}."
                ),
                base_normativa=(
                    "Ley N° 32069 (Art. 5: Principio de Libre Concurrencia y Competencia; Art. 30: Impedimentos "
                    "para contratar con el Estado por vinculación económica o pertenencia a un mismo grupo económico); "
                    "D.S. N° 009-2025-EF (Determinación de vinculación en actuaciones preparatorias y selección)."
                ),
                estado_revision="PENDIENTE",
                area_asignada="OCI — Unidad de Análisis de Redes y Compliance",
                fecha_limite=_fecha_limite_sla(5),
                comentario_descargo=None,
                rol_ultimo_cambio="MOTOR-XAI-CENTINELA",
                fecha_actualizacion=ahora_iso,
            )
            nuevas_alertas.append(alerta)
            exp.nivel_riesgo = "ALTO"
            exp.puntaje_riesgo = max(exp.puntaje_riesgo, 94)
            exp.estado_expediente = "En Revisión OCI"

    # -------------------------------------------------------------------------
    # REGLA R-05: DIRECCIONAMIENTO SEMÁNTICO EN TDR (TF-IDF > 78%) — EVALUACIÓN REAL
    # -------------------------------------------------------------------------
    resultado_nlp = analizar_similitud_tdr(
        db,
        exp,
        proveedores_cache=proveedores_lista,
        postulaciones_cache=postulaciones,
    )
    if resultado_nlp.alerta_detectada:
        top_item = resultado_nlp.comparaciones[0]
        alerta = AlertaGestion(
            expediente_id=exp.id,
            codigo_regla="R-05-TDR-NLP",
            categoria="Direccionamiento Semántico TDR",
            titulo=(
                f"Señal de riesgo que amerita revisión humana: Alta similitud semántica ({top_item.porcentaje_similitud}%) "
                f"entre el TDR y el catálogo exclusivo de {top_item.proveedor_codigo}"
            ),
            severidad="MEDIO" if top_item.porcentaje_similitud < 85.0 else "ALTO",
            regla_activada=(
                f"Regla XAI R-05 (Similitud Coseno TF-IDF > {UMBRAL_DIRECCIONAMIENTO}%): Compara vectorialmente "
                "los Términos de Referencia (TDR) frente a los catálogos técnicos de proveedores para identificar "
                "transcripciones literales de parámetros propietarios o marcas encubiertas."
            ),
            evidencia_exacta=(
                f"El TDR del expediente {exp.codigo} alcanza un {top_item.porcentaje_similitud}% de similitud coseno "
                f"con el catálogo comercial de {top_item.proveedor_codigo} ({top_item.proveedor_alias}), "
                f"quien además figura como {'adjudicado' if top_item.es_adjudicado else 'referente del rubro'} "
                f"(monto S/ {exp.monto_estimado:,.2f}). "
                f"Términos técnicos determinantes detectados: {', '.join(top_item.terminos_coincidentes)}."
            ),
            base_normativa=(
                "Ley N° 32069 (Art. 47: Formulación de Requerimiento y Especificaciones Técnicas objetivas; "
                "prohibición de aludir a fabricación, procedencia, diseño o marca que oriente la contratación); "
                "D.S. N° 009-2025-EF (Estandarización y pluralidad de marcas y postores)."
            ),
            estado_revision="PENDIENTE",
            area_asignada="DEC — Dependencia Encargada de Contrataciones",
            fecha_limite=_fecha_limite_sla(4),
            comentario_descargo=None,
            rol_ultimo_cambio="MOTOR-XAI-CENTINELA",
            fecha_actualizacion=ahora_iso,
        )
        nuevas_alertas.append(alerta)
        exp.nivel_riesgo = "ALTO"
        exp.puntaje_riesgo = max(exp.puntaje_riesgo, 92)
        exp.estado_expediente = "En Revisión OCI"

    # -------------------------------------------------------------------------
    # REGLA R-07: INCONSISTENCIA CRONOLÓGICA, VERSIONES EXTEMPORÁNEAS Y AUSENCIA DE SUSTENTO
    # Evalúa el orden temporal y sustento documental de etapas preparatorias/selección
    # -------------------------------------------------------------------------
    hallazgos_traza: List[str] = []
    etapas_pre_pago = [a for a in actuaciones if a.etapa in ("Requerimiento", "TDR", "Cotizaciones", "Buena Pro")]

    for idx in range(len(etapas_pre_pago) - 1):
        actual = etapas_pre_pago[idx]
        siguiente = etapas_pre_pago[idx + 1]
        if actual.timestamp > siguiente.timestamp:
            hallazgos_traza.append(
                f"Inconsistencia cronológica: la etapa '{actual.etapa}' ({actual.version_doc}, {actual.timestamp}) "
                f"registra fecha posterior a '{siguiente.etapa}' ({siguiente.version_doc}, {siguiente.timestamp})"
            )

    for act in etapas_pre_pago:
        if not act.tiene_sustento:
            hallazgos_traza.append(
                f"Ausencia de sustento documental obligatorio en etapa '{act.etapa}' "
                f"(versión {act.version_doc}, rol {act.usuario_rol})"
            )
        elif act.version_doc not in ("v1.0", "v1") and "SIN SUSTENTO" in act.documento_texto.upper():
            hallazgos_traza.append(
                f"Modificación de versión documental ({act.version_doc}) en '{act.etapa}' sin informe técnico justificatorio"
            )

    if hallazgos_traza:
        alerta = AlertaGestion(
            expediente_id=exp.id,
            codigo_regla="R-07-CRONO-VERSION",
            categoria="Trazabilidad / Versiones y Sustentos",
            titulo=(
                "Señal de riesgo que amerita revisión humana: Inconsistencia cronológica, modificación "
                "extemporánea de versión documental o ausencia de sustento"
            ),
            severidad="ALTO",
            regla_activada=(
                "Regla XAI R-07 (Integridad Cronológica y Control de Versiones Documentales): Verifica que "
                "la secuencia temporal entre Requerimiento, TDR, Cotizaciones y Buena Pro sea estrictamente "
                "monotónica y que cada versión documental cuente con sustento técnico registrado."
            ),
            evidencia_exacta=(
                f"En el expediente {exp.codigo} ({exp.objeto}) se identificaron anomalías de trazabilidad documental: "
                + "; ".join(hallazgos_traza)
                + "."
            ),
            base_normativa=(
                "Ley N° 32069 (Art. 5 Principio de Transparencia y Publicidad; Art. 47 Modificación motivada del requerimiento); "
                "D.S. N° 009-2025-EF (Expediente de contratación completo y control de versiones); "
                "Ley N° 27444 (Art. 6 Motivación del acto administrativo)."
            ),
            estado_revision="PENDIENTE",
            area_asignada="Área Usuaria / DEC — Subsanación Documental",
            fecha_limite=_fecha_limite_sla(4),
            comentario_descargo=None,
            rol_ultimo_cambio="MOTOR-XAI-CENTINELA",
            fecha_actualizacion=ahora_iso,
        )
        nuevas_alertas.append(alerta)
        exp.nivel_riesgo = "ALTO"
        exp.puntaje_riesgo = max(exp.puntaje_riesgo, 91)
        exp.estado_expediente = "En Revisión OCI"

    return nuevas_alertas


def _evaluar_fraccionamiento_para_grupo(
    lista_exps: List[Expediente],
    area: str,
    rubro: str,
    mes: str,
    ahora_iso: str,
) -> List[AlertaGestion]:
    """Construye alertas R-01 cuando un grupo de contrataciones menores supera 8 UIT acumuladas."""
    suma_acumulada = sum(e.monto_estimado for e in lista_exps)
    if len(lista_exps) < 2 or suma_acumulada <= TOPE_8_UIT_PEN:
        return []

    veces_tope = round(suma_acumulada / TOPE_8_UIT_PEN, 2)
    codigos_involucrados = ", ".join(
        [f"{e.codigo} (S/ {e.monto_estimado:,.2f})" for e in lista_exps]
    )
    alertas: List[AlertaGestion] = []
    for exp in lista_exps:
        alerta = AlertaGestion(
            expediente_id=exp.id,
            codigo_regla="R-01-FRACCIONAMIENTO",
            categoria="Fraccionamiento Indebido",
            titulo=(
                f"Señal de riesgo que amerita revisión humana: Posible división sistemática de contrataciones "
                f"bajo el umbral de 8 UIT en {area}"
            ),
            severidad="ALTO",
            regla_activada=(
                "Regla XAI R-01 (Umbral Acumulado <= 8 UIT): Detecta múltiples contrataciones menores "
                "del mismo rubro, área usuaria y proveedor dentro del mismo periodo mensual cuyos montos "
                "individuales se sitúan por debajo de las 8 UIT (S/ 42,800), pero cuya suma acumulada "
                "exige un procedimiento de selección competitivo."
            ),
            evidencia_exacta=(
                f"El área usuaria {area} tramitó {len(lista_exps)} expedientes del rubro '{rubro}' en el periodo {mes}: "
                f"{codigos_involucrados}, todos adjudicados a {exp.proveedor_adjudicado_codigo}. "
                f"El monto acumulado asciende a S/ {suma_acumulada:,.2f} ({veces_tope:.2f} veces el límite de 8 UIT)."
            ),
            base_normativa=(
                "Ley N° 32069 (Ley General de Contrataciones Públicas - Art. 20: Prohibición de Fraccionamiento "
                "y Art. 54: Supuestos excluidos sujetos a supervisión <= 8 UIT); "
                "D.S. N° 009-2025-EF (Reglamento de la Ley N° 32069 - Responsabilidad del Área Usuaria y DEC); "
                "Ley N° 27444 (Principio de Debido Procedimiento y Presunción de Licitud)."
            ),
            estado_revision="PENDIENTE",
            area_asignada="OCI — Órgano de Control Institucional",
            fecha_limite=_fecha_limite_sla(5),
            comentario_descargo=None,
            rol_ultimo_cambio="MOTOR-XAI-CENTINELA",
            fecha_actualizacion=ahora_iso,
        )
        alertas.append(alerta)
        exp.nivel_riesgo = "ALTO"
        exp.puntaje_riesgo = max(exp.puntaje_riesgo, 92)
        exp.estado_expediente = "En Revisión OCI"
    return alertas


def ejecutar_motor_reglas_xai(db: Session) -> dict:
    """
    Evalúa el universo completo de expedientes aplicando reglas deterministas y explicables (XAI).
    Garantiza lenguaje no punitivo conforme al Principio de Presunción de Licitud (Ley N° 27444)
    y detalla siempre: (a) Regla activada, (b) Evidencia exacta y (c) Base normativa exacta.
    """
    db.query(HistorialAlerta).delete()
    db.query(AlertaGestion).delete()
    db.commit()

    expedientes = db.query(Expediente).order_by(Expediente.id.asc()).all()
    proveedores_lista = db.query(Proveedor).order_by(Proveedor.codigo.asc()).all()
    proveedores_map = {p.id: p for p in proveedores_lista}

    actuaciones_por_exp: Dict[int, List[Actuacion]] = defaultdict(list)
    for act in db.query(Actuacion).order_by(Actuacion.expediente_id.asc(), Actuacion.orden.asc()).all():
        actuaciones_por_exp[act.expediente_id].append(act)

    postulaciones_por_exp: Dict[int, List[Postulacion]] = defaultdict(list)
    for post in db.query(Postulacion).all():
        postulaciones_por_exp[post.expediente_id].append(post)

    ahora_iso = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S")
    alertas_creadas = 0
    expedientes_con_alerta: Set[int] = set()

    # 1. REGLA R-01: DETECCIÓN REAL DE FRACCIONAMIENTO INDEBIDO (<= 8 UIT)
    grupos_fraccionamiento = defaultdict(list)
    for exp in expedientes:
        if "Menor" in exp.modalidad and exp.monto_estimado <= TOPE_8_UIT_PEN:
            mes_clave = exp.fecha_creacion[:7]
            prov_clave = exp.proveedor_adjudicado_codigo or "SIN-PROV"
            grupos_fraccionamiento[(exp.area_usuaria, exp.rubro, mes_clave, prov_clave)].append(exp)

    for (area, rubro, mes, _), lista_exps in grupos_fraccionamiento.items():
        alertas_r01 = _evaluar_fraccionamiento_para_grupo(lista_exps, area, rubro, mes, ahora_iso)
        for al in alertas_r01:
            db.add(al)
            alertas_creadas += 1
            expedientes_con_alerta.add(al.expediente_id)

    # 2. REGLAS INDIVIDUALES (R-02, R-03, R-04, R-05, R-07)
    for exp in expedientes:
        nuevas = _evaluar_reglas_expediente(
            db=db,
            exp=exp,
            actuaciones=actuaciones_por_exp.get(exp.id, []),
            postulaciones=postulaciones_por_exp.get(exp.id, []),
            proveedores_lista=proveedores_lista,
            proveedores_map=proveedores_map,
            ahora_iso=ahora_iso,
        )
        for al in nuevas:
            db.add(al)
            alertas_creadas += 1
            expedientes_con_alerta.add(exp.id)

    db.commit()
    return {
        "total_expedientes_evaluados": len(expedientes),
        "expedientes_con_senales": len(expedientes_con_alerta),
        "total_alertas_generadas": alertas_creadas,
    }


def evaluar_expediente_individual(db: Session, exp: Expediente) -> List[AlertaGestion]:
    """
    Evalúa en tiempo real un expediente recién registrado contra todas las reglas XAI
    (R-01 fraccionamiento contra el historial en BD, R-02 segregación, R-03 pago sin conformidad,
    R-04 colusión en grafos, R-05 NLP TF-IDF y R-07 cronología/versiones/sustentos),
    preservando las alertas e historiales de los demás expedientes.
    """
    ahora_iso = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S")
    proveedores_lista = db.query(Proveedor).order_by(Proveedor.codigo.asc()).all()
    proveedores_map = {p.id: p for p in proveedores_lista}
    actuaciones = (
        db.query(Actuacion)
        .filter(Actuacion.expediente_id == exp.id)
        .order_by(Actuacion.orden.asc())
        .all()
    )
    postulaciones = (
        db.query(Postulacion).filter(Postulacion.expediente_id == exp.id).all()
    )

    generadas = _evaluar_reglas_expediente(
        db=db,
        exp=exp,
        actuaciones=actuaciones,
        postulaciones=postulaciones,
        proveedores_lista=proveedores_lista,
        proveedores_map=proveedores_map,
        ahora_iso=ahora_iso,
    )

    # Verificar también R-01 Fraccionamiento contra expedientes del mismo mes/área/rubro/proveedor
    if "Menor" in exp.modalidad and exp.monto_estimado <= TOPE_8_UIT_PEN:
        mes_clave = exp.fecha_creacion[:7]
        mismos = [
            e
            for e in db.query(Expediente)
            .filter(
                Expediente.area_usuaria == exp.area_usuaria,
                Expediente.rubro == exp.rubro,
                Expediente.proveedor_adjudicado_codigo == exp.proveedor_adjudicado_codigo,
            )
            .all()
            if "Menor" in e.modalidad
            and e.monto_estimado <= TOPE_8_UIT_PEN
            and e.fecha_creacion[:7] == mes_clave
        ]
        alertas_r01 = _evaluar_fraccionamiento_para_grupo(
            mismos, exp.area_usuaria, exp.rubro, mes_clave, ahora_iso
        )
        for al in alertas_r01:
            if al.expediente_id == exp.id:
                generadas.append(al)

    if not generadas:
        exp.nivel_riesgo = "LIMPIO"
        exp.puntaje_riesgo = 8
        exp.estado_expediente = "Pagado"
    else:
        exp.es_caso_trampa = True
        exp.tipo_trampa = generadas[0].codigo_regla
        for al in generadas:
            db.add(al)

    db.commit()
    for al in generadas:
        db.refresh(al)
    return generadas
