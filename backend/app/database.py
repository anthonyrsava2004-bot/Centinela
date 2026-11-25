import os
from pathlib import Path
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# Cargar variables de entorno desde backend/.env o raíz/.env
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")
load_dotenv(BASE_DIR.parent / ".env")

DEFAULT_DB_URL = "postgresql://postgres:TU_PASSWORD_LOCAL@localhost:5432/Centinela"

raw_database_url = os.getenv("DATABASE_URL", DEFAULT_DB_URL).strip()

# Compatibilidad automática con Render (convierte postgres:// a postgresql:// para SQLAlchemy 2.0)
if raw_database_url.startswith("postgres://"):
    DATABASE_URL = raw_database_url.replace("postgres://", "postgresql://", 1)
else:
    DATABASE_URL = raw_database_url


def _crear_engine_seguro(db_url: str):
    """
    Conecta a PostgreSQL (Centinela / Render). Si en entorno local el archivo .env
    aún mantiene el placeholder 'TU_PASSWORD_LOCAL' sin configurar, activa un motor
    local de respaldo para que la plataforma opere de inmediato sin caerse.
    """
    if db_url.startswith("sqlite"):
        return create_engine(db_url, connect_args={"check_same_thread": False})

    engine_kwargs = {"pool_pre_ping": True}
    if os.getenv("VERCEL"):
        engine_kwargs.update({"pool_size": 2, "max_overflow": 3, "pool_recycle": 300})

    pg_engine = create_engine(db_url, **engine_kwargs)
    if "TU_PASSWORD_LOCAL" in db_url:
        try:
            with pg_engine.connect() as _:
                return pg_engine
        except Exception:
            fallback_sqlite = f"sqlite:///{(BASE_DIR / 'centinela_local.db').as_posix()}"
            print(
                "[CENTINELA INFO] 'TU_PASSWORD_LOCAL' aún no ha sido reemplazado en backend/.env. "
                "Usando almacenamiento local temporal hasta que configures tu contraseña de PostgreSQL."
            )
            return create_engine(
                fallback_sqlite, connect_args={"check_same_thread": False}
            )
    return pg_engine


engine = _crear_engine_seguro(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """Dependencia de sesión de base de datos para endpoints de FastAPI."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
