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
      setError(d.detail || "Create failed");
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setError("");
    setAddMemberResults([]);

    // Support multiple emails separated by ";" or ","
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
        results.push({ email, ok: true, msg: "Added" });
      } else {
        const d = await res.json().catch(() => ({}));
        results.push({ email, ok: false, msg: d.detail || "Failed" });
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
      setError(d.detail || "Role update failed");
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
          throw new Error(d.detail || "Environment update failed");
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
      setError(d.detail || "Update failed");
    }
  };

  const handleDeleteProject = async () => {
    if (!selected || !isSuperadmin) return;
    if (
      !window.confirm(
        `Delete project "${selected.name}"? This cannot be undone.`,
      )
    )
      return;
    setError("");
    const res = await fetch(`${API}/${selected.id}`, { method: "DELETE", headers: headers() });
    if (res.ok) {
      setSelected(null);
      loadProjects();
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.detail || "Delete failed");
    }
  };

  const projectRole = selected ? projects.find((p) => p.id === selected.id)?.role : undefined;
  const canManageProject = isSuperadmin || projectRole === "admin";
  const envCount = selected?.environments?.length ?? 0;

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, flex: 1 }}>
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h4">Project management</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 720 }}>
            <strong>Superadmins</strong> create and delete projects. <strong>Project admins</strong> edit project
            details, environments, and members for that project. <strong>Members</strong> can view only.
          </Typography>
        </Box>
        {isSuperadmin && (
          <Button
            variant="contained"
            startIcon={<AddOutlinedIcon />}
            onClick={() => setShowCreate(!showCreate)}
          >
            New project
          </Button>
        )}
      </Stack>

      <Alert severity="info" sx={{ mb: 3 }}>
        Your sidebar shows <strong>Superadmin</strong> (platform) and/or <strong>Project admin</strong> (at least one
        project with the admin role). Project-level roles are managed in the members table below.
      </Alert>

      <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ mb: 3 }}>
        <Card
          sx={{
            flex: 1,
            bgcolor: (t) => alpha(t.palette.primary.main, 0.1),
            border: "none",
          }}
        >
          <CardContent>
            <Typography variant="body2" color="text.secondary" fontWeight={600}>
              Projects
            </Typography>
            <Typography variant="h3" fontWeight={800} color="primary.dark">
              {projects.length}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Total workspaces
            </Typography>
          </CardContent>
        </Card>
        <Card
          sx={{
            flex: 1,
            bgcolor: (t) => alpha("#e8a87c", 0.25),
            border: "none",
          }}
        >
          <CardContent>
            <Typography variant="body2" color="text.secondary" fontWeight={600}>
              Members
            </Typography>
            <Typography variant="h3" fontWeight={800} sx={{ color: "#b45309" }}>
              {selected?.members?.length ?? "—"}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {selected ? "In selected project" : "Select a project"}
            </Typography>
          </CardContent>
        </Card>
        <Card
          sx={{
            flex: 1,
            bgcolor: (t) => alpha(t.palette.info.main, 0.06),
            border: "none",
          }}
        >
          <CardContent>
            <Typography variant="body2" color="text.secondary" fontWeight={600}>
              Environments
            </Typography>
            <Typography variant="h3" fontWeight={800} color="text.primary">
              {selected ? envCount : "—"}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Configured targets
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
              Create project
            </Typography>
            <Stack spacing={2} direction={{ xs: "column", sm: "row" }}>
              <TextField
                label="Name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
                fullWidth
                size="small"
              />
              <TextField
                label="Description"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                fullWidth
                size="small"
              />
            </Stack>
            <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
              <Button type="submit" variant="contained">
                Create
              </Button>
              <Button type="button" variant="outlined" color="inherit" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
            </Stack>
          </CardContent>
        </Card>
      )}

      <Stack direction={{ xs: "column", lg: "row" }} spacing={3} alignItems="stretch">
        <Card sx={{ width: { xs: "100%", lg: 280 }, flexShrink: 0 }}>
          <CardContent sx={{ pb: 1 }}>
            <Typography variant="subtitle2" color="text.secondary" fontWeight={700} gutterBottom>
              Your projects
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
                        ? (t) => alpha(t.palette.primary.main, 0.08)
                        : "background.paper",
                      transition: "all 0.15s",
                      "&:hover": {
                        borderColor: "primary.main",
                        bgcolor: (t) => alpha(t.palette.primary.main, 0.04),
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
                          label="上次进入"
                          size="small"
                          color="info"
                          variant="outlined"
                          sx={{ height: 20, fontSize: 11, fontWeight: 600, "& .MuiChip-icon": { ml: 0.25 } }}
                        />
                      )}
                    </Stack>
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.25 }}>
                      Role: {formatProjectRole(p.role)}
                    </Typography>
                  </Box>
                );
              })}
              {projects.length === 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                  {isSuperadmin
                    ? "No projects yet. Use “New project” to create one."
                    : "No projects yet. Ask a superadmin to add you or create a project."}
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
                      API Management
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<AccountTreeOutlinedIcon />}
                      onClick={() => navigate(`/projects/${selected.id}/orchestration`)}
                    >
                      Orchestration
                    </Button>
                    {isSuperadmin && (
                      <Button color="error" variant="outlined" size="small" onClick={handleDeleteProject}>
                        Delete project
                      </Button>
                    )}
                  </Stack>
                </Stack>

                {canManageProject && (
                  <Box component="form" onSubmit={handleUpdateProjectMeta} sx={{ mb: 3 }}>
                    <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                      Project details
                    </Typography>
                    <Stack spacing={2} direction={{ xs: "column", sm: "row" }}>
                      <TextField
                        label="Name"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        required
                        size="small"
                        fullWidth
                      />
                      <TextField
                        label="Description"
                        value={editDesc}
                        onChange={(e) => setEditDesc(e.target.value)}
                        size="small"
                        fullWidth
                      />
                    </Stack>
                    <Button type="submit" variant="outlined" size="small" sx={{ mt: 1 }}>
                      Save project details
                    </Button>
                  </Box>
                )}

                <Typography variant="subtitle2" fontWeight={700} sx={{ mt: 2, mb: 1 }}>
                  Environments (stage / pre / prod)
                </Typography>
                {selected && projectRole && (
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                    Your role in this project: <strong>{formatProjectRole(projectRole)}</strong>
                  </Typography>
                )}
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
                  {canManageProject
                    ? "Set a base URL per environment (e.g. https://api.example.com)."
                    : "Only superadmins and project admins can edit environment URLs."}
                </Typography>
                <Stack spacing={2} sx={{ mb: 2 }}>
                  {selected.environments.map((env: EnvironmentOut) => {
                    const ed = envEdits[env.id];
                    if (!ed) return null;
                    return (
                      <Stack key={env.id} direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "flex-start" }}>
                        <TextField
                          label="Label"
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
                          label={`Base URL (${env.slug})`}
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
                    {savingEnv ? "Saving…" : "Save environments"}
                  </Button>
                )}

                <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                  Members
                </Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Email</TableCell>
                        <TableCell>Name</TableCell>
                        <TableCell>Role (project)</TableCell>
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
                                <option value="member">Member</option>
                                <option value="admin">Project admin</option>
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
                                aria-label="remove member"
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
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                      用户必须已注册。支持用 <strong>;</strong> 分隔同时添加多个 Email。
                    </Typography>
                    <Stack direction="column" spacing={1}>
                      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "flex-end" }}>
                        <TextField
                          label="Email（多个用 ; 分隔）"
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
                          label="Role"
                          select
                          value={memberRole}
                          onChange={(e) => setMemberRole(e.target.value)}
                          size="small"
                          sx={{ minWidth: 130 }}
                          SelectProps={{ native: true }}
                        >
                          <option value="member">Member</option>
                          <option value="admin">Project admin</option>
                        </TextField>
                        <Button
                          type="submit"
                          variant="contained"
                          color="secondary"
                          disabled={addingMembers}
                          sx={{ whiteSpace: "nowrap", flexShrink: 0 }}
                        >
                          {addingMembers ? "Adding…" : "Add member"}
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
                Select a project to view details
              </Typography>
            )}
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
}
