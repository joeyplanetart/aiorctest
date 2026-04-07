import { useState, useEffect } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useGetIdentity } from "@refinedev/core";
import { getToken } from "@/providers/authProvider";
import type { UserProfile } from "@/types/auth";

const API = "/api/auth";

export function ProfilePage() {
  const { data: identity, refetch } = useGetIdentity<UserProfile>();
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (identity) {
      setDisplayName(identity.display_name);
      setAvatarUrl(identity.avatar_url || "");
    }
  }, [identity]);

  const headers = (): Record<string, string> => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${getToken()}`,
  });

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg("");
    setError("");
    const res = await fetch(`${API}/me`, {
      method: "PATCH",
      headers: headers(),
      body: JSON.stringify({
        display_name: displayName,
        avatar_url: avatarUrl || null,
      }),
    });
    if (res.ok) {
      setMsg("Profile updated");
      refetch();
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.detail || "Update failed");
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg("");
    setError("");
    const res = await fetch(`${API}/me/password`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        old_password: oldPassword,
        new_password: newPassword,
      }),
    });
    if (res.ok || res.status === 204) {
      setMsg("Password changed");
      setOldPassword("");
      setNewPassword("");
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.detail || "Password change failed");
    }
  };

  if (!identity) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>Loading…</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, flex: 1, maxWidth: 560 }}>
      <Typography variant="h4" sx={{ mb: 3 }}>
        My profile
      </Typography>

      {msg && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {msg}
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Card sx={{ mb: 3 }}>
        <CardContent component="form" onSubmit={handleProfileSave}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Personal information
          </Typography>
          <Stack spacing={2}>
            <TextField label="Email" value={identity.email} disabled fullWidth size="small" />
            <TextField
              label="Display name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              fullWidth
              size="small"
            />
            <TextField
              label="Avatar URL"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              fullWidth
              size="small"
              placeholder="https://…"
            />
            <Button type="submit" variant="contained" sx={{ alignSelf: "flex-start" }}>
              Save changes
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent component="form" onSubmit={handlePasswordChange}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Change password
          </Typography>
          <Stack spacing={2}>
            <TextField
              label="Current password"
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              required
              fullWidth
              size="small"
            />
            <TextField
              label="New password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              fullWidth
              size="small"
              inputProps={{ minLength: 6 }}
            />
            <Button type="submit" variant="contained" color="secondary" sx={{ alignSelf: "flex-start" }}>
              Update password
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
