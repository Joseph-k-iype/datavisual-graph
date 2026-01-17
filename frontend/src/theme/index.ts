// frontend/src/theme/index.ts - FIXED VERSION

import { createTheme, ThemeOptions } from '@mui/material/styles';

// Custom color palette for data lineage
declare module '@mui/material/styles' {
  interface Palette {
    lineage: {
      source: string;
      target: string;
      intermediate: string;
      transformation: string;
      selected: string;
      highlighted: string;
      error: string;
    };
    hierarchy: {
      level0: string;
      level1: string;
      level2: string;
      level3: string;
      level4: string;
    };
    attribute: {
      primary_key: string;
      foreign_key: string;
      regular: string;
      calculated: string;
    };
  }
  interface PaletteOptions {
    lineage?: {
      source?: string;
      target?: string;
      intermediate?: string;
      transformation?: string;
      selected?: string;
      highlighted?: string;
      error?: string;
    };
    hierarchy?: {
      level0?: string;
      level1?: string;
      level2?: string;
      level3?: string;
      level4?: string;
    };
    attribute?: {
      primary_key?: string;
      foreign_key?: string;
      regular?: string;
      calculated?: string;
    };
  }
}

const themeOptions: ThemeOptions = {
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
      light: '#42a5f5',
      dark: '#1565c0',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#9c27b0',
      light: '#ba68c8',
      dark: '#7b1fa2',
      contrastText: '#ffffff',
    },
    success: {
      main: '#2e7d32',
      light: '#4caf50',
      dark: '#1b5e20',
    },
    warning: {
      main: '#ed6c02',
      light: '#ff9800',
      dark: '#e65100',
    },
    error: {
      main: '#d32f2f',
      light: '#ef5350',
      dark: '#c62828',
    },
    info: {
      main: '#0288d1',
      light: '#03a9f4',
      dark: '#01579b',
    },
    // Custom lineage colors
    lineage: {
      source: '#4caf50',
      target: '#f44336',
      intermediate: '#ff9800',
      transformation: '#9c27b0',
      selected: '#2196f3',
      highlighted: '#ffc107',
      error: '#ef5350',
    },
    hierarchy: {
      level0: '#1976d2',
      level1: '#42a5f5',
      level2: '#64b5f6',
      level3: '#90caf9',
      level4: '#bbdefb',
    },
    attribute: {
      primary_key: '#f57c00',
      foreign_key: '#7b1fa2',
      regular: '#616161',
      calculated: '#0288d1',
    },
    background: {
      default: '#f5f5f5',
      paper: '#ffffff',
    },
    text: {
      primary: 'rgba(0, 0, 0, 0.87)',
      secondary: 'rgba(0, 0, 0, 0.6)',
      disabled: 'rgba(0, 0, 0, 0.38)',
    },
    divider: 'rgba(0, 0, 0, 0.12)',
  },
  
  typography: {
    fontFamily: [
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
    ].join(','),
    h1: {
      fontSize: '2.5rem',
      fontWeight: 600,
      lineHeight: 1.2,
    },
    h2: {
      fontSize: '2rem',
      fontWeight: 600,
      lineHeight: 1.3,
    },
    h3: {
      fontSize: '1.75rem',
      fontWeight: 600,
      lineHeight: 1.4,
    },
    h4: {
      fontSize: '1.5rem',
      fontWeight: 600,
      lineHeight: 1.4,
    },
    h5: {
      fontSize: '1.25rem',
      fontWeight: 600,
      lineHeight: 1.5,
    },
    h6: {
      fontSize: '1rem',
      fontWeight: 600,
      lineHeight: 1.5,
    },
    button: {
      textTransform: 'none',
    },
  },
  
  spacing: 8,
  shape: {
    borderRadius: 8,
  },
  
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          padding: '8px 16px',
          fontSize: '0.875rem',
          fontWeight: 500,
        },
        contained: {
          boxShadow: 'none',
          '&:hover': {
            boxShadow: '0px 4px 8px rgba(0,0,0,0.15)',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0px 2px 8px rgba(0,0,0,0.08)',
          border: '1px solid rgba(0,0,0,0.08)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          fontWeight: 500,
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.87)',
          fontSize: '0.75rem',
          padding: '8px 12px',
          borderRadius: 6,
        },
      },
    },
  },
};

export const theme = createTheme(themeOptions);
export default theme;