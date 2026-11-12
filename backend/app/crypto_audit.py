import hashlib
from datetime import datetime
from sqlalchemy.orm import Session
from .models import Actuacion, AlertaGestion, Expediente
from .schemas import ActuacionOut, VerificacionCadenaOut

GENESIS_HASH = "0" * 64


def calcular_hash_actuacion(
    id_exp: str,
    etapa: str,
    usuario_rol: str,
    timestamp: str,
    documento_texto: str,
    hash_anterior: str,
) -> str:
    """
    Calcula el sello criptográfico SHA-256 inmutable según especificación CENTINELA:
    SHA256(id_exp + etapa + usuario_rol + timestamp + documento_texto + hash_anterior)
    """
    payload = f"{id_exp}|{etapa}|{usuario_rol}|{timestamp}|{documento_texto}|{hash_anterior}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def verificar_cadena_expediente(db: Session, expediente: Expediente) -> VerificacionCadenaOut:
    """
    Verifica eslabón por eslabón la integridad criptográfica SHA-256 de un expediente.
    Detecta tanto la alteración directa del contenido (documento_texto, usuario_rol, timestamp)
    como el efecto cascada en los eslabones posteriores.
    """
    actuaciones = (
        db.query(Actuacion)
        .filter(Actuacion.expediente_id == expediente.id)
        .order_by(Actuacion.orden.asc())
        .all()
    )

    eslabones_out = []
    integridad_global = True
    etapa_comprometida = None
    orden_comprometido = None
    hash_previo_real = GENESIS_HASH
    cadena_rota_previamente = False

    for act in actuaciones:
        # 1. Verificar hash con el hash_anterior registrado originalmente en el eslabón
        hash_local_esperado = calcular_hash_actuacion(
            id_exp=expediente.codigo,
            etapa=act.etapa,
            usuario_rol=act.usuario_rol,
            timestamp=act.timestamp,
            documento_texto=act.documento_texto,
            hash_anterior=act.hash_anterior,
        )

        # 2. Verificar hash en cascada real (usando el hash real del eslabón previo)
        hash_cascada_real = calcular_hash_actuacion(
            id_exp=expediente.codigo,
            etapa=act.etapa,
            usuario_rol=act.usuario_rol,
            timestamp=act.timestamp,
            documento_texto=act.documento_texto,
            hash_anterior=hash_previo_real,
        )

        es_integro_local = hash_local_esperado == act.hash_actual
        enlace_anterior_valido = (act.hash_anterior == hash_previo_real) and not cadena_rota_previamente

        if not es_integro_local:
            integridad_global = False
            if etapa_comprometida is None:
                etapa_comprometida = act.etapa
                orden_comprometido = act.orden
            cadena_rota_previamente = True
            detalle = (
                f"RUPTURA CRIPTOGRÁFICA DETECTADA EN ETAPA '{act.etapa.upper()}': "
                f"El contenido del documento o metadatos fue modificado ex-post en base de datos. "
                f"El sello SHA-256 almacenado ({act.hash_actual[:12]}...) no coincide con el cálculo forense "
                f"actual ({hash_local_esperado[:12]}...)."
            )
        elif not enlace_anterior_valido:
            integridad_global = False
            detalle = (
                f"EFECTO CASCADA POR RUPTURA PREVIA: Aunque el texto de '{act.etapa}' no fue editado directamente, "
                f"su hash_anterior ya no es válido debido a la alteración sufrida en la etapa #{orden_comprometido} ({etapa_comprometida})."
            )
        else:
            detalle = "Eslabón íntegro. Sello SHA-256 verificado y encadenado correctamente."

        eslabones_out.append(
            ActuacionOut(
                id=act.id,
                expediente_id=act.expediente_id,
                orden=act.orden,
                etapa=act.etapa,
                usuario_rol=act.usuario_rol,
                timestamp=act.timestamp,
                documento_texto=act.documento_texto,
                hash_anterior=act.hash_anterior,
                hash_actual=act.hash_actual,
                hash_recalculado=hash_cascada_real,
                es_integro=es_integro_local,
                enlace_anterior_valido=enlace_anterior_valido,
                detalle_estado=detalle,
            )
        )

        hash_previo_real = hash_cascada_real

    if integridad_global:
        mensaje_forense = (
            f"CADENA SHA-256 ÍNTEGRA: Los {len(eslabones_out)} eslabones secuenciales del expediente "
            f"{expediente.codigo} mantienen correspondencia criptográfica exacta desde el bloque génesis."
        )
    else:
        mensaje_forense = (
            f"ALERTA FORENSE DE INTEGRIDAD: Se detectó manipulación ex-post en el eslabón #{orden_comprometido} "
            f"({etapa_comprometida}), invalidando la cadena de custodia digital hacia las etapas subsiguientes."
        )

    if expediente.integridad_valida != integridad_global:
        expediente.integridad_valida = integridad_global
        db.commit()

    return VerificacionCadenaOut(
        expediente_id=expediente.id,
        expediente_codigo=expediente.codigo,
        integridad_global=integridad_global,
        etapa_comprometida=etapa_comprometida,
        orden_comprometido=orden_comprometido,
        mensaje_forense=mensaje_forense,
        eslabones=eslabones_out,
    )


def simular_alteracion_ex_post(
    db: Session,
    expediente: Expediente,
    etapa_objetivo: str = "Cotizaciones",
    nuevo_texto: str | None = None,
) -> VerificacionCadenaOut:
    """
    Simula un ataque o modificación clandestina directa en la base de datos sobre una actuación ya sellada
    (ej. cambiar el cuadro comparativo de cotizaciones o términos después de otorgada la Buena Pro)
    para demostrar en vivo cómo CENTINELA detecta la ruptura exacta de la cadena SHA-256.
    """
    actuacion = (
        db.query(Actuacion)
        .filter(
            Actuacion.expediente_id == expediente.id,
            Actuacion.etapa == etapa_objetivo,
        )
        .first()
    )

    if not actuacion:
        actuacion = (
            db.query(Actuacion)
            .filter(Actuacion.expediente_id == expediente.id, Actuacion.orden == 3)
            .first()
        )

    if actuacion and "[ALTERACIÓN EX-POST SIMULADA]" not in actuacion.documento_texto:
        if nuevo_texto:
            actuacion.documento_texto = nuevo_texto
        else:
            actuacion.documento_texto = (
                actuacion.documento_texto
                + " | [ALTERACIÓN EX-POST SIMULADA]: Modificación no autorizada en BD del monto referencial "
                "y reemplazo retroactivo de cotización para favorecer adjudicación directa."
            )

    expediente.integridad_valida = False
    expediente.nivel_riesgo = "ALTO"
    expediente.puntaje_riesgo = max(expediente.puntaje_riesgo, 98)
    expediente.estado_expediente = "En Revisión OCI"

    # Crear señal explicable de ruptura de integridad si aún no existe para este expediente
    alerta_existente = (
        db.query(AlertaGestion)
        .filter(
            AlertaGestion.expediente_id == expediente.id,
            AlertaGestion.codigo_regla == "R-06-SHA256",
        )
        .first()
    )
    if not alerta_existente and actuacion:
        hash_recalc = calcular_hash_actuacion(
            id_exp=expediente.codigo,
            etapa=actuacion.etapa,
            usuario_rol=actuacion.usuario_rol,
            timestamp=actuacion.timestamp,
            documento_texto=actuacion.documento_texto,
            hash_anterior=actuacion.hash_anterior,
        )
        nueva_alerta = AlertaGestion(
            expediente_id=expediente.id,
            codigo_regla="R-06-SHA256",
            categoria="Integridad Criptográfica SHA-256",
            titulo=f"Señal de riesgo que amerita revisión humana: Ruptura de sello criptográfico SHA-256 en etapa {actuacion.etapa}",
            severidad="ALTO",
            regla_activada=(
                "Regla Forense R-06 (Inmutabilidad Secuencial Blockchain-Lite): "
                "Toda actuación registrada genera un hash SHA-256 encadenado al eslabón previo. "
                "Cualquier discrepancia entre el hash sellado y el hash recalculado activa revisión inmediata de auditoría forense."
            ),
            evidencia_exacta=(
                f"En el expediente {expediente.codigo}, eslabón #{actuacion.orden} ({actuacion.etapa}, rol {actuacion.usuario_rol}), "
                f"el hash original sellado es {actuacion.hash_actual[:20]}..., pero la verificación actual arroja "
                f"{hash_recalc[:20]}... Se evidencia edición ex-post del documento fuera del flujo regular."
            ),
            base_normativa=(
                "Ley N° 32069 (Ley General de Contrataciones Públicas - Principio de Integridad, Publicidad y Trazabilidad Digital, Art. 5); "
                "D.S. N° 009-2025-EF (Reglamento de la Ley N° 32069 - Conservación e intangibilidad del expediente de contratación); "
                "Ley N° 27815 (Ley del Código de Ética de la Función Pública - Deber de Transparencia)."
            ),
            estado_revision="PENDIENTE",
            comentario_descargo=None,
            rol_ultimo_cambio="SISTEMA-FORENSE-SHA256",
            fecha_actualizacion=datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S"),
        )
        db.add(nueva_alerta)

    db.commit()
    return verificar_cadena_expediente(db, expediente)


def restaurar_integridad_expediente(db: Session, expediente: Expediente) -> VerificacionCadenaOut:
    """
    Restaura el texto original de una actuación alterada en simulación y recalcula/verifica la cadena
    para permitir repetir la demostración en vivo cuantas veces desee el jurado.
    """
    actuaciones = (
        db.query(Actuacion)
        .filter(Actuacion.expediente_id == expediente.id)
        .order_by(Actuacion.orden.asc())
        .all()
    )

    marker = " | [ALTERACIÓN EX-POST SIMULADA]:"
    for act in actuaciones:
        if marker in act.documento_texto:
            act.documento_texto = act.documento_texto.split(marker)[0]

    # Eliminar alerta simulada R-06-SHA256 si el expediente no era originalmente un caso de ruptura
    if expediente.tipo_trampa != "ALTERACION_SHA256":
        db.query(AlertaGestion).filter(
            AlertaGestion.expediente_id == expediente.id,
            AlertaGestion.codigo_regla == "R-06-SHA256",
        ).delete()

    expediente.integridad_valida = True
    if not expediente.es_caso_trampa:
        expediente.nivel_riesgo = "LIMPIO"
        expediente.puntaje_riesgo = 8
        expediente.estado_expediente = "Pagado"

    db.commit()
    return verificar_cadena_expediente(db, expediente)
