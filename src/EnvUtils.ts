/*! map-traveler-mcp | MIT License | https://github.com/mfukushim/map-traveler-mcp */

import * as Process from "node:process";
import {Schema} from "effect";
import {
  DbMode,
  DbModeSchema, MapEndpoint,
  MapEndpointSchema,
  MoveMode,
  MoveModeSchema,
  PersonMode,
  PersonModeSchema
} from "./DbService.js";

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



export const ModeSchema = Schema.mutable(Schema.Struct({
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

export type Mode = typeof ModeSchema.Type

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

export const log_path = getEnvironment('log_path')

export const ServerLog = getEnvironment('ServerLog')


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
  get extfeedTag(): string | undefined {
    return this._extfeedTag;
  }
  get tursoToken(): string | undefined {
    return this._tursoToken;
  }
  get tursoUrl(): string | undefined {
    return this._tursoUrl;
  }
  get sqlite_path(): string | undefined {
    return this._sqlite_path;
  }
  get time_scale(): string | undefined {
    return this._time_scale;
  }
  get bodyWindowRatioH(): string | undefined {
    return this._bodyWindowRatioH;
  }
  get bodyWindowRatioW(): string | undefined {
    return this._bodyWindowRatioW;
  }
  get bodyHWRatio(): string | undefined {
    return this._bodyHWRatio;
  }
  get bodyAreaRatio(): string | undefined {
    return this._bodyAreaRatio;
  }
  get image_width(): string | undefined {
    return this._image_width;
  }
  get bs_handle(): string | undefined {
    return this._bs_handle;
  }
  get bs_pass(): string | undefined {
    return this._bs_pass;
  }
  get bs_id(): string | undefined {
    return this._bs_id;
  }
  get comfy_workflow_t2i(): string | undefined {
    return this._comfy_workflow_t2i;
  }
  get comfy_workflow_i2i(): string | undefined {
    return this._comfy_workflow_i2i;
  }
  get fixed_model_prompt(): string | undefined {
    return this._fixed_model_prompt;
  }
  get comfy_params(): string | undefined {
    return this._comfy_params;
  }
  get filter_tools(): string | undefined {
    return this._filter_tools;
  }
  get remBgWoKey(): string | undefined {
    return this._remBgWoKey;
  }
  get rembgPath(): string | undefined {
    return this._rembgPath;
  }
  get rembg_path(): string | undefined {
    return this._rembg_path;
  }
  get remBgUrl(): string | undefined {
    return this._remBgUrl;
  }
  get moveMode(): string | undefined {
    return this._moveMode;
  }
  get no_sns_post(): string | undefined {
    return this._no_sns_post;
  }
  get comfy_url(): string | undefined {
    return this._comfy_url;
  }
  get pixAi_modelId(): string | undefined {
    return this._pixAi_modelId;
  }
  get pixAi_key(): string | undefined {
    return this._pixAi_key;
  }
  get sd_key(): string | undefined {
    return this._sd_key;
  }
  get mapApi_url(): string | undefined {
    return this._mapApi_url;
  }
  get GoogleMapApi_key(): string | undefined {
    return this._GoogleMapApi_key;
  }

  get mode(): Mode {
    return this._mode;
  }

  private _GoogleMapApi_key:string | undefined
  private readonly _mapApi_url:string | undefined
  private readonly _sd_key:string | undefined
  private readonly _pixAi_key:string | undefined
  private readonly _pixAi_modelId:string | undefined
  private readonly _comfy_url:string | undefined
  private readonly _no_sns_post:string | undefined
  private _moveMode:string | undefined
  private readonly _remBgUrl:string | undefined
  private readonly _rembg_path:string | undefined
  private readonly _rembgPath:string | undefined
  private readonly _remBgWoKey:string | undefined
  private _filter_tools:string | undefined
  private readonly _comfy_params:string | undefined
  private readonly _fixed_model_prompt:string | undefined
  private readonly _comfy_workflow_i2i:string | undefined
  private readonly _comfy_workflow_t2i:string | undefined
  private _bs_id:string | undefined
  private _bs_pass:string | undefined
  private _bs_handle:string | undefined
  private readonly _image_width:string | undefined
  private readonly _bodyAreaRatio:string | undefined
  private readonly _bodyHWRatio:string | undefined
  private readonly _bodyWindowRatioW:string | undefined
  private readonly _bodyWindowRatioH:string | undefined
  private readonly _time_scale:string | undefined
  private readonly _sqlite_path:string | undefined
  private _tursoUrl:string | undefined
  private _tursoToken:string | undefined
  private _extfeedTag:string | undefined
  private readonly _isEnableFeedTag:boolean;
  private readonly _noImageOut:boolean;
  private readonly _noAvatarImage:boolean;

  private _mode:Mode = {
    travelerExist: true, //  まだ動的ツール切り替えはClaude desktopに入っていない。。
    dbMode: 'memory' as DbMode,
    isPractice: false,
    anyImageAiExist: false,
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
    this._GoogleMapApi_key = getEnvironment('GoogleMapApi_key')
    this._mapApi_url = getEnvironment('mapApi_url')
    this._sd_key = getEnvironment('sd_key')
    this._pixAi_key = getEnvironment('pixAi_key')
    this._pixAi_modelId = getEnvironment('pixAi_modelId')
    this._comfy_url = getEnvironment('comfy_url')
    this._no_sns_post = getEnvironment('no_sns_post')
    this._moveMode = getEnvironment('moveMode')
    this._remBgUrl = getEnvironment('remBgUrl')
    this._rembg_path = getEnvironment('rembg_path')
    this._rembgPath = getEnvironment('rembgPath')
    this._remBgWoKey = getEnvironment('remBgWoKey')
    this._filter_tools = getEnvironment('filter_tools')
    this._comfy_params = getEnvironment('comfy_params')
    this._fixed_model_prompt = getEnvironment('fixed_model_prompt')
    this._comfy_workflow_i2i = getEnvironment('comfy_workflow_i2i')
    this._comfy_workflow_t2i = getEnvironment('comfy_workflow_t2i')
    this._bs_id = getEnvironment('bs_id')
    this._bs_pass = getEnvironment('bs_pass')
    this._bs_handle = getEnvironment('bs_handle')
    this._image_width = getEnvironment('image_width')
    this._bodyAreaRatio = getEnvironment('bodyAreaRatio')
    this._bodyHWRatio = getEnvironment('bodyHWRatio')
    this._bodyWindowRatioW = getEnvironment('bodyWindowRatioW')
    this._bodyWindowRatioH = getEnvironment('bodyWindowRatioH')
    this._time_scale = getEnvironment('time_scale')
    this._sqlite_path = getEnvironment('sqlite_path')
    this._tursoUrl = getEnvironment('tursoUrl')
    this._tursoToken = getEnvironment('tursoToken')
    this._extfeedTag = getEnvironment('feedTag')
    this._isEnableFeedTag = Boolean(this._extfeedTag && this._extfeedTag.length > 14 && this._extfeedTag[0] === '#') //  拡張タグは安全のため15文字以上を強制する
    this._noImageOut = getEnvironment('noImageOut') === 'true'
    this._noAvatarImage = getEnvironment('noAvatar') === 'true'
  }

  setSmitheryEnv(extEnv: EnvSmithery) {
    this._GoogleMapApi_key = extEnv.MT_GOOGLE_MAP_KEY || this._GoogleMapApi_key
    this._tursoUrl = extEnv.MT_TURSO_URL || this._tursoUrl
    this._tursoToken = extEnv.MT_TURSO_TOKEN || this._tursoToken
    this._bs_id = extEnv.MT_BS_ID || this._bs_id
    this._bs_pass = extEnv.MT_BS_PASS || this._bs_pass
    this._bs_handle = extEnv.MT_BS_HANDLE || this._bs_handle
    this._filter_tools = extEnv.MT_FILTER_TOOLS || this._filter_tools
    this._moveMode = extEnv.MT_MOVE_MODE || this._moveMode
    this._extfeedTag = extEnv.MT_FEED_TAG || this._extfeedTag
  }

}
