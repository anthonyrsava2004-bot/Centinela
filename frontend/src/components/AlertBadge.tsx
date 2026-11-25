import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Clock,
  FileCheck2,
} from 'lucide-react';
import { NivelRiesgo } from '../types';

interface RiskBadgeProps {
  nivel: NivelRiesgo;
  puntaje?: number;
  compact?: boolean;
}

export const RiskBadge: React.FC<RiskBadgeProps> = ({ nivel, puntaje, compact = false }) => {
  const sizeClass = compact ? 'gap-1 px-2 py-0.5 text-[11px]' : 'gap-1.5 px-2.5 py-1 text-xs';
  const iconClass = compact ? 'w-3 h-3 shrink-0' : 'w-3.5 h-3.5 shrink-0';

  if (nivel === 'ALTO') {
    const label = compact ? 'Alto' : 'Riesgo Alto';
    return (
      <span
        className={`inline-flex items-center whitespace-nowrap rounded-full font-semibold bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/40 ${sizeClass}`}
        title={`Riesgo Alto${puntaje !== undefined ? ` (puntaje XAI: ${puntaje})` : ''}`}
      >
        <ShieldAlert className={`${iconClass} text-rose-600 dark:text-rose-400`} />
        {label} {puntaje !== undefined ? `(${puntaje})` : ''}
      </span>
    );
  }
  if (nivel === 'MEDIO') {
    const label = compact ? 'Medio' : 'Riesgo Medio';
    return (
      <span
        className={`inline-flex items-center whitespace-nowrap rounded-full font-semibold bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/40 ${sizeClass}`}
        title={`Riesgo Medio${puntaje !== undefined ? ` (puntaje XAI: ${puntaje})` : ''}`}
      >
        <AlertTriangle className={`${iconClass} text-amber-600 dark:text-amber-400`} />
        {label} {puntaje !== undefined ? `(${puntaje})` : ''}
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/40 ${sizeClass}`}
      title={`Limpio${puntaje !== undefined ? ` (puntaje XAI: ${puntaje})` : ''}`}
    >
      <CheckCircle2 className={`${iconClass} text-emerald-600 dark:text-emerald-400`} />
      Limpio {puntaje !== undefined ? `(${puntaje})` : ''}
    </span>
  );
};

interface IntegrityBadgeProps {
  integra: boolean;
  compact?: boolean;
}

export const IntegrityBadge: React.FC<IntegrityBadgeProps> = ({ integra, compact = false }) => {
  const sizeClass = compact ? 'gap-1 px-2 py-0.5 text-[11px]' : 'gap-1.5 px-2.5 py-1 text-xs';
  const iconClass = compact ? 'w-3 h-3 shrink-0' : 'w-3.5 h-3.5 shrink-0';

  if (integra) {
    return (
      <span
        className={`inline-flex items-center whitespace-nowrap rounded-md font-medium bg-blue-50 text-blue-800 border border-blue-200 dark:bg-cyan-500/10 dark:text-cyan-300 dark:border-cyan-500/30 ${sizeClass}`}
        title="Sello criptográfico SHA-256 intacto (ningún documento fue modificado)"
      >
        <ShieldCheck className={`${iconClass} text-blue-600 dark:text-cyan-400`} />
        {compact ? 'Íntegro' : 'Sin alteraciones'}
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-md font-bold bg-rose-600 text-white dark:bg-rose-600/25 dark:text-rose-200 border border-rose-700 dark:border-rose-500 animate-pulse ${sizeClass}`}
      title="Ruptura de cadena SHA-256: se detectó un cambio posterior en el expediente"
    >
      <ShieldX className={`${iconClass} text-white dark:text-rose-400`} />
      {compact ? 'Alterado' : 'Alteración detectada'}
    </span>
  );
};

interface RevisionStatusBadgeProps {
  estado: string;
}

export const RevisionStatusBadge: React.FC<RevisionStatusBadgeProps> = ({ estado }) => {
  switch (estado) {
    case 'VALIDADA_OCI':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/40">
          <ShieldAlert className="w-3.5 h-3.5" />
          Confirmada por Control (OCI)
        </span>
      );
    case 'EN_DESCARGO':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-50 text-sky-800 border border-sky-200 dark:bg-sky-500/20 dark:text-sky-300 dark:border-sky-500/40">
          <FileCheck2 className="w-3.5 h-3.5" />
          Con Respuesta de Compras (DEC)
        </span>
      );
    case 'ARCHIVADA_SUSTENTADA':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/40">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Sustentada y Archivada
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/40">
          <Clock className="w-3.5 h-3.5" />
          Pendiente de Revisión
        </span>
      );
  }
};
