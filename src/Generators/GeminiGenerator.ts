// import {ContextGenerator, GeneratorTask} from './ContextGenerator.js';
import {Chunk, Effect, Schedule, Stream} from 'effect';
// import {AsMessage, AsMessageContent, AsMessageContentMutable, AsOutput, SysConfig} from '../../common/Def.js';
// import {DocService} from './DocService.js';
// import {McpService} from './McpService.js';
// import {ConfigService} from './ConfigService.js';
import {
  ContextGeneratorInfo,
  ContextGeneratorSetting,
  GeminiImageSettings,
  GeminiSettings,
  GeneratorProvider,
} from './DefGenerators.js';
import {TimeoutException} from 'effect/Cause';
import {
  Content,
  GenerateContentResponse,
  GoogleGenAI,
  Modality,
} from '@google/genai';
import * as fs from "node:fs";

export abstract class GeminiBaseGenerator  {
  protected geminiSettings: GeminiSettings | undefined;
  protected ai: GoogleGenAI;
  //protected contextCache: Map<string, Content> = new Map(); aiコンテンツとasMessageが非対応なのでちょっとやり方を考える。。
  protected prevContexts: Content[] = [];
  protected abstract model:string;
  protected abstract genName:GeneratorProvider;



  static generatorInfo: ContextGeneratorInfo = {
    usePreviousContext: true,
    defaultPrevContextSize: 100,
    inputContextTypes: ['image', 'text'],
    outputContextTypes: ['text'],
    contextRole: 'bot',
    addToMainContext: true,
  };

  constructor(apiKey: string, settings?: GeminiSettings) {
    this.geminiSettings = settings;
    this.ai = new GoogleGenAI({
      apiKey: apiKey,
    });
  }


}


export class GeminiImageGenerator extends GeminiBaseGenerator {
  protected genName:GeneratorProvider = 'geminiImage';
  protected model = 'gemini-2.5-flash-preview-image';

  static make(apiKey: string, settings?: ContextGeneratorSetting): Effect.Effect<GeminiBaseGenerator, Error> {
    if (!apiKey) {
      return Effect.fail(new Error('gemini api key is not set.'));
    }
    return Effect.succeed(new GeminiImageGenerator(apiKey, settings as GeminiImageSettings | undefined));
  }

  execLlm(text: string): Effect.Effect<GenerateContentResponse[], Error> {
    const state = this;
    return Effect.gen(this, function* () {
      // const tools = yield* McpService.getToolDefs(avatarState.Config.mcp);
      // state.prevContexts.push(inputContext);
      const imagePath = "path/to/cat_image.png";
      const imageData = fs.readFileSync(imagePath);
      const base64Image = imageData.toString("base64");
      const prompt = [
        { text: text // "Create a picture of my cat eating a nano-banana in a" + "fancy restaurant under the Gemini constellation"
        },
        {
          inlineData: {
            mimeType: "image/png",
            data: base64Image,
          },
        },
      ];
      // console.log('gemini image:', JSON.stringify(state.prevContexts));
      const res = yield* Effect.tryPromise({
        try: () => state.ai.models.generateContentStream({
          model: state.model,
          contents: prompt,
          config: {
            responseModalities: [Modality.TEXT, Modality.IMAGE],
          },
        }),
        catch: error => {
          console.log('gemini image error:', `${error}`);
          return new Error(`gemini image error:${(error as any)}`);
        },
      }).pipe(
        Effect.timeout('1 minute'),
        Effect.retry(Schedule.recurs(1).pipe(Schedule.intersect(Schedule.spaced('5 seconds')))),
        Effect.catchIf(a => a instanceof TimeoutException, e => Effect.fail(new Error(`gemini API error:timeout`))),
      );
      //  Stream部分実行をUIに反映 画像用だからテキストの生成は拾わない
      const stream: Stream.Stream<GenerateContentResponse, void> =
        Stream.fromAsyncIterable(res, (e) => new Error(String(e)))

      //  確定実行結果取得
      const collect = yield* Stream.runCollect(stream);
      return Chunk.toArray(collect);
    }).pipe(Effect.catchAll(e => Effect.fail(new Error(`${e}`))));
  // }).pipe(Effect.catchIf(a => a instanceof Error, e => Effect.succeed([])));
  }

  toAnswerOut(responseOut: GenerateContentResponse[]) {
    //  geminiImageとして呼んだ場合は画像しか取り出さない
    const outImages = responseOut.flatMap(b => b.data ? [b.data] : []).join('');
    return Effect.gen(function* () {
      const buffer = Buffer.from(outImages, "base64");
      return buffer
    });
  }

}
