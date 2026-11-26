import React, { useEffect, useLayoutEffect, useState, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  X,
  ArrowRight,
  ArrowLeft,
  Compass,
  CheckCircle2,
  ExternalLink,
  Layers,
  Map,
} from 'lucide-react';

export type TourMode = 'page' | 'menu';

export interface TourStep {
  id: string;
  target: string;
  title: string;
  description: string;
  tip: string;
  placement: 'right' | 'bottom' | 'auto';
  route?: string;
}

export const ROUTE_LABELS: Record<string, string> = {
  '/': 'Resumen General',
  '/compliance': 'Alertas y Conflictos',
  '/expedientes': 'Lista de Compras',
  '/trazabilidad': 'Detalle y Seguridad',
  '/grafo-colusion': 'Empresas Vinculadas',
  '/denuncias': 'Canal de Denuncia',
  '/auditoria': 'Registro de Actividad',
  '/validacion': 'Validación',
};

export const PAGE_TOUR_STEPS: Record<string, TourStep[]> = {
  '/': [
    {
      id: 'dash-header',
      target: 'dash-header',
      title: 'Panel de Control y Acciones Rápidas',
      description:
        'Resume su perfil activo, el porcentaje de compras sin alertas y los accesos directos para revisar alertas, registrar compras o descargar reportes oficiales en PDF y CSV.',
      tip: 'El medidor circular muestra en tiempo real la proporción de expedientes sin observaciones y la integridad SHA-256.',
      placement: 'auto',
    },
    {
      id: 'dash-kpis',
      target: 'dash-kpis',
      title: 'Indicadores Principales de Integridad',
      description:
        'Presenta las 4 métricas ejecutivas: total de compras revisadas, monto auditado, ahorro preventivo estimado y estado criptográfico de los documentos.',
      tip: 'El ahorro preventivo estima el sobrecosto evitado al intervenir antes del desembolso.',
      placement: 'auto',
    },
    {
      id: 'dash-mapa-riesgos',
      target: 'dash-mapa-riesgos',
      title: 'Mapa de Riesgos de Integridad (Matriz 5×5)',
      description:
        'Ubica cada etapa crítica del proceso de compra según su probabilidad e impacto, alineado a la metodología del Modelo de Integridad Pública.',
      tip: 'Revise las celdas de mayor nivel para priorizar dónde concentrar el control preventivo.',
      placement: 'auto',
    },
    {
      id: 'dash-tabla-prioritaria',
      target: 'dash-tabla-prioritaria',
      title: 'Compras con Alertas Prioritarias',
      description:
        'Lista los expedientes con mayor riesgo detectado para acceder directamente a su cadena documental, verificación de entregables y reporte PDF.',
      tip: 'Haga clic en "Auditar" o "Ver Historial" en cualquier fila para abrir el detalle completo del proceso.',
      placement: 'auto',
    },
  ],
  '/compliance': [
    {
      id: 'comp-tabs',
      target: 'comp-tabs',
      title: 'Alertas Explicables y Conflictos de Interés',
      description:
        'Alterne entre las alertas automáticas explicables (XAI) y la bandeja de conflictos de interés donde se gestionan declaraciones, abstenciones y reasignaciones.',
      tip: 'En la segunda pestaña puede ver el Caso 1 UNT y formalizar la abstención de un funcionario vinculado.',
      placement: 'auto',
    },
    {
      id: 'comp-filters',
      target: 'comp-filters',
      title: 'Filtros por Estado y Categoría',
      description:
        'Filtre las alertas según su estado de revisión (pendientes, en descargo, validadas o archivadas) o por tipo de riesgo detectado.',
      tip: 'Combine ambos filtros para enfocarse únicamente en las alertas pendientes de su competencia.',
      placement: 'auto',
    },
    {
      id: 'comp-declarar',
      target: 'comp-declarar',
      title: 'Declarar un Conflicto de Interés',
      description:
        'Permite registrar de manera preventiva un vínculo entre un funcionario y un postor, con opción de formalizar su abstención y reasignación inmediata.',
      tip: 'Toda declaración y reasignación queda grabada en la bitácora global con sello SHA-256.',
      placement: 'auto',
    },
    {
      id: 'comp-lista',
      target: 'comp-lista',
      title: 'Ficha de Alerta Explicable (Sin Caja Negra)',
      description:
        'Cada tarjeta detalla tres elementos obligatorios: la regla activada, la evidencia exacta encontrada y la base normativa aplicable, sin lenguaje acusatorio.',
      tip: 'Use el botón inferior derecho para registrar un descargo técnico (DEC) o emitir dictamen y derivación (OCI).',
      placement: 'auto',
    },
    {
      id: 'comp-conflictos-lista',
      target: 'comp-conflictos-lista',
      title: 'Gestión Preventiva de Conflictos',
      description:
        'Muestra al funcionario interviniente, el proveedor vinculado y el tipo de relación usando códigos seudonimizados conforme a la Ley N° 29733.',
      tip: 'Use "Registrar Abstención y Reasignar" para transferir el expediente a un funcionario alterno sin vínculo.',
      placement: 'auto',
    },
  ],
  '/expedientes': [
    {
      id: 'exp-acciones',
      target: 'exp-acciones',
      title: 'Filtro de Casos con Alerta y Registro en Vivo',
      description:
        'Active el filtro rápido para ver solo expedientes con alertas o abra "Registrar Nueva Compra" para evaluar un proceso en tiempo real.',
      tip: 'El formulario incluye plantillas de 1 clic para simular el Caso 1 (Proyectores) y el Caso 2 (8 Aulas).',
      placement: 'auto',
    },
    {
      id: 'exp-filtros',
      target: 'exp-filtros',
      title: 'Búsqueda y Filtros Avanzados',
      description:
        'Encuentre cualquier compra por código, área usuaria, proveedor o descripción, y filtre por nivel de riesgo o integridad de la cadena SHA-256.',
      tip: 'Pruebe buscar "EXP-2025-UNT-0001" o filtrar por "Riesgo Alto" para localizar los casos críticos.',
      placement: 'auto',
    },
    {
      id: 'exp-tabla',
      target: 'exp-tabla',
      title: 'Listado Completo de Expedientes',
      description:
        'Presenta las compras con su monto, modalidad, estado criptográfico y nivel de riesgo, manteniendo códigos seudonimizados.',
      tip: 'Desde la columna de acciones puede auditar el expediente completo o descargar su reporte forense en PDF.',
      placement: 'auto',
    },
  ],
  '/trazabilidad': [
    {
      id: 'traz-acciones',
      target: 'traz-acciones',
      title: 'Prueba de Alteración Oculta y Reporte PDF',
      description:
        'El Auditor OCI puede simular una modificación clandestina en base de datos para comprobar cómo SHA-256 la detecta al instante, o descargar el reporte oficial en PDF.',
      tip: 'Después de pulsar "Probar Cambio Oculto", use "Restaurar Documento" para devolver el expediente a su estado original.',
      placement: 'auto',
    },
    {
      id: 'traz-selector',
      target: 'traz-selector',
      title: 'Selector Rápido de Expediente',
      description:
        'Cambie entre los distintos expedientes del sistema sin salir de esta vista para comparar procesos limpios y procesos observados.',
      tip: 'Seleccione EXP-2025-UNT-0010 para inspeccionar el bloqueo preventivo de pago por entregables incompletos.',
      placement: 'auto',
    },
    {
      id: 'traz-banner-sha256',
      target: 'traz-banner-sha256',
      title: 'Estado de Verificación Criptográfica SHA-256',
      description:
        'Confirma si los 6 documentos del expediente coinciden exactamente con sus huellas digitales originales o señala la etapa exacta donde se detectó un cambio.',
      tip: 'Un banner verde indica integridad completa; si cambia a rojo, indica el punto exacto de ruptura.',
      placement: 'auto',
    },
    {
      id: 'traz-etapas',
      target: 'traz-etapas',
      title: 'Cadena Documental de 6 Etapas',
      description:
        'Reúne Requerimiento, TDR, Cotizaciones, Buena Pro, Conformidad y Pago en una secuencia encadenada donde cada etapa depende del hash de la anterior.',
      tip: 'Revise las etiquetas de versión y sustento documental para detectar modificaciones extemporáneas.',
      placement: 'auto',
    },
    {
      id: 'traz-candado-entregables',
      target: 'traz-candado-entregables',
      title: 'Candado Preventivo de Entregables (TDR)',
      description:
        'Exige verificar evidencia técnica y fotográfica de cada entregable obligatorio antes de habilitar la conformidad y el desembolso en Tesorería.',
      tip: 'Pulse "Verificar y Adjuntar Sustento Técnico" en un entregable pendiente para observar cómo se desbloquea el pago.',
      placement: 'auto',
    },
  ],
  '/grafo-colusion': [
    {
      id: 'grafo-kpis',
      target: 'grafo-kpis',
      title: 'Resumen de Vínculos Detectados',
      description:
        'Cuantifica los grupos de proveedores vinculados, la cantidad de empresas involucradas, las compras afectadas y el total de nodos y conexiones del grafo.',
      tip: 'Use el botón superior derecho para alternar entre los grupos con datos compartidos y la red completa.',
      placement: 'auto',
    },
    {
      id: 'grafo-canvas',
      target: 'grafo-canvas',
      title: 'Mapa Interactivo de Relaciones',
      description:
        'Representa proveedores (círculos rojos), datos compartidos como representante, dirección o teléfono (rombos amarillos) y expedientes (rectángulos azules).',
      tip: 'Haga clic en cualquier nodo para inspeccionarlo, arrastre para mover el grafo o use "Reajustar Red" para centrarlo.',
      placement: 'auto',
    },
    {
      id: 'grafo-inspector',
      target: 'grafo-inspector',
      title: 'Inspector Detallado de Nodo',
      description:
        'Muestra la centralidad calculada, los hashes de atributos compartidos, la evidencia topológica y las conexiones directas del nodo seleccionado.',
      tip: 'Al seleccionar un nodo de expediente aparece un acceso directo para auditar su cadena SHA-256.',
      placement: 'auto',
    },
  ],
  '/denuncias': [
    {
      id: 'den-resumen',
      target: 'den-resumen',
      title: 'Indicadores Públicos Agregados',
      description:
        'Resume el total de reportes recibidos, en trámite, derivados y con medida de protección sin exponer jamás datos que identifiquen a los denunciantes.',
      tip: 'Estos indicadores cumplen con la rendición pública de cuentas preservando la confidencialidad.',
      placement: 'auto',
    },
    {
      id: 'den-registrar',
      target: 'den-registrar',
      title: 'Enviar Reporte con Reserva de Identidad',
      description:
        'Permite reportar irregularidades sin solicitar DNI ni nombres reales y marcar la solicitud de protección frente a represalias bajo el D.L. N° 1327.',
      tip: 'Al enviar el formulario se genera un código reservado único (DEN-2026-XXXX) con sello SHA-256.',
      placement: 'auto',
    },
    {
      id: 'den-consultar',
      target: 'den-consultar',
      title: 'Seguimiento por Código Reservado',
      description:
        'Ingrese un código de seguimiento para verificar el estado de atención, el plazo SLA, el órgano a cargo y las medidas de protección otorgadas.',
      tip: 'Haga clic en los códigos de prueba (por ejemplo DEN-2026-0001) para consultar un caso al instante.',
      placement: 'auto',
    },
    {
      id: 'den-bandeja',
      target: 'den-bandeja',
      title: 'Bandeja Confidencial de Atención (OCI)',
      description:
        'Exclusiva del Auditor OCI / Oficina de Integridad para evaluar admisibilidad, otorgar medidas de protección y derivar a OCI, PAD o Procuraduría.',
      tip: 'Pulse "Gestionar / Otorgar Protección y Derivar" para actualizar el caso y reflejar la respuesta al denunciante.',
      placement: 'auto',
    },
    {
      id: 'den-confidencialidad',
      target: 'den-confidencialidad',
      title: 'Reserva Legal Garantizada',
      description:
        'Por normativa de integridad, el detalle interno de denuncias recibidas solo es visible para la Oficina de Integridad / OCI, protegiendo al denunciante.',
      tip: 'Desde este perfil puede enviar nuevos reportes anónimos y dar seguimiento con su código reservado.',
      placement: 'auto',
    },
  ],
  '/auditoria': [
    {
      id: 'aud-header',
      target: 'aud-header',
      title: 'Bitácora Inmutable y Simulación de Bloqueo RBAC',
      description:
        'Controla el registro global append-only sellado con SHA-256. Permite simular un intento sin permisos (HTTP 403) y exportar la bitácora completa en CSV.',
      tip: 'Pulse "Simular Intento No Autorizado (403)" para comprobar cómo el sistema bloquea y registra la acción al instante.',
      placement: 'auto',
    },
    {
      id: 'aud-filtros',
      target: 'aud-filtros',
      title: 'Búsqueda y Filtros de Auditoría',
      description:
        'Filtre eventos por código de usuario, expediente, resultado (permitido o bloqueado 403) y tipo de acción registrada en el sistema.',
      tip: 'Seleccione "Bloqueados por RBAC (403)" para aislar los intentos denegados por separación de funciones.',
      placement: 'auto',
    },
    {
      id: 'aud-tabla',
      target: 'aud-tabla',
      title: 'Registro Cronológico Sellado con SHA-256',
      description:
        'Muestra fecha y hora UTC, usuario seudonimizado, acción, recurso, resultado y sello criptográfico de cada evento, con los más recientes primero.',
      tip: 'Cada evento se encadena al anterior para evidenciar inmediatamente cualquier intento de borrado o alteración.',
      placement: 'auto',
    },
  ],
  '/validacion': [
    {
      id: 'val-resumen',
      target: 'val-resumen',
      title: 'Evidencia Técnica Reproducible',
      description:
        'Presenta el resumen de la suite automatizada sobre datos 100 % sintéticos y el comando exacto para reproducir todas las pruebas localmente en una base aislada.',
      tip: 'Use "Copiar comando" para ejecutar la verificación independiente desde terminal sin afectar los datos de demostración.',
      placement: 'auto',
    },
    {
      id: 'val-matriz',
      target: 'val-matriz',
      title: 'Matriz de Confusión por Regla (R-01 a R-08)',
      description:
        'Detalla aciertos (VP), falsos positivos (FP), falsos negativos (FN), verdaderos negativos (VN), precisión, recall y puntaje F1 de cada regla normativa.',
      tip: 'Verifique que las 110 compras limpias registran cero alertas indebidas (tasa FP de 0.0 %).',
      placement: 'auto',
    },
    {
      id: 'val-casos',
      target: 'val-casos',
      title: 'Casos Etiquetados y Frontera de 8 UIT',
      description:
        'Compara las reglas esperadas frente a las detectadas en escenarios limpios, el límite exacto de S/ 42,800 vs. S/ 42,801 e irregularidades combinadas.',
      tip: 'Use las píldoras superiores para filtrar controles limpios o casos con irregularidades.',
      placement: 'auto',
    },
    {
      id: 'val-seguridad',
      target: 'val-seguridad',
      title: 'Latencias, Suite Unittest y Controles RBAC',
      description:
        'Reúne los percentiles p50 y p95 de respuesta en milisegundos, el listado completo de pruebas automatizadas y las 21 comprobaciones de bloqueo HTTP 403.',
      tip: 'Esta vista es de solo lectura y se encuentra disponible para OCI, DEC y Consulta Pública.',
      placement: 'auto',
    },
  ],
};

export const MENU_TOUR_STEPS: TourStep[] = [
  {
    id: 'resumen',
    target: 'nav-resumen',
    title: 'Resumen General y Mapa 5×5',
    description:
      'Aquí ve el estado general de las 120 compras revisadas, el ahorro preventivo estimado y el Mapa de Riesgos de Integridad por etapa.',
    tip: 'Ideal para entender en 5 segundos cuántas compras están limpias y cuáles requieren atención.',
    placement: 'right',
    route: '/',
  },
  {
    id: 'alertas',
    target: 'nav-alertas',
    title: 'Alertas Explicables y Conflictos',
    description:
      'Muestra cada alerta con su regla, evidencia exacta y ley (sin lenguaje punitivo). En la segunda pestaña puede apartar y reasignar funcionarios con conflicto de interés.',
    tip: 'Pruebe la pestaña "Conflictos de Interés" para ver el Caso 1 UNT (15 Proyectores).',
    placement: 'right',
    route: '/compliance',
  },
  {
    id: 'compras',
    target: 'nav-compras',
    title: 'Lista de Compras y Registro en Vivo',
    description:
      'Busque cualquier expediente por código (ej. EXP-2025-UNT-0001) o use "Registrar Nueva Compra" para probar cómo el sistema evalúa un proceso al instante.',
    tip: 'Incluye plantillas rápidas de 1 clic para simular el Caso 1 y el Caso 2 UNT en vivo.',
    placement: 'right',
    route: '/expedientes',
  },
  {
    id: 'detalle',
    target: 'nav-detalle',
    title: 'Detalle, Candado de Pago y SHA-256',
    description:
      'Unifica las 6 etapas de una compra, bloquea el pago si faltan entregables obligatorios (ej. pruebas de pozo a tierra) y detecta alteraciones ocultas con SHA-256.',
    tip: 'En el expediente EXP-2025-UNT-0010 puede probar el bloqueo preventivo en Tesorería.',
    placement: 'right',
    route: '/trazabilidad?id=10',
  },
  {
    id: 'empresas',
    target: 'nav-empresas',
    title: 'Empresas con Datos Compartidos',
    description:
      'Mapa visual interactivo que descubre proveedores que compiten en un mismo proceso pero comparten representante legal, dirección o teléfono.',
    tip: 'Haga clic en cualquier círculo rojo o rombo amarillo para inspeccionar el vínculo.',
    placement: 'right',
    route: '/grafo-colusion',
  },
  {
    id: 'denuncias',
    target: 'nav-denuncias',
    title: 'Canal de Denuncia Anónimo',
    description:
      'Permite reportar hechos irregulares sin dar DNI ni nombre, genera un código cifrado de seguimiento (DEN-2026-XXXX) y gestiona medidas de protección (D.L. 1327).',
    tip: 'Disponible incluso para ciudadanos en el perfil Consulta Transparencia.',
    placement: 'right',
    route: '/denuncias',
  },
  {
    id: 'auditoria',
    target: 'nav-auditoria',
    title: 'Registro de Actividad Inmutable (OCI)',
    description:
      'Bitácora global sellada con SHA-256 que registra quién hizo cada acción, con qué rol, cuándo y si un intento sin permiso fue bloqueado (403).',
    tip: 'Exclusiva para el Auditor OCI; aquí puede simular un bloqueo por permisos.',
    placement: 'right',
    route: '/auditoria',
  },
  {
    id: 'validacion',
    target: 'nav-validacion',
    title: 'Validación Técnica y Efectividad',
    description:
      'Expone los resultados de las pruebas automatizadas, la matriz de confusión por regla, los casos de frontera de 8 UIT, latencias y controles RBAC.',
    tip: 'Accesible en modo lectura desde los tres perfiles para transparencia metodológica.',
    placement: 'right',
    route: '/validacion',
  },
  {
    id: 'sesion',
    target: 'session-switcher',
    title: 'Cambie de Perfil en 1 Clic (RBAC)',
    description:
      'Use los botones OCI, DEC y Público para alternar de perfil al instante y verificar la separación de funciones, o abra el icono de detalle para consultar los permisos completos de cada rol.',
    tip: 'También puede pulsar Ctrl+K en cualquier pantalla para abrir el buscador rápido de expedientes y atajos.',
    placement: 'bottom',
  },
];

export function getPageTourTargets(pathname: string): string[] {
  return (PAGE_TOUR_STEPS[pathname] ?? []).map((step) => step.target);
}

function filterMountedSteps(steps: TourStep[]): TourStep[] {
  if (typeof document === 'undefined') return [];
  return steps.filter((step) => {
    const el = document.querySelector(`[data-tour="${step.target}"]`) as HTMLElement | null;
    if (!el) return false;
    const box = el.getBoundingClientRect();
    return box.width > 0 && box.height > 0;
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

interface OnboardingTourProps {
  isOpen: boolean;
  initialMode?: TourMode;
  onClose: () => void;
  onSkipAll: () => void;
}

interface TargetRect {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export const OnboardingTour: React.FC<OnboardingTourProps> = ({
  isOpen,
  initialMode = 'page',
  onClose,
  onSkipAll,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const [mode, setMode] = useState<TourMode>(initialMode);
  const [hasPageSteps, setHasPageSteps] = useState<boolean>(false);
  const [activeSteps, setActiveSteps] = useState<TourStep[]>([]);
  const [stepIdx, setStepIdx] = useState<number>(0);
  const [rect, setRect] = useState<TargetRect | null>(null);
  const [popoverHeight, setPopoverHeight] = useState<number>(340);
  const [viewport, setViewport] = useState<{ w: number; h: number }>(() => ({
    w: typeof window !== 'undefined' ? window.innerWidth : 1440,
    h: typeof window !== 'undefined' ? window.innerHeight : 900,
  }));

  const measureRectOnly = useCallback((steps: TourStep[], idx: number) => {
    const step = steps[idx];
    if (!step) {
      setRect(null);
      return;
    }
    const el = document.querySelector(`[data-tour="${step.target}"]`) as HTMLElement | null;
    if (!el) {
      setRect(null);
      return;
    }
    const box = el.getBoundingClientRect();
    setRect({
      top: box.top,
      left: box.left,
      right: box.right,
      bottom: box.bottom,
      width: box.width,
      height: box.height,
    });
  }, []);

  const scrollStepIntoView = useCallback((step: TourStep | undefined) => {
    if (!step || typeof document === 'undefined' || typeof window === 'undefined') return;
    const el = document.querySelector(`[data-tour="${step.target}"]`) as HTMLElement | null;
    if (!el) return;

    const box = el.getBoundingClientRect();
    const vh = window.innerHeight;

    if (step.placement === 'auto') {
      // Para bloques medianos/altos dentro de la página, alinear la cabecera justo debajo del topbar fijo
      if (box.height > vh * 0.5 || box.top < 76 || box.bottom > vh - 24) {
        const targetTop = Math.max(0, window.scrollY + box.top - 80);
        window.scrollTo({ top: targetTop, behavior: 'smooth' });
      }
    } else {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
  }, []);

  // Inicializar modo y pasos montados al abrir o cambiar de ruta
  useEffect(() => {
    if (!isOpen) return;

    const pageCandidates = PAGE_TOUR_STEPS[location.pathname] ?? [];
    const mountedPage = filterMountedSteps(pageCandidates);
    const mountedMenu = filterMountedSteps(MENU_TOUR_STEPS);

    setHasPageSteps(mountedPage.length > 0);

    const nextMode: TourMode =
      initialMode === 'page' && mountedPage.length > 0 ? 'page' : 'menu';
    const nextSteps = nextMode === 'page' ? mountedPage : mountedMenu;

    setMode(nextMode);
    setActiveSteps(nextSteps);
    setStepIdx(0);
  }, [isOpen, initialMode, location.pathname]);

  // Observar cambios del DOM dentro de <main> en modo sección (p. ej. cargas asíncronas o cambio de pestaña)
  useEffect(() => {
    if (!isOpen || mode !== 'page') return;
    const mainEl = document.querySelector('main');
    if (!mainEl) return;

    let timer: number | null = null;
    const syncMountedPageSteps = () => {
      const mountedPage = filterMountedSteps(PAGE_TOUR_STEPS[location.pathname] ?? []);
      setHasPageSteps(mountedPage.length > 0);
      setActiveSteps((prev) => {
        const prevIds = prev.map((s) => s.id).join('|');
        const nextIds = mountedPage.map((s) => s.id).join('|');
        if (prevIds === nextIds) return prev;
        if (mountedPage.length === 0) return prev;
        return mountedPage;
      });
    };

    const observer = new MutationObserver(() => {
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(syncMountedPageSteps, 140);
    });

    observer.observe(mainEl, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [isOpen, mode, location.pathname]);

  // Asegurar índice válido si la lista de pasos cambia dinámicamente
  useEffect(() => {
    if (activeSteps.length > 0 && stepIdx >= activeSteps.length) {
      setStepIdx(activeSteps.length - 1);
    }
  }, [activeSteps.length, stepIdx]);

  // Desplazar suavemente hacia el objetivo al cambiar de paso y re-medir con RAF + temporizador
  useEffect(() => {
    if (!isOpen || activeSteps.length === 0) {
      setRect(null);
      return;
    }

    const safeIdx = Math.min(stepIdx, activeSteps.length - 1);
    const current = activeSteps[safeIdx];
    scrollStepIntoView(current);

    let rafId = window.requestAnimationFrame(() => {
      measureRectOnly(activeSteps, safeIdx);
    });
    const t1 = window.setTimeout(() => measureRectOnly(activeSteps, safeIdx), 160);
    const t2 = window.setTimeout(() => measureRectOnly(activeSteps, safeIdx), 360);
    const t3 = window.setTimeout(() => measureRectOnly(activeSteps, safeIdx), 700);

    let scrollRaf: number | null = null;
    const onResizeOrScroll = () => {
      setViewport({ w: window.innerWidth, h: window.innerHeight });
      if (scrollRaf !== null) window.cancelAnimationFrame(scrollRaf);
      scrollRaf = window.requestAnimationFrame(() => {
        measureRectOnly(activeSteps, safeIdx);
      });
    };

    window.addEventListener('resize', onResizeOrScroll);
    window.addEventListener('scroll', onResizeOrScroll, true);
    window.addEventListener('scrollend', onResizeOrScroll, true);

    return () => {
      window.cancelAnimationFrame(rafId);
      if (scrollRaf !== null) window.cancelAnimationFrame(scrollRaf);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
      window.removeEventListener('resize', onResizeOrScroll);
      window.removeEventListener('scroll', onResizeOrScroll, true);
      window.removeEventListener('scrollend', onResizeOrScroll, true);
    };
  }, [isOpen, activeSteps, stepIdx, measureRectOnly, scrollStepIntoView]);

  // Medir la altura real del popover para evitar desbordes
  useLayoutEffect(() => {
    if (!isOpen || !popoverRef.current) return;
    const h = popoverRef.current.getBoundingClientRect().height;
    if (h > 0) {
      setPopoverHeight(Math.ceil(h));
    }
  }, [isOpen, mode, stepIdx, activeSteps, viewport.w]);

  // Atajos de teclado: Esc para cerrar, flechas para navegar
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight') {
        setStepIdx((prev) => (prev + 1 < activeSteps.length ? prev + 1 : prev));
      } else if (e.key === 'ArrowLeft') {
        setStepIdx((prev) => (prev > 0 ? prev - 1 : 0));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, activeSteps.length, onClose]);

  const handleModeChange = (nextMode: TourMode) => {
    if (nextMode === mode) return;
    if (nextMode === 'page') {
      const mountedPage = filterMountedSteps(PAGE_TOUR_STEPS[location.pathname] ?? []);
      if (mountedPage.length === 0) return;
      setHasPageSteps(true);
      setMode('page');
      setActiveSteps(mountedPage);
      setStepIdx(0);
    } else {
      const mountedMenu = filterMountedSteps(MENU_TOUR_STEPS);
      setMode('menu');
      setActiveSteps(mountedMenu);
      setStepIdx(0);
    }
  };

  if (!isOpen || activeSteps.length === 0) return null;

  const safeIdx = Math.min(stepIdx, activeSteps.length - 1);
  const currentStep = activeSteps[safeIdx];
  const isFirst = safeIdx === 0;
  const isLast = safeIdx === activeSteps.length - 1;
  const routeLabel = ROUTE_LABELS[location.pathname] ?? 'Vista actual';

  // Calcular coordenadas seguras del popover dentro del viewport
  const MARGIN = 16;
  const GAP = 14;
  const DOCK_MARGIN = 24;
  const vw = viewport.w;
  const vh = viewport.h;
  const popW = Math.min(368, Math.max(280, vw - MARGIN * 2));
  const popH = Math.min(popoverHeight || 340, vh - MARGIN * 2);

  let popoverTop = clamp((vh - popH) / 2, MARGIN, vh - popH - MARGIN);
  let popoverLeft = clamp((vw - popW) / 2, MARGIN, vw - popW - MARGIN);

  if (rect) {
    const targetCenterX = rect.left + rect.width / 2;
    const alignedAutoLeft = clamp(
      rect.width < popW ? targetCenterX - popW / 2 : rect.left,
      MARGIN,
      vw - popW - MARGIN,
    );

    if (currentStep.placement === 'right') {
      if (rect.right + 18 + popW <= vw - MARGIN) {
        popoverLeft = rect.right + 18;
        popoverTop = clamp(rect.top - 12, MARGIN, vh - popH - MARGIN);
      } else {
        popoverLeft = alignedAutoLeft;
        popoverTop = clamp(rect.bottom + GAP, MARGIN, vh - popH - MARGIN);
      }
    } else if (currentStep.placement === 'bottom') {
      popoverTop = clamp(rect.bottom + GAP, MARGIN, vh - popH - MARGIN);
      popoverLeft = clamp(rect.right - popW, MARGIN, vw - popW - MARGIN);
    } else {
      const fitsBelow = rect.bottom + GAP + popH <= vh - MARGIN;
      const fitsAbove = rect.top - popH - GAP >= MARGIN;
      const isNarrow = rect.width < vw * 0.55;

      if (fitsBelow) {
        popoverTop = rect.bottom + GAP;
        popoverLeft = alignedAutoLeft;
      } else if (fitsAbove) {
        popoverTop = rect.top - popH - GAP;
        popoverLeft = alignedAutoLeft;
      } else if (isNarrow && rect.right + GAP + popW <= vw - MARGIN) {
        popoverLeft = rect.right + GAP;
        popoverTop = clamp(rect.top, MARGIN, vh - popH - MARGIN);
      } else if (isNarrow && rect.left - GAP - popW >= MARGIN) {
        popoverLeft = rect.left - GAP - popW;
        popoverTop = clamp(rect.top, MARGIN, vh - popH - MARGIN);
      } else {
        // Elementos altos o de ancho completo: anclar en esquina inferior derecha sin recortes
        popoverLeft = Math.max(MARGIN, vw - popW - DOCK_MARGIN);
        popoverTop = Math.max(MARGIN, vh - popH - DOCK_MARGIN);
      }
    }

    popoverTop = clamp(popoverTop, MARGIN, vh - popH - MARGIN);
    popoverLeft = clamp(popoverLeft, MARGIN, vw - popW - MARGIN);
  }

  // Halo de enfoque visible dentro del viewport (evita bordes fuera de pantalla en tablas extensas)
  const spotStyle = rect
    ? (() => {
        const top = Math.max(4, rect.top - 4);
        const left = Math.max(4, rect.left - 4);
        const bottom = Math.min(vh - 4, rect.bottom + 4);
        const right = Math.min(vw - 4, rect.right + 4);
        return {
          top,
          left,
          width: Math.max(24, right - left),
          height: Math.max(24, bottom - top),
          boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.58)',
        };
      })()
    : null;

  return (
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-label="Guía interactiva paso a paso de CENTINELA"
    >
      {/* Capa de enfoque sobre el elemento destacado */}
      {spotStyle ? (
        <div
          className="fixed rounded-xl pointer-events-none transition-all duration-200 border-2 border-emerald-500 dark:border-emerald-400"
          style={spotStyle}
        />
      ) : (
        <div className="fixed inset-0 bg-slate-950/60" />
      )}

      {/* Cierre al hacer clic fuera de la tarjeta */}
      <div className="fixed inset-0" onClick={onClose} />

      {/* Tarjeta Flotante de la Guía (Sólida, Cero Degradados) */}
      <div
        ref={popoverRef}
        onClick={(e) => e.stopPropagation()}
        style={{ top: popoverTop, left: popoverLeft, width: popW }}
        className="fixed max-w-[calc(100vw-24px)] rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 border-t-[4px] border-t-[#0B1F3A] dark:border-t-emerald-500 shadow-2xl p-5 space-y-3.5 transition-all duration-200"
      >
        {/* Cabecera: Selector de modo (Esta sección / Menú general) + botón cerrar */}
        <div className="flex items-center justify-between gap-2">
          <div
            className="inline-flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
            role="tablist"
            aria-label="Modo de guía"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'page'}
              disabled={!hasPageSteps}
              onClick={() => handleModeChange('page')}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] transition ${
                mode === 'page'
                  ? 'bg-[#0B1F3A] text-white dark:bg-emerald-500 dark:text-slate-950 font-bold'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-semibold'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              <Layers className="w-3 h-3" />
              Esta sección
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'menu'}
              onClick={() => handleModeChange('menu')}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] transition ${
                mode === 'menu'
                  ? 'bg-[#0B1F3A] text-white dark:bg-emerald-500 dark:text-slate-950 font-bold'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-semibold'
              }`}
            >
              <Map className="w-3 h-3" />
              Menú general
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition shrink-0"
            title="Cerrar guía (Esc)"
            aria-label="Cerrar guía"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Etiqueta de contexto y progreso numérico */}
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[#0B1F3A] dark:text-emerald-300 text-[11px] font-bold">
          <Compass className="w-3.5 h-3.5 shrink-0" />
          <span>
            {mode === 'page' ? routeLabel : 'Menú general'} • Paso {safeIdx + 1} de{' '}
            {activeSteps.length}
          </span>
        </div>

        {/* Contenido explicativo */}
        <div className="space-y-2">
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white leading-snug">
            {currentStep.title}
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            {currentStep.description}
          </p>
          <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 text-[11px] text-slate-700 dark:text-slate-300">
            <strong className="text-[#0B1F3A] dark:text-emerald-400">Consejo:</strong>{' '}
            {currentStep.tip}
          </div>
        </div>

        {/* Barra de progreso segmentada */}
        <div className="flex items-center gap-1.5">
          {activeSteps.map((s, idx) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setStepIdx(idx)}
              aria-label={`Ir al paso ${idx + 1}`}
              className={`h-1.5 rounded-full transition-all ${
                idx === safeIdx
                  ? 'flex-1 bg-[#0B1F3A] dark:bg-emerald-400'
                  : idx < safeIdx
                  ? 'w-4 bg-emerald-500/70'
                  : 'w-3 bg-slate-200 dark:bg-slate-700'
              }`}
            />
          ))}
        </div>

        {/* Controles principales: Saltar / Abrir + Atrás / Siguiente / Entendido */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 underline underline-offset-2 transition"
            >
              Saltar
            </button>
            {mode === 'menu' && currentStep.route && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  navigate(currentStep.route!);
                }}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 hover:text-blue-800 dark:text-cyan-400 dark:hover:text-cyan-300 transition"
              >
                Abrir <ExternalLink className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {!isFirst && (
              <button
                type="button"
                onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Atrás
              </button>
            )}

            {isLast ? (
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white dark:text-slate-950 text-xs font-bold transition"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Entendido
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setStepIdx((i) => Math.min(activeSteps.length - 1, i + 1))}
                className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-lg bg-[#0B1F3A] hover:bg-[#15315A] dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white dark:text-slate-950 text-xs font-bold transition"
              >
                Siguiente
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Barra inferior sutil: atajos y silenciar permanentemente */}
        <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400 dark:text-slate-500">
          <span>← → avanzar • Esc cerrar</span>
          <button
            type="button"
            onClick={onSkipAll}
            className="font-semibold text-slate-500 hover:text-rose-700 dark:text-slate-400 dark:hover:text-rose-400 underline underline-offset-2 transition whitespace-nowrap"
          >
            No mostrar más
          </button>
        </div>
      </div>
    </div>
  );
};
