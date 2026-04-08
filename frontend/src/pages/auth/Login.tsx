import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Link as MuiLink,
  Paper,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { Link as RouterLink } from "react-router";
import { useLogin } from "@refinedev/core";
import { useTranslation } from "react-i18next";
import { setAppLanguage } from "@/i18n";

export function LoginPage() {
  const { t, i18n } = useTranslation();
  const { mutate: login, isLoading } = useLogin();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const langValue = i18n.language.startsWith("zh") ? "zh" : "en";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    login(
      { email, password },
      {
        onError: (err) => setError(err.message || t("auth.loginFailed")),
      },
    );
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "background.default",
        p: 2,
        position: "relative",
      }}
    >
      <Box sx={{ position: "absolute", top: 16, right: 16 }}>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={langValue}
          onChange={(_, v) => {
            if (v === "en" || v === "zh") setAppLanguage(v);
          }}
        >
          <ToggleButton value="en">{t("layout.langEn")}</ToggleButton>
          <ToggleButton value="zh">{t("layout.langZh")}</ToggleButton>
        </ToggleButtonGroup>
      </Box>
      <Paper
        component="form"
        onSubmit={handleSubmit}
        elevation={0}
        sx={{
          p: 4,
          width: "100%",
          maxWidth: 400,
          borderRadius: 3,
        }}
      >
        <Typography variant="h5" align="center" fontWeight={800} gutterBottom>
          AIOrcTest
        </Typography>
        <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 3 }}>
          {t("auth.signInTitle")}
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <TextField
          label={t("common.email")}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          fullWidth
          margin="normal"
          autoComplete="email"
          placeholder={t("auth.emailPlaceholder")}
        />
        <TextField
          label={t("common.password")}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          fullWidth
          margin="normal"
          inputProps={{ minLength: 6 }}
          autoComplete="current-password"
        />

        <Button
          type="submit"
          variant="contained"
          color="primary"
          fullWidth
          size="large"
          disabled={isLoading}
          sx={{ mt: 3 }}
        >
          {isLoading ? t("auth.signingIn") : t("auth.signIn")}
        </Button>

        <Typography variant="body2" align="center" sx={{ mt: 2 }}>
          {t("auth.noAccount")}{" "}
          <MuiLink component={RouterLink} to="/register" fontWeight={600} underline="hover">
            {t("auth.register")}
          </MuiLink>
        </Typography>
      </Paper>
    </Box>
  );
}
