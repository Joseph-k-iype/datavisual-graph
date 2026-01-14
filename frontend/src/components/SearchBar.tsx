import { useState, useEffect, useRef } from 'react';
import { Node as FlowNode } from 'reactflow';  // ← Renamed to avoid DOM Node conflict
import { Search, X, Filter, Globe, Database, Tag } from 'lucide-react';
import { NodeType } from '../types';

interface SearchBarProps {
  nodes: FlowNode[];
  onNodeSelect: (node: FlowNode) => void;
  onNodesHighlight: (nodeIds: string[]) => void;
  onClearHighlight: () => void;
}

interface SearchResult {
  node: FlowNode;
  matchField: string;
  matchValue: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  nodes,
  onNodeSelect,
  onNodesHighlight,
  onClearHighlight,
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [filterType, setFilterType] = useState<NodeType | 'all'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Search nodes
  useEffect(() => {
    if (query.trim() === '') {
      setResults([]);
      setIsOpen(false);
      onClearHighlight();
      return;
    }

    const searchQuery = query.toLowerCase();
    const searchResults: SearchResult[] = [];

    nodes.forEach((node) => {
      // Filter by type
      if (filterType !== 'all' && node.data.nodeType !== filterType) {
        return;
      }

      // Search in node properties
      const searchableFields = [
        { key: 'label', value: node.data.label },
        { key: 'id', value: node.id },
        { key: 'name', value: node.data.name },
        { key: 'code', value: node.data.code },
        { key: 'region', value: node.data.region },
        { key: 'type', value: node.data.type },
        { key: 'category', value: node.data.category },
        { key: 'classification', value: node.data.classification },
      ];

      for (const field of searchableFields) {
        if (field.value && String(field.value).toLowerCase().includes(searchQuery)) {
          searchResults.push({
            node,
            matchField: field.key,
            matchValue: String(field.value),
          });
          break;
        }
      }
    });

    setResults(searchResults);
    setIsOpen(searchResults.length > 0);
    setSelectedIndex(0);

    // Highlight matching nodes
    const matchingIds = searchResults.map((r) => r.node.id);
    if (matchingIds.length > 0) {
      onNodesHighlight(matchingIds);
    } else {
      onClearHighlight();
    }
  }, [query, nodes, filterType, onNodesHighlight, onClearHighlight]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // ↓ Fixed: Cast to DOM Node explicitly
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % results.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
        break;
      case 'Enter':
        e.preventDefault();
        if (results[selectedIndex]) {
          handleSelectNode(results[selectedIndex].node);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setQuery('');
        setIsOpen(false);
        inputRef.current?.blur();
        break;
    }
  };

  const handleSelectNode = (node: FlowNode) => {
    onNodeSelect(node);
    setQuery('');
    setIsOpen(false);
    inputRef.current?.blur();
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
    onClearHighlight();
    inputRef.current?.focus();
  };

  const getNodeIcon = (type: NodeType) => {
    switch (type) {
      case 'Country':
        return Globe;
      case 'Database':
        return Database;
      case 'Attribute':
        return Tag;
    }
  };

  const getNodeColor = (type: NodeType) => {
    switch (type) {
      case 'Country':
        return 'text-indigo-600 bg-indigo-50';
      case 'Database':
        return 'text-pink-600 bg-pink-50';
      case 'Attribute':
        return 'text-cyan-600 bg-cyan-50';
    }
  };

  return (
    <div ref={searchRef} className="relative w-full max-w-2xl">
      {/* Search Input */}
      <div className="glass rounded-2xl shadow-lg overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3">
          <Search size={20} className="text-gray-400 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => query && setIsOpen(true)}
            placeholder="Search nodes by name, ID, region, type..."
            className="flex-1 bg-transparent border-none outline-none text-sm text-gray-900 placeholder-gray-400"
          />
          {query && (
            <button
              onClick={handleClear}
              className="text-gray-400 hover:text-gray-600 transition-colors p-1 hover:bg-gray-100 rounded-lg"
            >
              <X size={18} />
            </button>
          )}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2 rounded-lg transition-colors ${
              filterType !== 'all'
                ? 'bg-indigo-100 text-indigo-600'
                : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Filter size={18} />
          </button>
        </div>

        {/* Filter Options */}
        {showFilters && (
          <div className="border-t border-gray-200 px-4 py-3 bg-gray-50">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Filter by Type
            </p>
            <div className="flex gap-2">
              {['all', 'Country', 'Database', 'Attribute'].map((type) => (
                <button
                  key={type}
                  onClick={() => setFilterType(type as NodeType | 'all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    filterType === type
                      ? 'bg-indigo-600 text-white shadow-lg'
                      : 'bg-white text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {type === 'all' ? 'All Types' : type}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Search Results Dropdown */}
      {isOpen && results.length > 0 && (
        <div className="absolute top-full mt-2 w-full glass rounded-2xl shadow-2xl overflow-hidden animate-fade-in z-50 max-h-96 overflow-y-auto custom-scrollbar">
          <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
            <p className="text-xs font-semibold text-gray-500">
              Found {results.length} result{results.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="py-2">
            {results.map((result, index) => {
              const Icon = getNodeIcon(result.node.data.nodeType);
              const colorClass = getNodeColor(result.node.data.nodeType);
              const isSelected = index === selectedIndex;

              return (
                <button
                  key={result.node.id}
                  onClick={() => handleSelectNode(result.node)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`w-full px-4 py-3 flex items-center gap-3 transition-colors ${
                    isSelected ? 'bg-indigo-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className={`p-2 rounded-lg ${colorClass}`}>
                    <Icon size={18} />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-semibold text-gray-900">
                        {result.node.data.label}
                      </p>
                      <span className="px-2 py-0.5 text-xs font-medium text-gray-500 bg-gray-100 rounded-full">
                        {result.node.data.nodeType}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">
                      Match in {result.matchField}: <span className="font-mono">{result.matchValue}</span>
                    </p>
                  </div>
                  {isSelected && (
                    <div className="text-indigo-600">
                      <kbd className="px-2 py-1 text-xs font-semibold bg-indigo-100 rounded">↵</kbd>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* No Results */}
      {isOpen && query && results.length === 0 && (
        <div className="absolute top-full mt-2 w-full glass rounded-2xl shadow-2xl overflow-hidden animate-fade-in z-50">
          <div className="px-4 py-8 text-center">
            <Search size={48} className="mx-auto text-gray-300 mb-3" />
            <p className="text-sm font-semibold text-gray-900 mb-1">No results found</p>
            <p className="text-xs text-gray-500">
              Try adjusting your search or filters
            </p>
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Hint */}
      {isOpen && results.length > 0 && (
        <div className="absolute top-full mt-2 w-full flex justify-end">
          <div className="glass rounded-lg px-3 py-2 text-xs text-gray-500 flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-xs">↑</kbd>
              <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-xs">↓</kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-xs">↵</kbd>
              Select
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-xs">Esc</kbd>
              Close
            </span>
          </div>
        </div>
      )}
    </div>
  );
};