import {Schema} from 'effect';


/**
 * 対応ジェネレーター
 */
export const GeneratorProviderSchema = Schema.Literal(
  'openAiText',
  'openAiImage',
  'openAiVoice',
  'claudeText',
  'geminiText',
  'geminiImage',
  'geminiVoice',
  // 'ollama',
  // 'voiceVox',
  // 'comfyUi',
  'pixAi',  //  TODO 確認
  'emptyText',
  'emptyImage',
  'emptyVoice',
);

export type GeneratorProvider = typeof GeneratorProviderSchema.Type

