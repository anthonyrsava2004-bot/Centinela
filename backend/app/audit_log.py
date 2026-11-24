from datetime import datetime
import hashlib
from typing import List, Optional, Tuple
from fastapi import Request
from sqlalchemy.orm import Session
from .models import AuditLog

AUDIT_GENESIS_HASH = "0" * 64


def normalizar_rol(rol: Optional[str]) -> str:
    """Convierte códigos ASCII de cabecera o alias de rol al nombre institucional completo."""
    raw = (rol or "").strip()
    low = raw.lower()
    if low in ("auditor_oci", "oci") or "auditor oci" in low:
        return "Auditor OCI (Control Institucional)"
    if low in ("especialista_dec", "dec") or "logística" in low or "logistica" in low or "dec" in low:
        return "Especialista Logística (DEC)"
    if low in ("consulta_transparencia", "transparencia", "readonly") or "transparencia" in low or "lectura" in low:
        return "Consulta Transparencia (Solo Lectura)"
    return raw or "Auditor OCI (Control Institucional)"


def resolver_usuario_codigo(rol: Optional[str], usuario_explicito: Optional[str] = None) -> str:
    """Devuelve el código funcional seudonimizado (Ley N° 29733) según el rol o cabecera."""
    if usuario_explicito and usuario_explicito.strip():
        return usuario_explicito.strip()[:40]
    r = normalizar_rol(rol).lower()
    if "auditor oci" in r:
        return "FUNC-OCI-01"
    if "logística" in r or "logistica" in r or "dec" in r:
        return "FUNC-DEC-02"
    if "transparencia" in r or "consulta" in r or "lectura" in r:
        return "CIUD-PUB-00"
    return "FUNC-SYS-00"


def extraer_actor_request(
    request: Request,
    rol_fallback: Optional[str] = None,
    usuario_fallback: Optional[str] = None,
) -> Tuple[str, str, str]:
    """
    Extrae (usuario_codigo, rol_usuario, ip_origen) desde las cabeceras ASCII de sesión
    o query params de descarga directa (en entorno productivo provendría de un JWT SSO).
    """
    rol_raw = (
        request.headers.get("X-Centinela-Role")
        or request.query_params.get("rol")
        or rol_fallback
        or "AUDITOR_OCI"
    )
    rol = normalizar_rol(rol_raw)

    usuario = resolver_usuario_codigo(
        rol,
        request.headers.get("X-Centinela-User")
        or request.query_params.get("usuario")
        or usuario_fallback,
    )

    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        ip_origen = forwarded_for.split(",")[0].strip()
    elif request.client and request.client.host:
        ip_origen = request.client.host
    else:
        ip_origen = "127.0.0.1"

    return usuario, rol, ip_origen


def calcular_hash_auditoria(
    timestamp: str,
    usuario_codigo: str,
    rol_usuario: str,
    accion: str,
    recurso: str,
    resultado: str,
    detalle: str,
    ip_origen: str,
    hash_anterior: str,
) -> str:
    payload = (
        f"{timestamp}|{usuario_codigo}|{rol_usuario}|{accion}|"
        f"{recurso}|{resultado}|{detalle}|{ip_origen}|{hash_anterior}"
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def registrar_evento_auditoria(
    db: Session,
    usuario_codigo: str,
    rol_usuario: str,
    accion: str,
    recurso: str,
    resultado: str,
    detalle: str,
    ip_origen: str = "127.0.0.1",
) -> AuditLog:
    """
    Inserta un evento inmutable en la bitácora global encadenado con el sello SHA-256
    del evento inmediatamente anterior.
    """
    ultimo = db.query(AuditLog).order_by(AuditLog.id.desc()).first()
    hash_prev = ultimo.hash_actual if ultimo else AUDIT_GENESIS_HASH
    ts = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S")

    hash_actual = calcular_hash_auditoria(
        timestamp=ts,
        usuario_codigo=usuario_codigo,
        rol_usuario=rol_usuario,
        accion=accion,
        recurso=recurso,
        resultado=resultado,
        detalle=detalle,
        ip_origen=ip_origen,
        hash_anterior=hash_prev,
    )

    evento = AuditLog(
        timestamp=ts,
        usuario_codigo=usuario_codigo,
        rol_usuario=rol_usuario,
        accion=accion,
        recurso=recurso,
        resultado=resultado,
        detalle=detalle,
        ip_origen=ip_origen,
        hash_anterior=hash_prev,
        hash_actual=hash_actual,
    )
    db.add(evento)
    db.commit()
    db.refresh(evento)
    return evento


def inicializar_bitacora_si_vacia(db: Session) -> None:
    """Siembra los eventos iniciales del arranque criptográfico cuando la bitácora está vacía."""
    if db.query(AuditLog).count() > 0:
        return

    registrar_evento_auditoria(
        db=db,
        usuario_codigo="SISTEMA-CENTINELA",
        rol_usuario="Motor Criptográfico y XAI",
        accion="INICIO_SISTEMA",
        recurso="NODO-SHA256-TRL4",
        resultado="PERMITIDO",
        detalle=(
            "Inicialización del nodo criptográfico SHA-256 y bitácora global inmutable "
            "(entorno TRL-4 con datos 100% sintéticos y seudonimización Ley N° 29733)."
        ),
        ip_origen="127.0.0.1",
    )
    registrar_evento_auditoria(
        db=db,
        usuario_codigo="SISTEMA-CENTINELA",
        rol_usuario="Motor Criptográfico y XAI",
        accion="AUDITORIA_INICIAL_XAI",
        recurso="DATASET-120-EXP",
        resultado="PERMITIDO",
        detalle=(
            "Evaluación determinista completada sobre 120 expedientes sintéticos "
            "(111 limpios + 9 casos con señales preventivas verificables)."
        ),
        ip_origen="127.0.0.1",
    )


def verificar_y_listar_auditoria(
    db: Session,
    resultado: Optional[str] = None,
    accion: Optional[str] = None,
    busqueda: Optional[str] = None,
    limit: int = 200,
) -> dict:
    """
    Recorre toda la cadena de `audit_logs` desde el génesis verificando que ningún registro
    haya sido alterado ni eliminado, y retorna los eventos más recientes filtrados.
    """
    todos: List[AuditLog] = db.query(AuditLog).order_by(AuditLog.id.asc()).all()

    cadena_integra = True
    evento_comprometido_id: Optional[int] = None
    hash_esperado_prev = AUDIT_GENESIS_HASH
    integridad_por_id: dict[int, bool] = {}

    for ev in todos:
        recalculado = calcular_hash_auditoria(
            timestamp=ev.timestamp,
            usuario_codigo=ev.usuario_codigo,
            rol_usuario=ev.rol_usuario,
            accion=ev.accion,
            recurso=ev.recurso,
            resultado=ev.resultado,
            detalle=ev.detalle,
            ip_origen=ev.ip_origen,
            hash_anterior=ev.hash_anterior,
        )
        ok_local = (recalculado == ev.hash_actual) and (ev.hash_anterior == hash_esperado_prev)
        integridad_por_id[ev.id] = ok_local
        if not ok_local and cadena_integra:
            cadena_integra = False
            evento_comprometido_id = ev.id
        hash_esperado_prev = ev.hash_actual

    total_eventos = len(todos)
    total_bloqueados = sum(1 for e in todos if e.resultado == "BLOQUEADO_403")
    total_permitidos = total_eventos - total_bloqueados
    ultimo_hash = todos[-1].hash_actual if todos else AUDIT_GENESIS_HASH

    filtrados = list(reversed(todos))
    if resultado and resultado != "TODOS":
        filtrados = [e for e in filtrados if e.resultado == resultado]
    if accion and accion != "TODAS":
        filtrados = [e for e in filtrados if e.accion == accion]
    if busqueda and busqueda.strip():
        q = busqueda.strip().lower()
        filtrados = [
            e
            for e in filtrados
            if q in e.usuario_codigo.lower()
            or q in e.rol_usuario.lower()
            or q in e.accion.lower()
            or q in e.recurso.lower()
            or q in e.detalle.lower()
            or q in e.ip_origen.lower()
        ]

    eventos_out = [
        {
            "id": e.id,
            "timestamp": e.timestamp,
            "usuario_codigo": e.usuario_codigo,
            "rol_usuario": e.rol_usuario,
            "accion": e.accion,
            "recurso": e.recurso,
            "resultado": e.resultado,
            "detalle": e.detalle,
            "ip_origen": e.ip_origen,
            "hash_anterior": e.hash_anterior,
            "hash_actual": e.hash_actual,
            "es_integro": integridad_por_id.get(e.id, True),
        }
        for e in filtrados[:limit]
    ]

    if cadena_integra:
        mensaje = (
            f"BITÁCORA ÍNTEGRA SHA-256: Los {total_eventos} eventos de auditoría mantienen "
            f"encadenamiento criptográfico verificable desde el bloque génesis."
        )
    else:
        mensaje = (
            f"ALERTA CRÍTICA DE AUDITORÍA: Se detectó manipulación o eliminación en la bitácora "
            f"a partir del evento #{evento_comprometido_id}."
        )

    return {
        "cadena_integra": cadena_integra,
        "total_eventos": total_eventos,
        "total_permitidos": total_permitidos,
        "total_bloqueados": total_bloqueados,
        "ultimo_hash": ultimo_hash,
        "evento_comprometido_id": evento_comprometido_id,
        "mensaje_integridad": mensaje,
        "eventos": eventos_out,
    }
