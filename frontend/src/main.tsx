import React, { useMemo } from "react";
import ReactDOM from "react-dom/client";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { I18nextProvider, useTranslation } from "react-i18next";
import "./i18n";
import i18n from "./i18n";
import App from "./App";
import { createHrTheme } from "./theme";

function ThemedApp() {
  const { i18n: i18next } = useTranslation();
  const theme = useMemo(() => createHrTheme(i18next.language), [i18next.language]);
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <I18nextProvider i18n={i18n}>
      <ThemedApp />
    </I18nextProvider>
  </React.StrictMode>,
);
