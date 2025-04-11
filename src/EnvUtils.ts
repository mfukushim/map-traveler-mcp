/*! map-traveler-mcp | MIT License | https://github.com/mfukushim/map-traveler-mcp */

import * as Process from "node:process";

const EnvMap: [string, string][] = [
  ['GoogleMapApi_key', 'MT_GOOGLE_MAP_KEY'],
  ['mapApi_url', 'MT_MAP_API_URL'],
  ['time_scale', 'MT_TIME_SCALE'],
  ['sqlite_path', 'MT_SQLITE_PATH'],
  ['rembg_path','MT_REMBG_PATH'],
  ['rembgPath','MT_REMBG_PATH'],
  ['remBgUrl','MT_REMBG_URL'],
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
  ['ServerLog','MT_SERVER_LOG'],
  ['feedTag','MT_FEED_TAG'],
  ['log_path','MT_LOG_PATH'],
]

function getEnvironment(name: string) {
  const map = EnvMap.find(value => value[0] === name);
  return map ? Process.env[map[1]] || Process.env[map[0]] : undefined;
}

export const GoogleMapApi_key = getEnvironment('GoogleMapApi_key')
export const mapApi_url = getEnvironment('mapApi_url')
export const sd_key = getEnvironment('sd_key')
export const pixAi_key = getEnvironment('pixAi_key')
export const pixAi_modelId = getEnvironment('pixAi_modelId')
export const comfy_url = getEnvironment('comfy_url')
export const no_sns_post = getEnvironment('no_sns_post')
export const ServerLog = getEnvironment('ServerLog')
export const moveMode = getEnvironment('moveMode')
export const remBgUrl = getEnvironment('remBgUrl')
export const rembg_path = getEnvironment('rembg_path')
export const rembgPath = getEnvironment('rembgPath')
export const filter_tools = getEnvironment('filter_tools')
export const comfy_params = getEnvironment('comfy_params')
export const fixed_model_prompt = getEnvironment('fixed_model_prompt')
export const comfy_workflow_i2i = getEnvironment('comfy_workflow_i2i')
export const comfy_workflow_t2i = getEnvironment('comfy_workflow_t2i')
export const bs_id = getEnvironment('bs_id')
export const bs_pass = getEnvironment('bs_pass')
export const bs_handle = getEnvironment('bs_handle')
export const image_width = getEnvironment('image_width')
export const log_path = getEnvironment('log_path')
export const bodyAreaRatio = getEnvironment('bodyAreaRatio')
export const bodyHWRatio = getEnvironment('bodyHWRatio')
export const bodyWindowRatioW = getEnvironment('bodyWindowRatioW')
export const bodyWindowRatioH = getEnvironment('bodyWindowRatioH')
export const time_scale = getEnvironment('time_scale')
export const sqlite_path = getEnvironment('sqlite_path')
export const extfeedTag = getEnvironment('feedTag')
export const isEnableFeedTag = extfeedTag && extfeedTag.length > 4 && extfeedTag[0] === '#'
export const noImageOut = getEnvironment('noImageOut') === 'true'
