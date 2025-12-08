const { http } = require('@google-cloud/functions-framework');
const line = require('@line/bot-sdk');
const { google } = require('googleapis');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Load environment variables from .env file in non-production environments
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}

// Setup LINE SDK config
const config = {
    channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
    channelSecret: process.env.CHANNEL_SECRET,
};

// Initialize Clients
const client = new line.Client(config);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

// Initialize Google Calendar (Using ADC - Application Default Credentials)
const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/calendar'],
});
const calendar = google.calendar({ version: 'v3', auth });

// Register Cloud Function HTTP entry point
http('lineWebhook', async (req, res) => {
    // 1. Ensure it's a POST request
    if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
    }

    // 2. (Optional) Verify LINE signature - skipped here for demo purposes
    // In production, it's recommended to verify the signature for security

    try {
        const events = req.body.events;

        // If no events (e.g., Webhook verification request), respond with 200
        if (!events || events.length === 0) {
            return res.status(200).send('OK');
        }

        // Process all events in parallel
        await Promise.all(events.map(handleEvent));

        res.status(200).send('OK');
    } catch (err) {
        console.error('Error processing events:', err);
        res.status(500).send('Internal Server Error');
    }
});

// Main event handling logic
async function handleEvent(event) {
    // Only handle text messages
    if (event.type !== 'message' || event.message.type !== 'text') {
        return Promise.resolve(null);
    }

    const userMessage = event.message.text;
    console.log(`收到訊息: ${userMessage}`);

    // Call Gemini to determine intent
    const aiResult = await parseWithGemini(userMessage);

    if (aiResult && aiResult.isEvent) {
        // If it's an event, write to calendar
        const replyText = await createCalendarEvent(aiResult);
        return client.replyMessage(event.replyToken, { type: 'text', text: replyText });
    } else {
        // If not an event, we choose to be silent here, or you can let it reply "I only handle scheduling commands"
        // client.replyMessage(event.replyToken, { type: 'text', text: "I only understand scheduling commands!" });
        return Promise.resolve(null);
    }
}

// Gemini AI analysis
async function parseWithGemini(text) {
    const now = new Date();
    const timeStr = now.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false });

    const prompt = `
    Context: Current time in Taiwan is ${timeStr}.
    User Input: "${text}"
    
    Task: Analyze if the user wants to schedule an event.
    1. If yes, set "isEvent" to true.
    2. Extract "title", "startTime", "endTime".
    3. Format times as ISO 8601 strings (e.g., "2025-12-08T14:00:00").
    4. If no end time is mentioned, assume 1 hour duration.
    5. If not an event request, set "isEvent" to false.
    
    Response must be valid JSON only, no markdown formatting.
    Example: {"isEvent": true, "title": "Dinner", "startTime": "...", "endTime": "..."}
  `;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        let textResult = response.text();
        // Clean possible response formatting (remove ```json)
        textResult = textResult.replace(/```json/g, "").replace(/```/g, "").trim();
        return JSON.parse(textResult);
    } catch (e) {
        console.error("Gemini Error:", e);
        return null;
    }
}

// 寫入 Google Calendar
async function createCalendarEvent(data) {
    try {
        await calendar.events.insert({
            calendarId: process.env.CALENDAR_ID, // Read ID from environment variable
            requestBody: {
                summary: data.title,
                start: { dateTime: data.startTime, timeZone: 'Asia/Taipei' },
                end: { dateTime: data.endTime, timeZone: 'Asia/Taipei' },
            },
        });

        // Format display time
        const dt = new Date(data.startTime);
        const displayTime = dt.toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });

        return `✅ 行程已建立！\n📅 ${data.title}\n⏰ ${displayTime}`;
    } catch (error) {
        console.error("Calendar Error:", error);
        return `❌ 建立失敗: ${error.message}`;
    }
}