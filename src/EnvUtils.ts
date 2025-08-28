/*! map-traveler-mcp | MIT License | https://github.com/mfukushim/map-traveler-mcp */

import * as Process from "node:process";
import {Schema} from "effect";
import {DbModeSchema, MapEndpointSchema, MoveModeSchema, PersonModeSchema} from "./DbService.js";

const EnvMap: [string, string][] = [
  ['GoogleMapApi_key', 'MT_GOOGLE_MAP_KEY'],
  ['mapApi_url', 'MT_MAP_API_URL'],
  ['time_scale', 'MT_TIME_SCALE'],
  ['sqlite_path', 'MT_SQLITE_PATH'],
  ['tursoUrl', 'MT_TURSO_URL'],
  ['tursoToken', 'MT_TURSO_TOKEN'],
  ['rembg_path','MT_REMBG_PATH'],
  ['rembgPath','MT_REMBG_PATH'],
  ['remBgUrl','MT_REMBG_URL'],
  // ['remBgPrKey','MT_REMBG_PR_KEY'],
  ['remBgWoKey','MT_REMBG_WO_KEY'],
  ['pixAi_key','MT_PIXAI_KEY'],
  ['sd_key','MT_SD_KEY'],
  ['pixAi_modelId','MT_PIXAI_MODEL_ID'],
  ['comfy_url','MT_COMFY_URL'],
  ['comfy_workflow_t2i','MT_COMFY_WORKFLOW_T2I'],
  ['comfy_workflow_i2i','MT_COMFY_WORKFLOW_I2I'],
  ['comfy_params','MT_COMFY_PARAMS'],
  ['fixed_model_prompt','MT_FIXED_MODEL_PROMPT'],
  ['bodyAreaRatio','MT_BODY_AREA_RATIO'],
  ['bodyHWRatio','MT_BODY_HW_RATIO'],
  ['bodyWindowRatioW','MT_BODY_WINDOW_RATIO_W'],
  ['bodyWindowRatioH','MT_BODY_WINDOW_RATIO_H'],
  ['bs_id','MT_BS_ID'],
  ['bs_pass','MT_BS_PASS'],
  ['bs_handle','MT_BS_HANDLE'],
  ['filter_tools','MT_FILTER_TOOLS'],
  ['moveMode','MT_MOVE_MODE'],
  ['image_width','MT_IMAGE_WIDTH'],
  ['no_sns_post','MT_NO_SNS_POST'],
  ['noImageOut','MT_NO_IMAGE'],
  ['noAvatar','MT_NO_AVATAR'],
  ['ServerLog','MT_SERVER_LOG'],
  ['feedTag','MT_FEED_TAG'],
  ['log_path','MT_LOG_PATH'],
]

function getEnvironment(name: string) {
  const map = EnvMap.find(value => value[0] === name);
  return map ? Process.env[map[1]] || Process.env[map[0]] : undefined;
}

export let GoogleMapApi_key = getEnvironment('GoogleMapApi_key')
export const mapApi_url = getEnvironment('mapApi_url')
export const sd_key = getEnvironment('sd_key')
export const pixAi_key = getEnvironment('pixAi_key')
export const pixAi_modelId = getEnvironment('pixAi_modelId')
export const comfy_url = getEnvironment('comfy_url')
export const no_sns_post = getEnvironment('no_sns_post')
export const ServerLog = getEnvironment('ServerLog')
export let moveMode = getEnvironment('moveMode')
export const remBgUrl = getEnvironment('remBgUrl')
export const rembg_path = getEnvironment('rembg_path')
export const rembgPath = getEnvironment('rembgPath')
// export const remBgPrKey = getEnvironment('remBgPrKey')
export const remBgWoKey = getEnvironment('remBgWoKey')
export let filter_tools = getEnvironment('filter_tools')
export const comfy_params = getEnvironment('comfy_params')
export const fixed_model_prompt = getEnvironment('fixed_model_prompt')
export const comfy_workflow_i2i = getEnvironment('comfy_workflow_i2i')
export const comfy_workflow_t2i = getEnvironment('comfy_workflow_t2i')
export let bs_id = getEnvironment('bs_id')
export let bs_pass = getEnvironment('bs_pass')
export let bs_handle = getEnvironment('bs_handle')
export const image_width = getEnvironment('image_width')
export const log_path = getEnvironment('log_path')
export const bodyAreaRatio = getEnvironment('bodyAreaRatio')
export const bodyHWRatio = getEnvironment('bodyHWRatio')
export const bodyWindowRatioW = getEnvironment('bodyWindowRatioW')
export const bodyWindowRatioH = getEnvironment('bodyWindowRatioH')
export const time_scale = getEnvironment('time_scale')
export const sqlite_path = getEnvironment('sqlite_path')
export let tursoUrl = getEnvironment('tursoUrl')
export let tursoToken = getEnvironment('tursoToken')
export let extfeedTag = getEnvironment('feedTag')
export const isEnableFeedTag = extfeedTag && extfeedTag.length > 14 && extfeedTag[0] === '#' //  拡張タグは安全のため15文字以上を強制する
export const noImageOut = getEnvironment('noImageOut') === 'true'
export const noAvatarImage = getEnvironment('noAvatar') === 'true'

export const EnvSmitherySchema = Schema.partial(Schema.Struct({
  MT_GOOGLE_MAP_KEY: Schema.String,
  MT_TURSO_URL: Schema.String,
  MT_TURSO_TOKEN: Schema.String,
  MT_BS_ID: Schema.String,
  MT_BS_PASS: Schema.String,
  MT_BS_HANDLE: Schema.String,
  MT_FILTER_TOOLS: Schema.String,
  MT_MOVE_MODE: Schema.String,
  MT_FEED_TAG: Schema.String,
}))

export type EnvSmithery = typeof EnvSmitherySchema.Type

export function setSmitheryEnv(extEnv: EnvSmithery) {
  GoogleMapApi_key = extEnv.MT_GOOGLE_MAP_KEY || GoogleMapApi_key
  tursoUrl = extEnv.MT_TURSO_URL || tursoUrl
  tursoToken = extEnv.MT_TURSO_TOKEN || tursoToken
  bs_id = extEnv.MT_BS_ID || bs_id
  bs_pass = extEnv.MT_BS_PASS || bs_pass
  bs_handle = extEnv.MT_BS_HANDLE || bs_handle
  filter_tools = extEnv.MT_FILTER_TOOLS || filter_tools
  moveMode = extEnv.MT_MOVE_MODE || moveMode
  extfeedTag = extEnv.MT_FEED_TAG || extfeedTag
}


export const EnvSchema = Schema.mutable(Schema.Struct({
  travelerExist: Schema.Boolean, //  まだ動的ツール切り替えはClaude desktopに入っていない。。
  dbMode: DbModeSchema,
  isPractice: Schema.Boolean,
  anyImageAiExist: Schema.Boolean,
  anySnsExist: Schema.Boolean,
  personMode: PersonModeSchema,
  fixedModelPrompt: Schema.Boolean,
  promptChanged: Schema.Boolean,
  noSnsPost: Schema.Boolean,
  moveMode: MoveModeSchema,
  remBgUrl: Schema.optional(Schema.String),
  rembgPath: Schema.optional(Schema.String),
  loggingMode: Schema.Boolean,
  filterTools: Schema.Array(Schema.String),
  progressToken: Schema.Union(Schema.String,Schema.Number,Schema.Undefined),
  mapApis:Schema.Map({key:MapEndpointSchema,value:Schema.String}),
}))

export type Env = typeof EnvSchema.Type
