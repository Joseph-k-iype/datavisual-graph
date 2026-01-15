from fastapi import APIRouter, HTTPException, status
from ..models.schemas import StatsResponse
from ..database import db
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("/", response_model=StatsResponse, status_code=status.HTTP_200_OK)
async def get_stats():
    """Get overall statistics about the graph"""
    try:
        # Count countries
        country_query = """
        MATCH (c:Country)
        RETURN count(c) as count
        """
        country_result = db.execute_query(country_query)
        total_countries = country_result.result_set[0][0] if country_result.result_set else 0
        
        # Count databases
        database_query = """
        MATCH (d:Database)
        RETURN count(d) as count
        """
        database_result = db.execute_query(database_query)
        total_databases = database_result.result_set[0][0] if database_result.result_set else 0
        
        # Count attributes
        attribute_query = """
        MATCH (a:Attribute)
        RETURN count(a) as count
        """
        attribute_result = db.execute_query(attribute_query)
        total_attributes = attribute_result.result_set[0][0] if attribute_result.result_set else 0
        
        # Count transfers (relationships)
        transfer_query = """
        MATCH ()-[r:TRANSFERS_TO]->()
        RETURN count(r) as count
        """
        transfer_result = db.execute_query(transfer_query)
        total_transfers = transfer_result.result_set[0][0] if transfer_result.result_set else 0
        
        # Get unique data categories from transfers
        categories_query = """
        MATCH ()-[r:TRANSFERS_TO]->()
        WHERE r.dataCategories IS NOT NULL
        RETURN DISTINCT r.dataCategories as categories
        """
        categories_result = db.execute_query(categories_query)
        
        data_categories = set()
        if categories_result.result_set:
            for row in categories_result.result_set:
                if row[0]:
                    # dataCategories is a list
                    if isinstance(row[0], list):
                        data_categories.update(row[0])
                    else:
                        data_categories.add(row[0])
        
        # Get unique regions from countries
        regions_query = """
        MATCH (c:Country)
        WHERE c.region IS NOT NULL
        RETURN DISTINCT c.region as region
        """
        regions_result = db.execute_query(regions_query)
        
        regions = []
        if regions_result.result_set:
            regions = [row[0] for row in regions_result.result_set if row[0]]
        
        return StatsResponse(
            totalCountries=total_countries,
            totalDatabases=total_databases,
            totalAttributes=total_attributes,
            totalTransfers=total_transfers,
            dataCategories=sorted(list(data_categories)),
            regions=sorted(regions)
        )
        
    except Exception as e:
        logger.error(f"Failed to get statistics: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get statistics: {str(e)}"
        )