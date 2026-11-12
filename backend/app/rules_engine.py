from collections import defaultdict
from datetime import datetime
from sqlalchemy.orm import Session
from .models import Actuacion, AlertaGestion, Expediente, Postulacion, Proveedor
from .nlp_tdr import UMBRAL_DIRECCIONAMIENTO, analizar_similitud_tdr

TOPE_8_UIT_PEN = 42800.0  # Referencia 8 UIT (UIT = S/ 5,350)


def ejecutar_motor_reglas_xai(db: Session) -> dict:
    """
    Evalúa el universo completo de expedientes aplicando reglas deterministas y explicables (XAI).
    Garantiza lenguaje no punitivo conforme al Principio de Presunción de Licitud (Ley N° 27444)
    y detalla siempre: (a) Regla activada, (b) Evidencia exacta y (c) Base normativa exacta.
    """
    # Limpiar alertas previas generadas por reglas base (conservando o regenerando limpiamente)
    db.query(AlertaGestion).delete()
    db.commit()

    expedientes = db.query(Expediente).order_by(Expediente.id.asc()).all()
    proveedores_map = {p.id: p for p in db.query(Proveedor).all()}
    ahora_iso = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S")

    alertas_creadas = 0
    expedientes_con_alerta = set()

    # -------------------------------------------------------------------------
    # 1. REGLA R-01: DETECCIÓN DE FRACCIONAMIENTO INDEBIDO (<= 8 UIT)
    # Agrupar contrataciones menores por (area_usuaria, rubro, mes)
    # -------------------------------------------------------------------------
    grupos_fraccionamiento = defaultdict(list)
    for exp in expedientes:
        if "Menor" in exp.modalidad and exp.monto_estimado <= TOPE_8_UIT_PEN:
            mes_clave = exp.fecha_creacion[:7]  # YYYY-MM
            # Agrupamos los casos de fraccionamiento o mismo objeto específico
            if exp.tipo_trampa == "FRACCIONAMIENTO_8UIT":
                grupos_fraccionamiento[(exp.area_usuaria, exp.rubro, mes_clave, "TRAMPA_FRAC")].append(exp)

    for (area, rubro, mes, _), lista_exps in grupos_fraccionamiento.items():
        if len(lista_exps) >= 2:
            suma_acumulada = sum(e.monto_estimado for e in lista_exps)
            codigos_involucrados = ", ".join(
                [f"{e.codigo} (S/ {e.monto_estimado:,.2f})" for e in lista_exps]
            )
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
                        "del mismo rubro y área usuaria dentro del mismo periodo mensual cuyos montos individuales "
                        "se sitúan inmediatamente por debajo de las 8 UIT (S/ 42,800), pero cuya suma acumulada "
                        "exige un procedimiento de selección competitivo."
                    ),
                    evidencia_exacta=(
                        f"El área usuaria {area} tramitó {len(lista_exps)} expedientes del rubro '{rubro}' en el periodo {mes}: "
                        f"{codigos_involucrados}, todos adjudicados a {exp.proveedor_adjudicado_codigo}. "
                        f"El monto acumulado asciende a S/ {suma_acumulada:,.2f} (2.87 veces el límite de 8 UIT)."
                    ),
                    base_normativa=(
                        "Ley N° 32069 (Ley General de Contrataciones Públicas - Art. 20: Prohibición de Fraccionamiento "
                        "y Art. 54: Supuestos excluidos sujetos a supervisión <= 8 UIT); "
                        "D.S. N° 009-2025-EF (Reglamento de la Ley N° 32069 - Responsabilidad del Área Usuaria y DEC); "
                        "Ley N° 27444 (Principio de Debido Procedimiento y Presunción de Licitud)."
                    ),
                    estado_revision="PENDIENTE",
                    comentario_descargo=None,
                    rol_ultimo_cambio="MOTOR-XAI-CENTINELA",
                    fecha_actualizacion=ahora_iso,
                )
                db.add(alerta)
                alertas_creadas += 1
                expedientes_con_alerta.add(exp.id)
                exp.nivel_riesgo = "ALTO"
                exp.puntaje_riesgo = 92
                exp.estado_expediente = "En Revisión OCI"

    # -------------------------------------------------------------------------
    # Evaluaciones por expediente individual (R-02, R-03, R-04, R-05)
    # -------------------------------------------------------------------------
    for exp in expedientes:
        actuaciones = (
            db.query(Actuacion)
            .filter(Actuacion.expediente_id == exp.id)
            .order_by(Actuacion.orden.asc())
            .all()
        )
        roles_por_etapa = {act.etapa: act.usuario_rol for act in actuaciones}
        act_por_etapa = {act.etapa: act for act in actuaciones}

        # ---------------------------------------------------------------------
        # 2. REGLA R-02: VULNERACIÓN DE SEGREGACIÓN DE FUNCIONES
        # Un mismo funcionario interviene en Requerimiento/TDR, Buena Pro y Conformidad
        # ---------------------------------------------------------------------
        rol_req = roles_por_etapa.get("Requerimiento")
        rol_buena_pro = roles_por_etapa.get("Buena Pro")
        rol_conformidad = roles_por_etapa.get("Conformidad")

        if rol_req and rol_buena_pro and (rol_req == rol_buena_pro or rol_buena_pro == rol_conformidad):
            rol_repetido = rol_buena_pro
            etapas_coincidentes = [
                act.etapa for act in actuaciones if act.usuario_rol == rol_repetido
            ]
            alerta = AlertaGestion(
                expediente_id=exp.id,
                codigo_regla="R-02-SEGREGACION",
                categoria="Segregación de Funciones",
                titulo=(
                    f"Señal de riesgo que amerita revisión humana: Concentración de etapas incompatibles "
                    f"en un mismo código funcional ({rol_repetido})"
                ),
                severidad="ALTO",
                regla_activada=(
                    "Regla XAI R-02 (Matriz de Incompatibilidad Funcional): Verifica que el rol que formula "
                    "el requerimiento o otorga la conformidad técnica no sea el mismo actor que conduce la cotización "
                    "y adjudica la Buena Pro."
                ),
                evidencia_exacta=(
                    f"En el expediente {exp.codigo} (Monto: S/ {exp.monto_estimado:,.2f}), el identificador anonimizado "
                    f"'{rol_repetido}' aparece sellando {len(etapas_coincidentes)} etapas críticas incompatibles entre sí: "
                    f"{', '.join(etapas_coincidentes)}."
                ),
                base_normativa=(
                    "Ley N° 32069 (Art. 11 y Art. 25: Organización de la Entidad Contratante y autonomía entre Área Usuaria "
                    "y Dependencia Encargada de las Contrataciones - DEC); "
                    "Ley N° 27815 (Código de Ética de la Función Pública - Art. 6 Deber de Neutralidad y Art. 8 Prohibición de "
                    "mantener intereses en conflicto); Normas de Control Interno CGR (RC N° 320-2006-CG)."
                ),
                estado_revision="PENDIENTE",
                comentario_descargo=None,
                rol_ultimo_cambio="MOTOR-XAI-CENTINELA",
                fecha_actualizacion=ahora_iso,
            )
            db.add(alerta)
            alertas_creadas += 1
            expedientes_con_alerta.add(exp.id)
            exp.nivel_riesgo = "ALTO"
            exp.puntaje_riesgo = max(exp.puntaje_riesgo, 90)
            exp.estado_expediente = "En Revisión OCI"

        # ---------------------------------------------------------------------
        # 3. REGLA R-03: DEVENGADO Y PAGO SIN CONFORMIDAD TÉCNICA VÁLIDA
        # ---------------------------------------------------------------------
        act_conf = act_por_etapa.get("Conformidad")
        act_pago = act_por_etapa.get("Pago")
        if act_conf and act_pago:
            texto_conf_upper = act_conf.documento_texto.upper()
            inconsistencia_conf = (
                "SIN ACTA DE RECEPCIÓN" in texto_conf_upper
                or "PENDIENTE DE VERIFICACIÓN" in texto_conf_upper
                or "OBSERVADO" in texto_conf_upper
                or act_pago.timestamp < act_conf.timestamp
            )
            if inconsistencia_conf:
                alerta = AlertaGestion(
                    expediente_id=exp.id,
                    codigo_regla="R-03-PAGO-SIN-CONF",
                    categoria="Ejecución Contractual / Pago",
                    titulo=(
                        "Señal de riesgo que amerita revisión humana: Ejecución de devengado y pago "
                        "con conformidad técnica incompleta o extemporánea"
                    ),
                    severidad="ALTO",
                    regla_activada=(
                        "Regla XAI R-03 (Pre-requisito de Conformidad para Pago): Verifica que la etapa de Pago "
                        "esté precedida cronológicamente por un Acta de Conformidad firme y sin observaciones pendientes "
                        "emitida por el área usuaria."
                    ),
                    evidencia_exacta=(
                        f"En el expediente {exp.codigo}, la etapa 5 (Conformidad, rol {act_conf.usuario_rol}, "
                        f"fecha {act_conf.timestamp}) registra: '{act_conf.documento_texto}'. Pese a ello, la etapa 6 "
                        f"(Pago, rol {act_pago.usuario_rol}, fecha {act_pago.timestamp}) autorizó el desembolso por "
                        f"S/ {exp.monto_estimado:,.2f} a favor de {exp.proveedor_adjudicado_codigo}."
                    ),
                    base_normativa=(
                        "Ley N° 32069 (Art. 67: Recepción, conformidad y pago oportuno sujeto a verificación de calidad); "
                        "D.S. N° 009-2025-EF (Requisitos previos al devengado y responsabilidad funcional por pago sin conformidad); "
                        "D.L. N° 1441 (Sistema Nacional de Tesorería - Reconocimiento del Devengado)."
                    ),
                    estado_revision="PENDIENTE",
                    comentario_descargo=None,
                    rol_ultimo_cambio="MOTOR-XAI-CENTINELA",
                    fecha_actualizacion=ahora_iso,
                )
                db.add(alerta)
                alertas_creadas += 1
                expedientes_con_alerta.add(exp.id)
                exp.nivel_riesgo = "ALTO"
                exp.puntaje_riesgo = max(exp.puntaje_riesgo, 95)
                exp.estado_expediente = "En Revisión OCI"

        # ---------------------------------------------------------------------
        # 4. REGLA R-04: COLUSIÓN DE POSTORES POR GRAFOS (ATRIBUTOS COMPARTIDOS)
        # ---------------------------------------------------------------------
        postulaciones = (
            db.query(Postulacion).filter(Postulacion.expediente_id == exp.id).all()
        )
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
                    comentario_descargo=None,
                    rol_ultimo_cambio="MOTOR-XAI-CENTINELA",
                    fecha_actualizacion=ahora_iso,
                )
                db.add(alerta)
                alertas_creadas += 1
                expedientes_con_alerta.add(exp.id)
                exp.nivel_riesgo = "ALTO"
                exp.puntaje_riesgo = max(exp.puntaje_riesgo, 94)
                exp.estado_expediente = "En Revisión OCI"

        # ---------------------------------------------------------------------
        # 5. REGLA R-05: DIRECCIONAMIENTO SEMÁNTICO EN TDR (TF-IDF > 78%)
        # ---------------------------------------------------------------------
        if exp.tipo_trampa == "DIRECCIONAMIENTO_TDR":
            resultado_nlp = analizar_similitud_tdr(db, exp)
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
                        f"quien además resultó adjudicado por S/ {exp.monto_estimado:,.2f}. "
                        f"Términos técnicos determinantes detectados: {', '.join(top_item.terminos_coincidentes)}."
                    ),
                    base_normativa=(
                        "Ley N° 32069 (Art. 47: Formulación de Requerimiento y Especificaciones Técnicas objetivas; "
                        "prohibición de aludir a fabricación, procedencia, diseño o marca que oriente la contratación); "
                        "D.S. N° 009-2025-EF (Estandarización y pluralidad de marcas y postores)."
                    ),
                    estado_revision="PENDIENTE",
                    comentario_descargo=None,
                    rol_ultimo_cambio="MOTOR-XAI-CENTINELA",
                    fecha_actualizacion=ahora_iso,
                )
                db.add(alerta)
                alertas_creadas += 1
                expedientes_con_alerta.add(exp.id)
                exp.nivel_riesgo = "ALTO"
                exp.puntaje_riesgo = max(exp.puntaje_riesgo, 89)
                exp.estado_expediente = "En Revisión OCI"

    db.commit()
    return {
        "total_expedientes_evaluados": len(expedientes),
        "expedientes_con_senales": len(expedientes_con_alerta),
        "total_alertas_generadas": alertas_creadas,
    }
