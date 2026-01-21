# backend/app/main.py - UPDATED WITH HIERARCHY ROUTER

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import sys
import logging

# Import database
from .database import db

# Import routers
from .routers import (
    schema,
    data,
    hierarchy,  # NEW: Hierarchy router
    nodes,
    lineage,
    stats,
    groups
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events"""
    # Startup
    logger.info("=" * 60)
    logger.info("🚀 Starting Data Lineage API v2.0")
    logger.info("=" * 60)
    
    try:
        db.connect()
        logger.info("✅ Database connected successfully")
    except Exception as e:
        logger.error(f"❌ Failed to connect to database: {str(e)}")
        raise
    
    logger.info("🎯 API ready to accept requests")
    logger.info("=" * 60)
    
    yield
    
    # Shutdown
    logger.info("=" * 60)
    logger.info("🛑 Shutting down Data Lineage API")
    logger.info("=" * 60)
    
    try:
        db.disconnect()
        logger.info("✅ Database disconnected")
    except Exception as e:
        logger.error(f"❌ Error during shutdown: {str(e)}")


# Create FastAPI app
app = FastAPI(
    title="Data Lineage API (Enhanced)",
    description="Enterprise Data Lineage & Schema Management API with Hierarchy Support",
    version="2.0.0",
    lifespan=lifespan
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",  # Add this for your frontend
        "http://localhost:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(schema.router, prefix="/api/v1")      # Schema operations
app.include_router(hierarchy.router, prefix="/api/v1")   # NEW: Hierarchy operations
app.include_router(data.router, prefix="/api/v1")        # Data parsing
app.include_router(nodes.router, prefix="/api/v1")       # Legacy nodes
app.include_router(lineage.router, prefix="/api/v1")     # Legacy lineage
app.include_router(stats.router, prefix="/api/v1")       # Legacy stats
app.include_router(groups.router, prefix="/api/v1")      # Legacy groups


# Root Endpoints
@app.get("/", tags=["Root"])
async def root():
    """Root endpoint - API information"""
    return {
        "message": "Data Lineage API (Enhanced)",
        "version": "2.0.0",
        "status": "running",
        "features": [
            "Schema Management",
            "Class Hierarchy with SUBCLASS_OF relationships",
            "Multi-file Schema Inference",
            "Data Parsing & Preview",
            "Attribute-level Lineage",
            "Data Loading & Mapping",
            "Hierarchical Graph Visualization",
            "Cross-file Relationship Detection"
        ],
        "endpoints": {
            "schemas": "/api/v1/schemas",
            "hierarchy": "/api/v1/hierarchy",
            "data": "/api/v1/data",
            "docs": "/docs",
            "health": "/health"
        }
    }


@app.get("/health", tags=["Health"])
async def health_check():
    """Health check endpoint"""
    health_status = {
        "status": "healthy",
        "database": "unknown",
        "version": "2.0.0"
    }
    
    try:
        # Test database connection
        test_query = "RETURN 1"
        result = db.execute_query(test_query)
        if result:
            health_status["database"] = "connected"
        else:
            health_status["database"] = "disconnected"
            health_status["status"] = "degraded"
    except Exception as e:
        health_status["status"] = "unhealthy"
        health_status["database"] = "disconnected"
        health_status["error"] = str(e)
        logger.error(f"Health check failed: {str(e)}")
    
    return health_status


@app.get("/version", tags=["Root"])
async def version():
    """Get API version information"""
    return {
        "version": "2.0.0",
        "api": "Data Lineage API (Enhanced)",
        "python": sys.version,
        "fastapi": "0.100.0+",
        "features": [
            "Schema Definition",
            "Class Hierarchy Support",
            "Subclass Creation with SUBCLASS_OF relationships",
            "Multi-format Data Loading",
            "Hierarchical Visualization",
            "Lineage Path Tracing",
            "Data Parsing & Validation"
        ]
    }


@app.get("/api", tags=["Documentation"])
async def api_documentation():
    """API documentation overview"""
    return {
        "title": "Data Lineage API (Enhanced)",
        "version": "2.0.0",
        "description": "Enterprise Data Lineage & Schema Management API with Hierarchy",
        "endpoints": {
            "schemas": {
                "GET /api/v1/schemas": "List all schemas",
                "POST /api/v1/schemas": "Create new schema",
                "GET /api/v1/schemas/{id}": "Get schema by ID",
                "GET /api/v1/schemas/{id}/lineage": "Get schema lineage graph",
                "POST /api/v1/schemas/infer": "Infer schema from single file",
                "POST /api/v1/schemas/infer-multi": "Infer unified schema from multiple files",
                "POST /api/v1/schemas/{id}/load-data": "Load data into schema"
            },
            "hierarchy": {
                "GET /api/v1/hierarchy/{schema_id}/tree": "Get hierarchy tree",
                "POST /api/v1/hierarchy/{schema_id}/subclass": "Create subclass",
                "GET /api/v1/hierarchy/{schema_id}/stats": "Get hierarchy statistics"
            },
            "data": {
                "POST /api/v1/data/parse": "Parse file and return structure",
                "POST /api/v1/data/preview": "Preview file contents",
                "POST /api/v1/data/validate": "Validate file format"
            }
        },
        "interactive_docs": "/docs",
        "openapi_schema": "/openapi.json"
    }


# Main entry point for uvicorn
if __name__ == "__main__":
    import uvicorn
    import os
    
    ENV = os.getenv("ENVIRONMENT", "development")
    
    config = {
        "app": "app.main:app",
        "host": "0.0.0.0",
        "port": 8000,
        "log_level": "info",
    }
    
    if ENV == "development":
        config.update({
            "reload": True,
            "reload_dirs": ["app"],
            "reload_delay": 0.5,
            "log_level": "debug",
        })
        
        logger.info("=" * 60)
        logger.info("🔧 Starting in DEVELOPMENT mode")
        logger.info("=" * 60)
        logger.info("⚡ Hot reload: ENABLED")
        logger.info("🐛 Debug mode: ENABLED")
        logger.info("📍 Server: http://0.0.0.0:8000")
        logger.info("📍 Docs: http://localhost:8000/docs")
        logger.info("=" * 60)
    else:
        config.update({
            "workers": 4,
            "log_level": "info",
        })
        
        logger.info("=" * 60)
        logger.info("🚀 Starting in PRODUCTION mode")
        logger.info("=" * 60)
        logger.info("👷 Workers: 4")
        logger.info("📍 Server: http://0.0.0.0:8000")
        logger.info("=" * 60)
    
    uvicorn.run(**config)