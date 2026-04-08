import { useEffect, useState, type ReactNode } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Toolbar,
  Tooltip,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import AdminPanelSettingsOutlinedIcon from "@mui/icons-material/AdminPanelSettingsOutlined";
import ApiOutlinedIcon from "@mui/icons-material/ApiOutlined";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import CloseIcon from "@mui/icons-material/Close";
import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";
import MenuOpenIcon from "@mui/icons-material/MenuOpen";
import MenuIcon from "@mui/icons-material/Menu";
import { useLogout, useGetIdentity } from "@refinedev/core";
import { Link, useLocation, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { getToken } from "@/providers/authProvider";
import { getLastProject } from "@/lib/lastProject";
import { setAppLanguage } from "@/i18n";
import type { ProjectListItem, UserProfile } from "@/types/auth";

const DRAWER_WIDTH = 268;
const DRAWER_COLLAPSED_WIDTH = 64;

const baseNavItems = [
  { to: "/projects", labelKey: "layout.navProjects", icon: DashboardOutlinedIcon },
  { to: "/projects", labelKey: "layout.navApis", icon: ApiOutlinedIcon, matchPrefix: "/apis" },
  { to: "/projects", labelKey: "layout.navOrch", icon: AccountTreeOutlinedIcon, matchPrefix: "/orchestration" },
  { to: "/llm-admin", labelKey: "layout.navLlm", icon: AutoAwesomeOutlinedIcon },
] as const;

const adminNavItem = {
  to: "/admin",
  labelKey: "layout.navAdmin",
  icon: AdminPanelSettingsOutlinedIcon,
} as const;

export function AppLayout({ children }: { children: ReactNode }) {
  const { t, i18n } = useTranslation();
  const { mutate: logout } = useLogout();
  const { data: identity } = useGetIdentity<UserProfile>();
  const location = useLocation();
  const navigate = useNavigate();

  const display =
    identity?.display_name || identity?.email?.split("@")[0] || t("common.user");
  const initial = display.charAt(0).toUpperCase();
  const [isProjectAdminOnAny, setIsProjectAdminOnAny] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem("sidebar_collapsed") === "1"; } catch { return false; }
  });
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token || !identity) {
      setIsProjectAdminOnAny(false);
      return;
    }
    let cancelled = false;
    fetch("/api/projects", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : []))
      .then((list: ProjectListItem[]) => {
        if (!cancelled) setIsProjectAdminOnAny(list.some((p) => p.role === "admin"));
      })
      .catch(() => {
        if (!cancelled) setIsProjectAdminOnAny(false);
      });
    return () => {
      cancelled = true;
    };
  }, [identity?.id]);

  const navItems: readonly (
    | (typeof baseNavItems)[number]
    | typeof adminNavItem
  )[] = identity?.is_superadmin
    ? [...baseNavItems, adminNavItem]
    : [...baseNavItems];

  const langValue = i18n.language.startsWith("zh") ? "zh" : "en";

  const drawerWidth = collapsed ? DRAWER_COLLAPSED_WIDTH : DRAWER_WIDTH;

  const toggleCollapsed = () => {
    setCollapsed((v) => {
      const next = !v;
      try { localStorage.setItem("sidebar_collapsed", next ? "1" : "0"); } catch { /* ignore */ }
      return next;
    });
  };

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          transition: "width 0.2s ease",
          "& .MuiDrawer-paper": {
            width: drawerWidth,
            boxSizing: "border-box",
            bgcolor: "background.paper",
            overflowX: "hidden",
            transition: "width 0.2s ease",
          },
        }}
      >
        {/* Top: logo + toggle */}
        <Toolbar
          sx={{
            px: collapsed ? 1 : 2,
            py: 2,
            minHeight: 72,
            alignItems: "center",
            justifyContent: collapsed ? "center" : "space-between",
          }}
        >
          {!collapsed && (
            <Box
              component={Link}
              to="/projects"
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.25,
                textDecoration: "none",
                color: "text.primary",
                overflow: "hidden",
              }}
            >
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: 2,
                  flexShrink: 0,
                  background: (t) =>
                    `linear-gradient(135deg, ${t.palette.primary.main} 0%, ${t.palette.primary.dark} 100%)`,
                  display: "grid",
                  placeItems: "center",
                  color: "white",
                  fontSize: 18,
                  fontWeight: 800,
                }}
              >
                A
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: "-0.03em", whiteSpace: "nowrap" }}>
                AIOrcTest
              </Typography>
            </Box>
          )}
          {collapsed && (
            <Box
              component={Link}
              to="/projects"
              sx={{
                width: 36,
                height: 36,
                borderRadius: 2,
                flexShrink: 0,
                background: (t) =>
                  `linear-gradient(135deg, ${t.palette.primary.main} 0%, ${t.palette.primary.dark} 100%)`,
                display: "grid",
                placeItems: "center",
                color: "white",
                fontSize: 18,
                fontWeight: 800,
                textDecoration: "none",
              }}
            >
              A
            </Box>
          )}
          {!collapsed && (
            <Tooltip title={t("layout.collapseMenu")} placement="right">
              <IconButton size="small" onClick={toggleCollapsed} sx={{ ml: 1, flexShrink: 0 }}>
                <MenuOpenIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Toolbar>

        {/* Expand button when collapsed */}
        {collapsed && (
          <Box sx={{ display: "flex", justifyContent: "center", pb: 1 }}>
            <Tooltip title={t("layout.expandMenu")} placement="right">
              <IconButton size="small" onClick={toggleCollapsed}>
                <MenuIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        )}

        {/* Avatar + user info */}
        {!collapsed && (
          <>
            <Box sx={{ px: 2, pb: 2, display: "flex", alignItems: "center", gap: 1.5 }}>
              <Tooltip title={t("layout.editProfile")} placement="right">
                <Avatar
                  src={identity?.avatar_url || undefined}
                  onClick={() => setProfileOpen(true)}
                  sx={{
                    width: 40, height: 40, bgcolor: "primary.main", fontWeight: 700, flexShrink: 0,
                    cursor: "pointer",
                    transition: "box-shadow .15s",
                    "&:hover": { boxShadow: "0 0 0 3px rgba(0,0,0,.12)" },
                  }}
                >
                  {initial}
                </Avatar>
              </Tooltip>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Stack direction="row" alignItems="center" gap={0.75} flexWrap="wrap">
                  <Typography variant="subtitle2" fontWeight={700} noWrap>
                    {display}
                  </Typography>
                  {identity?.is_superadmin && (
                    <Chip label={t("layout.superadmin")} size="small" color="primary" sx={{ height: 22, fontSize: 11 }} />
                  )}
                  {isProjectAdminOnAny && (
                    <Chip
                      label={t("layout.projectAdmin")}
                      size="small"
                      color="secondary"
                      variant="outlined"
                      sx={{ height: 22, fontSize: 11 }}
                    />
                  )}
                </Stack>
                <Typography variant="caption" color="text.secondary" noWrap display="block">
                  {identity?.email}
                </Typography>
              </Box>
            </Box>
            <Divider sx={{ mx: 2 }} />
          </>
        )}

        {/* Collapsed: avatar only */}
        {collapsed && (
          <>
            <Box sx={{ display: "flex", justifyContent: "center", pb: 1.5 }}>
              <Tooltip title={t("layout.editProfileCollapsed", { name: display })} placement="right">
                <Avatar
                  src={identity?.avatar_url || undefined}
                  onClick={() => setProfileOpen(true)}
                  sx={{
                    width: 36, height: 36, bgcolor: "primary.main", fontWeight: 700,
                    cursor: "pointer",
                    transition: "box-shadow .15s",
                    "&:hover": { boxShadow: "0 0 0 3px rgba(0,0,0,.12)" },
                  }}
                >
                  {initial}
                </Avatar>
              </Tooltip>
            </Box>
            <Divider />
          </>
        )}

        {/* Nav items */}
        <List sx={{ px: collapsed ? 0.75 : 1.5, py: 1.5, flex: 1 }}>
          {navItems.map((item) => {
            const { to, labelKey, icon: Icon } = item;
            const label = t(labelKey);
            const matchPrefix = "matchPrefix" in item ? (item as any).matchPrefix : undefined;
            const isOnApisPage = !!location.pathname.match(/^\/projects\/[^/]+\/apis/);
            const isOnOrchPage = !!location.pathname.match(/^\/projects\/[^/]+\/orchestration/);
            const isApisItem = matchPrefix === "/apis";
            const isOrchItem = matchPrefix === "/orchestration";
            const isProjectSubpage = isApisItem || isOrchItem;

            let isSelected: boolean;
            if (isApisItem) {
              isSelected = isOnApisPage;
            } else if (isOrchItem) {
              isSelected = isOnOrchPage;
            } else if (to === "/projects") {
              isSelected = (location.pathname === "/projects" || location.pathname === "/") && !isOnApisPage && !isOnOrchPage;
            } else {
              isSelected = location.pathname === to || location.pathname.startsWith(`${to}/`);
            }

            const handleClick = isProjectSubpage
              ? (e: React.MouseEvent) => {
                  e.preventDefault();
                  const suffix = isApisItem ? "apis" : "orchestration";
                  const onPage = isApisItem ? isOnApisPage : isOnOrchPage;
                  if (onPage) return;
                  const lp = getLastProject();
                  navigate(lp ? `/projects/${lp.id}/${suffix}` : "/projects");
                }
              : undefined;

            const linkTo = isProjectSubpage ? "#" : to;

            const btn = (
              <ListItemButton
                key={labelKey}
                component={Link}
                to={linkTo}
                onClick={handleClick}
                selected={isSelected}
                sx={{
                  borderRadius: 2,
                  mb: 0.5,
                  minHeight: 44,
                  justifyContent: collapsed ? "center" : "flex-start",
                  px: collapsed ? 1 : 1.5,
                  "&.Mui-selected": {
                    bgcolor: (t) => alpha(t.palette.primary.main, 0.12),
                    borderLeft: collapsed ? "none" : "3px solid",
                    borderBottom: collapsed ? "2px solid" : "none",
                    borderColor: "primary.main",
                    pl: collapsed ? 1 : 1.375,
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: collapsed ? "unset" : 40,
                    color: isSelected ? "primary.main" : "text.secondary",
                    justifyContent: "center",
                  }}
                >
                  <Icon fontSize="small" />
                </ListItemIcon>
                {!collapsed && (
                  <ListItemText
                    primary={label}
                    primaryTypographyProps={{ fontWeight: isSelected ? 700 : 500, fontSize: 14 }}
                  />
                )}
              </ListItemButton>
            );

            return collapsed ? (
              <Tooltip key={labelKey} title={label} placement="right">
                <span>{btn}</span>
              </Tooltip>
            ) : (
              <span key={labelKey}>{btn}</span>
            );
          })}
        </List>

        {/* Language */}
        <Box
          sx={{
            px: collapsed ? 0.75 : 2,
            pb: 1,
            display: "flex",
            justifyContent: "center",
            flexDirection: "column",
            alignItems: "stretch",
            gap: 0.5,
          }}
        >
          {!collapsed && (
            <Typography variant="caption" color="text.secondary" sx={{ px: 0.5, fontWeight: 600 }}>
              {t("layout.language")}
            </Typography>
          )}
          <ToggleButtonGroup
            exclusive
            size="small"
            value={langValue}
            orientation={collapsed ? "vertical" : "horizontal"}
            onChange={(_, v) => {
              if (v === "en" || v === "zh") setAppLanguage(v);
            }}
            sx={{
              width: collapsed ? "100%" : "auto",
              "& .MuiToggleButton-root": {
                px: collapsed ? 0.5 : 1.25,
                py: 0.25,
                fontSize: collapsed ? 10 : 12,
                fontWeight: 700,
              },
            }}
          >
            <ToggleButton value="en" aria-label="English">
              {t("layout.langEn")}
            </ToggleButton>
            <ToggleButton value="zh" aria-label="中文">
              {t("layout.langZh")}
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>

        {/* Sign out */}
        <Box sx={{ p: collapsed ? 1 : 2, pt: collapsed ? 0 : 1, display: "flex", justifyContent: "center" }}>
          {collapsed ? (
            <Tooltip title={t("layout.signOut")} placement="right">
              <IconButton
                onClick={() => logout()}
                sx={{ color: "text.secondary" }}
              >
                <LogoutOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          ) : (
            <Button
              fullWidth
              variant="outlined"
              color="inherit"
              startIcon={<LogoutOutlinedIcon />}
              onClick={() => logout()}
              sx={{
                borderColor: (t) => alpha(t.palette.text.primary, 0.12),
                color: "text.secondary",
              }}
            >
              {t("layout.signOut")}
            </Button>
          )}
        </Box>
      </Drawer>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          minHeight: 0,
        }}
      >
        {children}
      </Box>

      {/* Profile dialog */}
      <ProfileDialog
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        identity={identity ?? null}
      />
    </Box>
  );
}

// ---- Profile Dialog ----

function ProfileDialog({
  open,
  onClose,
  identity,
}: {
  open: boolean;
  onClose: () => void;
  identity: UserProfile | null;
}) {
  const { t } = useTranslation();
  const { refetch } = useGetIdentity<UserProfile>();
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (identity && open) {
      setDisplayName(identity.display_name || "");
      setAvatarUrl(identity.avatar_url || "");
      setMsg("");
      setError("");
      setOldPassword("");
      setNewPassword("");
    }
  }, [identity, open]);

  const authHeaders = (): Record<string, string> => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${getToken()}`,
  });

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg("");
    setError("");
    const res = await fetch("/api/auth/me", {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ display_name: displayName, avatar_url: avatarUrl || null }),
    });
    if (res.ok) {
      setMsg(t("layoutProfile.updated"));
      refetch();
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.detail || t("layoutProfile.updateFailed"));
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg("");
    setError("");
    const res = await fetch("/api/auth/me/password", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ old_password: oldPassword, new_password: newPassword }),
    });
    if (res.ok || res.status === 204) {
      setMsg(t("layoutProfile.passwordChanged"));
      setOldPassword("");
      setNewPassword("");
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.detail || t("layoutProfile.passwordChangeFailed"));
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1.5, pb: 1 }}>
        <Avatar
          src={avatarUrl || undefined}
          sx={{ width: 40, height: 40, bgcolor: "primary.main", fontWeight: 700 }}
        >
          {(displayName || identity?.email || "U").charAt(0).toUpperCase()}
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle1" fontWeight={700} noWrap>
            {displayName || identity?.email}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap display="block">
            {identity?.email}
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ pt: 2 }}>
        {msg && <Alert severity="success" sx={{ mb: 2 }}>{msg}</Alert>}
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Card variant="outlined" sx={{ mb: 2 }}>
          <CardContent component="form" onSubmit={handleProfileSave} sx={{ pb: "16px !important" }}>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>
              {t("common.profile")}
            </Typography>
            <Stack spacing={1.5}>
              <TextField
                label={t("common.email")}
                value={identity?.email || ""}
                disabled
                fullWidth
                size="small"
              />
              <TextField
                label={t("common.displayName")}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                fullWidth
                size="small"
              />
              <TextField
                label={t("common.avatarUrl")}
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                fullWidth
                size="small"
                placeholder="https://…"
              />
              <Button type="submit" variant="contained" size="small" sx={{ alignSelf: "flex-start" }}>
                {t("common.saveChanges")}
              </Button>
            </Stack>
          </CardContent>
        </Card>

        <Card variant="outlined">
          <CardContent component="form" onSubmit={handlePasswordChange} sx={{ pb: "16px !important" }}>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>
              {t("common.changePassword")}
            </Typography>
            <Stack spacing={1.5}>
              <TextField
                label={t("common.currentPassword")}
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                required
                fullWidth
                size="small"
              />
              <TextField
                label={t("common.newPassword")}
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                fullWidth
                size="small"
                inputProps={{ minLength: 6 }}
              />
              <Button type="submit" variant="contained" color="secondary" size="small" sx={{ alignSelf: "flex-start" }}>
                {t("common.updatePassword")}
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
}
