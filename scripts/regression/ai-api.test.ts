import assert from 'node:assert/strict';
import { AiConfigError, requireAiProvider, resolveAiProvider } from '../../lib/ai/provider';
import { FRONTEND_DONE, frontendDeltaFrame, transformOpenAiSse } from '../../lib/ai/stream';

async function main() {
  const prev: Record<string, string | undefined> = {};
  const keys = ['AI_PROVIDER', 'ZHIPU_API_KEY', 'DEEPSEEK_API_KEY', 'MIMO_API_KEY', 'MIMO_BASE_URL', 'MIMO_MODEL', 'ZHIPU_MODEL', 'ZHIPU_BASE_URL'];
  for (const key of keys) prev[key] = process.env[key];
  const restore = () => {
    for (const key of keys) {
      if (prev[key] === undefined) delete process.env[key];
      else process.env[key] = prev[key];
    }
  };

  try {
    delete process.env.AI_PROVIDER;
    delete process.env.ZHIPU_API_KEY;
    const cfg = resolveAiProvider();
    assert.equal(cfg.name, 'zhipu');
    assert.equal(cfg.baseUrl, 'https://open.bigmodel.cn/api/paas/v4');
    assert.equal(cfg.model, 'glm-4-flash-250414');
    assert.equal(cfg.keyEnv, 'ZHIPU_API_KEY');
    assert.equal(cfg.apiKey, '');
    assert.throws(() => requireAiProvider(), (err: unknown) => {
      assert.ok(err instanceof AiConfigError);
      assert.match((err as Error).message, /ZHIPU_API_KEY/);
      return true;
    });
    console.log('✓ default provider is zhipu / glm-4-flash-250414; missing key throws clearly');

    assert.equal(frontendDeltaFrame('你好'), 'data: {"delta":{"text":"你好"}}\n\n');
    assert.equal(FRONTEND_DONE, 'data: [DONE]\n\n');

    const upstream = new ReadableStream<Uint8Array>({
      start(controller) {
        const enc = new TextEncoder();
        controller.enqueue(enc.encode('data: {"choices":[{"delta":{"content":"你好"}}]}\n\n'));
        controller.enqueue(enc.encode('data: {"choices":[{"delta":{"content":"世界"}}]}\n\n'));
        controller.enqueue(enc.encode('data: [DONE]\n\n'));
        controller.close();
      },
    });
    const transformed = await new Response(transformOpenAiSse(upstream)).text();
    assert.equal(
      transformed,
      'data: {"delta":{"text":"你好"}}\n\ndata: {"delta":{"text":"世界"}}\n\ndata: [DONE]\n\n',
    );
    console.log('✓ OpenAI SSE is rewritten to frontend delta.text frames + [DONE]');
  } finally {
    restore();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
