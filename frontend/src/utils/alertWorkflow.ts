import { EstadoRevisionAlerta } from '../types';

export const AREAS_DERIVACION = [
  'OCI — Órgano de Control Institucional',
  'OCI — Control Simultáneo (Hito de Control)',
  'OCI — Archivo de Control Preventivo',
  'OCI — Unidad de Análisis de Redes y Compliance',
  'Oficina de Integridad / OCI — Abstención y Reasignación',
  'DEC — Dependencia Encargada de Contrataciones',
  'Área Usuaria / DEC — Subsanación Documental',
  'Tesorería / Control Previo + OCI',
  'Oficina de Asesoría Jurídica',
];

export interface AlertRevisionDefaults {
  areaAsignada: string;
  accionCorrectiva: string;
  comentario: string;
}

export function isAlertaCerradaPorOci(estado: string): boolean {
  return estado === 'ARCHIVADA_SUSTENTADA' || estado === 'VALIDADA_OCI';
}

export function getDefaultSlaDate(days: number = 5): string {
  return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
}

export function getInitialTargetEstado(
  estadoActual: EstadoRevisionAlerta,
  esAuditorOCI: boolean,
): EstadoRevisionAlerta {
  if (!esAuditorOCI) {
    return 'EN_DESCARGO';
  }
  if (estadoActual === 'PENDIENTE') {
    return 'EN_DESCARGO';
  }
  if (estadoActual === 'EN_DESCARGO') {
    return 'VALIDADA_OCI';
  }
  return estadoActual;
}

export function getAlertRevisionDefaults(
  estado: EstadoRevisionAlerta,
  esAuditorOCI: boolean,
): AlertRevisionDefaults {
  if (!esAuditorOCI) {
    return {
      areaAsignada: 'DEC — Dependencia Encargada de Contrataciones',
      accionCorrectiva:
        'Adecuar especificaciones o sustentar técnicamente el requerimiento adjuntando evidencia verificable en el expediente.',
      comentario:
        'Se remite informe técnico sustentatorio de la Dependencia Encargada de las Contrataciones (DEC) detallando la justificación objetiva y las medidas de subsanación adoptadas.',
    };
  }

  switch (estado) {
    case 'EN_DESCARGO':
      return {
        areaAsignada: 'DEC — Dependencia Encargada de Contrataciones',
        accionCorrectiva:
          'Presentar informe técnico-normativo sustentatorio y documentación respaldatoria dentro del plazo SLA.',
        comentario:
          'Se evalúa preliminarmente la señal preventiva XAI y se deriva al área responsable solicitando descargo técnico documentado conforme a la Ley N° 32069.',
      };
    case 'VALIDADA_OCI':
      return {
        areaAsignada: 'DEC — Dependencia Encargada de Contrataciones',
        accionCorrectiva:
          'Emitir Informe de Hito de Control Simultáneo y exigir plan de acción correctiva vinculante en 5 días hábiles.',
        comentario:
          'Evaluados los actuados y descargos, el Auditor OCI confirma la observación preventiva XAI y dispone emitir Informe de Hito de Control conforme a la Ley N° 32069 y Ley N° 27785.',
      };
    case 'ARCHIVADA_SUSTENTADA':
      return {
        areaAsignada: 'OCI — Archivo de Control Preventivo',
        accionCorrectiva:
          'Archivo definitivo de la señal preventiva por contar con sustento técnico-legal suficiente; continúa trámite regular sin observación.',
        comentario:
          'Evaluado el descargo técnico y la evidencia documental remitida por el área responsable, el Auditor OCI da por sustentada la señal preventiva y dispone su archivo motivado.',
      };
    case 'PENDIENTE':
    default:
      return {
        areaAsignada: 'OCI — Órgano de Control Institucional',
        accionCorrectiva:
          'Pendiente de revisión y calificación inicial por el Auditor OCI.',
        comentario:
          'Se retorna la señal preventiva a estado pendiente para reevaluación integral del expediente.',
      };
  }
}

export function getModalAccionCorrectivaLabel(
  estado: EstadoRevisionAlerta,
  esAuditorOCI: boolean,
): string {
  if (!esAuditorOCI) {
    return 'Acción Correctiva / Medida de Subsanación Propuesta:';
  }
  switch (estado) {
    case 'ARCHIVADA_SUSTENTADA':
      return 'Disposición de Cierre / Archivo Motivado:';
    case 'EN_DESCARGO':
      return 'Requerimiento / Medida Solicitada al Área:';
    case 'VALIDADA_OCI':
      return 'Medida de Control / Plan de Subsanación Exigido:';
    case 'PENDIENTE':
    default:
      return 'Medida de Control / Calificación Inicial:';
  }
}

export function getCardAccionCorrectivaHeading(
  estado: string,
  rolUltimoCambio?: string | null,
): string {
  if (estado === 'ARCHIVADA_SUSTENTADA') {
    return 'Disposición de Cierre / Archivo Motivado (OCI)';
  }
  if (estado === 'VALIDADA_OCI') {
    return 'Medida de Control / Plan de Acción Exigido (OCI)';
  }
  if (estado === 'EN_DESCARGO' && (rolUltimoCambio || '').includes('OCI')) {
    return 'Requerimiento de Descargo Solicitado por OCI';
  }
  return 'Acción Correctiva / Plan de Subsanación Registrado';
}

export function getHistorialAccionPrefix(
  estadoNuevo: string,
  rolUsuario: string,
): string {
  if (estadoNuevo === 'ARCHIVADA_SUSTENTADA') {
    return 'Disposición de cierre:';
  }
  if (estadoNuevo === 'EN_DESCARGO' && rolUsuario.includes('OCI')) {
    return 'Requerimiento OCI:';
  }
  return 'Acción correctiva:';
}
