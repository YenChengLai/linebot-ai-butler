// src/utils/lineMessage.js

/**
 * 格式化時間與日期
 */
function formatEventData(event) {
    const isAllDay = !event.start.dateTime;
    const start = event.start.dateTime || event.start.date;
    const end = event.end.dateTime || event.end.date;
    const dateObj = new Date(start);
    const endObj = new Date(end);

    // 日期：12/13 (六)
    const dateStr = dateObj.toLocaleString('zh-TW', {
        timeZone: 'Asia/Taipei',
        month: 'numeric',
        day: 'numeric',
        weekday: 'short'
    });

    // 時間：09:00 (如果是全天則顯示 "全天")
    const timeStr = isAllDay ? "全天" : dateObj.toLocaleString('zh-TW', {
        timeZone: 'Asia/Taipei',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });

    // 地點：如果有地點就顯示，沒有就顯示結束時間
    let locationOrDuration = event.location || "";
    if (!locationOrDuration && !isAllDay) {
        // 如果沒地點，改顯示結束時間 (e.g., ~ 10:00)
        const endTimeStr = endObj.toLocaleString('zh-TW', {
            timeZone: 'Asia/Taipei',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
        locationOrDuration = `~ ${endTimeStr}`;
    }

    return {
        summary: event.summary || "(無標題)",
        date: dateStr,
        time: timeStr,
        location: locationOrDuration,
        link: event.htmlLink || "https://calendar.google.com/calendar/u/0/r"
    };
}

/**
 * 產生單張卡片 Bubble (依照你的 Template 設計)
 */
function createBubble(event) {
    const data = formatEventData(event);

    return {
        type: "bubble",
        size: "mega", // 卡片寬度
        body: {
            type: "box",
            layout: "vertical",
            contents: [
                // 1. 頂部標籤 (綠色小字)
                {
                    type: "text",
                    text: "🔍 未來行程",
                    weight: "bold",
                    color: "#1DB446",
                    size: "sm"
                },
                // 2. 主標題 (XXL 粗體)
                {
                    type: "text",
                    text: data.summary,
                    weight: "bold",
                    size: "xxl",
                    margin: "md",
                    wrap: true
                },
                // 3. 副標題 (日期) - 原本是 "找到一筆結果"，改為顯示日期比較實用
                {
                    type: "text",
                    text: data.date, // e.g. 12/13 (六)
                    size: "xs",
                    color: "#aaaaaa",
                    wrap: true,
                    margin: "xs"
                },
                // 4. 分隔線
                {
                    type: "separator",
                    margin: "xxl"
                },
                // 5. 底部資訊欄 (時間 + 地點)
                {
                    type: "box",
                    layout: "horizontal",
                    margin: "md",
                    contents: [
                        // 左下：時間
                        {
                            type: "text",
                            text: data.time, // e.g. 09:00
                            size: "xs",
                            color: "#aaaaaa",
                            flex: 0
                        },
                        // 右下：地點 (靠右對齊)
                        {
                            type: "text",
                            text: data.location, // e.g. Toyota 新莊...
                            color: "#aaaaaa",
                            size: "xs",
                            align: "end",
                            wrap: true,
                            flex: 1
                        }
                    ]
                }
            ],
            // 點擊卡片跳轉到 Google 日曆
            action: {
                type: "uri",
                label: "Open Calendar",
                uri: data.link
            }
        },
        styles: {
            footer: {
                separator: true
            }
        }
    };
}

/**
 * 產生 Flex Message (支援 Carousel 輪播)
 */
function generateFlexMessage(events) {
    // 1. 如果沒行程
    if (!events || events.length === 0) {
        return { type: 'text', text: '📅 目前沒有找到相關行程喔！' };
    }

    // 2. 製作 Bubbles 陣列 (最多 12 張，LINE 上限)
    const bubbles = events.slice(0, 12).map(event => createBubble(event));

    // 3. 回傳 Carousel 容器
    return {
        type: "flex",
        altText: `🔍 找到 ${events.length} 個行程`,
        contents: {
            type: "carousel", // 使用輪播容器
            contents: bubbles
        }
    };
}

// 為了相容 Create 功能，我們也可以用同樣的卡片設計
function generateCreateSuccessFlex(params) {
    // 模擬一個 Event 物件結構
    const mockEvent = {
        summary: params.title,
        start: { dateTime: params.startTime },
        end: { dateTime: params.endTime },
        location: "" // 新增時通常還沒解析地點，留空
    };

    // 產生單張 Bubble
    const bubble = createBubble(mockEvent);

    // 修改一下頂部文字，讓它跟查詢有所區別
    bubble.body.contents[0].text = "✅ 行程已建立";

    return {
        type: "flex",
        altText: `✅ 行程已建立：${params.title}`,
        contents: bubble
    };
}

module.exports = { generateFlexMessage, generateCreateSuccessFlex };