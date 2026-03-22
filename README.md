# Discord Google Sheets Bot

使用 `Node.js + TypeScript + discord.js + Google Sheets API` 建立的 Discord bot，提供每週日期按鈕報名，資料存放在 Google Sheets。

## 功能

- `/signup-panel channel`
  發送下週的日期報名面板。

- `/signup-status [week_key]`
  查看指定週次的日期報名狀況；不填則預設查看下週。

- `/signup-prune mode`
  手動測試清理報名資料，可選擇只保留目前管理週，或直接清空全部。

## 報名設計

- 以「下週」為固定報名週次
- 使用周一到周日按鈕
- 支援 `我要打全部`
- 每天有人數上限
- 報名摘要直接顯示在同一則訊息內
- 資料存放在 Google Sheets
- 報名名稱優先使用 `members` 分頁中的 `gameName`
- 週次切換後自動清除舊報名資料，只保留目前管理中的那一週

## Google Sheets 工作表

### members

- `discordUserId`
- `username`
- `displayName`
- `gameName`

### signups

- `weekKey`
- `discordUserId`
- `username`
- `gameName`
- `dayKey`
- `dayLabel`
- `updatedAt`

成員資料若需要維護，請由管理員直接在 Google Sheet 的 `members` 分頁手動新增或編輯。

## 環境變數

參考 [.env.example](D:\BriLeith\google_bri\.env.example)：

```env
DISCORD_TOKEN=
DISCORD_CLIENT_ID=
DISCORD_GUILD_ID=
GOOGLE_SHEET_ID=
GOOGLE_APPLICATION_CREDENTIALS=./credentials.json
MEMBERS_SHEET_NAME=members
SIGNUP_CHANNEL_ID=
SIGNUPS_SHEET_NAME=signups
MAX_SIGNUPS_PER_DAY=8
```

## Google Service Account 設定

1. 建立 service account 並下載 JSON 金鑰。
2. 將 JSON 檔放到專案根目錄，例如 `./credentials.json`。
3. 把 service account email 加到目標 Google Sheet 的共用名單，權限給編輯者。
4. 確認 `.env` 的 `GOOGLE_APPLICATION_CREDENTIALS` 指向正確檔案。

## 使用流程

1. 建立 `.env`
2. 填入 Discord 與 Google Sheets 設定
3. 在 `members` 分頁維護 `discordUserId` 與 `gameName`
4. 執行 `npm install`
5. 執行 `npm run deploy:commands`
6. 啟動 bot
7. 用 `/signup-panel` 發送下週報名面板
8. 需要測試清理時，用 `/signup-prune mode:只保留目前管理週` 或 `/signup-prune mode:清空全部報名`

## 開發與部署

```bash
npm run build
npm run dev
npm run start
```
