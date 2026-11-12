from typing import List
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sqlalchemy.orm import Session
from .models import Expediente, Postulacion, Proveedor
from .schemas import NlpResultadoOut, NlpSimilitudItem

UMBRAL_DIRECCIONAMIENTO = 78.0

SPANISH_STOPWORDS = [
    "de", "la", "el", "en", "y", "a", "los", "del", "se", "las", "por", "un",
    "para", "con", "no", "una", "su", "al", "lo", "como", "mas", "pero", "sus",
    "le", "ya", "o", "este", "si", "porque", "esta", "entre", "cuando", "muy",
    "sin", "sobre", "tambien", "me", "hasta", "hay", "donde", "quien", "desde",
    "todo", "nos", "durante", "todos", "uno", "les", "ni", "contra", "otros",
    "ese", "eso", "ante", "ellos", "e", "esto", "mi", "antes", "algunos", "que",
]


def analizar_similitud_tdr(db: Session, expediente: Expediente) -> NlpResultadoOut:
    """
    Ejecuta análisis semántico 100% local mediante TF-IDF + Similitud Coseno (Scikit-Learn)
    comparando los Términos de Referencia (TDR) del expediente contra los catálogos técnicos
    de los proveedores registrados (priorizando postores del proceso y del mismo rubro).
    """
    todos_proveedores: List[Proveedor] = db.query(Proveedor).order_by(Proveedor.codigo.asc()).all()
    postulaciones: List[Postulacion] = (
        db.query(Postulacion).filter(Postulacion.expediente_id == expediente.id).all()
    )
    ids_postores = {p.proveedor_id for p in postulaciones}

    # Seleccionar los proveedores que postularon + proveedores del mismo rubro (o top proveedores para contraste)
    candidatos: List[Proveedor] = []
    vistos = set()

    for prov in todos_proveedores:
        if prov.id in ids_postores or prov.codigo == expediente.proveedor_adjudicado_codigo:
            candidatos.append(prov)
            vistos.add(prov.id)

    for prov in todos_proveedores:
        if prov.id not in vistos and prov.rubro == expediente.rubro:
            candidatos.append(prov)
            vistos.add(prov.id)

    for prov in todos_proveedores:
        if len(candidatos) >= 8:
            break
        if prov.id not in vistos:
            candidatos.append(prov)
            vistos.add(prov.id)

    if not candidatos:
        return NlpResultadoOut(
            expediente_codigo=expediente.codigo,
            umbral_alerta=UMBRAL_DIRECCIONAMIENTO,
            max_similitud=0.0,
            proveedor_mas_similar="N/A",
            alerta_detectada=False,
            explicacion_xai="No existen catálogos de proveedores registrados para contrastar.",
            comparaciones=[],
        )

    corpus = [expediente.tdr_texto] + [p.catalogo_texto for p in candidatos]

    vectorizer = TfidfVectorizer(
        stop_words=SPANISH_STOPWORDS,
        ngram_range=(1, 2),
        lowercase=True,
    )
    tfidf_matrix = vectorizer.fit_transform(corpus)
    feature_names = vectorizer.get_feature_names_out()

    tdr_vec = tfidf_matrix[0:1]
    catalog_vecs = tfidf_matrix[1:]
    similitudes = cosine_similarity(tdr_vec, catalog_vecs)[0]

    tdr_weights = tdr_vec.toarray()[0]
    comparaciones: List[NlpSimilitudItem] = []

    for idx, prov in enumerate(candidatos):
        porcentaje = round(float(similitudes[idx]) * 100.0, 1)
        prov_weights = catalog_vecs[idx].toarray()[0]
        # Contribución por término (producto de pesos TF-IDF)
        contribuciones = tdr_weights * prov_weights
        top_indices = contribuciones.argsort()[::-1][:6]
        terminos_coincidentes = [
            str(feature_names[i]) for i in top_indices if contribuciones[i] > 0.005
        ]

        comparaciones.append(
            NlpSimilitudItem(
                proveedor_codigo=prov.codigo,
                proveedor_alias=prov.alias_comercial,
                rubro=prov.rubro,
                es_adjudicado=(prov.codigo == expediente.proveedor_adjudicado_codigo),
                porcentaje_similitud=porcentaje,
                terminos_coincidentes=terminos_coincidentes,
                alerta_direccionamiento=(porcentaje >= UMBRAL_DIRECCIONAMIENTO),
            )
        )

    comparaciones.sort(key=lambda x: x.porcentaje_similitud, reverse=True)
    mejor = comparaciones[0]
    alerta_detectada = mejor.porcentaje_similitud >= UMBRAL_DIRECCIONAMIENTO

    if alerta_detectada:
        explicacion_xai = (
            f"Señal de riesgo que amerita revisión humana: El texto del TDR del expediente {expediente.codigo} "
            f"presenta una similitud léxico-semántica de {mejor.porcentaje_similitud}% con el catálogo técnico de "
            f"{mejor.proveedor_codigo} ({mejor.proveedor_alias}), superando el umbral preventivo de {UMBRAL_DIRECCIONAMIENTO}%. "
            f"Se identifican especificaciones técnicas exclusivas ({', '.join(mejor.terminos_coincidentes[:4])}) "
            f"que podrían restringir la pluralidad de postores (Art. 16 y Art. 47 de la Ley N° 32069)."
        )
    else:
        explicacion_xai = (
            f"Cumplimiento de neutralidad técnica: La similitud máxima entre el TDR y los catálogos de proveedores "
            f"es de {mejor.porcentaje_similitud}% ({mejor.proveedor_codigo}), manteniéndose por debajo del umbral de riesgo "
            f"de direccionamiento ({UMBRAL_DIRECCIONAMIENTO}%). Se emplean descriptores genéricos y estándares abiertos."
        )

    return NlpResultadoOut(
        expediente_codigo=expediente.codigo,
        umbral_alerta=UMBRAL_DIRECCIONAMIENTO,
        max_similitud=mejor.porcentaje_similitud,
        proveedor_mas_similar=mejor.proveedor_codigo,
        alerta_detectada=alerta_detectada,
        explicacion_xai=explicacion_xai,
        comparaciones=comparaciones,
    )
