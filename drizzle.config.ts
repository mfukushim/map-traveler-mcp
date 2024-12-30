// drizzle.config.ts
import { defineConfig } from "drizzle-kit";
export default defineConfig({
  dialect: "sqlite",
  dbCredentials: {

    url: "file:src\\db\\mimi_test.sqlite",

  },
  schema: "./src/db/schema.ts",
});
