import { memo, useMemo } from "react";
import { motion } from "framer-motion";
import { MapPin } from "lucide-react";
import { MapView } from "../../ui/map";
import { ToolExecutionCard } from "@hki/ui";
import type {
  TaskMessage,
  ToolRequestContent,
  ToolResponseContent,
  JsonValue,
} from "../types";

type TaskMessageToolPairProps = {
  toolRequestMessage: TaskMessage & { content: ToolRequestContent };
  toolResponseMessage?:
    | (TaskMessage & { content: ToolResponseContent })
    | undefined;
};

function TaskMessageToolPairImpl({
  toolRequestMessage,
  toolResponseMessage,
}: TaskMessageToolPairProps) {
  const responseObject = useMemo<JsonValue>(() => {
    const content = toolResponseMessage?.content.content;
    if (typeof content === "string") {
      try {
        return JSON.parse(content) as JsonValue;
      } catch {
        return content as JsonValue;
      }
    }
    return (content as JsonValue) || null;
  }, [toolResponseMessage]);

  const isError = useMemo<boolean>(
    () =>
      typeof responseObject === "object" &&
      responseObject !== null &&
      "status" in responseObject &&
      typeof responseObject.status === "string" &&
      responseObject.status.toLowerCase() === "error",
    [responseObject]
  );

  const cardOutput = useMemo<
    Record<string, unknown> | string | number | boolean | null
  >(() => {
    if (Array.isArray(responseObject)) {
      return { items: responseObject as unknown[] };
    }
    if (
      responseObject === null ||
      typeof responseObject === "string" ||
      typeof responseObject === "number" ||
      typeof responseObject === "boolean"
    ) {
      return responseObject;
    }
    return responseObject as Record<string, unknown>;
  }, [responseObject]);

  const status = useMemo(() => {
    if (!toolResponseMessage) return "running";
    if (isError) return "error";
    return "success";
  }, [toolResponseMessage, isError]);

  const duration = useMemo(() => {
    if (!toolResponseMessage) return undefined;
    const start = new Date(toolRequestMessage.created_at).getTime();
    const end = new Date(toolResponseMessage.created_at).getTime();
    return Math.max(0, end - start);
  }, [toolRequestMessage.created_at, toolResponseMessage]);

  // Check if we should show a map
  const mapCoordinates = useMemo(() => {
    if (
      toolRequestMessage.content.name === "check_inventory" &&
      responseObject &&
      typeof responseObject === "object" &&
      "coordinates" in responseObject
    ) {
      return (responseObject as any).coordinates as {
        lat: number;
        lng: number;
      };
    }
    return null;
  }, [toolRequestMessage.content.name, responseObject]);

  return (
    <motion.div
      className="w-full my-3"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
    >
      <ToolExecutionCard
        toolName={toolRequestMessage.content.name}
        status={status}
        input={toolRequestMessage.content.arguments as Record<string, any>}
        output={cardOutput}
        error={
          isError &&
          typeof responseObject === "object" &&
          responseObject !== null &&
          "message" in responseObject
            ? String(responseObject.message)
            : undefined
        }
        timestamp={toolRequestMessage.created_at}
        duration={duration}
      >
        {/* Map Visualization */}
        {mapCoordinates && (
          <div className="mt-4">
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="size-4" style={{ color: "var(--primary)" }} />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Location Visualization
              </span>
            </div>
            <div className="h-[300px] w-full rounded-xl overflow-hidden border border-border shadow-sm">
              <MapView
                initialCenter={mapCoordinates}
                initialZoom={14}
                className="h-full w-full"
              />
            </div>
          </div>
        )}
      </ToolExecutionCard>
    </motion.div>
  );
}

export const TaskMessageToolPair = memo(TaskMessageToolPairImpl);
