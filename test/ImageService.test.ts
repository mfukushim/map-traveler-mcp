import {beforeAll, describe, expect, it} from "@effect/vitest"
import {Effect, Logger, LogLevel} from "effect";
import {ImageService, ImageServiceLive} from "../src/ImageService.js";
import {runPromise} from "effect/Effect";
import {FetchHttpClient} from "@effect/platform";
import * as fs from "node:fs";
import {DbService, DbServiceLive} from "../src/DbService.js";
import {NodeCommandExecutor, NodeContext, NodeFileSystem} from "@effect/platform-node"
// import {transparentBackground} from "transparent-background";
import {McpLogService, McpLogServiceLive} from "../src/McpLogService.js";
import {NodeRuntime} from "node:inspector";
import {PlatformError} from "@effect/platform/Error";

const inGitHubAction = process.env.GITHUB_ACTIONS === 'true';

describe("Image", () => {
  beforeAll(async () => {
    return await DbService.initSystemMode().pipe(
        Effect.provide([DbServiceLive, McpLogServiceLive]),
        Effect.runPromise
    )
  });

  it("makeHotelPictPixAi", async () => {
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    const res = await Effect.gen(function* () {
      return yield* ImageService.makeHotelPict("depth of field, cinematic composition, masterpiece, best quality,looking at viewer,anime,(solo:1.1),(1 girl:1.1),loli,school uniform,blue skirt,long socks,black pixie cut", "PixAi", 12)  //
    }).pipe(
      Effect.provide([ImageService.Default, FetchHttpClient.layer, McpLogServiceLive, NodeFileSystem.layer]),
      Logger.withMinimumLogLevel(LogLevel.Trace),
      Effect.tapError(e => McpLogService.logError(e.toString()).pipe(Effect.provide(McpLogServiceLive))),
      Effect.tap(a => McpLogService.log(a.length).pipe(Effect.provide(McpLogServiceLive))),
      runPromise
    )

    if (!inGitHubAction) {
      fs.writeFileSync("tools/test/makeHotelPictPixAi.jpg", res);
    }

    expect(res).toBeInstanceOf(Buffer)
  })
  it("makeHotelPictSd", async () => {
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    const res = await Effect.gen(function* () {
      return yield* ImageService.makeHotelPict("depth of field, cinematic composition, masterpiece, best quality,looking at viewer,anime,(solo:1.1),(1 girl:1.1),loli,school uniform,blue skirt,long socks,black pixie cut", "sd", 12)  //
    }).pipe(
      Effect.provide([ImageService.Default, FetchHttpClient.layer, McpLogServiceLive, NodeFileSystem.layer]),
      Logger.withMinimumLogLevel(LogLevel.Trace),
      Effect.tapError(e => McpLogService.logError(e.toString()).pipe(Effect.provide(McpLogServiceLive))),
      Effect.tap(a => McpLogService.log(a.length).pipe(Effect.provide(McpLogServiceLive))),
      runPromise
    )
    if (!inGitHubAction) {
      fs.writeFileSync("tools/test/makeHotelPictSd.jpg", res);
    }
    expect(res).toBeInstanceOf(Buffer)
  })
  it("pixAiMakeT2I", async () => {
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    const res = await Effect.gen(function* () {
      return yield* ImageService.selectImageGenerator("pixAi","depth of field, cinematic composition, masterpiece, best quality,looking at viewer,anime,(solo:1.1),(1 girl:1.1),loli,school uniform,blue skirt,long socks,black pixie cut")  //
    }).pipe(
      Effect.provide([ImageService.Default, FetchHttpClient.layer, McpLogServiceLive]),
      Logger.withMinimumLogLevel(LogLevel.Trace),
      Effect.andThen(a => {
        if (!inGitHubAction) {
          fs.writeFileSync("tools/test/pixAiMakeImage.jpg", a);
        }
        return "succeed";
      }),
      Effect.tapError(e => Effect.logError(e.toString())),
      Effect.catchIf(a => a.message === 'no key', e => Effect.succeed("noKey")),
      runPromise
    )
    expect(typeof res).toBe('string')
  })
  it("pixAiMakeI2I", async () => {
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    //  実行エラーが取れると実行できたりする。。 intellijの問題だが、どういう種類の問題なんだろう。。。仕方ないからしばらくはコマンドライン併用、、
    const res = await Effect.gen(function* () {
      const buffer = fs.readFileSync('tools/test.jpg');
      return yield* ImageService.selectImageGenerator("pixAi","depth of field, cinematic composition, masterpiece, best quality,looking at viewer,anime,(solo:1.1),(1 girl:1.1),loli,school uniform,blue skirt,long socks,black pixie cut", buffer)  //
    }).pipe(
      Effect.provide([ImageService.Default, FetchHttpClient.layer, McpLogServiceLive]), //  layer
      Logger.withMinimumLogLevel(LogLevel.Trace),
      Effect.andThen(a => {
        if (!inGitHubAction) {
          fs.writeFileSync("tools/test/pixAiMakeI2I.jpg", a)
        }
        return "succeed";
      }),
      Effect.tapError(e => McpLogService.logError(e.toString()).pipe(Effect.provide(McpLogServiceLive))),
      Effect.catchIf(a => a.message === 'no key', e => Effect.succeed("noKey")),
      runPromise
    )
    expect(typeof res).toBe('string')
  })
  it("sdMakeT2I", async () => {
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    const res = await Effect.gen(function* () {
      return yield* ImageService.selectImageGenerator("sd","depth of field, cinematic composition, masterpiece, best quality,looking at viewer,anime,(solo:1.1),(1 girl:1.1),loli,school uniform,blue skirt,long socks,black pixie cut")  //
    }).pipe(
      Effect.provide([ImageService.Default, FetchHttpClient.layer, McpLogServiceLive]),
      Logger.withMinimumLogLevel(LogLevel.Trace),
      Effect.andThen(a => {
        if (!inGitHubAction) {
          fs.writeFileSync("tools/test/sdMakeImage.jpg", a);
        }
        return "succeed";
      }),
      Effect.tapError(e => Effect.logError(e.toString())),
      Effect.catchIf(a => a.message === 'no key', e => Effect.succeed("noKey")),
      runPromise
    )
    expect(typeof res).toBe('string')
  })
  it("sdMakeI2I", async () => {
    //  vitest --run --testNamePattern=sdMakeI2I ImageService.test.ts
    //  実行エラーが取れると実行できたりする。。 intellijの問題だが、どういう種類の問題なんだろう。。。仕方ないからしばらくはコマンドライン併用、、
    const res = await Effect.gen(function* () {
      const buffer = fs.readFileSync('tools/test.jpg');
      return yield* ImageService.selectImageGenerator("sd","depth of field, cinematic composition, masterpiece, best quality,looking at viewer,anime,(solo:1.1),(1 girl:1.1),loli,school uniform,blue skirt,long socks,black pixie cut", buffer)  //
    }).pipe(
      Effect.provide([ImageService.Default, FetchHttpClient.layer, McpLogServiceLive]), //  layer
      Logger.withMinimumLogLevel(LogLevel.Trace),
      Effect.andThen(a => {
        if (!inGitHubAction) {
          fs.writeFileSync("tools/test/sdMakeI2I.jpg", a)
        }
        return "succeed";
      }),
      Effect.tapError(e => McpLogService.logError(e.toString()).pipe(Effect.provide(McpLogServiceLive))),
      Effect.catchIf(a => a.message === 'no key', e => Effect.succeed("noKey")),
      runPromise
    )
    expect(typeof res).toBe('string')
  })
  // it("rembg", async () => {
  //   //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
  //   const buffer = fs.readFileSync('tools/testRembg.png');
  //   const buf = await transparentBackground(buffer, "png", {
  //     fast: false,
  //   });
  //   if (!inGitHubAction) {
  //     fs.writeFileSync("tools/test/rembg.jpg", buf);
  //   }
  //   expect(buf).toBeInstanceOf(Buffer)
  // })
  it("makeRunnerImageV3_i2iPixAI", async () => {
    //  vitest --run --testNamePattern=makeRunnerImageV3_i2i ImageService.test.ts
    const res = await Effect.gen(function* () {
      const buffer = fs.readFileSync('tools/test.jpg');
      return yield* ImageService.makeRunnerImageV3(buffer, "depth of field, cinematic composition, masterpiece, best quality,looking at viewer,anime,(solo:1.1),(1 girl:1.1),loli,school uniform,blue skirt,long socks,black pixie cut", 'pixAi', false, true)  //
    }).pipe(
      Effect.provide([ImageServiceLive, FetchHttpClient.layer, DbServiceLive, NodeFileSystem.layer, McpLogServiceLive,NodeContext.layer,NodeCommandExecutor.layer]),
      Logger.withMinimumLogLevel(LogLevel.Trace),
      Effect.tapError(e => Effect.logError(e.toString())),
      Effect.tap(a => {
        if (!inGitHubAction) {
          fs.writeFileSync("tools/test/makeRunnerImageV3PixAI.png", a.buf);
        }
      }),
      Effect.catchIf(a => a.toString() === 'Error: no key', e => Effect.succeed({})),
      Effect.tap(a => Effect.log(a)),
      runPromise
    )
    expect(typeof res).toBe('object')
  })
  it("makeRunnerImageV3_i2iSd", async () => {
    //  vitest --run --testNamePattern=makeRunnerImageV3_i2i ImageService.test.ts
    const res = await Effect.gen(function* () {
      const buffer = fs.readFileSync('tools/test.jpg');
      return yield* ImageService.makeRunnerImageV3(buffer, "depth of field, cinematic composition, masterpiece, best quality,looking at viewer,anime,(solo:1.1),(1 girl:1.1),loli,school uniform,blue skirt,long socks,black pixie cut",'sd', false, true)  //
    }).pipe(
      Effect.provide([ImageServiceLive, FetchHttpClient.layer, DbServiceLive, NodeFileSystem.layer, McpLogServiceLive]), //  layer
      Logger.withMinimumLogLevel(LogLevel.Trace),
      Effect.tapError(e => Effect.logError(e.toString())),
      Effect.tap(a => {
        if (!inGitHubAction) {
          fs.writeFileSync("tools/test/makeRunnerImageV3Sd.png", a.buf);
        }
      }),
      Effect.catchIf(a => a.toString() === 'Error: no key', e => Effect.succeed({})),
      Effect.tap(a => Effect.log(a)),
      runPromise
    )
    expect(typeof res).toBe('object')
  })
})
