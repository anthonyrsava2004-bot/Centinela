const TIPOLOGIA_LABELS: Record<string, string> = {
  CASO_1_PROYECTORES_UNT: 'Caso 1 UNT • Fracc. + Conflicto',
  FRACCIONAMIENTO_8UIT: 'Fraccionamiento (<= 8 UIT)',
  COLUSION_PROVEEDORES: 'Red de Colusión',
  DIRECCIONAMIENTO_TDR: 'Direccionamiento TDR',
  CONFLICTO_SEGREGACION: 'Segregación de Funciones',
  PAGO_SIN_CONFORMIDAD: 'Pago sin Conformidad',
  INCONSISTENCIA_VERSION_SUSTENTO: 'Versión / Sin Sustento',
  ENTREGABLE_INCOMPLETO_CONFORMIDAD: 'Caso 2 UNT • Sin Pozo a Tierra',
  CONTINUIDAD_ECONOMICA_RNP: 'Empresa Reciclada / Historial RNP',
  SOBREPRECIO_MERCADO: 'Sobreprecio frente a Estándar',
};

export function formatTipologia(tipo?: string | null): string {
  if (!tipo) return 'Sin alerta';
  return TIPOLOGIA_LABELS[tipo] || tipo;
}
