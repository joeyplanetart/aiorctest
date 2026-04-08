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
import { getToken } from "@/providers/authProvider";
import { getLastProject } from "@/lib/lastProject";
import type { ProjectListItem, UserProfile } from "@/types/auth";

const DRAWER_WIDTH = 268;
const DRAWER_COLLAPSED_WIDTH = 64;

const baseNavItems = [
  { to: "/projects", label: "Project management", icon: DashboardOutlinedIcon },
  { to: "/projects", label: "API management", icon: ApiOutlinedIcon, matchPrefix: "/apis" },
  { to: "/projects", label: "Orchestration", icon: AccountTreeOutlinedIcon, matchPrefix: "/orchestration" },
  { to: "/llm-admin", label: "AI 模型管理", icon: AutoAwesomeOutlinedIcon },
] as const;

const adminNavItem = {
  to: "/admin",
  label: "Platform admin",
  icon: AdminPanelSettingsOutlinedIcon,
} as const;

export function AppLayout({ children }: { children: ReactNode }) {
  const { mutate: logout } = useLogout();
  const { data: identity } = useGetIdentity<UserProfile>();
  const location = useLocation();
  const navigate = useNavigate();

  const display =
    identity?.display_name || identity?.email?.split("@")[0] || "User";
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

  const navItems = identity?.is_superadmin
    ? [...baseNavItems, adminNavItem]
    : [...baseNavItems];

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
            <Tooltip title="收起菜单" placement="right">
              <IconButton size="small" onClick={toggleCollapsed} sx={{ ml: 1, flexShrink: 0 }}>
                <MenuOpenIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Toolbar>

        {/* Expand button when collapsed */}
        {collapsed && (
          <Box sx={{ display: "flex", justifyContent: "center", pb: 1 }}>
            <Tooltip title="展开菜单" placement="right">
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
              <Tooltip title="编辑个人信息" placement="right">
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
                    <Chip label="Superadmin" size="small" color="primary" sx={{ height: 22, fontSize: 11 }} />
                  )}
                  {isProjectAdminOnAny && (
                    <Chip
                      label="Project admin"
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
              <Tooltip title={`${display} — 点击编辑个人信息`} placement="right">
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
            const { to, label, icon: Icon } = item;
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
                key={label}
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
              <Tooltip key={label} title={label} placement="right">
                <span>{btn}</span>
              </Tooltip>
            ) : (
              <span key={label}>{btn}</span>
            );
          })}
        </List>

        {/* Sign out */}
        <Box sx={{ p: collapsed ? 1 : 2, display: "flex", justifyContent: "center" }}>
          {collapsed ? (
            <Tooltip title="Sign out" placement="right">
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
              Sign out
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
      setMsg("个人信息已更新");
      refetch();
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.detail || "更新失败");
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
      setMsg("密码已修改");
      setOldPassword("");
      setNewPassword("");
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.detail || "密码修改失败");
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
              个人信息
            </Typography>
            <Stack spacing={1.5}>
              <TextField
                label="Email"
                value={identity?.email || ""}
                disabled
                fullWidth
                size="small"
              />
              <TextField
                label="显示名称"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                fullWidth
                size="small"
              />
              <TextField
                label="头像 URL"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                fullWidth
                size="small"
                placeholder="https://…"
              />
              <Button type="submit" variant="contained" size="small" sx={{ alignSelf: "flex-start" }}>
                保存修改
              </Button>
            </Stack>
          </CardContent>
        </Card>

        <Card variant="outlined">
          <CardContent component="form" onSubmit={handlePasswordChange} sx={{ pb: "16px !important" }}>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>
              修改密码
            </Typography>
            <Stack spacing={1.5}>
              <TextField
                label="当前密码"
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                required
                fullWidth
                size="small"
              />
              <TextField
                label="新密码"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                fullWidth
                size="small"
                inputProps={{ minLength: 6 }}
              />
              <Button type="submit" variant="contained" color="secondary" size="small" sx={{ alignSelf: "flex-start" }}>
                更新密码
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
}
