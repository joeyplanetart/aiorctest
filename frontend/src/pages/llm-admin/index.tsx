import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import SmartToyOutlinedIcon from "@mui/icons-material/SmartToyOutlined";
import BarChartOutlinedIcon from "@mui/icons-material/BarChartOutlined";
import ListAltOutlinedIcon from "@mui/icons-material/ListAltOutlined";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import { getToken } from "@/providers/authProvider";

function headers(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${getToken()}`,
  };
}

interface LlmConfig {
  model_name: string;
  api_base: string | null;
  updated_at: string | null;
}

interface UsageRecord {
  id: string;
  user_id: string | null;
  user_email: string | null;
  project_id: string | null;
  project_name: string | null;
  model: string;
  feature: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  prompt_summary: string | null;
  created_at: string;
}

interface UsageStatsDay {
  date: string;
  total_tokens: number;
  prompt_tokens: number;
  completion_tokens: number;
  count: number;
}

interface UsageSummary {
  total_calls: number;
  total_tokens: number;
  total_prompt_tokens: number;
  total_completion_tokens: number;
  by_model: Record<string, number>;
}

const PRESET_MODELS = [
  "gpt-4o-mini",
  "gpt-4o",
  "gpt-4-turbo",
  "gpt-3.5-turbo",
  "claude-3-5-sonnet-20241022",
  "claude-3-haiku-20240307",
  "deepseek-chat",
  "deepseek-reasoner",
];

function formatTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function daysLabel(d: number) {
  return d >= 365 ? "1 year" : `${d} days`;
}

export function LlmAdminPage() {
  const [config, setConfig] = useState<LlmConfig | null>(null);
  const [selectedModel, setSelectedModel] = useState("");
  const [customModel, setCustomModel] = useState("");
  const [configSaving, setConfigSaving] = useState(false);
  const [configMsg, setConfigMsg] = useState("");
  const [error, setError] = useState("");

  const [records, setRecords] = useState<UsageRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [recordsDays, setRecordsDays] = useState(30);

  const [stats, setStats] = useState<UsageStatsDay[]>([]);
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsDays, setStatsDays] = useState(30);

  const loadConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/llm/config", { headers: headers() });
      if (res.ok) {
        const data: LlmConfig = await res.json();
        setConfig(data);
        if (PRESET_MODELS.includes(data.model_name)) {
          setSelectedModel(data.model_name);
          setCustomModel("");
        } else {
          setSelectedModel("custom");
          setCustomModel(data.model_name);
        }
      }
    } catch { /* ignore */ }
  }, []);

  const loadRecords = useCallback(async () => {
    setRecordsLoading(true);
    try {
      const res = await fetch(`/api/llm/usage?days=${recordsDays}&limit=200`, { headers: headers() });
      if (res.ok) setRecords(await res.json());
    } catch { /* ignore */ }
    setRecordsLoading(false);
  }, [recordsDays]);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const [statsRes, summaryRes] = await Promise.all([
        fetch(`/api/llm/usage/stats?days=${statsDays}`, { headers: headers() }),
        fetch(`/api/llm/usage/summary?days=${statsDays}`, { headers: headers() }),
      ]);
      if (statsRes.ok) setStats(await statsRes.json());
      if (summaryRes.ok) setSummary(await summaryRes.json());
    } catch { /* ignore */ }
    setStatsLoading(false);
  }, [statsDays]);

  useEffect(() => { loadConfig(); }, [loadConfig]);
  useEffect(() => { loadRecords(); }, [loadRecords]);
  useEffect(() => { loadStats(); }, [loadStats]);

  const handleSaveConfig = async () => {
    const modelName = selectedModel === "custom" ? customModel.trim() : selectedModel;
    if (!modelName) { setError("Please select or enter a model name"); return; }
    setConfigSaving(true);
    setConfigMsg("");
    setError("");
    try {
      const res = await fetch("/api/llm/config", {
        method: "PUT",
        headers: headers(),
        body: JSON.stringify({ model_name: modelName }),
      });
      if (res.ok) {
        const data: LlmConfig = await res.json();
        setConfig(data);
        setConfigMsg("Model configuration saved");
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d.detail || "Save failed");
      }
    } catch { setError("Network error"); }
    setConfigSaving(false);
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, flex: 1 }}>
      {/* Header */}
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h4">LLM Management</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 720 }}>
            Configure the LLM model used by AI orchestration, and review token consumption records and trend charts.
          </Typography>
        </Box>
      </Stack>

      {error && <Typography color="error" sx={{ mb: 2 }} variant="body2">{error}</Typography>}

      {/* Summary stat cards */}
      <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ mb: 3 }}>
        <Card sx={{ flex: 1, bgcolor: (t) => alpha(t.palette.primary.main, 0.1), border: "none" }}>
          <CardContent>
            <Typography variant="body2" color="text.secondary" fontWeight={600}>
              Active model
            </Typography>
            <Typography variant="h3" fontWeight={800} color="primary.dark" noWrap>
              {config?.model_name ?? "—"}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Current LLM model
            </Typography>
          </CardContent>
        </Card>
        <Card sx={{ flex: 1, bgcolor: (t) => alpha("#e8a87c", 0.25), border: "none" }}>
          <CardContent>
            <Typography variant="body2" color="text.secondary" fontWeight={600}>
              Total calls
            </Typography>
            <Typography variant="h3" fontWeight={800} sx={{ color: "#b45309" }}>
              {summary?.total_calls ?? "—"}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Last {daysLabel(statsDays)}
            </Typography>
          </CardContent>
        </Card>
        <Card sx={{ flex: 1, bgcolor: (t) => alpha(t.palette.success.main, 0.08), border: "none" }}>
          <CardContent>
            <Typography variant="body2" color="text.secondary" fontWeight={600}>
              Token usage
            </Typography>
            <Typography variant="h3" fontWeight={800} color="success.dark">
              {summary ? formatTokens(summary.total_tokens) : "—"}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Prompt {summary ? formatTokens(summary.total_prompt_tokens) : "—"} / Completion {summary ? formatTokens(summary.total_completion_tokens) : "—"}
            </Typography>
          </CardContent>
        </Card>
      </Stack>

      {/* Content: left = model config, right = chart & records */}
      <Stack direction={{ xs: "column", lg: "row" }} spacing={3} alignItems="stretch">
        {/* Left: Model config */}
        <Card sx={{ width: { xs: "100%", lg: 340 }, flexShrink: 0 }}>
          <CardContent>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
              <SmartToyOutlinedIcon color="primary" sx={{ fontSize: 20 }} />
              <Typography variant="subtitle2" fontWeight={700}>
                Model configuration
              </Typography>
            </Stack>

            {config && (
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                <CheckCircleIcon sx={{ color: "success.main", fontSize: 16 }} />
                <Typography variant="caption" fontWeight={600}>
                  Active: <Chip label={config.model_name} size="small" sx={{ fontWeight: 700, ml: 0.5, height: 22, fontSize: 11 }} />
                </Typography>
              </Stack>
            )}

            <FormControl fullWidth size="small" sx={{ mb: 2 }}>
              <InputLabel>Select model</InputLabel>
              <Select
                value={selectedModel}
                label="Select model"
                onChange={(e) => {
                  setSelectedModel(e.target.value);
                  if (e.target.value !== "custom") setCustomModel("");
                }}
              >
                {PRESET_MODELS.map((m) => (
                  <MenuItem key={m} value={m}>{m}</MenuItem>
                ))}
                <Divider />
                <MenuItem value="custom">Custom model...</MenuItem>
              </Select>
            </FormControl>

            {selectedModel === "custom" && (
              <TextField
                fullWidth
                size="small"
                label="Model name"
                placeholder="e.g. openai/gpt-4o-mini"
                value={customModel}
                onChange={(e) => setCustomModel(e.target.value)}
                sx={{ mb: 2 }}
              />
            )}

            <Button
              variant="contained"
              color="secondary"
              size="small"
              startIcon={configSaving ? <CircularProgress size={14} color="inherit" /> : <SaveOutlinedIcon />}
              onClick={handleSaveConfig}
              disabled={configSaving}
            >
              {configSaving ? "Saving…" : "Save configuration"}
            </Button>

            {configMsg && <Alert severity="success" sx={{ mt: 2 }}>{configMsg}</Alert>}

            <Divider sx={{ my: 2.5 }} />

            <Typography variant="caption" color="text.secondary" display="block" sx={{ lineHeight: 1.6 }}>
              API Base URL and API Key are configured via backend environment variables <strong>OPENAI_API_BASE</strong> and <strong>OPENAI_API_KEY</strong>.
              Supports OpenAI, OpenRouter, and other compatible APIs.
            </Typography>
          </CardContent>
        </Card>

        {/* Right: Charts + Records */}
        <Card sx={{ flex: 1, minWidth: 0 }}>
          <CardContent>
            {/* Charts section */}
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
              <BarChartOutlinedIcon color="primary" sx={{ fontSize: 20 }} />
              <Typography variant="subtitle2" fontWeight={700} sx={{ flex: 1 }}>
                Usage trends
              </Typography>
              <FormControl size="small" sx={{ minWidth: 100 }}>
                <Select
                  value={statsDays}
                  onChange={(e) => setStatsDays(Number(e.target.value))}
                  size="small"
                  sx={{ fontSize: 12 }}
                >
                  <MenuItem value={7} sx={{ fontSize: 12 }}>Last 7 days</MenuItem>
                  <MenuItem value={14} sx={{ fontSize: 12 }}>Last 14 days</MenuItem>
                  <MenuItem value={30} sx={{ fontSize: 12 }}>Last 30 days</MenuItem>
                  <MenuItem value={90} sx={{ fontSize: 12 }}>Last 90 days</MenuItem>
                </Select>
              </FormControl>
              {statsLoading && <CircularProgress size={16} />}
            </Stack>

            {stats.length > 0 && stats.some((s) => s.total_tokens > 0) ? (
              <>
                <Box sx={{ mb: 3 }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ mb: 1, display: "block" }}>
                    Token consumption
                  </Typography>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={stats} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v: string) => v.slice(5)} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => formatTokens(v)} />
                      <RechartsTooltip
                        formatter={(value: number, name: string) => [
                          value.toLocaleString(),
                          name === "prompt_tokens" ? "Prompt" : "Completion",
                        ]}
                        labelFormatter={(label: string) => `Date: ${label}`}
                      />
                      <Legend formatter={(v: string) => (v === "prompt_tokens" ? "Prompt" : "Completion")} />
                      <Bar dataKey="prompt_tokens" stackId="a" fill="#1976d2" />
                      <Bar dataKey="completion_tokens" stackId="a" fill="#90caf9" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </Box>

                <Box sx={{ mb: 3 }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ mb: 1, display: "block" }}>
                    Call count
                  </Typography>
                  <ResponsiveContainer width="100%" height={160}>
                    <AreaChart data={stats} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v: string) => v.slice(5)} />
                      <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                      <RechartsTooltip
                        formatter={(value: number) => [value, "Calls"]}
                        labelFormatter={(label: string) => `Date: ${label}`}
                      />
                      <Area type="monotone" dataKey="count" stroke="#1976d2" fill="#bbdefb" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </Box>
              </>
            ) : (
              !statsLoading && (
                <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: "center" }}>
                  No usage data yet. Trend charts will appear after using AI orchestration.
                </Typography>
              )
            )}

            <Divider sx={{ my: 2 }} />

            {/* Records section */}
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
              <ListAltOutlinedIcon color="primary" sx={{ fontSize: 20 }} />
              <Typography variant="subtitle2" fontWeight={700} sx={{ flex: 1 }}>
                Usage records
              </Typography>
              <FormControl size="small" sx={{ minWidth: 100 }}>
                <Select
                  value={recordsDays}
                  onChange={(e) => setRecordsDays(Number(e.target.value))}
                  size="small"
                  sx={{ fontSize: 12 }}
                >
                  <MenuItem value={7} sx={{ fontSize: 12 }}>Last 7 days</MenuItem>
                  <MenuItem value={30} sx={{ fontSize: 12 }}>Last 30 days</MenuItem>
                  <MenuItem value={90} sx={{ fontSize: 12 }}>Last 90 days</MenuItem>
                  <MenuItem value={365} sx={{ fontSize: 12 }}>Last year</MenuItem>
                </Select>
              </FormControl>
              <Button
                size="small"
                variant="outlined"
                color="inherit"
                onClick={loadRecords}
                disabled={recordsLoading}
                startIcon={recordsLoading ? <CircularProgress size={14} /> : <RefreshOutlinedIcon sx={{ fontSize: 16 }} />}
                sx={{ textTransform: "none", fontSize: 12, minWidth: 0, px: 1.5 }}
              >
                Refresh
              </Button>
            </Stack>

            {records.length > 0 ? (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Time</TableCell>
                      <TableCell>Model</TableCell>
                      <TableCell>User</TableCell>
                      <TableCell>Project</TableCell>
                      <TableCell align="right">Prompt</TableCell>
                      <TableCell align="right">Completion</TableCell>
                      <TableCell align="right">Total</TableCell>
                      <TableCell>Summary</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {records.map((r) => (
                      <TableRow key={r.id} hover>
                        <TableCell sx={{ whiteSpace: "nowrap", fontSize: 12 }}>
                          {new Date(r.created_at).toLocaleString("en-US", {
                            month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit",
                          })}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={r.model}
                            size="small"
                            color="primary"
                            variant="outlined"
                            sx={{ fontSize: 11, fontWeight: 600, height: 22 }}
                          />
                        </TableCell>
                        <TableCell sx={{ fontSize: 12 }}>{r.user_email || "—"}</TableCell>
                        <TableCell sx={{ fontSize: 12 }}>
                          <Tooltip title={r.project_id || ""}>
                            <span>{r.project_name || "—"}</span>
                          </Tooltip>
                        </TableCell>
                        <TableCell align="right" sx={{ fontSize: 12, fontFamily: "monospace" }}>
                          {r.prompt_tokens.toLocaleString()}
                        </TableCell>
                        <TableCell align="right" sx={{ fontSize: 12, fontFamily: "monospace" }}>
                          {r.completion_tokens.toLocaleString()}
                        </TableCell>
                        <TableCell align="right" sx={{ fontSize: 12, fontFamily: "monospace", fontWeight: 700 }}>
                          {r.total_tokens.toLocaleString()}
                        </TableCell>
                        <TableCell sx={{ fontSize: 11, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          <Tooltip title={r.prompt_summary || ""}>
                            <span>{r.prompt_summary || "—"}</span>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              !recordsLoading && (
                <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: "center" }}>
                  No usage records yet. Records will appear after using AI orchestration.
                </Typography>
              )
            )}
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
}
