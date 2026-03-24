# Discord Google Sheets Signup Bot
資料儲存在 Google Sheets，成員可以透過按鈕報名，管理者也可以用 slash command 手動新增、取消或清理資料。

## Features
- 以 Google Sheets 作為報名資料來源
- Discord slash commands 與按鈕報名介面
- 每日報名人數上限控制
- 支援成員名稱對照表 `members`
- 自動清理非目前管理週的舊資料
- CLI log 顯示指令、按鈕、使用者、參數與結果

## Commands
- `/signup-panel`
  在目前頻道發送本週報名面板。
- `/signup-status [week_key]`
  查看指定週次的報名狀態。
- `/signup-add member day [week_key] [game_name]`
  手動幫指定成員加入某一天的報名。
- `/signup-remove member day [week_key]`
  手動取消指定成員某一天的報名。
- `/signup-prune mode`
  清理報名資料。
  `keep_current` 只保留目前管理中的那一週。
  `clear_all` 清空全部報名資料。

## Signup Behavior
- 使用者按按鈕可切換自己某一天的報名狀態
- `全選/全取消` 會一次處理整週報名
- `重新整理` 會刷新目前面板內容
- 每一天最多 `MAX_SIGNUPS_PER_DAY` 人
- 名稱顯示優先順序：
  `gameName` from `members` > Discord display name > Discord username
- bot 啟動時會自動建立缺少的 sheet
- bot 啟動與定時檢查時會清理不是目前管理週的舊資料

## Google Sheets Structure
### `members`
- `discordUserId`
- `username`
- `displayName`
- `gameName`

### `signups`
- `weekKey`
- `discordUserId`
- `username`
- `gameName`
- `dayKey`
- `dayLabel`
- `updatedAt`
- 
## Google Service Account Setup

1. 在 Google Cloud 建立 service account。
2. 下載 service account JSON 憑證。
3. 將 JSON 放到專案中，預設路徑為 `./credentials.json`。
4. 把 service account email 加到 Google Sheet 的共用名單，至少給編輯權限。
5. 如果憑證檔案不在預設路徑，請在 `.env` 設定 `GOOGLE_APPLICATION_CREDENTIALS`。

## Setup

1. 建立 `.env`
2. 準備 Discord Bot 與 Google Sheets 憑證
3. 在 `members` sheet 內填入成員 `discordUserId` 與 `gameName`
4. 安裝套件

```bash
npm install
```

5. 部署 slash commands

```bash
npm run deploy:commands
```

6. 啟動 bot

開發模式：

```bash
npm run dev
```

正式執行：

```bash
npm run build
npm start
```

## CLI Logs

bot 會在終端顯示基本操作紀錄，例如：

```text
[2026-03-24 22:10:31] command start by avshi(497361151164940306) command=signup-add member="497361151164940306" day="day_tue"
[2026-03-24 22:10:32] command result by avshi(497361151164940306) command=signup-add result="已為 泰斯特尼 新增 周二 報名。"
[2026-03-24 22:11:05] button start by avshi(497361151164940306) signup:2026-03-24:day_tue weekKey="2026-03-24" action="day_tue"
[2026-03-24 22:11:06] button result by avshi(497361151164940306) signup:2026-03-24:day_tue weekKey="2026-03-24" action="day_tue" result="已報名 周二。"
```

會記錄：

- 時間
- Discord 使用者名稱與 user ID
- 指令名稱
- 指令參數
- 按鈕 `customId`
- 執行結果
- 例外錯誤

## Notes

- 目前程式碼本身沒有做角色權限限制，能看見指令的人就能用。
- 新增或修改 slash commands 後，需要重新執行 `npm run deploy:commands`。
- 如果你是跑 `node dist/index.js`，每次改完 TypeScript 後都要先 `npm run build`。
