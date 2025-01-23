// @vitest-environment node
import {Effect, Logger, LogLevel} from "effect";
import {describe, expect, it} from "@effect/vitest"
import {RunnerService, RunnerServiceLive} from "../src/RunnerService.js";
import {runPromise} from "effect/Effect";
import {FetchHttpClient} from "@effect/platform";
import {DbServiceLive, RunStatus} from "../src/DbService.js";
import {MapDef, MapServiceLive} from "../src/MapService.js";
import {ImageServiceLive} from "../src/ImageService.js";
import {StoryServiceLive} from "../src/StoryService.js";
import {NodeFileSystem} from "@effect/platform-node"
import {McpLogServiceLive} from "../src/McpLogService.js";
import {AnswerError} from "../src/mapTraveler.js";
import * as fs from "node:fs";
import dayjs from "dayjs";


describe("Runner", () => {

  it("getCurrentView_practice", async () => {
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    const res = await Effect.gen(function* () {
      return yield* RunnerService.getCurrentView(dayjs(),false, false, true)  //
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
  it("makeView", async () => {
    const s = fs.readFileSync('tools/test/routeSample.json', {encoding: 'utf-8'});
    const runStatus:RunStatus = {
      id: 1,
      avatarId: 1,
      tripId: 1,
      tilEndEpoch: 0,
      status: "running",
      from: '',
      to: '', //  現在処理中の行き先,現在位置
      destination: '', //  計画中の行き先
      startLat: 0,
      startLng: 0,
      endLat: 0,
      endLng: 0,
      durationSec: 1,
      distanceM: 1,
      startTime: new Date(),
      endTime: new Date(),
      startCountry: null,
      endCountry: null,
      startTz: null,
      endTz: null,
      currentPathNo: -1,
      currentStepNo: -1,
    }
    let pct = 30
    
    
    const res = await Effect.gen(function* () {
      return yield* RunnerService.makeView(runStatus,pct/100,false,true,true,false,s)
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

})
