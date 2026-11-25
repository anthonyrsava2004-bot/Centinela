import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  Lock,
  Send,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Building2,
  CalendarClock,
  ShieldAlert,
  RefreshCw,
  FileCheck2,
  KeyRound,
} from 'lucide-react';
import { centinelaApi } from '../api/client';
import {
  DenunciaConsultaPublica,
  DenunciaItem,
  DenunciaResumenPublico,
  RolUsuario,
} from '../types';
import { Modal } from '../components/Modal';

interface DenunciasPageProps {
  rolActivo: RolUsuario;
}

const CATEGORIAS_DENUNCIA = [
  'Fraccionamiento / Compras Partidas',
  'Conflicto de Interés Encubierto',
  'Cobro o Favoritismo a Proveedor',
  'Pago sin Entregables Completos',
  'Posible Direccionamiento o Colusión',
  'Alteración Documental / Trato Asimétrico',
];

const AREAS_SINTETICAS = [
  'AREA-TI-03',
  'AREA-INFRA-01',
  'AREA-INFRA-02',
  'AREA-LAB-01',
  'AREA-LAB-02',
  'AREA-ADM-04',
  'Por determinar',
];

const ORGANOS_COMPETENTES = [
  'OCI — Órgano de Control Institucional',
  'Secretaría Técnica PAD (Procedimiento Administrativo Disciplinario)',
  'Procuraduría Pública (Posible Delito contra la Administración Pública)',
  'Oficina de Integridad — Evaluación de Admisibilidad',
];

const MEDIDAS_PROTECCION = [
  'Reserva de Identidad (D.L. N° 1327)',
  'Protección Laboral Anti-Represalias + Reserva de Identidad (Concedida)',
  'Separación Temporal del Denunciado + Reserva (Concedida)',
  'Cambio Temporal de Unidad del Denunciante (Concedida)',
];

function renderEstadoBadge(estado: string) {
  if (estado === 'DERIVADA') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-800 border border-blue-200 dark:bg-cyan-500/15 dark:text-cyan-300 dark:border-cyan-500/35">
        <Building2 className="w-3 h-3" />
        Derivada a Órgano Competente
      </span>
    );
  }
  if (estado === 'ATENDIDA') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/35">
        <CheckCircle2 className="w-3 h-3" />
        Atendida con Medidas
      </span>
    );
  }
  if (estado === 'ARCHIVADA_MOTIVADA') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
        <FileCheck2 className="w-3 h-3" />
        Archivada con Sustento
      </span>
    );
  }
  if (estado === 'EN_EVALUACION') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/35">
        <Clock className="w-3 h-3" />
        En Evaluación de Admisibilidad
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/35">
      <ShieldAlert className="w-3 h-3" />
      Recibida — Pendiente
    </span>
  );
}

export const DenunciasPage: React.FC<DenunciasPageProps> = ({ rolActivo }) => {
  const esAuditorOCI = rolActivo.startsWith('Auditor OCI');

  // Resumen agregado público (Numeral 7.2.7.3)
  const [resumen, setResumen] = useState<DenunciaResumenPublico | null>(null);
  // Bandeja confidencial exclusiva OCI
  const [denunciasOci, setDenunciasOci] = useState<DenunciaItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Formulario de nueva denuncia reservada (todos los roles)
  const [categoria, setCategoria] = useState<string>(CATEGORIAS_DENUNCIA[0]);
  const [areaInvolucrada, setAreaInvolucrada] = useState<string>(AREAS_SINTETICAS[0]);
  const [expedienteCodigo, setExpedienteCodigo] = useState<string>('');
  const [descripcionHechos, setDescripcionHechos] = useState<string>('');
  const [solicitaProteccion, setSolicitaProteccion] = useState<boolean>(true);
  const [enviando, setEnviando] = useState<boolean>(false);
  const [errorForm, setErrorForm] = useState<string | null>(null);
  const [reciboCreado, setReciboCreado] = useState<DenunciaConsultaPublica | null>(null);

  // Consulta por código cifrado (todos los roles)
  const [codigoConsulta, setCodigoConsulta] = useState<string>('DEN-2026-0001');
  const [resultadoConsulta, setResultadoConsulta] = useState<DenunciaConsultaPublica | null>(null);
  const [buscandoCodigo, setBuscandoCodigo] = useState<boolean>(false);
  const [errorConsulta, setErrorConsulta] = useState<string | null>(null);

  // Modal de gestión confidencial (exclusivo OCI)
  const [denunciaEdit, setDenunciaEdit] = useState<DenunciaItem | null>(null);
  const [nuevoEstado, setNuevoEstado] = useState<string>('DERIVADA');
  const [organoDerivado, setOrganoDerivado] = useState<string>(ORGANOS_COMPETENTES[0]);
  const [medidaProteccion, setMedidaProteccion] = useState<string>(MEDIDAS_PROTECCION[1]);
  const [fechaLimiteSla, setFechaLimiteSla] = useState<string>('');
  const [respuestaSeguimiento, setRespuestaSeguimiento] = useState<string>('');
  const [notaInternaOci, setNotaInternaOci] = useState<string>('');
  const [guardandoGestion, setGuardandoGestion] = useState<boolean>(false);
  const [errorGestion, setErrorGestion] = useState<string | null>(null);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      const res = await centinelaApi.obtenerResumenDenuncias();
      setResumen(res);
      if (esAuditorOCI) {
        const lista = await centinelaApi.listarDenunciasConfidenciales();
        setDenunciasOci(lista);
      } else {
        setDenunciasOci([]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, [rolActivo]);

  const handleEnviarDenuncia = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setEnviando(true);
      setErrorForm(null);
      const creada = await centinelaApi.registrarDenunciaReservada({
        categoria,
        area_involucrada: areaInvolucrada,
        expediente_codigo: expedienteCodigo.trim() || undefined,
        descripcion_hechos: descripcionHechos.trim(),
        solicita_proteccion: solicitaProteccion,
      });
      setReciboCreado(creada);
      setCodigoConsulta(creada.codigo_seguimiento);
      setResultadoConsulta(creada);
      setDescripcionHechos('');
      setExpedienteCodigo('');
      await cargarDatos();
    } catch (err: any) {
      setErrorForm(
        err?.response?.data?.detail || 'No se pudo registrar la denuncia. Revise los campos.',
      );
    } finally {
      setEnviando(false);
    }
  };

  const handleConsultarCodigo = async (codigoObjetivo?: string) => {
    const cod = (codigoObjetivo ?? codigoConsulta).trim();
    if (!cod) return;
    try {
      setBuscandoCodigo(true);
      setErrorConsulta(null);
      const res = await centinelaApi.consultarDenunciaPorCodigo(cod);
      setResultadoConsulta(res);
      setCodigoConsulta(res.codigo_seguimiento);
    } catch (err: any) {
      setResultadoConsulta(null);
      setErrorConsulta(
        err?.response?.data?.detail || 'No se encontró una denuncia con ese código.',
      );
    } finally {
      setBuscandoCodigo(false);
    }
  };

  const abrirModalGestion = (den: DenunciaItem) => {
    setErrorGestion(null);
    setDenunciaEdit(den);
    setNuevoEstado(den.estado === 'RECIBIDA' ? 'DERIVADA' : den.estado);
    setOrganoDerivado(
      ORGANOS_COMPETENTES.includes(den.organo_derivado)
        ? den.organo_derivado
        : ORGANOS_COMPETENTES[0],
    );
    setMedidaProteccion(MEDIDAS_PROTECCION[1]);
    setFechaLimiteSla(den.fecha_limite_sla);
    setRespuestaSeguimiento(
      `Reporte ${den.codigo_seguimiento} evaluado por la Oficina de Integridad y derivado al órgano competente con medida de protección vigente bajo D.L. N° 1327.`,
    );
    setNotaInternaOci(
      den.nota_interna_oci ||
        'Se verifica verosimilitud y trascendencia de los hechos (Tarea 7.2 Directiva N° 001-2026-PCM/SIP). Se otorga protección al denunciante y se deriva para investigación.',
    );
  };

  const handleGuardarGestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!denunciaEdit) return;
    try {
      setGuardandoGestion(true);
      setErrorGestion(null);
      await centinelaApi.gestionarDenunciaReservada(denunciaEdit.id, {
        estado: nuevoEstado,
        organo_derivado: organoDerivado,
        medida_proteccion: medidaProteccion,
        fecha_limite_sla: fechaLimiteSla,
        respuesta_seguimiento: respuestaSeguimiento,
        nota_interna_oci: notaInternaOci,
      });
      setDenunciaEdit(null);
      await cargarDatos();
      if (resultadoConsulta?.codigo_seguimiento === denunciaEdit.codigo_seguimiento) {
        await handleConsultarCodigo(denunciaEdit.codigo_seguimiento);
      }
    } catch (err: any) {
      setErrorGestion(
        err?.response?.data?.detail || 'No se pudo actualizar la gestión de la denuncia.',
      );
    } finally {
      setGuardandoGestion(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Encabezado (Superficie Sólida Limpia) */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 border-t-[3px] border-t-[#0B1F3A] dark:border-t-emerald-500 shadow-sm dark:shadow-none space-y-2">
        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 text-xs font-semibold">
          <Lock className="w-3.5 h-3.5" />
          Componente 7 — Directiva N° 001-2026-PCM/SIP • D.L. N° 1327 (Reserva de Identidad)
        </div>
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">
          Canal de Denuncia Seguro y Confidencial
        </h1>
        <p className="text-xs text-slate-600 dark:text-slate-400 max-w-3xl leading-relaxed">
          Permite reportar hechos irregulares que los controles automáticos no ven, con{' '}
          <strong className="text-slate-800 dark:text-slate-200">reserva estricta de identidad</strong>{' '}
          (no solicita DNI ni nombres reales), código cifrado de seguimiento, medidas de protección contra represalias y plazos de atención.
        </p>
      </div>

      {/* Estadísticas Generales Agregadas (Numeral 7.2.7.3 — sin exponer identidades) */}
      {resumen && (
        <div data-tour="den-resumen" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-none">
            <div className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">
              Reportes Recibidos
            </div>
            <div className="text-2xl font-extrabold text-slate-900 dark:text-white font-mono mt-1">
              {resumen.total_recibidas}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Indicador público agregado
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-500/30">
            <div className="text-[11px] font-bold uppercase text-amber-800 dark:text-amber-300">
              En Evaluación / Trámite
            </div>
            <div className="text-2xl font-extrabold text-amber-900 dark:text-amber-200 font-mono mt-1">
              {resumen.en_tramite}
            </div>
            <div className="text-[11px] text-amber-800/80 dark:text-amber-300/80 mt-0.5">
              Dentro de plazo SLA (7 días)
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-blue-50/70 dark:bg-cyan-950/20 border border-blue-200 dark:border-cyan-500/30">
            <div className="text-[11px] font-bold uppercase text-blue-800 dark:text-cyan-300">
              Derivadas a Control / PAD
            </div>
            <div className="text-2xl font-extrabold text-blue-900 dark:text-cyan-200 font-mono mt-1">
              {resumen.derivadas}
            </div>
            <div className="text-[11px] text-blue-800/80 dark:text-cyan-300/80 mt-0.5">
              OCI, Secretaría Técnica PAD o Procuraduría
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-500/30">
            <div className="text-[11px] font-bold uppercase text-emerald-800 dark:text-emerald-300">
              Con Protección al Denunciante
            </div>
            <div className="text-2xl font-extrabold text-emerald-900 dark:text-emerald-200 font-mono mt-1">
              {resumen.con_medida_proteccion}
            </div>
            <div className="text-[11px] text-emerald-800/80 dark:text-emerald-300/80 mt-0.5">
              Reserva de identidad (D.L. N° 1327)
            </div>
          </div>
        </div>
      )}

      {/* Bloque Dual: (1) Enviar Denuncia Reservada + (2) Consultar por Código */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Tarjeta Izquierda: Registrar Denuncia Reservada */}
        <div
          data-tour="den-registrar"
          className="p-6 rounded-2xl bg-white dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-none space-y-4"
        >
          <div>
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <Send className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              Enviar Reporte con Reserva de Identidad
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              No ingrese nombres propios ni DNI. El sistema genera un código cifrado anónimo para seguimiento.
            </p>
          </div>

          {reciboCreado && (
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/35 border border-emerald-300 dark:border-emerald-500/50 space-y-1.5 text-xs">
              <div className="flex items-center gap-1.5 font-extrabold text-emerald-900 dark:text-emerald-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                Denuncia registrada con código reservado:{' '}
                <span className="font-mono px-2 py-0.5 rounded bg-emerald-600 text-white">
                  {reciboCreado.codigo_seguimiento}
                </span>
              </div>
              <p className="text-emerald-800 dark:text-emerald-300">
                Guarde este código para hacer seguimiento sin revelar su identidad. Plazo SLA:{' '}
                <strong className="font-mono">{reciboCreado.fecha_limite_sla}</strong>.
              </p>
              <div className="font-mono text-[10px] text-emerald-700/80 dark:text-emerald-400/80 break-all">
                Sello de reserva SHA-256: {reciboCreado.hash_reserva.slice(0, 32)}...
              </div>
            </div>
          )}

          {errorForm && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-500/40 text-rose-800 dark:text-rose-200 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorForm}</span>
            </div>
          )}

          <form onSubmit={handleEnviarDenuncia} className="space-y-3.5 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block font-bold text-slate-700 dark:text-slate-200">
                  Tipo de Irregularidad:
                </label>
                <select
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                >
                  {CATEGORIAS_DENUNCIA.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-slate-700 dark:text-slate-200">
                  Área Involucrada (Código):
                </label>
                <select
                  value={areaInvolucrada}
                  onChange={(e) => setAreaInvolucrada(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-mono"
                >
                  {AREAS_SINTETICAS.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="block font-bold text-slate-700 dark:text-slate-200">
                Código de Expediente Relacionado (Opcional):
              </label>
              <input
                type="text"
                value={expedienteCodigo}
                onChange={(e) => setExpedienteCodigo(e.target.value)}
                placeholder="Ej. EXP-2025-UNT-0006 (opcional)"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="block font-bold text-slate-700 dark:text-slate-200">
                Descripción de los Hechos (sin datos personales reales):
              </label>
              <textarea
                rows={3}
                required
                minLength={15}
                value={descripcionHechos}
                onChange={(e) => setDescripcionHechos(e.target.value)}
                placeholder="Describa qué ocurrió, cuándo y qué evidencia existe (ej. se solicitó pago sin concluir las pruebas técnicas del contrato)..."
                className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100"
              />
            </div>

            <label className="flex items-start gap-2.5 p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-500/30 text-emerald-900 dark:text-emerald-200 cursor-pointer">
              <input
                type="checkbox"
                checked={solicitaProteccion}
                onChange={(e) => setSolicitaProteccion(e.target.checked)}
                className="mt-0.5 rounded border-emerald-400 text-emerald-600 focus:ring-emerald-500"
              />
              <span>
                <strong>Solicitar medida de protección al denunciante (D.L. N° 1327):</strong>{' '}
                reserva de identidad y protección frente a posibles represalias laborales o contractuales.
              </span>
            </label>

            <button
              type="submit"
              disabled={enviando}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white dark:text-slate-950 font-extrabold text-xs shadow-sm transition"
            >
              <Lock className="w-4 h-4" />
              {enviando ? 'Cifrando y Registrando...' : 'Enviar Reporte con Reserva de Identidad'}
            </button>
          </form>
        </div>

        {/* Tarjeta Derecha: Consultar Estado por Código Reservado */}
        <div
          data-tour="den-consultar"
          className="p-6 rounded-2xl bg-white dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-none space-y-4"
        >
          <div>
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-blue-700 dark:text-cyan-400" />
              Consultar Seguimiento con Código Reservado
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Ingrese el código asignado al denunciante para revisar estado, plazo y protección vigente.
            </p>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={codigoConsulta}
              onChange={(e) => setCodigoConsulta(e.target.value)}
              placeholder="DEN-2026-0001"
              className="flex-1 px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-slate-100"
            />
            <button
              type="button"
              onClick={() => handleConsultarCodigo()}
              disabled={buscandoCodigo}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 dark:bg-cyan-500 dark:hover:bg-cyan-400 text-white dark:text-slate-950 font-bold text-xs transition"
            >
              <Search className="w-3.5 h-3.5" />
              Consultar
            </button>
          </div>

          {/* Ejemplos rápidos para demo */}
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="text-slate-500 dark:text-slate-400">Códigos de prueba:</span>
            {['DEN-2026-0001', 'DEN-2026-0002', 'DEN-2026-0003'].map((codDemo) => (
              <button
                key={codDemo}
                type="button"
                onClick={() => handleConsultarCodigo(codDemo)}
                className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-blue-800 dark:text-cyan-300 font-mono font-semibold transition"
              >
                {codDemo}
              </button>
            ))}
          </div>

          {errorConsulta && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-500/40 text-rose-800 dark:text-rose-200 text-xs">
              {errorConsulta}
            </div>
          )}

          {resultadoConsulta ? (
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-2.5">
                <span className="font-mono font-extrabold text-blue-800 dark:text-cyan-300">
                  {resultadoConsulta.codigo_seguimiento}
                </span>
                {renderEstadoBadge(resultadoConsulta.estado)}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[11px]">
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block">Categoría:</span>
                  <strong className="text-slate-800 dark:text-slate-200">
                    {resultadoConsulta.categoria}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block">Plazo SLA:</span>
                  <strong className="font-mono text-amber-800 dark:text-amber-300">
                    {resultadoConsulta.fecha_limite_sla}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block">Órgano a cargo:</span>
                  <strong className="text-slate-800 dark:text-slate-200">
                    {resultadoConsulta.organo_derivado}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block">
                    Protección al denunciante:
                  </span>
                  <strong className="text-emerald-700 dark:text-emerald-300">
                    {resultadoConsulta.medida_proteccion}
                  </strong>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 leading-relaxed">
                <strong className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">
                  Última actualización oficial ({resultadoConsulta.ultima_actualizacion}):
                </strong>
                {resultadoConsulta.respuesta_seguimiento}
              </div>
            </div>
          ) : (
            <div className="p-6 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-dashed border-slate-300 dark:border-slate-800 text-center text-xs text-slate-500 dark:text-slate-400">
              Haga clic en un código de prueba o ingrese el suyo para ver el estado en tiempo real.
            </div>
          )}
        </div>
      </div>

      {/* Bandeja Confidencial de Gestión — EXCLUSIVA AUDITOR OCI / OFICINA DE INTEGRIDAD */}
      {esAuditorOCI ? (
        <div
          data-tour="den-bandeja"
          className="p-6 rounded-2xl bg-white dark:bg-slate-900/95 border border-emerald-200 dark:border-emerald-500/35 shadow-sm dark:shadow-none space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                Bandeja Confidencial de Atención y Derivación (Exclusiva OCI / Integridad)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Evalúe admisibilidad, otorgue medidas de protección (Tarea 7.2) y derive a OCI, Secretaría Técnica PAD o Procuraduría Pública (Tarea 7.1).
              </p>
            </div>
            <button
              onClick={cargarDatos}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </button>
          </div>

          {loading ? (
            <div className="py-8 text-center text-xs text-slate-500 font-mono">
              Cargando bandeja confidencial...
            </div>
          ) : (
            <div className="space-y-3">
              {denunciasOci.map((den) => (
                <div
                  key={den.id}
                  className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3 text-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-lg bg-blue-50 dark:bg-cyan-500/15 text-blue-800 dark:text-cyan-300 border border-blue-200 dark:border-cyan-500/30 font-mono font-extrabold">
                        {den.codigo_seguimiento}
                      </span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {den.categoria}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-[11px]">
                        {den.area_involucrada}
                      </span>
                      {den.expediente_codigo && (
                        <span className="px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30 font-mono text-[11px] font-semibold">
                          Ref: {den.expediente_codigo}
                        </span>
                      )}
                    </div>
                    {renderEstadoBadge(den.estado)}
                  </div>

                  <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                    {den.descripcion_hechos}
                  </p>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-600 dark:text-slate-400">
                    <span className="inline-flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5 text-blue-700 dark:text-cyan-400" />
                      <strong>Órgano:</strong> {den.organo_derivado}
                    </span>
                    <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300 font-medium">
                      <Lock className="w-3.5 h-3.5" />
                      {den.medida_proteccion}
                    </span>
                    <span className="inline-flex items-center gap-1 font-mono text-amber-800 dark:text-amber-300">
                      <CalendarClock className="w-3.5 h-3.5" />
                      SLA: {den.fecha_limite_sla}
                    </span>
                  </div>

                  {den.nota_interna_oci && (
                    <div className="p-2.5 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/25 border border-emerald-200 dark:border-emerald-500/30 text-[11px] text-slate-700 dark:text-slate-300">
                      <strong className="text-emerald-800 dark:text-emerald-300">
                        Nota motivada OCI ({den.gestionado_por}):
                      </strong>{' '}
                      {den.nota_interna_oci}
                    </div>
                  )}

                  <div className="flex justify-end pt-1">
                    <button
                      onClick={() => abrirModalGestion(den)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white dark:text-slate-950 font-bold text-xs shadow-sm transition"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      Gestionar / Otorgar Protección y Derivar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div
          data-tour="den-confidencialidad"
          className="p-5 rounded-2xl bg-slate-100/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 flex items-start gap-3 text-xs text-slate-600 dark:text-slate-400"
        >
          <Lock className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <strong className="text-slate-800 dark:text-slate-200 block mb-0.5">
              Confidencialidad Protegida (Numeral 7.2.7.3 — Directiva N° 001-2026-PCM/SIP)
            </strong>
            Por reserva legal, la bandeja detallada de denuncias recibidas es accesible únicamente para la Oficina de Integridad / Auditor OCI. Desde su perfil actual puede enviar nuevos reportes con reserva de identidad, consultar su código personal o ver las estadísticas generales agregadas.
          </div>
        </div>
      )}

      {/* Modal Gestión Confidencial OCI */}
      <Modal
        isOpen={Boolean(denunciaEdit)}
        onClose={() => setDenunciaEdit(null)}
        title={`Gestión Confidencial — ${denunciaEdit?.codigo_seguimiento}`}
        subtitle="Tareas 7.1 y 7.2 (Directiva N° 001-2026-PCM/SIP) • Registro inmutable SHA-256"
      >
        {denunciaEdit && (
          <form onSubmit={handleGuardarGestion} className="space-y-4 text-xs">
            {errorGestion && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-500/40 text-rose-800 dark:text-rose-200">
                {errorGestion}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block font-bold text-slate-700 dark:text-slate-200">
                  Estado de Atención:
                </label>
                <select
                  value={nuevoEstado}
                  onChange={(e) => setNuevoEstado(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                >
                  <option value="EN_EVALUACION">En Evaluación de Admisibilidad</option>
                  <option value="DERIVADA">Derivada a Órgano Competente</option>
                  <option value="ATENDIDA">Atendida con Medidas</option>
                  <option value="ARCHIVADA_MOTIVADA">Archivada con Sustento Motivado</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-slate-700 dark:text-slate-200">
                  Plazo SLA de Seguimiento:
                </label>
                <input
                  type="date"
                  value={fechaLimiteSla}
                  onChange={(e) => setFechaLimiteSla(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block font-bold text-slate-700 dark:text-slate-200">
                Órgano Competente Derivado (Tarea 7.1):
              </label>
              <select
                value={organoDerivado}
                onChange={(e) => setOrganoDerivado(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100"
              >
                {ORGANOS_COMPETENTES.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="block font-bold text-slate-700 dark:text-slate-200">
                Medida de Protección al Denunciante (Tarea 7.2 — D.L. N° 1327):
              </label>
              <select
                value={medidaProteccion}
                onChange={(e) => setMedidaProteccion(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100"
              >
                {MEDIDAS_PROTECCION.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="block font-bold text-slate-700 dark:text-slate-200">
                Mensaje de Seguimiento para el Denunciante (visible con su código):
              </label>
              <textarea
                rows={2}
                required
                value={respuestaSeguimiento}
                onChange={(e) => setRespuestaSeguimiento(e.target.value)}
                className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="space-y-1">
              <label className="block font-bold text-slate-700 dark:text-slate-200">
                Sustento Interno Obligatorio OCI (confidencial):
              </label>
              <textarea
                rows={3}
                required
                minLength={10}
                value={notaInternaOci}
                onChange={(e) => setNotaInternaOci(e.target.value)}
                className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setDenunciaEdit(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={guardandoGestion}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white dark:text-slate-950 font-extrabold shadow-sm"
              >
                <CheckCircle2 className="w-4 h-4" />
                {guardandoGestion ? 'Guardando...' : 'Guardar y Registrar en Bitácora'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
