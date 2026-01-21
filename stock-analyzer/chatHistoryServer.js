/**
 * 对话历史服务器
 * 提供读写本地对话历史文件的API
 */

import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// 对话历史存储目录（保存在项目根目录下的 chat_history 文件夹）
const CHAT_HISTORY_DIR = path.join(__dirname, '..', 'chat_history');

// 静态文件目录（前端构建产物）
const DIST_DIR = path.join(__dirname, 'dist');

app.use(cors());
app.use(express.json());

// 确保目录存在
async function ensureDir() {
  try {
    await fs.mkdir(CHAT_HISTORY_DIR, { recursive: true });
  } catch (err) {
    // 目录已存在，忽略
  }
}

// 获取文件名
function getFileName(stockCode, stockName) {
  // 移除文件名中的非法字符
  const safeName = stockName.replace(/[<>:"/\\|?*]/g, '_');
  return `${stockCode} - ${safeName}.txt`;
}

// 读取对话历史
app.get('/api/chat-history/:stockCode', async (req, res) => {
  try {
    await ensureDir();
    const { stockCode } = req.params;
    const { stockName } = req.query;

    const fileName = getFileName(stockCode, stockName || stockCode);
    const filePath = path.join(CHAT_HISTORY_DIR, fileName);

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      // 解析txt内容为消息数组
      const messages = parseHistoryFile(content);
      res.json({ success: true, messages });
    } catch (err) {
      if (err.code === 'ENOENT') {
        // 文件不存在，返回空数组
        res.json({ success: true, messages: [] });
      } else {
        throw err;
      }
    }
  } catch (err) {
    console.error('读取历史失败:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 追加对话消息
app.post('/api/chat-history/:stockCode', async (req, res) => {
  try {
    await ensureDir();
    const { stockCode } = req.params;
    const { stockName, role, content, timestamp } = req.body;

    const fileName = getFileName(stockCode, stockName || stockCode);
    const filePath = path.join(CHAT_HISTORY_DIR, fileName);

    // 格式化消息
    const time = timestamp || new Date().toLocaleString('zh-CN', {
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    const roleLabel = role === 'user' ? '用户' : 'AI';
    const entry = `\n=== ${time} ===\n[${roleLabel}] ${content}\n`;

    // 追加到文件
    await fs.appendFile(filePath, entry, 'utf-8');

    res.json({ success: true });
  } catch (err) {
    console.error('保存消息失败:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 清除对话历史
app.delete('/api/chat-history/:stockCode', async (req, res) => {
  try {
    const { stockCode } = req.params;
    const { stockName } = req.query;

    const fileName = getFileName(stockCode, stockName || stockCode);
    const filePath = path.join(CHAT_HISTORY_DIR, fileName);

    try {
      await fs.unlink(filePath);
      res.json({ success: true });
    } catch (err) {
      if (err.code === 'ENOENT') {
        // 文件不存在也算成功
        res.json({ success: true });
      } else {
        throw err;
      }
    }
  } catch (err) {
    console.error('清除历史失败:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 解析历史文件内容
function parseHistoryFile(content) {
  const messages = [];
  const blocks = content.split(/\n=== /);

  for (const block of blocks) {
    if (!block.trim()) continue;

    // 匹配时间戳和内容
    const match = block.match(/^(.+?) ===\n\[(.+?)\] ([\s\S]*?)$/);
    if (match) {
      const [, timestamp, roleLabel, text] = match;
      messages.push({
        timestamp: timestamp.trim(),
        role: roleLabel === '用户' ? 'user' : 'assistant',
        content: text.trim()
      });
    }
  }

  return messages;
}

// 提供静态文件服务（前端）- 必须在 API 路由之后
app.use(express.static(DIST_DIR));

// SPA 路由支持：所有未匹配的请求返回 index.html（必须最后）
// 注意：Express 5 不支持 app.get('*')，使用 app.use 处理所有未匹配的请求
app.use((req, res, next) => {
  // 如果请求的是 API 路径，跳过
  if (req.path.startsWith('/api/')) {
    return next();
  }
  // 其他所有请求返回 index.html
  res.sendFile(path.join(DIST_DIR, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`股票分析工具运行在 http://0.0.0.0:${PORT}`);
  console.log(`历史文件保存在: ${CHAT_HISTORY_DIR}`);
});
