from __future__ import annotations

from pydantic import BaseModel, Field


class Position(BaseModel):
    x: float = 0.0
    y: float = 0.0


class NodeData(BaseModel):
    label: str
    operation_id: str | None = None
    json_path_bindings: dict[str, str] | None = None


class DagNode(BaseModel):
    id: str
    type: str = "apiStep"
    position: Position = Field(default_factory=Position)
    data: NodeData


class DagEdge(BaseModel):
    id: str
    source: str
    target: str
    source_handle: str | None = None
    target_handle: str | None = None


class DagScenario(BaseModel):
    id: str
    name: str = ""
    nodes: list[DagNode] = Field(default_factory=list)
    edges: list[DagEdge] = Field(default_factory=list)


class DagSaveRequest(BaseModel):
    name: str = ""
    nodes: list[DagNode] = Field(default_factory=list)
    edges: list[DagEdge] = Field(default_factory=list)


class DagValidationResult(BaseModel):
    valid: bool
    topo_order: list[str] | None = None
    errors: list[str] = Field(default_factory=list)
