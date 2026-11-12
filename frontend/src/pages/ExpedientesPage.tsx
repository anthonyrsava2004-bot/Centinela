import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Filter,
  FileSearch,
  FileDown,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import { centinelaApi } from '../api/client';
import { ExpedienteListItem } from '../types';
import { IntegrityBadge, RiskBadge } from '../components/AlertBadge';

export const ExpedientesPage: React.FC = () => {
  const navigate = useNavigate();
  const [expedientes, setExpedientes] = useState<ExpedienteListItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [busqueda, setBusqueda] = useState<string>('');
  const [nivelRiesgo, setNivelRiesgo] = useState<string>('TODOS');
  const [integridad, setIntegridad] = useState<string>('TODAS');
  const [soloTrampas, setSoloTrampas] = useState<boolean>(false);

  const cargarExpedientes = async () => {
    try {
      setLoading(true);
      const data = await centinelaApi.listarExpedientes({
        busqueda: busqueda || undefined,
        nivel_riesgo: nivelRiesgo !== 'TODOS' ? nivelRiesgo : undefined,
        integridad: integridad !== 'TODAS' ? integridad : undefined,
        solo_trampas: soloTrampas,
      });
      setExpedientes(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      cargarExpedientes();
    }, 180);
    return () => clearTimeout(timer);
  }, [busqueda, nivelRiesgo, integridad, soloTrampas]);

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white">
            Padrón Institucional de Expedientes Auditados (Ley N° 32069)
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Exploración completa del dataset sintético (120 procesos) con estado de integridad SHA-256 y nivel de riesgo XAI
          </p>
        </div>

        <button
          onClick={() => setSoloTrampas(!soloTrampas)}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
            soloTrampas
              ? 'bg-rose-500/20 text-rose-200 border-rose-500/50 shadow-lg shadow-rose-500/10'
              : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-slate-600'
          }`}
        >
          <ShieldAlert className="w-4 h-4 text-rose-400" />
          {soloTrampas
            ? 'Mostrando Solo 8 Casos Trampa Forenses'
            : 'Filtrar Solo 8 Casos Trampa Forenses'}
        </button>
      </div>

      {/* Barra de Búsqueda y Filtros */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-2 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por código (EXP-2025-UNT-0001), área (AREA-TI-03), proveedor o descripción..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={nivelRiesgo}
            onChange={(e) => setNivelRiesgo(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
          >
            <option value="TODOS">Nivel de Riesgo: Todos</option>
            <option value="ALTO">Riesgo Alto (Con Señal XAI)</option>
            <option value="MEDIO">Riesgo Medio</option>
            <option value="LIMPIO">Limpio (Cumplimiento Verificado)</option>
          </select>
        </div>

        <div>
          <select
            value={integridad}
            onChange={(e) => setIntegridad(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
          >
            <option value="TODAS">Integridad SHA-256: Todas</option>
            <option value="INTEGRA">Cadena SHA-256 Íntegra</option>
            <option value="ROTA">Cadena SHA-256 Rota (Alteración Ex-Post)</option>
          </select>
        </div>
      </div>

      {/* Tabla de Expedientes */}
      <div className="rounded-2xl bg-slate-900/90 border border-slate-800 overflow-hidden">
        <div className="px-6 py-3.5 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>
            Resultados encontrados: <strong className="text-white">{expedientes.length}</strong> expediente(s)
          </span>
          <span className="font-mono text-[11px] text-emerald-400">
            Anonimización Ley N° 29733 Activa
          </span>
        </div>

        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center space-y-3">
            <RefreshCw className="w-7 h-7 text-emerald-400 animate-spin" />
            <span className="text-xs text-slate-400">Consultando expedientes...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/40 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="py-3.5 px-4">Código</th>
                  <th className="py-3.5 px-4">Objeto de Contratación</th>
                  <th className="py-3.5 px-4">Área Usuaria</th>
                  <th className="py-3.5 px-4">Modalidad</th>
                  <th className="py-3.5 px-4">Adjudicado</th>
                  <th className="py-3.5 px-4">Monto (S/)</th>
                  <th className="py-3.5 px-4">Cadena SHA-256</th>
                  <th className="py-3.5 px-4">Nivel Riesgo</th>
                  <th className="py-3.5 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs">
                {expedientes.map((exp) => (
                  <tr
                    key={exp.id}
                    className={`hover:bg-slate-800/40 transition-colors ${
                      !exp.integridad_valida
                        ? 'bg-rose-950/25'
                        : exp.es_caso_trampa
                        ? 'bg-amber-950/10'
                        : ''
                    }`}
                  >
                    <td className="py-3 px-4 font-mono font-bold text-cyan-300 whitespace-nowrap">
                      {exp.codigo}
                      {exp.tipo_trampa && (
                        <div className="text-[10px] font-mono text-amber-400 mt-0.5">
                          [{exp.tipo_trampa}]
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-200 max-w-xs">
                      <div className="line-clamp-2" title={exp.objeto}>
                        {exp.objeto}
                      </div>
                      <span className="text-[10px] text-slate-500">{exp.rubro}</span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-300 whitespace-nowrap">
                      {exp.area_usuaria}
                    </td>
                    <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                      {exp.modalidad}
                    </td>
                    <td className="py-3 px-4 font-mono text-emerald-300 whitespace-nowrap">
                      {exp.proveedor_adjudicado_codigo}
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold text-white whitespace-nowrap">
                      S/ {exp.monto_estimado.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <IntegrityBadge integra={exp.integridad_valida} />
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <RiskBadge nivel={exp.nivel_riesgo} puntaje={exp.puntaje_riesgo} />
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap space-x-2">
                      <button
                        onClick={() => navigate(`/trazabilidad?id=${exp.id}`)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 font-semibold transition"
                        title="Inspeccionar Cadena SHA-256 y Análisis Semántico TDR"
                      >
                        <FileSearch className="w-3.5 h-3.5" />
                        Trazabilidad
                      </button>
                      <a
                        href={centinelaApi.obtenerUrlReportePdf(exp.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold transition"
                        title="Descargar Reporte Oficial PDF con Sello SHA-256"
                      >
                        <FileDown className="w-3.5 h-3.5 text-cyan-400" />
                        PDF
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
