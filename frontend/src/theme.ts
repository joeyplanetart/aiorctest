import { createTheme, alpha } from "@mui/material/styles";

export const hrTheme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#1b9a8e",
      dark: "#147a72",
      light: "#4db3a8",
    },
    secondary: {
      main: "#141721",
      contrastText: "#ffffff",
    },
    background: {
      default: "#f4f6f8",
      paper: "#ffffff",
    },
    text: {
      primary: "#1a1d26",
      secondary: "#5c6378",
    },
  },
  shape: {
    borderRadius: 12,
  },
  typography: {
    fontFamily:
      '"Inter", "Roboto", "Helvetica Neue", Helvetica, Arial, sans-serif',
    h4: { fontWeight: 700, letterSpacing: "-0.02em" },
    h5: { fontWeight: 700 },
    h6: { fontWeight: 600 },
    button: { textTransform: "none", fontWeight: 600 },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 10, textTransform: "none", fontWeight: 600 },
        sizeMedium: { padding: "8px 18px" },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: "0 1px 3px rgba(24, 29, 39, 0.06)",
          border: "1px solid",
          borderColor: alpha("#1a1d26", 0.06),
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderRight: "1px solid",
          borderColor: alpha("#1a1d26", 0.08),
        },
      },
    },
  },
});
