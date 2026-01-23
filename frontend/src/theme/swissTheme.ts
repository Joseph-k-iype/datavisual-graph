// frontend/src/theme/swissTheme.ts
// Minimalist Calm Design Theme - Soft Red and White inspired by Figma

import { createTheme } from '@mui/material/styles';

// Calm Minimalist Color Palette
const softRed = '#DB0011'; // Vibrant red
const accentRed = '#FF1A2E'; // Slightly brighter for hover
const darkRed = '#B30009'; // For active states
const highlightGreen = '#10B981'; // Vibrant green for lineage highlighting
const accentGreen = '#059669'; // Darker green for active states
const textOnRed = '#FFFFFF'; // White text on red backgrounds
const primaryText = '#2D3748'; // Soft dark gray for readability
const secondaryText = '#718096'; // Medium gray
const backgroundColor = '#FAFAFA'; // Very light gray background
const cardBackground = '#FFFFFF';
const borderColor = '#E2E8F0'; // Subtle border
const shadowColor = 'rgba(0, 0, 0, 0.08)'; // Soft shadow

export const swissTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: softRed,
      light: accentRed,
      dark: darkRed,
      contrastText: textOnRed,
    },
    secondary: {
      main: secondaryText,
      light: '#A0AEC0',
      dark: primaryText,
      contrastText: cardBackground,
    },
    background: {
      default: backgroundColor,
      paper: cardBackground,
    },
    text: {
      primary: primaryText,
      secondary: secondaryText,
    },
    divider: borderColor,
    error: {
      main: softRed,
    },
    warning: {
      main: '#FFA726',
    },
    info: {
      main: '#5C9FD6',
    },
    success: {
      main: '#66BB6A',
    },
  },
  typography: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", "Roboto", sans-serif',
    h1: {
      fontWeight: 700,
      fontSize: '2.5rem',
      lineHeight: 1.3,
      letterSpacing: '-0.02em',
    },
    h2: {
      fontWeight: 700,
      fontSize: '2rem',
      lineHeight: 1.3,
      letterSpacing: '-0.01em',
    },
    h3: {
      fontWeight: 600,
      fontSize: '1.75rem',
      lineHeight: 1.4,
      letterSpacing: '0em',
    },
    h4: {
      fontWeight: 600,
      fontSize: '1.5rem',
      lineHeight: 1.4,
      letterSpacing: '0em',
    },
    h5: {
      fontWeight: 600,
      fontSize: '1.25rem',
      lineHeight: 1.5,
      letterSpacing: '0em',
    },
    h6: {
      fontWeight: 600,
      fontSize: '1rem',
      lineHeight: 1.5,
      letterSpacing: '0em',
    },
    subtitle1: {
      fontWeight: 500,
      fontSize: '1rem',
      lineHeight: 1.6,
      letterSpacing: '0em',
    },
    subtitle2: {
      fontWeight: 500,
      fontSize: '0.875rem',
      lineHeight: 1.6,
      letterSpacing: '0em',
    },
    body1: {
      fontWeight: 400,
      fontSize: '0.938rem',
      lineHeight: 1.6,
      letterSpacing: '0em',
    },
    body2: {
      fontWeight: 400,
      fontSize: '0.875rem',
      lineHeight: 1.6,
      letterSpacing: '0em',
    },
    button: {
      fontWeight: 500,
      fontSize: '0.875rem',
      lineHeight: 1.75,
      letterSpacing: '0.02em',
      textTransform: 'none',
    },
    caption: {
      fontWeight: 400,
      fontSize: '0.75rem',
      lineHeight: 1.5,
      letterSpacing: '0.01em',
    },
  },
  shape: {
    borderRadius: 12, // Rounded corners for calmness
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          padding: '10px 20px',
          fontWeight: 500,
          textTransform: 'none',
          boxShadow: 'none',
          transition: 'all 0.2s ease',
          '&:hover': {
            boxShadow: `0 4px 12px ${shadowColor}`,
            transform: 'translateY(-1px)',
          },
        },
        contained: {
          '&:hover': {
            boxShadow: `0 6px 16px rgba(219, 0, 17, 0.25)`,
          },
        },
        outlined: {
          borderWidth: 1.5,
          '&:hover': {
            borderWidth: 1.5,
            backgroundColor: 'rgba(219, 0, 17, 0.04)',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: `0 2px 8px ${shadowColor}`,
          border: `1px solid ${borderColor}`,
        },
        elevation1: {
          boxShadow: `0 2px 8px ${shadowColor}`,
        },
        elevation2: {
          boxShadow: `0 4px 12px ${shadowColor}`,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          boxShadow: `0 2px 12px ${shadowColor}`,
          border: `1px solid ${borderColor}`,
          transition: 'all 0.2s ease',
          '&:hover': {
            boxShadow: `0 6px 20px rgba(0, 0, 0, 0.12)`,
            transform: 'translateY(-2px)',
          },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          boxShadow: `0 1px 3px ${shadowColor}`,
          borderBottom: 'none',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderRadius: 0,
          borderRight: `1px solid ${borderColor}`,
          boxShadow: `2px 0 8px ${shadowColor}`,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          fontWeight: 500,
          letterSpacing: '0.01em',
          transition: 'all 0.2s ease',
        },
        filled: {
          '&:hover': {
            boxShadow: `0 2px 8px rgba(219, 0, 17, 0.3)`,
          },
        },
        outlined: {
          borderWidth: 1.5,
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 8,
            transition: 'all 0.2s ease',
            '& fieldset': {
              borderWidth: 1.5,
            },
            '&:hover fieldset': {
              boxShadow: `0 0 0 3px rgba(219, 0, 17, 0.1)`,
            },
            '&.Mui-focused fieldset': {
              borderWidth: 1.5,
              boxShadow: `0 0 0 3px rgba(219, 0, 17, 0.15)`,
            },
          },
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          borderWidth: 1,
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          transition: 'all 0.2s ease',
          '&:hover': {
            backgroundColor: 'rgba(219, 0, 17, 0.08)',
            transform: 'scale(1.05)',
          },
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          border: 'none',
          boxShadow: `0 2px 8px ${shadowColor}`,
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 16,
          boxShadow: `0 8px 32px rgba(0, 0, 0, 0.12)`,
          border: 'none',
        },
      },
    },
  },
});
