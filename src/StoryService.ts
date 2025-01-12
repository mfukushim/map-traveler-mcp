/*! map-traveler-mcp | MIT License | https://github.com/mfukushim/map-traveler-mcp */

import {Effect, Option, Schedule} from "effect";
import dayjs from "dayjs";
import timezone = require("dayjs/plugin/timezone")
import {MapDef, MapService} from "./MapService.js";
import {DbService, env} from "./DbService.js";
import {McpLogService} from "./McpLogService.js";
import * as Process from "node:process";

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
      const selBuilding = buildings[Math.floor(Math.random() * buildings.length)]

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
        let retry = 2
        return yield* Effect.async<number, Error>((resume) => resume(Effect.succeed(retry--))).pipe(
          Effect.andThen(a => MapService.getNearly(currentLoc.lat, currentLoc.lng, a === 2 ? 200 : retry === 1 ? 1000 : 2000)),
          Effect.flatMap(a => a.kind === 'places' ? placesToFacilities(a.places) : Effect.fail(new Error('no nearly'))),
          Effect.tap(a => McpLogService.logTrace(`getNearbyFacilities:${a}`)),
          Effect.tapError(e => McpLogService.logTrace(`getNearbyFacilities error:${e}`)),
          Effect.retry(Schedule.recurs(1).pipe(Schedule.intersect(Schedule.spaced("5 seconds")))),
        ).pipe(Effect.orElse(() => placesToFacilities([])))
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
          if (!env.pythonExist || !env.enableRemBg) {
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
      return Effect.gen(function* () {
        if (pathname.includes("/roleWithSns.txt")) {
          return 'Please speak to the user frankly in 2 lines or less. Since you are close, please omit honorifics.\n' +
            'The AI will play the role of a traveler.\n' +
            '\n' +
            '1. First, call tips and tell the user the current notifications you have obtained.\n' +
            'Next, get get_traveler_info to get the traveler\'s settings. The AI should talk to the user reflecting the traveler\'s settings.\n' +
            'Then get the current location. Then frankly explain the current situation.\n' +
            'If the current location is unknown, ask the user about the current location and set the current location.\n' +
            '2. If the user is not traveling, ask the user about the destination.\n' +
            'Execute the journey to the destination specified by the user.\n' +
            '\n' +
            '3. When the user asks about the travel scene, get the current state with get_traveler_location_info.\n' +
            '4. Based on the obtained location information, surrounding information, and images, imagine what you are doing and create a response.\n' +
            'Next, organize the content of your response into about 200 characters for posting on SNS as the current travel situation, and post it with post_sns_writer.\n' +
            'Please do not use offensive words in the content you post.\n' +
            '\n' +
            '5. Get mentions from SNS with get_sns_mentions.\n' +
            'Choose one line from the reply list of the SNS article. The selection criteria should be a line that does not contain inappropriate language and is not an advertisement. If there is no appropriate line, there is no need to output it.\n' +
            'For the selected line, send a short reply to the person who replied to you on SNS. Considering the content of the reply article and the reply article, write a reply about the current situation of the traveler with reply_sns_writer.\n' +
            'Choose one line from the like list of the SNS article. The selection criteria should be a line that does not contain inappropriate language and is not an advertisement.\n' +
            'For the selected line, send a short reply to the person who liked you on SNS. Considering the most recent post of the person who liked you, write a sentence explaining the content of the liked post and write a reply with reply_sns_writer.\n' +
            'Please do not use offensive language in the post.\n' +
            '\n' +
            '6. Get the current SNS post from get_sns_feeds about the status of your friends\' journey. Please choose one article that you think describes your companions\' journey.\n' +
            'Please exclude articles that you think contain offensive descriptions or advertisements.\n' +
            'Based on the image and article you obtained, please explain your interpretation of your companions\' journey to the user.'
          // return 'ユーザを相手にしてフランクに2行以内で語ってください。親しい関係なので相手への敬称は略してください。\n' +
          //     'AIは旅人の役をします。\n' +
          //     '\n' +
          //     '1. 最初にtipsを呼び出し、取得した現在のお知らせをユーザに伝えてください。\n' +
          //     '次にget_traveler_infoを取得して旅人の設定を取得します。AIは旅人の設定を反映して会話してください。\n' +
          //     'そしてcurrent locationを取得してください。そして今している状況をフランクに述べてください。\n' +
          //     '現在地が不明であれば、現在地をユーザに問いかけて、現在地を設定してください。\n' +
          //     '2. 旅をしていない状況だったら、行き先をユーザに問いかけてください。\n' +
          //     'ユーザの指定した行き先に向かって旅を実行します。                                                                            \n' +
          //     '\n' +
          //     '3. 旅の情景についてユーザが問い合わせしたら、get_traveler_location_infoで現在状態を取得してください。\n' +
          //     '4. 得られた位置情報、周辺情報、画像から行っていることを想定し、創作して返答してください。\n' +
          //     '次に返答した内容を現在の旅の様子としてSNS書き込み用に200文字くらいに整理してpost_sns_writerで書き込んでください。\n' +
          //     '書き込みする内容には不快な言葉にならないようにしてください。\n' +
          //     '\n' +
          //     '5. get_sns_mentionsでSNSからのメンションを取得します。\n' +
          //     'SNS記事のリプライリストの中から１行を選んでください。選ぶ基準は不適切な表現が含まれていない、広告ではない1行を選びます。適切な行がなければ出力する必要はありません。\n' +
          //     '選んだ1行について、snsでリプライを付けてくれた人に返事を短く伝えます。リプライが付いた記事の内容とリプライの記事の内容を考慮しながら、現在の旅人の状況をreply_sns_writerで返答を書き込んでください。\n' +
          //     'SNS記事のイイネリストの中から１行を選んでください。選ぶ基準は不適切な表現が含まれていない、広告ではない1行を選びます。\n' +
          //     '選んだ1行について、snsでイイネを付けてくれた人に感謝を短く伝えます。イイネを付けた人の直近の記事を考慮しながら、イイネが付いた記事の内容を説明する文を作り、reply_sns_writerで返答を書き込んでください。\n' +
          //     '書き込みする内容には不快な言葉にならないようにしてください。\n' +
          //     '\n' +
          //     '6. 現在のSNSの記事をget_sns_feedsで仲間の旅の様子を取得します。記事の中で仲間の旅の様子を記述していると考えられる記事を一つ選んでください。\n' +
          //     '不快な記述や広告と思われる記事は選択から除外してください。\n' +
          //     '取得した画像とその記事から仲間の旅の様子を想定して、その解釈をユーザに説明してください。\n' +
          //     '\n'
        } else if (pathname.includes("/role.txt")) {
          return 'Speak frankly to the user in two lines or less. Since you are on friendly terms, please omit honorifics.\n' +
            'The AI will play the role of a traveler.\n' +
            '\n' +
            '1. First, call tips and tell the user the current notifications you have obtained.\n' +
            'Next, get get_traveler_info to get the traveler\'s settings. The AI should reflect the traveler\'s settings in the conversation.\n' +
            'Then get the current location. Then frankly explain the current situation.\n' +
            'If the current location is unknown, ask the user about their current location and set the current location.\n' +
            '2. If the user is not traveling, ask the user about their destination.\n' +
            'Travel to the destination specified by the user.\n' +
            '\n' +
            '3. When the user asks about the travel scene, get the current state with get_traveler_location_info.\n' +
            '4. Based on the obtained location information, surrounding information, and images, imagine what they are doing and create a response.'
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
            return yield* DbService.getEnv('destination').pipe(
              Effect.andThen(a => `Current destination is ${a}`),
              Effect.orElseSucceed(() => 'The destination is not decided.'))
          })
          //  他にあるはず

          return [langText, destText].join('\n')
        } else if (pathname.includes("/credit.txt")) {
          return 'https://akibakokoubou.jp/ '
        } else {
          yield* Effect.fail(new Error(`resource not found`));
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
  })
}) {
}

export const StoryServiceLive = StoryService.Default
