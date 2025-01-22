/*! map-traveler-mcp | MIT License | https://github.com/mfukushim/map-traveler-mcp */

import {Effect, Layer} from "effect";
import 'dotenv/config'
import * as fs from "node:fs";
import {fileURLToPath} from "url";
import {dirname} from "path";
import * as path from "node:path"
import * as Process from "node:process";
import {NodeFileSystem} from "@effect/platform-node";
import dayjs from "dayjs";
import {ToolContentResponse} from "./McpService.js";

const inGitHubAction = process.env.GITHUB_ACTIONS === 'true';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const __pwd = __dirname.endsWith('src') ? path.join(__dirname,'..'):path.join(__dirname,'../..')
const logPath = path.join(__pwd,"mapTravelerLog.log")

const logLevel = Process.env.ServerLog ? (Process.env.ServerLog as string).split(','):[]

export function logSync(message:unknown) {
  if(process.env.VITEST !== 'true' && logLevel.includes('sync')) {
    fs.writeFileSync(logPath,`${dayjs().toISOString()}:s:`+(message as any).toString()+"\n",{flag:"a"})
  }
}

logSync(`pwd:${__pwd}`)
logSync(`ServerLog:${Process.env.ServerLog}`)


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
    function logTrace(message:unknown) {
      if (process.env.VITEST === 'true') {
        return Effect.logTrace(message)
      } else if(logLevel.includes('trace')) {
        fs.writeFileSync(logPath,`${dayjs().toISOString()}:T:`+(message as any).toString()+"\n",{flag:"a"})
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

export const McpLogServiceLive = Layer.merge(McpLogService.Default,NodeFileSystem.layer) ;
