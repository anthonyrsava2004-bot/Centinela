import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Scale,
  FileSearch,
  FileDown,
  MessageSquarePlus,
  CheckCircle2,
  ShieldAlert,
  RefreshCw,
  UserCheck,
} from 'lucide-react';
import { centinelaApi } from '../api/client';
import { AlertaGestion, RolUsuario } from '../types';
import { RevisionStatusBadge } from '../components/AlertBadge';
import { Modal } from '../components/Modal';

interface CompliancePageProps {
  rolActivo: RolUsuario;
}

export const CompliancePage: React.FC<CompliancePageProps> = ({ rolActivo }) => {
  const navigate = useNavigate();
  const [alertas, setAlertas] = useState<AlertaGestion[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filtroEstado, setFiltroEstado] = useState<string>('TODOS');
  const [filtroCategoria, setFiltroCategoria] = useState<string>('TODAS');

  // Estado del Modal de Revisión Humana / Descargo
  const [alertaSeleccionada, setAlertaSeleccionada] = useState<AlertaGestion | null>(null);
  const [nuevoEstado, setNuevoEstado] = useState<string>('EN_DESCARGO');
  const [comentario, setComentario] = useState<string>('');
  const [guardando, setGuardando] = useState<boolean>(false);

  const esAuditorOCI = rolActivo.startsWith('Auditor OCI');

  const cargarAlertas = async () => {
    try {
      setLoading(true);
      const data = await centinelaApi.listarAlertas({
        estado_revision: filtroEstado !== 'TODOS' ? filtroEstado : undefined,
        categoria: filtroCategoria !== 'TODAS' ? filtroCategoria : undefined,
      });
      setAlertas(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarAlertas();
  }, [filtroEstado, filtroCategoria]);

  const abrirModalRevision = (alerta: AlertaGestion) => {
    setAlertaSeleccionada(alerta);
    setNuevoEstado(
      esAuditorOCI ? 'VALIDADA_OCI' : 'EN_DESCARGO',
    );
    setComentario(
      alerta.comentario_descargo ||
        (esAuditorOCI
          ? 'Se valida la señal preventiva XAI y se dispone apertura de Acción de Control Simultáneo (Hito de Control) conforme a Directiva CGR y Ley N° 32069.'
          : 'Se adjunta informe técnico sustentatorio de la Dependencia Encargada de las Contrataciones (DEC) detallando estudio de mercado y necesidad institucional urgente.'),
    );
  };

  const handleGuardarRevision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!alertaSeleccionada) return;
    try {
      setGuardando(true);
      await centinelaApi.actualizarAlerta(alertaSeleccionada.id, {
        estado_revision: nuevoEstado,
        comentario_descargo: comentario,
        rol_usuario: rolActivo,
      });
      setAlertaSeleccionada(null);
      await cargarAlertas();
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/95 p-6 rounded-2xl border border-slate-800">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 text-xs font-semibold">
            <UserCheck className="w-3.5 h-3.5" />
            Flujo Human-in-the-Loop Activo como: {rolActivo}
          </div>
          <h1 className="text-2xl font-extrabold text-white mt-1">
            Bandeja de Gestión de Señales Explicables (XAI) & Compliance Normativo
          </h1>
          <p className="text-xs text-slate-400 max-w-3xl">
            En cumplimiento del Principio de Presunción de Licitud (Art. 248 Ley N° 27444), ninguna señal algorítmica es punitiva por sí misma. Requiere evaluación humana, registro de descargos y dictamen motivado.
          </p>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200"
          >
            <option value="TODOS">Estado de Revisión: Todos</option>
            <option value="PENDIENTE">Pendientes de Revisión</option>
            <option value="EN_DESCARGO">Con Descargo Técnico (DEC)</option>
            <option value="VALIDADA_OCI">Validadas para Control OCI</option>
            <option value="ARCHIVADA_SUSTENTADA">Sustentadas y Archivadas</option>
          </select>

          <select
            value={filtroCategoria}
            onChange={(e) => setFiltroCategoria(e.target.value)}
            className="px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200"
          >
            <option value="TODAS">Categoría XAI: Todas</option>
            <option value="Fraccionamiento Indebido">Fraccionamiento (&lt;= 8 UIT)</option>
            <option value="Colusión en Grafos">Colusión en Grafos</option>
            <option value="Direccionamiento Semántico TDR">Direccionamiento TDR (NLP)</option>
            <option value="Segregación de Funciones">Segregación de Funciones</option>
            <option value="Ejecución Contractual / Pago">Pago sin Conformidad</option>
            <option value="Integridad Criptográfica SHA-256">Ruptura SHA-256</option>
          </select>
        </div>
      </div>

      {/* Listado de Tarjetas Explicables XAI */}
      {loading ? (
        <div className="p-12 flex flex-col items-center justify-center space-y-3">
          <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
          <span className="text-xs text-slate-400 font-mono">
            Cargando bandeja de señales explicables XAI...
          </span>
        </div>
      ) : (
        <div className="space-y-4">
          {alertas.map((alerta) => (
            <div
              key={alerta.id}
              className="p-6 rounded-2xl bg-slate-900/95 border border-slate-800 hover:border-slate-700 transition space-y-4"
            >
              {/* Fila superior */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3.5">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="px-2.5 py-1 rounded-lg bg-rose-500/15 text-rose-300 border border-rose-500/30 font-mono text-xs font-bold">
                    {alerta.codigo_regla}
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-cyan-300 font-mono text-xs font-bold">
                    {alerta.expediente_codigo}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    Área: <strong className="text-slate-200">{alerta.area_usuaria}</strong> • Monto:{' '}
                    <strong className="text-emerald-300">
                      S/{' '}
                      {(alerta.expediente_monto || 0).toLocaleString('es-PE', {
                        minimumFractionDigits: 2,
                      })}
                    </strong>
                  </span>
                </div>

                <RevisionStatusBadge estado={alerta.estado_revision} />
              </div>

              {/* Título No Punitivo */}
              <div>
                <h3 className="text-base font-extrabold text-white">{alerta.titulo}</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Proceso: {alerta.expediente_objeto}
                </p>
              </div>

              {/* Estructura Tripartita Obligatoria XAI: (a) Regla, (b) Evidencia, (c) Base Normativa */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="p-4 rounded-xl bg-slate-950/90 border border-slate-800/90 space-y-1.5">
                  <div className="font-bold text-cyan-400 uppercase tracking-wider text-[11px]">
                    (a) Regla Algorítmica Activada
                  </div>
                  <p className="text-slate-300 leading-relaxed">{alerta.regla_activada}</p>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/90 border border-slate-800/90 space-y-1.5">
                  <div className="font-bold text-emerald-400 uppercase tracking-wider text-[11px]">
                    (b) Evidencia Forense Exacta
                  </div>
                  <p className="text-slate-200 leading-relaxed font-medium">
                    {alerta.evidencia_exacta}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/90 border border-slate-800/90 space-y-1.5">
                  <div className="font-bold text-amber-400 uppercase tracking-wider text-[11px]">
                    (c) Base Normativa Exacta
                  </div>
                  <p className="text-slate-300 leading-relaxed">{alerta.base_normativa}</p>
                </div>
              </div>

              {/* Descargo o Dictamen Registrado */}
              {alerta.comentario_descargo && (
                <div className="p-4 rounded-xl bg-sky-950/30 border border-sky-500/40 text-xs space-y-1">
                  <div className="flex items-center justify-between text-sky-300 font-bold">
                    <span>
                       pronunciamiento / Descargo Registrado por: {alerta.rol_ultimo_cambio}
                    </span>
                    <span className="font-mono text-[11px]">{alerta.fecha_actualizacion}</span>
                  </div>
                  <p className="text-slate-200 leading-relaxed">{alerta.comentario_descargo}</p>
                </div>
              )}

              {/* Botones de Acción por Rol */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => navigate(`/trazabilidad?id=${alerta.expediente_id}`)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
                  >
                    <FileSearch className="w-3.5 h-3.5 text-cyan-400" />
                    Inspeccionar Cadena SHA-256
                  </button>
                  <a
                    href={centinelaApi.obtenerUrlReportePdf(alerta.expediente_id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
                  >
                    <FileDown className="w-3.5 h-3.5 text-emerald-400" />
                    Reporte PDF Oficial
                  </a>
                </div>

                <button
                  onClick={() => abrirModalRevision(alerta)}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs shadow-md transition ${
                    esAuditorOCI
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                      : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950'
                  }`}
                >
                  <MessageSquarePlus className="w-4 h-4" />
                  {esAuditorOCI
                    ? 'Emitir Dictamen Auditor OCI'
                    : 'Registrar Descargo Especialista Logística'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal para Registrar Descargo o Cambiar Estado de Alerta */}
      <Modal
        isOpen={Boolean(alertaSeleccionada)}
        onClose={() => setAlertaSeleccionada(null)}
        title={
          esAuditorOCI
            ? `Dictamen de Control Institucional (OCI) — ${alertaSeleccionada?.expediente_codigo}`
            : `Registro de Descargo Técnico (Logística DEC) — ${alertaSeleccionada?.expediente_codigo}`
        }
        subtitle={`Actuando bajo el rol: ${rolActivo} • Trazabilidad Ley N° 32069 y Ley N° 27444`}
      >
        {alertaSeleccionada && (
          <form onSubmit={handleGuardarRevision} className="space-y-4 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <div className="font-mono text-rose-300 font-bold">
                [{alertaSeleccionada.codigo_regla}] {alertaSeleccionada.titulo}
              </div>
              <p className="text-slate-400">{alertaSeleccionada.evidencia_exacta}</p>
            </div>

            <div className="space-y-1.5">
              <label className="block font-bold text-slate-200">
                Nuevo Estado de la Señal Preventiva:
              </label>
              <select
                value={nuevoEstado}
                onChange={(e) => setNuevoEstado(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 focus:outline-none focus:border-emerald-500"
              >
                <option value="EN_DESCARGO">
                  EN_DESCARGO — Descargo Técnico Presentado por Especialista Logística (DEC)
                </option>
                <option value="VALIDADA_OCI">
                  VALIDADA_OCI — Observación Confirmada por Auditor OCI para Hito de Control
                </option>
                <option value="ARCHIVADA_SUSTENTADA">
                  ARCHIVADA_SUSTENTADA — Desestimada con Sustento Técnico-Legal Firme
                </option>
                <option value="PENDIENTE">
                  PENDIENTE — Retornar a Estado Pendiente de Revisión
                </option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block font-bold text-slate-200">
                Sustento Técnico-Normativo / Descargo Oficial:
              </label>
              <textarea
                rows={4}
                required
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                className="w-full p-3.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 focus:outline-none focus:border-emerald-500"
                placeholder="Ingrese el fundamento técnico o normativo de la revisión humana..."
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setAlertaSeleccionada(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={guardando}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold shadow-lg shadow-emerald-500/20"
              >
                <CheckCircle2 className="w-4 h-4" />
                {guardando ? 'Guardando en BD...' : 'Firmar y Guardar Revisión'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
