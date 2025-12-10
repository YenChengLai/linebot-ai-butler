const { http } = require('@google-cloud/functions-framework');
const line = require('@line/bot-sdk');
const { google } = require('googleapis');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const { generateCreateSuccessFlex, generateFlexMessage } = require('./src/utils/lineMessage');

if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}

const config = {
    channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
    channelSecret: process.env.CHANNEL_SECRET,
};

const client = new line.Client(config);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/calendar'],
});
const calendar = google.calendar({ version: 'v3', auth });

http('lineWebhook', async (req, res) => {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
    try {
        const events = req.body.events;
        if (!events || events.length === 0) return res.status(200).send('OK');
        await Promise.all(events.map(handleEvent));
        res.status(200).send('OK');
    } catch (err) {
        console.error(err);
        res.status(500).send('Error');
    }
});

async function handleEvent(event) {
    if (event.type !== 'message' || event.message.type !== 'text') return null;

    let userMessage = event.message.text.trim();

    // 1. 群組過濾機制 (喚醒詞)
    // 如果是群組或多人聊天室，必須包含「管家」才觸發
    const isGroup = event.source.type === 'group' || event.source.type === 'room';
    const triggerWord = "管家";

    if (isGroup) {
        if (!userMessage.startsWith(triggerWord)) {
            return null; // 沒叫我就略過
        }
        // 把「管家」兩個字拿掉，剩下的給 AI
        userMessage = userMessage.substring(triggerWord.length).trim();
    }

    // 2. 呼叫 Gemini 解析意圖
    const aiAnalysis = await parseIntentWithGemini(userMessage);

    console.log("🤖 Gemini Analysis Result:", JSON.stringify(aiAnalysis));

    if (!aiAnalysis) return null;

    let replyMessage = "";

    // 3. 根據 AI 判斷的 Action 分流處理
    switch (aiAnalysis.action) {
        case 'create':
            // 1. 先建立日曆
            const createResult = await createCalendarEvent(aiAnalysis.params);

            // 2. 判斷建立結果
            if (createResult.success) {
                // 如果成功，回傳 Flex Message
                replyMessage = generateCreateSuccessFlex(aiAnalysis.params);
            } else {
                // 如果失敗，回傳錯誤文字
                replyMessage = { type: 'text', text: createResult.message };
            }
            break;
        case 'query':
            // 1. 取得資料
            const listResult = await listCalendarEvents(aiAnalysis.params);

            // 2. 判斷結果
            if (listResult.success) {
                // 如果成功，呼叫剛剛寫好的 Flex Generator
                // 注意：如果 events 是空陣列，Generator 裡面有處理會回傳文字
                replyMessage = generateFlexMessage(listResult.events);
            } else {
                // 失敗則回傳錯誤訊息
                replyMessage = { type: 'text', text: listResult.message };
            }
            break;
        case 'delete':
            replyMessage = { type: 'text', text: "🗑️ 刪除功能比較危險，建議您直接點連結進入日曆刪除喔！" };
            break;
        case 'chat':
            replyMessage = { type: 'text', text: aiAnalysis.response };
            break;
        default:
            // 如果 AI 判斷不出來，就不回覆 (避免吵鬧)
            return null;
    }

    if (replyMessage) {
        return client.replyMessage(event.replyToken, replyMessage);
    }
}

// V2: 新的 Prompt 設計
async function parseIntentWithGemini(text) {
    const now = new Date();
    const timeStr = now.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false });

    const prompt = `
    Context: Current time in Taiwan is ${timeStr}.
    User Input: "${text}"
    
    You are a smart personal assistant. Analyze the user's intent and categorize it into one of the following actions:
    
    1. "create": User wants to schedule an event. Extract "title", "startTime", "endTime" (ISO 8601). If no end time, assume 1 hour.
    2. "query": User wants to know about upcoming events. Extract "timeMin" (ISO 8601) and "timeMax" (ISO 8601). If they say "tomorrow", verify the specific date range.
    3. "chat": General conversation or greeting. Provide a brief, friendly "response".
    
    Response MUST be valid JSON only. NO markdown.
    
    Examples:
    - Input: "明天晚上七點吃飯" -> {"action": "create", "params": {"title": "吃飯", "startTime": "...", "endTime": "..."}}
    - Input: "明天有什麼行程？" -> {"action": "query", "params": {"timeMin": "...", "timeMax": "..."}}
    - Input: "你好" -> {"action": "chat", "response": "你好！我是你的行程小管家，有什麼需要幫忙的嗎？"}
  `;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        let textResult = response.text().replace(/```json/g, "").replace(/```/g, "").trim();
        return JSON.parse(textResult);
    } catch (e) {
        console.error("Gemini Error:", e);
        return null; // 解析失敗就不回覆
    }
}

async function createCalendarEvent(params) {
    try {
        await calendar.events.insert({
            calendarId: process.env.CALENDAR_ID,
            requestBody: {
                summary: params.title,
                start: { dateTime: params.startTime, timeZone: 'Asia/Taipei' },
                end: { dateTime: params.endTime, timeZone: 'Asia/Taipei' },
            },
        });

        // 回傳成功狀態，不需組字串了，交給 Flex Message 處理
        return { success: true };

    } catch (error) {
        console.error("Calendar Error:", error);
        // 回傳失敗訊息
        return { success: false, message: `❌ 建立失敗: ${error.message}` };
    }
}

// 新增：查詢行程功能
async function listCalendarEvents(params) {
    try {
        // 1. 處理開始時間 (TimeMin)
        let minDate = params.timeMin ? new Date(params.timeMin) : new Date();
        if (isNaN(minDate.getTime())) minDate = new Date();

        // 2. 處理結束時間 (TimeMax)
        let maxDate = params.timeMax ? new Date(params.timeMax) : new Date(minDate);
        // 如果沒給結束時間，預設+7天
        if (!params.timeMax) maxDate.setDate(maxDate.getDate() + 7);

        // 如果日期無效，也強制重設為 7 天後
        if (isNaN(maxDate.getTime())) {
            maxDate = new Date(minDate);
            maxDate.setDate(maxDate.getDate() + 7);
        }

        // 3. 關鍵修正：轉成 ISO 字串 (會自動補上 Z)
        const timeMinISO = minDate.toISOString();
        const timeMaxISO = maxDate.toISOString();

        console.log(`📅 Querying Calendar: ${timeMinISO} ~ ${timeMaxISO}`);

        const res = await calendar.events.list({
            calendarId: process.env.CALENDAR_ID,
            timeMin: timeMinISO, // 這裡送出去的一定要有 Z
            timeMax: timeMaxISO,
            singleEvents: true,
            orderBy: 'startTime',
            maxResults: 10,
        });

        return { success: true, events: res.data.items };

    } catch (error) {
        console.error("List Error:", error);
        return { success: false, message: `❌ 查詢失敗: ${error.message}` };
    }
}

