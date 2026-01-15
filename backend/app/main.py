# backend/app/main.py - COMPLETE PRODUCTION-READY VERSION
"""
Data Lineage API - Main Application
A FastAPI application for managing data lineage graphs with FalkorDB
"""

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from contextlib import asynccontextmanager
from .routers import nodes, lineage, stats, groups
from .database import db
import logging
import sys
import traceback

# ============================================
# LOGGING CONFIGURATION
# ============================================

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('app.log') if not sys.stdout.isatty() else logging.NullHandler()
    ]
)

logger = logging.getLogger(__name__)


# ============================================
# LIFESPAN EVENT HANDLER
# ============================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Modern lifespan event handler for startup and shutdown.
    Manages database connections and application lifecycle.
    """
    # STARTUP
    logger.info("=" * 60)
    logger.info("🚀 Starting Data Lineage API")
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
    
    yield  # Application runs here
    
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


# ============================================
# FASTAPI APPLICATION
# ============================================

app = FastAPI(
    title="Data Lineage API",
    description="""
    ## Data Lineage Management System
    
    A comprehensive API for managing data lineage graphs using FalkorDB.
    
    ### Features:
    * **Nodes**: Create, read, update, and delete nodes (Countries, Databases, Attributes)
    * **Lineage**: Query and visualize data lineage paths
    * **Stats**: Get graph statistics and insights
    * **Groups**: Organize nodes into logical groups
    
    ### Node Types:
    * **Country**: Geographic data locations
    * **Database**: Data storage systems
    * **Attribute**: Data fields and columns
    
    ### Powered By:
    * FastAPI - Modern web framework
    * FalkorDB - Graph database
    * Python 3.8+
    """,
    version="1.0.0",
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


# ============================================
# MIDDLEWARE CONFIGURATION
# ============================================

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",      # Vite dev server (default)
        "http://localhost:3000",      # Alternative frontend port
        "http://localhost:3001",      # Your current frontend port
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


# ============================================
# EXCEPTION HANDLERS
# ============================================

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle validation errors with detailed messages"""
    logger.error(f"Validation error on {request.url.path}: {exc.errors()}")
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "detail": exc.errors(),
            "body": exc.body,
            "message": "Request validation failed"
        },
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Handle all unhandled exceptions"""
    logger.error(f"Unhandled exception on {request.url.path}: {str(exc)}")
    logger.error(traceback.format_exc())
    
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "message": "Internal server error",
            "detail": str(exc) if app.debug else "An error occurred processing your request",
            "path": str(request.url.path)
        },
    )


# ============================================
# ROUTER REGISTRATION
# ============================================

app.include_router(nodes.router, prefix="/api/v1", tags=["Nodes"])
app.include_router(lineage.router, prefix="/api/v1", tags=["Lineage"])
app.include_router(stats.router, prefix="/api/v1", tags=["Statistics"])
app.include_router(groups.router, prefix="/api/v1", tags=["Groups"])

logger.info("✅ All routers registered")


# ============================================
# ROOT ENDPOINTS
# ============================================

@app.get("/", tags=["Root"])
async def root():
    """
    Root endpoint - API information and available endpoints
    """
    return {
        "message": "Data Lineage API",
        "version": "1.0.0",
        "status": "running",
        "documentation": {
            "swagger": "/docs",
            "redoc": "/redoc",
            "openapi": "/openapi.json"
        },
        "endpoints": {
            "health": "/health",
            "nodes": "/api/v1/nodes",
            "lineage": "/api/v1/lineage",
            "stats": "/api/v1/stats",
            "groups": "/api/v1/groups"
        },
        "database": "FalkorDB",
        "frontend": "http://localhost:5173"
    }


@app.get("/health", tags=["Health"])
async def health_check():
    """
    Health check endpoint - Verify API and database status
    """
    health_status = {
        "status": "healthy",
        "api": "operational",
        "database": "unknown",
        "version": "1.0.0"
    }
    
    try:
        # Test database connection
        test_query = "RETURN 1"
        result = db.execute_query(test_query)
        
        if result:
            health_status["database"] = "connected"
            
            # Get database stats
            try:
                stats_query = """
                MATCH (n)
                RETURN count(n) as node_count
                """
                stats_result = db.execute_query(stats_query)
                
                if stats_result.result_set:
                    node_count = stats_result.result_set[0][0]
                    health_status["nodes"] = node_count
            except:
                pass
                
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
        "version": "1.0.0",
        "api": "Data Lineage API",
        "python": sys.version,
        "fastapi": "0.100.0+"
    }


# ============================================
# DEVELOPMENT SERVER (UVICORN)
# ============================================

if __name__ == "__main__":
    import uvicorn
    
    # Determine if running in production or development
    import os
    ENV = os.getenv("ENVIRONMENT", "development")
    
    config = {
        "app": "app.main:app",
        "host": "0.0.0.0",
        "port": 8000,
        "log_level": "info",
    }
    
    if ENV == "development":
        # Development settings
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
        logger.info("=" * 60)
    else:
        # Production settings
        config.update({
            "workers": 4,
            "log_level": "info",
        })
        
        logger.info("=" * 60)
        logger.info("🚀 Starting in PRODUCTION mode")
        logger.info("=" * 60)
        logger.info("👷 Workers: 4")
        logger.info("=" * 60)
    
    # Start server
    uvicorn.run(**config)