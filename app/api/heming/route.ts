import { buildHemingSystem } from '@/lib/ai/prompts';
import { jsonErrorResponse, streamChatCompletions } from '@/lib/ai/stream';
import type { ZiweiChart } from '@/lib/ziwei/types';

interface HemingBody {
  chartA?: ZiweiChart;
  chartB?: ZiweiChart;
  question?: string;
}

function isChart(value: ZiweiChart | undefined): value is ZiweiChart {
  return !!value && Array.isArray(value.palaces);
}

export async function POST(req: Request): Promise<Response> {
  let body: HemingBody;
  try {
    body = await req.json();
  } catch {
    return jsonErrorResponse('请求体不是合法 JSON', 400);
  }

  if (!isChart(body.chartA) || !isChart(body.chartB)) {
    return jsonErrorResponse('请提供双方完整命盘 chartA 与 chartB', 400);
  }

  const question = typeof body.question === 'string' ? body.question.trim() : '';
  const userText = question || '请综合分析两人的缘分匹配、相处模式与注意事项。';

  return streamChatCompletions({
    system: buildHemingSystem(body.chartA, body.chartB),
    messages: [{ role: 'user', content: userText }],
  });
}
