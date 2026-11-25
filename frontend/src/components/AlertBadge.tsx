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
}

export const RiskBadge: React.FC<RiskBadgeProps> = ({ nivel, puntaje }) => {
  if (nivel === 'ALTO') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/40">
        <ShieldAlert className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
        Riesgo Alto {puntaje !== undefined ? `(${puntaje})` : ''}
      </span>
    );
  }
  if (nivel === 'MEDIO') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/40">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
        Riesgo Medio {puntaje !== undefined ? `(${puntaje})` : ''}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/40">
      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
      Limpio {puntaje !== undefined ? `(${puntaje})` : ''}
    </span>
  );
};

interface IntegrityBadgeProps {
  integra: boolean;
}

export const IntegrityBadge: React.FC<IntegrityBadgeProps> = ({ integra }) => {
  if (integra) {
    return (
      <span
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-800 border border-blue-200 dark:bg-cyan-500/10 dark:text-cyan-300 dark:border-cyan-500/30"
        title="Sello criptográfico SHA-256 intacto (ningún documento fue modificado)"
      >
        <ShieldCheck className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400" />
        Sin alteraciones
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-rose-600 text-white dark:bg-rose-600/25 dark:text-rose-200 border border-rose-700 dark:border-rose-500 animate-pulse"
      title="Ruptura de cadena SHA-256: se detectó un cambio posterior en el expediente"
    >
      <ShieldX className="w-3.5 h-3.5 text-white dark:text-rose-400" />
      Alteración detectada
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
