/** API values: `admin` | `member`. UI labels until i18n. */
export function formatProjectRole(role: string): string {
  if (role === "admin") return "Project admin";
  if (role === "member") return "Member";
  return role;
}
