/**
 * server.js — 心栖校园 (MindCampus) 本地免安装轻量服务
 * 负责：静态文件托管、.env 环境变量读取、POST /api/chat 代理转发与危机兜底
 * 特性：纯原生 Node.js（无需执行 npm install，直接 node server.js 开箱即跑）
 * 作者：吴磊
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

// 1. 原生解析 .env 文件（无需安装 dotenv 依赖）
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    try {
      const content = fs.readFileSync(envPath, 'utf8');
      content.split(/\r?\n/).forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
          const idx = trimmed.indexOf('=');
          const key = trimmed.substring(0, idx).trim();
          const val = trimmed.substring(idx + 1).trim().replace(/^["']|["']$/g, '');
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      });
      console.log('✅ 已成功从 .env 加载环境变量配置');
    } catch (err) {
      console.warn('⚠️ 读取 .env 失败:', err.message);
    }
  } else {
    console.log('💡 未检测到 .env 文件，可在需要接入真实 DeepSeek Key 时创建');
  }
}

loadEnv();

const PORT = parseInt(process.env.PORT || '3000', 10);

// MIME 类型对照表
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8'
};

// 危机关键词检测
const CRISIS_KEYWORDS = [
  '自杀', '自残', '割腕', '跳楼', '服毒', '不想活了', '结束生命',
  '活着没意思', '离开这个世界', '吃安眠药', '上吊', '想死', '绝望厌世',
  '去死', '轻生', '杀了我', '想要死掉', '准备跳下去'
];

function checkCrisis(text) {
  if (!text || typeof text !== 'string') return false;
  const lower = text.toLowerCase();
  return CRISIS_KEYWORDS.some(kw => lower.includes(kw));
}

function getCrisisSafetyResponse() {
  return {
    isCrisis: true,
    emotion: "危机求助",
    emotionLevel: 5,
    scene: "紧急心理危机干预",
    steps: [
      "风险识别：检测到高危心理危机或自伤冲动",
      "安全保护：激活最高级别校园生命守护机制",
      "资源对接：建议直接接入 24 小时专业心理救助热线"
    ],
    reply: "我能深切感受到你此刻承受的痛苦和重量，但请务必记住你的生命无比珍贵。AI 无法替代真实世界中专业老师与医生的关怀，请立刻拨打 12355 或全国心理危机专线 400-161-9995，允许专业倾听者在这个艰难时刻陪你一起渡过。",
    recommendedTool: {
      type: "none",
      title: "请优先拨打紧急求助电话",
      desc: "寻求现实生活中的老师或医生支持"
    },
    dailyQuote: "黑夜再漫长，也请给明天的太阳一个升起的机会。"
  };
}

function getFallbackResponse(userMessage) {
  let emotion = "学业焦虑";
  let toolType = "breathing";
  let toolTitle = "做 1 分钟 4-7-8 呼吸减压";
  let toolDesc = "先让紧绷的身体与神经慢下来";

  if (userMessage.includes("宿舍") || userMessage.includes("室友") || userMessage.includes("朋友")) {
    emotion = "人际困扰";
    toolType = "cbt";
    toolTitle = "尝试 CBT 思维转念练习";
    toolDesc = "重新审视自己对他人的认知预设";
  } else if (userMessage.includes("实习") || userMessage.includes("找工作") || userMessage.includes("offer") || userMessage.includes("未来")) {
    emotion = "未来迷茫";
    toolType = "cbt";
    toolTitle = "尝试认知重构小练习";
    toolDesc = "打破“同辈比较”的自我内耗思维";
  }

  return {
    isCrisis: false,
    emotion: emotion,
    emotionLevel: 3,
    scene: "校园生活与成长挑战",
    steps: [
      "情绪识别：捕捉到困惑与压力信号",
      "场景定位：高校日常学业与人际作息压力",
      "认知疏导：温柔共情接纳 + 建议自助减压工具"
    ],
    reply: "听起来这段经历确实让你感到不轻松。大学生面对繁重的课业、人际与未来的不确定性，感到紧绷是非常正常的生理与心理反应。请允许自己先停下来喘口气，今天哪怕只向前挪动一小步，也已经非常了不起了。",
    recommendedTool: {
      type: toolType,
      title: toolTitle,
      desc: toolDesc
    },
    dailyQuote: "允许自己做一片随风舒展的落叶，不必时时刻刻紧绷。"
  };
}

const SYSTEM_PROMPT = `你是一位面向中国大学生的非诊断型 AI 心理情绪支持专家「心栖伙伴」。
你的职责：
1. 用温柔、平等、接纳、无说教的口吻倾听大学生的苦恼（如期末考试绩点压力、考研考公、秋招春招就业迷茫、宿舍生活人际摩擦、情感恋爱等）。
2. 绝对不做任何医学或精神病理诊断，严禁使用“抑郁症”、“焦虑症”、“双相”等临床诊断词汇。
3. 融入认知行为疗法（CBT）轻量化引导与共情倾听技巧，帮助同学识别认知扭曲，引导自我接纳。
4. 必须输出严格符合规范的 JSON 格式（不要包含 markdown 代码块包裹，直接输出合法 JSON 字符串）。

JSON 字段要求：
{
  "isCrisis": false,
  "emotion": "2-4字情绪标签，如'学业焦虑'、'人际烦躁'、'自我怀疑'、'考研压力'",
  "emotionLevel": 1至5的整数（1最轻微，5最强烈）,
  "scene": "简短场景概括，如'期末考试周绩点焦虑'、'宿舍作息不和'",
  "steps": [
    "第一步分析：情绪识别",
    "第二步分析：场景归因",
    "第三步分析：CBT认知策略"
  ],
  "reply": "100-180字之间温和共情的中文回复，认可对方感受并给出轻量积极转念引导",
  "recommendedTool": {
    "type": "breathing" | "cbt" | "none",
    "title": "建议尝试的具体工具标题",
    "desc": "一句话理由"
  },
  "dailyQuote": "不超过20字的治愈寄语金句"
}`;

// 处理 /api/chat 请求
async function handleChatApi(req, res) {
  let bodyStr = '';
  req.on('data', chunk => {
    bodyStr += chunk;
  });

  req.on('end', async () => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');

    try {
      const parsedBody = bodyStr ? JSON.parse(bodyStr) : {};
      const messages = parsedBody.messages || [];
      const lastMessage = messages[messages.length - 1];
      const userText = lastMessage ? lastMessage.content : '';

      // 1. 危机硬拦截
      if (checkCrisis(userText)) {
        res.writeHead(200);
        res.end(JSON.stringify(getCrisisSafetyResponse()));
        return;
      }

      // 2. 检查 API Key
      const apiKey = process.env.DEEPSEEK_API_KEY;
      if (!apiKey || apiKey === 'your_deepseek_api_key_here') {
        console.log('ℹ️ 未提供真实 DEEPSEEK_API_KEY，使用智能演练兜底模型');
        res.writeHead(200);
        res.end(JSON.stringify(getFallbackResponse(userText)));
        return;
      }

      // 3. 调用 DeepSeek
      if (typeof fetch === 'function') {
        // Node 18+ 原生 fetch
        const dsRes = await fetch('https://api.deepseek.com/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: 'deepseek-chat',
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              ...messages
            ],
            response_format: { type: 'json_object' },
            temperature: 0.7,
            max_tokens: 800
          })
        });

        if (!dsRes.ok) {
          const errText = await dsRes.text();
          console.error('DeepSeek 响应错误:', dsRes.status, errText);
          res.writeHead(200);
          res.end(JSON.stringify(getFallbackResponse(userText)));
          return;
        }

        const dsData = await dsRes.json();
        const rawContent = dsData.choices && dsData.choices[0] && dsData.choices[0].message
          ? dsData.choices[0].message.content
          : '';

        try {
          const finalJson = JSON.parse(rawContent);
          res.writeHead(200);
          res.end(JSON.stringify(finalJson));
        } catch (e) {
          console.error('DeepSeek 输出非规范 JSON，使用兜底:', rawContent);
          res.writeHead(200);
          res.end(JSON.stringify(getFallbackResponse(userText)));
        }
      } else {
        // 老版本 Node 降级兜底
        res.writeHead(200);
        res.end(JSON.stringify(getFallbackResponse(userText)));
      }

    } catch (err) {
      console.error('处理聊天请求异常:', err);
      res.writeHead(200);
      res.end(JSON.stringify(getFallbackResponse('')));
    }
  });
}

// 静态文件托管
function handleStaticFile(req, res) {
  let reqPath = decodeURIComponent(req.url.split('?')[0]);
  if (reqPath === '/') {
    reqPath = '/index.html';
  }

  const filePath = path.join(__dirname, reqPath);

  // 防止目录穿越
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('403 Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
}

// 启动服务器
const server = http.createServer((req, res) => {
  // CORS 处理
  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    res.end();
    return;
  }

  if (req.url.startsWith('/api/chat') && req.method === 'POST') {
    handleChatApi(req, res);
  } else {
    handleStaticFile(req, res);
  }
});

server.listen(PORT, () => {
  console.log('========================================================');
  console.log('🌿「心栖校园 MindCampus」本地服务已启动！');
  console.log(`📡 访问网址: http://localhost:${PORT}`);
  console.log('👥 四人团队模式：代码已就绪，等待队友 Git 推送各自模块');
  console.log('========================================================');
});
