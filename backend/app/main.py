# backend/app/main.py - COMPLETE WITH DATA ROUTER
"""
Data Lineage API - Main Application (Enhanced)
A FastAPI application for managing data lineage with schema definition
"""

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from contextlib import asynccontextmanager
from .routers import nodes, lineage, stats, groups, schema, data  # ← ADDED data
from .database import db
import logging
import sys
import traceback

# Logging configuration
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('app.log') if not sys.stdout.isatty() else logging.NullHandler()
    ]
)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan event handler for startup and shutdown"""
    # STARTUP
    logger.info("=" * 60)
    logger.info("🚀 Starting Data Lineage API (Enhanced)")
    logger.info("=" * 60)
    
    try:
        logger.info("📊 Initializing database connection...")
        db.connect()
        logger.info("✅ Database connection established")
        
        # Test database connection
        try:
            test_query = "RETURN 1"
            result = db.execute_query(test_query)
            if result:
                logger.info("✅ Database health check passed")
        except Exception as e:
            logger.warning(f"⚠️  Database health check failed: {str(e)}")
        
        logger.info("✅ All routers loaded successfully")
        logger.info("=" * 60)
        logger.info("🎉 Application startup complete!")
        logger.info("📍 API Documentation: http://localhost:8000/docs")
        logger.info("📍 Health Check: http://localhost:8000/health")
        logger.info("=" * 60)
        
    except Exception as e:
        logger.error("=" * 60)
        logger.error(f"❌ Failed to start application: {str(e)}")
        logger.error("=" * 60)
        logger.error(traceback.format_exc())
        raise
    
    yield
    
    # SHUTDOWN
    logger.info("=" * 60)
    logger.info("🛑 Shutting down Data Lineage API")
    logger.info("=" * 60)
    
    try:
        logger.info("📊 Closing database connection...")
        db.disconnect()
        logger.info("✅ Database connection closed")
        logger.info("✅ Application shutdown complete")
        logger.info("=" * 60)
    except Exception as e:
        logger.error(f"❌ Error during shutdown: {str(e)}")
        logger.error(traceback.format_exc())


app = FastAPI(
    title="Data Lineage API (Enhanced)",
    description="""
    ## Enhanced Data Lineage Management System
    
    A comprehensive API for managing data lineage with schema definition and hierarchical visualization.
    
    ### Features:
    * **Schema Definition**: Define classes, relationships, and cardinality
    * **Data Loading**: Load data from CSV, Excel, JSON, XML
    * **Hierarchical Visualization**: Schema-level and data-level views
    * **Lineage Tracking**: Track data flow and relationships
    * **Advanced Analytics**: Statistics and insights
    
    ### New Capabilities:
    * **Schema Builder**: Visual schema definition with drag-and-drop
    * **Data Mapper**: Intelligent mapping of data to schema
    * **Collapsible Views**: Expand/collapse schema classes
    * **Path Highlighting**: Trace lineage from any data point
    * **Multi-file Schema Inference**: Detect relationships across files
    * **Data Parsing**: Parse and preview data files
    """,
    version="2.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    contact={
        "name": "Data Lineage Team",
        "email": "support@example.com",
    },
    license_info={
        "name": "MIT",
    },
)


# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)


# Request Logging Middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log all incoming requests"""
    logger.info(f"📨 {request.method} {request.url.path}")
    
    try:
        response = await call_next(request)
        logger.info(f"✅ {request.method} {request.url.path} - {response.status_code}")
        return response
    except Exception as e:
        logger.error(f"❌ {request.method} {request.url.path} - Error: {str(e)}")
        raise


# Exception Handlers
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle validation errors"""
    logger.error(f"Validation error: {exc}")
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "detail": exc.errors(),
            "body": exc.body
        }
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Handle all other exceptions"""
    logger.error(f"Unhandled exception: {str(exc)}")
    logger.error(traceback.format_exc())
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": "Internal server error",
            "error": str(exc)
        }
    )


# Include Routers - ORDER MATTERS!
app.include_router(schema.router, prefix="/api/v1")  # Schema operations
app.include_router(data.router, prefix="/api/v1")    # ← NEW: Data parsing
app.include_router(nodes.router, prefix="/api/v1")   # Legacy nodes
app.include_router(lineage.router, prefix="/api/v1") # Legacy lineage
app.include_router(stats.router, prefix="/api/v1")   # Legacy stats
app.include_router(groups.router, prefix="/api/v1")  # Legacy groups


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
            "Multi-file Schema Inference",
            "Data Parsing & Preview",
            "Attribute-level Lineage",
            "Data Loading & Mapping",
            "Hierarchical Graph Visualization",
            "Cross-file Relationship Detection"
        ],
        "endpoints": {
            "schemas": "/api/v1/schemas",
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
        "description": "Enterprise Data Lineage & Schema Management API",
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