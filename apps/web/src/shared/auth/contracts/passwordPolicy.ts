/**
 * Política de contraseñas.
 *
 * `MIN_PASSWORD_LENGTH` refleja el mínimo que aplica Neon Auth, verificado
 * contra la rama `test`: 7 caracteres se rechazan con `PASSWORD_TOO_SHORT`,
 * 8 se aceptan. Se declara aquí para poder avisar al usuario ANTES de enviar
 * el formulario; la autoridad sigue siendo el proveedor.
 */
export const MIN_PASSWORD_LENGTH = 8;

/** ¿Cumple la contraseña el mínimo exigido? */
export function meetsPasswordPolicy(password: string): boolean {
  return password.length >= MIN_PASSWORD_LENGTH;
}
