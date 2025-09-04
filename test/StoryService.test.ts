// @vitest-environment node

import {describe, expect, it} from "@effect/vitest"
import {Effect, Layer, Logger, LogLevel, ManagedRuntime, Option} from "effect";
import {McpLogService, McpLogServiceLive} from "../src/McpLogService.js";
import {DbService, DbServiceLive} from "../src/DbService.js";
import {StoryService, StoryServiceLive} from "../src/StoryService.js";
import {ImageServiceLive} from "../src/ImageService.js";

const AppLive = Layer.mergeAll(McpLogServiceLive, DbServiceLive, StoryServiceLive, ImageServiceLive)
const aiRuntime = ManagedRuntime.make(AppLive);

describe("Story", () => {
  it("info", async () => {
    //  vitest --run --testNamePattern=info StoryService.test.ts
    const res = await Effect.gen(function* () {
      yield *DbService.setEnvironment({})
      yield *DbService.initSystemMode(Option.none())
      return yield* StoryService.tips()
    }).pipe(
      Logger.withMinimumLogLevel(LogLevel.Trace),
      Effect.tap(a => McpLogService.log(a).pipe(Effect.provide(McpLogServiceLive))),
      aiRuntime.runPromise,
    )
    expect(res).toBeInstanceOf(Object)
  })
  it("getSettingResource", async () => {
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    const res = await Effect.gen(function* () {
      yield *DbService.setEnvironment({})
      yield *DbService.initSystemMode(Option.none())
      return yield* StoryService.getResourceBody('/credit.txt')
    }).pipe(
      Logger.withMinimumLogLevel(LogLevel.Trace),
      Effect.tap(a => {
        return McpLogService.log(a).pipe(Effect.provide(McpLogServiceLive));
      }),
      aiRuntime.runPromise,
    )
    expect(typeof res).toBe('string')
  })
  it("carBattle", async () => {
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    const res = await Effect.gen(function* () {
      yield *DbService.setEnvironment({})
      yield *DbService.initSystemMode(Option.none())
      return yield* StoryService.getResourceBody('/carBattle.txt')
    }).pipe(
      Logger.withMinimumLogLevel(LogLevel.Trace),
      // Effect.tapError(e => McpLogService.logError(e.toString()).pipe(Effect.provide(McpLogServiceLive))),
      // Effect.catchIf(a => a.toString() === 'AnswerError: no bluesky account', e => Effect.succeed([])),
      Effect.tap(a => {
        return McpLogService.log(a).pipe(Effect.provide(McpLogServiceLive));
      }),
      aiRuntime.runPromise,
    )
    expect(typeof res).toBe('string')
  })

})
