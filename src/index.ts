#!/usr/bin/env node

import {Effect} from "effect";
import {McpService, McpServiceLive} from "./McpService.js";
import {DbServiceLive} from "./DbService.js";
import {McpLogServiceLive} from "./McpLogService.js";


export class AnswerError extends Error {
  readonly _tag = "AnswerError"

  constructor(message: string) {
    super(message);
    this.name = "AnswerError";
    Object.setPrototypeOf(this, AnswerError.prototype);
  }
}

async function main() {
  await Effect.runPromise(Effect.gen(function *() {
    yield *McpService.run().pipe(Effect.provide([McpServiceLive,DbServiceLive,McpLogServiceLive]))
  }))
}

main().catch((error) => {
  //  MCPではconsole出力はエラーになるっぽい
    // console.error("Server error:", error);
});
