import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X,
  ArrowRight,
  ArrowLeft,
  Compass,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';

export interface TourStep {
  id: string;
  target: string;
  title: string;
  description: string;
  tip: string;
  placement: 'right' | 'bottom';
  route?: string;
}

const ALL_TOUR_STEPS: TourStep[] = [
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
    id: 'sesion',
    target: 'session-switcher',
    title: 'Cambie de Perfil cuando Quiera',
    description:
      'Desde aquí puede alternar entre Auditor OCI, Especialista de Compras (DEC) y Transparencia (Solo Lectura) para comprobar la separación de funciones.',
    tip: 'Puede repetir esta guía en cualquier momento con el botón "Guía" de la barra superior.',
    placement: 'bottom',
  },
];

interface OnboardingTourProps {
  isOpen: boolean;
  onClose: () => void;
}

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export const OnboardingTour: React.FC<OnboardingTourProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const [activeSteps, setActiveSteps] = useState<TourStep[]>([]);
  const [stepIdx, setStepIdx] = useState<number>(0);
  const [rect, setRect] = useState<TargetRect | null>(null);

  const measureCurrentStep = useCallback((steps: TourStep[], idx: number) => {
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
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    const box = el.getBoundingClientRect();
    setRect({
      top: box.top,
      left: box.left,
      width: box.width,
      height: box.height,
    });
  }, []);

  // Filtrar pasos visibles según los elementos actuales del perfil activo
  useEffect(() => {
    if (!isOpen) return;
    const visibles = ALL_TOUR_STEPS.filter((s) =>
      Boolean(document.querySelector(`[data-tour="${s.target}"]`)),
    );
    setActiveSteps(visibles);
    setStepIdx(0);
    measureCurrentStep(visibles, 0);
  }, [isOpen, measureCurrentStep]);

  // Recalcular posición en cambio de paso o redimensionado de ventana
  useEffect(() => {
    if (!isOpen || activeSteps.length === 0) return;
    measureCurrentStep(activeSteps, stepIdx);

    const onResizeOrScroll = () => measureCurrentStep(activeSteps, stepIdx);
    window.addEventListener('resize', onResizeOrScroll);
    window.addEventListener('scroll', onResizeOrScroll, true);
    return () => {
      window.removeEventListener('resize', onResizeOrScroll);
      window.removeEventListener('scroll', onResizeOrScroll, true);
    };
  }, [isOpen, activeSteps, stepIdx, measureCurrentStep]);

  // Atajos de teclado: Esc para saltar, flechas para navegar
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

  if (!isOpen || activeSteps.length === 0) return null;

  const currentStep = activeSteps[stepIdx];
  const isFirst = stepIdx === 0;
  const isLast = stepIdx === activeSteps.length - 1;

  // Calcular coordenadas seguras del popover dentro del viewport
  const POPOVER_W = 356;
  const POPOVER_H_EST = 352;
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1440;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 900;

  let popoverTop = Math.max(24, (vh - POPOVER_H_EST) / 2);
  let popoverLeft = Math.max(16, (vw - POPOVER_W) / 2);

  if (rect) {
    if (currentStep.placement === 'right' && rect.left + rect.width + 18 + POPOVER_W < vw) {
      popoverLeft = rect.left + rect.width + 18;
      popoverTop = Math.min(Math.max(18, rect.top - 12), vh - POPOVER_H_EST - 18);
    } else {
      popoverTop = Math.min(rect.top + rect.height + 16, vh - POPOVER_H_EST - 18);
      popoverLeft = Math.min(
        Math.max(16, rect.left + rect.width - POPOVER_W),
        vw - POPOVER_W - 16,
      );
    }
  }

  return (
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-label="Guía interactiva de uso de CENTINELA"
    >
      {/* Capa de clic fuera para cerrar o halo de enfoque */}
      {rect ? (
        <div
          className="fixed rounded-xl pointer-events-none transition-all duration-200 border-2 border-emerald-500 dark:border-emerald-400"
          style={{
            top: rect.top - 4,
            left: rect.left - 4,
            width: rect.width + 8,
            height: rect.height + 8,
            boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.58)',
          }}
        />
      ) : (
        <div className="fixed inset-0 bg-slate-950/60" />
      )}

      {/* Bloqueo suave de clics accidentales sobre el fondo */}
      <div className="fixed inset-0" onClick={onClose} />

      {/* Tarjeta Flotante de la Guía (Sólida, Cero Degradados) */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ top: popoverTop, left: popoverLeft, width: POPOVER_W }}
        className="fixed max-w-[calc(100vw-24px)] rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 border-t-[4px] border-t-[#0B1F3A] dark:border-t-emerald-500 shadow-2xl p-5 space-y-4 transition-all duration-200"
      >
        {/* Cabecera del paso */}
        <div className="flex items-start justify-between gap-2">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[#0B1F3A] dark:text-emerald-300 text-[11px] font-bold">
            <Compass className="w-3.5 h-3.5" />
            Guía rápida • Paso {stepIdx + 1} de {activeSteps.length}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title="Saltar guía (Esc)"
            aria-label="Cerrar guía"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Contenido claro y directo */}
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
                idx === stepIdx
                  ? 'flex-1 bg-[#0B1F3A] dark:bg-emerald-400'
                  : idx < stepIdx
                  ? 'w-4 bg-emerald-500/70'
                  : 'w-3 bg-slate-200 dark:bg-slate-700'
              }`}
            />
          ))}
        </div>

        {/* Controles: Saltar + Ir a vista + Anterior / Siguiente */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 underline underline-offset-2 transition"
            >
              Saltar guía
            </button>
            {currentStep.route && (
              <button
                type="button"
                onClick={() => {
                  navigate(currentStep.route!);
                  onClose();
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
      </div>
    </div>
  );
};
