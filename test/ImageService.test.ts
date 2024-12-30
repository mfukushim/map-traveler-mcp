import {describe, expect, it} from "@effect/vitest"
import {Effect, Logger, LogLevel} from "effect";
import {ImageService, ImageServiceLive} from "../src/ImageService.js";
import {runPromise} from "effect/Effect";
import {FetchHttpClient} from "@effect/platform";
import * as fs from "node:fs";
import {PixAIClient} from "@pixai-art/client";
import {type MediaBaseFragment, TaskBaseFragment} from "@pixai-art/client/types/generated/graphql.js";
import {DbServiceLive} from "../src/DbService.js";
import {NodeFileSystem} from "@effect/platform-node"
import sharp = require("sharp");
import { transparentBackground } from "transparent-background";
import {McpLogService, McpLogServiceLive} from "../src/McpLogService.js";

describe("Image", () => {

  it("makeHotelPict", async () => {
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    //  実行エラーが取れると実行できたりする。。 intellijの問題だが、どういう種類の問題なんだろう。。。仕方ないからしばらくはコマンドライン併用、、
    const res = await Effect.gen(function* () {
      return yield* ImageService.makeHotelPict("depth of field, cinematic composition, masterpiece, best quality,looking at viewer,anime,(solo:1.1),(1 girl:1.1),loli,school uniform,blue skirt,long socks,black pixie cut","pixAi", 12)  //
    }).pipe(
      Effect.provide([ImageService.Default, FetchHttpClient.layer,McpLogServiceLive,NodeFileSystem.layer]), //  layer
      Logger.withMinimumLogLevel(LogLevel.Trace),
      Effect.tapError(e => McpLogService.logError(e.toString()).pipe(Effect.provide(McpLogServiceLive))),
      Effect.tap(a => McpLogService.log(a.length).pipe(Effect.provide(McpLogServiceLive))),
      runPromise
    )

    fs.writeFileSync("tools/test/makeHotelPict.jpg", res)
    expect(res).toBeInstanceOf(Buffer)
  })
  it("pixAiMakeT2I", async () => {
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    //  実行エラーが取れると実行できたりする。。 intellijの問題だが、どういう種類の問題なんだろう。。。仕方ないからしばらくはコマンドライン併用、、
    const res = await Effect.gen(function* () {
      return yield* ImageService.pixAiMakeImage("depth of field, cinematic composition, masterpiece, best quality,looking at viewer,anime,(solo:1.1),(1 girl:1.1),loli,school uniform,blue skirt,long socks,black pixie cut")  //
    }).pipe(
      Effect.provide([ImageService.Default, FetchHttpClient.layer,McpLogServiceLive]), //  layer
      Logger.withMinimumLogLevel(LogLevel.Trace),
      Effect.tapError(Effect.logError),
      Effect.tap(a => Effect.log(a.length)),
      runPromise
    )

    fs.writeFileSync("tools/test/pixAiMakeImage.jpg", Buffer.from(res, "base64"))
    expect(typeof res).toBe('string')
  })
  it("pixAiMakeI2I", async () => {
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    //  実行エラーが取れると実行できたりする。。 intellijの問題だが、どういう種類の問題なんだろう。。。仕方ないからしばらくはコマンドライン併用、、
    const res = await Effect.gen(function* () {
      const buffer = fs.readFileSync('tools/1734408861_planeImage.jpg');
      return yield* ImageService.pixAiMakeImage("depth of field, cinematic composition, masterpiece, best quality,looking at viewer,anime,(solo:1.1),(1 girl:1.1),loli,school uniform,blue skirt,long socks,black pixie cut", buffer)  //
    }).pipe(
      Effect.provide([ImageService.Default, FetchHttpClient.layer,McpLogServiceLive]), //  layer
      Logger.withMinimumLogLevel(LogLevel.Trace),
      Effect.tapError(e => McpLogService.logError(e.toString()).pipe(Effect.provide(McpLogServiceLive))),
      Effect.tap(a => McpLogService.log(a.length).pipe(Effect.provide(McpLogServiceLive))),
      runPromise
    )

    fs.writeFileSync("tools/test/pixAiMakeI2I.jpg", Buffer.from(res, "base64"))
    expect(typeof res).toBe('string')
  })
  it("rembg", async () => {
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    //  実行エラーが取れると実行できたりする。。 intellijの問題だが、どういう種類の問題なんだろう。。。仕方ないからしばらくはコマンドライン併用、、

    // const rembg = new Rembg({
    //   logging: true,
    // });


    const buffer = fs.readFileSync('tools/test/testOutGen.png');
    const buf = await transparentBackground(buffer, "png", {
      // uses a 1024x1024 model by default
      // enabling fast uses a 384x384 model instead
      fast: false,
    });
    // const blob = await removeBackground(buffer)
    // const arrayBuffer = await blob.arrayBuffer()
    // const buf = Buffer.from(arrayBuffer)
    // const sh = sharp(buffer)
    // const sharp1 = await rembg.remove(sh);
    // const buf = await sharp1.toBuffer()
    fs.writeFileSync("tools/test/rembg.jpg", buf)
    expect(typeof buf).toBe('string')
  })
  it("makeRunnerImageV2_i2i", async () => {
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    //  実行エラーが取れると実行できたりする。。 intellijの問題だが、どういう種類の問題なんだろう。。。仕方ないからしばらくはコマンドライン併用、、
    const res = await Effect.gen(function* () {
      const buffer = fs.readFileSync('tools/1734408861_planeImage.jpg');
      return yield* ImageService.makeRunnerImageV3(buffer,"1 girl,anime",'pixAi',false,true)  //
    }).pipe(
      Effect.provide([ImageServiceLive, FetchHttpClient.layer, DbServiceLive, NodeFileSystem.layer,McpLogServiceLive]), //  layer
      Logger.withMinimumLogLevel(LogLevel.Trace),
      Effect.tapError(Effect.logError),
      Effect.tap(a => Effect.log(a)),
      runPromise
    )

    fs.writeFileSync("tools/test/makeRunnerImageV2.jpg", res.buf)
    expect(typeof res).toBe('Object')
  })
  it("makeRunnerImageV2_t2i", async () => {
    //  vitest --run --testNamePattern=calcDomesticTravelRoute MapService.test.ts
    //  実行エラーが取れると実行できたりする。。 intellijの問題だが、どういう種類の問題なんだろう。。。仕方ないからしばらくはコマンドライン併用、、
    const res = await Effect.gen(function* () {
      const buffer = fs.readFileSync('tools/1734408861_planeImage.jpg');
      return yield* ImageService.makeRunnerImageV3(buffer,"1 girl,anime",'pixAi',false,true)  //
    }).pipe(
      Effect.provide([ImageServiceLive, FetchHttpClient.layer, DbServiceLive, NodeFileSystem.layer,McpLogServiceLive]), //  layer
      Logger.withMinimumLogLevel(LogLevel.Trace),
      Effect.tapError(Effect.logError),
      Effect.tap(a => Effect.log(a)),
      runPromise
    )

    fs.writeFileSync("tools/test/makeRunnerImageV2.jpg", res.buf)
    expect(typeof res).toBe('string')
  })
  it("pixAiTest", async () => {
    const pixAiClient = new PixAIClient({
      apiKey: 'sk-qNC+ckMLzXINrQeEg3tY713pL3gO03T7fCE1YQw3lPBeCIK0',
      webSocketImpl: require('ws'),
    })
    const task = await pixAiClient.generateImage(
      {
        prompts: 'depth of field, cinematic composition, masterpiece, best quality,looking at viewer,anime,(solo:1.1),(1 girl:1.1),loli,school uniform,blue skirt',
        modelId: '1648918127446573124',
        width: 512,
        height: 512,
      },
      {
        onUpdate: task => {
          console.log(new Date(), 'Task update:', task)
        },
      },
    )
    console.log('Task completed: ', task)

    const media = await pixAiClient.getMediaFromTask(task as TaskBaseFragment) //  TODO

    expect(media && !Array.isArray(media)).toBeTruthy()

    console.log('downloading generated image...')
    const buffer = await pixAiClient.downloadMedia(media as MediaBaseFragment) // TODO

    fs.writeFileSync('tools/test/pixAiDirect.png', Buffer.from(buffer))

    console.log('done! check image named output.png')

  })
  it("composit test", async () => {
    const outSize = {w: 1600, h: 1000}
    const innerSize = {w: 1600, h: 1600}
    const windowSize = {w: 832, h: 1216}

    const shiftX =0
    const innerImage = await sharp('tools/1734408861_planeImage.jpg').resize({
      width: 1600,
      height: 1600,
      fit: "fill"
    }).png().toBuffer()
    const avatarImage = fs.readFileSync('tools/test/testOutRmBg.png');
    const out1 = await sharp(innerImage).composite([{input: avatarImage, left: shiftX, top: innerSize.h - windowSize.h}]).toBuffer() //
    const out =await sharp(out1).extract(
        {
        left: (innerSize.w - outSize.w) / 2,
        top: (innerSize.h - outSize.h) / 2,
        width: outSize.w,
        height: outSize.h
      }
      )
      .toBuffer()

    fs.writeFileSync('tools/test/output.png', Buffer.from(out))

    console.log('done! check image named output.png')

  })
})
