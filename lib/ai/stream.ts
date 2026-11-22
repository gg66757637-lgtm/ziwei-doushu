import { AiConfigError, requireAiProvider } from './provider';

/** Frontend (ChatPanel / InsightPanel / heming page) expects this exact SSE shape. */
export function frontendDeltaFrame(text: string): string {
  return `data: ${JSON.stringify({ delta: { text } })}\n\n`;
}

export const FRONTEND_DONE = 'data: [DONE]\n\n';

export function jsonErrorResponse(message: string, status = 400): Response {
  return Response.json({ error: message }, { status });
}

function extractDeltaText(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const choice = (payload as { choices?: Array<{ delta?: { content?: unknown } }> }).choices?.[0];
  const content = choice?.delta?.content;
  return typeof content === 'string' ? content : '';
}

/** Translate an OpenAI-compatible SSE stream into `data: {"delta":{"text":...}}` frames. */
export function transformOpenAiSse(body: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  return new ReadableStream({
    async start(controller) {
      const reader = body.getReader();
      let pending = '';
      let closed = false;
      const emit = (chunk: string) => {
        if (!closed) controller.enqueue(encoder.encode(chunk));
      };
      const finish = () => {
        if (closed) return;
        emit(FRONTEND_DONE);
        closed = true;
        controller.close();
      };
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          pending += decoder.decode(value, { stream: true });
          const lines = pending.split('\n');
          pending = lines.pop() ?? '';
          for (const raw of lines) {
            const line = raw.endsWith('\r') ? raw.slice(0, -1) : raw;
            if (!line.startsWith('data:')) continue;
            const data = line.slice(5).trimStart();
            if (data === '[DONE]') {
              finish();
              try { await reader.cancel(); } catch { /* ignore */ }
              return;
            }
            try {
              const text = extractDeltaText(JSON.parse(data));
              if (text) emit(frontendDeltaFrame(text));
            } catch {
              /* skip malformed chunks */
            }
          }
        }
        finish();
      } catch {
        if (!closed) {
          try {
            emit(frontendDeltaFrame('\n\n[解读中断，请稍后重试]'));
          } catch { /* ignore */ }
          finish();
        }
      }
    },
  });
}

export async function streamChatCompletions(params: {
  system: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
}): Promise<Response> {
  let config;
  try {
    config = requireAiProvider();
  } catch (error) {
    const message = error instanceof AiConfigError ? error.message : 'AI 配置错误';
    return jsonErrorResponse(message, 401);
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        stream: true,
        temperature: 0.7,
        messages: [{ role: 'system', content: params.system }, ...params.messages],
      }),
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : '网络错误';
    return jsonErrorResponse(`无法连接 AI 服务（${config.name}）：${detail}`, 502);
  }

  if (!upstream.ok || !upstream.body) {
    const raw = await upstream.text().catch(() => '');
    let detail = raw.slice(0, 300);
    try {
      const parsed = JSON.parse(raw) as { error?: { message?: string }; message?: string };
      detail = parsed.error?.message || parsed.message || detail;
    } catch { /* keep raw slice */ }
    return jsonErrorResponse(
      `AI 服务调用失败（${upstream.status}${detail ? `：${detail}` : ''}）。请检查 ${config.keyEnv} 与模型 ${config.model} 是否可用。`,
      502,
    );
  }

  return new Response(transformOpenAiSse(upstream.body), {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
