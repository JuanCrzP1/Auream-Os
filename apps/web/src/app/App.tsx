import { AuthProvider } from "@shared/auth/context/AuthContext";
import { ActiveTenantProvider } from "@shared/auth/tenant/ActiveTenantContext";
import { ThemeProvider } from "@shared/theme/context/ThemeContext";
import { AppRouter } from "./router/AppRouter";

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ActiveTenantProvider>
          <AppRouter />
        </ActiveTenantProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
