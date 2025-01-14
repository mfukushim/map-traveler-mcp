// test/setup.ts
import {DbService, DbServiceLive} from "./src/DbService.js";
import {Effect} from "effect";
import {McpLogServiceLive} from "./src/McpLogService.js";

// グローバルな設定をここに記述
export default async () => {
  return await DbService.initSystemMode().pipe(
    Effect.provide([DbServiceLive,McpLogServiceLive]),
    Effect.runPromise
  )};
