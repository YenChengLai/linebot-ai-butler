# 🤖 AI Butler - Line Bot with Gemini & Google Calendar

這是一個結合 **Google Gemini AI** 與 **Google Calendar** 的 LINE 聊天機器人。
它可以理解自然語言，協助家庭或個人透過 LINE 輕鬆管理行程。

## ✨ 功能特色 (Features)

* **自然語言處理**：不需要死板的指令，直接說「明天晚上七點吃飯」即可。
* **行程管理**：自動將行程同步至 Google Calendar。
* **行程查詢**：可以詢問「下週有哪些行程？」。
* **群組支援**：在群組中需使用喚醒詞「管家」開頭，避免干擾日常對話。
* **Serverless 架構**：部署於 Google Cloud Functions (Gen 2)，低成本且高穩定性。

## 🏗️ 系統架構 (Architecture)

```mermaid
graph TD
    %% 1. 定義樣式類別 (Class Definitions)
    classDef line fill:#06c755,stroke:#fff,stroke-width:2px,color:#fff;
    classDef gcp fill:#4285F4,stroke:#fff,stroke-width:2px,color:#fff;
    classDef ai fill:#FFD700,stroke:#333,stroke-width:2px,color:#333;
    classDef user fill:#fff,stroke:#333,stroke-width:2px;

    %% 2. 定義節點 (Nodes) - 使用引號包住文字以避免 Unicode 錯誤
    User("👤 使用者/家庭成員")
    LineApp["📱 LINE App"]
    LinePlatform["LINE Messaging API"]
    
    subgraph GoogleCloud ["☁️ Google Cloud Platform"]
        CloudFunc["⚡ Cloud Functions <br/>(Node.js Runtime)"]
    end
    
    subgraph GoogleServices ["🧠 Google AI & Data Services"]
        Gemini["✨ Gemini 2.5 Flash <br/>(語意分析 & 意圖判斷)"]
        Calendar["📅 Google Calendar <br/>(行程資料庫)"]
    end

    %% 3. 定義連線 (Relationships)
    User -->|"1. 輸入訊息/喚醒詞"| LineApp
    LineApp -->|"2. 傳送"| LinePlatform
    LinePlatform -->|"3. Webhook POST"| CloudFunc
    
    CloudFunc <==>|"4. 分析語意 & 提取參數"| Gemini
    CloudFunc <==>|"5. 新增或查詢行程"| Calendar
    
    CloudFunc -->|"6. 回傳結果"| LinePlatform
    LinePlatform -->|"7. 推播回覆"| LineApp

    %% 4. 套用樣式 (Apply Classes) - 這是最穩定的寫法
    class User user
    class LineApp,LinePlatform line
    class CloudFunc,Calendar gcp
    class Gemini ai
```

## 🛠️ 技術棧 (Tech Stack)

* **Runtime**: Node.js 20
* **Cloud Platform**: Google Cloud Platform (Cloud Functions)
* **AI Model**: Google Gemini 1.5 Flash
* **Messaging**: LINE Messaging API
* **Database**: Google Calendar API

## 🚀 快速開始 (Quick Start)

### 前置需求

1. Google Cloud Platform 帳號 (需啟用 Billing)。
2. LINE Developers 帳號 (建立 Messaging API Channel)。
3. Gemini API Key (Google AI Studio)。

### 本地開發 (Local Development)

1. **Clone 專案**

    ```bash
    git clone [https://github.com/YourName/linebot-ai-butler.git](https://github.com/YourName/linebot-ai-butler.git)
    cd linebot-ai-butler
    ```

2. **安裝依賴**

    ```bash
    npm install
    ```

3. **設定環境變數**
    複製 `.env.example` 為 `.env` 並填入以下資訊：

    ```env
    CHANNEL_ACCESS_TOKEN=你的LINE_Token
    CHANNEL_SECRET=你的LINE_Secret
    GEMINI_API_KEY=你的Gemini_Key
    CALENDAR_ID=你的Google日曆ID
    ```

4. **啟動本地伺服器**

    ```bash
    npx @google-cloud/functions-framework --target=lineWebhook --port=8080
    ```

5. **使用 ngrok 進行測試**

    ```bash
    ngrok http 8080
    ```

    將 ngrok 網址貼回 LINE Developers Console 的 Webhook URL。

## ☁️ 部署 (Deployment)

使用 gcloud CLI 部署至 Google Cloud Functions：

```bash
gcloud functions deploy line-bot-function \
  --gen2 \
  --runtime=nodejs20 \
  --region=asia-east1 \
  --source=. \
  --entry-point=lineWebhook \
  --trigger-http \
  --allow-unauthenticated \
  --set-env-vars="CHANNEL_ACCESS_TOKEN=...,CALENDAR_ID=..."
```

## 📝 使用範例

* **新增行程**: 「管家，明天下午三點要帶兒子去打疫苗」
* **查詢行程**: 「管家，這禮拜有什麼行程?」

## 👤 Author

Developed by [YenCheng Lai](https://github.com/YenChengLai)
