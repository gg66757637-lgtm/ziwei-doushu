import type { ZiweiChart } from '@/lib/ziwei/types';
import {
  formatMatchedPatterns,
  formatMingSummary,
  hemingKnowledgeSnippet,
  serializeChart,
} from './serialize';

const ENTERTAINMENT_RULES = `你是一位通俗易懂、轻松友好的紫微斗数娱乐解读助手。根据下面提供的命盘摘要和已匹配的传统格局来回答。

写作要求：
- 用口语化中文，少堆术语；出现术语时随手解释一句。
- 只依据给定的命盘与格局，不编造盘中没有的星曜或格局。
- 这是娱乐向的性格 / 事业 / 感情趣味分析，不是真实命运预测。不要做绝对化、恐吓或「必然发生」的断语；涉及传统忌讳组合时，改写成温和的相处提醒。
- 可以点名已匹配格局，并用白话说明大意。
- 回答结尾必须另起一行写：【本解读仅供娱乐参考，不构成任何决策建议。】`;

export function buildInterpretSystem(chart: ZiweiChart): string {
  const summary = formatMingSummary(chart);
  return `${ENTERTAINMENT_RULES}

命盘摘要：
${serializeChart(chart)}
${summary ? `\n${summary}` : ''}

已按本盘匹配的格局（请优先引用，勿全盘罗列）：
${formatMatchedPatterns(chart)}`;
}

export function buildHemingSystem(chartA: ZiweiChart, chartB: ZiweiChart): string {
  return `${ENTERTAINMENT_RULES}

本次是两人合盘的娱乐向分析。请同时对照双方命宫、夫妻宫、福德宫，说明相处模式、互补点与需要沟通的地方。若用户提了具体问题，请先回答该问题，再补一段简短的整体印象。

甲方命盘：
${serializeChart(chartA, '甲方')}
${formatMingSummary(chartA)}

甲方已匹配格局：
${formatMatchedPatterns(chartA)}

乙方命盘：
${serializeChart(chartB, '乙方')}
${formatMingSummary(chartB)}

乙方已匹配格局：
${formatMatchedPatterns(chartB)}

合盘知识（仅注入与双方命/夫妻/福德相关的条目）：
${hemingKnowledgeSnippet(chartA, chartB)}`;
}
