
import {Effect, Schedule} from 'effect';
import {
  GeneratorProvider,
} from './DefGenerators.js';
import {TimeoutException} from 'effect/Cause';
import {
  ContentListUnion,
  GenerateContentResponse,
  GoogleGenAI,
} from '@google/genai';

export abstract class GeminiBaseGenerator  {
  protected ai: GoogleGenAI;
  protected abstract model:string;

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({
      apiKey: apiKey,
    });
  }


}


export class GeminiImageGenerator extends GeminiBaseGenerator {
  protected genName:GeneratorProvider = 'geminiImage';
  protected model = 'gemini-2.5-flash-image-preview';

  static make(apiKey: string) {
    if (!apiKey) {
      return Effect.fail(new Error('gemini api key is not set.'));
    }
    return Effect.succeed(new GeminiImageGenerator(apiKey));
  }

  execLlm(text: string,baseImage?:Buffer): Effect.Effect<GenerateContentResponse, Error> {
    const state = this;
    // console.error('prompt',text)
    return Effect.gen(this, function* () {
      const prompt:ContentListUnion = [{text: text }];
      if (baseImage) {
        const base64Image = baseImage.toString("base64");
        prompt.push({
          inlineData: {
            mimeType: "image/png",
            data: base64Image,
          },
        })
      }
      return yield* Effect.tryPromise({
        try: () => state.ai.models.generateContent({
          model: state.model,
          contents: prompt,
        }),
        catch: error => {
          console.error('gemini image error:', `${error}`);
          return new Error(`gemini image error:${(error as any)}`);
        },
      }).pipe(
        Effect.timeout('1 minute'),
        Effect.retry(Schedule.recurs(1).pipe(Schedule.intersect(Schedule.spaced('1 seconds')))),
        Effect.catchIf(a => a instanceof TimeoutException, _ => Effect.fail(new Error(`gemini API error:timeout`))),
      );
    }).pipe(Effect.catchAll(e => {
      console.error('geminiImage catch error:');
      return Effect.fail(new Error(`${e}`));
    }));
  }

  toAnswerOut(responseOut: GenerateContentResponse) {
    //  geminiImageとして呼んだ場合は画像しか取り出さない
    if (responseOut.candidates) {
      if(responseOut.candidates[0]?.finishReason !== 'STOP') {
        console.error(
          'geminiImage response is not image.',
          responseOut.candidates[0].finishReason,
        )
      }
      const parts = responseOut.candidates[0]?.content?.parts
      if (parts) {
        for (const part of parts) {
          // if(part.text) {
          //   console.log(part.text);
          // }
          if (part?.inlineData?.data) {
            return Effect.succeed(Buffer.from(part.inlineData.data, "base64"));
          }
        }
      }
    }
    return Effect.fail(new Error('geminiImage response is not image.'));
  }

}
