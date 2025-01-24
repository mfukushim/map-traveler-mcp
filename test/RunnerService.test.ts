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
import {McpLogService, McpLogServiceLive} from "../src/McpLogService.js";
import {AnswerError} from "../src/mapTraveler.js";
import * as fs from "node:fs";
import dayjs from "dayjs";


describe("Runner", () => {

  it("getCurrentView_practice", async () => {
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    const res = await Effect.gen(function* () {
      return yield* RunnerService.getCurrentView(dayjs(), false, false, true)  //
    }).pipe(
      Effect.provide([RunnerServiceLive, DbServiceLive, MapServiceLive, ImageServiceLive, StoryServiceLive,
        FetchHttpClient.layer, McpLogServiceLive]), //  layer
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
        FetchHttpClient.layer, McpLogServiceLive]),
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
        FetchHttpClient.layer, McpLogServiceLive]),
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
    const now = dayjs()
    const s = fs.readFileSync('tools/test/routeSample.json', {encoding: 'utf-8'});
    //  このサンプルの秒ステップ [{0,104},{104,276},{276,764},{764,1624},{1624,1684},{1684,40180},{40180,40316},{40316,40388},{40388,40560},{40560,40968},{40968,41216}]
    const runStatus: RunStatus = {
      id: 1,
      avatarId: 1,
      tripId: 1,
      tilEndEpoch: now.add(41216, 'second').unix(), //  このサンプルは41216秒 約11.5時間
      status: "running",
      from: 'from',
      to: 'to', //  現在処理中の行き先,現在位置
      destination: 'dest', //  計画中の行き先
      startLat: 0,
      startLng: 0,
      endLat: 0,
      endLng: 0,
      durationSec: 1,
      distanceM: 1,
      startTime: now.toDate(),
      endTime: null,
      startCountry: null,
      endCountry: null,
      startTz: 'Asia/Tokyo',
      endTz: 'Asia/Tokyo',
      currentPathNo: -1,
      currentStepNo: -1,
    }
    const pctList = [0,5,40,60,90,100]

    const res = await Effect.gen(function* () {
      return yield* Effect.forEach(pctList, a => RunnerService.makeView(runStatus, a / 100, false, true, true, false, s)) 
    }).pipe(
      Logger.withMinimumLogLevel(LogLevel.Trace),
      Effect.tapError(Effect.logError),
      // Effect.catchIf(a => a instanceof AnswerError, e => Effect.succeed({content: []})),
      Effect.tap(a => McpLogService.logTraceToolsRes(a.flat())),
      Effect.provide([RunnerServiceLive, DbServiceLive, MapServiceLive, ImageServiceLive, StoryServiceLive, FetchHttpClient.layer]),
      runPromise
    )
    expect(res).toBeInstanceOf(Array)
    expect(res.flat().filter(a => a.type === 'text').every(b => ['current location is','\'I am in a hotel'].some(c => b.text?.includes(c)))).toBeTruthy()
  })

})
