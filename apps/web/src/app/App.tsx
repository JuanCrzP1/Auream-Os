import { AuthProvider } from "@shared/auth/context/AuthContext";
import { ActiveTenantProvider } from "@shared/auth/tenant/ActiveTenantContext";
import { AppRouter } from "./router/AppRouter";

export default function App() {
  return (
    <AuthProvider>
      <ActiveTenantProvider>
        <AppRouter />
      </ActiveTenantProvider>
    </AuthProvider>
  );
}
