# 旅botミニ MCP版
### 仮想 旅アバター環境パッケージ 


Japanese / [English](./README.md)

Google map上を仮想的に旅するアバターの環境を作るMCP serverです。

Claude DesktopなどのMCP clientから、アバターに指示をして、移動する旅の様子と写真を報告することができます。

<img alt="img.png" src="tools/img.png" width="400"/>

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
- set_traveler_location(address: string)  
現在の旅アバターのいる場所を設定します。  
  address: 住所情報(正確な住所、またはGoogle MapやClaudeが認識できる一般的な呼称など)
- get_traveler_destination_address  
設定している旅アバターの目的地を取得します
- set_traveler_destination_address(address: string)  
旅アバターの目的地を設定します  
  address: 住所情報(正確な住所、またはGoogle MapやClaudeが認識できる一般的な呼称など)
- start_traveler_journey  
目的地に旅を開始します。
- stop_traveler_journey  
旅を中止します。
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
- get_environment  
  環境設定値と画像設定値を取得する

#### MCP resources

2つのカスタムプロンプトのサンプルを持ちます。  
Claude Desktopでプロンプトを取り込むと、Claudeが旅人の立場の役をします。  
SNS対応版では旅会話をしながらSNSの入出力を制御します。

- role.txt  
Claudeが旅人の立場の役をします。
- roleWithSns.txt  
Claudeが旅人の立場の役をします。合わせてSNSへの読み取りとポストを制御します。

## 設定

複数のGoogle mapのアクセスや画像生成など複数のAPIのアクセスキーを取得して設定する必要があります。
APIの使用には課金がかかることがあります。

Claude Desktopで使用する場合の設定  
claude_desktop_config.json
```json
{
  "mcpServers": {
    "traveler": {
      "command": "npx",
      "args": ["-y", "@mfukushim/map-traveler-mcp"],
      "env":{
        "GoogleMapApi_key":"(Google Map APIのキー)",
        "sqlite_path":"(db保存ファイルのパス 例 %USERPROFILE%/Desktop/traveler.sqlite など)",
        "rembg_path": "(インストールしたrembg cliの絶対パス)",
        "pixAi_key":"(pixAi APIのキー)",
        "sd_key":"(またはStability.aiのAPIのキー",
        "pixAi_modelId": "(オプション: pixAiの場合の使用ModelId. 未設定の場合とりあえず 1648918127446573124 を使う",
        "fixed_model_prompt": "(オプション: 固定でアバターの姿指定プロンプトを設定する。会話でアバター姿を変更できなくなる。)",
        "bodyAreaRatio": "(オプション: 許容されるアバター面積比. default 0.042)",
        "bodyHWRatio": "(オプション: 許容されるアバター縦横比. default 1.5~2.3)",
        "bodyWindowRatioW": "(オプション: アバター合成ウィンドウ横比率. default 0.5)",
        "bodyWindowRatioH": "(オプション: アバター合成ウィンドウ縦比率. default 0.75)",
        "bs_id":"(bluesky snsの登録アドレス)",
        "bs_pass":"(bluesky snsのパスワード)",
        "bs_handle":"(bluesky snsのハンドル名 例 xxxxx.bsky.social など)",
        "filter_tools": "(オプション:使うツールを直に絞る 指定しなければ使えるすべて 例 tips,set_traveler_location)"
      }
    }
  }
}
```
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

確認用にAPIキーを必要としない練習モードで実行することもできます。

練習モードの設定  
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

練習モードまで

1. nodejs 22をインストールします。
2. Claude Desktopを使える状況にします。
3. claude_desktop_config.jsonに上記のいずれかの設定を反映します。
4. Claude Desktopを再起動します。設定に少し時間がかかるかもしれません(エラーが出る場合は。再度Claude Desktopを再起動してみてください。上手くいかない場合は下記、注意を参照ください。)。以下のマークが画面右下に出ることを確認します。  
   <img alt="img_1.png" src="tools/img_1.png" width="150"/>
5. 「いまどこにいますか」「旅に出かけてください」と問いかけてください。会話が始まります。API使用時には確認画面が出るのでAllowを選んでください。
   <img alt="img_4.png" src="tools/img_4.png" width="200"/>
6. Attach from MCPを選択し、role.txtを選択してください。
   <img alt="img_2.png" src="tools/img_2.png" width="200"/>
   <img alt="img_3.png" src="tools/img_3.png" width="200"/>
7. 旅用のプロンプトが組み込まれたので自由に会話してみてください。

本格的に使う

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

### 設定ガイド

1. 紹介&練習設定編
   https://note.com/marble_walkers/n/n7a8f79e4fb30
2. dbとGoogle APIと画像API設定編
   https://note.com/marble_walkers/n/n765257c27f3b
3. アバター設定
   https://note.com/marble_walkers/n/nc7273724faea
4. SNS設定  
   https://note.com/marble_walkers/n/na7c956befe7b
5. 応用編 (準備中)
