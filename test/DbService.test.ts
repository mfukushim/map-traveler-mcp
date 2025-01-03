import {describe, expect, it} from "@effect/vitest"
import {Effect, Logger, LogLevel} from "effect";
// import {ImageService} from "../src/ImageService.js";
import {runPromise} from "effect/Effect";
// import {FetchHttpClient} from "@effect/platform";
// import * as fs from "node:fs";
import {DbService, isValidFilePath} from "../src/DbService.js";
import dayjs from "dayjs";


describe("Db", () => {

  it("getAvatar", async () => {
    //  vitest --run --testNamePattern=getAvatar DbService.test.ts
    //  実行エラーが取れると実行できたりする。。 intellijの問題だが、どういう種類の問題なんだろう。。。仕方ないからしばらくはコマンドライン併用、、
    const res = await Effect.gen(function* () {
      return yield* DbService.getAvatar(1).pipe(Effect.tap(a => Effect.log(a)))  //
    }).pipe(
      Effect.provide([DbService.Default]), //  layer
      Logger.withMinimumLogLevel(LogLevel.Trace),
      Effect.tapError(e => Effect.logError(e)),
      Effect.tap(a => Effect.log(a)),
      runPromise
    )
    expect(res.id).toBe(1)
  })
  it("getTodayAnniversary", async () => {
    //  vitest --run --testNamePattern=getTodayAnniversary DbService.test.ts
    //  実行エラーが取れると実行できたりする。。 intellijの問題だが、どういう種類の問題なんだろう。。。仕方ないからしばらくはコマンドライン併用、、
    const res = await Effect.gen(function* () {
      const now = dayjs()
      return yield* DbService.getTodayAnniversary(now).pipe(Effect.tap(a => Effect.log(a)))  //
    }).pipe(
      Effect.provide([DbService.Default]), //  layer
      Logger.withMinimumLogLevel(LogLevel.Trace),
      Effect.tapError(Effect.logError),
      Effect.tap(a => Effect.log(a.length)),
      runPromise
    )
    expect(res).toStrictEqual([])
  })
  it("getEnv", async () => {
    //  vitest --run --testNamePattern=getTodayAnniversary DbService.test.ts
    //  実行エラーが取れると実行できたりする。。 intellijの問題だが、どういう種類の問題なんだろう。。。仕方ないからしばらくはコマンドライン併用、、
    const res = await Effect.gen(function* () {
      return yield* DbService.getEnv("abc").pipe(Effect.tap(a => Effect.log(a)))  //
    }).pipe(
      Effect.provide([DbService.Default]), //  layer
      Logger.withMinimumLogLevel(LogLevel.Trace),
      Effect.tapError(e => Effect.logError(e.toString())),
      Effect.tap(a => Effect.log(a)),
      runPromise
    )
    expect(typeof res).toBe('string')
  })
  it("saveEnv", async () => {
    //  vitest --run --testNamePattern=getTodayAnniversary DbService.test.ts
    //  実行エラーが取れると実行できたりする。。 intellijの問題だが、どういう種類の問題なんだろう。。。仕方ないからしばらくはコマンドライン併用、、
    const res = await Effect.gen(function* () {
      return yield* DbService.saveEnv("abc","xyz").pipe(Effect.tap(a => Effect.log(a)))  //
    }).pipe(
        Effect.provide([DbService.Default]), //  layer
        Logger.withMinimumLogLevel(LogLevel.Trace),
        Effect.tapError(Effect.logError),
        Effect.tap(a => Effect.log(a)),
        runPromise
    )
    expect(res.key).toBe('abc')
    expect(res.value).toBe('xyz')
  })
  it("pathTest", async () => {
    //  vitest --run --testNamePattern=getTodayAnniversary DbService.test.ts
    //  実行エラーが取れると実行できたりする。。 intellijの問題だが、どういう種類の問題なんだろう。。。仕方ないからしばらくはコマンドライン併用、、
    console.log(isValidFilePath('C:/Users/tetra_000/Desktop/traveler.sqlite'))
  })
})
