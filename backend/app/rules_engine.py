from collections import defaultdict
from datetime import datetime, timedelta
from typing import Dict, List, Set
from sqlalchemy.orm import Session
from .models import (
    Actuacion,
    AlertaGestion,
    ConflictoInteres,
    EntregableTDR,
    Expediente,
    HistorialAlerta,
    Postulacion,
    Proveedor,
)
from .nlp_tdr import UMBRAL_DIRECCIONAMIENTO, analizar_similitud_tdr

TOPE_8_UIT_PEN = 42800.0  # Referencia 8 UIT (UIT = S/ 5,350)
UMBRAL_SOBREPRECIO_PCT = 25.0  # Desviación máxima tolerable frente a estándar de mercado (> +25.0%)
MARCO_INTEGRIDAD_UNT = (
    "D.S. N° 148-2024-PCM (Modelo de Integridad); R.S. N° 002-2026-PCM/SIP "
    "(Directiva N° 001-2026-PCM/SIP); D.S. N° 092-2017-PCM; Resolución Rectoral N° 0490-2026/UNT."
)


def _fecha_limite_sla(dias: int = 5) -> str:
    return (datetime.utcnow() + timedelta(days=dias)).strftime("%Y-%m-%d")


def _evaluar_reglas_expediente(
    db: Session,
    exp: Expediente,
    actuaciones: List[Actuacion],
    postulaciones: List[Postulacion],
    entregables: List[EntregableTDR],
    conflictos: List[ConflictoInteres],
    proveedores_lista: List[Proveedor],
    proveedores_map: Dict[int, Proveedor],
    ahora_iso: str,
) -> List[AlertaGestion]:
    """
    Evalúa las reglas explicables individuales (R-02, R-03, R-04, R-05, R-07 y R-08)
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
    # REGLA R-03: DEVENGADO Y PAGO SIN CONFORMIDAD VÁLIDA O ENTREGABLES INCOMPLETOS
    # -------------------------------------------------------------------------
    act_conf = act_por_etapa.get("Conformidad")
    act_pago = act_por_etapa.get("Pago")
    entregables_pendientes = [
        ent for ent in entregables if ent.obligatorio and (not ent.cumplido or not (ent.evidencia_tecnica or "").strip())
    ]

    if act_conf and act_pago:
        texto_conf_upper = act_conf.documento_texto.upper()
        inconsistencia_conf = (
            "SIN ACTA DE RECEPCIÓN" in texto_conf_upper
            or "PENDIENTE DE VERIFICACIÓN" in texto_conf_upper
            or "OBSERVADO" in texto_conf_upper
            or "CONFORMIDAD GENÉRICA" in texto_conf_upper
            or (not act_conf.tiene_sustento)
            or act_pago.timestamp < act_conf.timestamp
            or len(entregables_pendientes) > 0
        )
        if inconsistencia_conf:
            detalle_entregables = ""
            if entregables_pendientes:
                nombres_pend = ", ".join(f"'{e.nombre}'" for e in entregables_pendientes)
                detalle_entregables = (
                    f" Entregables obligatorios del TDR sin cumplimiento/evidencia técnica ni fotográfica: {nombres_pend}. "
                    f"Desembolso bloqueado preventivamente en Tesorería."
                )
            alerta = AlertaGestion(
                expediente_id=exp.id,
                codigo_regla="R-03-PAGO-SIN-CONF",
                categoria="Ejecución Contractual / Pago",
                titulo=(
                    "Señal de riesgo que amerita revisión humana: Conformidad genérica o pago "
                    "con entregables obligatorios del TDR sin verificar ni sustento técnico/fotográfico"
                ),
                severidad="ALTO",
                regla_activada=(
                    "Regla XAI R-03 (Pre-requisito de Conformidad Verificada por Entregable): Verifica que la etapa "
                    "de Pago esté precedida por un Acta de Conformidad firme y que el 100% de entregables obligatorios "
                    "del TDR cuenten con verificación individual y sustento técnico/fotográfico."
                ),
                evidencia_exacta=(
                    f"En el expediente {exp.codigo}, la etapa 5 (Conformidad, rol {act_conf.usuario_rol}, "
                    f"fecha {act_conf.timestamp}, versión {act_conf.version_doc}) registra: '{act_conf.documento_texto}'.{detalle_entregables} "
                    f"Pese a ello, se tramitó el desembolso por S/ {exp.monto_estimado:,.2f} a favor de {exp.proveedor_adjudicado_codigo}."
                ),
                base_normativa=(
                    "Ley N° 32069 (Art. 67: Recepción, conformidad y pago sujeto a verificación de entregables); "
                    "D.S. N° 009-2025-EF; D.L. N° 1441 (Sistema Nacional de Tesorería); "
                    + MARCO_INTEGRIDAD_UNT
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
            exp.estado_expediente = "Pago Bloqueado — Revisión OCI"

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
                if p1.accionista_id and p1.accionista_id == p2.accionista_id:
                    coincidencias_grafo.append(
                        f"{p1.codigo} y {p2.codigo} comparten Socio / Accionista Inversor ({p1.accionista_id})"
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
                    "identificadores de representante_id, accionista_id (socio/inversor), direccion_hash o telefono_hash."
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

    # -------------------------------------------------------------------------
    # REGLA R-08: CONFLICTO DE INTERÉS ACTIVO SIN ABSTENCIÓN NI REASIGNACIÓN
    # -------------------------------------------------------------------------
    conflictos_activos = [c for c in conflictos if c.estado == "DETECTADO"]
    if conflictos_activos:
        detalles_ci = "; ".join(
            f"{c.funcionario_codigo} vinculado con {c.proveedor_vinculado_codigo} ({c.tipo_vinculo})"
            for c in conflictos_activos
        )
        alerta = AlertaGestion(
            expediente_id=exp.id,
            codigo_regla="R-08-CONFLICTO-INTERES",
            categoria="Conflicto de Interés",
            titulo=(
                "Señal de riesgo que amerita revisión humana: Posible conflicto de interés detectado "
                "sin registro de abstención ni reasignación de funcionario"
            ),
            severidad="ALTO",
            regla_activada=(
                "Regla XAI R-08 (Control Preventivo de Conflictos de Interés): Detecta vínculos personales, "
                "familiares o societarios entre un interviniente del proceso y un postor sin declaración oportuna "
                "de abstención y reasignación documentada."
            ),
            evidencia_exacta=(
                f"En el expediente {exp.codigo} ({exp.objeto}) se registran vínculos pendientes de abstención: "
                f"{detalles_ci}. Se requiere evaluación de la Oficina de Integridad / OCI y reasignación preventiva."
            ),
            base_normativa=(
                "Constitución Política del Perú (Art. 39); Ley N° 27815 (Código de Ética de la Función Pública, Art. 8); "
                "Ley N° 27444 (Art. 99 Causales de abstención); " + MARCO_INTEGRIDAD_UNT
            ),
            estado_revision="PENDIENTE",
            area_asignada="Oficina de Integridad / OCI — Abstención y Reasignación",
            fecha_limite=_fecha_limite_sla(2),
            comentario_descargo=None,
            rol_ultimo_cambio="MOTOR-XAI-CENTINELA",
            fecha_actualizacion=ahora_iso,
        )
        nuevas_alertas.append(alerta)
        exp.nivel_riesgo = "ALTO"
        exp.puntaje_riesgo = max(exp.puntaje_riesgo, 96)
        exp.estado_expediente = "En Revisión OCI"

    # -------------------------------------------------------------------------
    # REGLA R-09: HISTORIAL DE SANCIONES RNP Y CONTINUIDAD ECONÓMICA (EMPRESA RECICLADA)
    # -------------------------------------------------------------------------
    hallazgos_r09: List[str] = []
    proveedores_sancionados = [
        p for p in proveedores_lista if p.estado_rnp != "HABILITADO"
    ]
    postores_vistos: Set[int] = set()
    for prov in postores_exp:
        if prov.id in postores_vistos:
            continue
        postores_vistos.add(prov.id)

        if prov.estado_rnp != "HABILITADO" or prov.penalidades_previas >= 3:
            motivo_extra = f" — {prov.motivo_historial}" if prov.motivo_historial else ""
            hallazgos_r09.append(
                f"El postor {prov.codigo} registra estado RNP '{prov.estado_rnp}' con "
                f"{prov.penalidades_previas} penalidades previas en {prov.contratos_previos} contratos{motivo_extra}"
            )
        elif prov.estado_rnp == "HABILITADO":
            for sancionado in proveedores_sancionados:
                if sancionado.id == prov.id:
                    continue
                atributos_comunes: List[str] = []
                if prov.representante_id == sancionado.representante_id:
                    atributos_comunes.append(f"Representante Legal ({prov.representante_id})")
                if prov.accionista_id and prov.accionista_id == sancionado.accionista_id:
                    atributos_comunes.append(f"Socio / Accionista Inversor ({prov.accionista_id})")
                if prov.direccion_hash == sancionado.direccion_hash:
                    atributos_comunes.append(f"Dirección Fiscal ({prov.direccion_hash})")
                if prov.telefono_hash == sancionado.telefono_hash:
                    atributos_comunes.append(f"Teléfono de Contacto ({prov.telefono_hash})")

                if atributos_comunes:
                    hallazgos_r09.append(
                        f"El postor habilitado {prov.codigo} ({prov.contratos_previos} contrato(s) previo(s)) "
                        f"presenta continuidad económica con {sancionado.codigo} "
                        f"(estado RNP: {sancionado.estado_rnp}, {sancionado.penalidades_previas} penalidades previas) "
                        f"al compartir {', '.join(atributos_comunes)}"
                    )

    if hallazgos_r09:
        alerta = AlertaGestion(
            expediente_id=exp.id,
            codigo_regla="R-09-CONTINUIDAD-RNP",
            categoria="Historial RNP / Empresa Reciclada",
            titulo=(
                "Señal de riesgo que amerita revisión humana: Postor con sanción/penalidades RNP "
                "o continuidad económica con empresa liquidada/inhabilitada"
            ),
            severidad="ALTO",
            regla_activada=(
                "Regla XAI R-09 (Historial de Sanciones RNP y Continuidad Económica / Empresa Reciclada): "
                "Verifica si algún postor registra inhabilitación o liquidación sancionada en el RNP, acumula "
                "3 o más penalidades previas por incumplimiento, o actúa como persona jurídica sucesora "
                "compartiendo representante_id, accionista_id, direccion_hash o telefono_hash con un proveedor "
                "previamente sancionado o liquidado."
            ),
            evidencia_exacta=(
                f"En el expediente {exp.codigo} ({exp.objeto}, monto S/ {exp.monto_estimado:,.2f}), "
                f"el cruce histórico del padrón RNP y vínculos societarios detectó: "
                + "; ".join(hallazgos_r09)
                + f". Proveedor adjudicado: {exp.proveedor_adjudicado_codigo}."
            ),
            base_normativa=(
                "Ley N° 32069 (Art. 30: Impedimentos por continuidad económica, personas jurídicas sucesoras "
                "y sanciones vigentes en RNP; Art. 5: Principio de Integridad); "
                "D.S. N° 009-2025-EF (Verificación del historial del proveedor y prevención de elusión de sanciones)."
            ),
            estado_revision="PENDIENTE",
            area_asignada="OCI — Unidad de Análisis de Redes y Compliance",
            fecha_limite=_fecha_limite_sla(4),
            comentario_descargo=None,
            rol_ultimo_cambio="MOTOR-XAI-CENTINELA",
            fecha_actualizacion=ahora_iso,
        )
        nuevas_alertas.append(alerta)
        exp.nivel_riesgo = "ALTO"
        exp.puntaje_riesgo = max(exp.puntaje_riesgo, 94)
        exp.estado_expediente = "En Revisión OCI"

    # -------------------------------------------------------------------------
    # REGLA R-10: SOBREPRECIO FRENTE A ESTÁNDAR DE MERCADO (> +25.0%)
    # -------------------------------------------------------------------------
    if exp.precio_referencial_mercado and exp.precio_referencial_mercado > 0:
        desviacion_pct = round(
            ((exp.monto_estimado - exp.precio_referencial_mercado) / exp.precio_referencial_mercado)
            * 100.0,
            1,
        )
        if desviacion_pct > UMBRAL_SOBREPRECIO_PCT:
            sobrecosto = round(exp.monto_estimado - exp.precio_referencial_mercado, 2)
            alerta = AlertaGestion(
                expediente_id=exp.id,
                codigo_regla="R-10-SOBREPRECIO",
                categoria="Inflación / Sobreprecio de Mercado",
                titulo=(
                    f"Señal de riesgo que amerita revisión humana: Sobreprecio de +{desviacion_pct:.1f}% "
                    f"frente al estándar referencial de mercado"
                ),
                severidad="ALTO" if desviacion_pct >= 40.0 else "MEDIO",
                regla_activada=(
                    f"Regla XAI R-10 (Control de Sobreprecio frente a Estándar de Mercado > +{UMBRAL_SOBREPRECIO_PCT:.1f}%): "
                    "Compara el monto estimado/adjudicado contra el estándar histórico referencial registrado en "
                    f"SEACE / Perú Compras, activando revisión preventiva cuando la desviación supera el +{UMBRAL_SOBREPRECIO_PCT:.1f}%."
                ),
                evidencia_exacta=(
                    f"En el expediente {exp.codigo} ({exp.objeto}), el monto registrado asciende a "
                    f"S/ {exp.monto_estimado:,.2f} frente al estándar referencial SEACE / Perú Compras de "
                    f"S/ {exp.precio_referencial_mercado:,.2f} (+{desviacion_pct:.1f}%, desviación de "
                    f"S/ {sobrecosto:,.2f}), adjudicado a {exp.proveedor_adjudicado_codigo}."
                ),
                base_normativa=(
                    "Ley N° 32069 (Art. 5: Principio de Valor por Dinero y Eficiencia; Art. 46: Indagación de Mercado "
                    "y estándar histórico de precios SEACE / Perú Compras); D.S. N° 009-2025-EF."
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

    entregables_por_exp: Dict[int, List[EntregableTDR]] = defaultdict(list)
    for ent in db.query(EntregableTDR).order_by(EntregableTDR.expediente_id.asc(), EntregableTDR.orden.asc()).all():
        entregables_por_exp[ent.expediente_id].append(ent)

    conflictos_por_exp: Dict[int, List[ConflictoInteres]] = defaultdict(list)
    for ci in db.query(ConflictoInteres).all():
        conflictos_por_exp[ci.expediente_id].append(ci)

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

    # 2. REGLAS INDIVIDUALES (R-02, R-03, R-04, R-05, R-07, R-08)
    for exp in expedientes:
        nuevas = _evaluar_reglas_expediente(
            db=db,
            exp=exp,
            actuaciones=actuaciones_por_exp.get(exp.id, []),
            postulaciones=postulaciones_por_exp.get(exp.id, []),
            entregables=entregables_por_exp.get(exp.id, []),
            conflictos=conflictos_por_exp.get(exp.id, []),
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
    entregables = (
        db.query(EntregableTDR)
        .filter(EntregableTDR.expediente_id == exp.id)
        .order_by(EntregableTDR.orden.asc())
        .all()
    )
    conflictos = (
        db.query(ConflictoInteres).filter(ConflictoInteres.expediente_id == exp.id).all()
    )

    generadas = _evaluar_reglas_expediente(
        db=db,
        exp=exp,
        actuaciones=actuaciones,
        postulaciones=postulaciones,
        entregables=entregables,
        conflictos=conflictos,
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


def construir_mapa_riesgos(db: Session) -> dict:
    """
    Construye el Mapa de Riesgos de Integridad (Probabilidad x Impacto por etapa crítica)
    conforme al Modelo de Integridad (D.S. N° 148-2024-PCM, R.S. N° 002-2026-PCM/SIP y
    estándares OCDE de gestión de riesgos) alimentado dinámicamente desde las alertas reales.
    """
    total_exp = db.query(Expediente).count()
    alertas = db.query(AlertaGestion).all()

    def _contar(reglas: tuple[str, ...]) -> tuple[int, int]:
        filtradas = [a for a in alertas if a.codigo_regla in reglas]
        return len({a.expediente_id for a in filtradas}), len(filtradas)

    c_req_exp, c_req_al = _contar(("R-01-FRACCIONAMIENTO",))
    c_tdr_exp, c_tdr_al = _contar(("R-05-TDR-NLP", "R-07-CRONO-VERSION"))
    c_cot_exp, c_cot_al = _contar(
        ("R-04-COLUSION-GRAFO", "R-06-SHA256", "R-09-CONTINUIDAD-RNP", "R-10-SOBREPRECIO")
    )
    c_sel_exp, c_sel_al = _contar(("R-02-SEGREGACION", "R-08-CONFLICTO-INTERES"))
    c_conf_exp, c_conf_al = _contar(("R-03-PAGO-SIN-CONF",))
    ent_pendientes_exps = {
        e.expediente_id
        for e in db.query(EntregableTDR).filter(EntregableTDR.obligatorio.is_(True), EntregableTDR.cumplido.is_(False)).all()
    }

    def _nivel(score: int) -> str:
        if score >= 16:
            return "CRÍTICO"
        if score >= 10:
            return "ALTO"
        if score >= 5:
            return "MEDIO"
        return "BAJO"

    definiciones = [
        (
            1,
            "1. Requerimiento y Programación",
            "Fraccionamiento indebido bajo tope de 8 UIT",
            "División de compras similares en órdenes menores sucesivas para evadir selección competitiva.",
            min(5, 3 + (1 if c_req_al >= 3 else 0)),
            5,
            c_req_exp,
            c_req_al,
            "Regla R-01: Agrupación mensual por área, rubro y proveedor (> 8 UIT)",
            "Gestión de Riesgos (D.S. N° 148-2024-PCM)",
        ),
        (
            2,
            "2. Formulación de TDR y Versiones",
            "Direccionamiento técnico o modificación extemporánea sin sustento",
            "Copia literal de catálogos exclusivos o alteración tardía de especificaciones (v2.1).",
            min(5, 3 + (1 if c_tdr_al >= 2 else 0)),
            5,
            c_tdr_exp,
            c_tdr_al,
            "Reglas R-05 (NLP TF-IDF > 78%) y R-07 (Control de versiones y fechas)",
            "Controles y Auditoría Preventiva",
        ),
        (
            3,
            "3. Cotizaciones y Estudio de Mercado",
            "Colusión de postores, empresas recicladas, sobreprecio y adulteración ex-post",
            "Postores vinculados o sucesores de sancionados en RNP, cotizaciones infladas (> +25%) o edición tardía.",
            min(5, 3 + (1 if c_cot_al >= 2 else 0)),
            5,
            c_cot_exp,
            c_cot_al,
            "Reglas R-04 (Grafos), R-09 (Continuidad RNP), R-10 (Sobreprecio > +25%) y R-06 (SHA-256)",
            "Gestión de Riesgos y Trazabilidad Digital",
        ),
        (
            4,
            "4. Evaluación y Buena Pro",
            "Conflictos de interés y concentración de funciones incompatibles",
            "Falta de declaración oportuna, abstención o segregación entre requerimiento y adjudicación.",
            min(5, 2 + (1 if c_sel_al >= 1 else 0) + (1 if c_sel_al >= 2 else 0)),
            4,
            c_sel_exp,
            c_sel_al,
            "Reglas R-02 (Segregación) y R-08 (Declaración, Abstención y Reasignación)",
            "Políticas de Integridad y Ética (Ley 27815)",
        ),
        (
            5,
            "5. Conformidad y Entregables del TDR",
            "Conformidades genéricas sin verificar entregables obligatorios",
            "Aprobación sin validar pruebas técnicas ni sustento fotográfico por entregable.",
            min(5, 3 + (1 if len(ent_pendientes_exps) >= 1 else 0)),
            5,
            max(c_conf_exp, len(ent_pendientes_exps)),
            c_conf_al,
            "Checklist obligatorio por entregable TDR con evidencia técnica/fotográfica (R-03)",
            "Supervisión y Monitoreo del Modelo",
        ),
        (
            6,
            "6. Devengado, Pago y Transparencia",
            "Desembolso en Tesorería previo a conformidad firme y opacidad",
            "Falta de bloqueo preventivo de pago y ausencia de bitácora auditable de usuarios.",
            min(5, 2 + (1 if c_conf_al >= 1 else 0)),
            4,
            c_conf_exp,
            c_conf_al,
            "Bloqueo preventivo Tesorería + Bitácora SHA-256 + Datos Abiertos (Ley 27806)",
            "Transparencia y Rendición de Cuentas",
        ),
    ]

    etapas_out = []
    for (
        orden,
        etapa,
        riesgo,
        causa,
        prob,
        imp,
        exps_af,
        als_act,
        ctrl,
        comp,
    ) in definiciones:
        puntaje = prob * imp
        etapas_out.append(
            {
                "orden": orden,
                "etapa": etapa,
                "riesgo_principal": riesgo,
                "causa_raiz": causa,
                "probabilidad": prob,
                "impacto": imp,
                "puntaje_inherente": puntaje,
                "nivel": _nivel(puntaje),
                "expedientes_afectados": exps_af,
                "alertas_activas": als_act,
                "control_centinela": ctrl,
                "componente_modelo_integridad": comp,
            }
        )

    return {
        "marco_referencia": (
            "Modelo de Integridad (D.S. N° 148-2024-PCM • Directiva N° 001-2026-PCM/SIP • "
            "Resolución Rectoral N° 0490-2026/UNT • Estándares OCDE)"
        ),
        "total_expedientes": total_exp,
        "total_etapas_criticas": sum(1 for e in etapas_out if e["nivel"] in ("CRÍTICO", "ALTO")),
        "etapas": etapas_out,
    }
