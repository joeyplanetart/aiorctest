import i18n from "@/i18n";

/** API values: `admin` | `member`. */
export function formatProjectRole(role: string): string {
  if (role === "admin") return i18n.t("roles.projectAdmin");
  if (role === "member") return i18n.t("roles.member");
  return role;
}
