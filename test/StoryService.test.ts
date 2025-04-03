// @vitest-environment node

import {describe, expect, it} from "@effect/vitest"
import {Effect, Logger, LogLevel} from "effect";
import {McpLogService, McpLogServiceLive} from "../src/McpLogService.js";
import {DbServiceLive} from "../src/DbService.js";
import {runPromise} from "effect/Effect";
import {StoryService, StoryServiceLive} from "../src/StoryService.js";


describe("Story", () => {
  it("info", async () => {
    //  vitest --run --testNamePattern=info StoryService.test.ts
    const res = await Effect.gen(function* () {
      return yield* StoryService.tips()
    }).pipe(
        Effect.provide([StoryServiceLive, DbServiceLive]),
        Logger.withMinimumLogLevel(LogLevel.Trace),
        // Effect.tapError(e => McpLogService.logError(e.toString()).pipe(Effect.provide(McpLogServiceLive))),
        // Effect.catchIf(a => a.toString() === 'AnswerError: no bluesky account', e => Effect.succeed([])),
        Effect.tap(a => McpLogService.log(a).pipe(Effect.provide(McpLogServiceLive))),
        runPromise
    )
    expect(res).toBeInstanceOf(Object)
  })
  it("getSettingResource", async () => {
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    const res = await Effect.gen(function* () {
      return yield* StoryService.getSettingResource('/credit.txt')
    }).pipe(
      Effect.provide([StoryServiceLive, DbServiceLive]),
      Logger.withMinimumLogLevel(LogLevel.Trace),
      // Effect.tapError(e => McpLogService.logError(e.toString()).pipe(Effect.provide(McpLogServiceLive))),
      // Effect.catchIf(a => a.toString() === 'AnswerError: no bluesky account', e => Effect.succeed([])),
      Effect.tap(a => {
        return McpLogService.log(a).pipe(Effect.provide(McpLogServiceLive));
      }),
      runPromise
    )
    expect(typeof res).toBe('string')
  })
  it("carBattle", async () => {
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    const res = await Effect.gen(function* () {
      return yield* StoryService.getSettingResource('/carBattle.txt')
    }).pipe(
      Effect.provide([StoryServiceLive, DbServiceLive]),
      Logger.withMinimumLogLevel(LogLevel.Trace),
      // Effect.tapError(e => McpLogService.logError(e.toString()).pipe(Effect.provide(McpLogServiceLive))),
      // Effect.catchIf(a => a.toString() === 'AnswerError: no bluesky account', e => Effect.succeed([])),
      Effect.tap(a => {
        return McpLogService.log(a).pipe(Effect.provide(McpLogServiceLive));
      }),
      runPromise
    )
    expect(typeof res).toBe('string')
  })

})
