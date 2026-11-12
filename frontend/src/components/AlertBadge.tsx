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
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/40">
        <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
        Riesgo Alto {puntaje !== undefined ? `(${puntaje})` : ''}
      </span>
    );
  }
  if (nivel === 'MEDIO') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/40">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
        Riesgo Medio {puntaje !== undefined ? `(${puntaje})` : ''}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/40">
      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
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
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-medium bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
        <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
        SHA-256 ÍNTEGRO
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-rose-600/25 text-rose-200 border border-rose-500 animate-pulse">
      <ShieldX className="w-3.5 h-3.5 text-rose-400" />
      CADENA ROTA (EX-POST)
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
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/40">
          <ShieldAlert className="w-3.5 h-3.5" />
          Validada para Auditoría OCI
        </span>
      );
    case 'EN_DESCARGO':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-500/20 text-sky-300 border border-sky-500/40">
          <FileCheck2 className="w-3.5 h-3.5" />
          Con Descargo Técnico (DEC)
        </span>
      );
    case 'ARCHIVADA_SUSTENTADA':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Sustentada y Archivada
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40">
          <Clock className="w-3.5 h-3.5" />
          Pendiente de Revisión Humana
        </span>
      );
  }
};
