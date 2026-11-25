from collections import Counter
import hashlib
import io
from datetime import datetime
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from sqlalchemy.orm import Session
from .crypto_audit import verificar_cadena_expediente
from .models import AlertaGestion, Expediente, HistorialAlerta
from .nlp_tdr import analizar_similitud_tdr


def generar_pdf_expediente(db: Session, expediente: Expediente) -> bytes:
    """
    Genera en memoria un Reporte Oficial de Trazabilidad Forense y Auditoría Preventiva en PDF
    utilizando ReportLab, incluyendo la cadena de sellos SHA-256, señales XAI y análisis NLP.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=1.5 * cm,
        leftMargin=1.5 * cm,
        topMargin=1.5 * cm,
        bottomMargin=1.5 * cm,
        title=f"Reporte Forense CENTINELA - {expediente.codigo}",
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "CentinelaTitle",
        parent=styles["Heading1"],
        fontSize=14,
        leading=18,
        textColor=colors.HexColor("#0F172A"),
        spaceAfter=4,
    )
    subtitle_style = ParagraphStyle(
        "CentinelaSubtitle",
        parent=styles["Normal"],
        fontSize=8.5,
        leading=12,
        textColor=colors.HexColor("#475569"),
        spaceAfter=12,
    )
    section_style = ParagraphStyle(
        "CentinelaSection",
        parent=styles["Heading2"],
        fontSize=11,
        leading=14,
        textColor=colors.HexColor("#1E3A8A"),
        spaceBefore=10,
        spaceAfter=6,
    )
    body_style = ParagraphStyle(
        "CentinelaBody",
        parent=styles["Normal"],
        fontSize=8.5,
        leading=12,
        textColor=colors.HexColor("#1E293B"),
    )
    mono_style = ParagraphStyle(
        "CentinelaMono",
        parent=styles["Code"],
        fontSize=7,
        leading=9,
        textColor=colors.HexColor("#0F172A"),
    )

    verificacion = verificar_cadena_expediente(db, expediente)
    nlp_res = analizar_similitud_tdr(db, expediente)
    alertas = (
        db.query(AlertaGestion)
        .filter(AlertaGestion.expediente_id == expediente.id)
        .order_by(AlertaGestion.id.asc())
        .all()
    )

    story = []

    # 1. Encabezado Institucional
    story.append(
        Paragraph(
            "PLATAFORMA CENTINELA — REPORTE OFICIAL DE AUDITORÍA PREVENTIVA Y TRAZABILIDAD FORENSE",
            title_style,
        )
    )
    story.append(
        Paragraph(
            "Marco Legal: Ley N° 32069 | D.S. N° 009-2025-EF | D.S. N° 148-2024-PCM (Modelo de Integridad) | "
            "R.S. N° 002-2026-PCM/SIP (Directiva N° 001-2026-PCM/SIP) | D.S. N° 092-2017-PCM | "
            "Resolución Rectoral N° 0490-2026/UNT | Ley N° 29733 | Ley N° 27815 | Ley N° 27444",
            subtitle_style,
        )
    )

    # 2. Tabla de Resumen Ejecutivo del Expediente
    story.append(Paragraph("1. FICHA TÉCNICA DEL EXPEDIENTE AUDITADO", section_style))

    estado_cadena_txt = (
        "ÍNTEGRA (VERIFICADA SHA-256)"
        if verificacion.integridad_global
        else f"RUPTURA CRIPTOGRÁFICA EN ETAPA {verificacion.etapa_comprometida}"
    )

    ficha_data = [
        [
            Paragraph("<b>Código de Expediente:</b>", body_style),
            Paragraph(expediente.codigo, body_style),
            Paragraph("<b>Nivel de Riesgo XAI:</b>", body_style),
            Paragraph(f"<b>{expediente.nivel_riesgo}</b> ({expediente.puntaje_riesgo}/100 pts)", body_style),
        ],
        [
            Paragraph("<b>Área Usuaria (Anonimizada):</b>", body_style),
            Paragraph(expediente.area_usuaria, body_style),
            Paragraph("<b>Modalidad (Ley 32069):</b>", body_style),
            Paragraph(expediente.modalidad, body_style),
        ],
        [
            Paragraph("<b>Monto Estimado / Adjudicado:</b>", body_style),
            Paragraph(f"S/ {expediente.monto_estimado:,.2f} PEN", body_style),
            Paragraph("<b>Proveedor Adjudicado:</b>", body_style),
            Paragraph(expediente.proveedor_adjudicado_codigo or "N/A", body_style),
        ],
        [
            Paragraph("<b>Integridad Cadena SHA-256:</b>", body_style),
            Paragraph(estado_cadena_txt, body_style),
            Paragraph("<b>Similitud Máx. TDR (NLP):</b>", body_style),
            Paragraph(f"{nlp_res.max_similitud}% ({nlp_res.proveedor_mas_similar})", body_style),
        ],
        [
            Paragraph("<b>Objeto de Contratación:</b>", body_style),
            Paragraph(expediente.objeto, body_style),
            Paragraph("<b>Estado Actual:</b>", body_style),
            Paragraph(expediente.estado_expediente, body_style),
        ],
    ]

    ficha_table = Table(ficha_data, colWidths=[4.0 * cm, 5.0 * cm, 4.0 * cm, 5.0 * cm])
    ficha_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("PADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    story.append(ficha_table)
    story.append(Spacer(1, 8))

    # 3. Cadena Secuencial de Trazabilidad Criptográfica SHA-256
    story.append(
        Paragraph("2. CADENA INMUTABLE DE CUSTODIA DIGITAL (HASH SHA-256 SECUENCIAL)", section_style)
    )
    story.append(Paragraph(verificacion.mensaje_forense, body_style))
    story.append(Spacer(1, 5))

    chain_rows = [
        [
            Paragraph("<b>#</b>", body_style),
            Paragraph("<b>Etapa</b>", body_style),
            Paragraph("<b>Rol (Ley 29733)</b>", body_style),
            Paragraph("<b>Fecha/Hora</b>", body_style),
            Paragraph("<b>Sello SHA-256 (Actual / Recalculado)</b>", body_style),
            Paragraph("<b>Estado</b>", body_style),
        ]
    ]

    for eslabon in verificacion.eslabones:
        estado_lbl = "ÍNTEGRO" if (eslabon.es_integro and eslabon.enlace_anterior_valido) else "ROTO / ALTERADO"
        sello_txt = (
            f"Sellado: {eslabon.hash_actual[:24]}...<br/>"
            f"Recalc.: {(eslabon.hash_recalculado or '')[:24]}..."
        )
        chain_rows.append(
            [
                Paragraph(str(eslabon.orden), body_style),
                Paragraph(f"<b>{eslabon.etapa}</b> ({eslabon.version_doc})", body_style),
                Paragraph(eslabon.usuario_rol, body_style),
                Paragraph(eslabon.timestamp, body_style),
                Paragraph(sello_txt, mono_style),
                Paragraph(f"<b>{estado_lbl}</b>", body_style),
            ]
        )

    chain_table = Table(
        chain_rows,
        colWidths=[0.8 * cm, 2.6 * cm, 3.0 * cm, 3.2 * cm, 5.8 * cm, 2.6 * cm],
    )
    chain_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0F172A")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F1F5F9")]),
                ("PADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    story.append(chain_table)
    story.append(Spacer(1, 8))

    # 4. Señales de Riesgo Explicables (XAI)
    story.append(
        Paragraph("3. SEÑALES EXPLICABLES DE AUDITORÍA PREVENTIVA (XAI - SIN CAJA NEGRA)", section_style)
    )
    if not alertas:
        story.append(
            Paragraph(
                "No se registran señales de alerta XAI para este expediente. "
                "Las actuaciones verificadas cumplen con los parámetros de pluralidad, segregación funcional y neutralidad técnica.",
                body_style,
            )
        )
    else:
        for idx, al in enumerate(alertas, start=1):
            bloque_alerta = [
                [
                    Paragraph(
                        f"<b>Señal #{idx} [{al.codigo_regla}] — Severidad: {al.severidad} | Estado: {al.estado_revision}</b><br/>"
                        f"{al.titulo}",
                        body_style,
                    )
                ],
                [Paragraph(f"<b>(a) Regla Activada:</b> {al.regla_activada}", body_style)],
                [Paragraph(f"<b>(b) Evidencia Exacta:</b> {al.evidencia_exacta}", body_style)],
                [Paragraph(f"<b>(c) Base Normativa Exacta:</b> {al.base_normativa}", body_style)],
                [
                    Paragraph(
                        f"<b>Derivación / Área Asignada:</b> {al.area_asignada} | "
                        f"<b>Plazo SLA:</b> {al.fecha_limite or 'Por definir'}",
                        body_style,
                    )
                ],
            ]
            if al.accion_correctiva:
                bloque_alerta.append(
                    [
                        Paragraph(
                            f"<b>Acción Correctiva Registrada:</b> {al.accion_correctiva}",
                            body_style,
                        )
                    ]
                )
            if al.comentario_descargo:
                bloque_alerta.append(
                    [
                        Paragraph(
                            f"<b>Último Pronunciamiento / Descargo ({al.rol_ultimo_cambio} - {al.fecha_actualizacion}):</b> "
                            f"{al.comentario_descargo}",
                            body_style,
                        )
                    ]
                )
            historial_alerta = (
                db.query(HistorialAlerta)
                .filter(HistorialAlerta.alerta_id == al.id)
                .order_by(HistorialAlerta.id.asc())
                .all()
            )
            if historial_alerta:
                lineas_hist = [
                    f"• [{h.timestamp}] <b>{h.rol_usuario}</b> ({h.estado_anterior or 'INICIO'} → {h.estado_nuevo}): {h.comentario}"
                    for h in historial_alerta
                ]
                bloque_alerta.append(
                    [
                        Paragraph(
                            "<b>Bitácora de Revisión Humana:</b><br/>" + "<br/>".join(lineas_hist),
                            body_style,
                        )
                    ]
                )
            t_al = Table(bloque_alerta, colWidths=[18.0 * cm])
            t_al.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#FEF2F2")),
                        ("BACKGROUND", (0, 1), (-1, -1), colors.HexColor("#FFFBEB")),
                        ("BOX", (0, 0), (-1, -1), 0.75, colors.HexColor("#EF4444")),
                        ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#FECACA")),
                        ("PADDING", (0, 0), (-1, -1), 5),
                    ]
                )
            )
            story.append(t_al)
            story.append(Spacer(1, 6))

    # 5. Análisis Semántico de Direccionamiento en TDR (TF-IDF)
    story.append(
        Paragraph("4. ANÁLISIS SEMÁNTICO DE DIRECCIONAMIENTO EN TDR (TF-IDF + SIMILITUD COSENO)", section_style)
    )
    story.append(Paragraph(nlp_res.explicacion_xai, body_style))
    story.append(Spacer(1, 8))

    # 6. Pie de Firma Criptográfica y Nota Ética Legal
    ts_emision = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
    ultimo_hash = verificacion.eslabones[-1].hash_actual if verificacion.eslabones else "0" * 64
    sello_reporte = hashlib.sha256(
        f"{expediente.codigo}|{ultimo_hash}|{ts_emision}".encode("utf-8")
    ).hexdigest()

    story.append(Paragraph("5. SELLO CRIPTOGRÁFICO DE AUDITORÍA Y DECLARACIÓN DE CUMPLIMIENTO", section_style))
    story.append(
        Paragraph(
            f"<b>Hash Maestro del Reporte PDF:</b> <font name='Courier'>{sello_reporte}</font><br/>"
            f"<b>Último Sello de Cadena del Expediente:</b> <font name='Courier'>{ultimo_hash}</font><br/>"
            f"<b>Fecha de Generación Forense:</b> {ts_emision}<br/><br/>"
            "<i>NOTA LEGAL Y ÉTICA (Ley N° 27444 / Ley N° 32069): El presente documento constituye un reporte técnico "
            "de auditoría preventiva basado en señales algorítmicas explicables (XAI). No constituye imputación de "
            "responsabilidad administrativa, civil ni penal sin el previo procedimiento de descargo y valoración "
            "humana por parte del Órgano de Control Institucional (OCI) o la Dependencia Encargada de las Contrataciones.</i>",
            body_style,
        )
    )

    doc.build(story)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes


def generar_pdf_reporte_institucional(db: Session) -> bytes:
    """
    Genera el Reporte Institucional Agregado de Indicadores de Integridad, Transparencia
    y Compliance (Ley N° 32069, Ley N° 27806 y Ley N° 29733), sin duplicar ni reemplazar
    sistemas oficiales (SEACE / SIGA / SIAF).
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=1.5 * cm,
        leftMargin=1.5 * cm,
        topMargin=1.5 * cm,
        bottomMargin=1.5 * cm,
        title="Reporte Institucional Agregado CENTINELA",
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "InstTitle",
        parent=styles["Heading1"],
        fontSize=14,
        leading=18,
        textColor=colors.HexColor("#0F172A"),
        spaceAfter=4,
    )
    subtitle_style = ParagraphStyle(
        "InstSubtitle",
        parent=styles["Normal"],
        fontSize=8.5,
        leading=12,
        textColor=colors.HexColor("#475569"),
        spaceAfter=10,
    )
    section_style = ParagraphStyle(
        "InstSection",
        parent=styles["Heading2"],
        fontSize=11,
        leading=14,
        textColor=colors.HexColor("#1E3A8A"),
        spaceBefore=10,
        spaceAfter=6,
    )
    body_style = ParagraphStyle(
        "InstBody",
        parent=styles["Normal"],
        fontSize=8.5,
        leading=12,
        textColor=colors.HexColor("#1E293B"),
    )

    expedientes = db.query(Expediente).order_by(Expediente.id.asc()).all()
    alertas = db.query(AlertaGestion).order_by(AlertaGestion.id.asc()).all()

    total_exp = len(expedientes)
    limpios = sum(1 for e in expedientes if e.nivel_riesgo == "LIMPIO" and e.integridad_valida)
    observados = total_exp - limpios
    rotos = sum(1 for e in expedientes if not e.integridad_valida)
    pct_limpios = round((limpios / max(1, total_exp)) * 100, 1)

    monto_total = sum(e.monto_estimado for e in expedientes)
    monto_riesgo = sum(
        e.monto_estimado for e in expedientes if e.nivel_riesgo != "LIMPIO" or not e.integridad_valida
    )
    ahorro_est = round(monto_riesgo * 0.185, 2)

    cat_counter = Counter(a.categoria for a in alertas)
    estado_counter = Counter(a.estado_revision for a in alertas)

    story = [
        Paragraph(
            "PLATAFORMA CENTINELA — REPORTE INSTITUCIONAL AGREGADO DE INTEGRIDAD Y TRANSPARENCIA",
            title_style,
        ),
        Paragraph(
            "Hackathon Innova Norte 3G (UNT) • Desafío 2: Integridad Institucional y Compliance | "
            "Capa de Observabilidad Externa No Intrusiva (No reemplaza SEACE / SIGA / SIAF) | "
            "D.S. N° 148-2024-PCM • R.S. N° 002-2026-PCM/SIP • R.R. N° 0490-2026/UNT • Ley N° 32069 • Ley N° 27806 • Ley N° 29733",
            subtitle_style,
        ),
        Paragraph("1. INDICADORES AGREGADOS DE CONTROL PREVENTIVO", section_style),
    ]

    kpi_rows = [
        [
            Paragraph("<b>Universo de Expedientes Auditados:</b>", body_style),
            Paragraph(f"{total_exp} expedientes sintéticos", body_style),
            Paragraph("<b>Cumplimiento Verificado:</b>", body_style),
            Paragraph(f"{limpios} limpios ({pct_limpios}%) / {observados} observados", body_style),
        ],
        [
            Paragraph("<b>Presupuesto Total Evaluado:</b>", body_style),
            Paragraph(f"S/ {monto_total:,.2f} PEN", body_style),
            Paragraph("<b>Monto con Señales Preventivas:</b>", body_style),
            Paragraph(f"S/ {monto_riesgo:,.2f} PEN", body_style),
        ],
        [
            Paragraph("<b>Ahorro Preventivo Estimado (18.5%):</b>", body_style),
            Paragraph(f"S/ {ahorro_est:,.2f} PEN", body_style),
            Paragraph("<b>Integridad Criptográfica SHA-256:</b>", body_style),
            Paragraph("100% Íntegra" if rotos == 0 else f"{rotos} cadena(s) comprometida(s)", body_style),
        ],
        [
            Paragraph("<b>Total Señales XAI Emitidas:</b>", body_style),
            Paragraph(str(len(alertas)), body_style),
            Paragraph("<b>Gestión Humana (OCI / DEC):</b>", body_style),
            Paragraph(
                f"Pendientes: {estado_counter['PENDIENTE']} | En Descargo: {estado_counter['EN_DESCARGO']} | "
                f"Validadas OCI: {estado_counter['VALIDADA_OCI']} | Archivadas: {estado_counter['ARCHIVADA_SUSTENTADA']}",
                body_style,
            ),
        ],
    ]
    kpi_table = Table(kpi_rows, colWidths=[4.2 * cm, 4.8 * cm, 4.2 * cm, 4.8 * cm])
    kpi_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("PADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    story.append(kpi_table)
    story.append(Spacer(1, 8))

    story.append(Paragraph("2. DISTRIBUCIÓN DE SEÑALES EXPLICABLES (XAI) POR TIPOLOGÍA", section_style))
    cat_rows = [
        [
            Paragraph("<b>Tipología de Señal Preventiva</b>", body_style),
            Paragraph("<b>Cantidad</b>", body_style),
            Paragraph("<b>Participación</b>", body_style),
        ]
    ]
    for cat, qty in cat_counter.most_common():
        pct = round((qty / max(1, len(alertas))) * 100, 1)
        cat_rows.append(
            [
                Paragraph(cat, body_style),
                Paragraph(str(qty), body_style),
                Paragraph(f"{pct}%", body_style),
            ]
        )
    cat_table = Table(cat_rows, colWidths=[11.0 * cm, 3.5 * cm, 3.5 * cm])
    cat_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0F172A")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F1F5F9")]),
                ("PADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    story.append(cat_table)
    story.append(Spacer(1, 8))

    story.append(Paragraph("3. RESUMEN ANONIMIZADO DE EXPEDIENTES PRIORITARIOS OBSERVADOS", section_style))
    obs_exps = [e for e in expedientes if e.nivel_riesgo != "LIMPIO" or not e.integridad_valida]
    obs_rows = [
        [
            Paragraph("<b>Código</b>", body_style),
            Paragraph("<b>Área Usuaria</b>", body_style),
            Paragraph("<b>Monto (S/)</b>", body_style),
            Paragraph("<b>Tipología / Señal</b>", body_style),
            Paragraph("<b>Estado</b>", body_style),
        ]
    ]
    for exp in obs_exps[:20]:
        obs_rows.append(
            [
                Paragraph(exp.codigo, body_style),
                Paragraph(exp.area_usuaria, body_style),
                Paragraph(f"S/ {exp.monto_estimado:,.2f}", body_style),
                Paragraph(exp.tipo_trampa or "SENAL_XAI", body_style),
                Paragraph(exp.estado_expediente, body_style),
            ]
        )
    obs_table = Table(obs_rows, colWidths=[3.5 * cm, 2.8 * cm, 2.8 * cm, 5.4 * cm, 3.5 * cm])
    obs_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0F172A")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F1F5F9")]),
                ("PADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    story.append(obs_table)
    story.append(Spacer(1, 10))

    ts_emision = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
    sello_maestro = hashlib.sha256(
        f"CENTINELA-INST|{total_exp}|{len(alertas)}|{monto_riesgo:.2f}|{ts_emision}".encode("utf-8")
    ).hexdigest()

    story.append(Paragraph("4. GARANTÍAS DE ÉTICA, PRIVACIDAD Y SELLO SHA-256", section_style))
    story.append(
        Paragraph(
            f"<b>Sello Criptográfico Maestro del Reporte Agregado:</b> <font name='Courier'>{sello_maestro}</font><br/>"
            f"<b>Fecha de Emisión:</b> {ts_emision}<br/><br/>"
            "<i>DECLARACIÓN DE LÍMITES Y CUMPLIMIENTO NORMATIVO: Todos los registros procesados en este prototipo "
            "(TRL 3-4) son 100% sintéticos y seudonimizados conforme a la Ley N° 29733. CENTINELA opera como capa "
            "analítica complementaria de transparencia y control preventivo sin duplicar ni sustituir sistemas oficiales "
            "(SEACE, SIGA, SIAF). Las alertas emitidas no constituyen imputación punitiva (Ley N° 27444, Art. 248) "
            "y requieren validación humana obligatoria por personal competente.</i>",
            body_style,
        )
    )

    doc.build(story)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes
