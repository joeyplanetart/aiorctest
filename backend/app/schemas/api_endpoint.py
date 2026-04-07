from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class FolderCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    parent_id: str | None = None
    sort_order: int = 0


class FolderUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=200)
    parent_id: str | None = None
    sort_order: int | None = None


class FolderOut(BaseModel):
    id: str
    project_id: str
    parent_id: str | None = None
    name: str
    sort_order: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class EndpointCreate(BaseModel):
    folder_id: str
    name: str = Field(..., min_length=1, max_length=300)
    method: str = "GET"
    url: str = ""
    headers_json: str = "{}"
    query_params_json: str = "{}"
    body_json: str = ""
    body_type: str = "none"
    description: str | None = None
    sort_order: int = 0


class EndpointUpdate(BaseModel):
    folder_id: str | None = None
    name: str | None = Field(default=None, max_length=300)
    method: str | None = None
    url: str | None = None
    headers_json: str | None = None
    query_params_json: str | None = None
    body_json: str | None = None
    body_type: str | None = None
    description: str | None = None
    sort_order: int | None = None


class EndpointOut(BaseModel):
    id: str
    project_id: str
    folder_id: str
    name: str
    method: str
    url: str
    headers_json: str
    query_params_json: str
    body_json: str
    body_type: str
    description: str | None = None
    sort_order: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class FolderTree(BaseModel):
    id: str
    name: str
    parent_id: str | None = None
    sort_order: int
    children: list[FolderTree] = []
    endpoints: list[EndpointOut] = []


class CurlImportRequest(BaseModel):
    folder_id: str
    curl_command: str = Field(..., min_length=1)


class OpenApiImportRequest(BaseModel):
    openapi_spec: str = Field(..., min_length=1, description="OpenAPI JSON or YAML string")
    target_folder_id: str | None = None


class ExtractRuleIn(BaseModel):
    var_name: str = ""
    source: str = "body"
    json_path: str = ""


class AssertionIn(BaseModel):
    """Single assertion rule.

    type: status_code | json_path | header | response_time | body_contains
    operator: eq | ne | gt | lt | gte | lte | contains | not_contains | exists | not_exists | matches
    """
    id: str = ""
    type: str = "status_code"
    json_path: str = ""
    header_name: str = ""
    operator: str = "eq"
    expected: str = ""


class AssertionResult(BaseModel):
    id: str = ""
    type: str = ""
    description: str = ""
    passed: bool = False
    actual: str = ""
    expected: str = ""
    message: str = ""


class RunRequest(BaseModel):
    method: str = "GET"
    url: str = Field(..., min_length=1)
    headers: dict[str, str] = {}
    query_params: dict[str, str] = {}
    body: str = ""
    body_type: str = "none"
    timeout: float = Field(default=30.0, ge=1, le=120)
    variables: dict[str, str] = Field(default_factory=dict)
    extract_rules: list[ExtractRuleIn] = Field(default_factory=list)
    assertions: list[AssertionIn] = Field(default_factory=list)


class RunResponse(BaseModel):
    status_code: int
    status_text: str
    headers: dict[str, str]
    body: str
    elapsed_ms: float
    size_bytes: int
    extracted_vars: dict[str, str] = Field(default_factory=dict)
    assertion_results: list[AssertionResult] = Field(default_factory=list)
    assertions_passed: int = 0
    assertions_failed: int = 0


class VariableOut(BaseModel):
    id: str
    project_id: str
    env_slug: str
    key: str
    value: str

    model_config = {"from_attributes": True}


class VariableBulkSave(BaseModel):
    env_slug: str = "stage"
    variables: dict[str, str] = Field(default_factory=dict)
