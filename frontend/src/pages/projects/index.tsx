import { useState, useEffect, useCallback } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import ApiOutlinedIcon from "@mui/icons-material/ApiOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import HubOutlinedIcon from "@mui/icons-material/HubOutlined";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import { alpha } from "@mui/material/styles";
import { useGetIdentity } from "@refinedev/core";
import { useNavigate } from "react-router";
import { Trans, useTranslation } from "react-i18next";
import { getToken } from "@/providers/authProvider";
import { getLastProject } from "@/lib/lastProject";
import type { UserProfile, ProjectListItem, ProjectOut, MemberOut, EnvironmentOut } from "@/types/auth";
import { formatProjectRole } from "@/lib/roles";
import HistoryIcon from "@mui/icons-material/History";

const API = "/api/projects";

function headers(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${getToken()}`,
  };
}

type EnvEdit = { label: string; base_url: string };

export function ProjectsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: identity } = useGetIdentity<UserProfile>();
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [selected, setSelected] = useState<ProjectOut | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState("member");
  const [addingMembers, setAddingMembers] = useState(false);
  const [addMemberResults, setAddMemberResults] = useState<{ email: string; ok: boolean; msg: string }[]>([]);
  const [error, setError] = useState("");
  const [envEdits, setEnvEdits] = useState<Record<string, EnvEdit>>({});
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [savingEnv, setSavingEnv] = useState(false);

  const isSuperadmin = identity?.is_superadmin ?? false;

  const loadProjects = useCallback(async () => {
    const res = await fetch(API, { headers: headers() });
    if (res.ok) setProjects(await res.json());
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const loadProject = async (id: string) => {
    const res = await fetch(`${API}/${id}`, { headers: headers() });
    if (res.ok) setSelected(await res.json());
  };

  useEffect(() => {
    if (!selected) {
      setEnvEdits({});
      setEditName("");
      setEditDesc("");
      return;
    }
    const next: Record<string, EnvEdit> = {};
    selected.environments.forEach((e) => {
      next[e.id] = { label: e.label, base_url: e.base_url ?? "" };
    });
    setEnvEdits(next);
    setEditName(selected.name);
    setEditDesc(selected.description ?? "");
  }, [selected?.id]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const res = await fetch(API, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ name: newName, description: newDesc || null }),
    });
    if (res.ok) {
      setShowCreate(false);
      setNewName("");
      setNewDesc("");
      loadProjects();
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.detail || t("projects.createFailed"));
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setError("");
    setAddMemberResults([]);

    const emails = memberEmail
      .split(/[;,]/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    if (emails.length === 0) return;

    setAddingMembers(true);
    const results: { email: string; ok: boolean; msg: string }[] = [];

    for (const email of emails) {
      const res = await fetch(`${API}/${selected.id}/members`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ email, role: memberRole }),
      });
      if (res.ok) {
        results.push({ email, ok: true, msg: t("projects.added") });
      } else {
        const d = await res.json().catch(() => ({}));
        results.push({ email, ok: false, msg: d.detail || t("projects.failed") });
      }
    }

    setAddingMembers(false);
    setAddMemberResults(results);
    const anyOk = results.some((r) => r.ok);
    if (anyOk) {
      setMemberEmail("");
      loadProject(selected.id);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!selected) return;
    await fetch(`${API}/${selected.id}/members/${memberId}`, {
      method: "DELETE",
      headers: headers(),
    });
    loadProject(selected.id);
  };

  const handleMemberRoleChange = async (memberId: string, role: string) => {
    if (!selected) return;
    setError("");
    const res = await fetch(`${API}/${selected.id}/members/${memberId}`, {
      method: "PATCH",
      headers: headers(),
      body: JSON.stringify({ role }),
    });
    if (res.ok) loadProject(selected.id);
    else {
      const d = await res.json().catch(() => ({}));
      setError(d.detail || t("projects.roleUpdateFailed"));
    }
  };

  const handleSaveEnvironments = async () => {
    if (!selected) return;
    setError("");
    setSavingEnv(true);
    try {
      for (const env of selected.environments) {
        const ed = envEdits[env.id];
        if (!ed) continue;
        const body: { label?: string; base_url?: string | null } = {};
        if (ed.label !== env.label) body.label = ed.label;
        const origUrl = env.base_url ?? "";
        if (ed.base_url !== origUrl) body.base_url = ed.base_url.trim() || null;
        if (Object.keys(body).length === 0) continue;
        const res = await fetch(`${API}/${selected.id}/environments/${env.id}`, {
          method: "PATCH",
          headers: headers(),
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.detail || t("projects.environmentUpdateFailed"));
        }
      }
      await loadProject(selected.id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSavingEnv(false);
    }
  };

  const handleUpdateProjectMeta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setError("");
    const res = await fetch(`${API}/${selected.id}`, {
      method: "PATCH",
      headers: headers(),
      body: JSON.stringify({ name: editName, description: editDesc || null }),
    });
    if (res.ok) {
      loadProjects();
      loadProject(selected.id);
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.detail || t("projects.updateFailed"));
    }
  };

  const handleDeleteProject = async () => {
    if (!selected || !isSuperadmin) return;
    if (!window.confirm(t("projects.deleteConfirm", { name: selected.name }))) return;
    setError("");
    const res = await fetch(`${API}/${selected.id}`, { method: "DELETE", headers: headers() });
    if (res.ok) {
      setSelected(null);
      loadProjects();
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.detail || t("projects.deleteFailed"));
    }
  };

  const projectRole = selected ? projects.find((p) => p.id === selected.id)?.role : undefined;
  const canManageProject = isSuperadmin || projectRole === "admin";
  const envCount = selected?.environments?.length ?? 0;

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, flex: 1 }}>
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h4">{t("projects.title")}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 720 }} component="div">
            <Trans
              i18nKey="projects.intro"
              components={[<strong key="a" />, <strong key="b" />, <strong key="c" />]}
            />
          </Typography>
        </Box>
        {isSuperadmin && (
          <Button
            variant="contained"
            startIcon={<AddOutlinedIcon />}
            onClick={() => setShowCreate(!showCreate)}
          >
            {t("projects.newProject")}
          </Button>
        )}
      </Stack>

      <Alert severity="info" sx={{ mb: 3 }}>
        <Trans
          i18nKey="projects.sidebarHint"
          components={[<strong key="a" />, <strong key="b" />]}
        />
      </Alert>

      <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ mb: 3 }}>
        <Card
          sx={{
            flex: 1,
            bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
            border: "none",
          }}
        >
          <CardContent>
            <Typography variant="body2" color="text.secondary" fontWeight={600}>
              {t("common.projects")}
            </Typography>
            <Typography variant="h3" fontWeight={800} color="primary.dark">
              {projects.length}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t("projects.totalWorkspaces")}
            </Typography>
          </CardContent>
        </Card>
        <Card
          sx={{
            flex: 1,
            bgcolor: (theme) => alpha("#e8a87c", 0.25),
            border: "none",
          }}
        >
          <CardContent>
            <Typography variant="body2" color="text.secondary" fontWeight={600}>
              {t("common.members")}
            </Typography>
            <Typography variant="h3" fontWeight={800} sx={{ color: "#b45309" }}>
              {selected?.members?.length ?? "—"}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {selected ? t("projects.inSelectedProject") : t("projects.selectProject")}
            </Typography>
          </CardContent>
        </Card>
        <Card
          sx={{
            flex: 1,
            bgcolor: (theme) => alpha(theme.palette.info.main, 0.06),
            border: "none",
          }}
        >
          <CardContent>
            <Typography variant="body2" color="text.secondary" fontWeight={600}>
              {t("common.environments")}
            </Typography>
            <Typography variant="h3" fontWeight={800} color="text.primary">
              {selected ? envCount : "—"}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t("projects.configuredTargets")}
            </Typography>
          </CardContent>
        </Card>
      </Stack>

      {error && (
        <Typography color="error" sx={{ mb: 2 }} variant="body2">
          {error}
        </Typography>
      )}

      {showCreate && (
        <Card sx={{ mb: 3 }}>
          <CardContent component="form" onSubmit={handleCreate}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              {t("projects.createProject")}
            </Typography>
            <Stack spacing={2} direction={{ xs: "column", sm: "row" }}>
              <TextField
                label={t("common.name")}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
                fullWidth
                size="small"
              />
              <TextField
                label={t("common.description")}
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                fullWidth
                size="small"
              />
            </Stack>
            <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
              <Button type="submit" variant="contained">
                {t("common.create")}
              </Button>
              <Button type="button" variant="outlined" color="inherit" onClick={() => setShowCreate(false)}>
                {t("common.cancel")}
              </Button>
            </Stack>
          </CardContent>
        </Card>
      )}

      <Stack direction={{ xs: "column", lg: "row" }} spacing={3} alignItems="stretch">
        <Card sx={{ width: { xs: "100%", lg: 280 }, flexShrink: 0 }}>
          <CardContent sx={{ pb: 1 }}>
            <Typography variant="subtitle2" color="text.secondary" fontWeight={700} gutterBottom>
              {t("projects.yourProjects")}
            </Typography>
            <Stack spacing={1}>
              {projects.map((p) => {
                const isSelected = selected?.id === p.id;
                const isLast = getLastProject()?.id === p.id;
                return (
                  <Box
                    key={p.id}
                    onClick={() => loadProject(p.id)}
                    sx={{
                      display: "flex",
                      alignItems: "flex-start",
                      flexDirection: "column",
                      width: "100%",
                      cursor: "pointer",
                      py: 1.25,
                      px: 2,
                      borderRadius: 2,
                      border: "1.5px solid",
                      borderColor: isSelected ? "primary.main" : "divider",
                      bgcolor: isSelected
                        ? (theme) => alpha(theme.palette.primary.main, 0.08)
                        : "background.paper",
                      transition: "all 0.15s",
                      "&:hover": {
                        borderColor: "primary.main",
                        bgcolor: (theme) => alpha(theme.palette.primary.main, 0.04),
                      },
                    }}
                  >
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ width: "100%" }}>
                      <Typography
                        variant="body2"
                        fontWeight={isSelected ? 700 : 500}
                        color={isSelected ? "primary.main" : "text.primary"}
                        sx={{ flex: 1 }}
                      >
                        {p.name}
                      </Typography>
                      {isLast && (
                        <Chip
                          icon={<HistoryIcon sx={{ fontSize: "14px !important" }} />}
                          label={t("projects.lastVisited")}
                          size="small"
                          color="info"
                          variant="outlined"
                          sx={{ height: 20, fontSize: 11, fontWeight: 600, "& .MuiChip-icon": { ml: 0.25 } }}
                        />
                      )}
                    </Stack>
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.25 }}>
                      {t("projects.rolePrefix")} {formatProjectRole(p.role)}
                    </Typography>
                  </Box>
                );
              })}
              {projects.length === 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                  {isSuperadmin ? t("projects.emptySuperadmin") : t("projects.emptyMember")}
                </Typography>
              )}
            </Stack>
          </CardContent>
        </Card>

        <Card sx={{ flex: 1, minWidth: 0 }}>
          <CardContent>
            {selected ? (
              <>
                <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
                  <Stack direction="row" alignItems="flex-start" spacing={1}>
                    <HubOutlinedIcon color="primary" sx={{ mt: 0.25 }} />
                    <Box>
                      <Typography variant="h6">{selected.name}</Typography>
                      {selected.description && (
                        <Typography variant="body2" color="text.secondary">
                          {selected.description}
                        </Typography>
                      )}
                    </Box>
                  </Stack>
                  <Stack direction="row" spacing={1}>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<ApiOutlinedIcon />}
                      onClick={() => navigate(`/projects/${selected.id}/apis`)}
                    >
                      {t("projects.apiManagement")}
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<AccountTreeOutlinedIcon />}
                      onClick={() => navigate(`/projects/${selected.id}/orchestration`)}
                    >
                      {t("projects.orchestration")}
                    </Button>
                    {isSuperadmin && (
                      <Button color="error" variant="outlined" size="small" onClick={handleDeleteProject}>
                        {t("projects.deleteProject")}
                      </Button>
                    )}
                  </Stack>
                </Stack>

                {canManageProject && (
                  <Box component="form" onSubmit={handleUpdateProjectMeta} sx={{ mb: 3 }}>
                    <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                      {t("projects.projectDetails")}
                    </Typography>
                    <Stack spacing={2} direction={{ xs: "column", sm: "row" }}>
                      <TextField
                        label={t("common.name")}
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        required
                        size="small"
                        fullWidth
                      />
                      <TextField
                        label={t("common.description")}
                        value={editDesc}
                        onChange={(e) => setEditDesc(e.target.value)}
                        size="small"
                        fullWidth
                      />
                    </Stack>
                    <Button type="submit" variant="outlined" size="small" sx={{ mt: 1 }}>
                      {t("projects.saveProjectDetails")}
                    </Button>
                  </Box>
                )}

                <Typography variant="subtitle2" fontWeight={700} sx={{ mt: 2, mb: 1 }}>
                  {t("projects.envSectionTitle")}
                </Typography>
                {selected && projectRole && (
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                    {t("projects.yourRoleInProject")}{" "}
                    <strong>{formatProjectRole(projectRole)}</strong>
                  </Typography>
                )}
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
                  {canManageProject ? t("projects.envHintManage") : t("projects.envHintView")}
                </Typography>
                <Stack spacing={2} sx={{ mb: 2 }}>
                  {selected.environments.map((env: EnvironmentOut) => {
                    const ed = envEdits[env.id];
                    if (!ed) return null;
                    return (
                      <Stack key={env.id} direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "flex-start" }}>
                        <TextField
                          label={t("common.label")}
                          value={ed.label}
                          onChange={(e) =>
                            setEnvEdits((prev) => ({
                              ...prev,
                              [env.id]: { ...prev[env.id], label: e.target.value },
                            }))
                          }
                          size="small"
                          disabled={!canManageProject}
                          sx={{ minWidth: 180 }}
                        />
                        <TextField
                          label={t("projects.baseUrlSlug", { slug: env.slug })}
                          value={ed.base_url}
                          onChange={(e) =>
                            setEnvEdits((prev) => ({
                              ...prev,
                              [env.id]: { ...prev[env.id], base_url: e.target.value },
                            }))
                          }
                          size="small"
                          fullWidth
                          disabled={!canManageProject}
                          placeholder="https://..."
                        />
                      </Stack>
                    );
                  })}
                </Stack>
                {canManageProject && (
                  <Button
                    variant="contained"
                    color="secondary"
                    size="small"
                    startIcon={<SaveOutlinedIcon />}
                    onClick={handleSaveEnvironments}
                    disabled={savingEnv}
                    sx={{ mb: 3 }}
                  >
                    {savingEnv ? t("common.saving") : t("projects.saveEnvironments")}
                  </Button>
                )}

                <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                  {t("common.members")}
                </Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>{t("projects.memberTableEmail")}</TableCell>
                        <TableCell>{t("projects.memberTableName")}</TableCell>
                        <TableCell>{t("projects.memberTableRole")}</TableCell>
                        <TableCell width={56} />
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {selected.members.map((m: MemberOut) => (
                        <TableRow key={m.id} hover>
                          <TableCell>{m.email}</TableCell>
                          <TableCell>{m.display_name}</TableCell>
                          <TableCell>
                            {canManageProject ? (
                              <TextField
                                select
                                size="small"
                                value={m.role}
                                onChange={(e) => handleMemberRoleChange(m.id, e.target.value)}
                                SelectProps={{ native: true }}
                                sx={{ minWidth: 100 }}
                              >
                                <option value="member">{t("projects.roleMember")}</option>
                                <option value="admin">{t("projects.roleProjectAdmin")}</option>
                              </TextField>
                            ) : (
                              <Chip
                                label={formatProjectRole(m.role)}
                                size="small"
                                color={m.role === "admin" ? "primary" : "default"}
                                variant={m.role === "admin" ? "filled" : "outlined"}
                              />
                            )}
                          </TableCell>
                          <TableCell>
                            {canManageProject && (
                              <IconButton
                                size="small"
                                color="error"
                                aria-label={t("projects.removeMemberAria")}
                                onClick={() => handleRemoveMember(m.id)}
                              >
                                <DeleteOutlineIcon fontSize="small" />
                              </IconButton>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>

                {canManageProject && (
                  <Box component="form" onSubmit={handleAddMember} sx={{ mt: 2 }}>
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }} component="div">
                      <Trans i18nKey="projects.addMemberHint" components={{ 0: <strong /> }} />
                    </Typography>
                    <Stack direction="column" spacing={1}>
                      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "flex-end" }}>
                        <TextField
                          label={t("projects.memberEmailLabel")}
                          value={memberEmail}
                          onChange={(e) => { setMemberEmail(e.target.value); setAddMemberResults([]); }}
                          required
                          size="small"
                          sx={{ flex: 1 }}
                          placeholder="a@x.com; b@x.com; c@x.com"
                          multiline={memberEmail.includes(";")}
                          maxRows={4}
                        />
                        <TextField
                          label={t("common.role")}
                          select
                          value={memberRole}
                          onChange={(e) => setMemberRole(e.target.value)}
                          size="small"
                          sx={{ minWidth: 130 }}
                          SelectProps={{ native: true }}
                        >
                          <option value="member">{t("projects.roleMember")}</option>
                          <option value="admin">{t("projects.roleProjectAdmin")}</option>
                        </TextField>
                        <Button
                          type="submit"
                          variant="contained"
                          color="secondary"
                          disabled={addingMembers}
                          sx={{ whiteSpace: "nowrap", flexShrink: 0 }}
                        >
                          {addingMembers ? t("common.adding") : t("projects.addMember")}
                        </Button>
                      </Stack>
                      {addMemberResults.length > 0 && (
                        <Box>
                          {addMemberResults.map((r) => (
                            <Typography
                              key={r.email}
                              variant="caption"
                              display="block"
                              sx={{ color: r.ok ? "success.main" : "error.main" }}
                            >
                              {r.ok ? "✓" : "✗"} {r.email} — {r.msg}
                            </Typography>
                          ))}
                        </Box>
                      )}
                    </Stack>
                  </Box>
                )}
              </>
            ) : (
              <Typography color="text.secondary" sx={{ py: 4, textAlign: "center" }}>
                {t("projects.selectProjectDetail")}
              </Typography>
            )}
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
}
