import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { NodeData } from "@/types/dag";
import { METHOD_COLORS } from "@/types/api";

/** ~70% of original chrome so nodes feel less bulky on the canvas */
const S = 0.7;

const handleStyle = {
  width: Math.round(14 * S),
  height: Math.round(14 * S),
  border: `${Math.max(1.5, 2.5 * S)}px solid #1b9a8e`,
  background: "#fff",
  borderRadius: "50%",
  cursor: "crosshair",
  transition: "background .15s, transform .15s",
};

const ApiStepNode = memo(({ data }: NodeProps) => {
  const { t } = useTranslation();
  const d = data as unknown as NodeData;
  const method = d.method || "GET";
  const color = METHOD_COLORS[method] || "#6b7280";
  const hasEndpoint = !!d.endpoint_id;
  const runStatus = d.runStatus;
  const extractCount = (d.extracts as { var_name: string }[] | undefined)?.length ?? 0;
  const hasExtracts = extractCount > 0;
  const assertionCount = (d.assertions as unknown[] | undefined)?.length ?? 0;
  const hasAssertions = assertionCount > 0;
  const ov = d.overrides as Record<string, unknown> | undefined;
  const hasOverrides = ov
    ? !!(ov.url || ov.body || ov.headers || ov.query_params)
    : false;
  const assertionsPassed = (d.assertionsPassed as number | undefined) ?? 0;
  const assertionsFailed = (d.assertionsFailed as number | undefined) ?? 0;
  const hasAssertionResults = (assertionsPassed + assertionsFailed) > 0;

  let borderColor = "#1b9a8e";
  if (runStatus === "success") borderColor = "#16a34a";
  else if (runStatus === "error") borderColor = "#dc2626";

  return (
    <div
      style={{
        padding: `${Math.round(10 * S)}px ${Math.round(16 * S)}px`,
        borderRadius: Math.round(10 * S),
        border: `${Math.max(1, Math.round(2 * S))}px solid ${borderColor}`,
        background: "#fff",
        minWidth: Math.round(200 * S),
        fontSize: Math.round(13 * S),
        fontFamily: "system-ui, sans-serif",
        boxShadow: runStatus ? `0 0 ${Math.round(8 * S)}px ${borderColor}40` : "0 1px 3px rgba(0,0,0,.08)",
        position: "relative",
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{ ...handleStyle, borderColor, top: -Math.round(8 * S) }}
        title={t("orch.handleDragTarget")}
      />
      {/* ---- Header row: method badge + label + status icon ---- */}
      <div style={{ display: "flex", alignItems: "center", gap: Math.round(6 * S), marginBottom: 2 }}>
        {hasEndpoint && (
          <span
            style={{
              display: "inline-block",
              padding: `1px ${Math.round(6 * S)}px`,
              borderRadius: Math.round(4 * S),
              fontSize: Math.max(8, Math.round(10 * S)),
              fontWeight: 800,
              color,
              background: `${color}18`,
              flexShrink: 0,
            }}
          >
            {method}
          </span>
        )}
        {/* Custom label (step name) shown in bold; falls back to API name */}
        <span
          style={{
            fontWeight: 700,
            flex: 1,
            fontSize: Math.max(9, Math.round(13 * S)),
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {d.label || d.name || t("orch.untitled")}
        </span>
        {runStatus === "success" && (
          <span style={{ color: "#16a34a", fontSize: Math.round(16 * S), lineHeight: 1, flexShrink: 0 }}>&#10003;</span>
        )}
        {runStatus === "error" && (
          <span style={{ color: "#dc2626", fontSize: Math.round(16 * S), lineHeight: 1, flexShrink: 0 }}>&#10007;</span>
        )}
      </div>
      {/* When a custom label exists, show API name as secondary subtitle */}
      {d.label && d.name && d.label !== d.name && (
        <div
          style={{
            fontSize: Math.max(7, Math.round(10 * S)),
            color: "#9ca3af",
            fontStyle: "italic",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            maxWidth: Math.round(240 * S),
            marginBottom: 1,
          }}
        >
          {d.name}
        </div>
      )}
      {d.url && (
        <div
          style={{
            color: "#6b7280",
            fontSize: Math.max(8, Math.round(11 * S)),
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            maxWidth: Math.round(240 * S),
          }}
        >
          {d.url}
        </div>
      )}
      {d.statusCode && (
        <div
          style={{
            fontSize: Math.max(8, Math.round(11 * S)),
            fontWeight: 700,
            marginTop: 1,
            color: d.statusCode < 300 ? "#16a34a" : d.statusCode < 400 ? "#2563eb" : "#dc2626",
          }}
        >
          {d.statusCode}
        </div>
      )}
      {(hasExtracts || hasOverrides) && (
        <div style={{ display: "flex", gap: Math.round(4 * S), marginTop: Math.round(4 * S), flexWrap: "wrap" }}>
          {hasExtracts && (
            <span
              style={{
                fontSize: Math.max(7, Math.round(9 * S)),
                fontWeight: 700,
                padding: `1px ${Math.round(5 * S)}px`,
                borderRadius: Math.round(3 * S),
                background: "#dbeafe",
                color: "#2563eb",
              }}
            >
              {extractCount} {extractCount > 1 ? t("orch.extractPlural") : t("orch.extractSingular")}
            </span>
          )}
          {hasOverrides && (
            <span
              style={{
                fontSize: Math.max(7, Math.round(9 * S)),
                fontWeight: 700,
                padding: `1px ${Math.round(5 * S)}px`,
                borderRadius: Math.round(3 * S),
                background: "#fef3c7",
                color: "#d97706",
              }}
            >
              {t("orch.overrides")}
            </span>
          )}
          {hasAssertions && !hasAssertionResults && (
            <span
              style={{
                fontSize: Math.max(7, Math.round(9 * S)),
                fontWeight: 700,
                padding: `1px ${Math.round(5 * S)}px`,
                borderRadius: Math.round(3 * S),
                background: "#ede9fe",
                color: "#7c3aed",
              }}
            >
              {assertionCount} {assertionCount > 1 ? t("orch.assertPlural") : t("orch.assertSingular")}
            </span>
          )}
          {hasAssertionResults && (
            <span
              style={{
                fontSize: Math.max(7, Math.round(9 * S)),
                fontWeight: 700,
                padding: `1px ${Math.round(5 * S)}px`,
                borderRadius: Math.round(3 * S),
                background: assertionsFailed === 0 ? "#f0fdf4" : "#fef2f2",
                color: assertionsFailed === 0 ? "#16a34a" : "#dc2626",
              }}
            >
              {assertionsPassed}/{assertionsPassed + assertionsFailed}
            </span>
          )}
        </div>
      )}
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ ...handleStyle, borderColor, bottom: -Math.round(8 * S) }}
        title={t("orch.handleDragSource")}
      />
    </div>
  );
});

ApiStepNode.displayName = "ApiStepNode";

export const nodeTypes = {
  apiStep: ApiStepNode,
};
