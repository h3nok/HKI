import { trpc } from "@/lib/trpc";
import {
  clearPersistedAuthState,
  replaceBrowserLocation,
} from "@/_core/auth-state";
import { UNAUTHED_ERR_MSG } from "@shared/const";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  httpBatchLink,
  httpLink,
  splitLink,
  TRPCClientError,
} from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { getLoginUrl } from "./const";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000, // 30s — data stays fresh, prevents redundant refetches on mount
      gcTime: 5 * 60_000, // 5min — keep unused query data in cache
      refetchOnWindowFocus: false, // don't refetch every tab switch
      retry: 1, // one retry (down from default 3)
      refetchOnReconnect: true, // do refetch when network reconnects
    },
  },
});

let isRedirectingToLogin = false;

const TRPC_JSON_CONTENT_TYPE = "application/json";

function formatTransportError(status: number, rawBody: string): string {
  const body = rawBody.replace(/\s+/g, " ").trim();

  if (
    status === 504 ||
    body.toLowerCase().includes("upstream") ||
    body.toLowerCase().includes("gateway timeout")
  ) {
    return "The request timed out upstream. Start a fresh chat if no response appears.";
  }

  if (!body) return `Request failed with status ${status}`;
  return body.length > 180 ? `${body.slice(0, 177)}...` : body;
}

async function fetchTrpcResponse(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const response = await globalThis.fetch(input, {
    ...(init ?? {}),
    credentials: "include",
  });

  const contentType = response.headers.get("content-type")?.toLowerCase() || "";
  if (contentType.includes(TRPC_JSON_CONTENT_TYPE)) {
    return response;
  }

  if (response.ok) {
    throw new Error("The server returned a non-JSON response.");
  }

  const rawBody = await response.text().catch(() => response.statusText || "");
  throw new Error(formatTransportError(response.status, rawBody));
}

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized =
    error.data?.code === "UNAUTHORIZED" || error.message === UNAUTHED_ERR_MSG;

  if (!isUnauthorized || isRedirectingToLogin) return;

  isRedirectingToLogin = true;
  clearPersistedAuthState();
  queryClient.clear();
  replaceBrowserLocation(getLoginUrl());
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Mutation Error]", error);
  }
});

// ── TRPC link options (shared by both links) ────────────────────────────────
const linkOpts = {
  url: "/api/trpc",
  transformer: superjson,
  fetch(input: RequestInfo | URL, init?: RequestInit) {
    return fetchTrpcResponse(input, init);
  },
} as const;

// Mutations that carry large base64 payloads should NOT be batched.
// splitLink sends them through a dedicated unbatched httpLink so each file
// is its own HTTP request, while all other operations stay batch-optimized.
const UNBATCHED_MUTATIONS = new Set([
  "knowledge.uploadFile",
  "knowledge.preAnalyzeFile",
]);

const trpcClient = trpc.createClient({
  links: [
    splitLink({
      condition: op =>
        op.type === "mutation" && UNBATCHED_MUTATIONS.has(op.path),
      true: httpLink(linkOpts),
      false: httpBatchLink(linkOpts),
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
