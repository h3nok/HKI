/**
 * useKnowledgeJobsSocket — Real-time job-status channel.
 *
 * Connects to /ws/jobs, invalidates `knowledge.listJobs` and
 * `knowledge.getJob` queries on `job_update` messages.
 *
 * Features:
 *  - Exponential backoff for reconnects (1s → 30s)
 *  - Pauses reconnect attempts while the tab is hidden
 *  - Exposes connection status so UI can show "live" vs "polling"
 *  - Cleans up timers and sockets on unmount
 *
 * Falls back silently to query-level polling if WS is unavailable.
 */

import { useEffect, useRef, useState } from "react";
import type { trpc } from "@/lib/trpc";

export type JobsSocketStatus = "connecting" | "open" | "closed";

type TrpcUtils = ReturnType<typeof trpc.useUtils>;

interface JobUpdateMessage {
  type: "job_update";
  job?: { id?: string };
}

const INITIAL_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 30_000;

export function useKnowledgeJobsSocket(utils: TrpcUtils): {
  status: JobsSocketStatus;
} {
  const [status, setStatus] = useState<JobsSocketStatus>("connecting");
  const utilsRef = useRef(utils);
  utilsRef.current = utils;

  useEffect(() => {
    if (typeof window === "undefined") return;

    const wsUrl = `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/ws/jobs`;

    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let backoff = INITIAL_BACKOFF_MS;
    let closed = false;

    function scheduleReconnect() {
      if (closed) return;
      if (document.visibilityState === "hidden") return;
      reconnectTimer = setTimeout(connect, backoff);
      backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
    }

    function connect() {
      if (closed) return;
      try {
        ws = new WebSocket(wsUrl);
      } catch {
        setStatus("closed");
        scheduleReconnect();
        return;
      }
      setStatus("connecting");

      ws.onopen = () => {
        setStatus("open");
        backoff = INITIAL_BACKOFF_MS;
      };

      ws.onmessage = evt => {
        try {
          const msg = JSON.parse(evt.data as string) as JobUpdateMessage;
          if (msg.type !== "job_update") return;
          void utilsRef.current.knowledge.listJobs.invalidate();
          const jobId = typeof msg.job?.id === "string" ? msg.job.id : null;
          if (jobId) {
            void utilsRef.current.knowledge.getJob.invalidate({ jobId });
          }
        } catch {
          // Malformed message — ignore.
        }
      };

      ws.onerror = () => {
        // Surface as closed; onclose will trigger reconnect.
        setStatus("closed");
      };

      ws.onclose = () => {
        setStatus("closed");
        ws = null;
        scheduleReconnect();
      };
    }

    function handleVisibilityChange() {
      if (closed) return;
      if (document.visibilityState === "visible" && !ws) {
        // Reset backoff on resume so we reconnect quickly.
        backoff = INITIAL_BACKOFF_MS;
        if (reconnectTimer) {
          clearTimeout(reconnectTimer);
          reconnectTimer = null;
        }
        connect();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    connect();

    return () => {
      closed = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, []);

  return { status };
}
