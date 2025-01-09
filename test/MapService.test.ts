import {describe, expect, it} from "@effect/vitest"
import {Effect, Logger, LogLevel, Option} from "effect";
import {MapService, MapServiceLive} from "../src/MapService.js";
import {runPromise} from "effect/Effect";
import {FetchHttpClient} from "@effect/platform";
import * as fs from "node:fs";
import {McpLogServiceLive} from "../src/McpLogService.js";

const inGitHubAction = process.env.GITHUB_ACTIONS === 'true';

describe("Map", () => {

  it("getMapLocation", async () => {
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    const res = await Effect.gen(function* () {
      return  yield* MapService.getMapLocation("東京駅")
    }).pipe(
        Effect.provide([MapService.Default, FetchHttpClient.layer,McpLogServiceLive]),
        Logger.withMinimumLogLevel(LogLevel.Trace),
        Effect.tapError(e => Effect.logError(e.toString())),
        Effect.catchIf(a => a.toString() === 'Error: no key', e => Effect.succeed(Option.none())),
        Effect.tap(a => Effect.log(a)),
        runPromise
    )

    expect(Option.isOption(res)).toBeTruthy()
  })
  it("getNearly", async () => {
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    const res = await Effect.gen(function* () {
      return yield* MapService.getNearly(37.68206875, 140.4550529784091, 2000)  //
    }).pipe(
      Effect.provide([MapServiceLive, FetchHttpClient.layer, McpLogServiceLive]), //  layer
      Logger.withMinimumLogLevel(LogLevel.Trace),
      Effect.tapError(e => Effect.logError(e.toString())),
      Effect.catchIf(a => a.toString() === 'Error: no key', e => Effect.succeed({})),
      Effect.tap(a => Effect.log(a)),
      runPromise
    )

    expect(res).toBeInstanceOf(Object)
  })
  it("getTimezoneByLatLng", async () => {
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    const res = await Effect.gen(function* () {
      return yield* MapService.getTimezoneByLatLng(35.681236200000008, 139.7671248)  //
    }).pipe(
      Effect.provide([MapServiceLive, FetchHttpClient.layer, McpLogServiceLive]), //  layer
      Logger.withMinimumLogLevel(LogLevel.Trace),
      Effect.tapError(e => Effect.logError(e.toString())),
      Effect.catchIf(a => a.toString() === 'Error: no key', e => Effect.succeed({})),
      Effect.tap(a => Effect.log(a)),
      runPromise
    )

    expect(typeof res).not.toBeNull()
  })
  it("calcDomesticTravelRoute", async () => {
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    const res = await Effect.gen(function* () {
      return yield* MapService.calcDomesticTravelRoute(35.698383, 139.7730717, 26.2125758, 127.6790208, 'JP', 'JP', "TRANSIT")  //
    }).pipe(
        Effect.provide([MapService.Default, FetchHttpClient.layer, McpLogServiceLive]), //  layer
        Logger.withMinimumLogLevel(LogLevel.Trace),
        Effect.tapError(e =>Effect.logError(e.toString())),
        Effect.catchIf(a => a.toString() === 'Error: no key', e => Effect.succeed({})),
        Effect.tap(a => Effect.log(a)),
        runPromise
    )

    expect(res).toBeInstanceOf(Object)
  })
  it("getStreetViewImage", async () => {
    //  vitest --run --testNamePattern=getStreetViewImage MapService.test.ts
    const res = await Effect.gen(function* () {
      return yield* MapService.getStreetViewImage(37.68206875, 140.4550529784091, 0, 640, 640)
    }).pipe(
        Effect.provide(MapServiceLive),
        Effect.tapError(e =>Effect.logError(e.toString())),
        Effect.tap(a => {
          if (!inGitHubAction) {
            fs.writeFileSync("tools/test.jpg", a);
          }
          return Effect.log(a.length);
        }),
        Effect.catchIf(a => a.toString() === 'Error: no key', e => Effect.succeed({})),
        runPromise
    );

    expect(res).toBeInstanceOf(Object)
  })
})
