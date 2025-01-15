// test/setup.ts
import {DbService, DbServiceLive} from "./src/DbService.js";
import {Effect} from "effect";

// グローバルな設定をここに記述
export default async () => {
  return await DbService.initSystemMode().pipe(
    Effect.provide([DbServiceLive]),
    Effect.runPromise
  )};
