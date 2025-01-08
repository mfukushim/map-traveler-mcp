// @vitest-environment node
import {Effect, Logger, LogLevel} from "effect";
import { describe, expect, it } from "@effect/vitest"
import {RunnerService, RunnerServiceLive} from "../src/RunnerService.js";
import {runPromise} from "effect/Effect";
import {FetchHttpClient} from "@effect/platform";
import {DbServiceLive} from "../src/DbService.js";
import {MapServiceLive} from "../src/MapService.js";
import {ImageServiceLive} from "../src/ImageService.js";
import {StoryServiceLive} from "../src/StoryService.js";
import {NodeFileSystem} from "@effect/platform-node"
import {McpLogServiceLive} from "../src/McpLogService.js";
import {AnswerError} from "../src/mapTraveler.js";


describe("Runner", () => {

  it("getCurrentView", async () => {
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    const res = await Effect.gen(function *() {
      return yield *RunnerService.getCurrentView(false,false,true)  //
    }).pipe(
      Effect.provide([RunnerServiceLive,DbServiceLive,MapServiceLive,ImageServiceLive,StoryServiceLive,
        NodeFileSystem.layer, FetchHttpClient.layer,McpLogServiceLive]), //  layer
      Logger.withMinimumLogLevel(LogLevel.Trace),
      Effect.tapError(a => Effect.logError(a)),
      Effect.catchIf(a => a instanceof AnswerError, e => Effect.succeed({content: []})),
      Effect.tap(a => Effect.log(a)),
      runPromise
    )
    expect(res.content).toBeInstanceOf(Array)
  })
  it("setCurrentLocation", async () => {
    const res = await Effect.gen(function *() {
      return yield *RunnerService.getCurrentView(false,false,true)
    }).pipe(
      Effect.provide([RunnerServiceLive,DbServiceLive,MapServiceLive,ImageServiceLive,StoryServiceLive,
        NodeFileSystem.layer, FetchHttpClient.layer,McpLogServiceLive]),
      Logger.withMinimumLogLevel(LogLevel.Trace),
      Effect.tapError(Effect.logError),
      Effect.catchIf(a => a instanceof AnswerError, e => Effect.succeed({content: []})),
      Effect.tap(a => Effect.log(a)),
      runPromise
    )
    expect(res.content).toBeInstanceOf(Array)
  })
})
