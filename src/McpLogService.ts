import {Effect} from "effect";
import 'dotenv/config'
import * as fs from "node:fs";
import {fileURLToPath} from "url";
import {dirname} from "path";
import * as path from "node:path"
import * as Process from "node:process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const __pwd = __dirname.endsWith('src') ? path.join(__dirname,'..'):path.join(__dirname,'../..')
const logPath = path.join(__pwd,"simpleLog.txt")


const logLevel = Process.env.ServerLog ? (Process.env.ServerLog as string).split(','):[]

export function logSync(message:unknown) {
  if(logLevel.includes('sync')) {
    fs.writeFileSync(logPath,"s:"+(message as any).toString()+"\n",{flag:"a"})
  }
}


export class McpLogService extends Effect.Service<McpLogService>()("traveler/McpLogService", {
  accessors: true,
  effect: Effect.gen(function* () {

    function log(message:unknown) {
      if (process.env.VITEST === 'true') {
        return Effect.log(message)
      } else if(logLevel.includes('info')) {
        fs.writeFileSync(logPath,"I:"+(message as any).toString()+"\n",{flag:"a"})
        return Effect.succeed(true)
      }
      return Effect.succeed(false)
    }
    function logError(message:unknown) {
      if (process.env.VITEST === 'true') {
        return Effect.logError(message)
      } else if(logLevel.includes('error')) {
        fs.writeFileSync(logPath,"E:"+(message as any).toString()+"\n",{flag:"a"})
        return Effect.succeed(true)
      }
      return Effect.succeed(false)
    }
    function logTrace(message:unknown) {
      if (process.env.VITEST === 'true') {
        return Effect.logTrace(message)
      } else if(logLevel.includes('trace')) {
        fs.writeFileSync(logPath,"T:"+(message as any).toString()+"\n",{flag:"a"})
        return Effect.succeed(true)
      }
      return Effect.succeed(false)
    }

    return {
      log,
      logError,
      logTrace
    }
  }),
}) {
}

export const McpLogServiceLive = McpLogService.Default
