import React, { useState } from 'react';
import { Grid3X3, ShieldAlert, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { MapaRiesgosData } from '../types';

interface MapaRiesgosPanelProps {
  mapa: MapaRiesgosData;
}

function getNivelBadge(nivel: string) {
  if (nivel === 'CRÍTICO') {
    return 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/40';
  }
  if (nivel === 'ALTO') {
    return 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/40';
  }
  if (nivel === 'MEDIO') {
    return 'bg-sky-100 text-sky-900 border-sky-300 dark:bg-sky-500/20 dark:text-sky-300 dark:border-sky-500/40';
  }
  return 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/40';
}

function getMatrixCellColor(prob: number, imp: number): string {
  const score = prob * imp;
  if (score >= 16) return 'bg-rose-500/20 dark:bg-rose-500/25 border-rose-300 dark:border-rose-500/40';
  if (score >= 10) return 'bg-amber-400/20 dark:bg-amber-500/20 border-amber-300 dark:border-amber-500/40';
  if (score >= 5) return 'bg-sky-400/15 dark:bg-sky-500/15 border-sky-200 dark:border-sky-500/30';
  return 'bg-emerald-400/15 dark:bg-emerald-500/15 border-emerald-200 dark:border-emerald-500/30';
}

export const MapaRiesgosPanel: React.FC<MapaRiesgosPanelProps> = ({ mapa }) => {
  const [hoveredStage, setHoveredStage] = useState<number | null>(null);
  const probLevels = [5, 4, 3, 2, 1];
  const impLevels = [1, 2, 3, 4, 5];

  return (
    <div className="animate-card-up p-6 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-none space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Grid3X3 className="w-5 h-5 text-blue-700 dark:text-cyan-400" />
            Mapa de Riesgos de Integridad — Matriz Probabilidad × Impacto por Etapa Crítica
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {mapa.marco_referencia}
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 dark:bg-rose-500/15 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30 text-xs font-bold">
          <ShieldAlert className="w-3.5 h-3.5" />
          {mapa.total_etapas_criticas} / {mapa.etapas.length} etapas en prioridad Alta/Crítica
        </span>
      </div>

      {/* Fila Superior Balanceada: Matriz 5x5 + Resumen de las 6 Etapas (sin espacios vacíos) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Matriz Visual 5x5 (Probabilidad vs Impacto) */}
        <div className="lg:col-span-5 p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-col justify-between space-y-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 text-center">
            Matriz 5×5 (Probabilidad ↑ vs. Impacto →)
          </div>

          <div className="grid grid-cols-6 gap-1.5 text-[10px] font-mono">
            <div className="flex items-center justify-center text-slate-400 font-bold">P\I</div>
            {impLevels.map((imp) => (
              <div
                key={`hdr-${imp}`}
                className="flex items-center justify-center font-bold text-slate-600 dark:text-slate-400 py-1"
              >
                I{imp}
              </div>
            ))}

            {probLevels.map((prob) => (
              <React.Fragment key={`row-${prob}`}>
                <div className="flex items-center justify-center font-bold text-slate-600 dark:text-slate-400">
                  P{prob}
                </div>
                {impLevels.map((imp) => {
                  const itemsEnCelda = mapa.etapas.filter(
                    (e) => e.probabilidad === prob && e.impacto === imp,
                  );
                  const cellHasHovered =
                    hoveredStage !== null &&
                    itemsEnCelda.some((it) => it.orden === hoveredStage);
                  return (
                    <div
                      key={`cell-${prob}-${imp}`}
                      className={`min-h-[38px] rounded-lg border p-1 flex flex-wrap items-center justify-center gap-1 transition-all duration-150 ${getMatrixCellColor(prob, imp)} ${
                        cellHasHovered
                          ? 'ring-2 ring-emerald-500/80 dark:ring-emerald-400/80 scale-[1.03] z-10'
                          : ''
                      }`}
                      title={`Probabilidad ${prob} × Impacto ${imp} = ${prob * imp}`}
                    >
                      {itemsEnCelda.length > 0 ? (
                        itemsEnCelda.map((it) => {
                          const isHovered = hoveredStage === it.orden;
                          const isDimmed = hoveredStage !== null && !isHovered;
                          return (
                            <span
                              key={it.orden}
                              onMouseEnter={() => setHoveredStage(it.orden)}
                              onMouseLeave={() => setHoveredStage(null)}
                              className={`w-5 h-5 rounded-full font-extrabold text-[10px] flex items-center justify-center shadow-sm cursor-pointer transition-all duration-150 ${
                                isHovered
                                  ? 'bg-emerald-600 dark:bg-emerald-400 text-white dark:text-slate-950 scale-125 ring-2 ring-emerald-500 dark:ring-emerald-300 z-10'
                                  : 'bg-[#0B1F3A] dark:bg-white text-white dark:text-slate-950'
                              } ${isDimmed ? 'opacity-45' : ''}`}
                              title={`${it.etapa}: ${it.riesgo_principal}`}
                            >
                              {it.orden}
                            </span>
                          );
                        })
                      ) : (
                        <span className="text-[9px] text-slate-400/70">{prob * imp}</span>
                      )}
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-1 text-[10px] text-slate-600 dark:text-slate-400">
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-rose-500/40 border border-rose-400" />
              Crítico (16–25)
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-amber-400/40 border border-amber-400" />
              Alto (10–15)
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-sky-400/30 border border-sky-400" />
              Medio (5–9)
            </span>
          </div>
        </div>

        {/* Índice Rápido de las 6 Etapas Críticas */}
        <div className="lg:col-span-7 p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-col justify-between space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Ubicación de las 6 Etapas del Ciclo Contractual
            </span>
            <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
              Universo: {mapa.total_expedientes} expedientes
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {mapa.etapas.map((et) => {
              const isHovered = hoveredStage === et.orden;
              return (
                <div
                  key={`idx-${et.orden}`}
                  onMouseEnter={() => setHoveredStage(et.orden)}
                  onMouseLeave={() => setHoveredStage(null)}
                  className={`p-2.5 rounded-lg border flex items-start justify-between gap-2 cursor-pointer transition-all duration-150 ${
                    isHovered
                      ? 'bg-emerald-50/70 dark:bg-emerald-500/10 border-emerald-500 dark:border-emerald-400 shadow-sm -translate-y-0.5'
                      : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start gap-2 min-w-0">
                    <span
                      className={`w-5 h-5 rounded-full font-mono text-[10px] font-extrabold flex items-center justify-center shrink-0 mt-0.5 transition-transform duration-150 ${
                        isHovered
                          ? 'bg-emerald-600 dark:bg-emerald-400 text-white dark:text-slate-950 scale-110'
                          : 'bg-[#0B1F3A] dark:bg-emerald-500 text-white dark:text-slate-950'
                      }`}
                    >
                      {et.orden}
                    </span>
                    <div className="min-w-0 leading-tight">
                      <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {et.etapa.replace(/^\d+\.\s*/, '')}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {et.componente_modelo_integridad}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span
                      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full border text-[10px] font-mono font-bold ${getNivelBadge(et.nivel)}`}
                    >
                      {et.probabilidad}×{et.impacto}={et.puntaje_inherente}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                      {et.expedientes_afectados} caso(s)
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200 dark:border-slate-800">
            Pase el cursor sobre cualquier etapa (<strong className="text-slate-700 dark:text-slate-200">1–6</strong>) para resaltar su ubicación en la matriz 5×5 y su control preventivo en CENTINELA.
          </div>
        </div>
      </div>

      {/* Tabla Completa Ancho Total: Detalle de Riesgos, Causas Raíz y Controles */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <th className="py-2.5 px-2.5 w-48">Etapa Crítica</th>
              <th className="py-2.5 px-2.5">Riesgo y Causa Raíz</th>
              <th className="py-2.5 px-2.5 text-center w-24">P × I</th>
              <th className="py-2.5 px-2.5 text-center w-16">Casos</th>
              <th className="py-2.5 px-2.5 w-64">Control Preventivo CENTINELA</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 text-xs">
            {mapa.etapas.map((et) => {
              const isHovered = hoveredStage === et.orden;
              return (
                <tr
                  key={et.orden}
                  onMouseEnter={() => setHoveredStage(et.orden)}
                  onMouseLeave={() => setHoveredStage(null)}
                  className={`border-l-2 transition-colors duration-150 ${
                    isHovered
                      ? 'bg-emerald-50/70 dark:bg-emerald-500/10 border-l-emerald-600 dark:border-l-emerald-400'
                      : 'border-l-transparent hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <td className="py-2.5 px-2.5 align-top">
                    <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span
                        className={`w-5 h-5 rounded-full font-mono text-[10px] font-extrabold flex items-center justify-center shrink-0 transition-transform duration-150 ${
                          isHovered
                            ? 'bg-emerald-600 dark:bg-emerald-400 text-white dark:text-slate-950 scale-110'
                            : 'bg-[#0B1F3A] dark:bg-emerald-500 text-white dark:text-slate-950'
                        }`}
                      >
                        {et.orden}
                      </span>
                      <span>{et.etapa.replace(/^\d+\.\s*/, '')}</span>
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 pl-6">
                      {et.componente_modelo_integridad}
                    </div>
                  </td>
                  <td className="py-2.5 px-2.5 align-top">
                    <div className="font-semibold text-slate-800 dark:text-slate-200">
                      {et.riesgo_principal}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {et.causa_raiz}
                    </div>
                  </td>
                  <td className="py-2.5 px-2.5 align-top text-center whitespace-nowrap">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-mono font-bold ${getNivelBadge(et.nivel)}`}
                    >
                      {et.nivel === 'CRÍTICO' ? (
                        <AlertTriangle className="w-3 h-3" />
                      ) : (
                        <CheckCircle2 className="w-3 h-3" />
                      )}
                      {et.probabilidad}×{et.impacto}={et.puntaje_inherente}
                    </span>
                  </td>
                  <td className="py-2.5 px-2.5 align-top text-center font-mono font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                    {et.expedientes_afectados}
                  </td>
                  <td className="py-2.5 px-2.5 align-top text-[11px] text-emerald-800 dark:text-emerald-300 font-medium">
                    {et.control_centinela}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
