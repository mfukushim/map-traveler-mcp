# 旅botミニ MCP版
### 仮想 旅アバター環境パッケージ 

[![Verified on MseeP](https://mseep.ai/badge.svg)](https://mseep.ai/app/073d88cc-277d-40b6-8c20-bcabf6c275e9)
[![smithery badge](https://smithery.ai/badge/@mfukushim/map-traveler-mcp)](https://smithery.ai/server/@mfukushim/map-traveler-mcp)

Japanese / [English](./README.md)

Google map上を仮想的に旅するアバターの環境を作るMCP serverです。

Claude DesktopなどのMCP clientから、アバターに指示をして、移動する旅の様子と写真を報告することができます。

<img alt="img.png" src="https://raw.githubusercontent.com/mfukushim/map-traveler-mcp/for_image/tools/img.png" width="400"/>

> 旅画像生成にgemini-2.5-flash-image-preview (nano-banana) を追加しました  

nano-bananaに対応しました。nano-bananaのセマンティック マスクによりremBgの設定なしに短時間で旅の合成画像が生成できるようになりました。

> Streamable-HTTP/stdio 両対応しました(Smithery.ai仕様のconfigインタフェースに準拠)  

今まで通りstdio型MCPとしても使えますし、Streamable-HTTP としても使えます。  
マルチユーザ対応ですが、dbのAPIはSmithery.ai仕様のconfigインタフェースにてセッション毎指定になります。  
Streamable-HTTP/stdio 両対応なので従来のMCPクライアントでもそのままで動く想定ですが、
従来のstdio版を使用する場合は v0.0.x (v0.0.81) をお使いください。  
``` npx -y @mfukushim/map-traveler-mcp@0.0.81 ```

> librechat https://www.librechat.ai/ に対応しました。

> Smithery https://smithery.ai/server/@mfukushim/map-traveler-mcp に対応しました(画像は重いため除外しています)。

> MseeP から安全性評価をもらいました https://mseep.ai/app/mfukushim-map-traveler-mcp


## 機能

#### MCP server tools function

以下の機能がMCP serverとして使用できます。設定や実行状態によって使用可能な機能は異なります。
関数名を直接指定してもよいですがClaude LLMが自動で認識するので一般語で操作を指定できます。

例:
「いまどこにいますか?」「東京駅へ出発しましょう」

- get_traveler_view_info(includePhoto:boolean,includeNearbyFacilities:boolean)  
現在の旅アバターのいる場所についての情報を取得します。  
  includePhoto: 付近のGoogle Street Viewの写真を取得します。画像生成AIを設定していればアバターを合成します。
  includeNearbyFacilities: 付近の施設情報を取得します。
- get_traveler_location()  
  現在の旅アバターのいる住所と付近の施設についての情報を取得します。
- reach_a_percentage_of_destination(timeElapsedPercentage:number)
  現在の目的地までの指定の割合の位置に到達する (moveMode=skip のときのみ)
  timeElapsedPercentage: 目的地までの進捗割合(0～100)
- set_traveler_location(address: string)  
現在の旅アバターのいる場所を設定します。  
  address: 住所情報(正確な住所、またはGoogle MapやClaudeが認識できる一般的な呼称など)
- get_traveler_destination_address  
設定している旅アバターの目的地を取得します
- set_traveler_destination_address(address: string)  
旅アバターの目的地を設定します  
  address: 住所情報(正確な住所、またはGoogle MapやClaudeが認識できる一般的な呼称など)
- start_traveler_journey  
目的地に旅を開始します。(moveMode=realtime のときのみ)
- stop_traveler_journey  
旅を中止します。(moveMode=realtime のときのみ)
- set_traveler_info(settings:string)  
旅人の属性を設定します。名前や性格など動的に変更したい旅人の性格付けを設定します。ただしroleスクリプトを使う場合はスクリプトのほうが安定に反映できます。
  settings: 名前や性格付けなどの設定情報。
- get_traveler_info  
旅人の属性を取得します。旅人の性格付けを取得します。
- set_avatar_prompt(prompt:string)  
旅アバターの画像生成時のプロンプトを設定します。デフォルトはアニメ風女性です。フェイク画像抑制の目的でアニメ風を強制しています。
- reset_avatar_prompt  
  アバターの生成プロンプトをデフォルトにリセットする
- post_sns_writer(message:string)  
設定したハンドルでBluesky snsへ記事をポストします。旅botが生成したポストと判定できるように特定のタグを設定します。
- get_sns_feeds  
指定のカスタムフィード(特定タグを含むフィード)のBluesky sns記事を取得します。
- get_sns_mentions
自身がポストしたBluesky snsへの最近のメンション(イイネ、リプライ)を取得します。
- tips  
  まだ未設定の機能について設定方法をガイドします。
- get_setting  
  環境設定値と画像設定値を取得する

#### MCP resources

5つのカスタムプロンプトのサンプルを持ちます。  
Claude Desktopでプロンプトを取り込むと、Claudeが旅人の立場の役をします。  
SNS対応版では旅会話をしながらSNSの入出力を制御します。

- role.txt  
  Claudeが旅人の立場の役をします。
- roleWithSns.txt  
  Claudeが旅人の立場の役をします。合わせてSNSへの読み取りとポストを制御します。
- carBattle.txt  
  横浜から東京に向かって秘密文書を運ぶストーリーの小さなノベルゲームです。シーンは自動で生成します。遊ぶためにはmoveMode=skipを設定します。
- japanMapChallenge.txt,japanMapChallenge2.txt  
  SNSを介して2つのAI同士で会話して風景画像を使ったチャレンジゲームをします。  
  遊ぶためには2つのBlueskyアカウントと2つのClaude Desktopが必要です。またmoveMode=skipを設定します。(ただしやや動作は不安定です)  
  japanMapChallenge2はチャレンジの反射ルールを付けたものです。

## 設定

複数のGoogle mapのアクセスや画像生成など複数のAPIのアクセスキーを取得して設定する必要があります。
APIの使用には課金がかかることがあります。

#### Claude Desktopで使用する場合の設定  

claude_desktop_config.json (stdio型)
```json
{
  "mcpServers": {
    "traveler": {
      "command": "npx",
      "args": ["-y", "@mfukushim/map-traveler-mcp"],
      "env": {
        "MT_GOOGLE_MAP_KEY":"(Google Map APIのキー)",
        "MT_GEMINI_IMAGE_KEY": "(GeminiImageApi_keyのキー)",
        "MT_MAX_RETRY_GEMINI": "(Gemini画像生成時のリトライ回数 デフォルト0回)",
        "MT_MAP_API_URL": "(オプション: Map APIカスタムエンドポイント 例 direction=https://xxxx,search=https://yyyy )",
        "MT_TIME_SCALE": "(オプション:道路での移動時間の尺度. default 4)",
        "MT_SQLITE_PATH":"(db保存ファイルのパス 例 %USERPROFILE%/Desktop/traveler.sqlite など)",
        "MT_TURSO_URL":"(Turso sqlite APIのURL)",
        "MT_TURSO_TOKEN":"(Turso sqlite APIのアクセストークン)",
        "MT_REMBG_PATH": "(インストールしたrembg cliの絶対パス)",
        "MT_REMBG_URL": "(rembg APIのURL)",
        "MT_REMBG_WO_KEY": "(withoutbg.com rembg API キー)",
        "MT_PIXAI_KEY":"(pixAi APIのキー)",
        "MT_SD_KEY":"(またはStability.aiのAPIのキー",
        "MT_PIXAI_MODEL_ID": "(オプション: pixAiの場合の使用ModelId. 未設定の場合とりあえず 1648918127446573124 を使う",
        "MT_COMFY_URL": "(オプション: 指定urlのComfyUI APIで画像生成する 例 http://192.168.1.100:8188)",
        "MT_COMFY_WORKFLOW_T2I": "(オプション: ComfyUIでtext to imageするときのAPIワークフローファイルのパス 未指定の場合 assets/comfy/t2i_sample.json)",
        "MT_COMFY_WORKFLOW_I2I": "(オプション: ComfyUIでimage to imageするときのAPIワークフローファイルのパス 未指定の場合 assets/comfy/i2i_sample.json)",
        "MT_COMFY_PARAMS": "(オプション: comfyUI APIでワークフローに送る変数値)",
        "MT_FIXED_MODEL_PROMPT": "(オプション: 固定でアバターの姿指定プロンプトを設定する。会話でアバター姿を変更できなくなる。)",
        "MT_BODY_AREA_RATIO": "(オプション: 許容されるアバター面積比. default 0.042)",
        "MT_BODY_HW_RATIO": "(オプション: 許容されるアバター縦横比. default 1.5~2.3)",
        "MT_BODY_WINDOW_RATIO_W": "(オプション: アバター合成ウィンドウ横比率. default 0.5)",
        "MT_BODY_WINDOW_RATIO_H": "(オプション: アバター合成ウィンドウ縦比率. default 0.75)",
        "MT_BS_ID":"(bluesky snsの登録アドレス)",
        "MT_BS_PASS":"(bluesky snsのパスワード)",
        "MT_BS_HANDLE":"(bluesky snsのハンドル名 例 xxxxx.bsky.social など)",
        "MT_FILTER_TOOLS": "(オプション:使うツールを直に絞る 指定しなければ使えるすべて 例 tips,set_traveler_location)",
        "MT_MOVE_MODE": "(オプション:移動モードをrealtimeかskipにするか指定する default realtime)",
        "MT_IMAGE_WIDTH": "(オプション: 出力する画像の幅(pixel) デフォルトでは512)",
        "MT_NO_IMAGE": "(オプション: true=画像を出力しない 未指定=画像出力可能なら画像を出力する デフォルトでは未指定)",
        "MT_NO_AVATAR": "(オプション: true=アバター合成をせずStreetView画像そのままを出力する 未指定=アバター画像を合成する デフォルトでは未指定)",
        "MT_FEED_TAG": "(オプション: SNSポスト時のフィードタグを指定する(#必須15文字以上) デフォルトでは#geo_less_traveler)",
        "MT_MAX_SESSIONS": "(Streamable-http時の最大セッション数)",
        "MT_SESSION_TTL_MS": "(Streamable-http時のセッション維持時間)",
        "MT_SERVICE_TTL_MS": "(Streamable-http時のサービス維持時間)"
      }
    }
  }
}
```
claude_desktop_config.json (streamable-http型)
上記のMT_環境変数はmap-traveler-mcpのwebサービスを行うサーバーの環境変数に設定してください。
```json
{
  "mcpServers": {
    "traveler": {
      "type": "streamable-http",
      "url": "https://(mcpサーバー)/mcp?config=(base64設定json)"
    }
  }
}
```
base64設定json (Smithery独自拡張)  
以下の形式のjsonを1行の文字列に連結してbase64変換したものを(base64設定json)に設定することで、ユーザのセッション毎に別のAPIや設定を上書きできます。  
dbは個別設定しないとサービス全体で共有されます(旅人のいる場所はdbで共有され1人分になる)  
セッション毎に個別UserIdを持たせる運用については、MCPの認証の仕組みがもう少しクリアになってから再検討する予定です。  
```json
{
  "MT_GOOGLE_MAP_KEY": "xxxyyyzzz",
  "MT_GEMINI_IMAGE_KEY": "xxyyzz",
  "MT_MAX_RETRY_GEMINI": "1",
  "MT_TURSO_URL": "libsql://xxxyyyzzz",
  "MT_TURSO_TOKEN": "abcdabcd",
  "MT_BS_ID": "xyxyxyxyx",
  "MT_BS_PASS": "1234xyz",
  "MT_BS_HANDLE": "aabbccdd",
  "MT_FILTER_TOOLS": "tips,set_traveler_location",
  "MT_MOVE_MODE": "direct",
  "MT_FEED_TAG": "#abcdefgabcdefgabcdefg"
}
```
(jsonの個々の値はすべて省略可能)  
↓ (jsonをテキスト連結)
```text
{"MT_GOOGLE_MAP_KEY": "xxxyyyzzz", "MT_GEMINI_IMAGE_KEY": "xxyyzz", "MT_MAX_RETRY_GEMINI": "1", "MT_TURSO_URL": "libsql://xxxyyyzzz", "MT_TURSO_TOKEN": "abcdabcd", "MT_BS_ID": "xyxyxyxyx", "MT_BS_PASS": "1234xyz", "MT_BS_HANDLE": "aabbccdd", "MT_FILTER_TOOLS": "tips,set_traveler_location", "MT_MOVE_MODE": "direct", "MT_FEED_TAG": "#abcdefgabcdefgabcdefg"}
```
↓ (base64化したものをconfig=に設定する)  
```text
eyJNVF9HT09HTEVfTUFQX0tFWSI6ICJ4eHh5eXl6enoiLCAiTVRfR0VNSU5JX0lNQUdFX0tFWSI6ICJ4eHl5enoiLCAiTVRfTUFYX1JFVFJZX0dFTUlOSSI6ICIxIiwgIk1UX1RVUlNPX1VSTCI6ICJsaWJzcWw6Ly94eHh5eXl6enoiLCAiTVRfVFVSU09fVE9LRU4iOiAiYWJjZGFiY2QiLCAiTVRfQlNfSUQiOiAieHl4eXh5eHl4IiwgIk1UX0JTX1BBU1MiOiAiMTIzNHh5eiIsICJNVF9CU19IQU5ETEUiOiAiYWFiYmNjZGQiLCAiTVRfRklMVEVSX1RPT0xTIjogInRpcHMsc2V0X3RyYXZlbGVyX2xvY2F0aW9uIiwgIk1UX01PVkVfTU9ERSI6ICJkaXJlY3QiLCAiTVRfRkVFRF9UQUciOiAiI2FiY2RlZmdhYmNkZWZnYWJjZGVmZyJ9
```

> 注意:環境変数の名称を一般的なスネークケースに変更しました。librechatなどで他の環境変数と合わせて使う場合があるため、接頭語としてMT_を付けています。従来の名称も後方互換性のために使うことができます。  

Google Map APIは以下の4つの権限を設定してください。  
- Street View Static API
- Places API (New)
- Time Zone API
- Directions API

   https://developers.google.com/maps/documentation/streetview/get-api-key

画像生成AIを使う場合は、 pixAi_keyまたはsd_keyのいずれかを設定します。またPCにpython3.7~3.11がインストールされrembg cliをインストールしている必要があります(仮想環境推奨)。 

   https://platform.pixai.art/docs  
   https://platform.stability.ai/docs/api-reference#tag/SDXL-1.0-and-SD1.6/operation/textToImage

bluesky SNSのアドレス/パスワードの設定は任意です。自動ポストするので専用のアカウントを取ることを推奨します。  

   https://bsky.app/

#### 練習モードの設定  

確認用にAPIキーを必要としない練習モードで実行することもできます。

claude_desktop_config.json
```json
{
  "mcpServers": {
    "traveler": {
      "command": "npx",
      "args": ["-y", "@mfukushim/map-traveler-mcp"]
    }
  }
}
```

## 使い方

#### 練習モードまで

1. nodejs 22をインストールします。
2. Claude Desktopを使える状況にします。
3. claude_desktop_config.jsonに上記のいずれかの設定を反映します。
4. Claude Desktopを再起動します。設定に少し時間がかかるかもしれません(エラーが出る場合は。再度Claude Desktopを再起動してみてください。上手くいかない場合は下記、注意を参照ください。)。以下のマークが画面右下に出ることを確認します。  
   <img alt="img_1.png" src="https://raw.githubusercontent.com/mfukushim/map-traveler-mcp/for_image/tools/img_1.png" width="150"/>
5. 「いまどこにいますか」「旅に出かけてください」と問いかけてください。会話が始まります。API使用時には確認画面が出るのでAllowを選んでください。
   <img alt="img_4.png" src="https://raw.githubusercontent.com/mfukushim/map-traveler-mcp/for_image/tools/img_4.png" width="200"/>
6. Attach from MCPを選択し、role.txtを選択してください。
   <img alt="img_2.png" src="https://raw.githubusercontent.com/mfukushim/map-traveler-mcp/for_image/tools/img_2.png" width="200"/>
   <img alt="img_3.png" src="https://raw.githubusercontent.com/mfukushim/map-traveler-mcp/for_image/tools/img_3.png" width="200"/>
7. 旅用のプロンプトが組み込まれたので自由に会話してみてください。

#### 本格的に使う

1. GoogleMapAPIのアクセスキーを取得して、Street View Static API,Places API (New),Time Zone API,Directions APIの権限を設定してください。これをclaude_desktop_config.jsonのenvに設定して再起動します。  
ここまでで旅行動ログが現実のマップに即します。旅画像も合成されない状態なら出力します。
2. ディスクの邪魔にならないパスをきめて、claude_desktop_config.jsonのenvのsqlite_pathに設定します。(例: %USERPROFILE%/Desktop/traveler.sqlite $HOME/Documents/traveler.sqlite など)  
ここまでで旅行動が保存され、Claude Desktopを終了させても旅を継続できます。
3. python3.7～3.11をインストールし、rembgをcli付きでインストールします。venv等の仮想環境を使うことをお勧めします。
   ```bash
   python3 -m venv venv
   . venv/bin/activate または .\venv\Scripts\activate
   pip install "rembg[cpu,cli]" 
   ```
   正常にrembg cliが動作するかサンプルの画像ファイルを使って確認してください。人が写っている画像を入力し、出力ファイルで人が切り出されていればokです。
   ```bash
   rembg i 入力ファイル名 出力ファイル名
   ```
4. rembg cliがpythonのexeロケーションにインストールされますのでそのパスを取得してください。ファイル位置はOSやpythonのインストール状態によりまちまちですが、venvの場合は設定したディレクトリの上の (仮想環境名)\Scripts\rembg.exe や  
(仮想環境名)/bin/rembg などです。見つからなければファイル検索ソフトなどでパスを探してください。そのパスをclaude_desktop_config.jsonのenvのrembg_pathに設定します。 (例: "rembg_path": "C:\\Users\\xxxx\\Documents\\rembg_venv\\venv\\Scripts\\rembg.exe")
5. pixAIまたはStability.aiのサイトで画像生成APIのキーを取得します。キーをclaude_desktop_config.jsonのenvのpixAi_keyまたはsd_keyに設定します。
   ここまでで旅画像にアバターが合成されます。
6. bluesky SNSのアドレス/パスワードを取得し、ハンドル名も取得します。claude_desktop_config.jsonのenvのbs_id,bs_pass,bs_handle にそれぞれ設定します。
旅用知識プロンプト roleWithSns.txt を取り込むことで旅アクションをSNSに報告します(botとして自動ポストしますので専用にアカウントを割り当てることをお勧めします)

rembgをcliで準備する代わりに、rembgをサービスAPIとして処理出来る設定を追加しました。  
以下のrembg service を設定すれば remBgUrl にURLを設定することで、rembgを使うことが出来ます。

https://github.com/danielgatis/rembg?tab=readme-ov-file#rembg-s  

Docker版を使ってコンテナを立ち上げてそれをアクセスすれば設定はシンプルになります。  

https://github.com/danielgatis/rembg?tab=readme-ov-file#usage-as-a-docker  

#### 設定dbにＴurso libSQL APIを使う

remote実行のために、設定の保存を Turso libSQL クラウドsqliteでも行えるようにしました。
ローカルにsqliteファイルを置かずにクラウドAPIのＴurso libsql( https://turso.tech/libsql )を使う場合は、Ｔursoにサインアップしsqlite dbを割り当ててください
(有償 無料枠あり)  
dbの設定(マイグレーション)は本アドインが自動で行います。

MT_TURSO_URL = dbのURL  
MT_TURSO_TOKEN = dbのアクセストークン  

#### rembgにクラウドAPIを使う

rembg周りのローカル設定はどの方法を使っても複雑ですが、有償のクラウドrembg ( https://withoutbg.com/ )の設定を追加しました。  
> 注意: 有償で無料枠もわずかにありますが、業務用APIで結構高いので注意してください (1画像 20円くらい)   

MT_REMBG_WO_KEY = withoutbg のアクセストークン


#### 外付けのComfyUIを使用する場合(詳しい人向け)

ローカルにあるComfyUIを画像生成サーバーとして使用することも出来ます。画像生成特性を自分で細かく設定し、APIコストを減らすことができます。
ただし設定はかなり複雑になりますし、画像生成の時間も長くなる場合があります。

1. ComfyUIをAPIモードで動くように設定してください。
2. envのcomfy_urlにサーバーのurlを設定してください。
3. envに使用するモデルなど細かい設定値をjson文字列の形で設定してください。  
例
```json
{
  "env": {
    "comfy_url": "http://192.168.1.100:8188",
    "comfy_workflow_t2i": "C:\\Documents\\t2itest.json",
    "comfy_workflow_i2i":"C:\\Documents\\i2itest.json",
    "comfy_params":"ckpt_name='animagineXL40_v40.safetensors',denoise=0.65"
  }
}
```
4. デフォルトのワークフローはパッケージ内のassets/comfy/t2i_sample.json,assets/comfy/i2i_sample.jsonを使うことが出来ます。この中で%を使って変数を指定し、その変数をcomfy_paramsで指定することができます。

## libreChatを使う

libreChatで動作するように対応しました。使いやすくなりますが、一部追加の設定が必要になります。  
また動かすPCはDockerが安定に動くなど、そこそこ性能があるPCでないと安定しないようです。

#### libreChatをインストールする  
公式サイトに書かれている方法で動作する状態にしてください。  
この際、追加設定のため docker構成を推奨します。  

https://www.librechat.ai/docs/local/docker  

公式の手順で librechat.yaml の設定を行う。  
ローカルまたはAPIのLLMサービスを追加することになると思います。  

https://www.librechat.ai/docs/configuration/librechat_yaml  

ログイン用のユーザ追加を行います。  

https://www.librechat.ai/docs/configuration/authentication#create-user-script  

一般的なチャット会話が出来る状態に設定します。

#### 追加設定で rembg コンテナを追加する

rembg をdockerで使うために、rembg docker コンテナの組み込みと実行を追加します。

docker-compose.override.yml
```yml
 services:
   api:
     volumes:
       - type: bind
         source: ./librechat.yaml
         target: /app/librechat.yaml

   rembg:
     image: danielgatis/rembg:latest
     restart: always
     command: "s --host 0.0.0.0 --port 7000 --log_level info"

```

#### MCPサービスに map-traveler-mcp を追加する

librechat.yaml 追記
```yaml
mcpServers:
  traveler:
    type: stdio
    command: npx
    args:
      - -y
      - "@mfukushim/map-traveler-mcp"
```

.env 追記(claude_desktop_config.jsonのenvと同様)
```env
# map-traveler-mcp
GoogleMapApi_key=(Google Map APIキー)
sqlite_path=/home/run_test.sqlite (例 librechat コンテナ内の邪魔にならない場所か、マウントしt外部ディレクトリ内など)
remBgUrl=http://rembg:7000 (rembg サービスAPIのURL,コンテナ間URL)
(その他、画像生成AIの設定、PixAIキー、stablity.ai APIキー、ComfyUIの設定など)

```

設定後、コンテナを再起動してください。  
低速なPCだとmcpの初期化が失敗することがあります。複数再起動でうまくいくこともありますが実行は難しいかもです。  

#### libreChat内設定

libreChatでMCP機能を使うために、Agents機能を使います。

1. 会話画面でAgentsを選びます。  
   <img alt="libre1.png" src="https://raw.githubusercontent.com/mfukushim/map-traveler-mcp/for_image/tools/libre1.png" width="200"/>
2. 画面右のパネルからエージェントビルダーを選び、エージェントの設定を行います。
   <img alt="libre2.png" src="https://raw.githubusercontent.com/mfukushim/map-traveler-mcp/for_image/tools/libre2.png" width="200"/>
3. map-travelerを使うためにツールを追加を選びます。  
   <img alt="libre3.png" src="https://raw.githubusercontent.com/mfukushim/map-traveler-mcp/for_image/tools/libre3.png" width="200"/>
4. エージェントツールの画面が出ますのでmap-traveler-mcpのツールをすべて選んで追加します(もしmap-traveler-mcpのツールが出ていなければMCPの初期化を失敗していますので、コンテナの再起動またはログ等で設定を見直してください)  
   <img alt="libre4.png" src="https://raw.githubusercontent.com/mfukushim/map-traveler-mcp/for_image/tools/libre4.png" width="200"/>  
   <img alt="libre5.png" src="https://raw.githubusercontent.com/mfukushim/map-traveler-mcp/for_image/tools/libre5.png" width="200"/>
5. 指示文のエリアに追加スクリプトを入力します。  
libreChatにはMCPのリソース機能がないため、代わりに  
   https://github.com/mfukushim/map-traveler-mcp/blob/main/assets/scenario/role.txt  
  の中身のテキストを指示文のエリアに入力します。  
   <img alt="libre7.png" src="https://raw.githubusercontent.com/mfukushim/map-traveler-mcp/for_image/tools/libre7.png" width="200"/>
6. 作成ボタンを押してエージェントを保存します。  
   <img alt="libre6.png" src="https://raw.githubusercontent.com/mfukushim/map-traveler-mcp/for_image/tools/libre6.png" width="200"/>
7. 新規チャットを開始してください。 


## Smitheryでの実行  

https://smithery.ai/server/@mfukushim/map-traveler-mcp を参照ください。  
remote MCP(Streamable-http)に対応しています。画像生成はnano-bananaのみ使えます。  
db設定をTurso sqliteで記録出来るようにしたので、Tursoの設定を行えば旅の過程も保持されます。  
<img alt="smithery.png" src="tools/smithery.png" width="400"/>


## 設定ガイド

1. 紹介&練習設定編  
   https://note.com/marble_walkers/n/n7a8f79e4fb30
2. dbとGoogle APIと画像API設定編  
   https://note.com/marble_walkers/n/n765257c27f3b
3. アバター設定  
   https://note.com/marble_walkers/n/nc7273724faea
4. SNS設定  
   https://note.com/marble_walkers/n/na7c956befe7b
5. 応用サンプル1編  
   https://note.com/marble_walkers/n/n3c86edd8e817
6. ComfyUI設定編  
   https://note.com/marble_walkers/n/ncefc7c05d102
7. 応用サンプル2編  
   https://note.com/marble_walkers/n/ne7584ed231c8
8. LibreChat設定編  
   https://note.com/marble_walkers/n/n339bf7905324
9. AIエージェントSNS対戦マップチャレンジ  
   https://note.com/marble_walkers/n/n6db937573eaa
10. Smithery, Turso libSQL, rembg APIに対応しました   
    https://note.com/marble_walkers/n/ne3b3c0f99707


#### ソースコードについての追記  

エラーマネージメントをシンプルにする&自身の学習のためにEffect tsを使用しています。  
EffectのServiceも使っていますが、MCPの呼び出しの仕組み上、Serviceを使ってまとめたのは最適ではなかったと考えています。  
MCPの呼び出しを直接Effectで処理するほうがシンプルになると思います。  
追記: この後EffectのServiceの使い方について再検討してきれいに書き直せそうというところまでは把握していますが書き直すがどうかは検討中です。  

#### 最新の更新についてのメモ

- envにimage_widthを追加しました。デフォルトは512です。小さくすることでLLM APIのコストを低減出来るかもしれません。
- 画像入出力がないMCPクライアント向けに画像を出力しないenv設定を追加しました。  
"MT_NO_IMAGE": "true" で一切画像生成と出力をしません。その他の画像関係の設定を省略できます。  
```
{
  
  "env": {
    "MT_NO_IMAGE": "true"
  }
  
}
または
{
  
  "env": {
    "GoogleMapApi_key": "xxxx",
    "MT_NO_IMAGE": "true"
  }
  
}

```
- SNS(Bluesky)ポスト時に付加するタグ名を指定できるようにしました。#必須で15文字以上です。未指定だと"#geo_less_traveler"になります。    
- SNSで取得する情報を少し変更しました。SNSでポストする情報を少し変更しました。  
- SNSを介して複数の旅botが会話して遊ぶスクリプトを追加しました。  

- Smithery からのリモート利用に対応しました。  
細かい設定をしない場合は、練習モードで起動します。
各クラウドAPIまで設定することでフル動作も可能ですが、rembg APIなど有償APIを多数使うので課金にはご注意ください。  
アバター合成までしない場合は、最小 Google Map API, Turso sqlite API の設定のみでも旅動作可能です。

- MT_NO_AVATAR のオプションを追加しました。  
設定した場合、風景画像にアバター画像は合成しません。アバター合成にかかる処理リトライがなくなるため、返答の取得時間が著しく短くなります。  
画像合成が遅いか、どうしても失敗してしまう場合は設定してください。  

- 一部 MCP バージョン2025-06-18を取り入れました。  
スキーマにtitleを入れました。outputSchemaとstructured responseは将来取り入れる予定ですが今回は取り込んでいません。旅botの出力はテキストとしては単純なため構造化はまだ必要ないと考えています。  
  https://modelcontextprotocol.io/specification/2025-06-18/server/tools

- 初期化の誤りによりenvの設定にかかわらずSNS関数などが呼び出せないの問題を修正しました。 

- Streamable-httpに対応しました。急いでやったので不具合がある場合は 0.0.81 などを使用することを検討ください。

- nano-banana(gemini-2.5-flash-image-preview)の画像生成に対応しました。nano-bananaを使う際はrembgに関する設定は不要です。アバターのプロンプトの特性が変わったので、従来のアバタープロンプトでは画像生成がエラーになる場合があります。その際はnano-bananaで許容されるようなアバターの姿のプロンプトに調整する必要があります。

[![MseeP.ai Security Assessment Badge](https://mseep.net/pr/mfukushim-map-traveler-mcp-badge.png)](https://mseep.ai/app/mfukushim-map-traveler-mcp)
