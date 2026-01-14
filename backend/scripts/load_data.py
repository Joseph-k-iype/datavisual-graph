#!/usr/bin/env python3
"""
Script to load lineage data from JSON into FalkorDB
"""

import json
import sys
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from app.database import db
from app.config import settings
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def load_json_data(file_path: str) -> dict:
    """Load JSON data from file"""
    try:
        with open(file_path, 'r') as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Failed to load JSON file: {str(e)}")
        raise


def clear_existing_data():
    """Clear all existing data from the graph"""
    logger.info("Clearing existing data...")
    try:
        db.clear_graph()
        logger.info("Data cleared successfully")
    except Exception as e:
        logger.error(f"Failed to clear data: {str(e)}")
        raise


def create_countries(countries: list):
    """Create country nodes"""
    logger.info(f"Creating {len(countries)} countries...")
    
    for country in countries:
        try:
            query = """
            CREATE (c:Country {
                id: $id,
                name: $name,
                code: $code,
                region: $region,
                dataProtectionRegime: $regime,
                adequacyStatus: $adequacy
            })
            """
            
            db.execute_query(query, {
                "id": country["id"],
                "name": country["name"],
                "code": country["code"],
                "region": country["region"],
                "regime": country["dataProtectionRegime"],
                "adequacy": country["adequacyStatus"]
            })
            
            logger.info(f"  ✓ Created country: {country['name']}")
            
        except Exception as e:
            logger.error(f"Failed to create country {country['name']}: {str(e)}")
            raise


def create_databases(databases: list):
    """Create database nodes and link to countries"""
    logger.info(f"Creating {len(databases)} databases...")
    
    for database in databases:
        try:
            # Create database node
            query = """
            CREATE (d:Database {
                id: $id,
                name: $name,
                type: $type,
                classification: $classification,
                owner: $owner
            })
            """
            
            db.execute_query(query, {
                "id": database["id"],
                "name": database["name"],
                "type": database["type"],
                "classification": database["classification"],
                "owner": database["owner"]
            })
            
            # Link to country
            link_query = """
            MATCH (d:Database {id: $db_id})
            MATCH (c:Country {id: $country_id})
            CREATE (d)-[:LOCATED_IN]->(c)
            """
            
            db.execute_query(link_query, {
                "db_id": database["id"],
                "country_id": database["countryId"]
            })
            
            logger.info(f"  ✓ Created database: {database['name']}")
            
        except Exception as e:
            logger.error(f"Failed to create database {database['name']}: {str(e)}")
            raise


def create_attributes(attributes: list):
    """Create attribute nodes and link to databases"""
    logger.info(f"Creating {len(attributes)} attributes...")
    
    for attribute in attributes:
        try:
            # Create attribute node
            query = """
            CREATE (a:Attribute {
                id: $id,
                name: $name,
                dataType: $dataType,
                category: $category,
                sensitivity: $sensitivity,
                isPII: $isPII
            })
            """
            
            db.execute_query(query, {
                "id": attribute["id"],
                "name": attribute["name"],
                "dataType": attribute["dataType"],
                "category": attribute["category"],
                "sensitivity": attribute["sensitivity"],
                "isPII": attribute["isPII"]
            })
            
            # Link to database
            link_query = """
            MATCH (a:Attribute {id: $attr_id})
            MATCH (d:Database {id: $db_id})
            CREATE (a)-[:BELONGS_TO]->(d)
            """
            
            db.execute_query(link_query, {
                "attr_id": attribute["id"],
                "db_id": attribute["databaseId"]
            })
            
            logger.info(f"  ✓ Created attribute: {attribute['name']}")
            
        except Exception as e:
            logger.error(f"Failed to create attribute {attribute['name']}: {str(e)}")
            raise


def create_transfers(transfers: list):
    """Create transfer relationships"""
    logger.info(f"Creating {len(transfers)} transfers...")
    
    for transfer in transfers:
        try:
            source_type = transfer["sourceType"]
            target_type = transfer["targetType"]
            
            # Build properties
            properties = {
                "id": transfer["id"],
                "dataCategories": transfer["dataCategories"],
                "legalBasis": transfer["legalBasis"]
            }
            
            # Add optional properties
            if "frequency" in transfer:
                properties["frequency"] = transfer["frequency"]
            if "volume" in transfer:
                properties["volume"] = transfer["volume"]
            if "purpose" in transfer:
                properties["purpose"] = transfer["purpose"]
            if "transformationType" in transfer:
                properties["transformationType"] = transfer["transformationType"]
            
            # Create relationship
            query = f"""
            MATCH (source:{source_type} {{id: $source_id}})
            MATCH (target:{target_type} {{id: $target_id}})
            CREATE (source)-[r:TRANSFERS_TO {{
                id: $id,
                dataCategories: $dataCategories,
                legalBasis: $legalBasis,
                frequency: $frequency,
                volume: $volume,
                purpose: $purpose,
                transformationType: $transformationType
            }}]->(target)
            """
            
            db.execute_query(query, {
                "source_id": transfer["sourceId"],
                "target_id": transfer["targetId"],
                "id": properties["id"],
                "dataCategories": properties["dataCategories"],
                "legalBasis": properties["legalBasis"],
                "frequency": properties.get("frequency"),
                "volume": properties.get("volume"),
                "purpose": properties.get("purpose"),
                "transformationType": properties.get("transformationType")
            })
            
            logger.info(f"  ✓ Created transfer: {transfer['id']}")
            
        except Exception as e:
            logger.error(f"Failed to create transfer {transfer['id']}: {str(e)}")
            raise


def main():
    """Main function"""
    try:
        # Connect to database
        logger.info("=" * 60)
        logger.info("Data Lineage Dashboard - Data Loader")
        logger.info("=" * 60)
        logger.info("")
        logger.info("Connecting to FalkorDB...")
        db.connect()
        
        # Load JSON data
        data_file = Path(__file__).parent.parent / "data" / "lineage_data.json"
        logger.info(f"Loading data from {data_file}...")
        data = load_json_data(str(data_file))
        
        # Clear existing data
        clear_existing_data()
        
        # Load data in order
        create_countries(data["countries"])
        create_databases(data["databases"])
        create_attributes(data["attributes"])
        create_transfers(data["transfers"])
        
        # Verify data
        logger.info("")
        logger.info("=" * 60)
        logger.info("Verifying loaded data...")
        logger.info("=" * 60)
        stats_query = """
        MATCH (c:Country)
        WITH count(c) as countries
        MATCH (d:Database)
        WITH countries, count(d) as databases
        MATCH (a:Attribute)
        WITH countries, databases, count(a) as attributes
        MATCH ()-[r:TRANSFERS_TO]->()
        RETURN countries, databases, attributes, count(r) as transfers
        """
        
        result = db.execute_query(stats_query)
        if result.result_set:
            row = result.result_set[0]
            logger.info(f"  Countries: {row[0]}")
            logger.info(f"  Databases: {row[1]}")
            logger.info(f"  Attributes: {row[2]}")
            logger.info(f"  Transfers: {row[3]}")
        
        logger.info("")
        logger.info("=" * 60)
        logger.info("✓ Data loaded successfully!")
        logger.info("=" * 60)
        logger.info("")
        logger.info("You can now access the dashboard at:")
        logger.info("  Frontend: http://localhost:3000")
        logger.info("  Backend:  http://localhost:8000")
        logger.info("  API Docs: http://localhost:8000/docs")
        logger.info("")
        
    except Exception as e:
        logger.error("")
        logger.error("=" * 60)
        logger.error(f"✗ Failed to load data: {str(e)}")
        logger.error("=" * 60)
        logger.error("")
        sys.exit(1)


if __name__ == "__main__":
    main()