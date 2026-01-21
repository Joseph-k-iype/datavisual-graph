// frontend/src/components/data/FileUploader.tsx - FIXED ALL ISSUES
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
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
} from '@mui/material';
import {
  CloudUpload,
  InsertDriveFile,
  Close,
  CheckCircle,
  Delete,
} from '@mui/icons-material';

export type FileFormat = 'csv' | 'excel' | 'json' | 'xml';

interface FileUploaderProps {
  onFileSelect: (files: File[], formats: FileFormat[]) => void;
  acceptedFormats?: FileFormat[];
  maxSizeMB?: number;
  multiFile?: boolean;
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

interface SelectedFile {
  file: File;
  format: FileFormat;
}

export const FileUploader: React.FC<FileUploaderProps> = ({
  onFileSelect,
  acceptedFormats = ['csv', 'excel', 'json', 'xml'],
  maxSizeMB = 10,
  multiFile = true,
}) => {
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
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

  const validateFile = useCallback(
    (file: File): { valid: boolean; format?: FileFormat; error?: string } => {
      const sizeMB = file.size / (1024 * 1024);
      if (sizeMB > maxSizeMB) {
        return {
          valid: false,
          error: `File size (${sizeMB.toFixed(2)}MB) exceeds maximum (${maxSizeMB}MB)`,
        };
      }

      const format = detectFormat(file.name);
      if (!format) {
        return {
          valid: false,
          error: `Unsupported file format. Accepted formats: ${acceptedFormats.join(', ')}`,
        };
      }

      return { valid: true, format };
    },
    [maxSizeMB, detectFormat, acceptedFormats]
  );

  const handleFilesSelected = useCallback(
    (files: FileList) => {
      setError(null);
      const newFiles: SelectedFile[] = [];
      const errors: string[] = [];

      Array.from(files).forEach((file) => {
        const validation = validateFile(file);
        if (validation.valid && validation.format) {
          const isDuplicate = selectedFiles.some((sf) => sf.file.name === file.name);
          if (!isDuplicate) {
            newFiles.push({ file, format: validation.format });
          }
        } else if (validation.error) {
          errors.push(`${file.name}: ${validation.error}`);
        }
      });

      if (errors.length > 0) {
        setError(errors.join('; '));
      }

      if (newFiles.length > 0) {
        if (multiFile) {
          setSelectedFiles([...selectedFiles, ...newFiles]);
        } else {
          setSelectedFiles([newFiles[0]]);
        }
      }
    },
    [validateFile, multiFile, selectedFiles]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        handleFilesSelected(files);
      }
      // Reset input so same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [handleFilesSelected]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragActive(false);

      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        handleFilesSelected(files);
      }
    },
    [handleFilesSelected]
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

  // FIXED: Prevent double-click by stopping propagation on button
  const handleBrowseClick = useCallback((e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    fileInputRef.current?.click();
  }, []);

  // FIXED: Separate handler for Paper click to avoid double trigger
  const handlePaperClick = useCallback(() => {
    // Only open file picker if no files selected yet
    if (selectedFiles.length === 0) {
      fileInputRef.current?.click();
    }
  }, [selectedFiles.length]);

  const handleUpload = useCallback(async () => {
    if (selectedFiles.length === 0) return;

    setUploading(true);
    setError(null);

    try {
      const files = selectedFiles.map((sf) => sf.file);
      const formats = selectedFiles.map((sf) => sf.format);
      await onFileSelect(files, formats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }, [selectedFiles, onFileSelect]);

  const handleRemoveFile = useCallback((index: number) => {
    setSelectedFiles(selectedFiles.filter((_, i) => i !== index));
    setError(null);
  }, [selectedFiles]);

  const handleClearAll = useCallback(() => {
    setSelectedFiles([]);
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
    .flatMap((format) => FORMAT_EXTENSIONS[format])
    .join(',');

  const totalSize = selectedFiles.reduce((sum, sf) => sum + sf.file.size, 0);

  return (
    <Box>
      {/* Hidden file input - FIXED: Added multiple attribute properly */}
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptString}
        onChange={handleFileInput}
        multiple={multiFile}
        style={{ display: 'none' }}
      />

      {/* Drop Zone - FIXED: Only clickable if no files selected */}
      <Paper
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handlePaperClick}
        sx={{
          p: 4,
          textAlign: 'center',
          border: 2,
          borderStyle: 'dashed',
          borderColor: isDragActive ? 'primary.main' : 'divider',
          bgcolor: isDragActive ? 'action.hover' : 'background.paper',
          cursor: selectedFiles.length === 0 ? 'pointer' : 'default',
          transition: 'all 0.2s',
          '&:hover': {
            borderColor: selectedFiles.length === 0 ? 'primary.main' : 'divider',
            bgcolor: selectedFiles.length === 0 ? 'action.hover' : 'background.paper',
          },
        }}
      >
        <CloudUpload
          sx={{
            fontSize: 64,
            color: isDragActive ? 'primary.main' : 'text.secondary',
            mb: 2,
          }}
        />
        <Typography variant="h6" gutterBottom>
          {isDragActive 
            ? 'Drop files here' 
            : multiFile 
            ? 'Drag & drop multiple files here' 
            : 'Drag & drop file here'}
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          or
        </Typography>
        {/* FIXED: Button with stopPropagation to prevent double click */}
        <Button 
          variant="contained" 
          sx={{ mt: 2 }} 
          onClick={handleBrowseClick}
        >
          {selectedFiles.length > 0 && multiFile ? 'Add More Files' : 'Browse Files'}
        </Button>
        {multiFile && (
          <Typography variant="body2" color="primary" sx={{ mt: 2, fontWeight: 600 }}>
            ✨ Select multiple files (Cmd+Click or Ctrl+Click)
          </Typography>
        )}
        <Stack direction="row" spacing={1} justifyContent="center" mt={3} flexWrap="wrap">
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
          Maximum file size: {maxSizeMB}MB per file
        </Typography>
      </Paper>

      {/* Selected Files List */}
      {selectedFiles.length > 0 && (
        <Paper sx={{ mt: 3 }}>
          <Box sx={{ p: 2, bgcolor: 'primary.main', color: 'primary.contrastText' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="h6">
                {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''} selected
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="body2">
                  Total: {formatFileSize(totalSize)}
                </Typography>
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClearAll();
                  }}
                  sx={{ color: 'inherit' }}
                >
                  <Delete />
                </IconButton>
              </Stack>
            </Stack>
          </Box>

          <List sx={{ maxHeight: 300, overflow: 'auto' }}>
            {selectedFiles.map((sf, index) => (
              <React.Fragment key={`${sf.file.name}-${index}`}>
                <ListItem>
                  <Box sx={{ mr: 2 }}>
                    <InsertDriveFile color="primary" />
                  </Box>
                  <ListItemText
                    primary={sf.file.name}
                    secondary={`${FORMAT_LABELS[sf.format]} • ${formatFileSize(sf.file.size)}`}
                  />
                  <ListItemSecondaryAction>
                    <IconButton
                      edge="end"
                      onClick={() => handleRemoveFile(index)}
                      disabled={uploading}
                      size="small"
                    >
                      <Close />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
                {index < selectedFiles.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>

          {uploading && (
            <Box sx={{ p: 2 }}>
              <LinearProgress />
              <Typography variant="caption" color="text.secondary" mt={1}>
                {multiFile 
                  ? 'Analyzing files and inferring unified schema...' 
                  : 'Processing file...'}
              </Typography>
            </Box>
          )}

          {!uploading && (
            <Box sx={{ p: 2 }}>
              <Button
                variant="contained"
                startIcon={<CheckCircle />}
                onClick={handleUpload}
                fullWidth
                size="large"
              >
                {multiFile 
                  ? `Infer Schema from ${selectedFiles.length} File${selectedFiles.length > 1 ? 's' : ''}` 
                  : 'Continue with this file'}
              </Button>
            </Box>
          )}
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