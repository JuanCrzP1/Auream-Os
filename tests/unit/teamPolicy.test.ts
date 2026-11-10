import { describe, expect, it } from "vitest";
import { assignableRoles, canAssign, canManageInvitation, canManageMember, teamRoleOf } from "../../domains/team/domain/TeamPolicy.js";
import { invitationPreviewStatus, maskEmail, normalizeInvitationEmail } from "../../domains/team/domain/Invitation.js";
import { hashInvitationToken, isWellFormedInvitationToken, newInvitationToken } from "../../domains/team/application/InvitationToken.js";

// ---------------------------------------------------------------------------
// Reglas del equipo: quién puede tocar a quién, y cómo es una invitación.
// ---------------------------------------------------------------------------

describe("TeamPolicy", () => {
  it("el dueño da cualquier rol; el administrador nunca nombra dueños; asesor y lectura no dan ninguno", () => {
    expect(assignableRoles("tenant_owner")).toEqual(["tenant_owner", "tenant_admin", "operator", "viewer"]);
    expect(assignableRoles("tenant_admin")).toEqual(["tenant_admin", "operator", "viewer"]);
    expect(assignableRoles("operator")).toEqual([]);
    expect(assignableRoles("viewer")).toEqual([]);
    expect(canAssign("tenant_admin", "tenant_owner")).toBe(false);
  });

  it("el administrador toca a todos menos a los dueños; nadie se toca a sí mismo", () => {
    expect(canManageMember("tenant_owner", "tenant_owner", false)).toBe(true);
    expect(canManageMember("tenant_admin", "tenant_owner", false)).toBe(false);
    expect(canManageMember("tenant_admin", "tenant_admin", false)).toBe(true);
    expect(canManageMember("tenant_admin", "operator", false)).toBe(true);
    expect(canManageMember("operator", "viewer", false)).toBe(false);
    expect(canManageMember("tenant_owner", "operator", true)).toBe(false);
  });

  it("una invitación la toca quien podría haberla hecho con ese rol", () => {
    expect(canManageInvitation("tenant_admin", "operator")).toBe(true);
    expect(canManageInvitation("tenant_admin", "tenant_owner")).toBe(false);
    expect(canManageInvitation("viewer", "viewer")).toBe(false);
  });

  it("solo los roles de personas forman un equipo; platform_admin cuenta como dueño", () => {
    expect(teamRoleOf("platform_admin")).toBe("tenant_owner");
    expect(teamRoleOf("operator")).toBe("operator");
    expect(teamRoleOf("api_client")).toBeNull();
    expect(teamRoleOf("worker")).toBeNull();
  });
});

describe("Invitación", () => {
  it("el correo se guarda en minúsculas y sin espacios; lo que no es correo se rechaza", () => {
    expect(normalizeInvitationEmail("  Ana.Gomez@Gmail.COM ")).toBe("ana.gomez@gmail.com");
    expect(normalizeInvitationEmail("ana")).toBeNull();
    expect(normalizeInvitationEmail("ana@gmail")).toBeNull();
    expect(normalizeInvitationEmail(42)).toBeNull();
  });

  it("el correo se muestra a medias en el enlace", () => {
    expect(maskEmail("ana.gomez@gmail.com")).toBe("an***@gmail.com");
    expect(maskEmail("a@x.co")).toBe("a***@x.co");
  });

  it("estado visible: pendiente, vencida, cancelada o usada", () => {
    const now = new Date("2026-11-10T12:00:00Z");
    expect(invitationPreviewStatus({ status: "pending", expiresAt: "2026-11-17T12:00:00Z" }, now)).toBe("pending");
    expect(invitationPreviewStatus({ status: "pending", expiresAt: "2026-11-10T12:00:00Z" }, now)).toBe("expired");
    expect(invitationPreviewStatus({ status: "revoked", expiresAt: "2026-11-17T12:00:00Z" }, now)).toBe("revoked");
    expect(invitationPreviewStatus({ status: "accepted", expiresAt: "2026-11-01T12:00:00Z" }, now)).toBe("accepted");
  });

  it("el secreto del enlace: 43 caracteres, aleatorio y guardado como huella", () => {
    const token = newInvitationToken();
    expect(isWellFormedInvitationToken(token)).toBe(true);
    expect(newInvitationToken()).not.toBe(token);
    expect(hashInvitationToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(isWellFormedInvitationToken("no-es-un-token")).toBe(false);
  });
});
