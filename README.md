# 自動月班表產生器

這是一個可在 iPhone / 桌面瀏覽器使用的單頁網頁 App。

功能：
- 上傳或拍攝公司月班表照片
- 自動尋找固定員編 `25001104`
- 自動抽取該列班表資料
- 自動產生 9:16 直式手機月班表
- 不顯示姓名、不顯示員編、不顯示圖例
- 可下載輸出的 PNG 圖片

## 設計重點

本專案把流程拆成兩段：
1. **AI/視覺辨識**：只負責從原始照片抓出年月與每一天的班別資料。
2. **程式化渲染**：真正的月曆由 HTML/CSS/JS 產生，避免直接使用生成式圖片造成日期或時間誤植。

## 環境需求

- Node.js 18+
- OpenAI API Key

## 安裝與啟動

```bash
npm install
cp .env.example .env
```

編輯 `.env`：

```env
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4.1-mini
PORT=3000
```

啟動：

```bash
npm start
```

開啟：

```text
http://localhost:3000
```

## 使用方式

1. 開啟網頁
2. 點「上傳或拍攝班表照片」
3. 選擇照片後，系統會自動開始辨識
4. 若成功找到員編 `25001104`，就會自動產生 9:16 月班表
5. 點「下載 PNG」即可儲存圖片

## 錯誤處理

- 若照片中找不到固定員編 `25001104`，前端會顯示：`找不到指定班表列`。
- 若年份無法可靠辨識，系統會先採用當前年份，並在畫面狀態訊息提示。

## 可再擴充項目

- 增加登入與歷史紀錄
- 改成可切換不同固定員編
- 加入影像裁切 / 透視校正
- 加入本地 OCR 預處理後再送模型
- 部署到 Vercel / Render / Railway

## iPhone 使用建議

在 Safari 開啟後，可使用 **分享 → 加入主畫面**，變成接近 App 的使用方式。

## Render 部署（2026）

1. 把本專案上傳到自己的 **GitHub 私有儲存庫**（不要上傳 `.env`）。
2. 登入 [Render](https://dashboard.render.com/)，選擇 **New → Blueprint**，連接該 GitHub 儲存庫。
3. Render 會讀取根目錄 `render.yaml`。依提示填入 `OPENAI_API_KEY`，此金鑰只存在 Render 後端環境變數，**不要寫到前端**。
4. 點選套用／部署，待服務通過 `/health` 健康檢查，即可開啟 Render 提供的 HTTPS 網址。
5. 用 iPhone Safari 開啟網址，點分享 → 加入主畫面。

### 注意事項

- 部署需要自己的 Render 帳號、GitHub 儲存庫及 OpenAI API 金鑰；API 使用可能產生費用。
- Render 免費方案可能有閒置休眠、流量或資源限制，實際條件依當時 Render 公告。
- 照片會送至 OpenAI API 做辨識，網站只在記憶體暫存上傳圖片，不建立永久相簿或資料庫。不要上傳未經授權的員工個資；建議將原圖裁切到必要區域。
- AI 仍可能誤讀時段；正式使用前請核對原始照片。原圖中無法可靠辨識的班別不應被視為已確認。
- Render Blueprint 的 `OPENAI_API_KEY: sync: false` 會要求部署時輸入；如果服務已存在，請至 Environment 手動設定。
