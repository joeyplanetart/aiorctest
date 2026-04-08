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
import { useRegister } from "@refinedev/core";
import { useTranslation } from "react-i18next";
import { setAppLanguage } from "@/i18n";

export function RegisterPage() {
  const { t, i18n } = useTranslation();
  const { mutate: register, isLoading } = useRegister();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");

  const langValue = i18n.language.startsWith("zh") ? "zh" : "en";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    register(
      { email, password, displayName },
      {
        onError: (err) => setError(err.message || t("auth.registrationFailed")),
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
          {t("auth.createAccountTitle")}
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <TextField
          label={t("common.displayName")}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          fullWidth
          margin="normal"
          placeholder={t("auth.yourName")}
        />
        <TextField
          label={t("common.email")}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          fullWidth
          margin="normal"
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
          placeholder={t("auth.passwordMin")}
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
          {isLoading ? t("auth.creating") : t("auth.createAccount")}
        </Button>

        <Typography variant="body2" align="center" sx={{ mt: 2 }}>
          {t("auth.hasAccount")}{" "}
          <MuiLink component={RouterLink} to="/login" fontWeight={600} underline="hover">
            {t("auth.signInLink")}
          </MuiLink>
        </Typography>
      </Paper>
    </Box>
  );
}
