import { useParams, useNavigate } from "react-router";
import { useEffect, useState, useCallback } from "react";
import {
  Box,
  Typography,
  Select,
  MenuItem,
  Stack,
  Chip,
} from "@mui/material";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import { getToken } from "@/providers/authProvider";
import { setLastProject } from "@/lib/lastProject";
import type { ProjectListItem } from "@/types/auth";
import { useTranslation } from "react-i18next";
import { formatProjectRole } from "@/lib/roles";
import { OrchestrationPage } from "./index";

export function OrchestrationPageWrapper() {
  const { t } = useTranslation();
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectListItem[]>([]);

  const loadProjects = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    const res = await fetch("/api/projects", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const list: ProjectListItem[] = await res.json();
      setProjects(list);
      const current = list.find((p) => p.id === projectId);
      if (current) setLastProject(current.id, current.name);
    }
  }, [projectId]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  if (!projectId) {
    return (
      <Box sx={{ p: 4 }}>
        <Typography color="error">{t("wrappers.projectRequired")}</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <Box
        sx={{
          px: 2.5,
          py: 1,
          borderBottom: 1,
          borderColor: "divider",
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          bgcolor: "background.paper",
          flexShrink: 0,
        }}
      >
        <Typography variant="subtitle2" sx={{ color: "text.secondary", fontSize: 13 }}>
          {t("wrappers.projectLabel")}
        </Typography>
        <Select
          value={projectId}
          onChange={(e) => navigate(`/projects/${e.target.value}/orchestration`)}
          size="small"
          variant="outlined"
          sx={{
            minWidth: 200,
            fontSize: 14,
            fontWeight: 600,
            "& .MuiSelect-select": { py: 0.5 },
          }}
          startAdornment={<SwapHorizIcon sx={{ fontSize: 18, mr: 0.5, color: "text.secondary" }} />}
        >
          {projects.map((p) => (
            <MenuItem key={p.id} value={p.id}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <span>{p.name}</span>
                <Chip
                  label={formatProjectRole(p.role)}
                  size="small"
                  sx={{ height: 18, fontSize: 10, fontWeight: 700 }}
                  color={p.role === "admin" ? "primary" : "default"}
                  variant="outlined"
                />
              </Stack>
            </MenuItem>
          ))}
        </Select>
        <Typography variant="body2" sx={{ color: "text.disabled", ml: "auto", fontSize: 12 }}>
          {t("wrappers.orchestration")}
        </Typography>
      </Box>
      <Box sx={{ flex: 1, overflow: "hidden" }}>
        <OrchestrationPage projectId={projectId} />
      </Box>
    </Box>
  );
}
