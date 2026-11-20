/**
 * Local LLM AI Translation Client
 * Supports LM Studio (http://localhost:1234/v1/chat/completions)
 * and Ollama (http://localhost:11434/api/chat)
 * for zero-cloud, 100% offline, privacy-first novel translation.
 */

export interface LLMConfig {
  endpoint: string;
  model: string;
  temperature: number;
  apiKey?: string;
}

export const DEFAULT_LLM_CONFIG: LLMConfig = {
  endpoint: 'http://localhost:1234/v1/chat/completions',
  model: 'qwen2.5-7b-instruct',
  temperature: 0.3
};

const SYSTEM_TRANSLATION_PROMPT = `Bạn là một dịch giả tiểu thuyết chuyên nghiệp có văn phong mượt mà, thuần Việt, chuẩn kiếm hiệp/tiên hiệp/ngôn tình.
Nhiệm vụ: Dịch văn bản truyện từ tiếng Trung (hoặc tiếng Anh) sang tiếng Việt.
Yêu cầu:
1. Dịch chuẩn nghĩa, giữ nguyên tên riêng Hán Việt, không dịch thô ngữ cảnh (convert/convert thô).
2. Tách đoạn rõ ràng, tự nhiên.
3. Chỉ trả về kết quả dịch, tuyệt đối không thêm lời bình hay ghi chú của người dịch.`;

export async function translateWithLocalLLM(
  text: string,
  config: LLMConfig = DEFAULT_LLM_CONFIG
): Promise<string> {
  if (!text.trim()) return '';

  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (config.apiKey) {
    headers['Authorization'] = `Bearer ${config.apiKey}`;
  }

  const payload = {
    model: config.model,
    messages: [
      { role: 'system', content: SYSTEM_TRANSLATION_PROMPT },
      { role: 'user', content: `Hãy dịch đoạn truyện sau sang tiếng Việt:\n\n${text}` }
    ],
    temperature: config.temperature,
    stream: false
  };

  const response = await fetch(config.endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Lỗi kết nối Local LLM (Mã HTTP ${response.status}): Hãy đảm bảo LM Studio hoặc Ollama đang bật tại ${config.endpoint}`);
  }

  const data = await response.json();
  const translatedContent = data.choices?.[0]?.message?.content || data.message?.content || '';
  return translatedContent.trim();
}

export async function checkLocalLLMStatus(endpoint: string = DEFAULT_LLM_CONFIG.endpoint): Promise<boolean> {
  try {
    const url = new URL(endpoint);
    const healthUrl = `${url.protocol}//${url.host}/v1/models`;
    const res = await fetch(healthUrl, { method: 'GET', signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}
