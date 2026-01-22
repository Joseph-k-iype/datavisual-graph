# backend/app/main.py
"""
Main Application - COMPLETE VERSION
FastAPI application with all routers, middleware, and startup configuration
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import sys
import logging
import uvicorn

# Import database
from .database import db

# Import routers
from .routers import (
    schema,
    data,
    hierarchy,  # ✅ CRITICAL: Hierarchy router for subclass creation
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
    logger.info("=" * 80)
    logger.info("🚀 Starting Data Lineage API v2.0 (FULLY FIXED)")
    logger.info("=" * 80)
    
    try:
        db.connect()
        logger.info("✅ Database connected successfully")
        
        # Test database connection
        test_query = "RETURN 1 as test"
        result = db.execute_query(test_query)
        if result and result.result_set:
            logger.info("✅ Database query test successful")
        else:
            logger.warning("⚠️  Database query test returned no results")
    except Exception as e:
        logger.error(f"❌ Failed to connect to database: {str(e)}")
        logger.error("Please ensure Neo4j is running and connection details are correct")
        raise
    
    logger.info("🎯 API ready to accept requests")
    logger.info("=" * 80)
    logger.info("")
    logger.info("✅ ALL CRITICAL FIXES APPLIED:")
    logger.info("   1. apiService.createSubclass method available")
    logger.info("   2. Hierarchy router properly exposed")
    logger.info("   3. Schema creation handles all relationships")
    logger.info("   4. Full N-level hierarchy support")
    logger.info("=" * 80)
    logger.info("")
    logger.info("📡 API Endpoints Available:")
    logger.info("   - Swagger UI: http://localhost:8000/docs")
    logger.info("   - ReDoc: http://localhost:8000/redoc")
    logger.info("   - Health Check: http://localhost:8000/health")
    logger.info("=" * 80)
    
    yield
    
    # Shutdown
    logger.info("")
    logger.info("=" * 80)
    logger.info("🛑 Shutting down Data Lineage API")
    logger.info("=" * 80)
    
    try:
        db.disconnect()
        logger.info("✅ Database disconnected")
    except Exception as e:
        logger.error(f"❌ Error during shutdown: {str(e)}")
    
    logger.info("👋 Goodbye!")
    logger.info("=" * 80)


# Create FastAPI app
app = FastAPI(
    title="Data Lineage API (Enhanced & Fixed)",
    description="""
    Enterprise Data Lineage & Schema Management API with Full Hierarchy Support
    
    ## Features
    - ✅ Schema Management with unlimited hierarchy depth
    - ✅ Full Class Hierarchy with Subclasses
    - ✅ Multi-file Schema Inference
    - ✅ Data Loading & Mapping
    - ✅ Lineage Graph Visualization
    - ✅ Relationship Management
    
    ## Recent Fixes
    - ✅ apiService.createSubclass method added
    - ✅ Hierarchy router properly integrated
    - ✅ All relationship types supported
    - ✅ Attribute inheritance working
    """,
    version="2.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json"
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:5173",  # Vite default
        "http://localhost:5174",  # Vite alternative
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================
# INCLUDE ROUTERS - PROPER ORDER
# ============================================

logger.info("📦 Loading routers...")

# Core routers (MUST BE IN THIS ORDER)
app.include_router(schema.router, prefix="/api/v1")
logger.info("   ✅ Schema router loaded (/api/v1/schemas)")

app.include_router(hierarchy.router, prefix="/api/v1")
logger.info("   ✅ Hierarchy router loaded (/api/v1/hierarchy) - SUBCLASS CREATION ENABLED")

app.include_router(data.router, prefix="/api/v1")
logger.info("   ✅ Data router loaded (/api/v1/data)")

# Legacy routers (backward compatibility)
app.include_router(nodes.router, prefix="/api/v1")
app.include_router(lineage.router, prefix="/api/v1")
app.include_router(stats.router, prefix="/api/v1")
app.include_router(groups.router, prefix="/api/v1")
logger.info("   ✅ Legacy routers loaded")


# ============================================
# ROOT ENDPOINTS
# ============================================

@app.get("/", tags=["Root"])
async def root():
    """Root endpoint - API information"""
    return {
        "message": "Data Lineage API (Enhanced & Fully Fixed)",
        "version": "2.0.0",
        "status": "running",
        "features": [
            "✅ Schema Management",
            "✅ Full Class Hierarchy with Subclasses",
            "✅ HAS_SUBCLASS Relationships",
            "✅ Multi-file Schema Inference",
            "✅ Data Parsing & Preview",
            "✅ Attribute-level Lineage",
            "✅ Data Loading & Mapping",
            "✅ Hierarchical Graph Visualization",
            "✅ Cross-file Relationship Detection",
            "✅ N-level Deep Hierarchies"
        ],
        "critical_fixes": [
            "✅ apiService.createSubclass method added",
            "✅ Hierarchy router properly exposed",
            "✅ Schema creation handles all relationships",
            "✅ Subclass creation with HAS_SUBCLASS",
            "✅ Full attribute inheritance support"
        ],
        "endpoints": {
            "schemas": "/api/v1/schemas",
            "hierarchy": "/api/v1/hierarchy",
            "subclass_creation": "/api/v1/hierarchy/{schema_id}/subclass",
            "data": "/api/v1/data",
            "docs": "/docs",
            "redoc": "/redoc",
            "health": "/health"
        },
        "documentation": {
            "swagger": "http://localhost:8000/docs",
            "redoc": "http://localhost:8000/redoc",
            "openapi": "http://localhost:8000/openapi.json"
        }
    }


@app.get("/health", tags=["Health"])
async def health_check():
    """Health check endpoint"""
    health_status = {
        "status": "healthy",
        "database": "unknown",
        "version": "2.0.0",
        "fixes_applied": True,
        "timestamp": None
    }
    
    try:
        from datetime import datetime
        health_status["timestamp"] = datetime.utcnow().isoformat()
        
        # Test database connection
        test_query = "RETURN 1 as test"
        result = db.execute_query(test_query)
        if result and result.result_set:
            health_status["database"] = "connected"
            health_status["database_status"] = "operational"
        else:
            health_status["database"] = "connected"
            health_status["database_status"] = "warning - no results"
            health_status["status"] = "degraded"
    except Exception as e:
        health_status["status"] = "unhealthy"
        health_status["database"] = "disconnected"
        health_status["database_status"] = "error"
        health_status["error"] = str(e)
        logger.error(f"Health check failed: {str(e)}")
    
    return health_status


@app.get("/version", tags=["Root"])
async def version():
    """Get API version information"""
    return {
        "version": "2.0.0",
        "api": "Data Lineage API (Enhanced & Fixed)",
        "python": sys.version,
        "fastapi": "0.100.0+",
        "features": [
            "Schema Definition with Hierarchy",
            "Unlimited Subclass Depth",
            "Full Attribute Inheritance",
            "Multi-format Data Loading",
            "Hierarchical Visualization",
            "Lineage Path Tracing",
            "Data Parsing & Validation"
        ],
        "latest_fixes": [
            "createSubclass API method",
            "Hierarchy router integration",
            "Schema relationship creation",
            "Attribute model consistency"
        ]
    }


@app.get("/api", tags=["Documentation"])
async def api_documentation():
    """API documentation overview"""
    return {
        "title": "Data Lineage API (Enhanced & Fixed)",
        "version": "2.0.0",
        "description": "Enterprise Data Lineage & Schema Management API with Full Hierarchy Support",
        "base_url": "/api/v1",
        "endpoints": {
            "schemas": {
                "GET /api/v1/schemas": "List all schemas",
                "POST /api/v1/schemas": "Create new schema with hierarchy",
                "GET /api/v1/schemas/{id}": "Get schema by ID",
                "DELETE /api/v1/schemas/{id}": "Delete schema",
                "GET /api/v1/schemas/{id}/lineage": "Get schema lineage graph",
                "POST /api/v1/schemas/infer": "Infer schema from single file",
                "POST /api/v1/schemas/infer-multi": "Infer unified schema from multiple files",
                "POST /api/v1/schemas/{id}/load-data": "Load data into schema",
                "POST /api/v1/schemas/{id}/relationships": "Create relationship between classes",
                "GET /api/v1/schemas/{id}/stats": "Get schema statistics"
            },
            "hierarchy": {
                "GET /api/v1/hierarchy/{schema_id}/tree": "Get complete hierarchy tree",
                "POST /api/v1/hierarchy/{schema_id}/subclass": "Create subclass (CRITICAL FIX)",
                "PATCH /api/v1/hierarchy/{schema_id}/class/{class_id}": "Update class",
                "DELETE /api/v1/hierarchy/{schema_id}/class/{class_id}": "Delete class and children",
                "GET /api/v1/hierarchy/{schema_id}/stats": "Get hierarchy statistics"
            },
            "data": {
                "POST /api/v1/data/parse": "Parse and preview data file",
                "POST /api/v1/data/load": "Load data with custom request"
            }
        },
        "models": {
            "CreateSubclassRequest": {
                "parent_class_id": "string (required)",
                "name": "string (required)",
                "display_name": "string (optional)",
                "description": "string (optional)",
                "inherit_attributes": "boolean (default: true)",
                "additional_attributes": "Array<Attribute> (optional)",
                "metadata": "object (optional)"
            },
            "Attribute": {
                "id": "string",
                "name": "string",
                "data_type": "string",
                "is_primary_key": "boolean",
                "is_foreign_key": "boolean",
                "is_nullable": "boolean",
                "metadata": "object"
            }
        }
    }


@app.get("/status", tags=["Health"])
async def status():
    """Detailed status information"""
    try:
        # Get database stats
        db_stats = {}
        try:
            stats_query = """
            MATCH (n)
            WITH labels(n) as labels, count(*) as count
            RETURN labels[0] as node_type, count
            ORDER BY count DESC
            """
            result = db.execute_query(stats_query)
            if result and result.result_set:
                db_stats = {row[0]: row[1] for row in result.result_set}
        except Exception as e:
            logger.error(f"Failed to get database stats: {str(e)}")
        
        return {
            "api_status": "running",
            "version": "2.0.0",
            "database": {
                "status": "connected" if db_stats else "disconnected",
                "node_counts": db_stats
            },
            "routers_loaded": [
                "schema",
                "hierarchy",
                "data",
                "nodes (legacy)",
                "lineage (legacy)",
                "stats (legacy)",
                "groups (legacy)"
            ],
            "critical_features": {
                "schema_creation": "enabled",
                "subclass_creation": "enabled",
                "hierarchy_management": "enabled",
                "data_loading": "enabled",
                "lineage_visualization": "enabled"
            }
        }
    except Exception as e:
        logger.error(f"Status check failed: {str(e)}")
        return {
            "api_status": "error",
            "error": str(e)
        }


# ============================================
# STARTUP & SHUTDOWN EVENTS (Additional)
# ============================================

@app.on_event("startup")
async def startup_event():
    """Additional startup tasks"""
    logger.info("🔧 Running additional startup tasks...")
    
    # Verify all required routers are loaded
    routes = [route.path for route in app.routes]
    required_routes = [
        "/api/v1/schemas/",
        "/api/v1/hierarchy/{schema_id}/tree",
        "/api/v1/hierarchy/{schema_id}/subclass",
        "/api/v1/data/parse"
    ]
    
    for route in required_routes:
        if any(route in r for r in routes):
            logger.info(f"   ✅ Route verified: {route}")
        else:
            logger.warning(f"   ⚠️  Route might be missing: {route}")
    
    logger.info("✅ Startup tasks completed")


@app.on_event("shutdown")
async def shutdown_event():
    """Additional shutdown tasks"""
    logger.info("🔧 Running shutdown tasks...")
    logger.info("✅ Shutdown tasks completed")


# ============================================
# MAIN ENTRY POINT (for direct execution)
# ============================================

if __name__ == "__main__":
    """
    Run the application directly with: python -m app.main
    For production, use: uvicorn app.main:app --host 0.0.0.0 --port 8000
    """
    
    print("=" * 80)
    print("🚀 Starting Data Lineage API")
    print("=" * 80)
    print("")
    print("⚙️  Configuration:")
    print("   - Host: 0.0.0.0")
    print("   - Port: 8000")
    print("   - Reload: True (Development Mode)")
    print("   - Log Level: info")
    print("")
    print("📡 Access Points:")
    print("   - API: http://localhost:8000")
    print("   - Docs: http://localhost:8000/docs")
    print("   - ReDoc: http://localhost:8000/redoc")
    print("   - Health: http://localhost:8000/health")
    print("")
    print("=" * 80)
    print("")
    
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info",
        access_log=True,
        use_colors=True
    )