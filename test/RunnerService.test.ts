// @vitest-environment node
import {Effect, Logger, LogLevel} from "effect";
import {describe, expect, it} from "@effect/vitest"
import {RunnerService, RunnerServiceLive} from "../src/RunnerService.js";
import {runPromise} from "effect/Effect";
import {FetchHttpClient} from "@effect/platform";
import {DbServiceLive} from "../src/DbService.js";
import {MapDef, MapServiceLive} from "../src/MapService.js";
import {ImageServiceLive} from "../src/ImageService.js";
import {StoryServiceLive} from "../src/StoryService.js";
import {NodeFileSystem} from "@effect/platform-node"
import {McpLogServiceLive} from "../src/McpLogService.js";
import {AnswerError} from "../src/mapTraveler.js";
import * as fs from "node:fs";


describe("Runner", () => {

  it("getCurrentView", async () => {
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    const res = await Effect.gen(function* () {
      return yield* RunnerService.getCurrentView(false, false, true)  //
    }).pipe(
      Effect.provide([RunnerServiceLive, DbServiceLive, MapServiceLive, ImageServiceLive, StoryServiceLive,
        NodeFileSystem.layer, FetchHttpClient.layer, McpLogServiceLive]), //  layer
      Logger.withMinimumLogLevel(LogLevel.Trace),
      Effect.tapError(a => Effect.logError(a)),
      Effect.catchIf(a => a instanceof AnswerError, e => Effect.succeed([])),
      Effect.tap(a => Effect.log(a)),
      runPromise
    )
    expect(res).toBeInstanceOf(Array)
  })
  it("setCurrentLocation", async () => {
    const res = await Effect.gen(function* () {
      return yield* RunnerService.getCurrentView(false, false, true)
    }).pipe(
      Effect.provide([RunnerServiceLive, DbServiceLive, MapServiceLive, ImageServiceLive, StoryServiceLive,
        NodeFileSystem.layer, FetchHttpClient.layer, McpLogServiceLive]),
      Logger.withMinimumLogLevel(LogLevel.Trace),
      Effect.tapError(Effect.logError),
      Effect.catchIf(a => a instanceof AnswerError, e => Effect.succeed([])),
      Effect.tap(a => Effect.log(a)),
      runPromise
    )
    expect(res).toBeInstanceOf(Array)
  })
  it("sumDurationSec", async () => {
    const s = fs.readFileSync('tools/test/routeSample.json', {encoding: 'utf-8'});
    const res = await Effect.gen(function* () {
      return yield* RunnerService.sumDurationSec(JSON.parse(s) as typeof MapDef.RouteArraySchema.Type)
    }).pipe(
      Effect.provide([RunnerServiceLive, DbServiceLive, MapServiceLive, ImageServiceLive, StoryServiceLive,
        NodeFileSystem.layer, FetchHttpClient.layer, McpLogServiceLive]),
      Logger.withMinimumLogLevel(LogLevel.Trace),
      Effect.tapError(Effect.logError),
      // Effect.catchIf(a => a instanceof AnswerError, e => Effect.succeed({content: []})),
      Effect.tap(a => Effect.log(a)),
      runPromise
    )
    expect(res).toBe(41216)
  })
  it("routesToDirectionStep", async () => {
    const s = fs.readFileSync('tools/test/routeSample.json', {encoding: 'utf-8'});
    const res = await Effect.gen(function* () {
      return yield* RunnerService.routesToDirectionStep(JSON.parse(s) as typeof MapDef.RouteArraySchema.Type)
    }).pipe(
      Effect.provide([RunnerServiceLive, DbServiceLive, MapServiceLive, ImageServiceLive, StoryServiceLive,
        NodeFileSystem.layer, FetchHttpClient.layer, McpLogServiceLive]),
      Logger.withMinimumLogLevel(LogLevel.Trace),
      Effect.tapError(Effect.logError),
      // Effect.catchIf(a => a instanceof AnswerError, e => Effect.succeed({content: []})),
      Effect.andThen(a => a.map(b => ({a: b.start, b: b.end}))),
      runPromise
    )
    expect(res).toStrictEqual([
      {a: 0, b: 104,}, {a: 104, b: 276,}, {a: 276, b: 764,}, {a: 764, b: 1624,}, {a: 1624, b: 1684,}, {
        a: 1684,
        b: 40180,
      }, {a: 40180, b: 40316,}, {a: 40316, b: 40388,}, {a: 40388, b: 40560,}, {a: 40560, b: 40968,}, {
        a: 40968,
        b: 41216,
      },
    ])
  })
})
