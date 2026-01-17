# backend/app/utils/parsers.py

"""
File Parsers - Parse different file formats (CSV, Excel, JSON, XML)
"""

import pandas as pd
import json
import xml.etree.ElementTree as ET
from typing import List, Dict, Any, Tuple
from io import BytesIO, StringIO
import logging

logger = logging.getLogger(__name__)


class FileParser:
    """Base file parser"""
    
    @staticmethod
    def parse_csv(file_content: bytes, filename: str) -> Tuple[List[Dict[str, Any]], List[str]]:
        """
        Parse CSV file
        
        Returns:
            Tuple of (data rows, column names)
        """
        try:
            # Try to decode as UTF-8
            try:
                content_str = file_content.decode('utf-8')
            except UnicodeDecodeError:
                # Fallback to latin-1
                content_str = file_content.decode('latin-1')
            
            # Parse CSV
            df = pd.read_csv(StringIO(content_str))
            
            # Convert to records
            data = df.to_dict('records')
            columns = df.columns.tolist()
            
            # Clean column names (strip whitespace)
            columns = [col.strip() for col in columns]
            
            logger.info(f"✅ Parsed CSV: {len(data)} rows, {len(columns)} columns")
            return data, columns
            
        except Exception as e:
            logger.error(f"❌ Failed to parse CSV: {str(e)}")
            raise ValueError(f"Failed to parse CSV file: {str(e)}")
    
    @staticmethod
    def parse_excel(file_content: bytes, filename: str) -> Tuple[List[Dict[str, Any]], List[str]]:
        """
        Parse Excel file (.xlsx, .xls)
        
        Returns:
            Tuple of (data rows, column names)
        """
        try:
            # Read Excel file
            df = pd.read_excel(BytesIO(file_content), engine='openpyxl')
            
            # Convert to records
            data = df.to_dict('records')
            columns = df.columns.tolist()
            
            # Clean column names
            columns = [str(col).strip() for col in columns]
            
            logger.info(f"✅ Parsed Excel: {len(data)} rows, {len(columns)} columns")
            return data, columns
            
        except Exception as e:
            logger.error(f"❌ Failed to parse Excel: {str(e)}")
            raise ValueError(f"Failed to parse Excel file: {str(e)}")
    
    @staticmethod
    def parse_json(file_content: bytes, filename: str) -> Tuple[List[Dict[str, Any]], List[str]]:
        """
        Parse JSON file
        
        Supports:
        - Array of objects: [{"col1": "val1"}, {"col1": "val2"}]
        - Object with array: {"data": [{"col1": "val1"}]}
        
        Returns:
            Tuple of (data rows, column names)
        """
        try:
            # Decode JSON
            content_str = file_content.decode('utf-8')
            parsed = json.loads(content_str)
            
            # Handle different JSON structures
            if isinstance(parsed, list):
                # Array of objects
                data = parsed
            elif isinstance(parsed, dict):
                # Object - find the array
                if 'data' in parsed and isinstance(parsed['data'], list):
                    data = parsed['data']
                elif 'records' in parsed and isinstance(parsed['records'], list):
                    data = parsed['records']
                elif 'rows' in parsed and isinstance(parsed['rows'], list):
                    data = parsed['rows']
                else:
                    # Use first list value found
                    for key, value in parsed.items():
                        if isinstance(value, list):
                            data = value
                            break
                    else:
                        raise ValueError("Could not find array of records in JSON")
            else:
                raise ValueError("JSON must be array or object containing array")
            
            # Extract columns from first row
            if data and len(data) > 0:
                columns = list(data[0].keys())
            else:
                columns = []
            
            logger.info(f"✅ Parsed JSON: {len(data)} rows, {len(columns)} columns")
            return data, columns
            
        except json.JSONDecodeError as e:
            logger.error(f"❌ Failed to parse JSON: {str(e)}")
            raise ValueError(f"Invalid JSON format: {str(e)}")
        except Exception as e:
            logger.error(f"❌ Failed to parse JSON: {str(e)}")
            raise ValueError(f"Failed to parse JSON file: {str(e)}")
    
    @staticmethod
    def parse_xml(file_content: bytes, filename: str) -> Tuple[List[Dict[str, Any]], List[str]]:
        """
        Parse XML file
        
        Expects structure like:
        <root>
          <record>
            <col1>val1</col1>
            <col2>val2</col2>
          </record>
        </root>
        
        Returns:
            Tuple of (data rows, column names)
        """
        try:
            # Parse XML
            content_str = file_content.decode('utf-8')
            root = ET.fromstring(content_str)
            
            # Find all record elements (assuming first level children are records)
            records = []
            columns_set = set()
            
            for child in root:
                record = {}
                for elem in child:
                    # Use element tag as column name, text as value
                    col_name = elem.tag
                    value = elem.text
                    
                    # Try to parse as JSON if it looks like JSON
                    if value and (value.startswith('{') or value.startswith('[')):
                        try:
                            value = json.loads(value)
                        except:
                            pass
                    
                    record[col_name] = value
                    columns_set.add(col_name)
                
                if record:
                    records.append(record)
            
            columns = sorted(list(columns_set))
            
            logger.info(f"✅ Parsed XML: {len(records)} rows, {len(columns)} columns")
            return records, columns
            
        except ET.ParseError as e:
            logger.error(f"❌ Failed to parse XML: {str(e)}")
            raise ValueError(f"Invalid XML format: {str(e)}")
        except Exception as e:
            logger.error(f"❌ Failed to parse XML: {str(e)}")
            raise ValueError(f"Failed to parse XML file: {str(e)}")
    
    @staticmethod
    def parse_file(
        file_content: bytes,
        filename: str,
        file_format: str
    ) -> Tuple[List[Dict[str, Any]], List[str]]:
        """
        Parse file based on format
        
        Args:
            file_content: File content as bytes
            filename: Original filename
            file_format: Format (csv, excel, json, xml)
        
        Returns:
            Tuple of (data rows, column names)
        """
        format_lower = file_format.lower()
        
        if format_lower == 'csv':
            return FileParser.parse_csv(file_content, filename)
        elif format_lower in ['excel', 'xlsx', 'xls']:
            return FileParser.parse_excel(file_content, filename)
        elif format_lower == 'json':
            return FileParser.parse_json(file_content, filename)
        elif format_lower == 'xml':
            return FileParser.parse_xml(file_content, filename)
        else:
            raise ValueError(f"Unsupported file format: {file_format}")
    
    @staticmethod
    def get_data_preview(
        data: List[Dict[str, Any]],
        max_rows: int = 10
    ) -> List[Dict[str, Any]]:
        """Get preview of data (first N rows)"""
        return data[:max_rows]
    
    @staticmethod
    def infer_data_types(
        data: List[Dict[str, Any]],
        columns: List[str]
    ) -> Dict[str, str]:
        """
        Infer data types for each column
        
        Returns:
            Dict of {column_name: data_type}
        """
        type_map = {}
        
        for col in columns:
            # Get sample values (non-null)
            sample_values = [row.get(col) for row in data if row.get(col) is not None]
            
            if not sample_values:
                type_map[col] = 'string'
                continue
            
            # Check type of first non-null value
            sample = sample_values[0]
            
            if isinstance(sample, bool):
                type_map[col] = 'boolean'
            elif isinstance(sample, int):
                type_map[col] = 'number'
            elif isinstance(sample, float):
                type_map[col] = 'number'
            elif isinstance(sample, (list, dict)):
                type_map[col] = 'json'
            else:
                # Default to string
                type_map[col] = 'string'
        
        return type_map
    
    @staticmethod
    def validate_data_quality(
        data: List[Dict[str, Any]],
        columns: List[str]
    ) -> Dict[str, Any]:
        """
        Check data quality metrics
        
        Returns:
            Dict with quality metrics
        """
        total_rows = len(data)
        
        if total_rows == 0:
            return {
                'total_rows': 0,
                'completeness': 0,
                'warnings': ['No data rows found']
            }
        
        # Count nulls per column
        null_counts = {col: 0 for col in columns}
        for row in data:
            for col in columns:
                if row.get(col) is None or row.get(col) == '':
                    null_counts[col] += 1
        
        # Calculate completeness per column
        completeness = {
            col: (1 - null_counts[col] / total_rows) * 100
            for col in columns
        }
        
        # Overall completeness
        avg_completeness = sum(completeness.values()) / len(completeness) if completeness else 0
        
        # Warnings
        warnings = []
        for col, comp in completeness.items():
            if comp < 50:
                warnings.append(f"Column '{col}' has {100-comp:.1f}% missing values")
        
        return {
            'total_rows': total_rows,
            'completeness_per_column': completeness,
            'overall_completeness': avg_completeness,
            'null_counts': null_counts,
            'warnings': warnings
        }