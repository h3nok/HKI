import { createTRPCReact } from "@trpc/react-query";
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";

export const trpc = createTRPCReact<AppRouter>();

/** Typed inputs for every tRPC procedure, e.g. `RouterInputs["admin"]["listUsers"]`. */
export type RouterInputs = inferRouterInputs<AppRouter>;

/** Typed outputs for every tRPC procedure, e.g. `RouterOutputs["admin"]["listValueStreams"][number]`. */
export type RouterOutputs = inferRouterOutputs<AppRouter>;
