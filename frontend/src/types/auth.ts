export interface UserProfile {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  is_active: boolean;
  is_superadmin: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserAdminRow {
  id: string;
  email: string;
  display_name: string;
  is_active: boolean;
  is_superadmin: boolean;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface ProjectListItem {
  id: string;
  name: string;
  description: string | null;
  role: string;
  created_at: string;
}

export interface EnvironmentOut {
  id: string;
  slug: string;
  label: string;
  base_url: string | null;
}

export interface MemberOut {
  id: string;
  user_id: string;
  email: string;
  display_name: string;
  role: string;
  created_at: string;
}

export interface ProjectOut {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  environments: EnvironmentOut[];
  members: MemberOut[];
}
