from falkordb import FalkorDB
from typing import Optional
from .config import settings
import logging

logger = logging.getLogger(__name__)


class GraphDatabase:
    """FalkorDB Graph Database Manager"""
    
    def __init__(self):
        self._client: Optional[FalkorDB] = None
        self._graph = None
    
    def connect(self):
        """Establish connection to FalkorDB"""
        try:
            self._client = FalkorDB(
                host=settings.FALKORDB_HOST,
                port=settings.FALKORDB_PORT,
                password=settings.FALKORDB_PASSWORD if settings.FALKORDB_PASSWORD else None
            )
            self._graph = self._client.select_graph(settings.FALKORDB_GRAPH_NAME)
            logger.info(f"Connected to FalkorDB: {settings.FALKORDB_HOST}:{settings.FALKORDB_PORT}")
            
            # Create indexes for better performance
            self._create_indexes()
            
        except Exception as e:
            logger.error(f"Failed to connect to FalkorDB: {str(e)}")
            raise
    
    def _create_indexes(self):
        """Create indexes on frequently queried properties"""
        try:
            indexes = [
                "CREATE INDEX FOR (n:Country) ON (n.id)",
                "CREATE INDEX FOR (n:Database) ON (n.id)",
                "CREATE INDEX FOR (n:Attribute) ON (n.id)",
                "CREATE INDEX FOR (n:Country) ON (n.code)",
                "CREATE INDEX FOR (n:Database) ON (n.name)",
            ]
            
            for idx in indexes:
                try:
                    self._graph.query(idx)
                except Exception:
                    # Index might already exist
                    pass
                    
        except Exception as e:
            logger.warning(f"Failed to create indexes: {str(e)}")
    
    def disconnect(self):
        """Close connection to FalkorDB"""
        if self._client:
            try:
                # FalkorDB client doesn't have a close method
                # The connection will be closed when the object is garbage collected
                # Just set references to None
                self._graph = None
                self._client = None
                logger.info("Disconnected from FalkorDB")
            except Exception as e:
                logger.warning(f"Error during disconnect: {str(e)}")
    
    @property
    def graph(self):
        """Get graph instance"""
        if not self._graph:
            self.connect()
        return self._graph
    
    def execute_query(self, query: str, params: dict = None):
        """Execute a Cypher query"""
        try:
            result = self.graph.query(query, params or {})
            return result
        except Exception as e:
            logger.error(f"Query execution failed: {str(e)}")
            logger.error(f"Query: {query}")
            raise
    
    def clear_graph(self):
        """Clear all data from the graph"""
        try:
            self.execute_query("MATCH (n) DETACH DELETE n")
            logger.info("Graph cleared successfully")
        except Exception as e:
            logger.error(f"Failed to clear graph: {str(e)}")
            raise


# Global database instance
db = GraphDatabase()