export interface Position {
  x: number;
  y: number;
}

export interface ExtractRule {
  var_name: string;
  source: "body" | "header" | "status";
  json_path: string;
}

export interface AssertionRule {
  id: string;
  type: "status_code" | "json_path" | "header" | "response_time" | "body_contains";
  json_path: string;
  header_name: string;
  operator: "eq" | "ne" | "gt" | "lt" | "gte" | "lte" | "contains" | "not_contains" | "exists" | "not_exists" | "matches";
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

export interface OverrideFields {
  url?: string | null;
  headers?: Record<string, string> | null;
  query_params?: Record<string, string> | null;
  body?: string | null;
  body_type?: string | null;
}

export interface NodeData extends Record<string, unknown> {
  label: string;
  endpoint_id?: string;
  method?: string;
  name?: string;
  url?: string;
  extracts?: ExtractRule[];
  overrides?: OverrideFields | null;
  assertions?: AssertionRule[];
  runStatus?: "success" | "error" | "running" | null;
  statusCode?: number;
  assertionsPassed?: number;
  assertionsFailed?: number;
}

export interface DagNode {
  id: string;
  type: string;
  position: Position;
  data: NodeData;
}

export interface DagEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

export interface ScenarioOut {
  id: string;
  project_id: string;
  name: string;
  nodes: DagNode[];
  edges: DagEdge[];
  created_at: string;
  updated_at: string;
}

export interface ScenarioListItem {
  id: string;
  project_id: string;
  name: string;
  node_count: number;
  created_at: string;
  updated_at: string;
}

export interface RunStepResult {
  node_id: string;
  endpoint_id: string | null;
  endpoint_name: string;
  method: string;
  url: string;
  status_code: number | null;
  status_text: string;
  elapsed_ms: number;
  size_bytes: number;
  response_body: string;
  error: string | null;
  extracted_vars: Record<string, string>;
  assertion_results: AssertionResult[];
  assertions_passed: number;
  assertions_failed: number;
}

export interface RunFlowResponse {
  scenario_id: string;
  scenario_name: string;
  total_steps: number;
  passed: number;
  failed: number;
  steps: RunStepResult[];
  assertions_passed: number;
  assertions_failed: number;
}

export interface DagScenario {
  id: string;
  name: string;
  nodes: DagNode[];
  edges: DagEdge[];
}

export interface DagSaveRequest {
  name: string;
  nodes: DagNode[];
  edges: DagEdge[];
}

export interface DagValidationResult {
  valid: boolean;
  topo_order?: string[];
  errors: string[];
}
