import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CytoscapeComponent from 'react-cytoscapejs';
import {
  Network,
  ZoomIn,
  ZoomOut,
  Maximize2,
  ShieldAlert,
  FileSearch,
  RefreshCw,
  Info,
} from 'lucide-react';
import { centinelaApi } from '../api/client';
import { GrafoColusionData } from '../types';
import { useTheme } from '../context/ThemeContext';

export const GrafoColusionPage: React.FC = () => {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const cyRef = useRef<any>(null);
  const [grafoData, setGrafoData] = useState<GrafoColusionData | null>(null);
  const [soloRiesgo, setSoloRiesgo] = useState<boolean>(true);
  const [nodoSeleccionado, setNodoSeleccionado] = useState<Record<string, any> | null>(null);
  const [vecinosNodo, setVecinosNodo] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const cargarGrafo = async (riesgoOnly: boolean) => {
    try {
      setLoading(true);
      const data = await centinelaApi.obtenerGrafoColusion(riesgoOnly);
      setGrafoData(data);
      if (data.elements.nodes.length > 0) {
        setNodoSeleccionado(data.elements.nodes[0].data);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarGrafo(soloRiesgo);
  }, [soloRiesgo]);

  const handleZoom = (factor: number) => {
    if (cyRef.current) {
      const currentZoom = cyRef.current.zoom();
      cyRef.current.zoom({
        level: currentZoom * factor,
        renderedPosition: { x: 350, y: 250 },
      });
    }
  };

  const handleFit = () => {
    if (cyRef.current) {
      cyRef.current.fit(undefined, 45);
      cyRef.current
        .layout({ name: 'cose', animate: true, idealEdgeLength: 120, nodeRepulsion: 6500 })
        .run();
    }
  };

  const stylesheet: any[] = useMemo(
    () => [
      {
        selector: 'node',
        style: {
          label: 'data(label)',
          color: isDark ? '#f8fafc' : '#0f172a',
          'font-size': '10px',
          'font-weight': 'bold',
          'text-wrap': 'wrap',
          'text-max-width': '115px',
          'text-valign': 'bottom',
          'text-halign': 'center',
          'text-margin-y': 6,
          'text-background-color': isDark ? '#020617' : '#ffffff',
          'text-background-opacity': 0.92,
          'text-background-padding': '3px',
          'text-background-shape': 'roundrectangle',
          width: 44,
          height: 44,
          'border-width': 3,
        },
      },
      {
        selector: 'node[tipo = "PROVEEDOR"]',
        style: {
          shape: 'ellipse',
          'background-color': '#e11d48',
          'border-color': isDark ? '#fda4af' : '#9f1239',
        },
      },
      {
        selector: 'node[tipo = "PROVEEDOR"][riesgo = "LIMPIO"]',
        style: {
          'background-color': isDark ? '#475569' : '#64748b',
          'border-color': isDark ? '#94a3b8' : '#334155',
        },
      },
      {
        selector: 'node[tipo = "ATRIBUTO"]',
        style: {
          shape: 'diamond',
          width: 48,
          height: 48,
          'background-color': '#f59e0b',
          'border-color': isDark ? '#fde68a' : '#b45309',
        },
      },
      {
        selector: 'node[tipo = "EXPEDIENTE"]',
        style: {
          shape: 'round-rectangle',
          width: 54,
          height: 40,
          'background-color': isDark ? '#0ea5e9' : '#1d4ed8',
          'border-color': isDark ? '#7dd3fc' : '#1e3a8a',
        },
      },
      {
        selector: 'node:selected',
        style: {
          'border-width': 5,
          'border-color': '#059669',
          'overlay-color': '#10b981',
          'overlay-padding': 6,
          'overlay-opacity': 0.25,
        },
      },
      {
        selector: 'edge',
        style: {
          width: 2.2,
          'line-color': isDark ? '#475569' : '#94a3b8',
          'target-arrow-color': isDark ? '#475569' : '#64748b',
          'target-arrow-shape': 'triangle',
          'curve-style': 'bezier',
          label: 'data(label)',
          'font-size': '8px',
          color: isDark ? '#cbd5e1' : '#334155',
          'text-background-color': isDark ? '#0f172a' : '#ffffff',
          'text-background-opacity': 0.9,
          'text-background-padding': '2px',
        },
      },
      {
        selector: 'edge[tipo_enlace = "VINCULO_ATRIBUTO"]',
        style: {
          'line-color': isDark ? '#f59e0b' : '#d97706',
          'line-style': 'dashed',
          width: 2.8,
        },
      },
      {
        selector: 'edge[tipo_enlace = "POSTULACION_GANADORA"]',
        style: {
          'line-color': isDark ? '#10b981' : '#059669',
          width: 3,
        },
      },
    ],
    [isDark],
  );

  // Actualizar estilos del lienzo Cytoscape cuando el usuario cambia entre Claro y Oscuro
  useEffect(() => {
    if (cyRef.current) {
      cyRef.current.style().fromJson(stylesheet).update();
    }
  }, [stylesheet]);

  const cytoscapeElements = grafoData
    ? [...grafoData.elements.nodes, ...grafoData.elements.edges]
    : [];

  return (
    <div className="space-y-6">
      {/* Encabezado y Controles */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2.5">
            <Network className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            Empresas con Datos Compartidos (Posible Colusión)
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
            Identifica proveedores que compiten en un mismo proceso pero comparten representante legal, dirección o teléfono (Art. 30 Ley N° 32069 • Grafo NetworkX)
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setSoloRiesgo(!soloRiesgo)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition ${
              soloRiesgo
                ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/40'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
            }`}
          >
            {soloRiesgo
              ? 'Vista: Grupos con Datos Compartidos'
              : 'Vista: Todos los Proveedores'}
          </button>
        </div>
      </div>

      {/* KPIs de Red */}
      {grafoData && (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4">
          <div className="p-4 rounded-xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-none">
            <div className="text-[11px] text-slate-500 dark:text-slate-400 uppercase font-bold">
              Grupos Vinculados
            </div>
            <div className="text-xl xl:text-2xl font-extrabold text-rose-700 dark:text-rose-400 mt-1">
              {grafoData.metricas_grafo.total_clusters_colusion} Grupos
            </div>
          </div>
          <div className="p-4 rounded-xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-none">
            <div className="text-[11px] text-slate-500 dark:text-slate-400 uppercase font-bold">
              Proveedores Vinculados
            </div>
            <div className="text-xl xl:text-2xl font-extrabold text-amber-700 dark:text-amber-300 mt-1">
              {grafoData.metricas_grafo.proveedores_en_colusion} Empresas
            </div>
          </div>
          <div className="p-4 rounded-xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-none">
            <div className="text-[11px] text-slate-500 dark:text-slate-400 uppercase font-bold">
              Compras Afectadas
            </div>
            <div className="text-xl xl:text-2xl font-extrabold text-blue-700 dark:text-cyan-300 mt-1">
              {grafoData.metricas_grafo.expedientes_comprometidos} Procesos
            </div>
          </div>
          <div className="p-4 rounded-xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-none">
            <div className="text-[11px] text-slate-500 dark:text-slate-400 uppercase font-bold">
              Elementos en el Mapa
            </div>
            <div className="text-xl xl:text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
              {grafoData.metricas_grafo.total_nodos}
            </div>
          </div>
          <div className="p-4 rounded-xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-none">
            <div className="text-[11px] text-slate-500 dark:text-slate-400 uppercase font-bold">
              Conexiones Detectadas
            </div>
            <div className="text-xl xl:text-2xl font-extrabold text-emerald-700 dark:text-emerald-400 mt-1">
              {grafoData.metricas_grafo.total_enlaces}
            </div>
          </div>
        </div>
      )}

      {/* Lienzo Interactivo Cytoscape + Panel Inspector Forense */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-2xl bg-white dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-none overflow-hidden flex flex-col">
          {/* Barra de Leyenda y Zoom */}
          <div className="px-5 py-3 bg-slate-50 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-4 text-xs">
              <span className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-medium">
                <span className="w-3 h-3 rounded-full bg-rose-600 inline-block border border-rose-300" />
                Proveedor Vinculado
              </span>
              <span className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-medium">
                <span className="w-3 h-3 rotate-45 bg-amber-500 inline-block border border-amber-300" />
                Atributo Compartido (Rep/Dir/Tel)
              </span>
              <span className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-medium">
                <span className="w-3.5 h-3 rounded bg-blue-700 dark:bg-sky-500 inline-block border border-blue-300 dark:border-sky-200" />
                Expediente Contratación
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handleZoom(1.25)}
                className="p-1.5 rounded-lg bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
                title="Acercar"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleZoom(0.8)}
                className="p-1.5 rounded-lg bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
                title="Alejar"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                onClick={handleFit}
                className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-emerald-700 dark:text-emerald-300 inline-flex items-center gap-1"
                title="Reorganizar y centrar grafo"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                Reajustar Red
              </button>
            </div>
          </div>

          {/* Contenedor Cytoscape */}
          <div className="relative h-[520px] w-full bg-slate-50 dark:bg-slate-950 transition-colors">
            {loading ? (
              <div className="h-full flex flex-col items-center justify-center space-y-3">
                <RefreshCw className="w-8 h-8 text-blue-700 dark:text-emerald-400 animate-spin" />
                <span className="text-xs text-slate-600 dark:text-slate-400 font-mono">
                  Calculando componentes conexas y centralidad en NetworkX...
                </span>
              </div>
            ) : (
              <CytoscapeComponent
                elements={cytoscapeElements}
                style={{ width: '100%', height: '100%' }}
                stylesheet={stylesheet}
                layout={{
                  name: 'cose',
                  animate: false,
                  idealEdgeLength: 120,
                  nodeRepulsion: 6500,
                  padding: 45,
                }}
                cy={(cy: any) => {
                  cyRef.current = cy;
                  cy.off('tap', 'node');
                  cy.on('tap', 'node', (evt: any) => {
                    const node = evt.target;
                    const data = node.data();
                    setNodoSeleccionado(data);
                    const connectedLabels: string[] = [];
                    node.neighborhood('node').forEach((n: any) => {
                      connectedLabels.push(`${n.data('id')} (${n.data('tipo')})`);
                    });
                    setVecinosNodo(connectedLabels);
                  });
                }}
              />
            )}
          </div>
        </div>

        {/* Panel Inspector de Nodo Seleccionado */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-none flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-3">
              <Info className="w-4 h-4 text-blue-700 dark:text-cyan-400" />
              Inspector Forense de Nodo (Clic en el Grafo)
            </div>

            {nodoSeleccionado ? (
              <div className="space-y-4 text-xs">
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5">
                  <span className="px-2 py-0.5 rounded bg-blue-100 dark:bg-cyan-500/15 text-blue-800 dark:text-cyan-300 font-mono text-[10px] font-bold">
                    TIPO: {nodoSeleccionado.tipo}
                  </span>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white font-mono pt-1">
                    {nodoSeleccionado.id}
                  </h3>
                  <p className="text-slate-600 dark:text-slate-300">
                    {nodoSeleccionado.titulo_completo}
                  </p>
                </div>

                <div className="space-y-2 bg-slate-50 dark:bg-slate-950/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800/80">
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Centralidad NetworkX:</span>
                    <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                      {nodoSeleccionado.centralidad}
                    </span>
                  </div>
                  {nodoSeleccionado.representante_id && (
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Representante Hash:</span>
                      <span className="font-mono text-amber-700 dark:text-amber-300 font-semibold">
                        {nodoSeleccionado.representante_id}
                      </span>
                    </div>
                  )}
                  {nodoSeleccionado.direccion_hash && (
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400">
                        Dirección Fiscal Hash:
                      </span>
                      <span className="font-mono text-amber-700 dark:text-amber-300 font-semibold">
                        {nodoSeleccionado.direccion_hash}
                      </span>
                    </div>
                  )}
                  {nodoSeleccionado.telefono_hash && (
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Teléfono Hash:</span>
                      <span className="font-mono text-amber-700 dark:text-amber-300 font-semibold">
                        {nodoSeleccionado.telefono_hash}
                      </span>
                    </div>
                  )}
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 leading-relaxed">
                  <strong className="text-slate-900 dark:text-slate-100 block mb-1">
                    Evidencia Topológica:
                  </strong>
                  {nodoSeleccionado.detalle}
                </div>

                {vecinosNodo.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                      Conexiones Directas ({vecinosNodo.length}):
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {vecinosNodo.map((vec) => (
                        <span
                          key={vec}
                          className="px-2 py-1 rounded-lg bg-blue-50 dark:bg-slate-950 border border-blue-200 dark:border-slate-800 font-mono text-[11px] text-blue-800 dark:text-cyan-300"
                        >
                          {vec}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {nodoSeleccionado.tipo === 'EXPEDIENTE' &&
                  nodoSeleccionado.expediente_db_id && (
                    <button
                      onClick={() =>
                        navigate(`/trazabilidad?id=${nodoSeleccionado.expediente_db_id}`)
                      }
                      className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white dark:text-slate-950 font-extrabold text-xs flex items-center justify-center gap-2 transition"
                    >
                      <FileSearch className="w-4 h-4" />
                      Auditar Cadena SHA-256 de este Expediente
                    </button>
                  )}
              </div>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Haga clic sobre cualquier nodo en el grafo interactivo para inspeccionar sus metadatos y conexiones.
              </p>
            )}
          </div>

          <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed">
            <strong>Base Legal (Art. 30 Ley N° 32069):</strong> Se encuentran impedidos de ser participantes o postores en un mismo procedimiento las personas jurídicas que compartan representantes legales, socios o formen parte del mismo grupo económico.
          </div>
        </div>
      </div>

      {/* Tarjetas de Clústeres de Colusión Detectados */}
      {grafoData && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-rose-600 dark:text-rose-400" />
            Clústeres de Colusión Detectados Automáticamente por NetworkX
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {grafoData.clusters_detectados.map((cluster) => (
              <div
                key={cluster.cluster_id}
                className="p-6 rounded-2xl bg-white dark:bg-slate-900/95 border border-rose-200 dark:border-rose-500/40 shadow-sm dark:shadow-none space-y-4"
              >
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-full bg-rose-50 dark:bg-rose-500/20 text-rose-800 dark:text-rose-300 font-mono text-xs font-bold border border-rose-200 dark:border-rose-500/40">
                    {cluster.cluster_id}
                  </span>
                  <span className="font-mono text-xs font-bold text-amber-700 dark:text-amber-300">
                    Monto Afectado: S/{' '}
                    {cluster.monto_total_afectado.toLocaleString('es-PE', {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>

                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  {cluster.nombre_red}
                </h3>

                <div className="space-y-2 text-xs">
                  <div>
                    <strong className="text-slate-500 dark:text-slate-400">
                      Postores Vinculados:{' '}
                    </strong>
                    <span className="font-mono text-rose-700 dark:text-rose-300 font-bold">
                      {cluster.proveedores_vinculados.join(', ')}
                    </span>
                  </div>
                  <div>
                    <strong className="text-slate-500 dark:text-slate-400">
                      Atributos Forenses Compartidos:{' '}
                    </strong>
                    <span className="font-mono text-amber-700 dark:text-amber-300">
                      {cluster.atributos_compartidos.join(' | ')}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-950 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
                  {cluster.explicacion_xai}
                </p>

                <div className="space-y-2">
                  <span className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">
                    Expedientes donde co-participaron simulando competencia:
                  </span>
                  {cluster.expedientes_afectados.map((exp) => (
                    <div
                      key={exp.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-950/90 border border-slate-200 dark:border-slate-800 text-xs"
                    >
                      <div>
                        <span className="font-mono font-bold text-blue-700 dark:text-cyan-300">
                          {exp.codigo}
                        </span>
                        <span className="text-slate-500 dark:text-slate-400 ml-2">
                          ({exp.area_usuaria})
                        </span>
                        <div className="text-[11px] text-slate-600 dark:text-slate-300 truncate max-w-sm">
                          {exp.objeto}
                        </div>
                      </div>
                      <button
                        onClick={() => navigate(`/trazabilidad?id=${exp.id}`)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:hover:bg-emerald-500/30 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 font-semibold whitespace-nowrap ml-3"
                      >
                        Ver Expediente
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
