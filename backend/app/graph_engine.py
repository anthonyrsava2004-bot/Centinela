from collections import defaultdict
import networkx as nx
from sqlalchemy.orm import Session
from .models import Expediente, Postulacion, Proveedor


def construir_grafo_colusion(db: Session, solo_riesgo: bool = True) -> dict:
    """
    Construye un grafo heterogéneo con NetworkX integrando:
    - Proveedores (PROV-SYN-XXX)
    - Atributos forenses compartidos (Representante Legal, Dirección Fiscal Hash, Teléfono Hash)
    - Expedientes de contratación donde co-participan dichos proveedores
    Detecta clústeres de colusión y calcula métricas topológicas (centralidad de grado).
    """
    proveedores = db.query(Proveedor).all()
    postulaciones = db.query(Postulacion).all()
    expedientes_map = {e.id: e for e in db.query(Expediente).all()}
    prov_map = {p.id: p for p in proveedores}

    # Mapear atributos -> lista de proveedores que los poseen
    rep_map = defaultdict(list)
    dir_map = defaultdict(list)
    tel_map = defaultdict(list)

    for p in proveedores:
        rep_map[p.representante_id].append(p)
        dir_map[p.direccion_hash].append(p)
        tel_map[p.telefono_hash].append(p)

    # Identificar atributos compartidos por 2 o más proveedores distintos
    atributos_compartidos = {}
    proveedores_en_red_ids = set()

    for rep_id, lista_p in rep_map.items():
        if len(lista_p) > 1:
            atributos_compartidos[rep_id] = {
                "subtipo": "REPRESENTANTE_LEGAL",
                "etiqueta": f"Rep. Legal\n{rep_id}",
                "valor": rep_id,
                "proveedores": [x.codigo for x in lista_p],
            }
            for x in lista_p:
                proveedores_en_red_ids.add(x.id)

    for dir_id, lista_p in dir_map.items():
        if len(lista_p) > 1:
            atributos_compartidos[dir_id] = {
                "subtipo": "DIRECCION_FISCAL",
                "etiqueta": f"Dirección Fiscal\n{dir_id}",
                "valor": dir_id,
                "proveedores": [x.codigo for x in lista_p],
            }
            for x in lista_p:
                proveedores_en_red_ids.add(x.id)

    for tel_id, lista_p in tel_map.items():
        if len(lista_p) > 1:
            atributos_compartidos[tel_id] = {
                "subtipo": "TELEFONO_CONTACTO",
                "etiqueta": f"Teléfono Hash\n{tel_id}",
                "valor": tel_id,
                "proveedores": [x.codigo for x in lista_p],
            }
            for x in lista_p:
                proveedores_en_red_ids.add(x.id)

    #Construir grafo en NetworkX
    G = nx.Graph()

    # Si solo_riesgo=False, incluimos también una muestra de proveedores regulares para contraste visual
    proveedores_visibles = []
    for p in proveedores:
        if p.id in proveedores_en_red_ids or p.es_colusorio:
            proveedores_visibles.append(p)
        elif not solo_riesgo and len(proveedores_visibles) < 18:
            proveedores_visibles.append(p)

    ids_prov_visibles = {p.id for p in proveedores_visibles}

    for p in proveedores_visibles:
        es_sospechoso = p.id in proveedores_en_red_ids or p.es_colusorio
        G.add_node(
            p.codigo,
            id=p.codigo,
            label=f"{p.codigo}\n({p.rubro[:18]})",
            titulo_completo=p.alias_comercial,
            tipo="PROVEEDOR",
            riesgo="ALTO" if es_sospechoso else "LIMPIO",
            rubro=p.rubro,
            representante_id=p.representante_id,
            direccion_hash=p.direccion_hash,
            telefono_hash=p.telefono_hash,
            detalle=(
                f"Proveedor anonimizado {p.codigo} ({p.alias_comercial}). "
                f"Rep: {p.representante_id} | Dir: {p.direccion_hash} | Tel: {p.telefono_hash}"
            ),
        )

    # Añadir nodos de atributos compartidos y enlaces Proveedor <-> Atributo
    for attr_id, info in atributos_compartidos.items():
        G.add_node(
            attr_id,
            id=attr_id,
            label=info["etiqueta"],
            titulo_completo=f"Atributo Compartido: {info['subtipo']} ({attr_id})",
            tipo="ATRIBUTO",
            subtipo=info["subtipo"],
            riesgo="ALTO",
            detalle=(
                f"Vínculo encubierto detectado ({info['subtipo']}): El identificador {attr_id} "
                f"es compartido simultáneamente por los postores {', '.join(info['proveedores'])}."
            ),
        )
        for prov_code in info["proveedores"]:
            if G.has_node(prov_code):
                G.add_edge(
                    prov_code,
                    attr_id,
                    id=f"edge-{prov_code}-{attr_id}",
                    label=info["subtipo"].replace("_", " "),
                    tipo_enlace="VINCULO_ATRIBUTO",
                    riesgo="ALTO",
                )

    # Agrupar postulaciones por expediente para detectar co-participación de proveedores vinculados
    post_por_exp = defaultdict(list)
    for post in postulaciones:
        post_por_exp[post.expediente_id].append(post)

    expedientes_colusorios = []
    for exp_id, lista_post in post_por_exp.items():
        exp = expedientes_map.get(exp_id)
        if not exp:
            continue

        postores_red_en_exp = [
            post for post in lista_post if post.proveedor_id in proveedores_en_red_ids
        ]

        # Incluir expediente en el grafo si tiene >=2 postores vinculados o si es caso trampa de colusión
        incluir_exp = (len(postores_red_en_exp) >= 2) or (exp.tipo_trampa == "COLUSION_PROVEEDORES")
        if not solo_riesgo and exp.es_caso_trampa:
            incluir_exp = True

        if incluir_exp:
            expedientes_colusorios.append((exp, lista_post))
            G.add_node(
                exp.codigo,
                id=exp.codigo,
                label=f"{exp.codigo}\nS/ {exp.monto_estimado:,.0f}",
                titulo_completo=f"{exp.codigo}: {exp.objeto}",
                tipo="EXPEDIENTE",
                riesgo=exp.nivel_riesgo,
                monto=exp.monto_estimado,
                area_usuaria=exp.area_usuaria,
                modalidad=exp.modalidad,
                expediente_db_id=exp.id,
                detalle=(
                    f"Expediente {exp.codigo} ({exp.area_usuaria}) - {exp.objeto}. "
                    f"Monto: S/ {exp.monto_estimado:,.2f} | Modalidad: {exp.modalidad}"
                ),
            )
            for post in lista_post:
                prov = prov_map.get(post.proveedor_id)
                if not prov:
                    continue
                if not G.has_node(prov.codigo):
                    G.add_node(
                        prov.codigo,
                        id=prov.codigo,
                        label=f"{prov.codigo}\n({prov.rubro[:18]})",
                        titulo_completo=prov.alias_comercial,
                        tipo="PROVEEDOR",
                        riesgo="ALTO" if prov.es_colusorio else "LIMPIO",
                        rubro=prov.rubro,
                        representante_id=prov.representante_id,
                        direccion_hash=prov.direccion_hash,
                        telefono_hash=prov.telefono_hash,
                        detalle=f"Proveedor {prov.codigo} ({prov.alias_comercial})",
                    )
                rol_postor = "ADJUDICADO" if post.es_ganador else "POSTOR COTIZANTE"
                G.add_edge(
                    prov.codigo,
                    exp.codigo,
                    id=f"edge-{prov.codigo}-{exp.codigo}",
                    label=f"{rol_postor} (S/ {post.monto_ofertado:,.0f})",
                    tipo_enlace="POSTULACION_GANADORA" if post.es_ganador else "POSTULACION",
                    riesgo="ALTO" if (prov.id in proveedores_en_red_ids) else "MEDIO",
                )

    # Calcular centralidad de grado con NetworkX
    centralidad = nx.degree_centrality(G) if G.number_of_nodes() > 0 else {}

    # Construir lista de clústeres de colusión detectados mediante componentes conexas sobre subgrafo de riesgo
    G_riesgo = nx.Graph()
    for attr_id, info in atributos_compartidos.items():
        for prov_code in info["proveedores"]:
            G_riesgo.add_edge(prov_code, attr_id, subtipo=info["subtipo"])

    clusters_detectados = []
    for idx, comp in enumerate(nx.connected_components(G_riesgo), start=1):
        nodos_prov = sorted([n for n in comp if n.startswith("PROV-")])
        nodos_attr = sorted([n for n in comp if not n.startswith("PROV-")])

        # Buscar expedientes afectados por este clúster
        exps_afectados = []
        monto_involucrado = 0.0
        for exp, lista_post in expedientes_colusorios:
            codigos_postores = {
                prov_map[p.proveedor_id].codigo
                for p in lista_post
                if p.proveedor_id in prov_map
            }
            interseccion = set(nodos_prov).intersection(codigos_postores)
            if len(interseccion) >= 2:
                exps_afectados.append(
                    {
                        "id": exp.id,
                        "codigo": exp.codigo,
                        "objeto": exp.objeto,
                        "monto_estimado": exp.monto_estimado,
                        "area_usuaria": exp.area_usuaria,
                        "proveedor_adjudicado": exp.proveedor_adjudicado_codigo,
                    }
                )
                monto_involucrado += exp.monto_estimado

        detalles_atributos = [
            f"{a} ({atributos_compartidos[a]['subtipo']})"
            for a in nodos_attr
            if a in atributos_compartidos
        ]

        clusters_detectados.append(
            {
                "cluster_id": f"CLUSTER-COL-0{idx}",
                "nombre_red": f"Anillo de Colusión Presunta #{idx} ({len(nodos_prov)} proveedores vinculados)",
                "proveedores_vinculados": nodos_prov,
                "atributos_compartidos": detalles_atributos,
                "expedientes_afectados": exps_afectados,
                "monto_total_afectado": round(monto_involucrado, 2),
                "explicacion_xai": (
                    f"Señal de riesgo que amerita revisión humana: Los proveedores {', '.join(nodos_prov)} "
                    f"se presentaron como competidores independientes en los mismos procesos de contratación, "
                    f"pero comparten vínculos encubiertos ({', '.join(detalles_atributos)}). "
                    f"Esto vulnera la competencia efectiva y configura indicio de simulación de pluralidad de postores."
                ),
                "base_normativa": (
                    "Ley N° 32069 (Art. 5 Principio de Competencia e Integridad; Art. 30 Impedimentos para ser participante "
                    "y postor por vinculación económica o grupo empresarial); D.S. N° 009-2025-EF."
                ),
            }
        )

    # Formatear elementos para Cytoscape.js
    nodes_cytoscape = []
    for node_id, attrs in G.nodes(data=True):
        data_dict = dict(attrs)
        data_dict["centralidad"] = round(centralidad.get(node_id, 0.0), 3)
        nodes_cytoscape.append({"data": data_dict})

    edges_cytoscape = []
    for u, v, attrs in G.edges(data=True):
        edge_data = dict(attrs)
        edge_data["source"] = u
        edge_data["target"] = v
        edges_cytoscape.append({"data": edge_data})

    return {
        "metricas_grafo": {
            "total_nodos": G.number_of_nodes(),
            "total_enlaces": G.number_of_edges(),
            "total_clusters_colusion": len(clusters_detectados),
            "proveedores_en_colusion": len(proveedores_en_red_ids),
            "expedientes_comprometidos": len(expedientes_colusorios),
        },
        "clusters_detectados": clusters_detectados,
        "elements": {
            "nodes": nodes_cytoscape,
            "edges": edges_cytoscape,
        },
    }
