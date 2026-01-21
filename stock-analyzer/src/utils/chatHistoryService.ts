/**
 * 对话历史服务
 * 与后端 chatHistoryServer.js 通信
 */

const CHAT_HISTORY_API = 'http://localhost:3001/api/chat-history';

export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
}

/**
 * 加载股票的对话历史
 */
export async function loadChatHistory(stockCode: string, stockName: string): Promise<ChatMessage[]> {
    try {
        const response = await fetch(
            `${CHAT_HISTORY_API}/${encodeURIComponent(stockCode)}?stockName=${encodeURIComponent(stockName)}`
        );

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        return data.success ? data.messages : [];
    } catch (err) {
        console.warn('加载对话历史失败，可能是后端服务未启动:', err);
        return [];
    }
}

/**
 * 保存一条对话消息
 */
export async function saveChatMessage(
    stockCode: string,
    stockName: string,
    role: 'user' | 'assistant',
    content: string
): Promise<boolean> {
    try {
        const timestamp = new Date().toLocaleString('zh-CN', {
            hour12: false,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });

        const response = await fetch(
            `${CHAT_HISTORY_API}/${encodeURIComponent(stockCode)}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ stockName, role, content, timestamp })
            }
        );

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        return data.success;
    } catch (err) {
        console.warn('保存对话消息失败:', err);
        return false;
    }
}

/**
 * 清除股票的对话历史
 */
export async function clearChatHistory(stockCode: string, stockName: string): Promise<boolean> {
    try {
        const response = await fetch(
            `${CHAT_HISTORY_API}/${encodeURIComponent(stockCode)}?stockName=${encodeURIComponent(stockName)}`,
            { method: 'DELETE' }
        );

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        return data.success;
    } catch (err) {
        console.warn('清除对话历史失败:', err);
        return false;
    }
}
