/*! map-traveler-mcp | MIT License | https://github.com/mfukushim/map-traveler-mcp */

import * as Process from "node:process";
import {Schema} from "effect";

export const DbModeSchema = Schema.Literal('memory', 'file', 'api')
export type DbMode = typeof DbModeSchema.Type;
export const PersonModeSchema = Schema.Literal('third', 'second')
export type PersonMode = typeof PersonModeSchema.Type;
export const MoveModeSchema = Schema.Literal('realtime', 'skip')
export type MoveMode = typeof MoveModeSchema.Type;
export const MapEndpointSchema = Schema.Literal('directions', 'places', 'timezone', 'svMeta', 'streetView', 'nearby')
export const MapEndpoint = MapEndpointSchema.literals
export type MapEndpoint = (typeof MapEndpoint)[number];
const ImageMethodSchema = Schema.Literal('sd', 'pixAi', 'comfyUi','gemini')
export type ImageMethod = typeof ImageMethodSchema.Type;
export const ImageMethod = ImageMethodSchema.literals

const RunnerEnv = Schema.partial(Schema.mutable(Schema.Struct({
    GoogleMapApi_key: Schema.String,
    mapApi_url: Schema.String,
    sd_key: Schema.String,
    pixAi_key: Schema.String,
    pixAi_modelId: Schema.String,
    comfy_url: Schema.String,
    no_sns_post: Schema.String,
    moveMode: Schema.String,
    remBgUrl: Schema.String,
    rembg_path: Schema.String,
    rembgPath: Schema.String,
    remBgWoKey: Schema.String,
    filter_tools: Schema.String,
    comfy_params: Schema.String,
    fixed_model_prompt: Schema.String,
    comfy_workflow_i2i: Schema.String,
    comfy_workflow_t2i: Schema.String,
    bs_id: Schema.String,
    bs_pass: Schema.String,
    bs_handle: Schema.String,
    image_width: Schema.String,
    bodyAreaRatio: Schema.String,
    bodyHWRatio: Schema.String,
    bodyWindowRatioW: Schema.String,
    bodyWindowRatioH: Schema.String,
    time_scale: Schema.String,
    sqlite_path: Schema.String,
    tursoUrl: Schema.String,
    tursoToken: Schema.String,
    extfeedTag: Schema.String,
    noImageOut: Schema.String,
    noAvatarImage: Schema.String,
    GeminiImageApi_key: Schema.String,
  }
)))

export type RunnerEnv = typeof RunnerEnv.Type

export const EnvSmitherySchema = Schema.partial(Schema.Struct({
  MT_GOOGLE_MAP_KEY: Schema.String,
  MT_GEMINI_IMAGE_KEY: Schema.String,
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


export const ModeSchema = Schema.mutable(Schema.Struct({
  travelerExist: Schema.Boolean, //  まだ動的ツール切り替えはClaude desktopに入っていない。。
  dbMode: DbModeSchema,
  isPractice: Schema.Boolean,
  // anyImageAiExist: Schema.Boolean,
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
  progressToken: Schema.Union(Schema.String, Schema.Number, Schema.Undefined),
  mapApis: Schema.Map({key: MapEndpointSchema, value: Schema.String}),
}))

export type Mode = typeof ModeSchema.Type

const EnvMap: [string, string][] = [
  ['GoogleMapApi_key', 'MT_GOOGLE_MAP_KEY'],
  ['GeminiImageApi_key', 'MT_GEMINI_IMAGE_KEY'],
  ['mapApi_url', 'MT_MAP_API_URL'],
  ['time_scale', 'MT_TIME_SCALE'],
  ['sqlite_path', 'MT_SQLITE_PATH'],
  ['tursoUrl', 'MT_TURSO_URL'],
  ['tursoToken', 'MT_TURSO_TOKEN'],
  ['rembg_path', 'MT_REMBG_PATH'],
  ['rembgPath', 'MT_REMBG_PATH'],
  ['remBgUrl', 'MT_REMBG_URL'],
  ['remBgWoKey', 'MT_REMBG_WO_KEY'],
  ['pixAi_key', 'MT_PIXAI_KEY'],
  ['sd_key', 'MT_SD_KEY'],
  ['pixAi_modelId', 'MT_PIXAI_MODEL_ID'],
  ['comfy_url', 'MT_COMFY_URL'],
  ['comfy_workflow_t2i', 'MT_COMFY_WORKFLOW_T2I'],
  ['comfy_workflow_i2i', 'MT_COMFY_WORKFLOW_I2I'],
  ['comfy_params', 'MT_COMFY_PARAMS'],
  ['fixed_model_prompt', 'MT_FIXED_MODEL_PROMPT'],
  ['bodyAreaRatio', 'MT_BODY_AREA_RATIO'],
  ['bodyHWRatio', 'MT_BODY_HW_RATIO'],
  ['bodyWindowRatioW', 'MT_BODY_WINDOW_RATIO_W'],
  ['bodyWindowRatioH', 'MT_BODY_WINDOW_RATIO_H'],
  ['bs_id', 'MT_BS_ID'],
  ['bs_pass', 'MT_BS_PASS'],
  ['bs_handle', 'MT_BS_HANDLE'],
  ['filter_tools', 'MT_FILTER_TOOLS'],
  ['moveMode', 'MT_MOVE_MODE'],
  ['image_width', 'MT_IMAGE_WIDTH'],
  ['no_sns_post', 'MT_NO_SNS_POST'],
  ['noImageOut', 'MT_NO_IMAGE'],
  ['noAvatar', 'MT_NO_AVATAR'],
  ['ServerLog', 'MT_SERVER_LOG'],
  ['feedTag', 'MT_FEED_TAG'],
  ['log_path', 'MT_LOG_PATH'],
  ['max_sessions', 'MT_MAX_SESSIONS'],
  ['session_ttl_ms', 'MT_SESSION_TTL_MS'],
  ['unique_ttl_ms', 'MT_SERVICE_TTL_MS'],
]

function getEnvironment(name: string) {
  const map = EnvMap.find(value => value[0] === name);
  return map ? Process.env[map[1]] || Process.env[map[0]] : undefined;
}

export const log_path = getEnvironment('log_path')

export const ServerLog = getEnvironment('ServerLog')

export const max_sessions = getEnvironment('max_sessions')
export const session_ttl_ms = getEnvironment('session_ttl_ms')
export const unique_ttl_ms = getEnvironment('unique_ttl_ms')


export class TravelerEnv {
  get noAvatarImage(): boolean {
    return this._noAvatarImage;
  }

  get noImageOut(): boolean {
    return this._noImageOut;
  }

  get isEnableFeedTag(): boolean {
    return this._isEnableFeedTag;
  }

  get useAiImageGen(): ImageMethod | undefined {
    return this._useAiImageGen;
  }


  get extfeedTag(): string | undefined {
    return this.env.extfeedTag;
  }

  get tursoToken(): string | undefined {
    return this.env.tursoToken;
  }

  get tursoUrl(): string | undefined {
    return this.env.tursoUrl;
  }

  get sqlite_path(): string | undefined {
    return this.env.sqlite_path;
  }

  get time_scale(): string | undefined {
    return this.env.time_scale;
  }

  get bodyWindowRatioH(): string | undefined {
    return this.env.bodyWindowRatioH;
  }

  get bodyWindowRatioW(): string | undefined {
    return this.env.bodyWindowRatioW;
  }

  get bodyHWRatio(): string | undefined {
    return this.env.bodyHWRatio;
  }

  get bodyAreaRatio(): string | undefined {
    return this.env.bodyAreaRatio;
  }

  get image_width(): string | undefined {
    return this.env.image_width;
  }

  get bs_handle(): string | undefined {
    return this.env.bs_handle;
  }

  get bs_pass(): string | undefined {
    return this.env.bs_pass;
  }

  get bs_id(): string | undefined {
    return this.env.bs_id;
  }

  get comfy_workflow_t2i(): string | undefined {
    return this.env.comfy_workflow_t2i;
  }

  get comfy_workflow_i2i(): string | undefined {
    return this.env.comfy_workflow_i2i;
  }

  get fixed_model_prompt(): string | undefined {
    return this.env.fixed_model_prompt;
  }

  get comfy_params(): string | undefined {
    return this.env.comfy_params;
  }

  get filter_tools(): string | undefined {
    return this.env.filter_tools;
  }

  get remBgWoKey(): string | undefined {
    return this.env.remBgWoKey;
  }

  get rembgPath(): string | undefined {
    return this.env.rembgPath;
  }

  get rembg_path(): string | undefined {
    return this.env.rembg_path;
  }

  get remBgUrl(): string | undefined {
    return this.env.remBgUrl;
  }

  get moveMode(): string | undefined {
    return this.env.moveMode;
  }

  get no_sns_post(): string | undefined {
    return this.env.no_sns_post;
  }

  get comfy_url(): string | undefined {
    return this.env.comfy_url;
  }

  get pixAi_modelId(): string | undefined {
    return this.env.pixAi_modelId;
  }

  get pixAi_key(): string | undefined {
    return this.env.pixAi_key;
  }

  get sd_key(): string | undefined {
    return this.env.sd_key;
  }

  get mapApi_url(): string | undefined {
    return this.env.mapApi_url;
  }

  get GoogleMapApi_key(): string | undefined {
    return this.env.GoogleMapApi_key;
  }

  get GeminiImageApi_key(): string | undefined {
    return this.env.GeminiImageApi_key;
  }

  get mode(): Mode {
    return this._mode;
  }

  private env: RunnerEnv = {}

  private _noImageOut: boolean;
  private _noAvatarImage: boolean;
  private _isEnableFeedTag: boolean;
  private _useAiImageGen: ImageMethod | undefined;

  private _mode: Mode = {
    travelerExist: true, //  まだ動的ツール切り替えはClaude desktopに入っていない。。
    dbMode: 'memory' as DbMode,
    isPractice: false,
    // anyImageAiExist: false,
    anySnsExist: false,
    personMode: 'third' as PersonMode,
    fixedModelPrompt: false,
    promptChanged: false,
    noSnsPost: false,
    moveMode: 'realtime' as MoveMode,
    remBgUrl: undefined as string | undefined,
    rembgPath: undefined as string | undefined,
    loggingMode: false,
    filterTools: [] as string[],
    progressToken: undefined as string | number | undefined,
    mapApis: new Map<MapEndpoint, string>(),
  }

  constructor() {
    this.env = {}
    this.env.GoogleMapApi_key = getEnvironment('GoogleMapApi_key')
    this.env.GeminiImageApi_key = getEnvironment('GeminiImageApi_key')

    this.env.mapApi_url = getEnvironment('mapApi_url')
    this.env.sd_key = getEnvironment('sd_key')
    this.env.pixAi_key = getEnvironment('pixAi_key')
    this.env.pixAi_modelId = getEnvironment('pixAi_modelId')
    this.env.comfy_url = getEnvironment('comfy_url')
    this.env.no_sns_post = getEnvironment('no_sns_post')
    this.env.moveMode = getEnvironment('moveMode')
    this.env.remBgUrl = getEnvironment('remBgUrl')
    this.env.rembg_path = getEnvironment('rembg_path')
    this.env.rembgPath = getEnvironment('rembgPath')
    this.env.remBgWoKey = getEnvironment('remBgWoKey')
    this.env.filter_tools = getEnvironment('filter_tools')
    this.env.comfy_params = getEnvironment('comfy_params')
    this.env.fixed_model_prompt = getEnvironment('fixed_model_prompt')
    this.env.comfy_workflow_i2i = getEnvironment('comfy_workflow_i2i')
    this.env.comfy_workflow_t2i = getEnvironment('comfy_workflow_t2i')
    this.env.bs_id = getEnvironment('bs_id')
    this.env.bs_pass = getEnvironment('bs_pass')
    this.env.bs_handle = getEnvironment('bs_handle')
    this.env.image_width = getEnvironment('image_width')
    this.env.bodyAreaRatio = getEnvironment('bodyAreaRatio')
    this.env.bodyHWRatio = getEnvironment('bodyHWRatio')
    this.env.bodyWindowRatioW = getEnvironment('bodyWindowRatioW')
    this.env.bodyWindowRatioH = getEnvironment('bodyWindowRatioH')
    this.env.time_scale = getEnvironment('time_scale')
    this.env.sqlite_path = getEnvironment('sqlite_path')
    this.env.tursoUrl = getEnvironment('tursoUrl')
    this.env.tursoToken = getEnvironment('tursoToken')
    this.env.extfeedTag = getEnvironment('feedTag')

    this._isEnableFeedTag = Boolean(this.env.extfeedTag && this.env.extfeedTag.length > 14 && this.env.extfeedTag[0] === '#') //  拡張タグは安全のため15文字以上を強制する
    this._noImageOut = getEnvironment('noImageOut') === 'true'
    this._noAvatarImage = getEnvironment('noAvatar') === 'true'
    this._useAiImageGen = this.getUseImageMethod()
  }

  private getUseImageMethod() {
    return this.env.GeminiImageApi_key ? 'gemini' : this.env.pixAi_key ? 'pixAi' : this.env.sd_key ? 'sd' : this.env.comfy_url ? 'comfyUi' : undefined;
  }

  setInit(initial:
          RunnerEnv
  ) {
    this.env = initial

    this._noImageOut = initial.noImageOut === 'true'
    this._noAvatarImage = initial.noAvatarImage === 'true'

    this._isEnableFeedTag = Boolean(this.env.extfeedTag && this.env.extfeedTag.length > 14 && this.env.extfeedTag[0] === '#') //  拡張タグは安全のため15文字以上を強制する
    this._useAiImageGen = this.getUseImageMethod()
  }

  setSmitheryEnv(extEnv: EnvSmithery) {
    this.env.GoogleMapApi_key = extEnv.MT_GOOGLE_MAP_KEY || this.env.GoogleMapApi_key
    this.env.GeminiImageApi_key = extEnv.MT_GEMINI_IMAGE_KEY || this.env.GeminiImageApi_key
    this.env.tursoUrl = extEnv.MT_TURSO_URL || this.env.tursoUrl
    this.env.tursoToken = extEnv.MT_TURSO_TOKEN || this.env.tursoToken
    this.env.bs_id = extEnv.MT_BS_ID || this.env.bs_id
    this.env.bs_pass = extEnv.MT_BS_PASS || this.env.bs_pass
    this.env.bs_handle = extEnv.MT_BS_HANDLE || this.env.bs_handle
    this.env.filter_tools = extEnv.MT_FILTER_TOOLS || this.env.filter_tools
    this.env.moveMode = extEnv.MT_MOVE_MODE || this.env.moveMode
    this.env.extfeedTag = extEnv.MT_FEED_TAG || this.env.extfeedTag
    this._useAiImageGen = this.getUseImageMethod()
  }

}
