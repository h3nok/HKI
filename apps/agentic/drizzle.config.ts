import { defineConfig } from "drizzle-kit";

const connectionString =
  process.env.DATABASE_URL || "mysql://root:root@127.0.0.1:9306/hki_agentic";
if (!connectionString) {
  throw new Error("DATABASE_URL is required to run drizzle commands");
}

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle",
  dialect: "mysql",
  dbCredentials: {
    url: connectionString,
  },
});
