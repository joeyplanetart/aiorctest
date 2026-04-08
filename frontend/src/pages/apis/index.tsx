import { useState, useEffect, useCallback } from "react";
import {
  Box,
  Typography,
  Button,
  IconButton,
  TextField,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Paper,
  Chip,
  Tooltip,
  Divider,
  Stack,
  Alert,
  Tab,
  Tabs,
} from "@mui/material";
import CreateNewFolderOutlinedIcon from "@mui/icons-material/CreateNewFolderOutlined";
import FolderOutlinedIcon from "@mui/icons-material/FolderOutlined";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import FileUploadOutlinedIcon from "@mui/icons-material/FileUploadOutlined";
import ContentPasteIcon from "@mui/icons-material/ContentPaste";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import CircularProgress from "@mui/material/CircularProgress";
import DataObjectIcon from "@mui/icons-material/DataObject";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import RemoveCircleOutlineIcon from "@mui/icons-material/RemoveCircleOutline";
import { getToken } from "@/providers/authProvider";
import type {
  FolderTree, EndpointOut, RunResponse, EnvironmentOut, ExtractRuleIn,
  AssertionIn, AssertionResult,
} from "@/types/api";
import { HTTP_METHODS, METHOD_COLORS } from "@/types/api";

const SIDEBAR_W = 300;

function headers(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${getToken()}`,
  };
}

// ---------- main page ----------

const ENV_COLORS: Record<string, string> = {
  stage: "#7c3aed",
  pre:   "#d97706",
  prod:  "#dc2626",
};

export function ApisPage({ projectId }: { projectId: string }) {
  const [tree, setTree] = useState<FolderTree[]>([]);
  const [selectedEp, setSelectedEp] = useState<EndpointOut | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [error, setError] = useState("");
  const [environments, setEnvironments] = useState<EnvironmentOut[]>([]);
  const [selectedEnvId, setSelectedEnvId] = useState<string>("");

  const api = `/api/projects/${projectId}`;

  const selectedEnvSlug: string = (() => {
    const env = environments.find((e) => e.id === selectedEnvId);
    return env?.slug ?? "stage";
  })();

  const baseUrl: string = (() => {
    const env = environments.find((e) => e.id === selectedEnvId);
    return env?.base_url?.replace(/\/+$/, "") ?? "";
  })();

  const [variables, setVariables] = useState<Record<string, string>>({});
  const [showVarsPanel, setShowVarsPanel] = useState(false);

  const loadVariables = useCallback(async (envSlug: string) => {
    const res = await fetch(`${api}/variables?env_slug=${envSlug}`, { headers: headers() });
    if (res.ok) {
      const rows: { key: string; value: string }[] = await res.json();
      const obj: Record<string, string> = {};
      for (const r of rows) obj[r.key] = r.value;
      setVariables(obj);
    }
  }, [api]);

  const saveVariables = useCallback(async (vars: Record<string, string>) => {
    setVariables(vars);
    await fetch(`${api}/variables`, {
      method: "PUT",
      headers: headers(),
      body: JSON.stringify({ env_slug: selectedEnvSlug, variables: vars }),
    });
  }, [api, selectedEnvSlug]);

  useEffect(() => {
    if (selectedEnvSlug) loadVariables(selectedEnvSlug);
  }, [selectedEnvSlug, loadVariables]);

  const loadTree = useCallback(async () => {
    const res = await fetch(`${api}/folders/tree`, { headers: headers() });
    if (res.ok) {
      const data: FolderTree[] = await res.json();
      setTree(data);
      // Only auto-expand root folders (depth 0) so nested folders start collapsed
      const rootIds = new Set<string>(data.map((n) => n.id));
      setExpandedFolders(rootIds);
    }
  }, [api]);

  useEffect(() => { loadTree(); }, [loadTree]);

  // ---- load environments ----
  useEffect(() => {
    fetch(`${api}`, { headers: headers() })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.environments?.length) {
          const envs: EnvironmentOut[] = data.environments;
          setEnvironments(envs);
          // default to stage, fallback to first
          const stage = envs.find((e) => e.slug === "stage") ?? envs[0];
          setSelectedEnvId(stage.id);
        }
      })
      .catch(() => {});
  }, [api]);

  const toggleFolder = (id: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleCreateFolder = async (name: string, parentId: string | null) => {
    setError("");
    const res = await fetch(`${api}/folders`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ name, parent_id: parentId }),
    });
    if (res.ok) { loadTree(); setShowNewFolder(false); }
    else {
      const d = await res.json().catch(() => ({}));
      setError(d.detail || "Create failed");
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    if (!confirm("Delete this folder and all its endpoints?")) return;
    await fetch(`${api}/folders/${folderId}`, { method: "DELETE", headers: headers() });
    if (selectedEp?.folder_id === folderId) setSelectedEp(null);
    loadTree();
  };

  const handleCreateEndpoint = async (folderId: string) => {
    const res = await fetch(`${api}/endpoints`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ folder_id: folderId, name: "New Request", method: "GET", url: "" }),
    });
    if (res.ok) {
      const ep: EndpointOut = await res.json();
      loadTree();
      setSelectedEp(ep);
    }
  };

  const handleSelectEndpoint = async (ep: EndpointOut) => {
    const res = await fetch(`${api}/endpoints/${ep.id}`, { headers: headers() });
    if (res.ok) setSelectedEp(await res.json());
  };

  const handleSaveEndpoint = async (ep: EndpointOut) => {
    const res = await fetch(`${api}/endpoints/${ep.id}`, {
      method: "PATCH",
      headers: headers(),
      body: JSON.stringify({
        name: ep.name,
        method: ep.method,
        url: ep.url,
        headers_json: ep.headers_json,
        query_params_json: ep.query_params_json,
        body_json: ep.body_json,
        body_type: ep.body_type,
        description: ep.description,
      }),
    });
    if (res.ok) {
      setSelectedEp(await res.json());
      loadTree();
    }
  };

  const handleDeleteEndpoint = async (epId: string) => {
    await fetch(`${api}/endpoints/${epId}`, { method: "DELETE", headers: headers() });
    if (selectedEp?.id === epId) setSelectedEp(null);
    loadTree();
  };

  return (
    <Box sx={{ display: "flex", height: "100%", overflow: "hidden" }}>
      {/* sidebar */}
      <Paper
        elevation={0}
        sx={{
          width: SIDEBAR_W, minWidth: SIDEBAR_W, borderRight: 1, borderColor: "divider",
          display: "flex", flexDirection: "column", overflow: "hidden",
        }}
      >
        <Box sx={{ p: 1, display: "flex", flexDirection: "column", gap: 0.5 }}>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Tooltip title="New folder">
              <IconButton size="small" onClick={() => setShowNewFolder(true)}>
                <CreateNewFolderOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Import from cURL / OpenAPI">
              <IconButton size="small" onClick={() => setShowImport(true)}>
                <FileUploadOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Project Variables">
              <IconButton
                size="small"
                onClick={() => setShowVarsPanel(true)}
                sx={{ color: Object.keys(variables).length > 0 ? "#2563eb" : undefined }}
              >
                <DataObjectIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            {Object.keys(variables).length > 0 && (
              <Chip
                label={`${Object.keys(variables).length} vars`}
                size="small"
                onClick={() => setShowVarsPanel(true)}
                sx={{ height: 18, fontSize: 10, fontWeight: 700, bgcolor: "#dbeafe", color: "#2563eb", cursor: "pointer" }}
              />
            )}
          </Stack>
          {environments.length > 0 && (
            <Box sx={{ display: "flex", gap: 0.5 }}>
              {environments.map((env) => {
                const active = env.id === selectedEnvId;
                const color = ENV_COLORS[env.slug] ?? "#6b7280";
                return (
                  <Chip
                    key={env.id}
                    label={env.slug.toUpperCase()}
                    size="small"
                    onClick={() => setSelectedEnvId(env.id)}
                    sx={{
                      height: 20,
                      fontSize: 10,
                      fontWeight: 800,
                      cursor: "pointer",
                      bgcolor: active ? color : "transparent",
                      color: active ? "#fff" : color,
                      border: `1.5px solid ${color}`,
                      borderRadius: 1,
                      "&:hover": { bgcolor: active ? color : `${color}22` },
                    }}
                  />
                );
              })}
              {baseUrl && (
                <Tooltip title={`Base URL: ${baseUrl}`} placement="right">
                  <Typography
                    variant="caption"
                    noWrap
                    sx={{
                      flex: 1,
                      fontSize: 10,
                      color: "text.secondary",
                      alignSelf: "center",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      maxWidth: 160,
                      ml: 0.5,
                    }}
                  >
                    {baseUrl}
                  </Typography>
                </Tooltip>
              )}
            </Box>
          )}
        </Box>
        <Divider />
        <Box sx={{ flex: 1, overflowY: "auto", px: 0.5, py: 1 }}>
          {tree.map((f) => (
            <FolderNode
              key={f.id}
              folder={f}
              depth={0}
              expanded={expandedFolders}
              selectedId={selectedEp?.id}
              onToggle={toggleFolder}
              onSelectEp={handleSelectEndpoint}
              onAddEp={handleCreateEndpoint}
              onDeleteFolder={handleDeleteFolder}
              onDeleteEp={handleDeleteEndpoint}
            />
          ))}
          {tree.length === 0 && (
            <Typography variant="body2" sx={{ px: 2, py: 4, color: "text.disabled", textAlign: "center" }}>
              No folders yet. Create one to start.
            </Typography>
          )}
        </Box>
      </Paper>

      {/* main area */}
      <Box sx={{ flex: 1, overflow: "auto", p: 2.5 }}>
        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>{error}</Alert>}
        {selectedEp ? (
          <EndpointEditor
            endpoint={selectedEp}
            projectId={projectId}
            baseUrl={baseUrl}
            variables={variables}
            onVarsChange={saveVariables}
            onChange={setSelectedEp}
            onSave={handleSaveEndpoint}
          />
        ) : (
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "text.disabled" }}>
            <Typography>Select an endpoint or create a new one</Typography>
          </Box>
        )}
      </Box>

      {/* new folder dialog */}
      <NewFolderDialog
        open={showNewFolder}
        folders={tree}
        onClose={() => setShowNewFolder(false)}
        onCreate={handleCreateFolder}
      />

      {/* import dialog */}
      <ImportDialog
        open={showImport}
        projectId={projectId}
        folders={tree}
        onClose={() => setShowImport(false)}
        onDone={() => { loadTree(); setShowImport(false); }}
      />

      {/* variables dialog */}
      <Dialog open={showVarsPanel} onClose={() => setShowVarsPanel(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ pb: 0 }}>
          Project Variables
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
            Reference in URL / Headers / Body with {"{{var}}"} &nbsp;·&nbsp; Current env: {selectedEnvSlug.toUpperCase()}
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <VariablesPanel
            variables={variables}
            onChange={saveVariables}
            envSlug={selectedEnvSlug}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowVarsPanel(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// ---------- folder tree node ----------

function FolderNode({
  folder, depth, expanded, selectedId,
  onToggle, onSelectEp, onAddEp, onDeleteFolder, onDeleteEp,
}: {
  folder: FolderTree;
  depth: number;
  expanded: Set<string>;
  selectedId?: string;
  onToggle: (id: string) => void;
  onSelectEp: (ep: EndpointOut) => void;
  onAddEp: (folderId: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onDeleteEp: (epId: string) => void;
}) {
  const isOpen = expanded.has(folder.id);

  return (
    <Box>
      <Box
        sx={{
          display: "flex", alignItems: "center", pl: 1 + depth * 2, pr: 0.5, py: 0.25,
          cursor: "pointer", borderRadius: 1,
          "&:hover": { bgcolor: "action.hover" },
          "&:hover .folder-actions": { opacity: 1 },
        }}
        onClick={() => onToggle(folder.id)}
      >
        {isOpen ? <FolderOpenIcon sx={{ fontSize: 18, mr: 0.75, color: "primary.main" }} /> : <FolderOutlinedIcon sx={{ fontSize: 18, mr: 0.75, color: "text.secondary" }} />}
        <Typography variant="body2" sx={{ flex: 1, fontWeight: 600, fontSize: 13 }} noWrap>
          {folder.name}
        </Typography>
        <Stack direction="row" className="folder-actions" sx={{ opacity: 0, transition: "opacity .15s" }}>
          <IconButton size="small" onClick={(e) => { e.stopPropagation(); onAddEp(folder.id); }} title="Add endpoint">
            <AddIcon sx={{ fontSize: 16 }} />
          </IconButton>
          <IconButton size="small" onClick={(e) => { e.stopPropagation(); onDeleteFolder(folder.id); }} title="Delete folder">
            <DeleteOutlineIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Stack>
      </Box>

      {isOpen && (
        <>
          {folder.endpoints.map((ep) => (
            <Box
              key={ep.id}
              sx={{
                display: "flex", alignItems: "center", pl: 3.5 + depth * 2, pr: 0.5, py: 0.4,
                cursor: "pointer", borderRadius: 1,
                bgcolor: selectedId === ep.id ? "action.selected" : "transparent",
                "&:hover": { bgcolor: selectedId === ep.id ? "action.selected" : "action.hover" },
                "&:hover .ep-del": { opacity: 1 },
              }}
              onClick={() => onSelectEp(ep)}
            >
              <Chip
                label={ep.method}
                size="small"
                sx={{
                  height: 20, fontSize: 10, fontWeight: 700, mr: 1, minWidth: 48,
                  bgcolor: `${METHOD_COLORS[ep.method] || "#6b7280"}18`,
                  color: METHOD_COLORS[ep.method] || "#6b7280",
                }}
              />
              <Typography variant="body2" sx={{ flex: 1, fontSize: 13 }} noWrap>
                {ep.name}
              </Typography>
              <IconButton className="ep-del" size="small" sx={{ opacity: 0, transition: "opacity .15s" }} onClick={(e) => { e.stopPropagation(); onDeleteEp(ep.id); }}>
                <DeleteOutlineIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Box>
          ))}
          {folder.children.map((child) => (
            <FolderNode
              key={child.id}
              folder={child}
              depth={depth + 1}
              expanded={expanded}
              selectedId={selectedId}
              onToggle={onToggle}
              onSelectEp={onSelectEp}
              onAddEp={onAddEp}
              onDeleteFolder={onDeleteFolder}
              onDeleteEp={onDeleteEp}
            />
          ))}
        </>
      )}
    </Box>
  );
}

// ---------- KV editor ----------

type KVPair = { key: string; value: string };

function parseJsonToKV(jsonStr: string): KVPair[] {
  try {
    const obj = JSON.parse(jsonStr || "{}");
    const pairs = Object.entries(obj).map(([key, value]) => ({
      key,
      value: String(value),
    }));
    if (pairs.length === 0) return [{ key: "", value: "" }];
    return pairs;
  } catch {
    return [{ key: "", value: "" }];
  }
}

function kvToJson(pairs: KVPair[]): string {
  const obj: Record<string, string> = {};
  for (const p of pairs) {
    if (p.key.trim()) obj[p.key] = p.value;
  }
  return JSON.stringify(obj, null, 2);
}

function KVEditor({
  value,
  onChange,
  keyPlaceholder = "Key",
  valuePlaceholder = "Value",
}: {
  value: string;
  onChange: (json: string) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
}) {
  const [pairs, setPairs] = useState<KVPair[]>(() => parseJsonToKV(value));
  const [rawMode, setRawMode] = useState(false);
  const [rawText, setRawText] = useState(value || "{}");

  useEffect(() => {
    setPairs(parseJsonToKV(value));
    setRawText(tryPrettyPrint(value));
  }, [value]);

  const updatePair = (idx: number, field: "key" | "value", val: string) => {
    const next = [...pairs];
    next[idx] = { ...next[idx], [field]: val };
    setPairs(next);
    onChange(kvToJson(next));
  };

  const addRow = () => {
    const next = [...pairs, { key: "", value: "" }];
    setPairs(next);
  };

  const removeRow = (idx: number) => {
    const next = pairs.filter((_, i) => i !== idx);
    if (next.length === 0) next.push({ key: "", value: "" });
    setPairs(next);
    onChange(kvToJson(next));
  };

  if (rawMode) {
    return (
      <Box>
        <Stack direction="row" justifyContent="flex-end" sx={{ mb: 0.5 }}>
          <Button
            size="small"
            onClick={() => {
              setRawMode(false);
              onChange(rawText);
            }}
            sx={{ textTransform: "none", fontSize: 12 }}
          >
            Table view
          </Button>
        </Stack>
        <TextField
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          onBlur={() => onChange(rawText)}
          multiline
          minRows={6}
          maxRows={20}
          fullWidth
          size="small"
          inputProps={{ style: { fontFamily: "'JetBrains Mono', monospace", fontSize: 13 } }}
        />
      </Box>
    );
  }

  return (
    <Box>
      <Stack direction="row" justifyContent="flex-end" sx={{ mb: 0.5 }}>
        <Button
          size="small"
          onClick={() => {
            setRawText(tryPrettyPrint(kvToJson(pairs)));
            setRawMode(true);
          }}
          sx={{ textTransform: "none", fontSize: 12 }}
        >
          Raw JSON
        </Button>
      </Stack>
      <Box
        component="table"
        sx={{
          width: "100%",
          borderCollapse: "collapse",
          "& th, & td": {
            border: "1px solid",
            borderColor: "divider",
            px: 1,
            py: 0.5,
          },
          "& th": {
            bgcolor: "action.hover",
            fontSize: 12,
            fontWeight: 700,
            textAlign: "left",
          },
        }}
      >
        <thead>
          <tr>
            <Box component="th" sx={{ width: "35%" }}>{keyPlaceholder}</Box>
            <th>{valuePlaceholder}</th>
            <Box component="th" sx={{ width: 40 }} />
          </tr>
        </thead>
        <tbody>
          {pairs.map((p, idx) => (
            <tr key={idx}>
              <td>
                <TextField
                  value={p.key}
                  onChange={(e) => updatePair(idx, "key", e.target.value)}
                  variant="standard"
                  fullWidth
                  size="small"
                  placeholder={keyPlaceholder}
                  InputProps={{ disableUnderline: true }}
                  inputProps={{ style: { fontFamily: "'JetBrains Mono', monospace", fontSize: 13 } }}
                />
              </td>
              <td>
                <TextField
                  value={p.value}
                  onChange={(e) => updatePair(idx, "value", e.target.value)}
                  variant="standard"
                  fullWidth
                  size="small"
                  placeholder={valuePlaceholder}
                  InputProps={{ disableUnderline: true }}
                  inputProps={{ style: { fontFamily: "'JetBrains Mono', monospace", fontSize: 13 } }}
                />
              </td>
              <td>
                <IconButton
                  size="small"
                  onClick={() => removeRow(idx)}
                  sx={{ p: 0.25 }}
                >
                  <DeleteOutlineIcon sx={{ fontSize: 16, color: "text.disabled" }} />
                </IconButton>
              </td>
            </tr>
          ))}
        </tbody>
      </Box>
      <Button
        size="small"
        startIcon={<AddIcon sx={{ fontSize: 14 }} />}
        onClick={addRow}
        sx={{ mt: 0.5, textTransform: "none", fontSize: 12 }}
      >
        Add row
      </Button>
    </Box>
  );
}

function tryPrettyPrint(json: string): string {
  try {
    return JSON.stringify(JSON.parse(json), null, 2);
  } catch {
    return json;
  }
}

// ---------- variables panel ----------

function VariablesPanel({
  variables,
  onChange,
  envSlug,
}: {
  variables: Record<string, string>;
  onChange: (vars: Record<string, string>) => void;
  envSlug: string;
}) {
  const entries = Object.entries(variables);
  const [pairs, setPairs] = useState<{ key: string; value: string }[]>(() => {
    const list = entries.map(([key, value]) => ({ key, value }));
    list.push({ key: "", value: "" });
    return list;
  });

  useEffect(() => {
    const list = Object.entries(variables).map(([key, value]) => ({ key, value }));
    list.push({ key: "", value: "" });
    setPairs(list);
  }, [variables]);

  const commit = (newPairs: { key: string; value: string }[]) => {
    const obj: Record<string, string> = {};
    for (const p of newPairs) {
      if (p.key.trim()) obj[p.key.trim()] = p.value;
    }
    onChange(obj);
  };

  const updatePair = (idx: number, field: "key" | "value", val: string) => {
    const next = [...pairs];
    next[idx] = { ...next[idx], [field]: val };
    if (idx === next.length - 1 && next[idx].key.trim()) {
      next.push({ key: "", value: "" });
    }
    setPairs(next);
  };

  const removePair = (idx: number) => {
    const next = pairs.filter((_, i) => i !== idx);
    if (next.length === 0) next.push({ key: "", value: "" });
    setPairs(next);
    commit(next);
  };

  const handleBlur = () => commit(pairs);

  return (
    <Box sx={{ px: 0, py: 0.5 }}>
      {pairs.map((p, idx) => (
        <Stack key={idx} direction="row" spacing={0.5} sx={{ mb: 0.5 }} alignItems="center">
          <TextField
            size="small"
            placeholder="key"
            value={p.key}
            onChange={(e) => updatePair(idx, "key", e.target.value)}
            onBlur={handleBlur}
            inputProps={{ style: { fontSize: 11, fontFamily: "monospace" } }}
            sx={{ flex: 1, "& .MuiInputBase-root": { height: 28 } }}
          />
          <TextField
            size="small"
            placeholder="value"
            value={p.value}
            onChange={(e) => updatePair(idx, "value", e.target.value)}
            onBlur={handleBlur}
            inputProps={{ style: { fontSize: 11, fontFamily: "monospace" } }}
            sx={{ flex: 1.5, "& .MuiInputBase-root": { height: 28 } }}
          />
          {pairs.length > 1 && idx < pairs.length - 1 && (
            <IconButton size="small" onClick={() => removePair(idx)} sx={{ p: 0.2 }}>
              <DeleteOutlineIcon sx={{ fontSize: 14, color: "text.disabled" }} />
            </IconButton>
          )}
        </Stack>
      ))}
    </Box>
  );
}

// ---------- endpoint editor ----------

function EndpointEditor({
  endpoint, projectId, baseUrl, variables, onVarsChange, onChange, onSave,
}: {
  endpoint: EndpointOut;
  projectId: string;
  baseUrl?: string;
  variables?: Record<string, string>;
  onVarsChange?: (vars: Record<string, string>) => void;
  onChange: (ep: EndpointOut) => void;
  onSave: (ep: EndpointOut) => void;
}) {
  const [tab, setTab] = useState(0);
  const [sending, setSending] = useState(false);
  const [response, setResponse] = useState<RunResponse | null>(null);
  const [runError, setRunError] = useState("");
  const [respTab, setRespTab] = useState(0);
  const [extractRules, setExtractRules] = useState<ExtractRuleIn[]>([]);
  const [assertions, setAssertions] = useState<AssertionIn[]>([]);

  const update = (patch: Partial<EndpointOut>) => onChange({ ...endpoint, ...patch });

  const headerCount = (() => {
    try {
      return Object.keys(JSON.parse(endpoint.headers_json || "{}")).length;
    } catch { return 0; }
  })();
  const paramCount = (() => {
    try {
      return Object.keys(JSON.parse(endpoint.query_params_json || "{}")).length;
    } catch { return 0; }
  })();

  // Compute the effective URL: if endpoint.url is a path (starts with /), prepend baseUrl
  const effectiveUrl = (() => {
    const u = endpoint.url.trim();
    if (!u) return "";
    if (baseUrl && (u.startsWith("/") || !u.startsWith("http"))) {
      return baseUrl.replace(/\/+$/, "") + (u.startsWith("/") ? u : "/" + u);
    }
    return u;
  })();
  const showBaseUrlHint = !!baseUrl && effectiveUrl !== endpoint.url.trim() && !!endpoint.url.trim();

  // Compute resolved URL after variable substitution (for display only)
  const resolvedUrl = (() => {
    if (!effectiveUrl) return effectiveUrl;
    let u = effectiveUrl;
    for (const [k, v] of Object.entries(variables || {})) {
      u = u.split(`{{${k}}}`).join(v);
    }
    return u;
  })();
  const hasVarSubstitution = resolvedUrl !== effectiveUrl && effectiveUrl.includes("{{");

  const handleSend = async () => {
    if (!effectiveUrl) return;
    setSending(true);
    setRunError("");
    setResponse(null);
    try {
      let hdrs: Record<string, string> = {};
      try { hdrs = JSON.parse(endpoint.headers_json || "{}"); } catch { /* ignore */ }
      let qp: Record<string, string> = {};
      try { qp = JSON.parse(endpoint.query_params_json || "{}"); } catch { /* ignore */ }

      const activeRules = extractRules.filter((r) => r.var_name.trim() && (r.source === "status" || r.json_path.trim()));
      const activeAssertions = assertions.filter((a) => {
        if (a.type === "status_code" || a.type === "response_time") return true;
        if (a.type === "json_path") return !!a.json_path.trim();
        if (a.type === "header") return !!a.header_name.trim();
        if (a.type === "body_contains") return !!a.expected.trim();
        return false;
      });
      const res = await fetch(`/api/projects/${projectId}/run`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          method: endpoint.method,
          url: effectiveUrl,
          headers: hdrs,
          query_params: qp,
          body: endpoint.body_json || "",
          body_type: endpoint.body_type,
          variables: variables || {},
          extract_rules: activeRules,
          assertions: activeAssertions,
        }),
      });
      if (res.ok) {
        const data: RunResponse = await res.json();
        setResponse(data);
        if (data.extracted_vars && Object.keys(data.extracted_vars).length > 0 && onVarsChange && variables) {
          onVarsChange({ ...variables, ...data.extracted_vars });
        }
      } else {
        const d = await res.json().catch(() => ({}));
        setRunError(d.detail || `Request failed (${res.status})`);
      }
    } catch (err) {
      setRunError(String(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
        <TextField
          value={endpoint.name}
          onChange={(e) => update({ name: e.target.value })}
          variant="standard"
          sx={{ flex: 1 }}
          inputProps={{ style: { fontSize: 18, fontWeight: 600 } }}
        />
        <Button variant="contained" size="small" onClick={() => onSave(endpoint)}>
          Save
        </Button>
      </Stack>

      <Stack direction="row" spacing={1} sx={{ mb: (showBaseUrlHint || hasVarSubstitution) ? 0.5 : 2 }}>
        <Select
          value={endpoint.method}
          onChange={(e) => update({ method: e.target.value })}
          size="small"
          sx={{
            minWidth: 100, fontWeight: 700, fontSize: 14,
            color: METHOD_COLORS[endpoint.method] || "#6b7280",
          }}
        >
          {HTTP_METHODS.map((m) => (
            <MenuItem key={m} value={m} sx={{ fontWeight: 700, color: METHOD_COLORS[m] }}>
              {m}
            </MenuItem>
          ))}
        </Select>
        <TextField
          value={endpoint.url}
          onChange={(e) => update({ url: e.target.value })}
          placeholder={baseUrl ? "/path/to/endpoint" : "https://api.example.com/path"}
          size="small"
          sx={{ flex: 1 }}
        />
        <Button
          variant="contained"
          color="success"
          size="small"
          onClick={handleSend}
          disabled={sending || !effectiveUrl}
          startIcon={sending ? <CircularProgress size={16} color="inherit" /> : <PlayArrowIcon />}
          sx={{ minWidth: 100, fontWeight: 700, textTransform: "none" }}
        >
          {sending ? "Sending…" : "Send"}
        </Button>
      </Stack>
      {(showBaseUrlHint || hasVarSubstitution) && (
        <Typography
          variant="caption"
          sx={{
            display: "block",
            mb: 2,
            fontFamily: "monospace",
            fontSize: 11,
            color: hasVarSubstitution ? "#7c3aed" : "text.secondary",
            wordBreak: "break-all",
          }}
        >
          → {resolvedUrl}
        </Typography>
      )}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2, borderBottom: 1, borderColor: "divider" }}>
        <Tab
          label={headerCount > 0 ? `Headers (${headerCount})` : "Headers"}
          sx={{ textTransform: "none" }}
        />
        <Tab
          label={paramCount > 0 ? `Query Params (${paramCount})` : "Query Params"}
          sx={{ textTransform: "none" }}
        />
        <Tab label="Body" sx={{ textTransform: "none" }} />
        <Tab
          label={extractRules.length > 0 ? `Extracts (${extractRules.length})` : "Extracts"}
          sx={{ textTransform: "none" }}
        />
        <Tab
          label={assertions.length > 0 ? `Assertions (${assertions.length})` : "Assertions"}
          sx={{ textTransform: "none" }}
        />
        <Tab label="Description" sx={{ textTransform: "none" }} />
      </Tabs>

      {tab === 0 && (
        <KVEditor
          value={endpoint.headers_json}
          onChange={(v) => update({ headers_json: v })}
          keyPlaceholder="Header"
          valuePlaceholder="Value"
        />
      )}
      {tab === 1 && (
        <KVEditor
          value={endpoint.query_params_json}
          onChange={(v) => update({ query_params_json: v })}
          keyPlaceholder="Parameter"
          valuePlaceholder="Value"
        />
      )}
      {tab === 2 && (
        <Box>
          <Select
            value={endpoint.body_type}
            onChange={(e) => update({ body_type: e.target.value })}
            size="small"
            sx={{ mb: 1, minWidth: 120 }}
          >
            <MenuItem value="none">none</MenuItem>
            <MenuItem value="json">JSON</MenuItem>
            <MenuItem value="raw">Raw</MenuItem>
            <MenuItem value="form-data">Form Data</MenuItem>
          </Select>
          {endpoint.body_type !== "none" && (
            <TextField
              value={endpoint.body_json}
              onChange={(e) => update({ body_json: e.target.value })}
              multiline
              minRows={8}
              maxRows={24}
              fullWidth
              size="small"
              placeholder='{"key": "value"}'
              inputProps={{ style: { fontFamily: "'JetBrains Mono', monospace", fontSize: 13 } }}
            />
          )}
        </Box>
      )}
      {tab === 3 && (
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.5 }}>
            Automatically extract values from the response after sending a request and store them as project variables. Reference them in URL / Headers / Body with {"{{var}}"}.
          </Typography>
          {extractRules.map((rule, idx) => (
            <Box
              key={idx}
              sx={{ mb: 1.5, p: 1.5, border: 1, borderColor: "divider", borderRadius: 1, bgcolor: "grey.50" }}
            >
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <TextField
                  size="small"
                  label="Variable name"
                  placeholder="e.g. token"
                  value={rule.var_name}
                  onChange={(e) => {
                    const next = [...extractRules];
                    next[idx] = { ...next[idx], var_name: e.target.value };
                    setExtractRules(next);
                  }}
                  inputProps={{ style: { fontSize: 12, fontFamily: "monospace" } }}
                  sx={{ flex: 1 }}
                />
                <Select
                  size="small"
                  value={rule.source}
                  onChange={(e) => {
                    const next = [...extractRules];
                    next[idx] = { ...next[idx], source: e.target.value as ExtractRuleIn["source"] };
                    setExtractRules(next);
                  }}
                  sx={{ fontSize: 12, minWidth: 100 }}
                >
                  <MenuItem value="body" sx={{ fontSize: 12 }}>Body</MenuItem>
                  <MenuItem value="header" sx={{ fontSize: 12 }}>Header</MenuItem>
                  <MenuItem value="status" sx={{ fontSize: 12 }}>Status</MenuItem>
                </Select>
                <IconButton
                  size="small"
                  onClick={() => setExtractRules(extractRules.filter((_, i) => i !== idx))}
                >
                  <RemoveCircleOutlineIcon sx={{ fontSize: 16, color: "error.main" }} />
                </IconButton>
              </Stack>
              {rule.source !== "status" && (
                <TextField
                  size="small"
                  fullWidth
                  label={rule.source === "body" ? "JSONPath" : "Header Name"}
                  placeholder={rule.source === "body" ? "$.access_token  or  $.data[0].id" : "Authorization"}
                  value={rule.json_path}
                  onChange={(e) => {
                    const next = [...extractRules];
                    next[idx] = { ...next[idx], json_path: e.target.value };
                    setExtractRules(next);
                  }}
                  inputProps={{ style: { fontSize: 12, fontFamily: "monospace" } }}
                />
              )}
            </Box>
          ))}
          <Button
            size="small"
            variant="outlined"
            startIcon={<AddCircleOutlineIcon />}
            onClick={() => setExtractRules([...extractRules, { var_name: "", source: "body", json_path: "" }])}
            sx={{ textTransform: "none", fontSize: 12 }}
          >
            Add extract rule
          </Button>
        </Box>
      )}
      {tab === 4 && (
        <AssertionsEditor assertions={assertions} onChange={setAssertions} variables={variables} />
      )}
      {tab === 5 && (
        <TextField
          value={endpoint.description || ""}
          onChange={(e) => update({ description: e.target.value })}
          multiline
          minRows={4}
          maxRows={12}
          fullWidth
          size="small"
          placeholder="Describe what this endpoint does…"
        />
      )}

      {/* ---- Response Panel ---- */}
      {(response || runError || sending) && (
        <Box sx={{ mt: 3, borderTop: 2, borderColor: "divider", pt: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5, fontSize: 14 }}>
            Response
          </Typography>

          {runError && <Alert severity="error" sx={{ mb: 1 }}>{runError}</Alert>}

          {sending && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 2 }}>
              <CircularProgress size={20} />
              <Typography variant="body2" color="text.secondary">Sending request…</Typography>
            </Box>
          )}

          {response && (
            <Box>
              <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1.5 }}>
                <Chip
                  label={`${response.status_code} ${response.status_text}`}
                  size="small"
                  color={response.status_code < 300 ? "success" : response.status_code < 400 ? "info" : response.status_code < 500 ? "warning" : "error"}
                  sx={{ fontWeight: 700, fontSize: 13 }}
                />
                <Typography variant="caption" color="text.secondary">
                  {response.elapsed_ms.toFixed(0)} ms
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {formatBytes(response.size_bytes)}
                </Typography>
                {response.assertion_results.length > 0 && (
                  <>
                    <Chip
                      label={`${response.assertions_passed} passed`}
                      size="small"
                      color="success"
                      sx={{ fontWeight: 700, fontSize: 12 }}
                    />
                    {response.assertions_failed > 0 && (
                      <Chip
                        label={`${response.assertions_failed} failed`}
                        size="small"
                        color="error"
                        sx={{ fontWeight: 700, fontSize: 12 }}
                      />
                    )}
                  </>
                )}
              </Stack>

              {response.assertion_results.length > 0 && (
                <AssertionResultsPanel results={response.assertion_results} />
              )}

              {response.extracted_vars && Object.keys(response.extracted_vars).length > 0 && (
                <Box sx={{ mb: 1.5, p: 1.25, bgcolor: "#dbeafe", borderRadius: 1 }}>
                  <Typography variant="caption" fontWeight={700} color="primary.main" sx={{ display: "block", mb: 0.5 }}>
                    Extracted Variables → saved to project variables
                  </Typography>
                  {Object.entries(response.extracted_vars).map(([k, v]) => (
                    <Stack key={k} direction="row" spacing={1} alignItems="baseline" sx={{ mb: 0.25 }}>
                      <Typography
                        variant="caption"
                        sx={{ fontWeight: 700, fontFamily: "monospace", color: "#2563eb", minWidth: 80 }}
                      >
                        {`{{${k}}}`}
                      </Typography>
                      <Typography variant="caption" sx={{ fontFamily: "monospace", wordBreak: "break-all" }}>
                        {v.length > 200 ? v.slice(0, 200) + "…" : v}
                      </Typography>
                    </Stack>
                  ))}
                </Box>
              )}

              {(() => {
                const ct = (response.headers["content-type"] || "").toLowerCase();
                const isHtml = ct.includes("text/html");
                const isJson = ct.includes("json") || response.body.trim().startsWith("{") || response.body.trim().startsWith("[");
                return (
                  <>
                    <Tabs value={respTab} onChange={(_, v) => setRespTab(v)} sx={{ mb: 1, borderBottom: 1, borderColor: "divider" }}>
                      <Tab label="Body" sx={{ textTransform: "none", fontSize: 13 }} />
                      <Tab
                        label={`Headers (${Object.keys(response.headers).length})`}
                        sx={{ textTransform: "none", fontSize: 13 }}
                      />
                      {isHtml && <Tab label="Preview" sx={{ textTransform: "none", fontSize: 13 }} />}
                    </Tabs>

                    {respTab === 0 && (
                      <Box sx={{ position: "relative" }}>
                        {isJson ? (
                          <Box
                            component="pre"
                            sx={{
                              m: 0,
                              p: 1.5,
                              bgcolor: "#1e1e1e",
                              color: "#d4d4d4",
                              borderRadius: 1,
                              fontSize: 12,
                              lineHeight: 1.55,
                              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                              overflowX: "auto",
                              maxHeight: 480,
                              overflowY: "auto",
                              whiteSpace: "pre-wrap",
                              wordBreak: "break-all",
                            }}
                          >
                            <JsonHighlight text={tryFormatResponseBody(response.body, ct)} />
                          </Box>
                        ) : (
                          <TextField
                            value={response.body}
                            multiline
                            minRows={6}
                            maxRows={30}
                            fullWidth
                            size="small"
                            InputProps={{ readOnly: true }}
                            inputProps={{
                              style: { fontFamily: "'JetBrains Mono', monospace", fontSize: 12, lineHeight: 1.5 },
                            }}
                            sx={{ bgcolor: "grey.50" }}
                          />
                        )}
                      </Box>
                    )}

                    {respTab === 2 && isHtml && (
                      <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1, overflow: "hidden", height: 520 }}>
                        <iframe
                          srcDoc={response.body}
                          title="Response HTML Preview"
                          sandbox="allow-same-origin allow-scripts"
                          style={{ width: "100%", height: "100%", border: "none" }}
                        />
                      </Box>
                    )}

                    {respTab === 1 && (
                      <Box
                        component="table"
                        sx={{
                          width: "100%",
                          borderCollapse: "collapse",
                          "& th, & td": { border: "1px solid", borderColor: "divider", px: 1.5, py: 0.5 },
                          "& th": { bgcolor: "action.hover", fontSize: 12, fontWeight: 700, textAlign: "left" },
                          "& td": { fontSize: 12, fontFamily: "'JetBrains Mono', monospace", wordBreak: "break-all" },
                        }}
                      >
                        <thead>
                          <tr>
                            <Box component="th" sx={{ width: "30%" }}>Header</Box>
                            <th>Value</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(response.headers).map(([k, v]) => (
                            <tr key={k}>
                              <td>{k}</td>
                              <td>{v}</td>
                            </tr>
                          ))}
                        </tbody>
                      </Box>
                    )}
                  </>
                );
              })()}
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}

// ---- Assertion operator options per type ----
const ASSERTION_OPERATORS: Record<string, { value: string; label: string }[]> = {
  status_code: [
    { value: "eq", label: "= equals" },
    { value: "ne", label: "≠ not equals" },
    { value: "gt", label: "> greater than" },
    { value: "lt", label: "< less than" },
    { value: "gte", label: "≥ ≥" },
    { value: "lte", label: "≤ ≤" },
  ],
  response_time: [
    { value: "lt", label: "< less than (ms)" },
    { value: "lte", label: "≤ ≤ (ms)" },
    { value: "gt", label: "> greater than (ms)" },
    { value: "eq", label: "= equals (ms)" },
  ],
  json_path: [
    { value: "eq", label: "= equals" },
    { value: "ne", label: "≠ not equals" },
    { value: "contains", label: "contains" },
    { value: "not_contains", label: "not contains" },
    { value: "exists", label: "exists" },
    { value: "not_exists", label: "not exists" },
    { value: "matches", label: "regex matches" },
  ],
  header: [
    { value: "eq", label: "= equals" },
    { value: "ne", label: "≠ not equals" },
    { value: "contains", label: "contains" },
    { value: "exists", label: "exists" },
    { value: "not_exists", label: "not exists" },
  ],
  body_contains: [
    { value: "contains", label: "contains" },
    { value: "not_contains", label: "not contains" },
    { value: "matches", label: "regex matches" },
  ],
};

function newAssertion(): AssertionIn {
  return {
    id: Math.random().toString(36).slice(2),
    type: "status_code",
    json_path: "",
    header_name: "",
    operator: "eq",
    expected: "200",
  };
}

function renderVars(text: string, vars?: Record<string, string>): string {
  if (!vars || !text) return text;
  let out = text;
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`{{${k}}}`).join(v);
  }
  return out;
}

function VarHint({ raw, vars }: { raw: string; vars?: Record<string, string> }) {
  if (!raw || !raw.includes("{{") || !vars) return null;
  const resolved = renderVars(raw, vars);
  if (resolved === raw) return null;
  return (
    <Typography
      variant="caption"
      sx={{ display: "block", mt: 0.25, fontFamily: "monospace", color: "#7c3aed", fontSize: 10 }}
    >
      → {resolved}
    </Typography>
  );
}

function AssertionsEditor({
  assertions,
  onChange,
  variables,
}: {
  assertions: AssertionIn[];
  onChange: (a: AssertionIn[]) => void;
  variables?: Record<string, string>;
}) {
  const varNames = Object.keys(variables || {});
  const update = (idx: number, patch: Partial<AssertionIn>) => {
    const next = assertions.map((a, i) => (i === idx ? { ...a, ...patch } : a));
    onChange(next);
  };

  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
        Add assertions to verify the response. Pass/fail results are shown after sending the request.
      </Typography>
      {varNames.length > 0 && (
        <Typography variant="caption" sx={{ display: "block", mb: 1.5, color: "#7c3aed", fontFamily: "monospace" }}>
          Available vars: {varNames.map((k) => `{{${k}}}`).join("  ")}
        </Typography>
      )}
      {assertions.map((a, idx) => (
        <Box
          key={a.id}
          sx={{ mb: 1.5, p: 1.5, border: 1, borderColor: "divider", borderRadius: 1, bgcolor: "grey.50" }}
        >
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <Select
              size="small"
              value={a.type}
              onChange={(e) => {
                const t = e.target.value as AssertionIn["type"];
                const ops = ASSERTION_OPERATORS[t] || [];
                update(idx, {
                  type: t,
                  operator: ops[0]?.value as AssertionIn["operator"] || "eq",
                  expected: t === "status_code" ? "200" : "",
                });
              }}
              sx={{ fontSize: 12, minWidth: 130 }}
            >
              <MenuItem value="status_code" sx={{ fontSize: 12 }}>Status Code</MenuItem>
              <MenuItem value="response_time" sx={{ fontSize: 12 }}>Response Time</MenuItem>
              <MenuItem value="json_path" sx={{ fontSize: 12 }}>JSON Path</MenuItem>
              <MenuItem value="header" sx={{ fontSize: 12 }}>Header</MenuItem>
              <MenuItem value="body_contains" sx={{ fontSize: 12 }}>Body Contains</MenuItem>
            </Select>
            <Select
              size="small"
              value={a.operator}
              onChange={(e) => update(idx, { operator: e.target.value as AssertionIn["operator"] })}
              sx={{ fontSize: 12, minWidth: 120 }}
            >
              {(ASSERTION_OPERATORS[a.type] || []).map((op) => (
                <MenuItem key={op.value} value={op.value} sx={{ fontSize: 12 }}>{op.label}</MenuItem>
              ))}
            </Select>
            <IconButton size="small" onClick={() => onChange(assertions.filter((_, i) => i !== idx))}>
              <RemoveCircleOutlineIcon sx={{ fontSize: 16, color: "error.main" }} />
            </IconButton>
          </Stack>

          {a.type === "json_path" && (
            <Box sx={{ mb: 1 }}>
              <TextField
                size="small" fullWidth label="JSONPath" placeholder="$.data.token  or  $.data.{{field}}"
                value={a.json_path}
                onChange={(e) => update(idx, { json_path: e.target.value })}
                inputProps={{ style: { fontSize: 12, fontFamily: "monospace" } }}
              />
              <VarHint raw={a.json_path} vars={variables} />
            </Box>
          )}
          {a.type === "header" && (
            <Box sx={{ mb: 1 }}>
              <TextField
                size="small" fullWidth label="Header Name" placeholder="content-type"
                value={a.header_name}
                onChange={(e) => update(idx, { header_name: e.target.value })}
                inputProps={{ style: { fontSize: 12, fontFamily: "monospace" } }}
              />
              <VarHint raw={a.header_name} vars={variables} />
            </Box>
          )}
          {!["exists", "not_exists"].includes(a.operator) && a.type !== "body_contains" && (
            <Box>
              <TextField
                size="small" fullWidth
                label={a.type === "response_time" ? "Expected (ms)  supports {{var}}" : "Expected value  supports {{var}}"}
                placeholder={
                  a.type === "status_code" ? "200  or  {{expected_code}}"
                  : a.type === "response_time" ? "2000  or  {{max_ms}}"
                  : "expected value  or  {{token}}"
                }
                value={a.expected}
                onChange={(e) => update(idx, { expected: e.target.value })}
                inputProps={{ style: { fontSize: 12, fontFamily: "monospace" } }}
              />
              <VarHint raw={a.expected} vars={variables} />
            </Box>
          )}
          {a.type === "body_contains" && (
            <Box>
              <TextField
                size="small" fullWidth
                label="Expected Text / Regex  supports {{var}}"
                placeholder={a.operator === "matches" ? "^\\d+$  or  ^{{prefix}}" : "some text  or  {{keyword}}"}
                value={a.expected}
                onChange={(e) => update(idx, { expected: e.target.value })}
                inputProps={{ style: { fontSize: 12, fontFamily: "monospace" } }}
              />
              <VarHint raw={a.expected} vars={variables} />
            </Box>
          )}
        </Box>
      ))}
      <Button
        size="small"
        variant="outlined"
        startIcon={<AddCircleOutlineIcon />}
        onClick={() => onChange([...assertions, newAssertion()])}
        sx={{ textTransform: "none", fontSize: 12 }}
      >
        Add Assertion
      </Button>
    </Box>
  );
}

function AssertionResultsPanel({ results }: { results: AssertionResult[] }) {
  return (
    <Box sx={{ mb: 1.5 }}>
      <Typography variant="caption" fontWeight={700} sx={{ display: "block", mb: 0.75, color: "text.secondary" }}>
        Assertions
      </Typography>
      {results.map((r, i) => (
        <Stack
          key={r.id || i}
          direction="row"
          spacing={1}
          alignItems="flex-start"
          sx={{
            mb: 0.5,
            p: 0.75,
            borderRadius: 1,
            bgcolor: r.passed ? "#f0fdf4" : "#fef2f2",
            border: 1,
            borderColor: r.passed ? "#bbf7d0" : "#fecaca",
          }}
        >
          <Typography
            sx={{
              fontSize: 13,
              fontWeight: 700,
              color: r.passed ? "#16a34a" : "#dc2626",
              minWidth: 16,
              mt: "1px",
            }}
          >
            {r.passed ? "✓" : "✗"}
          </Typography>
          <Box sx={{ flex: 1 }}>
            <Typography variant="caption" sx={{ fontFamily: "monospace", display: "block", lineHeight: 1.4 }}>
              {r.description || `${r.type} ${r.expected}`}
            </Typography>
            {!r.passed && r.message && (
              <Typography variant="caption" sx={{ color: "#dc2626", fontSize: 11, display: "block" }}>
                {r.message}
              </Typography>
            )}
            {r.actual && r.actual !== "(body)" && (
              <Typography variant="caption" sx={{ color: "text.secondary", fontSize: 11, display: "block", fontFamily: "monospace" }}>
                actual: {r.actual}
              </Typography>
            )}
          </Box>
        </Stack>
      ))}
    </Box>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function tryFormatResponseBody(body: string, contentType?: string): string {
  if (!body) return "(empty)";
  const ct = (contentType || "").toLowerCase();
  if (ct.includes("json") || body.trim().startsWith("{") || body.trim().startsWith("[")) {
    try {
      return JSON.stringify(JSON.parse(body), null, 2);
    } catch { /* not valid JSON */ }
  }
  return body;
}

// Simple JSON syntax highlighter
function JsonHighlight({ text }: { text: string }) {
  const html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(
      /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
      (match) => {
        let cls = "color:#ce9178"; // string
        if (/^"/.test(match)) {
          if (/:$/.test(match)) cls = "color:#9cdcfe;font-weight:600"; // key
        } else if (/true|false/.test(match)) {
          cls = "color:#569cd6";
        } else if (/null/.test(match)) {
          cls = "color:#569cd6";
        } else {
          cls = "color:#b5cea8"; // number
        }
        return `<span style="${cls}">${match}</span>`;
      },
    );
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

// ---------- new folder dialog ----------

function NewFolderDialog({
  open, folders, onClose, onCreate,
}: {
  open: boolean;
  folders: FolderTree[];
  onClose: () => void;
  onCreate: (name: string, parentId: string | null) => void;
}) {
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState<string>("");

  const flatFolders = flattenTree(folders);

  const handleSubmit = () => {
    if (name.trim()) {
      onCreate(name.trim(), parentId || null);
      setName("");
      setParentId("");
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>New Folder</DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "8px !important" }}>
        <TextField
          label="Folder name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          size="small"
          autoFocus
          fullWidth
        />
        <Select
          value={parentId}
          onChange={(e) => setParentId(e.target.value)}
          size="small"
          displayEmpty
          fullWidth
        >
          <MenuItem value="">Root (no parent)</MenuItem>
          {flatFolders.map((f) => (
            <MenuItem key={f.id} value={f.id}>
              {"  ".repeat(f.depth)}{f.name}
            </MenuItem>
          ))}
        </Select>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={!name.trim()}>Create</Button>
      </DialogActions>
    </Dialog>
  );
}

// ---------- import dialog ----------

function ImportDialog({
  open, projectId, folders, onClose, onDone,
}: {
  open: boolean;
  projectId: string;
  folders: FolderTree[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [tab, setTab] = useState(0);
  const [curlText, setCurlText] = useState("");
  const [curlFolderId, setCurlFolderId] = useState("");
  const [openapiText, setOpenapiText] = useState("");
  const [openapiParent, setOpenapiParent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const flat = flattenTree(folders);
  const api = `/api/projects/${projectId}`;

  const handleCurlImport = async () => {
    if (!curlText.trim() || !curlFolderId) return;
    setLoading(true);
    setError("");
    const res = await fetch(`${api}/import/curl`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ folder_id: curlFolderId, curl_command: curlText }),
    });
    setLoading(false);
    if (res.ok) { setCurlText(""); onDone(); }
    else { const d = await res.json().catch(() => ({})); setError(d.detail || "Import failed"); }
  };

  const handleOpenapiImport = async () => {
    if (!openapiText.trim()) return;
    setLoading(true);
    setError("");
    const res = await fetch(`${api}/import/openapi`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        openapi_spec: openapiText,
        target_folder_id: openapiParent || null,
      }),
    });
    setLoading(false);
    if (res.ok) { setOpenapiText(""); onDone(); }
    else { const d = await res.json().catch(() => ({})); setError(d.detail || "Import failed"); }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={1}>
          <ContentPasteIcon fontSize="small" />
          <span>Import APIs</span>
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
          <Tab label="cURL" sx={{ textTransform: "none" }} />
          <Tab label="OpenAPI" sx={{ textTransform: "none" }} />
        </Tabs>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {tab === 0 && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Select
              value={curlFolderId}
              onChange={(e) => setCurlFolderId(e.target.value)}
              size="small"
              displayEmpty
              fullWidth
            >
              <MenuItem value="" disabled>Select target folder</MenuItem>
              {flat.map((f) => (
                <MenuItem key={f.id} value={f.id}>{"  ".repeat(f.depth)}{f.name}</MenuItem>
              ))}
            </Select>
            <TextField
              value={curlText}
              onChange={(e) => setCurlText(e.target.value)}
              multiline
              minRows={6}
              maxRows={14}
              fullWidth
              size="small"
              placeholder={'Paste your cURL command here…\n\ncurl -X POST https://api.example.com/users \\\n  -H "Content-Type: application/json" \\\n  -d \'{"name":"John"}\''}
              inputProps={{ style: { fontFamily: "'JetBrains Mono', monospace", fontSize: 13 } }}
            />
          </Box>
        )}

        {tab === 1 && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Select
              value={openapiParent}
              onChange={(e) => setOpenapiParent(e.target.value)}
              size="small"
              displayEmpty
              fullWidth
            >
              <MenuItem value="">Root (no parent folder)</MenuItem>
              {flat.map((f) => (
                <MenuItem key={f.id} value={f.id}>{"  ".repeat(f.depth)}{f.name}</MenuItem>
              ))}
            </Select>
            <TextField
              value={openapiText}
              onChange={(e) => setOpenapiText(e.target.value)}
              multiline
              minRows={8}
              maxRows={18}
              fullWidth
              size="small"
              placeholder="Paste OpenAPI JSON or YAML spec here…"
              inputProps={{ style: { fontFamily: "'JetBrains Mono', monospace", fontSize: 13 } }}
            />
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={loading || (tab === 0 ? (!curlText.trim() || !curlFolderId) : !openapiText.trim())}
          onClick={tab === 0 ? handleCurlImport : handleOpenapiImport}
        >
          {loading ? "Importing…" : "Import"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ---------- utils ----------

function flattenTree(nodes: FolderTree[], depth = 0): Array<{ id: string; name: string; depth: number }> {
  const result: Array<{ id: string; name: string; depth: number }> = [];
  for (const n of nodes) {
    result.push({ id: n.id, name: n.name, depth });
    result.push(...flattenTree(n.children, depth + 1));
  }
  return result;
}
