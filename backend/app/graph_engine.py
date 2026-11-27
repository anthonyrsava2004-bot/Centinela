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
    acc_map = defaultdict(list)
    dir_map = defaultdict(list)
    tel_map = defaultdict(list)

    for p in proveedores:
        rep_map[p.representante_id].append(p)
        if p.accionista_id:
            acc_map[p.accionista_id].append(p)
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

    for acc_id, lista_p in acc_map.items():
        if len(lista_p) > 1:
            atributos_compartidos[acc_id] = {
                "subtipo": "SOCIO_ACCIONISTA",
                "etiqueta": f"Socio/Inversor\n{acc_id}",
                "valor": acc_id,
                "proveedores": [x.codigo for x in lista_p],
            }
            for x in lista_p:
                proveedores_en_red_ids.add(x.id)

    for dir_id, lista_p in dir_map.items():
        if len(lista_p) > 1:
            atributos_compartidos[dir_id] = {
                "subtipo": "DIRECCION_FISCAL",
                "etiqueta": f"Dirección\n{dir_id}",
                "valor": dir_id,
                "proveedores": [x.codigo for x in lista_p],
            }
            for x in lista_p:
                proveedores_en_red_ids.add(x.id)

    for tel_id, lista_p in tel_map.items():
        if len(lista_p) > 1:
            atributos_compartidos[tel_id] = {
                "subtipo": "TELEFONO_CONTACTO",
                "etiqueta": f"Teléfono\n{tel_id}",
                "valor": tel_id,
                "proveedores": [x.codigo for x in lista_p],
            }
            for x in lista_p:
                proveedores_en_red_ids.add(x.id)

    # Construir grafo en NetworkX
    G = nx.Graph()

    # Solo incluir proveedores realmente conectados por atributos compartidos (sin nodos huérfanos)
    proveedores_visibles = []
    for p in proveedores:
        if p.id in proveedores_en_red_ids:
            proveedores_visibles.append(p)
        elif not solo_riesgo and len(proveedores_visibles) < 14:
            proveedores_visibles.append(p)

    for p in proveedores_visibles:
        es_sospechoso = p.id in proveedores_en_red_ids
        G.add_node(
            p.codigo,
            id=p.codigo,
            label=p.codigo,
            titulo_completo=p.alias_comercial,
            tipo="PROVEEDOR",
            riesgo="ALTO" if es_sospechoso else "LIMPIO",
            rubro=p.rubro,
            representante_id=p.representante_id,
            accionista_id=p.accionista_id,
            direccion_hash=p.direccion_hash,
            telefono_hash=p.telefono_hash,
            detalle=(
                f"Proveedor anonimizado {p.codigo} ({p.alias_comercial} — {p.rubro}). "
                f"Rep: {p.representante_id} | Socio/Inv: {p.accionista_id} | Dir: {p.direccion_hash} | Tel: {p.telefono_hash}"
            ),
        )

    etiqueta_enlace_corta = {
        "REPRESENTANTE_LEGAL": "Rep. Legal",
        "SOCIO_ACCIONISTA": "Socio/Inversor",
        "DIRECCION_FISCAL": "Dirección",
        "TELEFONO_CONTACTO": "Teléfono",
    }

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
                    label=etiqueta_enlace_corta.get(info["subtipo"], info["subtipo"]),
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

        # Incluir expediente si co-participan >= 2 postores con atributos compartidos
        incluir_exp = (len(postores_red_en_exp) >= 2) or (exp.tipo_trampa == "COLUSION_PROVEEDORES")

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
                        label=prov.codigo,
                        titulo_completo=prov.alias_comercial,
                        tipo="PROVEEDOR",
                        riesgo="ALTO" if (prov.id in proveedores_en_red_ids) else "LIMPIO",
                        rubro=prov.rubro,
                        representante_id=prov.representante_id,
                        accionista_id=prov.accionista_id,
                        direccion_hash=prov.direccion_hash,
                        telefono_hash=prov.telefono_hash,
                        detalle=f"Proveedor {prov.codigo} ({prov.alias_comercial} — {prov.rubro})",
                    )
                rol_corto = "Adjudicado" if post.es_ganador else "Postor"
                G.add_edge(
                    prov.codigo,
                    exp.codigo,
                    id=f"edge-{prov.codigo}-{exp.codigo}",
                    label=rol_corto,
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

    # Calcular posiciones deterministas por componente conexa para evitar solapamientos
    posiciones: dict[str, dict[str, float]] = {}
    cursor_x = 0.0
    espacio_x = 185.0
    gap_cluster = 150.0

    for cluster in clusters_detectados:
        provs_c = list(cluster["proveedores_vinculados"])
        # Colocar al proveedor puente (mayor grado) al centro para minimizar cruces de aristas
        if len(provs_c) == 3:
            provs_por_grado = sorted(provs_c, key=lambda n: G.degree(n), reverse=True)
            puente = provs_por_grado[0]
            extremos = sorted([n for n in provs_c if n != puente])
            provs_ordenados = [extremos[0], puente, extremos[1]]
        else:
            provs_ordenados = provs_c

        # Atributos vinculados a este clúster ordenados según el promedio de índice de sus proveedores
        idx_prov = {p_cod: idx for idx, p_cod in enumerate(provs_ordenados)}
        attrs_c = [
            n
            for n in G.nodes()
            if G.nodes[n].get("tipo") == "ATRIBUTO"
            and any(nb in idx_prov for nb in G.neighbors(n))
        ]
        attrs_c.sort(
            key=lambda a: (
                sum(idx_prov[nb] for nb in G.neighbors(a) if nb in idx_prov)
                / max(1, sum(1 for nb in G.neighbors(a) if nb in idx_prov)),
                a,
            )
        )

        exps_c = [e["codigo"] for e in cluster["expedientes_afectados"] if G.has_node(e["codigo"])]

        ancho_filas = max(len(attrs_c), len(provs_ordenados), len(exps_c), 1)
        centro_cluster = cursor_x + ((ancho_filas - 1) * espacio_x) / 2.0

        def _ubicar_fila(nodos_fila: list[str], y_pos: float):
            if not nodos_fila:
                return
            inicio = centro_cluster - ((len(nodos_fila) - 1) * espacio_x) / 2.0
            for idx_n, nid in enumerate(nodos_fila):
                posiciones[nid] = {"x": round(inicio + idx_n * espacio_x, 1), "y": y_pos}

        _ubicar_fila(attrs_c, 0.0)
        _ubicar_fila(provs_ordenados, 165.0)
        _ubicar_fila(exps_c, 330.0)

        cursor_x += ancho_filas * espacio_x + gap_cluster

    # Ubicar nodos adicionales (ej. vista extendida con postores limpios) ordenados en fila inferior
    nodos_restantes = [n for n in G.nodes() if n not in posiciones]
    for idx_r, nid in enumerate(nodos_restantes):
        col = idx_r % 6
        fila = idx_r // 6
        posiciones[nid] = {"x": round(col * 175.0, 1), "y": round(490.0 + fila * 130.0, 1)}

    # Formatear elementos para Cytoscape.js con posiciones deterministas
    nodes_cytoscape = []
    for node_id, attrs in G.nodes(data=True):
        data_dict = dict(attrs)
        data_dict["centralidad"] = round(centralidad.get(node_id, 0.0), 3)
        nodes_cytoscape.append(
            {
                "data": data_dict,
                "position": posiciones.get(node_id, {"x": 0.0, "y": 0.0}),
            }
        )

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
