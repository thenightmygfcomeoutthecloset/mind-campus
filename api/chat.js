/**
 * api/chat.js — Vercel Serverless Function 转发接口
 * 负责：安全隐藏 DeepSeek API Key、服务端高危心理危机拦截、调用 DeepSeek Chat Completion 并强制输出结构化 JSON
 * 作者：吴磊
 */

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

// 兜底回复（用于未配置 API Key 或网络波动时的优雅演示）
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

export default async function handler(req, res) {
  // 设置 CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed, please use POST' });
  }

  try {
    const { messages } = req.body || {};
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array is required' });
    }

    const lastMessage = messages[messages.length - 1];
    const userText = lastMessage ? lastMessage.content : '';

    // 1. 服务端危机关键词拦截
    if (checkCrisis(userText)) {
      return res.status(200).json(getCrisisSafetyResponse());
    }

    // 2. 检查 DeepSeek API Key
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey || apiKey === 'your_deepseek_api_key_here') {
      console.warn('[api/chat] 未配置 DEEPSEEK_API_KEY，返回高质量模拟演示数据');
      return res.status(200).json(getFallbackResponse(userText));
    }

    // 3. 调用 DeepSeek 官方 API
    const response = await fetch('https://api.deepseek.com/chat/completions', {
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

    if (!response.ok) {
      const errText = await response.text();
      console.error('[api/chat] DeepSeek API 请求失败:', response.status, errText);
      return res.status(200).json(getFallbackResponse(userText));
    }

    const data = await response.json();
    const rawContent = data.choices && data.choices[0] && data.choices[0].message
      ? data.choices[0].message.content
      : '';

    try {
      const parsed = JSON.parse(rawContent);
      return res.status(200).json(parsed);
    } catch (parseErr) {
      console.error('[api/chat] JSON 解析失败，原文为:', rawContent);
      return res.status(200).json(getFallbackResponse(userText));
    }

  } catch (err) {
    console.error('[api/chat] 服务器内部异常:', err);
    return res.status(200).json(getFallbackResponse(''));
  }
}
