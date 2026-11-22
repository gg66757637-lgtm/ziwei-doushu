import { buildInterpretSystem } from '@/lib/ai/prompts';
import { jsonErrorResponse, streamChatCompletions } from '@/lib/ai/stream';
import type { ZiweiChart } from '@/lib/ziwei/types';

interface InterpretBody {
  chart?: ZiweiChart;
  messages?: Array<{ role?: string; content?: string }>;
}

function normalizeMessages(
  raw: InterpretBody['messages'],
): Array<{ role: 'user' | 'assistant'; content: string }> {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is { role: 'user' | 'assistant'; content: string } =>
      (item?.role === 'user' || item?.role === 'assistant') &&
      typeof item.content === 'string' &&
      item.content.trim().length > 0,
    )
    .map(item => ({ role: item.role, content: item.content }))
    .slice(-16);
}

export async function POST(req: Request): Promise<Response> {
  let body: InterpretBody;
  try {
    body = await req.json();
  } catch {
    return jsonErrorResponse('请求体不是合法 JSON', 400);
  }

  if (!body.chart || !Array.isArray(body.chart.palaces)) {
    return jsonErrorResponse('请提供完整的 chart（含十二宫）', 400);
  }

  const messages = normalizeMessages(body.messages);
  if (!messages.length || messages[messages.length - 1]?.role !== 'user') {
    return jsonErrorResponse('messages 至少需要一条用户提问', 400);
  }

  return streamChatCompletions({
    system: buildInterpretSystem(body.chart),
    messages,
  });
}
