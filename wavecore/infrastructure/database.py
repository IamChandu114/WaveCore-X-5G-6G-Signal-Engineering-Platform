from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from wavecore.core.config import settings


class Base(DeclarativeBase):
    pass


engine = create_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

