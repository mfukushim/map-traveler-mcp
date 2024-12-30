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


describe("Runner", () => {
  it("should pass", () => {
    expect(true).toBe(true)
  })
  it("getCurrentView", async () => {
    //  TODO なぜかintelliJ経由で実行するとコマンドを見つけられない。。 コマンドラインからだと使える。。。  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    await Effect.gen(function *() {
      return yield *RunnerService.getCurrentView(false,false,true)  //
    }).pipe(
      Effect.provide([RunnerServiceLive,DbServiceLive,MapServiceLive,ImageServiceLive,StoryServiceLive,NodeFileSystem.layer, FetchHttpClient.layer]), //  layer
      Logger.withMinimumLogLevel(LogLevel.Trace),
      Effect.tapError(Effect.logError),
      Effect.tap(a => Effect.log(a)),
      runPromise
    )

  })
  it("setCurrentLocation", async () => {
    await Effect.gen(function *() {
      return yield *RunnerService.getCurrentView(false,false,true)  //
    }).pipe(
      Effect.provide([RunnerServiceLive,DbServiceLive,MapServiceLive,ImageServiceLive,StoryServiceLive,NodeFileSystem.layer, FetchHttpClient.layer]), //  layer
      Logger.withMinimumLogLevel(LogLevel.Trace),
      Effect.tapError(Effect.logError),
      Effect.tap(a => Effect.log(a)),
      runPromise
    )
  })
/*
  it("getDestinationAddress", async () => {
    try {
      const res = await getDestinationAddress();
      console.log(res)
    } catch (e) {
      expect(e).toBeInstanceOf(Error)
      if(e instanceof Error) console.log(e.message)
    }

  })
  it("setDestinationAddress", async () => {
    try {
      const res = await setDestinationAddress("横浜市馬車道");
      console.log(res)
    } catch (e) {
      expect(e).toBeInstanceOf(Error)
      if(e instanceof Error) console.log(e.message)
    }

  })
  it("startJourney", async () => {
    try {
      const res = await startJourney();
      console.log(JSON.stringify(res,undefined,1).slice(0,200))
    } catch (e) {
      expect(e).toBeInstanceOf(Error)
      if(e instanceof Error) console.log(e.message)
    }

  })
*/

})
