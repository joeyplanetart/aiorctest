import { useCallback, useEffect, useRef, useState } from "react";
import {
  Box,
  Stack,
  Typography,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItemButton,
  ListItemText,
  IconButton,
  Alert,
  Chip,
  Collapse,
  CircularProgress,
  Divider,
  Tabs,
  Tab,
  Select,
  MenuItem,
  Tooltip,
} from "@mui/material";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import SettingsIcon from "@mui/icons-material/Settings";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import RemoveCircleOutlineIcon from "@mui/icons-material/RemoveCircleOutline";
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Node,
  type Edge,
  type OnConnect,
  type OnEdgesChange,
  type OnNodesChange,
} from "@xyflow/react";
import DagCanvas, { type DagCanvasHandle } from "./DagCanvas";
import type {
  DagNode,
  NodeData,
  ScenarioOut,
  ScenarioListItem,
  RunFlowResponse,
  RunStepResult,
  ExtractRule,
  OverrideFields,
  AssertionRule,
  AssertionResult,
} from "@/types/dag";
import type { EnvironmentOut, FolderTree, EndpointOut } from "@/types/api";
import { METHOD_COLORS } from "@/types/api";
import { Trans, useTranslation } from "react-i18next";

const ENV_COLORS: Record<string, string> = {
  stage: "#7c3aed",
  pre: "#d97706",
  prod: "#dc2626",
};

/** Built-in vars injected per run (combined with Project Variables from the active environment) */
const FLOW_CTX_BUILTIN_VARS = ["_run_ms", "_run_uuid"];
import { getToken } from "@/providers/authProvider";

function headers(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${getToken()}`,
  };
}

/** Submit only the fields RF needs, forcing numeric coordinates (avoids stale closure / drag end-frame saving 0,0) */
function nodesForScenarioApi(nodes: Node<NodeData>[]) {
  return nodes.map((n) => ({
    id: n.id,
    type: n.type ?? "apiStep",
    position: {
      x: typeof n.position?.x === "number" && !Number.isNaN(n.position.x) ? n.position.x : 0,
      y: typeof n.position?.y === "number" && !Number.isNaN(n.position.y) ? n.position.y : 0,
    },
    data: n.data,
  }));
}

function nodesFromScenarioApi(raw: DagNode[]): Node<NodeData>[] {
  return raw.map((n) => ({
    id: n.id,
    type: n.type ?? "apiStep",
    position: {
      x: typeof n.position?.x === "number" ? n.position.x : 0,
      y: typeof n.position?.y === "number" ? n.position.y : 0,
    },
    data: n.data as NodeData,
  }));
}

export function OrchestrationPage({ projectId }: { projectId: string }) {
  const { t } = useTranslation();
  const api = `/api/projects/${projectId}`;

  const [scenarios, setScenarios] = useState<ScenarioListItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [scenarioName, setScenarioName] = useState("");
  const [nodes, setNodes] = useState<Node<NodeData>[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [showEpPicker, setShowEpPicker] = useState(false);
  const [showAiDialog, setShowAiDialog] = useState(false);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<RunFlowResponse | null>(null);
  const [resultOpen, setResultOpen] = useState(true);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const dagCanvasRef = useRef<DagCanvasHandle>(null);
  const [runEnvironments, setRunEnvironments] = useState<EnvironmentOut[]>([]);
  const [selectedRunEnvId, setSelectedRunEnvId] = useState<string>("");
  const [projectVarKeys, setProjectVarKeys] = useState<string[]>([]);

  // ---- load scenarios list ----
  const loadList = useCallback(async () => {
    const res = await fetch(`${api}/scenarios`, { headers: headers() });
    if (res.ok) setScenarios(await res.json());
  }, [api]);

  useEffect(() => { loadList(); }, [loadList]);

  // ---- project environments (for base URL when running flow, same as API Management) ----
  useEffect(() => {
    fetch(`${api}`, { headers: headers() })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.environments?.length) {
          const envs: EnvironmentOut[] = data.environments;
          setRunEnvironments(envs);
          const stage = envs.find((e) => e.slug === "stage") ?? envs[0];
          setSelectedRunEnvId((cur) => (cur && envs.some((e) => e.id === cur) ? cur : stage.id));
        }
      })
      .catch(() => {});
  }, [api]);

  const selectedRunEnv = runEnvironments.find((e) => e.id === selectedRunEnvId);
  const runEnvSlug = selectedRunEnv?.slug ?? "stage";
  const runBaseUrlPreview = (selectedRunEnv?.base_url ?? "").replace(/\/+$/, "");

  useEffect(() => {
    if (!runEnvSlug) return;
    fetch(`${api}/variables?env_slug=${encodeURIComponent(runEnvSlug)}`, { headers: headers() })
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: { key: string }[]) => {
        setProjectVarKeys(Array.from(new Set((rows ?? []).map((x) => x.key).filter(Boolean))));
      })
      .catch(() => setProjectVarKeys([]));
  }, [api, runEnvSlug]);

  const templateVarNames = Array.from(
    new Set([
      ...FLOW_CTX_BUILTIN_VARS,
      ...projectVarKeys,
      ...nodes.flatMap((n) => ((n.data as NodeData).extracts ?? []).map((e) => e.var_name).filter(Boolean)),
    ]),
  );

  /** Must use functional update: continuous position changes during drag with stale closure nodes would lose positions */
  const handleRfNodesChange = useCallback<OnNodesChange<Node<NodeData>>>(
    (changes) => {
      setNodes((nds) => applyNodeChanges(changes, nds));
      setDirty(true);
    },
    [],
  );

  const handleRfEdgesChange = useCallback<OnEdgesChange>(
    (changes) => {
      setEdges((eds) => applyEdgeChanges(changes, eds));
      setDirty(true);
    },
    [],
  );

  const handleRfConnect = useCallback<OnConnect>(
    (connection) => {
      setEdges((eds) => addEdge(connection, eds));
      setDirty(true);
    },
    [],
  );

  /** On drag stop, write back RF's computed coordinates to state to avoid losing the last frame from onNodesChange */
  const handleNodeDragStop = useCallback(
    (_e: unknown, _node: Node<NodeData>, dragged: Node<NodeData>[]) => {
      if (!dragged?.length) return;
      const posById = new Map(dragged.map((d) => [d.id, d.position]));
      setNodes((nds) =>
        nds.map((n) => {
          const p = posById.get(n.id);
          return p ? { ...n, position: { x: p.x, y: p.y } } : n;
        }),
      );
      setDirty(true);
    },
    [],
  );

  // ---- load a specific scenario ----
  const loadScenario = useCallback(async (id: string) => {
    const res = await fetch(`${api}/scenarios/${id}`, { headers: headers() });
    if (!res.ok) return;
    const data: ScenarioOut = await res.json();
    setActiveId(data.id);
    setScenarioName(data.name);
    setNodes(nodesFromScenarioApi(data.nodes));
    setEdges(data.edges as Edge[]);
    setDirty(false);
    setRunResult(null);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        dagCanvasRef.current?.fitView();
      });
    });
  }, [api]);

  // ---- create ----
  const handleCreate = async () => {
    const res = await fetch(`${api}/scenarios`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ name: t("orch.defaultScenarioName") }),
    });
    if (res.ok) {
      const data: ScenarioOut = await res.json();
      await loadList();
      loadScenario(data.id);
    }
  };

  // ---- save ----
  const handleSave = async () => {
    if (!activeId) return;
    setSaving(true);
    const res = await fetch(`${api}/scenarios/${activeId}`, {
      method: "PUT",
      headers: headers(),
      body: JSON.stringify({ name: scenarioName, nodes: nodesForScenarioApi(nodes), edges }),
    });
    setSaving(false);
    if (res.ok) {
      setDirty(false);
      loadList();
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.detail || t("orch.saveFailed"));
    }
  };

  // ---- delete ----
  const handleDelete = async (id: string) => {
    await fetch(`${api}/scenarios/${id}`, { method: "DELETE", headers: headers() });
    if (activeId === id) {
      setActiveId(null);
      setNodes([]);
      setEdges([]);
    }
    loadList();
  };

  // ---- run flow ----
  const handleRun = async () => {
    if (!activeId) return;
    if (dirty) await handleSave();
    setRunning(true);
    setRunResult(null);
    setError("");

    const runQs = new URLSearchParams({ env_slug: runEnvSlug });
    const res = await fetch(`${api}/scenarios/${activeId}/run?${runQs}`, {
      method: "POST",
      headers: headers(),
    });
    setRunning(false);
    if (res.ok) {
      const data: RunFlowResponse = await res.json();
      setRunResult(data);
      setResultOpen(true);
      // overlay results on nodes
      setNodes((prev) =>
        prev.map((n) => {
          const step = data.steps.find((s) => s.node_id === n.id);
          if (!step) return n;
          return {
            ...n,
            data: {
              ...n.data,
              runStatus: (step.error || (step.status_code && step.status_code >= 400) || (step.assertions_failed ?? 0) > 0) ? "error" : "success",
              statusCode: step.status_code ?? undefined,
              assertionsPassed: step.assertions_passed ?? 0,
              assertionsFailed: step.assertions_failed ?? 0,
            },
          };
        }),
      );
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.detail || t("orch.runFailed"));
    }
  };

  // ---- update a node's data ----
  const updateNodeData = useCallback(
    (nodeId: string, patch: Partial<NodeData>) => {
      setNodes((prev) =>
        prev.map((n) =>
          n.id === nodeId ? { ...n, data: { ...n.data, ...patch } } : n,
        ),
      );
      setDirty(true);
    },
    [],
  );

  const editingNode = editingNodeId
    ? nodes.find((n) => n.id === editingNodeId) ?? null
    : null;

  // ---- add node via endpoint picker ----
  const handleAiGenerated = useCallback(
    (scenarioId: string) => {
      loadList().then(() => loadScenario(scenarioId));
      setShowAiDialog(false);
    },
    [loadList, loadScenario],
  );

  const handleAddEndpoint = (ep: EndpointOut) => {
    const id = `node_${Date.now()}`;
    setNodes((prev) => {
      const pos =
        dagCanvasRef.current?.getNewNodePosition(prev.length) ??
        { x: 48, y: 48 + prev.length * 140 };
      const newNode: Node<NodeData> = {
        id,
        type: "apiStep",
        position: pos,
        data: {
          label: ep.name,
          endpoint_id: ep.id,
          method: ep.method,
          name: ep.name,
          url: ep.url,
        },
      };
      return [...prev, newNode];
    });
    setDirty(true);
    setShowEpPicker(false);
  };

  return (
    <Box sx={{ display: "flex", height: "100%", minHeight: 0 }}>
      {/* Scenario sidebar */}
      <Box
        sx={{
          width: 240,
          borderRight: 1,
          borderColor: "divider",
          display: "flex",
          flexDirection: "column",
          bgcolor: "background.paper",
          flexShrink: 0,
        }}
      >
        <Stack direction="row" alignItems="center" sx={{ px: 1.5, py: 1, borderBottom: 1, borderColor: "divider" }}>
          <Typography variant="subtitle2" sx={{ flex: 1, fontWeight: 700 }}>{t("orch.scenarios")}</Typography>
          <Tooltip title={t("orch.aiOrchTooltip")}>
            <IconButton size="small" onClick={() => setShowAiDialog(true)} sx={{ color: "#7c3aed" }}>
              <AutoAwesomeIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
          <IconButton size="small" onClick={handleCreate} title={t("orch.newScenarioTitle")}>
            <AddOutlinedIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Stack>
        <List dense sx={{ flex: 1, overflow: "auto", py: 0 }}>
          {scenarios.map((s) => (
            <ListItemButton
              key={s.id}
              selected={activeId === s.id}
              onClick={() => loadScenario(s.id)}
              sx={{ pr: 0.5 }}
            >
              <ListItemText
                primary={s.name}
                secondary={t("orch.stepsCount", { count: s.node_count })}
                primaryTypographyProps={{ fontSize: 13, fontWeight: activeId === s.id ? 700 : 500, noWrap: true }}
                secondaryTypographyProps={{ fontSize: 11 }}
              />
              <IconButton
                size="small"
                onClick={(e) => { e.stopPropagation(); handleDelete(s.id); }}
                sx={{ opacity: 0.4, "&:hover": { opacity: 1 } }}
              >
                <DeleteOutlineIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </ListItemButton>
          ))}
          {scenarios.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ px: 2, py: 3, textAlign: "center" }}>
              {t("orch.noScenarios")}
              <br />
              {t("orch.noScenariosHint")}
            </Typography>
          )}
        </List>
      </Box>

      {/* Main area */}
      <Box sx={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0 }}>
        {activeId ? (
          <>
            {/* Toolbar */}
            <Stack
              direction="row"
              alignItems="center"
              spacing={1}
              sx={{ px: 2, py: 1, borderBottom: 1, borderColor: "divider", bgcolor: "grey.50" }}
            >
              <TextField
                value={scenarioName}
                onChange={(e) => { setScenarioName(e.target.value); setDirty(true); }}
                variant="standard"
                size="small"
                inputProps={{ style: { fontSize: 15, fontWeight: 600 } }}
                sx={{ minWidth: 200 }}
              />
              <Button
                size="small"
                variant="outlined"
                startIcon={<AddOutlinedIcon />}
                onClick={() => setShowEpPicker(true)}
                sx={{ textTransform: "none" }}
              >
                {t("orch.addStep")}
              </Button>
              <Button
                size="small"
                variant="contained"
                onClick={handleSave}
                disabled={!dirty || saving}
                sx={{ textTransform: "none" }}
              >
                {saving ? t("common.saving") : t("common.save")}
              </Button>
              {runEnvironments.length > 0 && (
                <Stack direction="row" alignItems="center" spacing={0.5} sx={{ flexShrink: 0 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, mr: 0.25 }}>
                    {t("common.env")}
                  </Typography>
                  {runEnvironments.map((env) => {
                    const active = env.id === selectedRunEnvId;
                    const color = ENV_COLORS[env.slug] ?? "#6b7280";
                    return (
                      <Tooltip
                        key={env.id}
                        title={
                          env.base_url?.trim()
                            ? `${t("common.baseUrl")}: ${env.base_url.replace(/\/+$/, "")}`
                            : t("orch.noBaseUrlWarn")
                        }
                      >
                        <Chip
                          label={env.slug.toUpperCase()}
                          size="small"
                          onClick={() => setSelectedRunEnvId(env.id)}
                          sx={{
                            height: 22,
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
                      </Tooltip>
                    );
                  })}
                </Stack>
              )}
              <Button
                size="small"
                variant="contained"
                color="success"
                startIcon={running ? <CircularProgress size={16} color="inherit" /> : <PlayArrowIcon />}
                onClick={handleRun}
                disabled={running || nodes.length === 0}
                sx={{ textTransform: "none", fontWeight: 700 }}
              >
                {running ? t("common.running") : t("orch.runFlow")}
              </Button>
              {runEnvironments.length > 0 && (
                <Tooltip title={runBaseUrlPreview ? t("orch.relativePrefix", { url: runBaseUrlPreview }) : t("orch.configureBaseUrl")}>
                  <Typography
                    variant="caption"
                    color={runBaseUrlPreview ? "text.secondary" : "warning.main"}
                    sx={{ maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                  >
                    {runBaseUrlPreview || t("common.noBaseUrl")}
                  </Typography>
                </Tooltip>
              )}
              {dirty && (
                <Typography variant="caption" color="warning.main" fontWeight={600}>
                  {t("orch.unsaved")}
                </Typography>
              )}
              {runResult && !resultOpen && (
                <Button
                  size="small"
                  variant="outlined"
                  color={runResult.failed > 0 ? "error" : "success"}
                  onClick={() => setResultOpen(true)}
                  sx={{ textTransform: "none", fontSize: 12, ml: "auto" }}
                >
                  {t("orch.resultsBtn", { passed: runResult.passed, total: runResult.total_steps })}
                </Button>
              )}
              {error && (
                <Alert severity="error" sx={{ py: 0, ml: "auto" }} onClose={() => setError("")}>
                  {error}
                </Alert>
              )}
            </Stack>

            {/* Canvas + Results drawer container */}
            <Box sx={{ flex: 1, minHeight: 0, position: "relative", overflow: "hidden", display: "flex" }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <DagCanvas
                  ref={dagCanvasRef}
                  nodes={nodes}
                  edges={edges}
                  onNodesChange={handleRfNodesChange}
                  onEdgesChange={handleRfEdgesChange}
                  onConnect={handleRfConnect}
                  onNodeDragStop={handleNodeDragStop}
                  onNodeClick={(nodeId) => { setEditingNodeId(nodeId); setResultOpen(false); }}
                />
              </Box>

              {/* Right-side results panel */}
              <Box
                sx={{
                  width: resultOpen && runResult ? 400 : 0,
                  transition: "width 0.25s ease",
                  overflow: "hidden",
                  flexShrink: 0,
                  borderLeft: resultOpen && runResult ? 2 : 0,
                  borderColor: runResult?.failed ? "error.main" : "success.main",
                  bgcolor: "background.paper",
                }}
              >
                {runResult && (
                  <Box sx={{ width: 400, display: "flex", flexDirection: "column", height: "100%" }}>
                    <Stack
                      direction="row"
                      alignItems="center"
                      spacing={1}
                      sx={{
                        px: 2,
                        py: 1.25,
                        borderBottom: 1,
                        borderColor: "divider",
                        bgcolor: "grey.50",
                        flexShrink: 0,
                      }}
                    >
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: 14 }}>
                        {t("common.results")}
                      </Typography>
                      <Chip
                        label={t("orch.passedChip", { n: runResult.passed })}
                        size="small"
                        color="success"
                        sx={{ height: 22, fontSize: 11, fontWeight: 700 }}
                      />
                      {runResult.failed > 0 && (
                        <Chip
                          label={t("orch.failedChip", { n: runResult.failed })}
                          size="small"
                          color="error"
                          sx={{ height: 22, fontSize: 11, fontWeight: 700 }}
                        />
                      )}
                      {((runResult.assertions_passed ?? 0) + (runResult.assertions_failed ?? 0)) > 0 && (
                        <Chip
                          label={t("orch.assertionsChip", {
                            passed: runResult.assertions_passed ?? 0,
                            total: (runResult.assertions_passed ?? 0) + (runResult.assertions_failed ?? 0),
                          })}
                          size="small"
                          color={(runResult.assertions_failed ?? 0) === 0 ? "success" : "error"}
                          variant="outlined"
                          sx={{ height: 22, fontSize: 11, fontWeight: 700 }}
                        />
                      )}
                      <Box sx={{ flex: 1 }} />
                      <IconButton size="small" onClick={() => setResultOpen(false)}>
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                    <Box sx={{ flex: 1, overflow: "auto" }}>
                      {runResult.steps.map((step, idx) => (
                        <StepResultRow key={step.node_id} step={step} index={idx} />
                      ))}
                    </Box>
                  </Box>
                )}
              </Box>

              {/* Right-side node config panel */}
              <Box
                sx={{
                  width: editingNode && !resultOpen ? 420 : 0,
                  transition: "width 0.25s ease",
                  overflow: "hidden",
                  flexShrink: 0,
                  borderLeft: editingNode && !resultOpen ? 2 : 0,
                  borderColor: "primary.main",
                  bgcolor: "background.paper",
                }}
              >
                {editingNode && (
                  <NodeConfigPanel
                    node={editingNode}
                    onUpdate={(patch) => updateNodeData(editingNode.id, patch)}
                    onClose={() => setEditingNodeId(null)}
                    knownVars={templateVarNames}
                  />
                )}
              </Box>
            </Box>
          </>
        ) : (
          <Box sx={{ flex: 1, display: "grid", placeItems: "center" }}>
            <Box sx={{ textAlign: "center" }}>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                {t("orch.selectOrCreate")}
              </Typography>
              <Stack direction="row" spacing={1.5} justifyContent="center">
                <Button variant="contained" startIcon={<AddOutlinedIcon />} onClick={handleCreate}>
                  {t("orch.newScenario")}
                </Button>
                <Button
                  variant="contained"
                  startIcon={<AutoAwesomeIcon />}
                  onClick={() => setShowAiDialog(true)}
                  sx={{
                    bgcolor: "#7c3aed",
                    "&:hover": { bgcolor: "#6d28d9" },
                  }}
                >
                  {t("orch.aiOrchestrate")}
                </Button>
              </Stack>
            </Box>
          </Box>
        )}
      </Box>

      {/* Endpoint picker dialog */}
      <EndpointPickerDialog
        open={showEpPicker}
        projectId={projectId}
        onClose={() => setShowEpPicker(false)}
        onSelect={handleAddEndpoint}
      />

      {/* AI orchestration dialog */}
      <AiOrchestrationDialog
        open={showAiDialog}
        projectId={projectId}
        onClose={() => setShowAiDialog(false)}
        onGenerated={handleAiGenerated}
      />
    </Box>
  );
}

// ---- KV editor (headers / query params overrides) ----

type KVPair = { key: string; value: string };

function kvFromObj(obj?: Record<string, string> | null): KVPair[] {
  if (!obj || Object.keys(obj).length === 0) return [{ key: "", value: "" }];
  const rows = Object.entries(obj).map(([key, value]) => ({ key, value }));
  rows.push({ key: "", value: "" });
  return rows;
}

function kvToObj(pairs: KVPair[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const { key, value } of pairs) {
    if (key.trim()) out[key.trim()] = value;
  }
  return out;
}

function OverrideKVEditor({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: Record<string, string> | null;
  onChange: (v: Record<string, string>) => void;
}) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<KVPair[]>(() => kvFromObj(value));

  const update = (idx: number, field: "key" | "value", val: string) => {
    const next = [...rows];
    next[idx] = { ...next[idx], [field]: val };
    if (idx === next.length - 1 && next[idx].key.trim()) {
      next.push({ key: "", value: "" });
    }
    setRows(next);
    onChange(kvToObj(next));
  };

  const remove = (idx: number) => {
    const next = rows.filter((_, i) => i !== idx);
    if (next.length === 0) next.push({ key: "", value: "" });
    setRows(next);
    onChange(kvToObj(next));
  };

  return (
    <Box sx={{ mb: 1.5 }}>
      <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ mb: 0.5, display: "block" }}>
        {label}
      </Typography>
      {rows.map((row, i) => (
        <Stack key={i} direction="row" spacing={0.5} sx={{ mb: 0.5 }} alignItems="center">
          <TextField
            size="small"
            placeholder={t("orch.overrideKeyPlaceholder")}
            value={row.key}
            onChange={(e) => update(i, "key", e.target.value)}
            sx={{ flex: 1 }}
            inputProps={{ style: { fontSize: 12, fontFamily: "monospace" } }}
          />
          <TextField
            size="small"
            placeholder={t("orch.overrideValuePlaceholder", { sym: "{{var}}" })}
            value={row.value}
            onChange={(e) => update(i, "value", e.target.value)}
            sx={{ flex: 1.5 }}
            inputProps={{ style: { fontSize: 12, fontFamily: "monospace" } }}
          />
          {rows.length > 1 && i < rows.length - 1 && (
            <IconButton size="small" onClick={() => remove(i)} sx={{ p: 0.25 }}>
              <RemoveCircleOutlineIcon sx={{ fontSize: 16, color: "error.main" }} />
            </IconButton>
          )}
        </Stack>
      ))}
    </Box>
  );
}

// ---- Node config panel ----

function renderVars(text: string, varNames: string[]): string {
  // simple preview: replace {{var}} with "[var]" placeholder to show it's recognized
  return text;
}

function OrcVarHint({ raw, varNames }: { raw: string; varNames: string[] }) {
  const { t } = useTranslation();
  if (!raw || !raw.includes("{{")) return null;
  const matched = varNames.filter((k) => raw.includes(`{{${k}}}`));
  const unmatched = Array.from(raw.matchAll(/\{\{(\w+)\}\}/g)).map((m) => m[1]).filter((k) => !varNames.includes(k));
  if (matched.length === 0 && unmatched.length === 0) return null;
  return (
    <Typography variant="caption" sx={{ display: "block", mt: 0.25, fontSize: 10, fontFamily: "monospace", color: matched.length > 0 && unmatched.length === 0 ? "#7c3aed" : "#d97706" }}>
      {matched.length > 0 && t("orch.willSubstitute", { list: matched.map((k) => `{{${k}}}`).join(" ") })}
      {unmatched.length > 0 && t("orch.undefinedVars", { list: unmatched.map((k) => `{{${k}}}`).join(" ") })}
    </Typography>
  );
}

function NodeConfigPanel({
  node,
  onUpdate,
  onClose,
  knownVars = [],
}: {
  node: Node<NodeData>;
  onUpdate: (patch: Partial<NodeData>) => void;
  onClose: () => void;
  knownVars?: string[];
}) {
  const { t } = useTranslation();
  const d = node.data as NodeData;
  const [tab, setTab] = useState(0);
  const overrides: OverrideFields = d.overrides || {};
  const extracts: ExtractRule[] = d.extracts || [];
  const assertions: AssertionRule[] = d.assertions || [];

  const setOverrides = (patch: Partial<OverrideFields>) => {
    onUpdate({ overrides: { ...overrides, ...patch } });
  };

  const setExtracts = (newExtracts: ExtractRule[]) => {
    onUpdate({ extracts: newExtracts });
  };

  const addExtract = () => {
    setExtracts([...extracts, { var_name: "", source: "body", json_path: "" }]);
  };

  const updateExtract = (idx: number, patch: Partial<ExtractRule>) => {
    const next = extracts.map((r, i) => (i === idx ? { ...r, ...patch } : r));
    setExtracts(next);
  };

  const removeExtract = (idx: number) => {
    setExtracts(extracts.filter((_, i) => i !== idx));
  };

  const setAssertions = (next: AssertionRule[]) => onUpdate({ assertions: next });

  const newAssertion = (): AssertionRule => ({
    id: Math.random().toString(36).slice(2),
    type: "status_code",
    json_path: "",
    header_name: "",
    operator: "eq",
    expected: "200",
  });

  const updateAssertion = (idx: number, patch: Partial<AssertionRule>) => {
    setAssertions(assertions.map((a, i) => (i === idx ? { ...a, ...patch } : a)));
  };

  return (
    <Box sx={{ width: 420, display: "flex", flexDirection: "column", height: "100%" }}>
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{ px: 2, py: 1.25, borderBottom: 1, borderColor: "divider", bgcolor: "grey.50", flexShrink: 0 }}
      >
        <SettingsIcon sx={{ fontSize: 18, color: "primary.main" }} />
        <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: 14, flex: 1 }} noWrap>
          {d.label || d.name || t("orch.stepConfiguration")}
        </Typography>
        <IconButton size="small" onClick={onClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Stack>

      {/* Step label input */}
      <Box sx={{ px: 2, py: 1.25, borderBottom: 1, borderColor: "divider", bgcolor: "#fafafa" }}>
        <TextField
          size="small"
          fullWidth
          label={t("common.stepName")}
          placeholder={d.name || t("orch.stepNamePlaceholder")}
          value={d.label && d.label !== d.name ? d.label : ""}
          onChange={(e) => {
            const v = e.target.value.trim();
            // Empty → fall back to API name so node still has a visible title
            onUpdate({ label: v || (d.name ?? "") });
          }}
          inputProps={{ style: { fontSize: 13, fontWeight: 600 } }}
          helperText={
            d.name
              ? t("orch.apiEndpointHelper", {
                  name: d.name,
                  method: d.method ? ` [${d.method}]` : "",
                })
              : t("orch.clickNodeHint")
          }
          FormHelperTextProps={{ style: { fontSize: 11, marginTop: 2, color: "#9ca3af" } }}
        />
      </Box>

      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{ px: 2, borderBottom: 1, borderColor: "divider", minHeight: 36 }}
      >
        <Tab
          label={
            overrides.url || overrides.body || overrides.headers || overrides.query_params
              ? t("orch.tabOverridesDot")
              : t("orch.tabOverrides")
          }
          sx={{ textTransform: "none", minHeight: 36, fontSize: 13 }}
        />
        <Tab
          label={extracts.length > 0 ? t("orch.tabExtractsCount", { n: extracts.length }) : t("orch.tabExtracts")}
          sx={{ textTransform: "none", minHeight: 36, fontSize: 13 }}
        />
        <Tab
          label={assertions.length > 0 ? t("orch.tabAssertionsCount", { n: assertions.length }) : t("orch.tabAssertions")}
          sx={{ textTransform: "none", minHeight: 36, fontSize: 13 }}
        />
      </Tabs>

      <Box sx={{ flex: 1, overflow: "auto", p: 2 }}>
        {tab === 0 && (
          <>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5, display: "block", lineHeight: 1.45 }}>
              {t("orch.overrideIntro", {
                varSyntax: "{{varName}}",
                runUuidSym: "{{_run_uuid}}",
                runMsSym: "{{_run_ms}}",
              })}
              <br />
              {t("orch.overrideBodyType")}
            </Typography>

            <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ mb: 0.5, display: "block" }}>
              URL
            </Typography>
            <TextField
              size="small"
              fullWidth
              placeholder={d.url || t("orch.urlPlaceholder")}
              value={overrides.url || ""}
              onChange={(e) => setOverrides({ url: e.target.value || null })}
              inputProps={{ style: { fontSize: 12, fontFamily: "monospace" } }}
              sx={{ mb: 0.25 }}
            />
            <OrcVarHint raw={overrides.url || ""} varNames={knownVars} />
            <Box sx={{ mb: 1.25 }} />

            <OverrideKVEditor
              label={t("common.headers")}
              value={overrides.headers}
              onChange={(v) => setOverrides({ headers: Object.keys(v).length ? v : null })}
            />

            <OverrideKVEditor
              label={t("common.queryParams")}
              value={overrides.query_params}
              onChange={(v) => setOverrides({ query_params: Object.keys(v).length ? v : null })}
            />

            <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ mb: 0.5, display: "block" }}>
              {t("common.body")}
            </Typography>
            <TextField
              size="small"
              fullWidth
              multiline
              minRows={3}
              maxRows={8}
              placeholder='e.g. {"email":"user{{_run_uuid}}@test.com","password":"secret"}'
              value={overrides.body || ""}
              onChange={(e) => setOverrides({ body: e.target.value || null })}
              inputProps={{ style: { fontSize: 12, fontFamily: "monospace" } }}
              sx={{ mb: 0.25 }}
            />
            <OrcVarHint raw={overrides.body || ""} varNames={knownVars} />
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
              <Typography variant="caption" fontWeight={700} color="text.secondary">{t("common.bodyType")}</Typography>
              <Select
                size="small"
                value={
                  overrides.body_type === null || overrides.body_type === ""
                    ? ""
                    : (overrides.body_type ?? "json")
                }
                onChange={(e) => {
                  const v = e.target.value;
                  setOverrides({ body_type: v === "" ? null : v });
                }}
                displayEmpty
                sx={{ fontSize: 12, minWidth: 120 }}
              >
                <MenuItem value="" sx={{ fontSize: 12 }}>{t("common.useOriginal")}</MenuItem>
                <MenuItem value="json" sx={{ fontSize: 12 }}>{t("common.json")}</MenuItem>
                <MenuItem value="text" sx={{ fontSize: 12 }}>{t("common.text")}</MenuItem>
                <MenuItem value="form" sx={{ fontSize: 12 }}>{t("common.form")}</MenuItem>
                <MenuItem value="none" sx={{ fontSize: 12 }}>{t("common.none")}</MenuItem>
              </Select>
            </Stack>
            {(overrides.body || "").trim() !== "" && overrides.body_type === null && (
              <Typography variant="caption" color="warning.main" sx={{ display: "block", mt: 0.75, lineHeight: 1.4 }}>
                <Trans i18nKey="orch.useOriginalWarn" components={{ strong: <strong /> }} />
              </Typography>
            )}
          </>
        )}

        {tab === 1 && (
          <>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5, display: "block" }}>
              {t("orch.extractIntro", { sym: "{{var}}" })}
            </Typography>

            {extracts.map((rule, idx) => (
              <Box
                key={idx}
                sx={{ mb: 1.5, p: 1.5, border: 1, borderColor: "divider", borderRadius: 1, bgcolor: "grey.50" }}
              >
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                  <TextField
                    size="small"
                    label={t("common.variableName")}
                    placeholder={t("orch.varPlaceholder")}
                    value={rule.var_name}
                    onChange={(e) => updateExtract(idx, { var_name: e.target.value })}
                    inputProps={{ style: { fontSize: 12, fontFamily: "monospace" } }}
                    sx={{ flex: 1 }}
                  />
                  <Select
                    size="small"
                    value={rule.source}
                    onChange={(e) => updateExtract(idx, { source: e.target.value as ExtractRule["source"] })}
                    sx={{ fontSize: 12, minWidth: 100 }}
                  >
                    <MenuItem value="body" sx={{ fontSize: 12 }}>{t("common.body")}</MenuItem>
                    <MenuItem value="header" sx={{ fontSize: 12 }}>{t("common.header")}</MenuItem>
                    <MenuItem value="status" sx={{ fontSize: 12 }}>{t("common.status")}</MenuItem>
                  </Select>
                  <IconButton size="small" onClick={() => removeExtract(idx)}>
                    <RemoveCircleOutlineIcon sx={{ fontSize: 16, color: "error.main" }} />
                  </IconButton>
                </Stack>
                {rule.source !== "status" && (
                  <TextField
                    size="small"
                    fullWidth
                    label={rule.source === "body" ? t("common.jsonPath") : t("common.headerName")}
                    placeholder={rule.source === "body" ? "$.access_token  or  $.data[0].id" : "Authorization"}
                    value={rule.json_path}
                    onChange={(e) => updateExtract(idx, { json_path: e.target.value })}
                    inputProps={{ style: { fontSize: 12, fontFamily: "monospace" } }}
                  />
                )}
              </Box>
            ))}

            <Button
              size="small"
              variant="outlined"
              startIcon={<AddCircleOutlineIcon />}
              onClick={addExtract}
              sx={{ textTransform: "none", fontSize: 12 }}
            >
              {t("common.addExtractRule")}
            </Button>
          </>
        )}

        {tab === 2 && (
          <>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: "block" }}>
              {t("orch.assertIntro", { sym: "{{var}}" })}
            </Typography>
            {knownVars.length > 0 && (
              <Typography variant="caption" sx={{ display: "block", mb: 1.5, color: "#7c3aed", fontFamily: "monospace", fontSize: 11 }}>
                {t("orch.availableVarsOrc")} {knownVars.map((k) => `{{${k}}}`).join("  ")}
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
                      const t = e.target.value as AssertionRule["type"];
                      updateAssertion(idx, {
                        type: t,
                        operator: t === "response_time" ? "lt" : "eq",
                        expected: t === "status_code" ? "200" : "",
                      });
                    }}
                    sx={{ fontSize: 12, minWidth: 130 }}
                  >
                    <MenuItem value="status_code" sx={{ fontSize: 12 }}>{t("common.statusCode")}</MenuItem>
                    <MenuItem value="response_time" sx={{ fontSize: 12 }}>{t("common.responseTime")}</MenuItem>
                    <MenuItem value="json_path" sx={{ fontSize: 12 }}>{t("common.jsonPathType")}</MenuItem>
                    <MenuItem value="header" sx={{ fontSize: 12 }}>{t("common.header")}</MenuItem>
                    <MenuItem value="body_contains" sx={{ fontSize: 12 }}>{t("common.bodyContains")}</MenuItem>
                  </Select>
                  <Select
                    size="small"
                    value={a.operator}
                    onChange={(e) => updateAssertion(idx, { operator: e.target.value as AssertionRule["operator"] })}
                    sx={{ fontSize: 12, minWidth: 110 }}
                  >
                    {(a.type === "status_code" || a.type === "response_time"
                      ? ["eq", "ne", "gt", "lt", "gte", "lte"]
                      : a.type === "body_contains"
                        ? ["contains", "not_contains", "matches"]
                        : ["eq", "ne", "contains", "not_contains", "exists", "not_exists", "matches"]
                    ).map((op) => (
                      <MenuItem key={op} value={op} sx={{ fontSize: 12 }}>{op}</MenuItem>
                    ))}
                  </Select>
                  <IconButton size="small" onClick={() => setAssertions(assertions.filter((_, i) => i !== idx))}>
                    <RemoveCircleOutlineIcon sx={{ fontSize: 16, color: "error.main" }} />
                  </IconButton>
                </Stack>
                {a.type === "json_path" && (
                  <Box sx={{ mb: 1 }}>
                    <TextField
                      size="small" fullWidth label={t("common.jsonPath")} placeholder="$.data.id  or  $.data.{{field}}"
                      value={a.json_path}
                      onChange={(e) => updateAssertion(idx, { json_path: e.target.value })}
                      inputProps={{ style: { fontSize: 12, fontFamily: "monospace" } }}
                    />
                    <OrcVarHint raw={a.json_path} varNames={knownVars} />
                  </Box>
                )}
                {a.type === "header" && (
                  <Box sx={{ mb: 1 }}>
                    <TextField
                      size="small" fullWidth label={t("common.headerName")} placeholder="content-type"
                      value={a.header_name}
                      onChange={(e) => updateAssertion(idx, { header_name: e.target.value })}
                      inputProps={{ style: { fontSize: 12, fontFamily: "monospace" } }}
                    />
                    <OrcVarHint raw={a.header_name} varNames={knownVars} />
                  </Box>
                )}
                {!["exists", "not_exists"].includes(a.operator) && (
                  <Box>
                    <TextField
                      size="small" fullWidth
                      label={a.type === "response_time" ? t("orch.expectedMsShort", { sym: "{{var}}" }) : t("orch.expectedSupports", { sym: "{{var}}" })}
                      placeholder={
                        a.type === "status_code" ? "200  or  {{expected_code}}"
                        : a.type === "response_time" ? "2000  or  {{max_ms}}"
                        : "value  or  {{upstream_var}}"
                      }
                      value={a.expected}
                      onChange={(e) => updateAssertion(idx, { expected: e.target.value })}
                      inputProps={{ style: { fontSize: 12, fontFamily: "monospace" } }}
                    />
                    <OrcVarHint raw={a.expected} varNames={knownVars} />
                  </Box>
                )}
              </Box>
            ))}
            <Button
              size="small"
              variant="outlined"
              startIcon={<AddCircleOutlineIcon />}
              onClick={() => setAssertions([...assertions, newAssertion()])}
              sx={{ textTransform: "none", fontSize: 12 }}
            >
              {t("common.addAssertion")}
            </Button>
          </>
        )}
      </Box>
    </Box>
  );
}

// ---- step result row ----

function StepResultRow({ step, index }: { step: RunStepResult; index: number }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const assertionsFailed = step.assertions_failed ?? 0;
  const isOk = !step.error && step.status_code !== null && step.status_code < 400 && assertionsFailed === 0;

  return (
    <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{ px: 2, py: 0.75, cursor: "pointer", "&:hover": { bgcolor: "action.hover" } }}
        onClick={() => setExpanded(!expanded)}
      >
        {isOk ? (
          <CheckCircleIcon sx={{ fontSize: 18, color: "success.main" }} />
        ) : (
          <ErrorIcon sx={{ fontSize: 18, color: "error.main" }} />
        )}
        <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", width: 24 }}>
          #{index + 1}
        </Typography>
        {step.method && (
          <Chip
            label={step.method}
            size="small"
            sx={{
              height: 18,
              fontSize: 10,
              fontWeight: 700,
              minWidth: 42,
              bgcolor: `${METHOD_COLORS[step.method] || "#6b7280"}18`,
              color: METHOD_COLORS[step.method] || "#6b7280",
            }}
          />
        )}
        <Typography variant="body2" sx={{ fontSize: 12, fontWeight: 600, flex: 1 }} noWrap>
          {step.endpoint_name || step.node_id}
        </Typography>
        {step.status_code && (
          <Chip
            label={step.status_code}
            size="small"
            color={step.status_code < 300 ? "success" : step.status_code < 400 ? "info" : step.status_code < 500 ? "warning" : "error"}
            sx={{ height: 20, fontSize: 11, fontWeight: 700 }}
          />
        )}
        <Typography variant="caption" color="text.secondary">{step.elapsed_ms.toFixed(0)} {t("common.ms")}</Typography>
        {(step.assertions_passed ?? 0) + assertionsFailed > 0 && (
          <Chip
            label={`${step.assertions_passed ?? 0}/${(step.assertions_passed ?? 0) + assertionsFailed}`}
            size="small"
            color={assertionsFailed === 0 ? "success" : "error"}
            sx={{ height: 18, fontSize: 10, fontWeight: 700 }}
          />
        )}
        {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
      </Stack>
      <Collapse in={expanded}>
        <Box sx={{ px: 2, pb: 1 }}>
          {step.error && <Alert severity="error" sx={{ mb: 1, py: 0, fontSize: 12 }}>{step.error}</Alert>}
          {step.url && (
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
              {step.url}
            </Typography>
          )}
          {step.assertion_results && step.assertion_results.length > 0 && (
            <Box sx={{ mb: 1 }}>
              <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
                {t("common.assertions")}
              </Typography>
              {step.assertion_results.map((r: AssertionResult, i: number) => (
                <Stack
                  key={r.id || i}
                  direction="row"
                  spacing={1}
                  alignItems="flex-start"
                  sx={{
                    mb: 0.4,
                    p: 0.6,
                    borderRadius: 1,
                    bgcolor: r.passed ? "#f0fdf4" : "#fef2f2",
                    border: 1,
                    borderColor: r.passed ? "#bbf7d0" : "#fecaca",
                  }}
                >
                  <Typography sx={{ fontSize: 12, fontWeight: 700, color: r.passed ? "#16a34a" : "#dc2626", mt: "1px" }}>
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
                  </Box>
                </Stack>
              ))}
            </Box>
          )}

          {step.extracted_vars && Object.keys(step.extracted_vars).length > 0 && (
            <Box sx={{ mb: 1, p: 1, bgcolor: "#dbeafe", borderRadius: 1 }}>
              <Typography variant="caption" fontWeight={700} color="primary.main" sx={{ display: "block", mb: 0.5 }}>
                {t("common.extractedVars")}
              </Typography>
              {Object.entries(step.extracted_vars).map(([k, v]) => (
                <Stack key={k} direction="row" spacing={1} alignItems="baseline" sx={{ mb: 0.25 }}>
                  <Typography
                    variant="caption"
                    sx={{ fontWeight: 700, fontFamily: "monospace", color: "#2563eb", minWidth: 80 }}
                  >
                    {`{{${k}}}`}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      fontFamily: "monospace",
                      color: "text.primary",
                      wordBreak: "break-all",
                    }}
                  >
                    {v.length > 120 ? v.slice(0, 120) + "…" : v}
                  </Typography>
                </Stack>
              ))}
            </Box>
          )}
          {step.response_body && (
            <Box
              sx={{
                bgcolor: "grey.100",
                borderRadius: 1,
                p: 1,
                minHeight: 220,
                maxHeight: "min(52vh, 520px)",
                overflow: "auto",
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 11,
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
              }}
            >
              {tryPretty(step.response_body)}
            </Box>
          )}
        </Box>
      </Collapse>
    </Box>
  );
}

function tryPretty(body: string): string {
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
  }
}

// ---- endpoint picker dialog ----

function EndpointPickerDialog({
  open,
  projectId,
  onClose,
  onSelect,
}: {
  open: boolean;
  projectId: string;
  onClose: () => void;
  onSelect: (ep: EndpointOut) => void;
}) {
  const { t } = useTranslation();
  const [tree, setTree] = useState<FolderTree[]>([]);

  useEffect(() => {
    if (!open) return;
    fetch(`/api/projects/${projectId}/folders/tree`, { headers: headers() })
      .then((r) => r.ok ? r.json() : [])
      .then(setTree)
      .catch(() => setTree([]));
  }, [open, projectId]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{t("orch.selectEndpointTitle")}</DialogTitle>
      <DialogContent sx={{ p: 0 }}>
        {tree.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ p: 3, textAlign: "center" }}>
            {t("orch.noEndpointsHint")}
          </Typography>
        )}
        {tree.map((folder) => (
          <FolderPickerNode key={folder.id} folder={folder} onSelect={onSelect} depth={0} />
        ))}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.cancel")}</Button>
      </DialogActions>
    </Dialog>
  );
}

function FolderPickerNode({
  folder,
  onSelect,
  depth,
}: {
  folder: FolderTree;
  onSelect: (ep: EndpointOut) => void;
  depth: number;
}) {
  return (
    <>
      <Typography
        variant="caption"
        sx={{ pl: 2 + depth * 2, py: 0.5, display: "block", fontWeight: 700, color: "text.secondary", bgcolor: "grey.50" }}
      >
        {folder.name}
      </Typography>
      {folder.endpoints.map((ep) => (
        <ListItemButton
          key={ep.id}
          onClick={() => onSelect(ep)}
          sx={{ pl: 3 + depth * 2, py: 0.5 }}
        >
          <Chip
            label={ep.method}
            size="small"
            sx={{
              height: 18,
              fontSize: 10,
              fontWeight: 700,
              mr: 1,
              minWidth: 42,
              bgcolor: `${METHOD_COLORS[ep.method] || "#6b7280"}18`,
              color: METHOD_COLORS[ep.method] || "#6b7280",
            }}
          />
          <ListItemText
            primary={ep.name}
            secondary={ep.url}
            primaryTypographyProps={{ fontSize: 13, fontWeight: 600 }}
            secondaryTypographyProps={{ fontSize: 11, noWrap: true }}
          />
        </ListItemButton>
      ))}
      {folder.children.map((child) => (
        <FolderPickerNode key={child.id} folder={child} onSelect={onSelect} depth={depth + 1} />
      ))}
    </>
  );
}

// ---- AI Orchestration dialog ----

function AiOrchestrationDialog({
  open,
  projectId,
  onClose,
  onGenerated,
}: {
  open: boolean;
  projectId: string;
  onClose: () => void;
  onGenerated: (scenarioId: string) => void;
}) {
  const { t } = useTranslation();
  const promptExamples = t("orchAiExamples", { returnObjects: true }) as string[];
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setPrompt("");
      setError("");
      setGenerating(false);
    }
  }, [open]);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setGenerating(true);
    setError("");

    try {
      const res = await fetch(`/api/projects/${projectId}/scenarios/ai-generate`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ prompt: prompt.trim() }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail || `Generation failed (HTTP ${res.status})`);
      }
      const data = await res.json();
      onGenerated(data.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("orch.generationFailed"));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={open} onClose={generating ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <AutoAwesomeIcon sx={{ color: "#7c3aed" }} />
        {t("orch.aiDialogTitle")}
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t("orch.aiDialogBody")}
        </Typography>
        <TextField
          autoFocus
          fullWidth
          multiline
          minRows={3}
          maxRows={8}
          placeholder={t("orch.aiPromptPlaceholder")}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={generating}
          sx={{ mb: 1.5 }}
          inputProps={{ style: { fontSize: 14 } }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !generating && prompt.trim()) {
              handleGenerate();
            }
          }}
        />
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
          {promptExamples.map((ex) => (
            <Chip
              key={ex}
              label={ex}
              size="small"
              variant="outlined"
              onClick={() => !generating && setPrompt(ex)}
              sx={{
                fontSize: 11,
                cursor: "pointer",
                borderColor: "#d4d4d8",
                "&:hover": { borderColor: "#7c3aed", color: "#7c3aed" },
              }}
            />
          ))}
        </Box>
        {error && (
          <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError("")}>
            {error}
          </Alert>
        )}
        {generating && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mt: 2, p: 1.5, bgcolor: "#f5f3ff", borderRadius: 1 }}>
            <CircularProgress size={20} sx={{ color: "#7c3aed" }} />
            <Typography variant="body2" sx={{ color: "#7c3aed", fontWeight: 600 }}>
              {t("orch.aiWorking")}
            </Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={generating}>
          {t("common.cancel")}
        </Button>
        <Button
          variant="contained"
          onClick={handleGenerate}
          disabled={generating || !prompt.trim()}
          startIcon={generating ? <CircularProgress size={16} color="inherit" /> : <AutoAwesomeIcon />}
          sx={{
            bgcolor: "#7c3aed",
            "&:hover": { bgcolor: "#6d28d9" },
            textTransform: "none",
            fontWeight: 700,
          }}
        >
          {generating ? t("common.generating") : t("orch.generateScenario")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
