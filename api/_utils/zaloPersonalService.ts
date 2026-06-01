/**
 * Zalo Personal Bot API Service
 * Xử lý kết nối gửi tin nhắn thông qua API của Zalo Bot Platform.
 * 
 * Dựa trên tài liệu bot.zaloplatforms.com, API có signature tương đồng với Telegram Bot API:
 * POST https://api.zaloplatforms.com/bot<TOKEN>/sendMessage
 * Payload: { "chat_id": "<ZALO_USER_ID>", "text": "<MESSAGE_CONTENT>" }
 */

const API_BASE_URL = 'https://api.zaloplatforms.com'; 
// Thay đổi giá trị này nếu hệ thống API chính thức có đường dẫn khác (ví dụ: https://openapi.zalo.me)

export const sendPersonalZaloMessage = async (
    botToken: string,
    receiverId: string,
    message: string
) => {
    if (!botToken) {
        throw new Error('Chưa cấu hình Zalo Bot Token');
    }

    // Endpoint theo format API Bot
    const url = `${API_BASE_URL}/bot${botToken}/sendMessage`;
    
    console.log(`[Zalo Bot API] Sending message to ${receiverId} via ${url}`);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                chat_id: receiverId,
                text: message,
            }),
        });

        const data = await response.json();
        
        if (!response.ok || !data.ok) {
            console.error('[Zalo Bot API] Failed response:', data);
            throw new Error(data.description || data.error_message || 'Lỗi gửi tin Zalo Bot');
        }

        return data;
    } catch (error: any) {
        console.error('[Zalo Bot API] Exception:', error.message);
        throw error;
    }
};
