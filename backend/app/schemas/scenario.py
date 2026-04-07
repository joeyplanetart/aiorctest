from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class ExtractRule(BaseModel):
    var_name: str = ""
    source: str = "body"
    json_path: str = ""


class AssertionRule(BaseModel):
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


class OverrideFields(BaseModel):
    url: str | None = None
    headers: dict[str, str] | None = None
    query_params: dict[str, str] | None = None
    body: str | None = None
    body_type: str | None = None


class ScenarioNodeData(BaseModel):
    label: str = ""
    endpoint_id: str | None = None
    method: str = "GET"
    name: str = ""
    url: str = ""
    extracts: list[ExtractRule] = Field(default_factory=list)
    overrides: OverrideFields | None = None
    assertions: list[AssertionRule] = Field(default_factory=list)


class ScenarioNode(BaseModel):
    id: str
    type: str = "apiStep"
    position: dict = Field(default_factory=lambda: {"x": 0, "y": 0})
    data: ScenarioNodeData = Field(default_factory=ScenarioNodeData)


class ScenarioEdge(BaseModel):
    id: str
    source: str
    target: str
    sourceHandle: str | None = None
    targetHandle: str | None = None


class ScenarioCreate(BaseModel):
    name: str = Field(default="New Scenario", max_length=200)


class ScenarioSave(BaseModel):
    name: str | None = None
    nodes: list[ScenarioNode] = Field(default_factory=list)
    edges: list[ScenarioEdge] = Field(default_factory=list)


class ScenarioOut(BaseModel):
    id: str
    project_id: str
    name: str
    nodes: list[ScenarioNode] = []
    edges: list[ScenarioEdge] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ScenarioListItem(BaseModel):
    id: str
    project_id: str
    name: str
    node_count: int = 0
    created_at: datetime
    updated_at: datetime


class RunStepResult(BaseModel):
    node_id: str
    endpoint_id: str | None = None
    endpoint_name: str = ""
    method: str = ""
    url: str = ""
    status_code: int | None = None
    status_text: str = ""
    elapsed_ms: float = 0
    size_bytes: int = 0
    response_body: str = ""
    error: str | None = None
    extracted_vars: dict[str, str] = Field(default_factory=dict)
    assertion_results: list[AssertionResult] = Field(default_factory=list)
    assertions_passed: int = 0
    assertions_failed: int = 0


class RunFlowResponse(BaseModel):
    scenario_id: str
    scenario_name: str
    total_steps: int
    passed: int
    failed: int
    steps: list[RunStepResult]
    assertions_passed: int = 0
    assertions_failed: int = 0


class AiGenerateRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=2000)
    env_slug: str = "stage"
