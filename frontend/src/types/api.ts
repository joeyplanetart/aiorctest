export interface EnvironmentOut {
  id: string;
  slug: "stage" | "pre" | "prod";
  label: string;
  base_url: string | null;
}

export interface FolderOut {
  id: string;
  project_id: string;
  parent_id: string | null;
  name: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface EndpointOut {
  id: string;
  project_id: string;
  folder_id: string;
  name: string;
  method: string;
  url: string;
  headers_json: string;
  query_params_json: string;
  body_json: string;
  body_type: string;
  description: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface FolderTree {
  id: string;
  name: string;
  parent_id: string | null;
  sort_order: number;
  children: FolderTree[];
  endpoints: EndpointOut[];
}

export interface ExtractRuleIn {
  var_name: string;
  source: "body" | "header" | "status";
  json_path: string;
}

export type AssertionType = "status_code" | "json_path" | "header" | "response_time" | "body_contains";
export type AssertionOperator =
  | "eq" | "ne"
  | "gt" | "lt" | "gte" | "lte"
  | "contains" | "not_contains"
  | "exists" | "not_exists"
  | "matches";

export interface AssertionIn {
  id: string;
  type: AssertionType;
  json_path: string;
  header_name: string;
  operator: AssertionOperator;
  expected: string;
}

export interface AssertionResult {
  id: string;
  type: string;
  description: string;
  passed: boolean;
  actual: string;
  expected: string;
  message: string;
}

export interface RunResponse {
  status_code: number;
  status_text: string;
  headers: Record<string, string>;
  body: string;
  elapsed_ms: number;
  size_bytes: number;
  extracted_vars: Record<string, string>;
  assertion_results: AssertionResult[];
  assertions_passed: number;
  assertions_failed: number;
}

export interface VariableOut {
  id: string;
  project_id: string;
  env_slug: string;
  key: string;
  value: string;
}

export const HTTP_METHODS = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
] as const;

export const METHOD_COLORS: Record<string, string> = {
  GET: "#16a34a",
  POST: "#d97706",
  PUT: "#2563eb",
  PATCH: "#7c3aed",
  DELETE: "#dc2626",
  HEAD: "#6b7280",
  OPTIONS: "#6b7280",
};
