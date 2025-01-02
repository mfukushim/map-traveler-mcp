# map-traveler-mcp

Google map上を仮想的に旅するアバターの環境を作るMCP serverです。

Claude DesktopなどのMCP clientから、アバターに指示をして、移動する旅の様子と写真を報告することができます。

## 設定

複数のGoogle mapのアクセスや画像生成など複数のAPIのアクセスキーを取得して設定する必要があります。
しかし、確認用にAPIキーを必要としない練習モードで実行することもできます。

必要とするAPI

Google Map API - Google Street View static,Near Places (NEW), 

練習モードの場合は以下の設定でOKです。
```json
{
  "mcpServers": {
    "traveler": {
      "command": "npx",
      "args": ["-y", "map-traveler-mcp"]
    }
  }
}
```

This template leverages [tsx](https://tsx.is) to allow execution of TypeScript files via NodeJS as if they were written in plain JavaScript.

To execute a file with `tsx`:

```sh
pnpm tsx ./path/to/the/file.ts
```

## Operations

**Building**

To build the package:

```sh
pnpm build
```

**Testing**

To test the package:

```sh
pnpm test
```
