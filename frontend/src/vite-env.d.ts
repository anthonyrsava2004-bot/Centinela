/// <reference types="vite/client" />

declare module 'react-cytoscapejs' {
  import * as React from 'react';

  export interface CytoscapeComponentProps {
    elements: any[];
    style?: React.CSSProperties;
    stylesheet?: any[];
    layout?: Record<string, any>;
    cy?: (cyInstance: any) => void;
    className?: string;
    wheelSensitivity?: number;
    minZoom?: number;
    maxZoom?: number;
  }

  const CytoscapeComponent: React.ComponentType<CytoscapeComponentProps>;
  export default CytoscapeComponent;
}
