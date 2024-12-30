#!/usr/bin/env node

// import {Server} from "@modelcontextprotocol/sdk/server/index.js";
// import {StdioServerTransport} from "@modelcontextprotocol/sdk/server/stdio.js";
// import {
//   CallToolRequestSchema,
//   GetPromptRequestSchema,
//   ListPromptsRequestSchema,
//   ListResourcesRequestSchema,
//   ListToolsRequestSchema,
//   ReadResourceRequestSchema,
// } from "@modelcontextprotocol/sdk/types.js";
import {Effect} from "effect";
// import {MapService, MapServiceLive} from "./MapService.js";
// import {ImageServiceLive} from "./ImageService.js";
// import {DbService, DbServiceLive} from "./DbService.js";
// import {StoryService, StoryServiceLive} from "./StoryService.js";
// import {RunnerService, RunnerServiceLive} from "./RunnerService.js";
// import {FetchHttpClient} from "@effect/platform";
// import {NodeFileSystem} from "@effect/platform-node";
// import * as fs from "node:fs";
import {McpService, McpServiceLive} from "./McpService.js";
import {DbServiceLive} from "./DbService.js";
import {McpLogServiceLive} from "./McpLogService.js";


export class AnswerError extends Error {
  readonly _tag = "AnswerError"
  
  constructor(message: string) {
    super(message);
    this.name = "AnswerError";
    Object.setPrototypeOf(this, AnswerError.prototype);
  }
}

/*
const server = new Server(
  {
    name: "geo-less-traveler",
    version: "0.1.0",
  },
  {
    capabilities: {
      resources: {},
      tools: {},
      prompts: {},
    },
  }
);

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: "file:///role.txt",
        mimeType: "text/plain",
        name: "role.txt",
        description: "The purpose and role of AI"
      }, {
        uri: "file:///credit.txt",
        mimeType: "text/plain",
        name: "credit.txt",
        description: "credit of this component"
      }
    ]
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  // console.error(request)
  //  TODO リソース処理がうまくいってない
  //  TODO リソースアップデートイベント
  const url = new URL(request.params.uri);
  // const id = url.pathname.replace(/^\//, '');
  // const note = notes[id];
  //
  // if (!note) {
  //   throw new Error(`Note ${id} not found`);
  // }
  // console.error(url.pathname)
  if (url.pathname.includes("file:///role.txt")) {
    return {
      contents: [{
        uri: request.params.uri,
        mimeType: "text/plain",
        text: 'AIはユーザに対してtravelerの役割をします。\ntravelerはMCP APIを使って、1. 今いる場所の情報、2. 今いる場所の風景画像を取得することができます。travelerはMCP APIを使って、1. 旅の開始地を設定する 2. 旅の目的地を設定する 3. 旅を開始する 4. 旅を停止する ことを実行することができます。\n' +
          'ユーザはtravelerに対して 1. 現在の場所の情報を問い合わせる 2. 今いる場所の風景の画像を問い合わせる 3. その場所に関する旅の様子の相談を雑談する ことができます。\n' +
          'ユーザが現在の場所の情報を問い合わせたとき、次の内容で返答してください。\n' +
          '1. get_current_pictureを使って'
      }]
    };
  } else if (url.pathname.includes("file:///credit.txt")) {
    return {
      contents: [{
        uri: request.params.uri,
        mimeType: "text/plain",
        text: 'https://akibakokoubou.jp/ contain Google Map Apis,'
      }]
    };

  } else {
    throw new Error(`resource not found`);
  }


  // const url = new URL(request.params.uri);
  // const id = url.pathname.replace(/^\//, '');
  // const note = notes[id];
  //
  // if (!note) {
  //   throw new Error(`Note ${id} not found`);
  // }
  //
  // return {
  //   contents: [{
  //     uri: request.params.uri,
  //     mimeType: "text/plain",
  //     text: note.content
  //   }]
  // };
});

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "tips",  //  pythonがあったらよいとか、db設定がよいとか、tipsを取得する。tipsの取得を行うのはproject側スクリプトとか、script batchとか
        description: "tips about traveler",
        inputSchema: {
          type: "object",
          properties: {}
        }
      },
      {
        name: "set_language",  //  環境情報はリソースに反映する できれば更新イベントを出す
        description: "set a traveler's language.For example, English ,Japanese, etc.",
        inputSchema: {
          type: "object",
          properties: {
            settings: {
              type: "string",
              description: "traveler's language setting."
            },
          }
        }
      },
      {
        name: "set_traveler_info",  //  環境情報はリソースに反映する できれば更新イベントを出す
        description: "set a traveler's setting.For example, traveler's name, the language traveler speak, etc.",
        inputSchema: {
          type: "object",
          properties: {
            settings: {
              type: "string",
              description: "traveler's setting. traveler's name, the language traveler speak, etc."
            },
          }
        }
      },
      {
        name: "get_current_location_info",
        description: "get a address of current traveler's location and information on nearby facilities,view snapshot",
        inputSchema: {
          type: "object",
          properties: {
            includePhoto: {
              type: "boolean",
              description: "Get scenery photos of current location"
            },
            includeNearbyFacilities: {
              type: "boolean",
              description: "Get information on nearby facilities"
            },
            // includePhotoDetail: {  現状claudeが自分で解析しているっぽいのでまだいらないかな
            //   type: "boolean",
            //   description: "Get a description of a landscape photo"
            // }
          }
        }
      },
      {
        name: "set_current_location",
        description: "Set the traveler's current address",
        inputSchema: {
          type: "object",
          properties: {
            address: {
              type: "string",
              description: "address set to traveler"
            }
          },
          required: ["location"]
        }
      },
      {
        name: "get_destination_address",
        description: "get a address of destination location",
        inputSchema: {
          type: "object",
          properties: {}
        }
      },
      {
        name: "set_destination_address",
        description: "set a address of destination",
        inputSchema: {
          type: "object",
          properties: {
            address: {
              type: "string",
              description: "address of destination"
            }
          },
          required: ["address"]
        }
      },
      {
        name: "start_journey",
        description: "Start the journey to destination",  //  スタートと合わせてスタートシーン画像を取得して添付する
        inputSchema: {
          type: "object",
          properties: {},
        }
      },
      {
        name: "stop_journey",
        description: "Stop the journey",  //  停泊と合わせて停止シーン画像を取得して添付する
        inputSchema: {
          type: "object",
          properties: {},
        }
      }

    ]
  };
});

export async function getCurrentLocationInfo(includePhoto: boolean, includeNearbyFacilities: boolean,localDebug = false) {
  return await Effect.runPromise(RunnerService.getCurrentView(includePhoto,includeNearbyFacilities,localDebug).pipe(
      Effect.provide([MapServiceLive, DbServiceLive, StoryServiceLive, RunnerServiceLive, FetchHttpClient.layer, ImageServiceLive, NodeFileSystem.layer]),
    )).catch(e => {
    if (e instanceof Error) {
      throw new Error(e.message);
    }
    throw e
  })
}

export async function setCurrentLocation(location?: string) {
  // const content = String(request.params.arguments?.content);
  if (!location) {
    throw new Error("Location address is required");
  }
  const res = await Effect.runPromise(Effect.gen(function* () {
      const address = yield* MapService.getMapLocation(location)
      if (Option.isNone(address)) {
        return yield* Effect.fail(new Error("I don't know where you're talking about. location not found"))
      }
      const timeZoneId = yield* MapService.getTimezoneByLatLng(address.value.lat, address.value.lng)
      yield* Effect.logTrace(address.value)
      yield* DbService.saveRunStatus({
        id: 1,  // 1レコードにする
        start: '',
        status: 'stop',
        from: '',
        to: address.value.address,
        destination: null,
        startLat: 0,
        startLng: 0,
        endLat: address.value.lat,  //  最後のrunStatusが現在位置
        endLng: address.value.lng,
        durationSec: 0,
        distanceM: 0,
        avatarId: 1,
        tripId: 0,
        epoch: 0,
        tilEndEpoch: 0, //  旅開始していない
        duration: '',
        startTime: new Date(0),  //  旅開始していない
        startCountry: address.value.country,
        endCountry: address.value.country,
        startTz: timeZoneId,
        endTz: timeZoneId,
        currentPathNo: -1,
        currentStepNo: -1,
      })
      return address.value
    }).pipe(Effect.provide([MapServiceLive, DbServiceLive]))
  ).catch(e => {
    throw new Error(`location set fail: reason(${e})`)
  })
  return {
    content: [{
      type: "text",
      text: `location set succeed\naddress:${res.address}\nlatitude:${res.lat}\nlongitude:${res.lng}\n`
    }]
  };
}

export async function tips() {
  const res = await Effect.runPromiseExit(StoryService.info().pipe(
    Effect.andThen(a => ({content: [{type: "text", text: a}]})),
    Effect.provide(StoryServiceLive)
  ))
  if (res._tag === "Failure") {
    throw new Error(res.cause.toString())
  }
  return res.value
}

export async function setLanguage(env: string) {
  return await Effect.runPromise(DbService.saveEnv('language', env).pipe(
      Effect.andThen(a => ({content: [{type: "text", text: `Language set as follows: ${a.value}`}]})),
      Effect.provide(DbServiceLive)
  )).catch(e => {
    if (e instanceof Error) {
      throw new Error(e.message);
    }
    if (e instanceof String) {
      throw new Error(e.toString());
    }
    throw e;
  })
}
export async function setTravelerInfo(env: string) {
  return await Effect.runPromise(DbService.saveEnv('aiEnv', env).pipe(
      Effect.andThen(a => ({content: [{type: "text", text: `The traveller information is as follows: ${a.value}`}]})),
      Effect.provide(DbServiceLive)
  )).catch(e => {
    if (e instanceof Error) {
      throw new Error(e.message);
    }
    if (e instanceof String) {
      throw new Error(e.toString());
    }
    throw e;
  })
}

export async function startJourney() {
  return await Effect.runPromise(RunnerService.startJourney().pipe(
    Effect.andThen(a => ({content: [{type: "text", text: a.text}, {type: "image", image: a.image.toString("base64")}]})),
      Effect.provide([MapServiceLive, DbServiceLive, StoryServiceLive, RunnerServiceLive, FetchHttpClient.layer, ImageServiceLive, NodeFileSystem.layer]),
  )).catch(e => {
    if (e instanceof Error) {
      throw new Error(e.message);
    }
    if (e instanceof String) {
      throw new Error(e.toString());
    }
    throw e;
  })
}

export async function stopJourney() {
  return await Effect.runPromise(RunnerService.stopJourney().pipe(
    Effect.andThen(a => a),
    Effect.provide([MapServiceLive, DbServiceLive, StoryServiceLive, RunnerServiceLive, FetchHttpClient.layer, ImageServiceLive, NodeFileSystem.layer]),
  )).catch(e => {
    if (e instanceof Error) {
      throw new Error(e.message);
    }
    if (e instanceof String) {
      throw new Error(e.toString());
    }
    throw e;
  })
}

export async function getDestinationAddress() {
  return await Effect.runPromise(RunnerService.getDestinationAddress().pipe(
      Effect.andThen(a => ({content: [{type: "text", text: a}]})),
      Effect.provide([MapServiceLive, DbServiceLive, StoryServiceLive, RunnerServiceLive, FetchHttpClient.layer, ImageServiceLive, NodeFileSystem.layer]),
  )).catch(e => {
    console.log(e)
    if (e instanceof Error) {
      throw new Error(e.message);
    }
    if (e instanceof String) {
      throw new Error(e.toString());
    }
    throw new Error(JSON.stringify(e));
  })
}

export async function setDestinationAddress(address: string) {
  return await Effect.runPromise(RunnerService.setDestinationAddress(address).pipe(
    Effect.andThen(a => ({content:[{type:"text",text:a}]})),
    Effect.provide([MapServiceLive, DbServiceLive, StoryServiceLive, RunnerServiceLive, FetchHttpClient.layer, ImageServiceLive, NodeFileSystem.layer]),
  )).catch(e => {
    if (e instanceof Error) {
      throw new Error(e.message);
    }
    throw e
  })
}

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  switch (request.params.name) {
    case "tips":
      return await tips();
    case "set_language":
      return await setLanguage(String(request.params.arguments?.settings));
    case "set_traveler_info":
      return await setTravelerInfo(String(request.params.arguments?.settings));
    case "get_current_location_info": {
      return await getCurrentLocationInfo(
        request.params.arguments?.includePhoto as boolean,
        request.params.arguments?.includeNearbyFacilities as boolean,
      );
    }
    case "set_current_location": {
      return await setCurrentLocation(String(request.params.arguments?.address));
    }
    case "get_destination_address": {
      return await getDestinationAddress();
    }
    case "set_destination_address": {
      return await setDestinationAddress(String(request.params.arguments?.address));
    }
    case "start_journey": {
      return await startJourney();
    }
    case "stop_journey": {
      return await stopJourney();
    }
    default:
      throw new Error("Unknown tool");
  }
});

server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return {
    prompts: [
      {
        name: "describe_current_view",
        description: "Describe the current view",
      }
    ]
  };
});

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  if (request.params.name !== "describe_current_view") {
    throw new Error("Unknown prompt");
  }

  //  TODO
  //  景色情報
  // const view = {
  //   test:"test"
  // }

  return {
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: "Please summarize the following notes:"
        }
      },
      {
        role: "user" as const,
        content: {
          type: "text",
          text: ""
          //  TODO
        }
      },
      // ...embeddedNotes.map(note => ()),
      {
        role: "user",
        content: {
          type: "text",
          text: "Provide a concise summary of all the notes above."
        }
      }
    ]
  };
});
*/

async function main() {
  await Effect.runPromise(Effect.gen(function *() {
    yield *McpService.run().pipe(Effect.provide([McpServiceLive,DbServiceLive,McpLogServiceLive]))
  }))
    // McpService.run().pipe(
    // Effect.provide([McpServiceLive,DbServiceLive,McpLogServiceLive])))
  // await McpService.run().pipe(
  //       Effect.provide([McpServiceLive,DbServiceLive,McpLogServiceLive]),
  //       Effect.runPromise)
/*
  await Effect.tryPromise(() => {
    const transport = new StdioServerTransport();
    return server.connect(transport);
  }).pipe(Effect.provide([MapServiceLive]),
    Effect.runPromise
  ).catch(reason => {
    console.error(reason);
    throw new Error(reason);
  })
*/
  // const transport = new StdioServerTransport();
  // await server.connect(transport);
}

main().catch((error) => {
  // console.error("Server error:", error);
  // fs.writeFileSync('D:\\proj\\mimi2\\packages\\ai-traveler-mcp\\log.txt', JSON.stringify(error));
  //if (process.env.VITEST === 'true') {
    console.error("Server error:", error);
  //}
  // process.exit(1);
});
