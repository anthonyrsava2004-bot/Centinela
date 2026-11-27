"""
Suite formal de pruebas y benchmark de efectividad de CENTINELA.

Ejecución (desde la carpeta backend/):
    .\\venv\\Scripts\\python.exe -m unittest discover -s tests -v

Características:
  * Usa una base SQLite temporal y aislada (no toca centinela_local.db ni PostgreSQL).
  * 100 % datos sintéticos (Ley N° 29733). Sin red ni APIs externas.
  * Genera un informe reproducible en tests/reports/ (Markdown + JSON) con matriz de
    confusión, precisión, recall, F1, falsos positivos, latencias y pruebas RBAC/SHA-256.
"""
import json
import os
import pprint
import statistics
import sys
import tempfile
import time
import unittest
from datetime import datetime
from pathlib import Path

HERE = Path(__file__).resolve().parent
BACKEND_DIR = HERE.parent
REPORT_DIR = HERE / "reports"
SNAPSHOT_FILE = BACKEND_DIR / "app" / "validation_snapshot.py"

_TMP_DB = Path(tempfile.gettempdir()) / "centinela_test_suite.db"
if _TMP_DB.exists():
    _TMP_DB.unlink()
os.environ["DATABASE_URL"] = f"sqlite:///{_TMP_DB.as_posix()}"
sys.path.insert(0, str(BACKEND_DIR))

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

# --------------------------------------------------------------------------- #
# Constantes y utilidades
# --------------------------------------------------------------------------- #
R01 = "R-01-FRACCIONAMIENTO"
R02 = "R-02-SEGREGACION"
R03 = "R-03-PAGO-SIN-CONF"
R04 = "R-04-COLUSION-GRAFO"
R05 = "R-05-TDR-NLP"
R06 = "R-06-SHA256"
R07 = "R-07-CRONO-VERSION"
R08 = "R-08-CONFLICTO-INTERES"
R09 = "R-09-CONTINUIDAD-RNP"
R10 = "R-10-SOBREPRECIO"
ALL_RULES = [R01, R02, R03, R04, R05, R06, R07, R08, R09, R10]

ROL_OCI = "AUDITOR_OCI"
ROL_DEC = "ESPECIALISTA_DEC"
ROL_PUB = "CONSULTA_TRANSPARENCIA"
USUARIOS = {ROL_OCI: "FUNC-OCI-01", ROL_DEC: "FUNC-DEC-02", ROL_PUB: "CIUD-PUB-00"}
ROL_TXT = {
    ROL_OCI: "Auditor OCI (Control Institucional)",
    ROL_DEC: "Especialista Logística (DEC)",
    ROL_PUB: "Consulta Transparencia (Solo Lectura)",
}

ETAPAS = ["Requerimiento", "TDR", "Cotizaciones", "Buena Pro", "Conformidad", "Pago"]

TDR_GENERICO = (
    "Servicio de mantenimiento general de áreas verdes y limpieza de instalaciones "
    "universitarias con personal capacitado, insumos y supervisión mensual."
)
TDR_LEGITIMO_TI = (
    "Adquisición de computadoras de escritorio con procesador de 8 núcleos, 16 GB de RAM, "
    "almacenamiento SSD de 512 GB, monitor de 24 pulgadas y garantía de 24 meses."
)
TDR_COPIADO_PROV014 = (
    "Solución exclusiva de identificación biométrica con arquitectura propietaria BioCore-X99 "
    "Quantum, equipada con sensor multiespectral NanoVein-770 de lectura subcutánea infrarroja "
    "a 940nm, protocolo cerrado de sincronización encriptada SyncLock-UNT v4.8, chasis blindado "
    "en aleación de magnesio anodizado IP69K serie Z-940 con procesador neuronal embebido "
    "TensorEdge-Pro 16 TOPS, fuente redundante HotSwap-550W y licencia perpetua del motor "
    "propietario OmniTrack-Enterprise."
)

BASE_PAYLOAD = {
    "objeto": "Compra sintética de verificación (suite de pruebas)",
    "rubro": "Servicios Generales",
    "area_usuaria": "AREA-ADM-01",
    "modalidad": "Licitación Pública Abreviada",
    "monto_estimado": 150000.0,
    "precio_referencial_mercado": None,
    "tdr_texto": TDR_GENERICO,
    "proveedor_adjudicado_codigo": "PROV-SYN-010",
    "proveedores_postores": ["PROV-SYN-010", "PROV-SYN-016"],
    "fecha_creacion": "2025-06-10T09:00:00",
    "mismo_funcionario_etapas": False,
    "pago_sin_conformidad": False,
    "modificacion_extemporanea_tdr": False,
    "sin_sustento_documental": False,
    "entregable_incompleto_obra": False,
    "conflicto_interes_familiar": False,
    "rol_usuario": ROL_TXT[ROL_DEC],
}

# Verdad de terreno de los 12 expedientes forenses sembrados (diseño del dataset)
SEED_TRUTH = {
    "EXP-2025-UNT-0001": {R01, R08},
    "EXP-2025-UNT-0002": {R01},
    "EXP-2025-UNT-0003": {R01},
    "EXP-2025-UNT-0004": {R04},
    "EXP-2025-UNT-0005": {R04},
    "EXP-2025-UNT-0006": {R05},
    "EXP-2025-UNT-0007": {R02},
    "EXP-2025-UNT-0008": {R03},
    "EXP-2025-UNT-0009": {R07},
    "EXP-2025-UNT-0010": {R03},
    "EXP-2025-UNT-0011": {R09},
    "EXP-2025-UNT-0012": {R10},
}

# Resultados observados para el informe
OBS = {
    "seed": [],  # (codigo, esperado, detectado)
    "live": [],  # (nombre, esperado, detectado)
    "sha": [],  # (nombre, esperado, detectado)  -> solo R-06
    "latency": {},
    "rbac": [],  # (descripcion, esperado, obtenido)
    "tests": {},  # nombre -> "OK"/"FALLO"
}

client: TestClient = None  # type: ignore


def hdr(rol):
    return {"X-Centinela-Role": rol, "X-Centinela-User": USUARIOS[rol]}


def registrar(overrides, rol=ROL_DEC, esperar=200):
    payload = dict(BASE_PAYLOAD)
    payload.update(overrides)
    payload["rol_usuario"] = ROL_TXT[rol]
    r = client.post("/api/expedientes/simular-registro", json=payload, headers=hdr(rol))
    assert r.status_code == esperar, (r.status_code, r.text[:300])
    return r.json()


def detalle(exp_id, rol=ROL_OCI):
    r = client.get(f"/api/expedientes/{exp_id}", headers=hdr(rol))
    assert r.status_code == 200, r.text[:300]
    return r.json()


def reglas_de(det):
    return {a["codigo_regla"] for a in det["alertas"]}


def reset_dataset():
    r = client.post("/api/seed/regenerar", headers=hdr(ROL_OCI))
    assert r.status_code == 200, r.text[:300]
    return r.json()


def setUpModule():
    global client
    client = TestClient(app)
    client.__enter__()
    reset_dataset()


def tearDownModule():
    try:
        reset_dataset()
    finally:
        client.__exit__(None, None, None)
        _escribir_informe()
        if _TMP_DB.exists():
            try:
                _TMP_DB.unlink()
            except OSError:
                pass


# --------------------------------------------------------------------------- #
# Métricas
# --------------------------------------------------------------------------- #
def matriz_por_regla(muestras):
    res = {}
    for regla in ALL_RULES:
        tp = fp = fn = tn = 0
        for _, esperado, detectado in muestras:
            e, d = regla in esperado, regla in detectado
            if e and d:
                tp += 1
            elif d and not e:
                fp += 1
            elif e and not d:
                fn += 1
            else:
                tn += 1
        prec = tp / (tp + fp) if (tp + fp) else None
        rec = tp / (tp + fn) if (tp + fn) else None
        f1 = (2 * prec * rec / (prec + rec)) if prec and rec else (0.0 if (prec is not None and rec is not None) else None)
        fpr = fp / (fp + tn) if (fp + tn) else None
        res[regla] = {"TP": tp, "FP": fp, "FN": fn, "TN": tn, "precision": prec, "recall": rec, "f1": f1, "fpr": fpr}
    return res


def _fmt(v):
    return "n/a" if v is None else f"{v * 100:.1f} %"


def _escribir_informe():
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    muestras = OBS["seed"] + OBS["live"] + OBS["sha"]
    matriz = matriz_por_regla(muestras)

    total_tp = sum(m["TP"] for m in matriz.values())
    total_fp = sum(m["FP"] for m in matriz.values())
    total_fn = sum(m["FN"] for m in matriz.values())
    total_tn = sum(m["TN"] for m in matriz.values())

    lat = OBS["latency"]
    ahora = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    L = []
    L.append("# Informe de Pruebas y Efectividad — CENTINELA")
    L.append("")
    L.append(f"_Generado automáticamente el {ahora} por `backend/tests/test_efectividad.py` (datos 100 % sintéticos)._")
    L.append("")
    L.append("## 1. Resumen ejecutivo")
    L.append("")
    L.append(f"- Muestras evaluadas: **{len(OBS['seed'])}** expedientes sembrados + **{len(OBS['live'])}** casos etiquetados en vivo + **{len(OBS['sha'])}** pruebas de adulteración SHA-256.")
    L.append(f"- Decisiones regla×muestra: TP={total_tp} · FP={total_fp} · FN={total_fn} · TN={total_tn}.")
    L.append(f"- Falsos positivos totales: **{total_fp}** · Falsos negativos totales: **{total_fn}**.")
    limpios = [m for m in OBS["seed"] if not SEED_TRUTH.get(m[0])]
    fp_limpios = sum(1 for m in limpios if m[2])
    L.append(f"- Compras limpias sembradas evaluadas: **{len(limpios)}** → con alerta indebida: **{fp_limpios}**.")
    L.append("")
    L.append("## 2. Matriz de confusión por regla")
    L.append("")
    L.append("| Regla | TP | FP | FN | TN | Precisión | Recall | F1 | Tasa FP |")
    L.append("|---|---:|---:|---:|---:|---:|---:|---:|---:|")
    for regla, m in matriz.items():
        L.append(
            f"| {regla} | {m['TP']} | {m['FP']} | {m['FN']} | {m['TN']} | "
            f"{_fmt(m['precision'])} | {_fmt(m['recall'])} | {_fmt(m['f1'])} | {_fmt(m['fpr'])} |"
        )
    L.append("")
    L.append("## 3. Casos etiquetados en vivo (incluye fronteras de 8 UIT, sobreprecio +25 % y continuidad RNP)")
    L.append("")
    L.append("| Caso | Esperado | Detectado | Resultado |")
    L.append("|---|---|---|---|")
    for nombre, esperado, detectado in OBS["live"]:
        ok = "✅" if esperado == detectado else "❌"
        L.append(f"| {nombre} | {', '.join(sorted(esperado)) or '—'} | {', '.join(sorted(detectado)) or '—'} | {ok} |")
    L.append("")
    L.append("## 4. Rendimiento (milisegundos, sobre SQLite local)")
    L.append("")
    L.append("| Operación | Muestras | p50 | p95 | Máx |")
    L.append("|---|---:|---:|---:|---:|")
    for nombre, v in lat.items():
        L.append(f"| {nombre} | {v['n']} | {v['p50']:.0f} | {v['p95']:.0f} | {v['max']:.0f} |")
    L.append("")
    L.append("## 5. Control de accesos (RBAC) verificado")
    L.append("")
    L.append("| Verificación | Esperado | Obtenido | Resultado |")
    L.append("|---|---:|---:|---|")
    for desc, esp, obt in OBS["rbac"]:
        L.append(f"| {desc} | {esp} | {obt} | {'✅' if esp == obt else '❌'} |")
    L.append("")
    L.append("## 6. Pruebas automatizadas ejecutadas")
    L.append("")
    for nombre, estado in sorted(OBS["tests"].items()):
        L.append(f"- {'✅' if estado == 'OK' else '❌'} `{nombre}`")
    L.append("")
    L.append("## 7. Alcance y limitaciones honestas")
    L.append("")
    L.append("- La verdad de terreno de los 12 forenses proviene del diseño del dataset sintético; los casos en vivo son etiquetados manualmente por el equipo.")
    L.append("- Las métricas describen el desempeño sobre datos sintéticos; en un piloto real se recalibrarán umbrales con el OCI y la Oficina de Integridad.")
    L.append("- Las alertas son señales preventivas para revisión humana (Presunción de Licitud, Art. 248 Ley N° 27444), no acusaciones.")
    L.append("")

    payload_informe = {
        "generado": ahora,
        "comando": "cd backend && python -m unittest discover -s tests -v",
        "resumen_muestras": {
            "expedientes_sembrados": len(OBS["seed"]),
            "compras_limpias": len(limpios),
            "alertas_indebidas_en_limpias": fp_limpios,
            "casos_en_vivo": len(OBS["live"]),
            "pruebas_sha256": len(OBS["sha"]),
            "total_pruebas": len(OBS["tests"]),
            "pruebas_aprobadas": sum(1 for v in OBS["tests"].values() if v == "OK"),
        },
        "totales": {"TP": total_tp, "FP": total_fp, "FN": total_fn, "TN": total_tn},
        "matriz_por_regla": matriz,
        "casos_en_vivo": [
            {"caso": n, "esperado": sorted(e), "detectado": sorted(d)} for n, e, d in OBS["live"]
        ],
        "latencias_ms": lat,
        "rbac": [{"verificacion": d, "esperado": e, "obtenido": o} for d, e, o in OBS["rbac"]],
        "pruebas_ejecutadas": [
            {"nombre": k, "estado": v} for k, v in sorted(OBS["tests"].items())
        ],
    }

    (REPORT_DIR / "resultados_efectividad.md").write_text("\n".join(L), encoding="utf-8")
    (REPORT_DIR / "resultados_efectividad.json").write_text(
        json.dumps(payload_informe, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    snapshot_source = (
        '"""\n'
        "Snapshot reproducible de validación y efectividad de CENTINELA.\n\n"
        "Generado automáticamente por `backend/tests/test_efectividad.py` para garantizar\n"
        "disponibilidad 100 % determinista en despliegues serverless (Vercel `app.main:app`)\n"
        "incluso cuando el directorio `tests/` no se incluye en el paquete de ejecución.\n"
        '"""\n\n'
        f"VALIDATION_SNAPSHOT = {pprint.pformat(payload_informe, width=100, sort_dicts=False)}\n"
    )
    SNAPSHOT_FILE.write_text(snapshot_source, encoding="utf-8")


def _stats(valores):
    v = sorted(valores)
    p95 = v[min(len(v) - 1, int(round(0.95 * (len(v) - 1))))]
    return {"n": len(v), "p50": statistics.median(v), "p95": p95, "max": v[-1]}


class _Registro(unittest.TestCase):
    """Base que anota en OBS['tests'] el estado de cada prueba."""

    def run(self, result=None):
        antes = len(result.failures) + len(result.errors) if result else 0
        out = super().run(result)
        if result is not None:
            despues = len(result.failures) + len(result.errors)
            OBS["tests"][f"{type(self).__name__}.{self._testMethodName}"] = "OK" if despues == antes else "FALLO"
        return out


# --------------------------------------------------------------------------- #
# 1. Detección sobre el dataset sembrado (120 expedientes)
# --------------------------------------------------------------------------- #
class TestDeteccionDatasetBase(_Registro):
    @classmethod
    def setUpClass(cls):
        reset_dataset()
        cls.lista = client.get("/api/expedientes", headers=hdr(ROL_OCI)).json()
        OBS["seed"].clear()
        for e in cls.lista:
            det = detalle(e["id"])
            OBS["seed"].append((e["codigo"], SEED_TRUTH.get(e["codigo"], set()), reglas_de(det)))

    def test_dataset_tiene_120_expedientes(self):
        self.assertEqual(len(self.lista), 120)

    def test_cero_falsos_positivos_en_compras_limpias(self):
        limpias = [c for c, esp, _ in OBS["seed"] if not esp]
        self.assertEqual(len(limpias), 108)
        indebidas = [c for c, esp, det in OBS["seed"] if not esp and det]
        self.assertEqual(indebidas, [], f"Compras limpias con alerta indebida: {indebidas}")

    def test_forenses_detectan_exactamente_las_reglas_esperadas(self):
        for codigo, esperado in SEED_TRUTH.items():
            detectado = next(det for c, _, det in OBS["seed"] if c == codigo)
            with self.subTest(expediente=codigo):
                self.assertEqual(detectado, esperado)

    def test_kpi_salud_preventiva_coherente(self):
        k = client.get("/api/dashboard", headers=hdr(ROL_OCI)).json()
        self.assertEqual(k["total_expedientes"], 120)
        self.assertEqual(k["expedientes_limpios"], 108)
        self.assertGreaterEqual(k["porcentaje_limpios"], 90.0)


# --------------------------------------------------------------------------- #
# 2. Casos etiquetados en vivo (positivos, negativos y fronteras)
# --------------------------------------------------------------------------- #
CASOS_VIVO = [
    # (nombre, [órdenes a registrar], reglas esperadas en la ÚLTIMA orden)
    ("N1 Compra limpia estándar", [{}], set()),
    (
        "N2 Contratación menor aislada (40 000, sin hermanas)",
        [
            {
                "modalidad": "Contratación Menor (<= 8 UIT)",
                "monto_estimado": 40000.0,
                "area_usuaria": "AREA-ADM-05",
                "fecha_creacion": "2025-07-08T09:00:00",
                "proveedor_adjudicado_codigo": "PROV-SYN-011",
                "proveedores_postores": ["PROV-SYN-011", "PROV-SYN-019"],
            }
        ],
        set(),
    ),
    (
        "N3 Frontera 8 UIT: 21 400 + 21 400 = 42 800 (no excede)",
        [
            {
                "modalidad": "Contratación Menor (<= 8 UIT)",
                "monto_estimado": 21400.0,
                "area_usuaria": "AREA-ADM-07",
                "fecha_creacion": "2025-08-04T09:00:00",
                "proveedor_adjudicado_codigo": "PROV-SYN-013",
                "proveedores_postores": ["PROV-SYN-013", "PROV-SYN-019"],
            },
            {
                "modalidad": "Contratación Menor (<= 8 UIT)",
                "monto_estimado": 21400.0,
                "area_usuaria": "AREA-ADM-07",
                "fecha_creacion": "2025-08-12T09:00:00",
                "proveedor_adjudicado_codigo": "PROV-SYN-013",
                "proveedores_postores": ["PROV-SYN-013", "PROV-SYN-019"],
            },
        ],
        set(),
    ),
    (
        "N4 Mismo mes, proveedores distintos (sin fraccionamiento)",
        [
            {
                "modalidad": "Contratación Menor (<= 8 UIT)",
                "monto_estimado": 30000.0,
                "area_usuaria": "AREA-ADM-06",
                "fecha_creacion": "2025-09-03T09:00:00",
                "proveedor_adjudicado_codigo": "PROV-SYN-010",
                "proveedores_postores": ["PROV-SYN-010", "PROV-SYN-016"],
            },
            {
                "modalidad": "Contratación Menor (<= 8 UIT)",
                "monto_estimado": 30000.0,
                "area_usuaria": "AREA-ADM-06",
                "fecha_creacion": "2025-09-15T09:00:00",
                "proveedor_adjudicado_codigo": "PROV-SYN-016",
                "proveedores_postores": ["PROV-SYN-016", "PROV-SYN-010"],
            },
        ],
        set(),
    ),
    (
        "N5 TDR legítimo de equipamiento TI (sin copia de catálogo)",
        [
            {
                "rubro": "Tecnología y Equipamiento Computacional",
                "area_usuaria": "AREA-TI-09",
                "tdr_texto": TDR_LEGITIMO_TI,
                "proveedor_adjudicado_codigo": "PROV-SYN-001",
                "proveedores_postores": ["PROV-SYN-001", "PROV-SYN-010"],
                "fecha_creacion": "2025-06-20T09:00:00",
            }
        ],
        set(),
    ),
    (
        "P1 Frontera 8 UIT: 21 400 + 21 401 = 42 801 (excede)",
        [
            {
                "modalidad": "Contratación Menor (<= 8 UIT)",
                "monto_estimado": 21400.0,
                "area_usuaria": "AREA-ADM-08",
                "fecha_creacion": "2025-10-04T09:00:00",
                "proveedor_adjudicado_codigo": "PROV-SYN-012",
                "proveedores_postores": ["PROV-SYN-012", "PROV-SYN-019"],
            },
            {
                "modalidad": "Contratación Menor (<= 8 UIT)",
                "monto_estimado": 21401.0,
                "area_usuaria": "AREA-ADM-08",
                "fecha_creacion": "2025-10-12T09:00:00",
                "proveedor_adjudicado_codigo": "PROV-SYN-012",
                "proveedores_postores": ["PROV-SYN-012", "PROV-SYN-019"],
            },
        ],
        {R01},
    ),
    ("P2 Pago sin conformidad", [{"pago_sin_conformidad": True, "fecha_creacion": "2025-06-11T09:00:00"}], {R03}),
    (
        "P3 Entregable obligatorio incompleto (pozo a tierra)",
        [
            {
                "entregable_incompleto_obra": True,
                "rubro": "Infraestructura y Mantenimiento Eléctrico",
                "area_usuaria": "AREA-INFRA-09",
                "fecha_creacion": "2025-06-12T09:00:00",
            }
        ],
        {R03},
    ),
    ("P4 Segregación de funciones vulnerada", [{"mismo_funcionario_etapas": True, "fecha_creacion": "2025-06-13T09:00:00"}], {R02}),
    (
        "P5 TDR v2.1 extemporáneo sin sustento",
        [{"modificacion_extemporanea_tdr": True, "sin_sustento_documental": True, "fecha_creacion": "2025-06-14T09:00:00"}],
        {R07},
    ),
    (
        "P6 Conflicto de interés familiar con adjudicatario",
        [
            {
                "conflicto_interes_familiar": True,
                "proveedor_adjudicado_codigo": "PROV-SYN-014",
                "proveedores_postores": ["PROV-SYN-014", "PROV-SYN-010"],
                "fecha_creacion": "2025-06-15T09:00:00",
            }
        ],
        {R08},
    ),
    (
        "P7 Colusión: postores con representante compartido",
        [
            {
                "proveedor_adjudicado_codigo": "PROV-SYN-004",
                "proveedores_postores": ["PROV-SYN-004", "PROV-SYN-005"],
                "fecha_creacion": "2025-06-16T09:00:00",
            }
        ],
        {R04},
    ),
    (
        "P8 TDR copiado literal del catálogo de un proveedor",
        [
            {
                "rubro": "Tecnología y Equipamiento Computacional",
                "area_usuaria": "AREA-TI-10",
                "tdr_texto": TDR_COPIADO_PROV014,
                "proveedor_adjudicado_codigo": "PROV-SYN-014",
                "proveedores_postores": ["PROV-SYN-014", "PROV-SYN-010"],
                "fecha_creacion": "2025-06-17T09:00:00",
            }
        ],
        {R05},
    ),
    (
        "M1 Combinada: v2.1 extemporáneo + mismo funcionario",
        [
            {
                "modificacion_extemporanea_tdr": True,
                "sin_sustento_documental": True,
                "mismo_funcionario_etapas": True,
                "fecha_creacion": "2025-06-18T09:00:00",
            }
        ],
        {R07, R02},
    ),
    (
        "M2 Combinada: colusión + pago sin conformidad",
        [
            {
                "proveedor_adjudicado_codigo": "PROV-SYN-004",
                "proveedores_postores": ["PROV-SYN-004", "PROV-SYN-005"],
                "pago_sin_conformidad": True,
                "fecha_creacion": "2025-06-19T09:00:00",
            }
        ],
        {R04, R03},
    ),
    (
        "P9 Colusión societaria: mismo socio/inversor con distinto gerente y oficina",
        [
            {
                "rubro": "Servicios de Conectividad y Ciberseguridad",
                "area_usuaria": "AREA-TI-12",
                "proveedor_adjudicado_codigo": "PROV-SYN-025",
                "proveedores_postores": ["PROV-SYN-025", "PROV-SYN-026"],
                "fecha_creacion": "2025-06-25T09:00:00",
            }
        ],
        {R04},
    ),
    (
        "N6 Frontera Sobreprecio: +25.0 % exacto (125 000 vs 100 000, no excede)",
        [
            {
                "monto_estimado": 125000.0,
                "precio_referencial_mercado": 100000.0,
                "fecha_creacion": "2025-06-26T09:00:00",
            }
        ],
        set(),
    ),
    (
        "P10 Frontera Sobreprecio: +25.1 % (125 100 vs 100 000, excede)",
        [
            {
                "monto_estimado": 125100.0,
                "precio_referencial_mercado": 100000.0,
                "fecha_creacion": "2025-06-27T09:00:00",
            }
        ],
        {R10},
    ),
    (
        "P11 Continuidad Económica: empresa nueva PROV-SYN-028 ligada a liquidada PROV-SYN-027",
        [
            {
                "rubro": "Tecnología y Equipamiento Computacional",
                "area_usuaria": "AREA-TI-13",
                "proveedor_adjudicado_codigo": "PROV-SYN-028",
                "proveedores_postores": ["PROV-SYN-028", "PROV-SYN-001"],
                "fecha_creacion": "2025-06-28T09:00:00",
            }
        ],
        {R09},
    ),
    (
        "P12 Proveedor sancionado directo (PROV-SYN-027) intentando contratar",
        [
            {
                "rubro": "Tecnología y Equipamiento Computacional",
                "area_usuaria": "AREA-TI-14",
                "proveedor_adjudicado_codigo": "PROV-SYN-027",
                "proveedores_postores": ["PROV-SYN-027", "PROV-SYN-001"],
                "fecha_creacion": "2025-06-29T09:00:00",
            }
        ],
        {R09},
    ),
]


class TestDeteccionEnVivo(_Registro):
    def test_casos_etiquetados(self):
        OBS["live"].clear()
        tiempos = []
        for nombre, ordenes, esperado in CASOS_VIVO:
            for i, ov in enumerate(ordenes):
                t0 = time.perf_counter()
                creado = registrar(ov)
                tiempos.append((time.perf_counter() - t0) * 1000)
                det = detalle(creado["id"])
                es_ultima = i == len(ordenes) - 1
                exp = esperado if es_ultima else set()
                etiqueta = nombre if es_ultima else f"{nombre} (orden previa {i + 1})"
                OBS["live"].append((etiqueta, exp, reglas_de(det)))
        OBS["latency"]["Registrar expediente + sellar 6 etapas + 10 reglas XAI"] = _stats(tiempos)
        for nombre, esperado, detectado in OBS["live"]:
            with self.subTest(caso=nombre):
                self.assertEqual(detectado, esperado)

    def test_caso_aulas_activa_candado_de_pago(self):
        creado = registrar(
            {
                "entregable_incompleto_obra": True,
                "rubro": "Infraestructura y Mantenimiento Eléctrico",
                "area_usuaria": "AREA-INFRA-11",
                "fecha_creacion": "2025-06-21T09:00:00",
            }
        )
        det = detalle(creado["id"])
        self.assertTrue(det["pago_bloqueado_preventivo"])
        pendientes = [e for e in det["entregables_tdr"] if e["obligatorio"] and not e["cumplido"]]
        self.assertGreaterEqual(len(pendientes), 1)
        self.assertIn("pozo a tierra", " ".join(e["nombre"].lower() for e in pendientes))

    def test_registro_en_vivo_nace_con_cadena_integra(self):
        creado = registrar({"fecha_creacion": "2025-06-22T09:00:00"})
        det = detalle(creado["id"])
        self.assertTrue(det["verificacion_sha256"]["integridad_global"])
        self.assertEqual(len(det["verificacion_sha256"]["eslabones"]), 6)


# --------------------------------------------------------------------------- #
# 3. Integridad SHA-256: adulteración de cada una de las 6 etapas
# --------------------------------------------------------------------------- #
class TestIntegridadSHA256(_Registro):
    def test_adulteracion_de_cada_etapa_rompe_la_cadena_en_cascada(self):
        OBS["sha"].clear()
        for idx, etapa in enumerate(ETAPAS):
            with self.subTest(etapa=etapa):
                creado = registrar({"fecha_creacion": f"2025-11-{idx + 1:02d}T09:00:00", "area_usuaria": f"AREA-SHA-{idx + 1:02d}"})
                eid = creado["id"]
                antes = detalle(eid)
                OBS["sha"].append((f"SHA {etapa}: expediente intacto", set(), reglas_de(antes)))
                self.assertTrue(antes["verificacion_sha256"]["integridad_global"])

                r = client.post(
                    f"/api/expedientes/{eid}/simular-alteracion",
                    json={"etapa_objetivo": etapa},
                    headers=hdr(ROL_OCI),
                )
                self.assertEqual(r.status_code, 200, r.text[:200])
                v = r.json()
                self.assertFalse(v["integridad_global"])
                self.assertEqual(v["etapa_comprometida"], etapa)
                self.assertEqual(v["orden_comprometido"], idx + 1)
                for j, e in enumerate(v["eslabones"]):
                    if j < idx:
                        self.assertTrue(e["es_integro"] and e["enlace_anterior_valido"], f"{e['etapa']} previa no debe afectarse")
                    elif j == idx:
                        self.assertFalse(e["es_integro"], "La etapa alterada debe marcarse como no íntegra")
                    else:
                        self.assertFalse(e["enlace_anterior_valido"], f"{e['etapa']} posterior debe romper el encadenado")

                tras = detalle(eid)
                OBS["sha"].append((f"SHA {etapa}: tras adulteración", {R06}, reglas_de(tras)))
                self.assertIn(R06, reglas_de(tras))

                rr = client.post(f"/api/expedientes/{eid}/restaurar-integridad", headers=hdr(ROL_OCI))
                self.assertEqual(rr.status_code, 200)
                self.assertTrue(rr.json()["integridad_global"])
                restaurado = detalle(eid)
                OBS["sha"].append((f"SHA {etapa}: tras restaurar", set(), reglas_de(restaurado)))
                self.assertNotIn(R06, reglas_de(restaurado))

    def test_dec_y_publico_no_pueden_adulterar_ni_restaurar(self):
        creado = registrar({"fecha_creacion": "2025-12-01T09:00:00", "area_usuaria": "AREA-SHA-99"})
        eid = creado["id"]
        for rol in (ROL_DEC, ROL_PUB):
            for ruta in ("simular-alteracion", "restaurar-integridad"):
                r = client.post(f"/api/expedientes/{eid}/{ruta}", json={}, headers=hdr(rol))
                OBS["rbac"].append((f"{rol} → POST {ruta}", 403, r.status_code))
                self.assertEqual(r.status_code, 403)
        self.assertTrue(detalle(eid)["verificacion_sha256"]["integridad_global"])


# --------------------------------------------------------------------------- #
# 4. Candado preventivo de pago por entregables del TDR
# --------------------------------------------------------------------------- #
class TestCandadoDePago(_Registro):
    def test_verificar_y_reobservar_entregable(self):
        creado = registrar(
            {
                "entregable_incompleto_obra": True,
                "rubro": "Infraestructura y Mantenimiento Eléctrico",
                "area_usuaria": "AREA-INFRA-12",
                "fecha_creacion": "2025-06-23T09:00:00",
            }
        )
        eid = creado["id"]
        det = detalle(eid)
        self.assertTrue(det["pago_bloqueado_preventivo"])
        pend = [e for e in det["entregables_tdr"] if e["obligatorio"] and not e["cumplido"]][0]

        # Público no puede verificar
        r = client.patch(
            f"/api/entregables/{pend['id']}/verificar",
            json={"cumplido": True, "evidencia_tecnica": "Intento indebido"},
            headers=hdr(ROL_PUB),
        )
        OBS["rbac"].append(("CONSULTA → PATCH verificar entregable", 403, r.status_code))
        self.assertEqual(r.status_code, 403)
        self.assertTrue(detalle(eid)["pago_bloqueado_preventivo"])

        # DEC verifica con sustento técnico → se levanta el bloqueo
        r = client.patch(
            f"/api/entregables/{pend['id']}/verificar",
            json={"cumplido": True, "evidencia_tecnica": "Protocolo de pozo a tierra INF-001 + 6 fotos"},
            headers=hdr(ROL_DEC),
        )
        self.assertEqual(r.status_code, 200, r.text[:200])
        self.assertFalse(detalle(eid)["pago_bloqueado_preventivo"])

        # Re-observación → el bloqueo vuelve
        r = client.patch(
            f"/api/entregables/{pend['id']}/verificar",
            json={"cumplido": False, "evidencia_tecnica": ""},
            headers=hdr(ROL_DEC),
        )
        self.assertEqual(r.status_code, 200)
        self.assertTrue(detalle(eid)["pago_bloqueado_preventivo"])


# --------------------------------------------------------------------------- #
# 5. Control de accesos (RBAC) y separación de funciones
# --------------------------------------------------------------------------- #
class TestRBAC(_Registro):
    @classmethod
    def setUpClass(cls):
        reset_dataset()

    def _chequear(self, desc, rol, metodo, ruta, esperado, **kw):
        r = client.request(metodo, ruta, headers=hdr(rol), **kw)
        OBS["rbac"].append((desc, esperado, r.status_code))
        self.assertEqual(r.status_code, esperado, f"{desc}: {r.text[:200]}")
        return r

    def test_endpoints_exclusivos_de_oci_devuelven_403_a_dec_y_publico(self):
        for rol in (ROL_DEC, ROL_PUB):
            self._chequear(f"{rol} → POST /api/seed/regenerar", rol, "POST", "/api/seed/regenerar", 403)
            self._chequear(f"{rol} → GET /api/auditoria", rol, "GET", "/api/auditoria", 403)
            self._chequear(f"{rol} → GET /api/denuncias (bandeja OCI)", rol, "GET", "/api/denuncias", 403)

    def test_oci_accede_a_endpoints_exclusivos(self):
        self._chequear("OCI → GET /api/auditoria", ROL_OCI, "GET", "/api/auditoria", 200)
        self._chequear("OCI → GET /api/denuncias", ROL_OCI, "GET", "/api/denuncias", 200)

    def test_publico_no_puede_registrar_compras(self):
        payload = dict(BASE_PAYLOAD)
        payload["rol_usuario"] = ROL_TXT[ROL_PUB]
        self._chequear(
            "CONSULTA → POST simular-registro",
            ROL_PUB,
            "POST",
            "/api/expedientes/simular-registro",
            403,
            json=payload,
        )

    def test_dec_no_puede_cerrar_alertas_ni_publico_modificarlas(self):
        alerta = client.get("/api/alertas", headers=hdr(ROL_OCI)).json()[0]
        cuerpo = {"estado_revision": "ARCHIVADA_SUSTENTADA", "comentario_descargo": "Intento de cierre indebido"}
        self._chequear(
            "DEC → PATCH alerta ARCHIVADA_SUSTENTADA",
            ROL_DEC,
            "PATCH",
            f"/api/alertas/{alerta['id']}",
            403,
            json={**cuerpo, "rol_usuario": ROL_TXT[ROL_DEC]},
        )
        self._chequear(
            "CONSULTA → PATCH alerta",
            ROL_PUB,
            "PATCH",
            f"/api/alertas/{alerta['id']}",
            403,
            json={**cuerpo, "rol_usuario": ROL_TXT[ROL_PUB]},
        )

    def test_dec_si_puede_responder_descargo(self):
        alerta = client.get("/api/alertas", headers=hdr(ROL_OCI)).json()[0]
        r = self._chequear(
            "DEC → PATCH alerta EN_DESCARGO",
            ROL_DEC,
            "PATCH",
            f"/api/alertas/{alerta['id']}",
            200,
            json={
                "estado_revision": "EN_DESCARGO",
                "comentario_descargo": "Descargo y acción correctiva presentados por el área.",
                "accion_correctiva": "Subsanar documentación observada.",
                "rol_usuario": ROL_TXT[ROL_DEC],
            },
        )
        self.assertNotIn("))", r.json().get("rol_ultimo_cambio") or "")

    def test_flujo_completo_derivacion_descargo_y_archivo_bloquea_reapertura_dec(self):
        creado = registrar(
            {
                "mismo_funcionario_etapas": True,
                "fecha_creacion": "2025-12-15T09:00:00",
                "area_usuaria": "AREA-RBAC-99",
            }
        )
        eid = creado["id"]
        aid = creado["alertas"][0]["id"]

        # Paso 1: OCI deriva a DEC para descargo
        r1 = client.patch(
            f"/api/alertas/{aid}",
            headers=hdr(ROL_OCI),
            json={
                "estado_revision": "EN_DESCARGO",
                "area_asignada": "DEC — Dependencia Encargada de Contrataciones",
                "fecha_limite": "2026-12-05",
                "accion_correctiva": "Presentar informe técnico-normativo sustentatorio.",
                "comentario_descargo": "Se deriva preliminarmente al área responsable solicitando descargo.",
                "rol_usuario": ROL_TXT[ROL_OCI],
            },
        )
        self.assertEqual(r1.status_code, 200, r1.text[:200])
        j1 = r1.json()
        self.assertEqual(j1["estado_revision"], "EN_DESCARGO")
        self.assertEqual(j1["fecha_limite"], "2026-12-05")
        self.assertNotIn("))", j1["rol_ultimo_cambio"] or "")
        self.assertEqual(detalle(eid)["estado_expediente"], "En Descargo DEC")

        # Paso 2: DEC presenta descargo técnico
        r2 = client.patch(
            f"/api/alertas/{aid}",
            headers=hdr(ROL_DEC),
            json={
                "estado_revision": "EN_DESCARGO",
                "accion_correctiva": "Adecuar especificaciones y adjuntar evidencia verificable.",
                "comentario_descargo": "Se remite informe técnico sustentatorio de la DEC.",
                "rol_usuario": ROL_TXT[ROL_DEC],
            },
        )
        self.assertEqual(r2.status_code, 200, r2.text[:200])
        self.assertNotIn("))", r2.json()["rol_ultimo_cambio"] or "")

        # Paso 3: OCI da por sustentada la señal y dispone su archivo (limpia SLA)
        r3 = client.patch(
            f"/api/alertas/{aid}",
            headers=hdr(ROL_OCI),
            json={
                "estado_revision": "ARCHIVADA_SUSTENTADA",
                "area_asignada": "",
                "fecha_limite": "",
                "accion_correctiva": "Archivo definitivo de la señal preventiva por sustento firme.",
                "comentario_descargo": "Evaluado el descargo técnico, OCI dispone el archivo motivado.",
                "rol_usuario": ROL_TXT[ROL_OCI],
            },
        )
        self.assertEqual(r3.status_code, 200, r3.text[:200])
        j3 = r3.json()
        self.assertEqual(j3["estado_revision"], "ARCHIVADA_SUSTENTADA")
        self.assertIsNone(j3["fecha_limite"])
        self.assertEqual(j3["area_asignada"], "OCI — Archivo de Control Preventivo")
        self.assertNotIn("))", j3["rol_ultimo_cambio"] or "")
        self.assertEqual(detalle(eid)["estado_expediente"], "Sustentado y Archivado OCI")

        # Paso 4: DEC intenta reabrir o sobrescribir la alerta archivada → HTTP 403
        self._chequear(
            "DEC → PATCH alerta ya archivada por OCI",
            ROL_DEC,
            "PATCH",
            f"/api/alertas/{aid}",
            403,
            json={
                "estado_revision": "EN_DESCARGO",
                "comentario_descargo": "Intento no autorizado de reabrir archivo OCI.",
                "rol_usuario": ROL_TXT[ROL_DEC],
            },
        )

        # Paso 5: OCI reabre con dictamen VALIDADA_OCI y DEC tampoco puede sobrescribirlo → HTTP 403
        r5 = client.patch(
            f"/api/alertas/{aid}",
            headers=hdr(ROL_OCI),
            json={
                "estado_revision": "VALIDADA_OCI",
                "area_asignada": "DEC — Dependencia Encargada de Contrataciones",
                "fecha_limite": "2026-12-10",
                "accion_correctiva": "Emitir Informe de Hito de Control Simultáneo.",
                "comentario_descargo": "Se confirma la observación preventiva XAI.",
                "rol_usuario": ROL_TXT[ROL_OCI],
            },
        )
        self.assertEqual(r5.status_code, 200, r5.text[:200])
        self.assertEqual(detalle(eid)["estado_expediente"], "Observado — Hito de Control OCI")

        self._chequear(
            "DEC → PATCH alerta con dictamen VALIDADA_OCI",
            ROL_DEC,
            "PATCH",
            f"/api/alertas/{aid}",
            403,
            json={
                "estado_revision": "EN_DESCARGO",
                "comentario_descargo": "Intento no autorizado de sobrescribir dictamen OCI.",
                "rol_usuario": ROL_TXT[ROL_DEC],
            },
        )

    def test_intentos_bloqueados_quedan_registrados_en_bitacora(self):
        client.post("/api/seed/regenerar", headers=hdr(ROL_DEC))
        client.get("/api/auditoria", headers=hdr(ROL_PUB))
        aud = client.get("/api/auditoria", headers=hdr(ROL_OCI)).json()
        self.assertGreaterEqual(aud["total_bloqueados"], 1)
        self.assertTrue(aud["cadena_integra"])


# --------------------------------------------------------------------------- #
# 6. Canal de denuncia: privacidad y reserva de identidad
# --------------------------------------------------------------------------- #
class TestCanalDenuncia(_Registro):
    SECRETO = "SECRETO-INTERNO-OCI-NO-EXPONER-1234"

    def test_consulta_publica_no_expone_datos_internos(self):
        r = client.post(
            "/api/denuncias",
            json={
                "categoria": "Fraccionamiento / Direccionamiento de Compras",
                "area_involucrada": "AREA-TI-03",
                "descripcion_hechos": "Reporte sintético para verificar la reserva de identidad del denunciante.",
                "sustento_verificable": "Órdenes SIGA N° 4410 y 4411 registradas en el módulo logístico.",
                "solicita_proteccion": True,
            },
            headers=hdr(ROL_PUB),
        )
        self.assertEqual(r.status_code, 200, r.text[:200])
        creada = r.json()
        codigo = creada["codigo_seguimiento"]
        self.assertTrue(codigo.startswith("DEN-2026-"))
        self.assertNotIn("id", creada)
        self.assertNotIn("nota_interna_oci", creada)
        self.assertNotIn("sustento_verificable", creada)

        bandeja = client.get("/api/denuncias", headers=hdr(ROL_OCI)).json()
        den_id = next(d["id"] for d in bandeja if d["codigo_seguimiento"] == codigo)
        r = client.patch(
            f"/api/denuncias/{den_id}",
            json={
                "estado": "DERIVADA",
                "organo_derivado": "OCI — Órgano de Control Institucional",
                "medida_proteccion": "Protección Laboral Anti-Represalias (Concedida)",
                "respuesta_seguimiento": "Su reporte fue derivado al órgano competente.",
                "nota_interna_oci": self.SECRETO,
            },
            headers=hdr(ROL_OCI),
        )
        self.assertEqual(r.status_code, 200, r.text[:200])

        pub = client.get(f"/api/denuncias/consultar/{codigo}", headers=hdr(ROL_PUB))
        self.assertEqual(pub.status_code, 200)
        cuerpo = pub.json()
        for campo in ("id", "nota_interna_oci", "descripcion_hechos", "sustento_verificable", "gestionado_por"):
            self.assertNotIn(campo, cuerpo)
        self.assertNotIn(self.SECRETO, pub.text)
        self.assertEqual(cuerpo["estado"], "DERIVADA")

    def test_codigo_inexistente_devuelve_404(self):
        r = client.get("/api/denuncias/consultar/DEN-2026-9999", headers=hdr(ROL_PUB))
        self.assertEqual(r.status_code, 404)

    def test_descripcion_muy_corta_es_rechazada(self):
        r = client.post(
            "/api/denuncias",
            json={
                "categoria": "Otros",
                "area_involucrada": "N/D",
                "descripcion_hechos": "corto",
                "sustento_verificable": "Acta de recepción N° 220-2025 verificable en archivo",
                "solicita_proteccion": False,
            },
            headers=hdr(ROL_PUB),
        )
        self.assertIn(r.status_code, (400, 422))

    def test_denuncia_comentario_sin_sustento_verificable_es_rechazada(self):
        r = client.post(
            "/api/denuncias",
            json={
                "categoria": "Cobro o Favoritismo a Proveedor",
                "area_involucrada": "AREA-ADM-04",
                "descripcion_hechos": "Comentario genérico sin referencia documental ni ubicación comprobable.",
                "sustento_verificable": "ninguna",
                "solicita_proteccion": False,
            },
            headers=hdr(ROL_PUB),
        )
        self.assertIn(r.status_code, (400, 422))

    def test_publico_y_dec_no_pueden_gestionar_denuncias(self):
        bandeja = client.get("/api/denuncias", headers=hdr(ROL_OCI)).json()
        den_id = bandeja[0]["id"]
        cuerpo = {
            "estado": "ATENDIDA",
            "organo_derivado": "N/D",
            "medida_proteccion": "N/D",
            "respuesta_seguimiento": "Intento indebido de gestión.",
            "nota_interna_oci": "Intento indebido de nota interna.",
        }
        for rol in (ROL_DEC, ROL_PUB):
            r = client.patch(f"/api/denuncias/{den_id}", json=cuerpo, headers=hdr(rol))
            OBS["rbac"].append((f"{rol} → PATCH gestión de denuncia", 403, r.status_code))
            self.assertEqual(r.status_code, 403)

    def test_ciclo_vida_completo_denuncia_y_cruce_expediente(self):
        exps = client.get("/api/expedientes", headers=hdr(ROL_OCI)).json()
        exp_15 = next(e for e in exps if e["codigo"] == "EXP-2025-UNT-0015")
        exp_id = exp_15["id"]

        r_post = client.post(
            "/api/denuncias",
            json={
                "categoria": "Cobro o Favoritismo a Proveedor",
                "area_involucrada": exp_15["area_usuaria"],
                "expediente_codigo": "EXP-2025-UNT-0015",
                "descripcion_hechos": "Reporte ciudadano sintético sobre posible trato preferencial no visible en documentos.",
                "sustento_verificable": "Cuadro comparativo de cotizaciones SIGA N° 2025-0015 en archivo de logística.",
                "solicita_proteccion": False,
            },
            headers=hdr(ROL_PUB),
        )
        self.assertEqual(r_post.status_code, 200, r_post.text[:200])
        creada = r_post.json()
        codigo = creada["codigo_seguimiento"]
        self.assertEqual(creada["estado"], "RECIBIDA")

        bandeja = client.get("/api/denuncias", headers=hdr(ROL_OCI)).json()
        item_oci = next(d for d in bandeja if d["codigo_seguimiento"] == codigo)
        den_id = item_oci["id"]
        self.assertEqual(item_oci["expediente_id"], exp_id)
        self.assertEqual(item_oci["alertas_xai_expediente"], 0)
        self.assertIn("SIGA N° 2025-0015", item_oci["sustento_verificable"])
        self.assertFalse(item_oci["solicita_proteccion"])

        r_eval = client.patch(
            f"/api/denuncias/{den_id}",
            json={
                "estado": "EN_EVALUACION",
                "organo_derivado": "Oficina de Integridad — Evaluación de Admisibilidad",
                "medida_proteccion": "Reserva de Identidad (D.L. N° 1327)",
                "respuesta_seguimiento": f"Su reporte {codigo} se encuentra en evaluación de admisibilidad.",
                "nota_interna_oci": "Evaluación preliminar de admisibilidad y cruce con EXP-2025-UNT-0015.",
            },
            headers=hdr(ROL_OCI),
        )
        self.assertEqual(r_eval.status_code, 200, r_eval.text[:200])
        self.assertEqual(r_eval.json()["estado"], "EN_EVALUACION")

        r_der = client.patch(
            f"/api/denuncias/{den_id}",
            json={
                "estado": "DERIVADA",
                "organo_derivado": "OCI — Órgano de Control Institucional",
                "medida_proteccion": "Reserva de Identidad (D.L. N° 1327)",
                "respuesta_seguimiento": f"Reporte {codigo} admitido y derivado al OCI.",
                "nota_interna_oci": "Se deriva a control institucional para verificación reservada.",
            },
            headers=hdr(ROL_OCI),
        )
        self.assertEqual(r_der.status_code, 200, r_der.text[:200])
        self.assertNotIn("))", r_der.json().get("gestionado_por") or "")
        self.assertEqual(detalle(exp_id)["estado_expediente"], "En Investigación — Canal Denuncia")

        r_fin = client.patch(
            f"/api/denuncias/{den_id}",
            json={
                "estado": "ATENDIDA",
                "organo_derivado": "OCI — Órgano de Control Institucional",
                "medida_proteccion": "Reserva de Identidad (D.L. N° 1327)",
                "fecha_limite_sla": "Concluido",
                "respuesta_seguimiento": f"La atención de su reporte {codigo} concluyó satisfactoriamente.",
                "nota_interna_oci": self.SECRETO,
            },
            headers=hdr(ROL_OCI),
        )
        self.assertEqual(r_fin.status_code, 200, r_fin.text[:200])
        self.assertEqual(r_fin.json()["fecha_limite_sla"], "Concluido")

        pub = client.get(f"/api/denuncias/consultar/{codigo}", headers=hdr(ROL_PUB))
        self.assertEqual(pub.status_code, 200)
        cuerpo_pub = pub.json()
        self.assertEqual(cuerpo_pub["estado"], "ATENDIDA")
        self.assertEqual(cuerpo_pub["fecha_limite_sla"], "Concluido")
        for campo_interno in (
            "id",
            "nota_interna_oci",
            "descripcion_hechos",
            "sustento_verificable",
            "gestionado_por",
            "expediente_id",
            "alertas_xai_expediente",
        ):
            self.assertNotIn(campo_interno, cuerpo_pub)
        self.assertNotIn(self.SECRETO, pub.text)


# --------------------------------------------------------------------------- #
# 7. Bitácora global, reinicio determinista, reportes y rendimiento
# --------------------------------------------------------------------------- #
class TestBitacoraReinicioYReportes(_Registro):
    def _conteo_alertas(self):
        alertas = client.get("/api/alertas", headers=hdr(ROL_OCI)).json()
        conteo = {}
        for a in alertas:
            conteo[a["codigo_regla"]] = conteo.get(a["codigo_regla"], 0) + 1
        return conteo

    def test_reinicio_es_determinista_y_preserva_bitacora(self):
        registrar({"fecha_creacion": "2025-06-24T09:00:00", "pago_sin_conformidad": True})
        antes = client.get("/api/auditoria", headers=hdr(ROL_OCI)).json()["total_eventos"]
        reset_dataset()
        c1 = self._conteo_alertas()
        reset_dataset()
        c2 = self._conteo_alertas()
        self.assertEqual(c1, c2)
        aud = client.get("/api/auditoria", headers=hdr(ROL_OCI)).json()
        self.assertGreater(aud["total_eventos"], antes)
        self.assertTrue(aud["cadena_integra"])
        self.assertTrue(any(e["accion"] == "REINICIO_DATASET" for e in aud["eventos"]))
        self.assertEqual(len(client.get("/api/expedientes", headers=hdr(ROL_OCI)).json()), 120)

    def test_reportes_pdf_y_csv(self):
        pdf = client.get("/api/reportes/institucional-pdf", headers=hdr(ROL_OCI))
        self.assertEqual(pdf.status_code, 200)
        self.assertTrue(pdf.content.startswith(b"%PDF"))
        exp_pdf = client.get("/api/expedientes/6/reporte-pdf", headers=hdr(ROL_OCI))
        self.assertEqual(exp_pdf.status_code, 200)
        self.assertTrue(exp_pdf.content.startswith(b"%PDF"))
        csv_ind = client.get("/api/reportes/indicadores-csv", headers=hdr(ROL_PUB))
        self.assertEqual(csv_ind.status_code, 200)
        csv_aud = client.get("/api/auditoria/csv", headers=hdr(ROL_OCI))
        self.assertEqual(csv_aud.status_code, 200)

    def test_rendimiento_de_consultas(self):
        ids = [e["id"] for e in client.get("/api/expedientes", headers=hdr(ROL_OCI)).json()[:10]]
        t_detalle, t_dashboard, t_grafo = [], [], []
        for eid in ids:
            t0 = time.perf_counter()
            detalle(eid)
            t_detalle.append((time.perf_counter() - t0) * 1000)
        for _ in range(8):
            t0 = time.perf_counter()
            self.assertEqual(client.get("/api/dashboard", headers=hdr(ROL_OCI)).status_code, 200)
            t_dashboard.append((time.perf_counter() - t0) * 1000)
            t0 = time.perf_counter()
            self.assertEqual(client.get("/api/grafo-colusion", headers=hdr(ROL_OCI)).status_code, 200)
            t_grafo.append((time.perf_counter() - t0) * 1000)
        OBS["latency"]["Detalle de expediente (6 etapas + NLP + alertas)"] = _stats(t_detalle)
        OBS["latency"]["Dashboard de indicadores"] = _stats(t_dashboard)
        OBS["latency"]["Grafo de colusión (NetworkX)"] = _stats(t_grafo)
        for nombre, v in OBS["latency"].items():
            self.assertLess(v["p95"], 3000, f"{nombre} supera 3 s en p95")

    def test_endpoint_validacion_expone_metricas(self):
        for rol in (ROL_OCI, ROL_DEC, ROL_PUB):
            r = client.get("/api/validacion", headers=hdr(rol))
            self.assertEqual(r.status_code, 200, f"{rol}: {r.text[:200]}")
            data = r.json()
            for clave in (
                "generado",
                "comando",
                "resumen_muestras",
                "totales",
                "matriz_por_regla",
                "casos_en_vivo",
                "latencias_ms",
                "rbac",
                "pruebas_ejecutadas",
            ):
                self.assertIn(clave, data)
            self.assertEqual(data["totales"]["FP"], 0)
            self.assertEqual(data["resumen_muestras"]["alertas_indebidas_en_limpias"], 0)


# --------------------------------------------------------------------------- #
# 8. Historial RNP, continuidad económica en grafos y sobreprecio referencial
# --------------------------------------------------------------------------- #
class TestHistorialYSobreprecio(_Registro):
    def test_grafo_conecta_empresa_sancionada_con_sucesora_en_exp_0011(self):
        reset_dataset()
        r = client.get("/api/grafo-colusion", headers=hdr(ROL_OCI))
        self.assertEqual(r.status_code, 200, r.text[:200])
        grafo = r.json()
        nodos_por_id = {n["data"]["id"]: n["data"] for n in grafo["elements"]["nodes"]}

        for esperado_id in (
            "PROV-SYN-027",
            "PROV-SYN-028",
            "INV-RECICL-77",
            "DIR-HASH-TRUJ-991",
            "EXP-2025-UNT-0011",
        ):
            self.assertIn(esperado_id, nodos_por_id, f"Falta nodo {esperado_id} en grafo")

        p27 = nodos_por_id["PROV-SYN-027"]
        p28 = nodos_por_id["PROV-SYN-028"]
        self.assertEqual(p27["estado_rnp"], "LIQUIDADA_SANCIONADA")
        self.assertEqual(p27["riesgo"], "SANCIONADO")
        self.assertGreaterEqual(p27["penalidades_previas"], 4)
        self.assertEqual(p28["estado_rnp"], "HABILITADO")

        clusters_cont = [
            c
            for c in grafo["clusters_detectados"]
            if "PROV-SYN-027" in c["proveedores_vinculados"]
            and "PROV-SYN-028" in c["proveedores_vinculados"]
        ]
        self.assertEqual(len(clusters_cont), 1)
        codigos_afectados = {e["codigo"] for e in clusters_cont[0]["expedientes_afectados"]}
        self.assertIn("EXP-2025-UNT-0011", codigos_afectados)


if __name__ == "__main__":
    unittest.main(verbosity=2)
