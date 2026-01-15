# backend/app/database.py
"""
FalkorDB Database Connection
"""

import os
import logging
from typing import Optional
from falkordb import FalkorDB

logger = logging.getLogger(__name__)


class Database:
    """FalkorDB database connection manager"""
    
    def __init__(self):
        self.client: Optional[FalkorDB] = None
        self.graph = None
        self.host = os.getenv('REDIS_HOST', 'localhost')
        self.port = int(os.getenv('REDIS_PORT', 6379))
        self.graph_name = os.getenv('GRAPH_NAME', 'lineage')
        
    def connect(self):
        """Establish connection to FalkorDB"""
        try:
            logger.info(f"Connecting to FalkorDB at {self.host}:{self.port}")
            self.client = FalkorDB(host=self.host, port=self.port)
            self.graph = self.client.select_graph(self.graph_name)
            logger.info(f"Successfully connected to graph: {self.graph_name}")
        except Exception as e:
            logger.error(f"Failed to connect to FalkorDB: {str(e)}")
            raise
    
    def disconnect(self):
        """Close connection to FalkorDB"""
        try:
            if self.client:
                # FalkorDB client doesn't have explicit close, but we can clear references
                self.graph = None
                self.client = None
                logger.info("Disconnected from FalkorDB")
        except Exception as e:
            logger.error(f"Error disconnecting from FalkorDB: {str(e)}")
    
    def execute_query(self, query: str, params: dict = None):
        """
        Execute a Cypher query
        
        Args:
            query: Cypher query string
            params: Optional parameters for the query
            
        Returns:
            Query result
        """
        if not self.graph:
            raise RuntimeError("Database not connected")
        
        try:
            if params:
                result = self.graph.query(query, params)
            else:
                result = self.graph.query(query)
            return result
        except Exception as e:
            logger.error(f"Query execution failed: {str(e)}")
            logger.error(f"Query: {query}")
            if params:
                logger.error(f"Params: {params}")
            raise
    
    def execute_read_query(self, query: str, params: dict = None):
        """Execute a read-only query (alias for execute_query)"""
        return self.execute_query(query, params)
    
    def execute_write_query(self, query: str, params: dict = None):
        """Execute a write query (alias for execute_query)"""
        return self.execute_query(query, params)
    
    def clear_graph(self):
        """Clear all data from the graph (use with caution!)"""
        if not self.graph:
            raise RuntimeError("Database not connected")
        
        try:
            logger.warning("Clearing all data from graph")
            self.graph.query("MATCH (n) DETACH DELETE n")
            logger.info("Graph cleared successfully")
        except Exception as e:
            logger.error(f"Failed to clear graph: {str(e)}")
            raise
    
    def get_stats(self):
        """Get database statistics"""
        if not self.graph:
            raise RuntimeError("Database not connected")
        
        try:
            result = self.graph.query("MATCH (n) RETURN count(n) as node_count")
            node_count = result.result_set[0][0] if result.result_set else 0
            
            result = self.graph.query("MATCH ()-[r]->() RETURN count(r) as edge_count")
            edge_count = result.result_set[0][0] if result.result_set else 0
            
            return {
                'node_count': node_count,
                'edge_count': edge_count,
                'graph_name': self.graph_name
            }
        except Exception as e:
            logger.error(f"Failed to get stats: {str(e)}")
            return {
                'node_count': 0,
                'edge_count': 0,
                'graph_name': self.graph_name,
                'error': str(e)
            }


# Global database instance
db = Database()