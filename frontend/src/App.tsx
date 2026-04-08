import { Refine, Authenticated } from "@refinedev/core";
import dataProvider from "@refinedev/simple-rest";
import routerProvider from "@refinedev/react-router";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router";
import { authProvider } from "./providers/authProvider";
import { LoginPage } from "./pages/auth/Login";
import { RegisterPage } from "./pages/auth/Register";
import { ProfilePage } from "./pages/profile";
import { ProjectsPage } from "./pages/projects";
import { OrchestrationPageWrapper } from "./pages/orchestration/Wrapper";
import { AdminPage } from "./pages/admin";
import { ApisPageWrapper } from "./pages/apis/Wrapper";
import { LlmAdminPage } from "./pages/llm-admin";
import { AppLayout } from "./components/Layout";

const API_URL = "/api";

export default function App() {
  return (
    <BrowserRouter>
      <Refine
        dataProvider={dataProvider(API_URL)}
        authProvider={authProvider}
        routerProvider={routerProvider}
        resources={[
          { name: "project-management", list: "/projects" },
          { name: "apis", list: "/projects/:projectId/apis" },
          { name: "orchestration", list: "/projects/:projectId/orchestration" },
          { name: "llm-admin", list: "/llm-admin" },
        ]}
      >
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          <Route
            element={
              <Authenticated key="main" redirectOnFail="/login">
                <AppLayout>
                  <Outlet />
                </AppLayout>
              </Authenticated>
            }
          >
            <Route path="/" element={<Navigate to="/projects" replace />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/projects/:projectId/apis" element={<ApisPageWrapper />} />
            <Route path="/projects/:projectId/orchestration" element={<OrchestrationPageWrapper />} />
            <Route path="/orchestration" element={<Navigate to="/projects" replace />} />
            <Route path="/llm-admin" element={<LlmAdminPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/admin" element={<AdminPage />} />
          </Route>
        </Routes>
      </Refine>
    </BrowserRouter>
  );
}
