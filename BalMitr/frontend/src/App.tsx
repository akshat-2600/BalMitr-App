import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { SyncProvider } from "./context/SyncContext";
import { AppShell } from "./components/AppShell";
import { LoginPage } from "./pages/LoginPage";
import { HomePage } from "./pages/HomePage";
import { ChildrenPage } from "./pages/ChildrenPage";
import { ChildProfilePage } from "./pages/ChildProfilePage";
import { AlertsPage } from "./pages/AlertsPage";
import { VisitsPage } from "./pages/VisitsPage";
import { SummaryPage } from "./pages/SummaryPage";
import { BackendPage } from "./pages/BackendPage";
import { AccountPage } from "./pages/AccountPage";

function ProtectedRoutes() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/children" element={<ChildrenPage />} />
        <Route path="/children/:id" element={<ChildProfilePage />} />
        <Route path="/alerts" element={<AlertsPage />} />
        <Route path="/visits" element={<VisitsPage />} />
        <Route path="/summary" element={<SummaryPage />} />
        <Route path="/backend" element={<BackendPage />} />
        <Route path="/account" element={<AccountPage />} />
      </Route>
    </Routes>
  );
}

export function App() {
  return (
    <AuthProvider>
      <SyncProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/*" element={<ProtectedRoutes />} />
          </Routes>
        </BrowserRouter>
      </SyncProvider>
    </AuthProvider>
  );
}

export default App;
