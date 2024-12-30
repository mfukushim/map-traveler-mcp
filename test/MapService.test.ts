import {describe, expect, it} from "@effect/vitest"
import {Effect, Logger, LogLevel} from "effect";
import {MapService} from "../src/MapService.js";
import {runPromise} from "effect/Effect";
import {FetchHttpClient} from "@effect/platform";
import * as fs from "node:fs";


describe("Map", () => {

  it("should pass", () => {
    expect(true).toBe(true)
  })

  it("getMapLocation", async () => {
    //  TODO なぜかintelliJ経由で実行するとコマンドを見つけられない。。 コマンドラインからだと使える。。。  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    await Effect.gen(function *() {
      return yield *MapService.getMapLocation("横浜")  //
    }).pipe(
      Effect.provide([MapService.Default, FetchHttpClient.layer]), //  layer
      Logger.withMinimumLogLevel(LogLevel.Trace),
      Effect.tapError(Effect.logError),
      Effect.tap(a => Effect.log(a)),
      runPromise
    )

    expect(true).toBe(true)
  })
  it("getNearly", async () => {
    //  TODO なぜかintelliJ経由で実行するとコマンドを見つけられない。。 コマンドラインからだと使える。。。  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    await Effect.gen(function *() {
      return yield *MapService.getNearly(37.68206875, 140.4550529784091,2000)  //
    }).pipe(
      Effect.provide([MapService.Default, FetchHttpClient.layer]), //  layer
      Logger.withMinimumLogLevel(LogLevel.Trace),
      Effect.tapError(Effect.logError),
      Effect.tap(a => Effect.log(a)),
      runPromise
    )

    expect(true).toBe(true)
  })
  it("calcDomesticTravelRoute", async () => {
    //  TODO なぜかintelliJ経由で実行するとコマンドを見つけられない。。 コマンドラインからだと使える。。。  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    await Effect.gen(function *() {
      yield *MapService.calcDomesticTravelRoute(35.698383,139.7730717,26.2125758,127.6790208,'JP','JP',"TRANSIT")  //
    }).pipe(
        Effect.provide([MapService.Default, FetchHttpClient.layer]), //  layer
        Logger.withMinimumLogLevel(LogLevel.Trace),
        // Effect.tapError(Effect.logError),
        // Effect.tap(Effect.log),
        runPromise
    )

    expect(true).toBe(true)
  })
  it("getStreetViewImage", async () => {
    //  vitest --run --testNamePattern=getStreetViewImage MapService.test.ts
    const res = await Effect.gen(function* () {
      return yield* MapService.getStreetViewImage(37.68206875, 140.4550529784091, 0, 640, 640)
    }).pipe(
        Effect.provide(MapService.Default),
        runPromise
    );
    fs.writeFileSync("tools/test.jpg", res)

    expect(true).toBe(true)
  })
})
