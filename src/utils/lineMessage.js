// src/utils/lineMessage.js

/**
 * 格式化時間與日期
 */
function formatEventData(event) {
    const isAllDay = !event.start.dateTime;
    const start = event.start.dateTime || event.start.date;
    const end = event.end.dateTime || event.end.date;
    const dateObj = new Date(start);

    // 取得單純的日期字串 (YYYY-MM-DD) 用來分組
    const dateKey = dateObj.toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' });

    // 顯示用的日期：12/10 (Wed)
    const displayDate = dateObj.toLocaleString('en-US', {
        timeZone: 'Asia/Taipei',
        month: 'numeric',
        day: 'numeric',
        weekday: 'short'
    });

    // 時間：14:00 (全天顯示 "All Day")
    const timeStr = isAllDay ? "All Day" : dateObj.toLocaleString('zh-TW', {
        timeZone: 'Asia/Taipei',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });

    // 地點
    const location = event.location || "";

    return {
        rawDate: dateObj, // 用來排序
        dateKey,          // 用來分組
        displayDate,      // 顯示在標題
        time: timeStr,
        summary: event.summary || "(No Title)",
        location: location,
        // 判斷是否為重要行程 (標題包含 "重要" 或 "Important")
        isImportant: (event.summary && (event.summary.includes("重要") || event.summary.includes("Important")))
    };
}

/**
 * 產生「未來行程總覽」的 Flex Message (Timeline Style)
 */
function generateOverviewFlex(events) {
    if (!events || events.length === 0) {
        return { type: 'text', text: '📅 目前沒有找到相關行程喔！' };
    }

    // 1. 將行程依「日期」分組
    const groupedEvents = {};
    events.forEach(event => {
        const data = formatEventData(event);
        if (!groupedEvents[data.dateKey]) {
            groupedEvents[data.dateKey] = {
                dateLabel: data.displayDate, // e.g. 12/10 (Wed)
                items: []
            };
        }
        groupedEvents[data.dateKey].items.push(data);
    });

    // 2. 準備 Header 的日期區間 (e.g., 12/10 - 12/15)
    const sortedKeys = Object.keys(groupedEvents).sort();
    const startDate = groupedEvents[sortedKeys[0]].dateLabel;
    const endDate = groupedEvents[sortedKeys[sortedKeys.length - 1]].dateLabel;
    const dateRangeText = (sortedKeys.length > 1) ? `${startDate} - ${endDate}` : startDate;

    // 3. 動態建構 Body 內容
    const bodyContents = [];

    sortedKeys.forEach((key, index) => {
        const group = groupedEvents[key];

        // A. 加入日期標頭 (如果是今天，可以加個 "Today")
        // 這裡簡單處理，直接顯示日期
        bodyContents.push({
            type: "box",
            layout: "vertical",
            contents: [
                {
                    type: "text",
                    text: group.dateLabel, // e.g. 12/10 (Wed)
                    weight: "bold",
                    size: "sm",
                    color: "#2B3467"
                },
                {
                    type: "separator",
                    margin: "sm",
                    color: "#2B3467"
                }
            ],
            margin: index === 0 ? "none" : "xl" // 第一個日期不需要上邊距
        });

        // B. 加入該日期的所有行程
        group.items.forEach(item => {
            // 設定顏色：如果是重要行程用紅色(#E63946)，否則用深灰(#111111)
            const titleColor = item.isImportant ? "#E63946" : "#111111";
            const timeColor = item.isImportant ? "#E63946" : "#888888";

            bodyContents.push({
                type: "box",
                layout: "horizontal",
                contents: [
                    // 左側：時間
                    {
                        type: "text",
                        text: item.time,
                        size: "sm",
                        color: timeColor,
                        flex: 0,
                        gravity: "top", // 對齊上方
                        weight: "bold",
                        margin: "xs"
                    },
                    // 右側：事項與地點
                    {
                        type: "box",
                        layout: "vertical",
                        contents: [
                            {
                                type: "text",
                                text: item.summary,
                                size: "sm",
                                color: titleColor,
                                wrap: true,
                                weight: item.isImportant ? "bold" : "regular"
                            },
                            // 只有當地點存在時才顯示
                            ...(item.location ? [{
                                type: "text",
                                text: item.location,
                                size: "xs",
                                color: "#aaaaaa",
                                margin: "xs",
                                wrap: true
                            }] : [])
                        ],
                        flex: 1,
                        margin: "md"
                    }
                ],
                margin: "lg"
            });
        });
    });

    // 4. 回傳完整的 Flex Message JSON
    return {
        type: "flex",
        altText: `📅 未來行程總覽 (${events.length})`,
        contents: {
            type: "bubble",
            size: "mega",
            header: {
                type: "box",
                layout: "vertical",
                contents: [
                    {
                        type: "box",
                        layout: "horizontal",
                        contents: [
                            {
                                type: "image", // 使用日曆 Icon
                                url: "https://cdn-icons-png.flaticon.com/512/2693/2693507.png",
                                flex: 0,
                                aspectMode: "fit",
                                size: "sm"
                            },
                            {
                                type: "text",
                                text: "未來行程總覽",
                                weight: "bold",
                                color: "#ffffff",
                                size: "lg",
                                gravity: "center",
                                margin: "md",
                                flex: 1
                            }
                        ]
                    },
                    {
                        type: "text",
                        text: dateRangeText, // 顯示日期區間
                        color: "#b7c0ce",
                        size: "xs",
                        margin: "sm"
                    }
                ],
                backgroundColor: "#2B3467",
                paddingAll: "20px",
                paddingBottom: "15px"
            },
            body: {
                type: "box",
                layout: "vertical",
                contents: bodyContents // 放入動態生成的內容
            },
            footer: {
                type: "box",
                layout: "vertical",
                contents: [
                    {
                        type: "button",
                        action: {
                            type: "uri",
                            label: "打開 Google 日曆",
                            uri: "https://calendar.google.com/calendar/u/0/r"
                        },
                        style: "primary",
                        color: "#2B3467",
                        height: "sm"
                    }
                ],
                backgroundColor: "#f8f9fa"
            }
        }
    };
}

/**
 * 產生單一行程建立成功的卡片 (維持原本設計，稍微配合新風格微調顏色)
 */
function generateCreateSuccessFlex(params) {
    // 🕵️‍♂️ 修正時區問題 (Timezone Fix)
    // Gemini 有時候回傳的時間格式是 "2025-12-12T10:30:00" (少了時區)
    // 在 Cloud Function (UTC 環境) 會被當作 UTC 時間，導致轉回台灣時間時 +8 小時

    let startTimeStr = params.startTime;

    // 如果字串結尾沒有 'Z' (UTC) 也沒有 '+' (時區偏移)，就手動補上台灣時區
    if (startTimeStr && !startTimeStr.endsWith('Z') && !startTimeStr.includes('+')) {
        startTimeStr += '+08:00';
    }

    const dt = new Date(startTimeStr);

    // 格式化顯示時間
    const dateStr = dt.toLocaleString('zh-TW', {
        timeZone: 'Asia/Taipei',
        month: 'numeric',
        day: 'numeric',
        weekday: 'short'
    });

    const timeStr = dt.toLocaleString('zh-TW', {
        timeZone: 'Asia/Taipei',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false // 使用 24 小時制比較不容易看錯，或者你可以改回 true
    });

    return {
        type: "flex",
        altText: `✅ 行程已建立：${params.title}`,
        contents: {
            type: "bubble",
            size: "mega",
            body: {
                type: "box",
                layout: "vertical",
                contents: [
                    {
                        type: "text",
                        text: "✅ 行程已建立",
                        weight: "bold",
                        color: "#1DB446",
                        size: "sm"
                    },
                    {
                        type: "text",
                        text: params.title,
                        weight: "bold",
                        size: "xl", // 稍微放大標題
                        margin: "md",
                        wrap: true
                    },
                    {
                        type: "box",
                        layout: "horizontal",
                        margin: "md",
                        contents: [
                            {
                                type: "text",
                                text: dateStr, // e.g. 12/12 (五)
                                size: "sm",
                                color: "#666666",
                                flex: 0
                            },
                            {
                                type: "text",
                                text: timeStr, // e.g. 10:30
                                size: "sm",
                                color: "#111111",
                                weight: "bold",
                                align: "end"
                            }
                        ]
                    }
                ],
                paddingAll: "20px"
            },
            styles: {
                footer: {
                    separator: true
                }
            }
        }
    };
}

// 匯出函式 (注意：查詢用的函式名稱改為 generateOverviewFlex)
module.exports = { generateOverviewFlex, generateCreateSuccessFlex };