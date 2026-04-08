import { forwardRef, useCallback, useImperativeHandle, type MouseEvent as DomMouseEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useReactFlow,
  useStore,
} from "@xyflow/react";
import type {
  Node,
  Edge,
  OnNodesChange,
  OnEdgesChange,
  OnConnect,
  ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Box, IconButton, Tooltip, Typography } from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { nodeTypes } from "./nodeTypes";
import type { NodeData } from "@/types/dag";

const NODE_SCALE = 0.7;
const edgeStyle = { stroke: "#1b9a8e", strokeWidth: Math.max(1, Math.round(2 * NODE_SCALE)) };

type AppNode = Node<NodeData>;

/** For parent component: place new nodes near top-left of viewport; manually fitView after loading a scenario */
export type DagCanvasHandle = {
  getNewNodePosition: (stackIndex: number) => { x: number; y: number };
  fitView: () => ReturnType<ReactFlowInstance["fitView"]>;
};

const PlacementBridge = forwardRef<DagCanvasHandle>(function PlacementBridge(_props, ref) {
  const rf = useReactFlow();
  const domNode = useStore((s) => s.domNode);

  useImperativeHandle(
    ref,
    () => ({
      getNewNodePosition(stackIndex: number) {
        const padLeft = 56;
        const padTop = 56;
        const stepY = 140;
        const stepX = 32;
        if (domNode) {
          const { left, top } = domNode.getBoundingClientRect();
          const base = rf.screenToFlowPosition({ x: left + padLeft, y: top + padTop });
          return { x: base.x + stackIndex * stepX, y: base.y + stackIndex * stepY };
        }
        return { x: 48 + stackIndex * stepX, y: 48 + stackIndex * stepY };
      },
      fitView: () => rf.fitView({ padding: 0.18, maxZoom: 1.35 }),
    }),
    [rf, domNode],
  );

  return null;
});

type CanvasProps = {
  nodes: AppNode[];
  edges: Edge[];
  onNodesChange: OnNodesChange<AppNode>;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  onNodeDragStop?: (event: unknown, node: AppNode, nodes: AppNode[]) => void;
  onNodeClick?: (nodeId: string) => void;
};

const Canvas = forwardRef<DagCanvasHandle, CanvasProps>(function Canvas(
  { nodes, edges, onNodesChange, onEdgesChange, onConnect, onNodeDragStop, onNodeClick },
  ref,
) {
  const { t } = useTranslation();
  const hasNodes = nodes.length > 0;
  const hasEdges = edges.length > 0;

  const handleEdgeDoubleClick = useCallback(
    (_event: DomMouseEvent, edge: Edge) => {
      onEdgesChange([{ type: "remove", id: edge.id }]);
    },
    [onEdgesChange],
  );

  const canvasHelpTooltip = hasNodes ? (
    <Box sx={{ py: 0.25, maxWidth: 300 }}>
      {nodes.length >= 2 && !hasEdges && (
        <Typography variant="caption" component="div" sx={{ display: "block", lineHeight: 1.5, mb: 0.75 }}>
          {t("orch.canvasHelpConnect")}
        </Typography>
      )}
      <Typography variant="caption" component="div" sx={{ display: "block", lineHeight: 1.5, mb: hasEdges ? 0.75 : 0 }}>
        {t("orch.canvasHelpEdit")}
      </Typography>
      {hasEdges && (
        <Typography variant="caption" component="div" sx={{ display: "block", lineHeight: 1.5 }}>
          {t("orch.canvasHelpRemoveEdge")}
        </Typography>
      )}
    </Box>
  ) : null;

  return (
    <Box sx={{ width: "100%", height: "100%", position: "relative" }}>
      {hasNodes && (
        <Tooltip
          title={canvasHelpTooltip}
          placement="bottom-end"
          enterTouchDelay={0}
          describeChild
          slotProps={{
            tooltip: {
              sx: {
                bgcolor: "grey.900",
                color: "grey.100",
                maxWidth: 340,
                border: 1,
                borderColor: "grey.700",
                boxShadow: 3,
              },
            },
          }}
        >
          <IconButton
            size="small"
            aria-label={t("orch.canvasHelpAria")}
            sx={{
              position: "absolute",
              top: 12,
              right: 12,
              zIndex: 10,
              bgcolor: "background.paper",
              border: 1,
              borderColor: "divider",
              boxShadow: 1,
              "&:hover": { bgcolor: "action.hover" },
            }}
          >
            <InfoOutlinedIcon sx={{ fontSize: 20, color: "text.secondary" }} />
          </IconButton>
        </Tooltip>
      )}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStop={onNodeDragStop}
        onNodeClick={(_event, node) => onNodeClick?.(node.id)}
        onEdgeDoubleClick={handleEdgeDoubleClick}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={{
          style: edgeStyle,
          animated: true,
          interactionWidth: 24,
        }}
        onInit={(instance) => {
          void instance.fitView({ padding: 0.18, maxZoom: 1.35 });
        }}
        deleteKeyCode={["Backspace", "Delete"]}
      >
        <PlacementBridge ref={ref} />
        <Background gap={16} size={1} />
        <Controls />
        <MiniMap pannable zoomable />
      </ReactFlow>
    </Box>
  );
});

type DagCanvasProps = {
  nodes: AppNode[];
  edges: Edge[];
  onNodesChange: OnNodesChange<Node<NodeData>>;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  onNodeDragStop?: (event: unknown, node: AppNode, nodes: AppNode[]) => void;
  onNodeClick?: (nodeId: string) => void;
};

const DagCanvas = forwardRef<DagCanvasHandle, DagCanvasProps>(function DagCanvas(props, ref) {
  return (
    <ReactFlowProvider>
      <Canvas ref={ref} {...props} />
    </ReactFlowProvider>
  );
});

export default DagCanvas;
