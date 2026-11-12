# 🛡️ CENTINELA — Plataforma de Auditoría Preventiva, Trazabilidad Forense y Detección Explicable (XAI)

> **Hackathon Innova Norte 3G — Final Presencial (Universidad Nacional de Trujillo - UNT)**  
> **Desafío 2:** Integridad Institucional y Compliance en Contrataciones Públicas  
> **Marco Legal:** Ley N° 32069 (Ley General de Contrataciones Públicas) • D.S. N° 009-2025-EF • Ley N° 29733 (Protección de Datos Personales) • Ley N° 27815 • Ley N° 27444  
> **Nivel de Madurez:** TRL 3-4 (Entorno validado con 120 expedientes 100% sintéticos y deterministas)

---

## 1. Resumen Ejecutivo

**CENTINELA** es una plataforma GovTech de **auditoría preventiva, trazabilidad forense e inteligencia explicable (XAI)** diseñada para fortalecer la integridad en los procesos de contratación pública y universitaria.

A diferencia de los sistemas tradicionales reactivos o modelos de "caja negra", **CENTINELA**:
1. **Protege la integridad documental con Blockchain-Lite (SHA-256):** Encadena criptográficamente las 6 etapas secuenciales de cada expediente (`Requerimiento` $\to$ `TDR` $\to$ `Cotizaciones` $\to$ `Buena Pro` $\to$ `Conformidad` $\to$ `Pago`) para detectar cualquier alteración ex-post en base de datos.
2. **Garantiza Explicabilidad Total (XAI) sin Lenguaje Punitivo:** Respetando el Principio de Presunción de Licitud (Art. 248 de la Ley N° 27444), el sistema nunca acusa de "corrupción"; emite **"Señales de riesgo que ameritan revisión humana"** detallando:
   - **(a) Regla activada**
   - **(b) Evidencia forense exacta**
   - **(c) Base normativa exacta**
3. **Detecta Redes de Colusión con Teoría de Grafos (`NetworkX` + `Cytoscape`):** Descubre anillos de proveedores que simulan competencia en un mismo proceso pero comparten representante legal (`representante_id`), dirección fiscal (`direccion_hash`) o teléfono (`telefono_hash`).
4. **Evalúa Direccionamiento Técnico en TDR (`Scikit-Learn` TF-IDF + Similitud Coseno):** Analiza de forma 100% local/offline si los Términos de Referencia fueron copiados del catálogo técnico de un proveedor específico ($>78\%$ de similitud).
5. **Cumple Privacidad por Diseño (Ley N° 29733):** Seudonimiza de origen a funcionarios (`FUNC-LOG-01`, `FUNC-TES-02`), áreas usuarias (`AREA-TI-03`) y proveedores (`PROV-SYN-014`).

---

## 2. Arquitectura del Sistema

```mermaid
flowchart LR
    subgraph Frontend ["Frontend (React 18 + TypeScript + Tailwind + Cytoscape)"]
        UI1["Dashboard Ejecutivo"]
        UI2["Padrón 120 Expedientes"]
        UI3["Vista Forense SHA-256 & NLP"]
        UI4["Grafo de Colusión Cytoscape"]
        UI5["Bandeja Compliance XAI"]
    end

    subgraph Backend ["Backend (FastAPI + SQLAlchemy 2.0)"]
        API["REST API + Auto-Seed"]
        M1["Motor Criptográfico SHA-256\n(crypto_audit.py)"]
        M2["Motor de Reglas XAI\n(rules_engine.py)"]
        M3["Motor de Grafos NetworkX\n(graph_engine.py)"]
        M4["Detector Semántico TF-IDF\n(nlp_tdr.py)"]
        M5["Generador PDF Forense\n(pdf_report.py - ReportLab)"]
    end

    subgraph Database ["Persistencia Relacional"]
        DB[("PostgreSQL\nBD: Centinela")]
    end

    Frontend <-->|"JSON / PDF Stream"| API
    API --> M1 & M2 & M3 & M4 & M5
    M1 & M2 & M3 & M4 & M5 <--> DB
```

---

## 3. Stack Tecnológico (Versiones Estables Compatibles)

### Backend (`/backend`)
- **Python:** `3.11`
- **FastAPI:** `0.111.0` + **Uvicorn:** `0.30.1`
- **SQLAlchemy:** `2.0.31` + **Psycopg2-binary:** `2.9.9` + **Pydantic:** `2.8.2`
- **NetworkX:** `3.3` (Detección topológica de anillos de colusión y centralidad de grado)
- **Scikit-Learn:** `1.5.1` (Vectorización TF-IDF y Similitud Coseno local)
- **ReportLab:** `4.2.2` (Generación de Reportes Oficiales de Trazabilidad en PDF con sello SHA-256)
- **Python-dotenv:** `1.0.1`

### Frontend (`/frontend`)
- **Node.js:** `20 LTS`
- **React:** `18.3.1` + **TypeScript:** `5.5.3` + **Vite:** `5.4.1`
- **React-Router-Dom:** `6.26.1`
- **Tailwind CSS:** `3.4.10` + **Lucide-React:** `0.427.0`
- **Cytoscape:** `3.30.2` + **react-cytoscapejs:** `2.0.0`
- **Axios:** `1.7.4`

---

## 4. Los 8 Casos Trampa del Dataset Sintético (120 Expedientes)

Al iniciar el backend por primera vez (o al pulsar **"Regenerar Dataset Sintético (120 Exp.)"** en el Dashboard), el sistema genera **112 expedientes limpios** y **8 expedientes con trampas forenses deterministas**:

| Expediente | Tipología de Riesgo | Evidencia Forense Detectada por CENTINELA | Base Legal |
| :--- | :--- | :--- | :--- |
| **`EXP-2025-UNT-0001`**<br>**`EXP-2025-UNT-0002`**<br>**`EXP-2025-UNT-0003`** | `FRACCIONAMIENTO_8UIT` | `AREA-TI-03` tramita 3 contrataciones menores el mismo mes por S/ 41,500, S/ 40,900 y S/ 42,100 (cada una bajo el tope de 8 UIT = S/ 42,800), acumulando **S/ 124,500** a favor de `PROV-SYN-014`. | Art. 20 y Art. 54 Ley N° 32069 |
| **`EXP-2025-UNT-0004`** | `COLUSION_PROVEEDORES` | Co-participan `PROV-SYN-004`, `PROV-SYN-005` y `PROV-SYN-006` compartiendo representante legal (`REP-HASH-9981A`), dirección (`DIR-HASH-TRUJ-772`) y teléfono (`TEL-HASH-944-881`). | Art. 5 y Art. 30 Ley N° 32069 |
| **`EXP-2025-UNT-0005`** | `COLUSION_PROVEEDORES` | Co-participan `PROV-SYN-007`, `PROV-SYN-008` y `PROV-SYN-009` compartiendo `REP-HASH-4420B` y `DIR-HASH-TRUJ-509`. | Art. 5 y Art. 30 Ley N° 32069 |
| **`EXP-2025-UNT-0006`** | `DIRECCIONAMIENTO_TDR` | El TDR presenta **>85% de similitud coseno TF-IDF** con el catálogo exclusivo de `PROV-SYN-014` (`BioCore-X99 Quantum`, `NanoVein-770`). | Art. 47 Ley N° 32069 y D.S. N° 009-2025-EF |
| **`EXP-2025-UNT-0007`** | `CONFLICTO_SEGREGACION` | El mismo código funcional `FUNC-LOG-01` formula el Requerimiento, elabora el TDR, cotiza, otorga la Buena Pro y emite la Conformidad. | Art. 11 y Art. 25 Ley N° 32069 / Ley N° 27815 |
| **`EXP-2025-UNT-0008`** | `PAGO_SIN_CONFORMIDAD` | Se ejecuta el devengado y pago SIAF pese a que la etapa de Conformidad registra *"OBSERVADO - SIN ACTA DE RECEPCIÓN DEFINITIVA"*. | Art. 67 Ley N° 32069 / D.L. N° 1441 |

---

## 5. Instalación y Ejecución Local

### Paso 1: Clonar el repositorio
```bash
git clone https://github.com/anthonyrsava2004-bot/Centinela.git
cd Centinela
```

### Paso 2: Configurar e Iniciar el Backend
```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Copia el archivo `.env.example` a `.env` y configura tu contraseña local de PostgreSQL para la base de datos `Centinela`:
```powershell
copy .env.example .env
```
Contenido de `backend/.env`:
```env
DATABASE_URL=postgresql://postgres:TU_PASSWORD_LOCAL@localhost:5432/Centinela
```

Ejecuta el servidor FastAPI:
```powershell
uvicorn app.main:app --reload --port 8000
```
- **API & Documentación Interactiva:** `http://localhost:8000/docs`

### Paso 3: Configurar e Iniciar el Frontend
En una nueva terminal:
```powershell
cd frontend
npm install
npm run dev
```
- **Aplicación Web CENTINELA:** `http://localhost:5173`

---

## 6. Despliegue en Producción (Render)

El proyecto incluye el archivo `render.yaml` listo para despliegue automatizado (**Blueprint** en Render):
1. Conecta este repositorio de GitHub en **Render $\to$ New + $\to$ Blueprint**.
2. Render creará automáticamente:
   - La base de datos PostgreSQL gestionada (`centinela-db`).
   - El servicio web backend (`centinela-backend`), inyectando `DATABASE_URL` (con conversión automática de `postgres://` a `postgresql://` en `database.py`).
   - El sitio estático frontend (`centinela-frontend`).
3. Configura la variable de entorno `VITE_API_URL` en `centinela-frontend` apuntando a la URL pública de tu backend en Render.
