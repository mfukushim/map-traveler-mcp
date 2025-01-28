/*! map-traveler-mcp | MIT License | https://github.com/mfukushim/map-traveler-mcp */

import {Effect, Option, Schedule} from "effect";
import dayjs from "dayjs";
import timezone = require("dayjs/plugin/timezone")
import {MapDef, MapService} from "./MapService.js";
import {__pwd, DbService, env} from "./DbService.js";
import {McpLogService} from "./McpLogService.js";
import * as Process from "node:process";
import * as path from "node:path";
import * as fs from "node:fs";

dayjs.extend(timezone)

export interface FacilityInfo {
  townName: Option.Option<string>,
  address: Option.Option<string>,
  country: Option.Option<string>,
  facilities: { id: string | undefined; types: string[]; name: string; }[],
  photoReferences: {
    name: string;
    types: readonly string[], //  result.typesまでないケースがある? とりあえず名前をそのまま突っ込むしかないか。。。
    photoReference: {
      photoRef: string;
      author: string;
    }[]
  }[],
}

export class StoryService extends Effect.Service<StoryService>()("traveler/StoryService", {
  accessors: true,
  effect: Effect.gen(function* () {
    /**
     * Nearlyから公的都市名類を抽出する
     * Nearlyから都市名(自分のイメージでは、日本の場合 市のレベル)は取り出しにくくなっている感じ。
     * 方針としては 新Nearの places[n].addressComponents[n].types[n] が sublocality_level_2 のものが直感に合う
     * 取れないときは locality で
     * 互換性を外す 最初の1施設の townNameとcountryコード (JPで返る)を直で返す
     * 一応互換構造だが、複数の sublocality_level_2 と locality が戻る形になる
     * @param places
     * @param id
     */
    const getNearlyPoliticalParse = (places: typeof MapDef.GmPlacesSchema.Type, id: string | undefined) => {
      const n = (places).filter(value => value.id === id).flatMap(d => {
        if (Option.isSome(d.addressComponents)) {
          const addressComponents = d.addressComponents.value
          const country = addressComponents.find(f => f.types[0] === 'country')
          const townName =
            addressComponents.find(f => f.types[0] === 'sublocality_level_2') ||
            addressComponents.find(f => f.types[0] === 'locality')
          return [
            {
              address: Option.fromNullable(d.formattedAddress),
              country: Option.fromNullable(country?.shortText),
              townName: Option.fromNullable(townName?.longText)
            }
          ]
        }
        return []
      }).shift()
      return n ? n : {country: Option.none(), townName: Option.none(), address: Option.none()}
    }
    /**
     * Nearlyから名称と種別、住所を抽出する
     * @param places
     */
    const getNearlyParse = (places: typeof MapDef.GmPlacesSchema.Type): {
      types: string[];
      name: string;
      id: string | undefined
    }[] => {
      //  photos がないものがある
      return places.filter(value => Option.isSome(value.photos)).map(d => {
        return {
          name: d.displayName.text,
          types: Option.isSome(d.primaryType) ? [d.primaryType.value] : [],  //  とりあえず互換性を保つために1個のリストにしている
          id: d.id
        }
      })
    }
    /**
     * photo_referenceを取得
     * getNearlyの戻りjsonから抽出
     * author nameをきちんと出す方向で拡張するか。。。 SNSでは (Powered xx+Photo by xx) かな。でもgoogle 自身もサムネイルでは出してないし、MiMiでは出さざるを得ないけどSNSは略するかな。。。仕組みは作っておく
     */
    const getPhotoReferences = (places: typeof MapDef.GmPlacesSchema.Type, id: string | undefined) => {
      return (places).filter(value => value.id === id).map(result => {
        const filter = Option.getOrElse(result.photos, () => []).map(a => {
          return {
            photoRef: a.name || '',
            author: a?.authorAttributions ? a?.authorAttributions[0]?.displayName || '' : ''
          }
        })
        const t = Option.getOrElse(result.primaryType, () => '')
        return {
          name: result.displayName.text as string,
          types: t ? [t] : Option.isSome(result.types) ? result.types.value : [result.displayName.text], //  result.typesまでないケースがある? とりあえず名前をそのまま突っ込むしかないか。。。
          photoReference: filter
        }
      })
    }

    function placesToFacilities(a: typeof MapDef.GmPlacesSchema.Type) {
      const buildings = getNearlyParse(a)
      if (buildings.length === 0) {
        return Effect.succeed({
          townName: Option.none(),
          address: Option.none(),
          country: Option.none(),
          facilities: [],
          photoReferences: [],
        })
      }
      const selBuilding = buildings[Math.floor(Math.random() * buildings.length)];

      const political = getNearlyPoliticalParse(a, selBuilding.id)
      const photoReferences = getPhotoReferences(a, selBuilding.id)
      const maxLocationNum = 4  //  コスト改善のため、最大4地点までにする 多数の場合、ランダムピックでもよいが、そこまでの精度は必要ない
      const outBuildings = buildings.slice(0, maxLocationNum)
      const buildingProperties = outBuildings.flatMap(value => value.types)
      buildingProperties.push('|')  //  表に出現する | も含まれてはいけないことにする
      return Effect.succeed({
        townName: political.townName,
        address: political.address,
        country: political.country,
        facilities: outBuildings,
        photoReferences: photoReferences,
      })
    }

    /**
     * 停泊ログテキスト生成
     * @param currentLoc
     * @private
     */
    function getNearbyFacilities(currentLoc: {
      lng: number;
      bearing: number;
      lat: number
    }) {
      return Effect.gen(function* () {
        //  最初半径1000以内を探索する。該当件数が2以下なら2000で再検索する
        //  →最初は直近200以内で探索しランドスケープの選択精度を上げる、その後1000,2000へ
        let retry = 3
        return yield* Effect.async<number, Error>((resume) => resume(Effect.succeed(--retry))).pipe(
          Effect.tap(a => McpLogService.logTrace(`getNearbyFacilities retry:`,a)),
          Effect.andThen(a => MapService.getNearly(currentLoc.lat, currentLoc.lng, a === 2 ? 200 : a === 1 ? 1000 : 3000)),
          Effect.andThen(a => a.kind === 'places' ? placesToFacilities(a.places) : Effect.fail(new Error('no nearly'))),
          Effect.tap(a => McpLogService.logTrace(`getNearbyFacilities:`,a)),
          Effect.tapError(e => McpLogService.logTrace(`getNearbyFacilities error:${e}`)),
          Effect.retry(Schedule.recurs(2).pipe(Schedule.intersect(Schedule.spaced("3 seconds")))),
          Effect.orElse(() => placesToFacilities([]))
        )
      })
    }

    //  region info
    /**
     * 現在のステータスからユーザに何か指南する情報を与える
     * または汎用のtipsを示す
     * 初回: ありがとうございます 必須の設定は以下です。それぞれ従量がかかることがあります。 GM API,segmind,pixAi,sd, 任意 X/Twitter,Bluesky
     * db未設定: dbを設定してよいですか? 自分で位置を設定することもできます。
     * プロンプト未指定: プロンプトが指定可能。フェイク画像になることを避けるためanime,manga指定は必須
     * useLandmark: 画像取得先にGMのユーザ画像も含めます。
     * ランダム: 旅の過程は現在地の設定、行き先の設定、旅の開始
     * ランダム: 一定時間後に現在の報告を聞くとさらに先の画像が出ます
     */
    const tips = () => {
      //  informationの文
      //  1. practiceモードであればそれを示す 解除にはGoogle map api keyが必要であることを示す
      //  2. dbパスを設定するとアプリを終了しても現在地と行き先が記録されることを示す
      //  2. 画像AIのkeyがなければ 画像API keyがあればアバターの姿を任意に作れることを示す
      //  3. pythonがインストールされていなければ pythonをインストールするとアバターの姿を合成できる
      //
      //  以下はランダムで表示
      //  - 画像AIのkeyがあってかつpromptを変更したことがなければ変更可能を案内する
      //  - snsアカウントがあればpostが出来ることを案内する
      //  - bsアカウントがあれば相互対話が出来ることを案内する
      //  - 二人称モードに切り替えると二人称会話で操作できる(ただし可能な限り)
      //  - リソースに詳細があるのでリソースを取り込むと話やすい。プロジェクトを起こしてある程度会話を調整できる
      const textList: string[] = []
      const imagePathList: string[] = []
      if (env.isPractice) {
        textList.push('Currently in practice mode. You can only go to fixed locations.' +
          ' To switch to normal mode, you need to obtain and set a Google Map API key.' +
          ' key for detail: https://developers.google.com/maps/documentation/streetview/get-api-key ' +
          ' Need Credentials: [Street View Static API],[Places API (New)],[Time Zone API],[Directions API]' +
          ' Please specify the API key in the configuration file(claude_desktop_config.json).' +
          ' And restart app. Claude Desktop App. Claude App may shrink into the taskbar, so please quit it completely.\n' +
          `claude_desktop_config.json\n
\`\`\`
"env":{"GoogleMapApi_key":"xxxxxxx"}
\`\`\`
`
        )
      } else {
        if (!env.dbFileExist) {
          textList.push('Since the database is not currently set, the configuration information will be lost when you exit.' +
            ' Please specify the path of the saved database file in the configuration file(claude_desktop_config.json).' +
            `claude_desktop_config.json\n
\`\`\`
"env":{"sqlite_path":"%USERPROFILE%/Desktop/traveler.sqlite"}
\`\`\`
`
          )
        } else {
          if (!env.anyImageAiExist) {
            textList.push('If you want to synthesize an avatar image, you will need a key for the image generation AI.' +
              ' Currently, PixAi and Stability AI\'s SDXL 1.0 API are supported.' +
              ' Please refer to the website of each company to obtain an API key.' +
              ' https://platform.stability.ai/docs/getting-started https://platform.stability.ai/account/keys ' +
              ' https://pixai.art/ https://platform.pixai.art/docs/getting-started/00---quickstart/ ' +
              ' Please specify the API key in the configuration file(claude_desktop_config.json).' +
              `claude_desktop_config.json\n
\`\`\`
"env":{"pixAi_key":"xyzxyz"}
or
"env":{"sd_key":"xyzxyz"}
\`\`\`
`
            )
          }
          if (!env.enableRemBg) {
            textList.push('In order to synthesize avatar images, your PC must be running Python and install rembg.' +
              ` Please install Python and rembg on your PC using information from the Internet.\n
\`\`\`
"env":{"rembg_path":"(absolute path to rembg cli)"}
\`\`\`\n
To keep your pc environment clean, I recommend using a Python virtual environment such as venv.
`)
          }
          //  基本動作状態
          const bsEnable = Process.env.bs_id && Process.env.bs_pass && Process.env.bs_handle
          if (!bsEnable) {
            textList.push('Optional: Set up a Bluesky SNS account\n' +
              'By setting your registered address, password, and handle for Bluesky SNS, you can post travel information on the SNS and obtain and interact with other people\'s travel information.\n' +
              'Since articles may be posted automatically, we strongly recommend using a dedicated account.\n' +
              `claude_desktop_config.json\n
\`\`\`
"env":{
"bs_id":"xxxx",
"bs_pass":"yyyyy",
"bs_handle":"zzzz"
}
\`\`\`
`
            )
          }
          if (!env.promptChanged && !env.fixedModelPrompt) {
            textList.push('You can change the appearance of your avatar by directly telling the AI what you want it to look like, or by specifying a prompt to show its appearance with set_avatar_prompt.')
          }
          textList.push('You can play a tiny role play game using the scenario in carBattle.txt. Have fun!')
        }
      }

      return Effect.succeed(
        {
          textList,
          imagePathList
        }
      )
    }

    function getSettingResource(pathname: string) {
      //  様式は /credit.txt
      return Effect.gen(function *() {
        yield *McpLogService.logTrace(`getSettingResource:`,pathname)
        const files = yield *Effect.tryPromise(() => fs.promises.readdir(path.join(__pwd, `assets/scenario`)))
        if(files.some(value => pathname === `/${value}`)) {
          return yield *Effect.async<string, Error>((resume) => {
            fs.readFile(path.join(__pwd, `assets/scenario${pathname}`), {encoding: "utf8"}, (err, data) => {
              if (err) resume(Effect.fail(err))
              else resume(Effect.succeed(data));
            });
          })
        } else if (pathname.includes("/setting.txt")) {
          //  TODO ここはなおす
          //  言語
          const langText = yield* DbService.getEnv('language').pipe(
            Effect.andThen(a => `Please speak to me in ${a}`),
            Effect.orElseSucceed(() => 'The language of the conversation should be the language the user speaks.'))
          //  目的地
          const destText = yield* Effect.gen(function* () {
            const runStatus = yield* DbService.getRecentRunStatus()
            if (runStatus.status !== 'stop' && runStatus.destination) {
              return `Current destination is ${runStatus.destination}`
            }
            //  他にあるはず
            return yield* DbService.getEnv('destination').pipe(
              Effect.andThen(a => `Current destination is ${a}`),
              Effect.orElseSucceed(() => 'The destination is not decided.'))
          })
          return [langText, destText].join('\n')
        } else if (pathname.includes("/credit.txt")) {
          const packageJsonPath = path.resolve(__pwd, 'package.json');
          return yield *Effect.async<string, Error>((resume) => {
            fs.readFile(packageJsonPath, {encoding: "utf8"}, (err, data) => {
              if (err) resume(Effect.fail(err))
              else resume(Effect.succeed(data));
            });
          }).pipe(Effect.andThen(a => `map-traveler.mcp version:${JSON.parse(a).version} https://akibakokoubou.jp/ `))
        } else {
          return yield *Effect.fail(new Error(`resource not found`));
        }
      })
    }

    // endregion

    return {
      tips,
      placesToFacilities,
      getNearbyFacilities,
      getSettingResource
    }
  }),
}) {
}

export const StoryServiceLive = StoryService.Default
