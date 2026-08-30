import { authFetch } from "./authFetch";

/**
 * Operaciones de contraseña contra Neon Auth.
 *
 * Responsabilidad única: recuperación y cambio de contraseña. Separado de
 * `authClient` (que gestiona sesión e identidad) porque son ciclos de vida
 * distintos: éstos ocurren sin sesión, o la modifican.
 *
 * La plataforma NUNCA ve, guarda ni deriva la contraseña: sólo la transporta
 * al proveedor, que es la única autoridad de credenciales. No existe tabla de
 * contraseñas ni de tokens de recuperación en nuestra base de datos.
 *
 * Rutas verificadas contra la rama `test` del proveedor.
 */
export const passwordClient = {
  /**
   * Pide el envío del correo de recuperación.
   *
   * Responde 200 exista o no la cuenta: el proveedor no revela si el email
   * está registrado. No hay que añadir lógica propia para ocultarlo.
   *
   * `redirectTo` es la pantalla a la que el proveedor manda al usuario con el
   * token en la query. Debe apuntar a un origen de confianza del proveedor.
   */
  async requestReset(email: string, redirectTo: string): Promise<void> {
    await authFetch<{ status: boolean }>("/request-password-reset", {
      method: "POST",
      body: JSON.stringify({ email, redirectTo })
    });
  },

  /**
   * Establece la nueva contraseña con el token del correo.
   *
   * El token es de un solo uso y caduca en 60 minutos (verificado contra el
   * proveedor). Reutilizarlo o usarlo caducado devuelve `INVALID_TOKEN`.
   */
  async reset(token: string, newPassword: string): Promise<void> {
    await authFetch<{ status: boolean }>("/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, newPassword })
    });
  },

  /**
   * Cambia la contraseña de un usuario con sesión activa.
   *
   * Exige la contraseña actual: el proveedor la verifica. `revokeOtherSessions`
   * cierra el resto de sesiones, que es el comportamiento correcto tras un
   * cambio de credencial.
   *
   * La pantalla de Configuración → Seguridad que lo usará es de una fase
   * posterior; el cliente existe ya para que esa fase no tenga que tocar la
   * capa de autenticación.
   */
  async change(currentPassword: string, newPassword: string): Promise<void> {
    await authFetch<unknown>("/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword, revokeOtherSessions: true })
    });
  }
};
