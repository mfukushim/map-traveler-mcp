import {describe, expect, it} from "@effect/vitest"
import {Effect, Logger, LogLevel} from "effect";
// import {ImageService} from "../src/ImageService.js";
import {runPromise} from "effect/Effect";
// import {FetchHttpClient} from "@effect/platform";
// import * as fs from "node:fs";
import {DbService} from "../src/DbService.js";
import dayjs from "dayjs";
import { drizzle } from 'drizzle-orm/libsql';
import {runAvatar} from "../src/db/schema.js";


describe("Db", () => {

  it("should pass",async () => {
    const db = drizzle('file:src/db/mimi_test.sqlite');
    
    const data = await db.select().from(runAvatar);
    console.log(data)

    expect(true).toBe(true)
  })

  it("test", async () => {
    //  TODO なぜかintelliJ経由で実行するとコマンドを見つけられない。。 コマンドラインからだと使える。。。  vitest --run --testNamePattern=getAvatar DbService.test.ts
    //  実行エラーが取れると実行できたりする。。 intellijの問題だが、どういう種類の問題なんだろう。。。仕方ないからしばらくはコマンドライン併用、、
    const res = await Effect.gen(function* () {
      return yield* DbService.test().pipe(Effect.tap(a => Effect.log(a)))  //
    }).pipe(
      Effect.provide([DbService.Default]), //  layer
      Logger.withMinimumLogLevel(LogLevel.Trace),
      Effect.tapError(e => Effect.logError(e)),
      Effect.tap(a => Effect.log(a)),
      runPromise
    )
    expect(res).toBeInstanceOf(Buffer)
  })
  it("getAvatar", async () => {
    //  TODO なぜかintelliJ経由で実行するとコマンドを見つけられない。。 コマンドラインからだと使える。。。  vitest --run --testNamePattern=getAvatar DbService.test.ts
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
    expect(res).toBeInstanceOf(Buffer)
  })
  it("getTodayAnniversary", async () => {
    //  TODO なぜかintelliJ経由で実行するとコマンドを見つけられない。。 コマンドラインからだと使える。。。  vitest --run --testNamePattern=getTodayAnniversary DbService.test.ts
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
    expect(res).toBeInstanceOf(Buffer)
  })
  it("getEnv", async () => {
    //  TODO なぜかintelliJ経由で実行するとコマンドを見つけられない。。 コマンドラインからだと使える。。。  vitest --run --testNamePattern=getTodayAnniversary DbService.test.ts
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
    //  TODO なぜかintelliJ経由で実行するとコマンドを見つけられない。。 コマンドラインからだと使える。。。  vitest --run --testNamePattern=getTodayAnniversary DbService.test.ts
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
    expect(res).toBeInstanceOf(Buffer)
  })
})
