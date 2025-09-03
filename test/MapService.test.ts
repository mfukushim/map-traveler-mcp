import {describe, expect, it} from "@effect/vitest"
import {Effect, Layer, Logger, LogLevel, ManagedRuntime, Option} from "effect";
import {MapService, MapServiceLive} from "../src/MapService.js";
import {FetchHttpClient} from "@effect/platform";
import * as fs from "node:fs";
import {McpLogServiceLive} from "../src/McpLogService.js";
import {DbServiceLive} from "../src/DbService.js";
import {NodeFileSystem} from "@effect/platform-node";

const inGitHubAction = process.env.GITHUB_ACTIONS === 'true';

const AppLive = Layer.mergeAll(McpLogServiceLive,DbServiceLive,MapServiceLive,FetchHttpClient.layer,NodeFileSystem.layer)
const aiRuntime = ManagedRuntime.make(AppLive);

describe("Map", () => {
  // beforeAll(async () => {
  //   return await DbService.initSystemMode().pipe(
  //     Effect.provide([DbServiceLive]),
  //     Effect.runPromise
  //   )
  // });

  it("getMapLocation", async () => {
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    const res = await Effect.gen(function* () {
      return  yield* MapService.getMapLocation("東京駅")
    }).pipe(
        Logger.withMinimumLogLevel(LogLevel.Trace),
        Effect.tapError(e => Effect.logError(e.toString())),
        Effect.catchIf(a => a.toString() === 'Error: no key', e => Effect.succeed(Option.none())),
        Effect.tap(a => Effect.log(a)),
      aiRuntime.runPromise
    )

    expect(Option.isOption(res)).toBeTruthy()
  })
  it("getNearly", async () => {
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    const res = await Effect.gen(function* () {
      return yield* MapService.getNearly(37.68206875, 140.4550529784091, 2000)  //
    }).pipe(
      Logger.withMinimumLogLevel(LogLevel.Trace),
      Effect.tapError(e => Effect.logError(e.toString())),
      Effect.catchIf(a => a.toString() === 'Error: no key', e => Effect.succeed({})),
      Effect.tap(a => Effect.log(a)),
      aiRuntime.runPromise
    )

    expect(res).toBeInstanceOf(Object)
  })
  it("getTimezoneByLatLng", async () => {
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    const res = await Effect.gen(function* () {
      return yield* MapService.getTimezoneByLatLng(35.681236200000008, 139.7671248)  //
    }).pipe(
      Logger.withMinimumLogLevel(LogLevel.Trace),
      Effect.tapError(e => Effect.logError(e.toString())),
      Effect.catchIf(a => a.toString() === 'Error: no key', e => Effect.succeed({})),
      Effect.tap(a => Effect.log(a)),
      aiRuntime.runPromise
    )

    expect(typeof res).not.toBeNull()
  })
  it("calcDomesticTravelRoute", async () => {
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    const res = await Effect.gen(function* () {
      return yield* MapService.calcDomesticTravelRoute(35.698383, 139.7730717, 26.2125758, 127.6790208, 'JP', 'JP', "TRANSIT")  //
    }).pipe(
        Logger.withMinimumLogLevel(LogLevel.Trace),
        Effect.tapError(e =>Effect.logError(e.toString())),
        Effect.catchIf(a => a.toString() === 'Error: no key', e => Effect.succeed({})),
        Effect.tap(a => Effect.log(a)),
      aiRuntime.runPromise
    )

    expect(res).toBeInstanceOf(Object)
  })
  it("getStreetViewImage", async () => {
    //  vitest --run --testNamePattern=getStreetViewImage MapService.test.ts
    const res = await Effect.gen(function* () {
      return yield* MapService.getStreetViewImage(37.68206875, 140.4550529784091, 0, 640, 640)
    }).pipe(
        Effect.tapError(e =>Effect.logError(e.toString())),
        Effect.tap(a => {
          if (!inGitHubAction) {
            fs.writeFileSync("tools/test.jpg", a);
          }
          return Effect.log(a.length);
        }),
        Effect.catchIf(a => a.toString() === 'Error: no key', e => Effect.succeed({})),
      aiRuntime.runPromise
    );

    expect(res).toBeInstanceOf(Object)
  })
})
