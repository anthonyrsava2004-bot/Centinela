import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { DashboardPage } from './pages/DashboardPage';
import { ExpedientesPage } from './pages/ExpedientesPage';
import { TrazabilidadPage } from './pages/TrazabilidadPage';
import { GrafoColusionPage } from './pages/GrafoColusionPage';
import { CompliancePage } from './pages/CompliancePage';
import { ThemeProvider } from './context/ThemeContext';
import { RolUsuario } from './types';
import { ROLE_PROFILES } from './config/roles';

const ROL_STORAGE_KEY = 'centinela-rol';

export const App: React.FC = () => {
  const [rolActivo, setRolActivo] = useState<RolUsuario>(() => {
    try {
      const saved = localStorage.getItem(ROL_STORAGE_KEY) as RolUsuario | null;
      if (saved && saved in ROLE_PROFILES) return saved;
    } catch {
      // Ignore storage access issues
    }
    return 'Auditor OCI (Control Institucional)';
  });

  useEffect(() => {
    try {
      localStorage.setItem(ROL_STORAGE_KEY, rolActivo);
    } catch {
      // Ignore storage access issues
    }
  }, [rolActivo]);

  return (
    <ThemeProvider>
      <Layout rolActivo={rolActivo} setRolActivo={setRolActivo}>
        <Routes>
          <Route path="/" element={<DashboardPage rolActivo={rolActivo} />} />
          <Route path="/expedientes" element={<ExpedientesPage rolActivo={rolActivo} />} />
          <Route
            path="/trazabilidad"
            element={<TrazabilidadPage rolActivo={rolActivo} />}
          />
          <Route path="/grafo-colusion" element={<GrafoColusionPage />} />
          <Route
            path="/compliance"
            element={<CompliancePage rolActivo={rolActivo} />}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </ThemeProvider>
  );
};

export default App;
