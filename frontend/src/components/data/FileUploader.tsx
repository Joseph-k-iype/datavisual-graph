// frontend/src/components/data/FileUploader.tsx - FIXED (no react-dropzone)

import React, { useCallback, useState, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Stack,
  Alert,
  LinearProgress,
  Chip,
  IconButton,
} from '@mui/material';
import {
  CloudUpload,
  InsertDriveFile,
  Close,
  CheckCircle,
} from '@mui/icons-material';

export type FileFormat = 'csv' | 'excel' | 'json' | 'xml';

interface FileUploaderProps {
  onFileSelect: (file: File, format: FileFormat) => void;
  acceptedFormats?: FileFormat[];
  maxSizeMB?: number;
}

const FORMAT_EXTENSIONS: Record<FileFormat, string[]> = {
  csv: ['.csv'],
  excel: ['.xlsx', '.xls'],
  json: ['.json'],
  xml: ['.xml'],
};

const FORMAT_LABELS: Record<FileFormat, string> = {
  csv: 'CSV',
  excel: 'Excel',
  json: 'JSON',
  xml: 'XML',
};

export const FileUploader: React.FC<FileUploaderProps> = ({
  onFileSelect,
  acceptedFormats = ['csv', 'excel', 'json', 'xml'],
  maxSizeMB = 10,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const detectFormat = useCallback((filename: string): FileFormat | null => {
    const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    
    for (const format of acceptedFormats) {
      if (FORMAT_EXTENSIONS[format].includes(ext)) {
        return format;
      }
    }
    
    return null;
  }, [acceptedFormats]);

  const validateAndSelectFile = useCallback(
    (file: File) => {
      setError(null);

      // Check file size
      const sizeMB = file.size / (1024 * 1024);
      if (sizeMB > maxSizeMB) {
        setError(`File size (${sizeMB.toFixed(2)}MB) exceeds maximum (${maxSizeMB}MB)`);
        return;
      }

      // Detect format
      const format = detectFormat(file.name);
      if (!format) {
        setError(`Unsupported file format. Accepted formats: ${acceptedFormats.join(', ')}`);
        return;
      }

      setSelectedFile(file);
    },
    [maxSizeMB, detectFormat, acceptedFormats]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        validateAndSelectFile(files[0]);
      }
    },
    [validateAndSelectFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragActive(false);

      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        validateAndSelectFile(files[0]);
      }
    },
    [validateAndSelectFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  }, []);

  const handleBrowseClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleUpload = useCallback(async () => {
    if (!selectedFile) return;

    setUploading(true);
    setError(null);

    try {
      const format = detectFormat(selectedFile.name);
      if (!format) {
        throw new Error('Could not detect file format');
      }

      await onFileSelect(selectedFile, format);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }, [selectedFile, detectFormat, onFileSelect]);

  const handleRemove = useCallback(() => {
    setSelectedFile(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const acceptString = acceptedFormats
    .flatMap(format => FORMAT_EXTENSIONS[format])
    .join(',');

  return (
    <Box>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptString}
        onChange={handleFileInput}
        style={{ display: 'none' }}
      />

      {/* Drop Zone */}
      {!selectedFile && (
        <Paper
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          sx={{
            p: 4,
            textAlign: 'center',
            border: 2,
            borderStyle: 'dashed',
            borderColor: isDragActive ? 'primary.main' : 'divider',
            bgcolor: isDragActive ? 'action.hover' : 'background.paper',
            cursor: 'pointer',
            transition: 'all 0.2s',
            '&:hover': {
              borderColor: 'primary.main',
              bgcolor: 'action.hover',
            },
          }}
          onClick={handleBrowseClick}
        >
          <CloudUpload
            sx={{
              fontSize: 64,
              color: isDragActive ? 'primary.main' : 'text.secondary',
              mb: 2,
            }}
          />
          <Typography variant="h6" gutterBottom>
            {isDragActive ? 'Drop file here' : 'Drag & drop file here'}
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            or
          </Typography>
          <Button variant="contained" sx={{ mt: 2 }} onClick={handleBrowseClick}>
            Browse Files
          </Button>
          <Stack direction="row" spacing={1} justifyContent="center" mt={3}>
            {acceptedFormats.map((format) => (
              <Chip
                key={format}
                label={FORMAT_LABELS[format]}
                size="small"
                variant="outlined"
              />
            ))}
          </Stack>
          <Typography variant="caption" color="text.secondary" mt={2} display="block">
            Maximum file size: {maxSizeMB}MB
          </Typography>
        </Paper>
      )}

      {/* Selected File */}
      {selectedFile && (
        <Paper sx={{ p: 3 }}>
          <Stack spacing={2}>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Box display="flex" alignItems="center" gap={2}>
                <InsertDriveFile color="primary" sx={{ fontSize: 40 }} />
                <Box>
                  <Typography variant="subtitle1" fontWeight={600}>
                    {selectedFile.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatFileSize(selectedFile.size)}
                  </Typography>
                </Box>
              </Box>
              <IconButton onClick={handleRemove} size="small" disabled={uploading}>
                <Close />
              </IconButton>
            </Box>

            {uploading && (
              <Box>
                <LinearProgress />
                <Typography variant="caption" color="text.secondary" mt={1}>
                  Processing file...
                </Typography>
              </Box>
            )}

            {!uploading && (
              <Button
                variant="contained"
                startIcon={<CheckCircle />}
                onClick={handleUpload}
                fullWidth
              >
                Continue with this file
              </Button>
            )}
          </Stack>
        </Paper>
      )}

      {/* Error Message */}
      {error && (
        <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
    </Box>
  );
};