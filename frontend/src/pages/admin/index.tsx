import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  FormControlLabel,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { useGetIdentity } from "@refinedev/core";
import { Trans, useTranslation } from "react-i18next";
import { getToken } from "@/providers/authProvider";
import type { UserAdminRow, UserProfile } from "@/types/auth";

const API = "/api/auth/admin/users";

function headers(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${getToken()}`,
  };
}

export function AdminPage() {
  const { t } = useTranslation();
  const { data: identity, refetch: refetchIdentity } = useGetIdentity<UserProfile>();
  const [users, setUsers] = useState<UserAdminRow[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError("");
    const res = await fetch(API, { headers: headers() });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(typeof d.detail === "string" ? d.detail : t("admin.loadFailed"));
      setUsers([]);
      setLoading(false);
      return;
    }
    setUsers(await res.json());
    setLoading(false);
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const patchUser = async (userId: string, body: { is_superadmin?: boolean; is_active?: boolean }) => {
    setError("");
    const res = await fetch(`/api/auth/admin/users/${userId}`, {
      method: "PATCH",
      headers: headers(),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(typeof d.detail === "string" ? d.detail : t("admin.updateFailed"));
      return;
    }
    await load();
    if (userId === identity?.id) {
      refetchIdentity();
    }
  };

  if (!identity?.is_superadmin) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning">{t("admin.accessRequired")}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, flex: 1 }}>
      <Typography variant="h4" sx={{ mb: 1 }}>
        {t("admin.title")}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        <Trans i18nKey="admin.intro" components={{ 0: <strong /> }} />
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            {t("admin.users")}
          </Typography>
          {loading ? (
            <Typography color="text.secondary">{t("common.loading")}</Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t("admin.tableEmail")}</TableCell>
                  <TableCell>{t("admin.tableDisplayName")}</TableCell>
                  <TableCell align="center">{t("admin.tableSuperadmin")}</TableCell>
                  <TableCell align="center">{t("admin.tableActive")}</TableCell>
                  <TableCell>{t("admin.tableCreated")}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id} hover>
                    <TableCell>
                      {u.email}
                      {u.id === identity.id && (
                        <Chip label={t("common.you")} size="small" sx={{ ml: 1 }} color="primary" variant="outlined" />
                      )}
                    </TableCell>
                    <TableCell>{u.display_name}</TableCell>
                    <TableCell align="center">
                      <FormControlLabel
                        control={
                          <Switch
                            checked={u.is_superadmin}
                            onChange={(_, c) => patchUser(u.id, { is_superadmin: c })}
                            size="small"
                          />
                        }
                        label=""
                        sx={{ m: 0 }}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <FormControlLabel
                        control={
                          <Switch
                            checked={u.is_active}
                            onChange={(_, c) => patchUser(u.id, { is_active: c })}
                            size="small"
                          />
                        }
                        label=""
                        sx={{ m: 0 }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(u.created_at).toLocaleString()}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
