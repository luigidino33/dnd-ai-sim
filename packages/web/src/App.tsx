import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./state/AuthContext";
import JoinView from "./views/JoinView";
import AdminDashboard from "./views/AdminDashboard";
import PlayerHome from "./views/PlayerHome";
import CharacterBuilder from "./views/CharacterBuilder/CharacterBuilder";
import HostView from "./views/HostView/HostView";
import PlayerView from "./views/PlayerView/PlayerView";

function RequireAuth({ children }: { children: JSX.Element }) {
  const { auth } = useAuth();
  if (!auth) return <Navigate to="/" replace />;
  return children;
}

/** Admin-only routes (dashboard, host view) -- a player landing here (stale link, wrong device) gets sent to their own home instead of a broken degraded admin view. */
function RequireAdmin({ children }: { children: JSX.Element }) {
  const { auth } = useAuth();
  if (!auth) return <Navigate to="/" replace />;
  if (!auth.user.isAdmin) return <Navigate to="/play" replace />;
  return children;
}

export default function App() {
  const { auth } = useAuth();

  return (
    <Routes>
      <Route path="/" element={auth ? <Navigate to={auth.user.isAdmin ? "/admin" : "/play"} replace /> : <JoinView />} />
      <Route
        path="/admin"
        element={
          <RequireAdmin>
            <AdminDashboard />
          </RequireAdmin>
        }
      />
      <Route
        path="/host/:sessionId"
        element={
          <RequireAdmin>
            <HostView />
          </RequireAdmin>
        }
      />
      <Route
        path="/play"
        element={
          <RequireAuth>
            <PlayerHome />
          </RequireAuth>
        }
      />
      <Route
        path="/characters/new"
        element={
          <RequireAuth>
            <CharacterBuilder />
          </RequireAuth>
        }
      />
      <Route
        path="/session/:sessionId/character/:characterId"
        element={
          <RequireAuth>
            <PlayerView />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
