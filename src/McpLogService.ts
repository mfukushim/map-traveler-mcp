/*! map-traveler-mcp | MIT License | https://github.com/mfukushim/map-traveler-mcp */

import {Effect} from "effect";
import 'dotenv/config'
import * as fs from "node:fs";
import {fileURLToPath} from "url";
import {dirname} from "path";
import * as path from "node:path"
import dayjs from "dayjs";
import {ToolContentResponse} from "./McpService.js";
import {log_path, ServerLog} from "./EnvUtils.js";


const inGitHubAction = process.env.GITHUB_ACTIONS === 'true';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const __pwd = __dirname.endsWith('src') ? path.join(__dirname,'..'):path.join(__dirname,'../..')
const logPath = log_path || path.join(__pwd,"mapTravelerLog.log")

const logLevel = ServerLog ? (ServerLog as string).split(','):[]

export function logSync(...message:any[]) {
  if(process.env.VITEST !== 'true' && logLevel.includes('sync')) {
    fs.writeFileSync(logPath,`${dayjs().toISOString()}:s:`+message.map(value => {
      if (typeof value === "object" && value !== null) {
        return JSON.stringify(value).slice(0,200)
      }
      return value;
    }).join(',')+"\n",{flag:"a"})
  }
}

logSync(`pwd:${__pwd}`)
logSync(`ServerLog:${ServerLog}`)


export class McpLogService extends Effect.Service<McpLogService>()("traveler/McpLogService", {
  accessors: true,
  effect: Effect.gen(function* () {

    function log(message:unknown) {
      if (process.env.VITEST === 'true') {
        return Effect.log(message)
      } else if(logLevel.includes('info')) {
        fs.writeFileSync(logPath,`${dayjs().toISOString()}:I:`+(message as any).toString()+"\n",{flag:"a"})
        return Effect.succeed(true)
      }
      return Effect.succeed(false)
    }
    function logError(message:unknown) {
      if (process.env.VITEST === 'true') {
        return Effect.logError(message)
      } else if(logLevel.includes('error')) {
        fs.writeFileSync(logPath,`${dayjs().toISOString()}:E:`+(message as any).toString()+"\n",{flag:"a"})
        return Effect.succeed(true)
      }
      return Effect.succeed(false)
    }
    function logTrace(...message:any[]) {
      if (process.env.VITEST === 'true') {
        return Effect.logTrace(message)
      } else if(logLevel.includes('trace')) {
        fs.writeFileSync(logPath,`${dayjs().toISOString()}:T:`+message.map(value => {
          if (typeof value === "object" && value !== null) {
            return JSON.stringify(value).slice(0,200)
          }
          return value;
        }).join(',')+"\n",{flag:"a"})
        return Effect.succeed(true)
      }
      return Effect.succeed(false)
    }

    function logTraceToolsRes(res:ToolContentResponse[]) {
      return Effect.forEach(res,(a, i) => {
        if(a.type === 'text') {
          return log(`${i}:${a.text}`)
        } else if(a.type === 'image') {
          if (inGitHubAction) {
            return log(`${i}:${a.data?.slice(0, 5)}`)
          } else {
            fs.writeFileSync(`tools/test/temp${i}.png`, Buffer.from(a.data!, "base64"));
            return log(`${i}:${a.data?.slice(0, 5)}`)
          }
        }
        return Effect.succeed(true)
      })
    }

    return {
      log,
      logError,
      logTrace,
      logTraceToolsRes
    }
  }),
}) {
}

export const McpLogServiceLive = McpLogService.Default
