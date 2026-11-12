import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  AlertOctagon,
  TrendingUp,
  RefreshCw,
  FileSearch,
  ArrowRight,
  Layers,
  Lock,
  Sparkles,
  Scale,
} from 'lucide-react';
import { centinelaApi } from '../api/client';
import { DashboardKPIs, RolUsuario } from '../types';
import { IntegrityBadge, RiskBadge } from '../components/AlertBadge';

interface DashboardPageProps {
  rolActivo: RolUsuario;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ rolActivo }) => {
  const navigate = useNavigate();
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [regenerating, setRegenerating] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const cargarDashboard = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const data = await centinelaApi.getDashboardKPIs();
      setKpis(data);
    } catch (err: any) {
      setErrorMsg(
        'No se pudo conectar con el motor backend de CENTINELA. Verifique que FastAPI esté ejecutándose en el puerto 8000.',
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDashboard();
  }, []);

  const handleRegenerar = async () => {
    try {
      setRegenerating(true);
      setFeedbackMsg(null);
      const res = await centinelaApi.regenerarDataset();
      setFeedbackMsg(res.mensaje);
      await cargarDashboard();
    } catch (err) {
      setErrorMsg('Error al regenerar el dataset sintético.');
    } finally {
      setRegenerating(false);
    }
  };

  if (loading && !kpis) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <RefreshCw className="w-10 h-10 text-emerald-400 animate-spin" />
        <p className="text-sm text-slate-400 font-mono">
          Verificando cadena SHA-256 y señales XAI sobre 120 expedientes...
        </p>
      </div>
    );
  }

  if (errorMsg && !kpis) {
    return (
      <div className="p-6 rounded-2xl bg-rose-950/40 border border-rose-500/40 text-rose-200 space-y-4">
        <div className="flex items-center gap-3">
          <AlertOctagon className="w-6 h-6 text-rose-400" />
          <h3 className="text-lg font-bold">Conexión Pendiente con Backend</h3>
        </div>
        <p className="text-sm text-rose-300">{errorMsg}</p>
        <button
          onClick={cargarDashboard}
          className="px-4 py-2 rounded-xl bg-rose-500 text-slate-950 font-bold text-xs hover:bg-rose-400 transition"
        >
          Reintentar Conexión
        </button>
      </div>
    );
  }

  if (!kpis) return null;

  return (
    <div className="space-y-8">
      {/* Encabezado Ejecutivo y Botón Regenerar Dataset */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/40 p-6 rounded-2xl border border-slate-800">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            Centro de Control Preventivo • Ley N° 32069 & Ley N° 29733
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            Monitoreo Institucional de Integridad y Trazabilidad Forense
          </h1>
          <p className="text-xs text-slate-400 max-w-3xl">
            Evaluación automatizada sobre universo sintético de contrataciones públicas universitarias (TRL-4).
            Perspectiva activa: <span className="text-cyan-300 font-semibold">{rolActivo}</span>.
          </p>
        </div>

        <button
          onClick={handleRegenerar}
          disabled={regenerating}
          className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all"
        >
          <RefreshCw className={`w-4 h-4 ${regenerating ? 'animate-spin' : ''}`} />
          {regenerating
            ? 'Regenerando 120 Expedientes...'
            : 'Regenerar Dataset Sintético (120 Exp.)'}
        </button>
      </div>

      {feedbackMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-200 text-xs font-medium flex items-center justify-between">
          <span>{feedbackMsg}</span>
          <button
            onClick={() => setFeedbackMsg(null)}
            className="text-emerald-300 underline ml-4"
          >
            Ocultar
          </button>
        </div>
      )}

      {/* Tarjetas de KPIs Ejecutivos */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Universo Auditado
            </span>
            <Layers className="w-5 h-5 text-cyan-400" />
          </div>
          <div className="text-3xl font-extrabold text-white">
            {kpis.total_expedientes}{' '}
            <span className="text-sm font-semibold text-slate-400">Expedientes</span>
          </div>
          <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-800/80">
            <span className="text-emerald-400 font-semibold">
              {kpis.expedientes_limpios} Limpios (93.3%)
            </span>
            <span className="text-rose-400 font-semibold">
              {kpis.expedientes_observados} Con Señal XAI
            </span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Presupuesto Total Auditado
            </span>
            <Scale className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="text-2xl font-extrabold text-white font-mono">
            S/{' '}
            {kpis.monto_total_auditado.toLocaleString('es-PE', {
              minimumFractionDigits: 2,
            })}
          </div>
          <div className="text-xs text-slate-400 pt-2 border-t border-slate-800/80">
            Monto con señales de riesgo:{' '}
            <span className="text-amber-300 font-mono font-semibold">
              S/ {kpis.monto_en_riesgo_preventivo.toLocaleString('es-PE')}
            </span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/90 border border-emerald-500/30 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">
              Ahorro Preventivo Estimado
            </span>
            <TrendingUp className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-400 font-mono">
            S/{' '}
            {kpis.ahorro_preventivo_estimado.toLocaleString('es-PE', {
              minimumFractionDigits: 2,
            })}
          </div>
          <div className="text-xs text-slate-400 pt-2 border-t border-slate-800/80">
            Detección temprana de sobrecostos, fraccionamiento y direccionamiento
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Integridad Criptográfica SHA-256
            </span>
            <Lock className="w-5 h-5 text-cyan-400" />
          </div>
          <div className="text-2xl font-extrabold text-white">
            {kpis.expedientes_integridad_rota === 0 ? (
              <span className="text-cyan-300">100% Íntegra</span>
            ) : (
              <span className="text-rose-400">
                {kpis.expedientes_integridad_rota} Cadena(s) Rota(s)
              </span>
            )}
          </div>
          <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-800/80">
            <span className="text-slate-400">
              Señales XAI activas: <b className="text-white">{kpis.total_alertas_xai}</b>
            </span>
            <span className="text-amber-300 font-semibold">
              {kpis.alertas_pendientes} Pendientes
            </span>
          </div>
        </div>
      </div>

      {/* Distribución de Señales XAI + Arquitectura de Cinco Capas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white">
                Distribución de Señales Explicables (XAI) por Tipología Normativa
              </h2>
              <p className="text-xs text-slate-400">
                Cada señal incluye regla activada, evidencia exacta y base legal (Ley N° 32069 / D.S. N° 009-2025-EF)
              </p>
            </div>
            <button
              onClick={() => navigate('/compliance')}
              className="text-xs font-bold text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1"
            >
              Ir a Bandeja XAI <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3 pt-2">
            {kpis.alertas_por_categoria.map((cat) => {
              const porcentaje = Math.min(
                100,
                Math.round((cat.cantidad / Math.max(1, kpis.total_alertas_xai)) * 100),
              );
              return (
                <div key={cat.categoria} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-200">{cat.categoria}</span>
                    <span className="font-mono text-slate-400">
                      {cat.cantidad} señal(es) • {porcentaje}%
                    </span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-400"
                      style={{ width: `${Math.max(12, porcentaje)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            Garantías Éticas y Legales
          </h2>
          <ul className="space-y-3 text-xs text-slate-300 leading-relaxed">
            <li className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80">
              <strong className="text-emerald-300 block mb-0.5">
                1. Sin Caja Negra (100% Explicable):
              </strong>
              Ninguna alerta acusa de delito; expone la evidencia objetiva para revisión del especialista o auditor OCI.
            </li>
            <li className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80">
              <strong className="text-cyan-300 block mb-0.5">
                2. Privacidad por Diseño (Ley N° 29733):
              </strong>
              Seudonimización nativa de funcionarios (<code className="font-mono">FUNC-*</code>) y postores (<code className="font-mono">PROV-SYN-*</code>).
            </li>
            <li className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80">
              <strong className="text-amber-300 block mb-0.5">
                3. Inmutabilidad Blockchain-Lite:
              </strong>
              Encadenamiento SHA-256 en las 6 etapas del expediente para detectar ediciones ex-post en base de datos.
            </li>
          </ul>
        </div>
      </div>

      {/* Tabla de los 8 Casos Trampa / Expedientes Observados */}
      <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-white">
              Expedientes Prioritarios con Señales de Riesgo Detectadas (Casos Forenses)
            </h2>
            <p className="text-xs text-slate-400">
              Seleccione cualquier expediente para inspeccionar su cadena SHA-256, análisis semántico de TDR o descargar su Reporte PDF Oficial
            </p>
          </div>
          <button
            onClick={() => navigate('/expedientes')}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 inline-flex items-center gap-1.5 transition"
          >
            Ver los 120 Expedientes <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <th className="py-3 px-3">Código</th>
                <th className="py-3 px-3">Objeto de Contratación</th>
                <th className="py-3 px-3">Área Usuaria</th>
                <th className="py-3 px-3">Modalidad</th>
                <th className="py-3 px-3">Monto (PEN)</th>
                <th className="py-3 px-3">Tipología Detectada</th>
                <th className="py-3 px-3">Integridad SHA-256</th>
                <th className="py-3 px-3">Riesgo</th>
                <th className="py-3 px-3 text-right">Acción Forense</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 text-xs">
              {kpis.casos_destacados.map((exp) => (
                <tr
                  key={exp.id}
                  className="hover:bg-slate-800/40 transition-colors"
                >
                  <td className="py-3 px-3 font-mono font-bold text-cyan-300 whitespace-nowrap">
                    {exp.codigo}
                  </td>
                  <td className="py-3 px-3 text-slate-200 max-w-xs truncate" title={exp.objeto}>
                    {exp.objeto}
                  </td>
                  <td className="py-3 px-3 font-mono text-slate-300 whitespace-nowrap">
                    {exp.area_usuaria}
                  </td>
                  <td className="py-3 px-3 text-slate-400 whitespace-nowrap">
                    {exp.modalidad}
                  </td>
                  <td className="py-3 px-3 font-mono font-semibold text-white whitespace-nowrap">
                    S/ {exp.monto_estimado.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-3">
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-amber-300 font-mono text-[11px] border border-slate-700">
                      {exp.tipo_trampa || 'ALTERACION_EX_POST'}
                    </span>
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap">
                    <IntegrityBadge integra={exp.integridad_valida} />
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap">
                    <RiskBadge nivel={exp.nivel_riesgo} puntaje={exp.puntaje_riesgo} />
                  </td>
                  <td className="py-3 px-3 text-right whitespace-nowrap">
                    <button
                      onClick={() => navigate(`/trazabilidad?id=${exp.id}`)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 font-semibold transition"
                    >
                      <FileSearch className="w-3.5 h-3.5" />
                      Auditar Cadena
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
