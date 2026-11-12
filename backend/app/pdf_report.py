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
from .models import AlertaGestion, Expediente
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
            "Marco Legal: Ley N° 32069 (Ley General de Contrataciones Públicas) | D.S. N° 009-2025-EF | "
            "Ley N° 29733 (Protección de Datos Personales - Anonimización por Diseño) | Ley N° 27444 (Presunción de Licitud)",
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
                Paragraph(f"<b>{eslabon.etapa}</b>", body_style),
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
            ]
            if al.comentario_descargo:
                bloque_alerta.append(
                    [
                        Paragraph(
                            f"<b>Descargo / Dictamen Registrado ({al.rol_ultimo_cambio} - {al.fecha_actualizacion}):</b> "
                            f"{al.comentario_descargo}",
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
