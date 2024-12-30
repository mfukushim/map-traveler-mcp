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
const logpath = path.join(__pwd,"simpleLog.txt")


const logLevel = Process.env.ServerLog ? (Process.env.ServerLog as string).split(','):[]

export function logSync(message:unknown) {
  if(logLevel.includes('sync')) {
    fs.writeFileSync(logpath,"s:"+(message as any).toString()+"\n",{flag:"a"})
  }
}


export class McpLogService extends Effect.Service<McpLogService>()("traveler/McpLogService", {
  accessors: true,
  effect: Effect.gen(function* () {

    function log(message:unknown) {
      if (process.env.VITEST === 'true') {
        return Effect.log(message)
      } else if(logLevel.includes('info')) {
        fs.writeFileSync(logpath,"I:"+(message as any).toString()+"\n",{flag:"a"})
        return Effect.succeed(true)
        // return McpService.sendLoggingMessage((message as any).toString()).pipe(Effect.provide(McpServiceLive))
      }
      return Effect.succeed(false)
    }
    function logError(message:unknown) {
      if (process.env.VITEST === 'true') {
        return Effect.logError(message)
      } else if(logLevel.includes('error')) {
        fs.writeFileSync(logpath,"E:"+(message as any).toString()+"\n",{flag:"a"})
        return Effect.succeed(true)
        // return McpService.sendLoggingMessage((message as any).toString(),"error").pipe(Effect.provide(McpServiceLive))
      }
      return Effect.succeed(false)
    }
    function logTrace(message:unknown) {
      if (process.env.VITEST === 'true') {
        return Effect.logTrace(message)
      } else if(logLevel.includes('trace')) {
        fs.writeFileSync(logpath,"T:"+(message as any).toString()+"\n",{flag:"a"})
        return Effect.succeed(true)
        // return McpService.sendLoggingMessage((message as any).toString(),"trace").pipe(Effect.provide(McpServiceLive))
      }
      return Effect.succeed(false)
    }




    return {
      // initSystemMode,
      log,
      logError,
      logTrace
    }
  }),
  // dependencies: [DbServiceLive]  //  この様式で書くことでservice内のgen()内の変数が有効になるので、極力こちらで書く。。
}) {
}

export const McpLogServiceLive = McpLogService.Default
