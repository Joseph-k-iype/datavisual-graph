from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings"""
    
    # Application
    APP_NAME: str = "Data Lineage Dashboard"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    
    # FalkorDB
    FALKORDB_HOST: str = "localhost"
    FALKORDB_PORT: int = 6379
    FALKORDB_PASSWORD: str = ""
    FALKORDB_GRAPH_NAME: str = "lineage_graph"
    
    # CORS
    CORS_ORIGINS: list = [
        "http://localhost:3000",
        "http://localhost:3001",  # ← ADD THIS LINE
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",  # ← ADD THIS LINE
    "http://127.0.0.1:5173"
]
    
    # API
    API_PREFIX: str = "/api/v1"
    
    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()


settings = get_settings()