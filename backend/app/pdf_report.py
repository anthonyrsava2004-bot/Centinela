from collections import Counter
import hashlib
import io
from datetime import datetime
from xml.sax.saxutils import escape
from reportlab.graphics.shapes import Drawing, Rect
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import KeepTogether, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from sqlalchemy.orm import Session
from .crypto_audit import verificar_cadena_expediente
from .models import AlertaGestion, EntregableTDR, Expediente, HistorialAlerta
from .nlp_tdr import analizar_similitud_tdr

# Paleta institucional sólida CENTINELA (sin degradados)
NAVY = colors.HexColor("#0B1F3A")
SLATE_900 = colors.HexColor("#0F172A")
SLATE_700 = colors.HexColor("#334155")
SLATE_500 = colors.HexColor("#64748B")
SLATE_200 = colors.HexColor("#CBD5E1")
SLATE_100 = colors.HexColor("#F1F5F9")
SLATE_50 = colors.HexColor("#F8FAFC")

EMERALD_700 = colors.HexColor("#047857")
EMERALD_600 = colors.HexColor("#059669")
EMERALD_200 = colors.HexColor("#A7F3D0")
EMERALD_50 = colors.HexColor("#ECFDF5")

ROSE_700 = colors.HexColor("#BE123C")
ROSE_600 = colors.HexColor("#DC2626")
ROSE_200 = colors.HexColor("#FECDD3")
ROSE_50 = colors.HexColor("#FFF1F2")

AMBER_800 = colors.HexColor("#92400E")
AMBER_600 = colors.HexColor("#D97706")
AMBER_200 = colors.HexColor("#FDE68A")
AMBER_50 = colors.HexColor("#FFFBEB")

BLUE_800 = colors.HexColor("#1E40AF")
BLUE_600 = colors.HexColor("#2563EB")
BLUE_50 = colors.HexColor("#EFF6FF")


TIPOLOGIA_LEGIBLE = {
    "CASO_1_PROYECTORES_UNT": "Compras partidas (≤ 8 UIT) + Conflicto de interés",
    "FRACCIONAMIENTO_8UIT": "Compras partidas para evitar licitación (≤ 8 UIT)",
    "COLUSION_PROVEEDORES": "Empresas vinculadas compitiendo juntas",
    "DIRECCIONAMIENTO_TDR": "Requisitos copiados de un solo proveedor",
    "CONFLICTO_SEGREGACION": "Un mismo trabajador firma etapas incompatibles",
    "PAGO_SIN_CONFORMIDAD": "Trámite de pago sin visto bueno de entrega",
    "INCONSISTENCIA_VERSION_SUSTENTO": "Cambio tardío de requisitos sin sustento",
    "ENTREGABLE_INCOMPLETO_CONFORMIDAD": "Falta entregable obligatorio antes de pagar",
    "CONTINUIDAD_ECONOMICA_RNP": "Empresa 'nueva' ligada a proveedor sancionado",
    "SOBREPRECIO_MERCADO": "Precio muy por encima del estándar de mercado",
}

ESTADO_ALERTA_LEGIBLE = {
    "PENDIENTE": "Por revisar",
    "EN_DESCARGO": "En descargo (Compras)",
    "VALIDADA_OCI": "Observación confirmada (OCI)",
    "ARCHIVADA_SUSTENTADA": "Sustentada y archivada",
}

REGLA_EN_SIMPLE = {
    "R-01-FRACCIONAMIENTO": (
        "Se dividió una compra grande en varias compras pequeñas del mismo tipo para evitar concurso público.",
        "Unificar los pedidos en un solo proceso competitivo antes de adjudicar.",
    ),
    "R-02-SEGREGACION": (
        "Una misma persona firmó etapas que deben ser revisadas por oficinas distintas.",
        "Separar a los responsables y revisar las aprobaciones antes de continuar.",
    ),
    "R-03-PAGO-SIN-CONF": (
        "Se tramita el pago sin haber verificado todos los bienes o trabajos prometidos (o sin acta de conformidad).",
        "Detener el desembolso en Tesorería hasta recibir las pruebas y fotos de cada entregable.",
    ),
    "R-04-COLUSION-GRAFO": (
        "Empresas que figuran como competidoras comparten representante, socio inversor, dirección o teléfono.",
        "Revisar la red de empresas vinculadas y frenar la adjudicación hasta verificar competencia real.",
    ),
    "R-05-TDR-NLP": (
        "Los requisitos técnicos (TDR) coinciden casi palabra por palabra con el catálogo de un solo proveedor.",
        "Corregir los requisitos técnicos para garantizar pluralidad de marcas y postores.",
    ),
    "R-06-SHA256": (
        "Un documento ya firmado fue modificado posteriormente en la base de datos (sello digital roto).",
        "Inmovilizar el expediente de inmediato e iniciar verificación forense en OCI.",
    ),
    "R-07-CRONO-VERSION": (
        "Se cambiaron los requisitos fuera de plazo o faltan documentos de respaldo en el expediente.",
        "Solicitar el sustento técnico-legal del cambio antes de avanzar a la siguiente etapa.",
    ),
    "R-08-CONFLICTO-INTERES": (
        "Un trabajador que interviene en la compra registra vínculo familiar o personal con el proveedor.",
        "Formalizar la abstención preventiva del trabajador y reasignar el proceso a otro funcionario.",
    ),
    "R-09-CONTINUIDAD-RNP": (
        "El proveedor está sancionado en el RNP o es una empresa 'nueva' que comparte socio o dirección con una sancionada.",
        "Verificar el impedimento legal (Art. 30 Ley N° 32069) y detener la contratación.",
    ),
    "R-10-SOBREPRECIO": (
        "El monto propuesto supera en más de 25 % el precio normal de referencia del mercado.",
        "Rehacer el estudio de mercado y contrastar cotizaciones antes de aprobar el gasto.",
    ),
}


def _esc(texto: object) -> str:
    return escape(str(texto or ""))


def _hex(color: colors.Color) -> str:
    val = color.hexval()
    return f"#{val[2:]}" if val.startswith("0x") else val


def _formatear_tipologia(codigo: str | None) -> str:
    if not codigo:
        return "Señal preventiva de control"
    return TIPOLOGIA_LEGIBLE.get(codigo, codigo.replace("_", " ").capitalize())


def _formatear_estado_alerta(estado: str | None) -> str:
    if not estado:
        return "Por revisar"
    return ESTADO_ALERTA_LEGIBLE.get(estado, estado.replace("_", " ").capitalize())


def _resumen_simple_regla(codigo_regla: str) -> tuple[str, str]:
    return REGLA_EN_SIMPLE.get(
        codigo_regla,
        (
            "Se detectó una señal preventiva que requiere verificación humana.",
            "Revisar el expediente junto con OCI y el área de Compras antes de continuar.",
        ),
    )


def _crear_barra_visual(
    porcentaje: float,
    color_barra: colors.Color,
    ancho_cm: float = 4.2,
    alto_pt: float = 8.0,
) -> Drawing:
    pct = max(0.0, min(100.0, float(porcentaje)))
    ancho_pt = ancho_cm * cm
    d = Drawing(ancho_pt, alto_pt + 2)
    d.add(
        Rect(
            0,
            1,
            ancho_pt,
            alto_pt,
            rx=3,
            ry=3,
            fillColor=SLATE_200,
            strokeColor=None,
            strokeWidth=0,
        )
    )
    fill_w = max(4.0, ancho_pt * (pct / 100.0)) if pct > 0 else 0.0
    if fill_w > 0:
        d.add(
            Rect(
                0,
                1,
                fill_w,
                alto_pt,
                rx=3,
                ry=3,
                fillColor=color_barra,
                strokeColor=None,
                strokeWidth=0,
            )
        )
    return d


def _crear_estilos():
    styles = getSampleStyleSheet()
    return {
        "banner_title": ParagraphStyle(
            "CentBannerTitle",
            parent=styles["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=13,
            leading=16,
            textColor=colors.white,
            spaceAfter=2,
        ),
        "banner_sub": ParagraphStyle(
            "CentBannerSub",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=8.5,
            leading=11.5,
            textColor=colors.HexColor("#CBD5E1"),
        ),
        "verdict_title": ParagraphStyle(
            "CentVerdictTitle",
            parent=styles["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=11.5,
            leading=15,
            textColor=SLATE_900,
            spaceAfter=3,
        ),
        "section": ParagraphStyle(
            "CentSection",
            parent=styles["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=10.5,
            leading=14,
            textColor=NAVY,
            spaceBefore=10,
            spaceAfter=5,
        ),
        "body": ParagraphStyle(
            "CentBody",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=8.5,
            leading=12,
            textColor=SLATE_900,
        ),
        "small": ParagraphStyle(
            "CentSmall",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=7.8,
            leading=10.5,
            textColor=SLATE_700,
        ),
        "kpi_label": ParagraphStyle(
            "CentKpiLabel",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=7.2,
            leading=9.5,
            textColor=SLATE_500,
        ),
        "kpi_val": ParagraphStyle(
            "CentKpiVal",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=11.5,
            leading=14,
            textColor=SLATE_900,
        ),
        "kpi_sub": ParagraphStyle(
            "CentKpiSub",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=7.3,
            leading=9.5,
            textColor=SLATE_700,
        ),
        "th": ParagraphStyle(
            "CentTh",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=8.0,
            leading=10,
            textColor=colors.white,
        ),
        "mono": ParagraphStyle(
            "CentMono",
            parent=styles["Code"],
            fontName="Courier",
            fontSize=6.8,
            leading=8.8,
            textColor=SLATE_900,
        ),
    }


def _crear_tarjeta_kpi(
    st: dict,
    etiqueta: str,
    valor: str,
    subtexto: str,
    acento: colors.Color = NAVY,
    fondo: colors.Color = SLATE_50,
) -> Table:
    t = Table(
        [
            [Paragraph(_esc(etiqueta.upper()), st["kpi_label"])],
            [Paragraph(f"<font color='{_hex(acento)}'>{_esc(valor)}</font>", st["kpi_val"])],
            [Paragraph(_esc(subtexto), st["kpi_sub"])],
        ],
        colWidths=[4.2 * cm],
    )
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), fondo),
                ("BOX", (0, 0), (-1, -1), 0.7, SLATE_200),
                ("LINEABOVE", (0, 0), (-1, 0), 2.5, acento),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("LEFTPADDING", (0, 0), (-1, -1), 7),
                ("RIGHTPADDING", (0, 0), (-1, -1), 7),
            ]
        )
    )
    return t


def generar_pdf_expediente(db: Session, expediente: Expediente) -> bytes:
    """
    Genera en memoria un Reporte Ejecutivo y Ciudadano de Control Concurrente y Trazabilidad SHA-256.
    Estructura en pirámide invertida:
      - Arriba: semáforo claro, resumen en lenguaje simple y 4 tarjetas visuales.
      - Medio: entregables obligatorios, comparador de precio (R-10) y similitud TDR (R-05).
      - Abajo: detalle técnico/legal XAI, 6 etapas con sellos SHA-256 y nota de presunción de licitud.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=1.5 * cm,
        leftMargin=1.5 * cm,
        topMargin=1.3 * cm,
        bottomMargin=1.3 * cm,
        title=f"Reporte CENTINELA - {expediente.codigo}",
    )

    st = _crear_estilos()
    verificacion = verificar_cadena_expediente(db, expediente)
    nlp_res = analizar_similitud_tdr(db, expediente)
    alertas = (
        db.query(AlertaGestion)
        .filter(AlertaGestion.expediente_id == expediente.id)
        .order_by(AlertaGestion.id.asc())
        .all()
    )
    entregables = (
        db.query(EntregableTDR)
        .filter(EntregableTDR.expediente_id == expediente.id)
        .order_by(EntregableTDR.orden.asc())
        .all()
    )

    entregables_pendientes = [
        e for e in entregables if e.obligatorio and (not e.cumplido or not (e.evidencia_tecnica or "").strip())
    ]
    pago_bloqueado = len(entregables_pendientes) > 0
    alertas_activas = [a for a in alertas if a.estado_revision != "ARCHIVADA_SUSTENTADA"]

    ts_emision = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
    story = []

    # 1. ENCABEZADO INSTITUCIONAL SÓLIDO
    header = Table(
        [
            [
                Paragraph("CENTINELA — REPORTE CLARO DE CONTROL PREVENTIVO DE COMPRA", st["banner_title"]),
                Paragraph(
                    f"<b>{_esc(expediente.codigo)}</b><br/>Emitido: {ts_emision}",
                    ParagraphStyle(
                        "HdrRight",
                        parent=st["banner_sub"],
                        alignment=2,
                        textColor=colors.white,
                    ),
                ),
            ],
            [
                Paragraph(
                    "Control concurrente sobre SIGA, SEACE y SIAF • Datos 100 % sintéticos (Ley N° 29733 y Ley N° 32069)",
                    st["banner_sub"],
                ),
                Paragraph("", st["banner_sub"]),
            ],
        ],
        colWidths=[13.0 * cm, 5.0 * cm],
    )
    header.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), NAVY),
                ("SPAN", (0, 1), (1, 1)),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, 0), 9),
                ("BOTTOMPADDING", (0, 1), (-1, 1), 8),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
            ]
        )
    )
    story.append(header)
    story.append(Spacer(1, 8))

    # 2. SEMÁFORO DE DECISIÓN + RESUMEN EN PALABRAS SIMPLES (NIVEL CIUDADANO)
    if not verificacion.integridad_global:
        bg_semaforo, bd_semaforo, col_semaforo = ROSE_50, ROSE_600, ROSE_700
        titulo_semaforo = f"SEMÁFORO ROJO: DOCUMENTO ALTERADO EN ETAPA {verificacion.etapa_comprometida.upper()}"
        hallazgo_simple = (
            f"El sello digital SHA-256 detectó que alguien modificó el texto de la etapa '{verificacion.etapa_comprometida}' "
            "después de haber sido firmada."
        )
        accion_simple = "Detener cualquier trámite o pago de inmediato y abrir verificación forense en OCI."
    elif len(alertas_activas) > 0 or pago_bloqueado:
        bg_semaforo, bd_semaforo, col_semaforo = ROSE_50, ROSE_600, ROSE_700
        n_al = len(alertas_activas)
        titulo_semaforo = (
            f"SEMÁFORO ROJO: REVISAR ANTES DE CONTINUAR O PAGAR ({n_al} señal{'es' if n_al != 1 else ''} activa{'s' if n_al != 1 else ''})"
        )
        explicaciones = []
        acciones = []
        for al in alertas_activas:
            que_es, que_hacer = _resumen_simple_regla(al.codigo_regla)
            if que_es not in explicaciones:
                explicaciones.append(que_es)
            if que_hacer not in acciones:
                acciones.append(que_hacer)
        hallazgo_simple = " ".join(explicaciones) or "Se detectó una señal preventiva que requiere revisión humana."
        accion_simple = " ".join(acciones) or "Revisar el sustento con Logística (DEC) y OCI antes de aprobar."
    elif len(alertas) > 0:
        bg_semaforo, bd_semaforo, col_semaforo = AMBER_50, AMBER_600, AMBER_800
        titulo_semaforo = "SEMÁFORO ÁMBAR: OBSERVACIÓN SUSTENTADA Y ARCHIVADA POR OCI"
        hallazgo_simple = "La compra tuvo una alerta preventiva inicial, pero el área responsable presentó sustento válido y OCI archivó el caso."
        accion_simple = "La compra puede continuar su trámite regular dejando constancia del archivo motivado."
    else:
        bg_semaforo, bd_semaforo, col_semaforo = EMERALD_50, EMERALD_600, EMERALD_700
        titulo_semaforo = "SEMÁFORO VERDE: COMPRA CONFORME — SIN ALERTAS DE RIESGO"
        hallazgo_simple = (
            "Los requisitos, el precio de mercado, la competencia entre empresas, los entregables y los sellos digitales "
            "cumplen con las reglas preventivas."
        )
        accion_simple = "No se requieren medidas correctivas; el proceso cumple con los controles preventivos."

    semaforo_table = Table(
        [
            [
                Paragraph(
                    f"<font color='{_hex(col_semaforo)}'><b>{_esc(titulo_semaforo)}</b></font>",
                    st["verdict_title"],
                )
            ],
            [
                Paragraph(
                    f"<b>En palabras simples:</b><br/>"
                    f"• <b>¿Qué se está comprando?</b> {_esc(expediente.objeto)} "
                    f"(Área: {_esc(expediente.area_usuaria)} • {_esc(expediente.modalidad)}).<br/>"
                    f"• <b>¿Qué encontró CENTINELA?</b> {_esc(hallazgo_simple)}<br/>"
                    f"• <b>¿Qué se recomienda hacer ahora?</b> {_esc(accion_simple)}",
                    st["body"],
                )
            ],
        ],
        colWidths=[18.0 * cm],
    )
    semaforo_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), bg_semaforo),
                ("BOX", (0, 0), (-1, -1), 1.0, bd_semaforo),
                ("LINEBEFORE", (0, 0), (0, -1), 4.0, bd_semaforo),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
            ]
        )
    )
    story.append(semaforo_table)
    story.append(Spacer(1, 8))

    # 3. CUATRO TARJETAS VISUALES GRANDES (KPIs)
    precio_ref = expediente.precio_referencial_mercado or expediente.monto_estimado
    desv_pct = round(((expediente.monto_estimado - precio_ref) / precio_ref) * 100.0, 1) if precio_ref > 0 else 0.0
    sub_precio = (
        f"Estándar: S/ {precio_ref:,.0f} ({desv_pct:+.1f} %)"
        if expediente.precio_referencial_mercado
        else f"Proveedor: {expediente.proveedor_adjudicado_codigo or 'N/A'}"
    )
    color_precio = ROSE_700 if desv_pct > 25.0 else NAVY

    riesgo_lbl = "SIN ALERTA" if expediente.nivel_riesgo == "LIMPIO" else f"RIESGO {expediente.nivel_riesgo}"
    color_riesgo = EMERALD_700 if expediente.nivel_riesgo == "LIMPIO" else ROSE_700
    fondo_riesgo = EMERALD_50 if expediente.nivel_riesgo == "LIMPIO" else ROSE_50

    color_sha = EMERALD_700 if verificacion.integridad_global else ROSE_700
    txt_sha = "100 % Intactos" if verificacion.integridad_global else "Alterados"
    sub_sha = "6 etapas verificadas" if verificacion.integridad_global else f"Fallo en {verificacion.etapa_comprometida}"

    if pago_bloqueado:
        txt_pago, sub_pago, col_pago, bg_pago = "BLOQUEADO", f"Falta(n) {len(entregables_pendientes)} entregable(s)", ROSE_700, ROSE_50
    elif len(alertas_activas) > 0:
        txt_pago, sub_pago, col_pago, bg_pago = "EN REVISIÓN", "Esperando validación OCI", AMBER_800, AMBER_50
    else:
        txt_pago, sub_pago, col_pago, bg_pago = "HABILITADO", expediente.estado_expediente[:26], EMERALD_700, EMERALD_50

    kpi_grid = Table(
        [
            [
                _crear_tarjeta_kpi(st, "Monto de la compra", f"S/ {expediente.monto_estimado:,.2f}", sub_precio, color_precio, SLATE_50),
                _crear_tarjeta_kpi(st, "Evaluación preventiva", riesgo_lbl, f"Puntaje: {expediente.puntaje_riesgo} / 100", color_riesgo, fondo_riesgo),
                _crear_tarjeta_kpi(st, "Documentos SHA-256", txt_sha, sub_sha, color_sha, SLATE_50),
                _crear_tarjeta_kpi(st, "Pase en Tesorería", txt_pago, sub_pago, col_pago, bg_pago),
            ]
        ],
        colWidths=[4.5 * cm, 4.5 * cm, 4.5 * cm, 4.5 * cm],
    )
    kpi_grid.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    story.append(kpi_grid)
    story.append(Spacer(1, 8))

    # 4. SECCIÓN 1: CONTROL VISUAL DE PRECIO Y REQUISITOS (BARRAS DE COLOR)
    story.append(Paragraph("1. REVISIÓN RÁPIDA DE PRECIO Y REQUISITOS (¿ES JUSTO Y LIMPIO?)", st["section"]))

    sim_pct = float(nlp_res.max_similitud or 0.0)
    bar_sim_col = ROSE_600 if sim_pct >= 78.0 else EMERALD_600
    txt_sim_estado = (
        f"ALERTA ({sim_pct:.1f} % copiado de {nlp_res.proveedor_mas_similar})"
        if sim_pct >= 78.0
        else f"CONFORME ({sim_pct:.1f} % — sin copia de catálogo)"
    )

    bar_precio_pct = min(100.0, max(12.0, abs(desv_pct) * 1.3 + 15.0)) if desv_pct > 0 else 15.0
    bar_precio_col = ROSE_600 if desv_pct > 25.0 else EMERALD_600
    txt_precio_estado = (
        f"ALERTA DE SOBREPRECIO ({desv_pct:+.1f} % sobre S/ {precio_ref:,.2f}; límite +25 %)"
        if desv_pct > 25.0
        else f"PRECIO NORMAL ({desv_pct:+.1f} % respecto al estándar S/ {precio_ref:,.2f})"
    )

    checks_table = Table(
        [
            [
                Paragraph("<b>Control Verificado</b>", st["th"]),
                Paragraph("<b>Medidor Visual</b>", st["th"]),
                Paragraph("<b>Resultado Claro</b>", st["th"]),
            ],
            [
                Paragraph("<b>Precio vs. Estándar de Mercado (R-10)</b>", st["body"]),
                _crear_barra_visual(bar_precio_pct, bar_precio_col, ancho_cm=4.2),
                Paragraph(_esc(txt_precio_estado), st["body"]),
            ],
            [
                Paragraph("<b>Neutralidad de Requisitos / TDR (R-05)</b>", st["body"]),
                _crear_barra_visual(sim_pct, bar_sim_col, ancho_cm=4.2),
                Paragraph(_esc(txt_sim_estado), st["body"]),
            ],
            [
                Paragraph("<b>Proveedor Ganador / Postores</b>", st["body"]),
                Paragraph(f"<b>{_esc(expediente.proveedor_adjudicado_codigo or 'N/A')}</b>", st["body"]),
                Paragraph(
                    f"Área usuaria: {_esc(expediente.area_usuaria)} • Rubro: {_esc(expediente.rubro)}",
                    st["body"],
                ),
            ],
        ],
        colWidths=[5.4 * cm, 4.6 * cm, 8.0 * cm],
    )
    checks_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), NAVY),
                ("GRID", (0, 0), (-1, -1), 0.5, SLATE_200),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, SLATE_50]),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("PADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    story.append(checks_table)
    story.append(Spacer(1, 7))

    # 5. SECCIÓN 2: CHECKLIST DE ENTREGABLES ANTES DE PAGAR
    if entregables:
        story.append(Paragraph("2. VERIFICACIÓN DE ENTREGABLES ANTES DEL PAGO EN TESORERÍA", st["section"]))
        ent_rows = [
            [
                Paragraph("<b>#</b>", st["th"]),
                Paragraph("<b>Entregable Obligatorio</b>", st["th"]),
                Paragraph("<b>Estado</b>", st["th"]),
                Paragraph("<b>Prueba / Evidencia Adjunta</b>", st["th"]),
            ]
        ]
        for ent in entregables:
            ok_ent = ent.cumplido and bool((ent.evidencia_tecnica or "").strip())
            est_txt = (
                f"<font color='{_hex(EMERALD_700)}'><b>VERIFICADO</b></font>"
                if ok_ent
                else f"<font color='{_hex(ROSE_700)}'><b>PENDIENTE (BLOQUEA PAGO)</b></font>"
            )
            evid_txt = (
                _esc(ent.evidencia_tecnica)
                if ok_ent
                else "Sin acta técnica ni registro fotográfico adjunto."
            )
            ent_rows.append(
                [
                    Paragraph(str(ent.orden), st["body"]),
                    Paragraph(_esc(ent.nombre), st["body"]),
                    Paragraph(est_txt, st["small"]),
                    Paragraph(evid_txt, st["small"]),
                ]
            )
        ent_table = Table(ent_rows, colWidths=[0.8 * cm, 6.2 * cm, 3.8 * cm, 7.2 * cm])
        ent_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), NAVY),
                    ("GRID", (0, 0), (-1, -1), 0.5, SLATE_200),
                    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, SLATE_50]),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("PADDING", (0, 0), (-1, -1), 4.5),
                ]
            )
        )
        story.append(ent_table)
        story.append(Spacer(1, 7))

    # 6. SECCIÓN 3: DETALLE EXPLICABLE DE ALERTAS Y BASE LEGAL (PARA OCI / DEC)
    story.append(
        Paragraph("3. DETALLE EXPLICABLE DE ALERTAS Y BASE LEGAL (PARA REVISIÓN HUMANA)", st["section"])
    )
    if not alertas:
        ok_box = Table(
            [
                [
                    Paragraph(
                        "No se registran alertas de riesgo en esta compra. Todas las reglas preventivas "
                        "(R-01 a R-10) fueron evaluadas sin hallazgos adversos.",
                        st["body"],
                    )
                ]
            ],
            colWidths=[18.0 * cm],
        )
        ok_box.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), EMERALD_50),
                    ("BOX", (0, 0), (-1, -1), 0.6, EMERALD_600),
                    ("PADDING", (0, 0), (-1, -1), 7),
                ]
            )
        )
        story.append(ok_box)
    else:
        for idx, al in enumerate(alertas, start=1):
            es_arch = al.estado_revision == "ARCHIVADA_SUSTENTADA"
            que_es, que_hacer = _resumen_simple_regla(al.codigo_regla)
            estado_txt = _formatear_estado_alerta(al.estado_revision)
            bloque_alerta = [
                [
                    Paragraph(
                        f"<b>Alerta #{idx} — {_esc(al.categoria)} [{_esc(al.codigo_regla)}] "
                        f"| Estado: {_esc(estado_txt)}</b>",
                        st["body"],
                    )
                ],
                [
                    Paragraph(
                        f"<b>En términos simples:</b> {_esc(que_es)}<br/>"
                        f"<b>Acción sugerida:</b> {_esc(que_hacer)}",
                        st["body"],
                    )
                ],
                [Paragraph(f"<b>(a) Regla técnica:</b> {_esc(al.regla_activada)}", st["small"])],
                [Paragraph(f"<b>(b) Evidencia exacta:</b> {_esc(al.evidencia_exacta)}", st["small"])],
                [Paragraph(f"<b>(c) Base legal:</b> {_esc(al.base_normativa)}", st["small"])],
                [
                    Paragraph(
                        (
                            "<b>Estado de Control:</b> Señal sustentada y archivada por OCI (Sin plazo pendiente)"
                            if es_arch
                            else f"<b>Oficina asignada:</b> {_esc(al.area_asignada)} | "
                            f"<b>Plazo de respuesta:</b> {_esc(al.fecha_limite or 'Por definir')}"
                        ),
                        st["small"],
                    )
                ],
            ]
            if al.accion_correctiva:
                etiqueta_accion = (
                    "Disposición de cierre / archivo:"
                    if es_arch
                    else "Medida de control exigida por OCI:"
                    if al.estado_revision == "VALIDADA_OCI"
                    else "Acción correctiva registrada:"
                )
                bloque_alerta.append(
                    [Paragraph(f"<b>{etiqueta_accion}</b> {_esc(al.accion_correctiva)}", st["small"])]
                )
            if al.comentario_descargo:
                bloque_alerta.append(
                    [
                        Paragraph(
                            f"<b>Último pronunciamiento ({_esc(al.rol_ultimo_cambio)} — {_esc(al.fecha_actualizacion)}):</b> "
                            f"{_esc(al.comentario_descargo)}",
                            st["small"],
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
                    f"• [{_esc(h.timestamp)}] <b>{_esc(h.rol_usuario)}</b> "
                    f"({_esc(_formatear_estado_alerta(h.estado_anterior))} → {_esc(_formatear_estado_alerta(h.estado_nuevo))}): "
                    f"{_esc(h.comentario)}"
                    for h in historial_alerta
                ]
                bloque_alerta.append(
                    [Paragraph("<b>Historial de revisiones humanas:</b><br/>" + "<br/>".join(lineas_hist), st["small"])]
                )
            t_al = Table(bloque_alerta, colWidths=[18.0 * cm])
            t_al.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, 0), EMERALD_50 if es_arch else ROSE_50),
                        ("BACKGROUND", (0, 1), (-1, 1), colors.white),
                        ("BACKGROUND", (0, 2), (-1, -1), SLATE_50),
                        ("BOX", (0, 0), (-1, -1), 0.75, EMERALD_600 if es_arch else ROSE_600),
                        ("INNERGRID", (0, 0), (-1, -1), 0.35, EMERALD_200 if es_arch else ROSE_200),
                        ("PADDING", (0, 0), (-1, -1), 5),
                    ]
                )
            )
            story.append(KeepTogether([t_al, Spacer(1, 6)]))

    # 7. SECCIÓN 4 (TÉCNICA): HISTORIAL DE LAS 6 ETAPAS Y SELLOS SHA-256
    story.append(Paragraph("4. HISTORIAL DE LAS 6 ETAPAS Y SEGURIDAD DOCUMENTAL (SELLO SHA-256)", st["section"]))
    story.append(
        Paragraph(
            "Cada paso del proceso queda protegido con una huella digital única (SHA-256) encadenada al paso anterior. "
            "Si el sello guardado coincide con el recalculado, nadie alteró el documento.",
            st["small"],
        )
    )
    story.append(Spacer(1, 4))

    chain_rows = [
        [
            Paragraph("<b>#</b>", st["th"]),
            Paragraph("<b>Etapa</b>", st["th"]),
            Paragraph("<b>Responsable</b>", st["th"]),
            Paragraph("<b>Fecha y Hora</b>", st["th"]),
            Paragraph("<b>Sello Digital SHA-256</b>", st["th"]),
            Paragraph("<b>Verificación</b>", st["th"]),
        ]
    ]
    for eslabon in verificacion.eslabones:
        integro = eslabon.es_integro and eslabon.enlace_anterior_valido
        estado_lbl = (
            f"<font color='{_hex(EMERALD_700)}'><b>INTACTO</b></font>"
            if integro
            else f"<font color='{_hex(ROSE_700)}'><b>ALTERADO</b></font>"
        )
        sello_txt = (
            f"Guardado: {eslabon.hash_actual[:20]}...<br/>"
            f"En vivo : {(eslabon.hash_recalculado or '')[:20]}..."
        )
        chain_rows.append(
            [
                Paragraph(str(eslabon.orden), st["small"]),
                Paragraph(f"<b>{_esc(eslabon.etapa)}</b> ({_esc(eslabon.version_doc)})", st["small"]),
                Paragraph(_esc(eslabon.usuario_rol), st["small"]),
                Paragraph(_esc(eslabon.timestamp), st["small"]),
                Paragraph(sello_txt, st["mono"]),
                Paragraph(estado_lbl, st["small"]),
            ]
        )

    chain_table = Table(
        chain_rows,
        colWidths=[0.7 * cm, 2.7 * cm, 3.2 * cm, 3.1 * cm, 6.1 * cm, 2.2 * cm],
        repeatRows=1,
    )
    chain_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), NAVY),
                ("GRID", (0, 0), (-1, -1), 0.5, SLATE_200),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, SLATE_50]),
                ("PADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    story.append(chain_table)
    story.append(Spacer(1, 8))

    # 8. PIE LEGAL, PRESUNCIÓN DE LICITUD Y SELLO MAESTRO
    ultimo_hash = verificacion.eslabones[-1].hash_actual if verificacion.eslabones else "0" * 64
    sello_reporte = hashlib.sha256(
        f"{expediente.codigo}|{ultimo_hash}|{ts_emision}".encode("utf-8")
    ).hexdigest()

    pie_table = Table(
        [
            [
                Paragraph(
                    f"<b>Sello Digital del Reporte:</b> <font name='Courier'>{sello_reporte[:48]}...</font><br/>"
                    "<i><b>Nota de Presunción de Licitud (Ley N° 27444, Art. 248):</b> Este reporte preventivo "
                    "no acusa ni sanciona a ninguna persona. Señala indicios verificables para revisión humana "
                    "del Órgano de Control Institucional (OCI) y de Logística (DEC), operando con datos 100 % "
                    "sintéticos y seudonimizados (Ley N° 29733).</i>",
                    st["small"],
                )
            ]
        ],
        colWidths=[18.0 * cm],
    )
    pie_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), SLATE_100),
                ("BOX", (0, 0), (-1, -1), 0.5, SLATE_200),
                ("PADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    story.append(pie_table)

    doc.build(story)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes


def generar_pdf_reporte_institucional(db: Session) -> bytes:
    """
    Genera el Reporte Público e Institucional de Integridad y Transparencia en formato ciudadano y ejecutivo:
    semáforo de salud preventiva, resumen en lenguaje simple, tarjetas grandes de montos, barras visuales
    por tipo de alerta y lista legible sin códigos técnicos crudos.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=1.5 * cm,
        leftMargin=1.5 * cm,
        topMargin=1.3 * cm,
        bottomMargin=1.3 * cm,
        title="Reporte Público de Integridad CENTINELA",
    )

    st = _crear_estilos()
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
    ts_emision = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")

    story = []

    # 1. ENCABEZADO INSTITUCIONAL SÓLIDO
    header = Table(
        [
            [
                Paragraph("CENTINELA — REPORTE PÚBLICO DE COMPRAS E INTEGRIDAD", st["banner_title"]),
                Paragraph(
                    f"<b>Transparencia Activa</b><br/>Emitido: {ts_emision}",
                    ParagraphStyle(
                        "InstHdrRight",
                        parent=st["banner_sub"],
                        alignment=2,
                        textColor=colors.white,
                    ),
                ),
            ],
            [
                Paragraph(
                    "Control concurrente sobre SIGA, SEACE y SIAF (sin reemplazarlos) • Ley N° 32069 • Ley N° 27806 • Datos 100 % sintéticos",
                    st["banner_sub"],
                ),
                Paragraph("", st["banner_sub"]),
            ],
        ],
        colWidths=[13.0 * cm, 5.0 * cm],
    )
    header.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), NAVY),
                ("SPAN", (0, 1), (1, 1)),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, 0), 9),
                ("BOTTOMPADDING", (0, 1), (-1, 1), 8),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
            ]
        )
    )
    story.append(header)
    story.append(Spacer(1, 8))

    # 2. RESUMEN CIUDADANO EN PALABRAS SIMPLES + BARRA DE SALUD PREVENTIVA
    resumen_table = Table(
        [
            [
                Paragraph(
                    f"<font color='{_hex(EMERALD_700)}'><b>EN PALABRAS SIMPLES: {pct_limpios:.1f} % DE LAS COMPRAS REVISADAS NO TIENEN ALERTAS</b></font>",
                    st["verdict_title"],
                )
            ],
            [
                Paragraph(
                    f"De <b>{total_exp} compras revisadas</b> por un total de <b>S/ {monto_total:,.2f}</b>, "
                    f"<b>{limpios} compras</b> cumplen las reglas preventivas y <b>{observados} compras</b> "
                    f"(por S/ {monto_riesgo:,.2f}) fueron detenidas o señaladas a tiempo para revisión humana "
                    f"antes de adjudicar o pagar, con un ahorro preventivo estimado de <b>S/ {ahorro_est:,.2f}</b>.",
                    st["body"],
                )
            ],
            [_crear_barra_visual(pct_limpios, EMERALD_600, ancho_cm=17.2, alto_pt=10.0)],
            [
                Paragraph(
                    f"Gestión de alertas: <b>{estado_counter['PENDIENTE']}</b> por revisar • "
                    f"<b>{estado_counter['EN_DESCARGO']}</b> en descargo • "
                    f"<b>{estado_counter['VALIDADA_OCI']}</b> confirmadas por OCI • "
                    f"<b>{estado_counter['ARCHIVADA_SUSTENTADA']}</b> sustentadas y archivadas.",
                    st["small"],
                )
            ],
        ],
        colWidths=[18.0 * cm],
    )
    resumen_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), EMERALD_50),
                ("BOX", (0, 0), (-1, -1), 0.9, EMERALD_600),
                ("LINEBEFORE", (0, 0), (0, -1), 4.0, EMERALD_600),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
            ]
        )
    )
    story.append(resumen_table)
    story.append(Spacer(1, 8))

    # 3. CUATRO TARJETAS VISUALES GRANDES
    kpi_grid = Table(
        [
            [
                _crear_tarjeta_kpi(st, "Compras revisadas", f"{total_exp} procesos", f"{limpios} sin alerta · {observados} en revisión", NAVY, SLATE_50),
                _crear_tarjeta_kpi(st, "Presupuesto revisado", f"S/ {monto_total / 1_000_000:.2f} M", f"S/ {monto_total:,.2f}", BLUE_800, BLUE_50),
                _crear_tarjeta_kpi(st, "Ahorro preventivo", f"S/ {ahorro_est:,.0f}", "Sobrecosto evitado (~18.5 %)", EMERALD_700, EMERALD_50),
                _crear_tarjeta_kpi(
                    st,
                    "Seguridad documental",
                    "100 % Intactos" if rotos == 0 else f"{rotos} alteración(es)",
                    f"{len(alertas)} alertas preventivas (10 reglas)",
                    EMERALD_700 if rotos == 0 else ROSE_700,
                    SLATE_50 if rotos == 0 else ROSE_50,
                ),
            ]
        ],
        colWidths=[4.5 * cm, 4.5 * cm, 4.5 * cm, 4.5 * cm],
    )
    kpi_grid.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    story.append(kpi_grid)
    story.append(Spacer(1, 8))

    # 4. SECCIÓN 1: QUÉ TIPOS DE RIESGOS SE DETECTARON (CON BARRAS VISUALES)
    story.append(Paragraph("1. ¿QUÉ TIPOS DE RIESGOS SE DETECTARON A TIEMPO?", st["section"]))
    cat_rows = [
        [
            Paragraph("<b>Tipo de Riesgo Preventivo</b>", st["th"]),
            Paragraph("<b>Proporción Visual</b>", st["th"]),
            Paragraph("<b>Alertas</b>", st["th"]),
            Paragraph("<b>% del Total</b>", st["th"]),
        ]
    ]
    bar_palette = [NAVY, BLUE_600, AMBER_600, ROSE_600, EMERALD_600]
    for idx_cat, (cat, qty) in enumerate(cat_counter.most_common()):
        pct = round((qty / max(1, len(alertas))) * 100, 1)
        cat_rows.append(
            [
                Paragraph(_esc(cat), st["body"]),
                _crear_barra_visual(pct, bar_palette[idx_cat % len(bar_palette)], ancho_cm=4.5),
                Paragraph(f"<b>{qty}</b>", st["body"]),
                Paragraph(f"{pct:.1f} %", st["body"]),
            ]
        )
    cat_table = Table(cat_rows, colWidths=[8.5 * cm, 5.0 * cm, 2.1 * cm, 2.4 * cm])
    cat_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), NAVY),
                ("GRID", (0, 0), (-1, -1), 0.5, SLATE_200),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, SLATE_50]),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("PADDING", (0, 0), (-1, -1), 4.5),
            ]
        )
    )
    story.append(cat_table)
    story.append(Spacer(1, 8))

    # 5. SECCIÓN 2: LISTA CLARA DE COMPRAS EN REVISIÓN PREVENTIVA (CERO CÓDIGOS CON GUION BAJO)
    story.append(Paragraph("2. COMPRAS SEÑALADAS PARA REVISIÓN PREVENTIVA (DATOS ANONIMIZADOS)", st["section"]))
    obs_exps = [e for e in expedientes if e.nivel_riesgo != "LIMPIO" or not e.integridad_valida]
    obs_rows = [
        [
            Paragraph("<b>Expediente</b>", st["th"]),
            Paragraph("<b>Área</b>", st["th"]),
            Paragraph("<b>Monto (S/)</b>", st["th"]),
            Paragraph("<b>Motivo de Revisión (Lenguaje Claro)</b>", st["th"]),
            Paragraph("<b>Estado Actual</b>", st["th"]),
        ]
    ]
    for exp in obs_exps[:20]:
        obs_rows.append(
            [
                Paragraph(f"<b>{_esc(exp.codigo)}</b>", st["small"]),
                Paragraph(_esc(exp.area_usuaria), st["small"]),
                Paragraph(f"S/ {exp.monto_estimado:,.2f}", st["small"]),
                Paragraph(_esc(_formatear_tipologia(exp.tipo_trampa)), st["small"]),
                Paragraph(_esc(exp.estado_expediente), st["small"]),
            ]
        )
    obs_table = Table(obs_rows, colWidths=[3.3 * cm, 2.7 * cm, 2.5 * cm, 5.9 * cm, 3.6 * cm], repeatRows=1)
    obs_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), NAVY),
                ("GRID", (0, 0), (-1, -1), 0.5, SLATE_200),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, SLATE_50]),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("PADDING", (0, 0), (-1, -1), 4.5),
            ]
        )
    )
    story.append(obs_table)
    story.append(Spacer(1, 8))

    # 6. GARANTÍA DE TRANSPARENCIA, PRIVACIDAD Y SELLO DIGITAL
    sello_maestro = hashlib.sha256(
        f"CENTINELA-INST|{total_exp}|{len(alertas)}|{monto_riesgo:.2f}|{ts_emision}".encode("utf-8")
    ).hexdigest()

    pie_table = Table(
        [
            [
                Paragraph(
                    f"<b>Sello Digital Maestro SHA-256:</b> <font name='Courier'>{sello_maestro[:48]}...</font><br/>"
                    "<i><b>Garantía de Privacidad y Presunción de Licitud:</b> Todos los registros de este prototipo "
                    "(TRL-4) son 100 % sintéticos y anonimizados (Ley N° 29733). CENTINELA opera como capa de control "
                    "concurrente sin duplicar SEACE, SIGA ni SIAF. Ninguna alerta constituye acusación ni sanción "
                    "(Art. 248 Ley N° 27444); todas requieren validación humana de personal competente.</i>",
                    st["small"],
                )
            ]
        ],
        colWidths=[18.0 * cm],
    )
    pie_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), SLATE_100),
                ("BOX", (0, 0), (-1, -1), 0.5, SLATE_200),
                ("PADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    story.append(pie_table)

    doc.build(story)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes
