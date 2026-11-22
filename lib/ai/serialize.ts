import { BRANCHES, SHICHEN, STEMS } from '@/lib/ziwei/constants';
import {
  HEMING_SCORE_CRITERIA,
  MARRIAGE_STARS_BRIEF,
  SIHUA_IN_FUQI_GU,
  STAR_IN_FUQI_GU,
} from '@/lib/ziwei/heming-knowledge';
import { detectPatterns, getMingGongSummary, type Pattern } from '@/lib/ziwei/patterns';
import type { Palace, Star, ZiweiChart } from '@/lib/ziwei/types';

const LEVEL_RANK: Record<Pattern['level'], number> = {
  excellent: 0,
  good: 1,
  caution: 2,
  neutral: 3,
};

function ganZhi(stem: number, branch: number): string {
  return `${STEMS[stem] ?? stem}${BRANCHES[branch] ?? branch}`;
}

function formatStar(star: Star): string {
  let text = star.name;
  if (star.brightnessRaw) text += star.brightnessRaw;
  else if (star.brightness === 'bright') text += '亮';
  else if (star.brightness === 'dim') text += '陷';
  if (star.siHua) text += `[${star.siHua}]`;
  return text;
}

function formatPalace(palace: Palace): string {
  const flags = [
    palace.isMingGong ? '命' : '',
    palace.isShenGong ? '身' : '',
    palace.isCurrentDaXian ? '本限' : '',
    palace.isEmpty && palace.borrowedFromName ? `借${palace.borrowedFromName}` : '',
  ].filter(Boolean);
  const stars = palace.stars.map(formatStar).join('、') || '空';
  const self = palace.selfSihua?.map(mark => `${mark.starName}自化${mark.siHua}`).join('、');
  const daXian = palace.daXianAge ? `大限${palace.daXianAge[0]}-${palace.daXianAge[1]}岁` : '';
  const flagText = flags.length ? ` ${flags.join('/')}` : '';
  return `${palace.name}(${ganZhi(palace.stem, palace.branch)}${flagText}): ${stars}${self ? `；${self}` : ''}${daXian ? `；${daXian}` : ''}`;
}

function palaceByName(chart: ZiweiChart, name: string): Palace | undefined {
  return chart.palaces.find(palace => palace.name === name);
}

/** Compact, token-conscious serialization of a computed chart. */
export function serializeChart(chart: ZiweiChart, label = ''): string {
  const birth = chart.birthInfo;
  const lunar = chart.lunarInfo;
  const hourName = SHICHEN[birth.hour]?.name ?? `时辰${birth.hour}`;
  const gender = birth.gender === 'male' ? '男' : '女';
  const header = [
    label ? `【${label}】` : '',
    birth.name ? `姓名:${birth.name}` : '',
    `公历${birth.year}-${birth.month}-${birth.day} ${hourName}`,
    birth.city ? `出生地:${[birth.province, birth.city].filter(Boolean).join('')}` : '',
    chart.yinYangGender ?? gender,
    `五行局:${chart.wuxingJuName}`,
    chart.mingZhu ? `命主:${chart.mingZhu}` : '',
    chart.shenZhu ? `身主:${chart.shenZhu}` : '',
    `当前${chart.currentAge}岁`,
  ].filter(Boolean).join('，');

  const lunarLine = `农历${lunar.lunarYear}年${lunar.isLeapMonth ? '闰' : ''}${Math.abs(lunar.lunarMonth)}月${lunar.lunarDay}日 年柱${ganZhi(lunar.yearStem, lunar.yearBranch)}`;
  const jieqi = lunar.fourPillars ? `节气四柱:${lunar.fourPillars.join(' ')}` : '';
  const nongli = lunar.fourPillarsLunar ? `农历四柱:${lunar.fourPillarsLunar.join(' ')}` : '';

  const current = chart.daXians[chart.currentDaXianIndex];
  const daXianLine = current
    ? `当前大限:${current.startAge}-${current.endAge}岁 ${current.palaceName}${
        current.siHua
          ? ` 四化禄${current.siHua.lu}权${current.siHua.quan}科${current.siHua.ke}忌${current.siHua.ji}`
          : ''
      }`
    : '';

  const palaces = chart.palaces.map(formatPalace).join('\n');
  return [header, lunarLine, jieqi, nongli, daXianLine, '十二宫:', palaces].filter(Boolean).join('\n');
}

export function formatMatchedPatterns(chart: ZiweiChart, limit = 8): string {
  let patterns: Pattern[] = [];
  try {
    patterns = detectPatterns(chart);
  } catch {
    return '（格局识别失败，仅根据盘面星曜解读）';
  }
  const ranked = [...patterns]
    .sort((a, b) => (LEVEL_RANK[a.level] ?? 9) - (LEVEL_RANK[b.level] ?? 9))
    .slice(0, limit);
  if (!ranked.length) return '（未识别出显著格局）';

  return ranked.map(pattern => {
    const cond = pattern.conditions;
    const extra = [
      cond?.required?.length ? `成立:${cond.required.join('/')}` : '',
      cond?.bonus?.length ? `加分:${cond.bonus.join('/')}` : '',
      cond?.breaking?.length ? `破格:${cond.breaking.join('/')}` : '',
    ].filter(Boolean).join('；');
    const desc = pattern.description.length > 80
      ? `${pattern.description.slice(0, 80)}…`
      : pattern.description;
    return `- ${pattern.name}[${pattern.level}]（${pattern.palaces.join('、')}）：${desc}${extra ? `。${extra}` : ''}${pattern.source ? ` 出典:${pattern.source}` : ''}`;
  }).join('\n');
}

export function formatMingSummary(chart: ZiweiChart): string {
  try {
    const summary = getMingGongSummary(chart);
    return `命宫主星:${summary.stars.join('、') || '空宫'}；性质:${summary.nature || '—'}；关键词:${summary.keywords.join('、') || '—'}`;
  } catch {
    return '';
  }
}

/** Inject only knowledge that matches stars in 命/夫妻/福德 palaces, to keep prompts short. */
export function hemingKnowledgeSnippet(chartA: ZiweiChart, chartB: ZiweiChart): string {
  const watched = new Set<string>();
  for (const chart of [chartA, chartB]) {
    for (const name of ['命宫', '夫妻宫', '福德宫'] as const) {
      palaceByName(chart, name)?.stars.forEach(star => watched.add(star.name));
    }
  }

  const starBlocks: string[] = [];
  for (const name of watched) {
    const info = STAR_IN_FUQI_GU[name];
    if (info) {
      starBlocks.push(
        `${name}在夫妻宫：${info.summary}。吉：${info.good}。留意：${info.bad}。配偶特质：${info.spouse_traits}。婚期：${info.timing}`,
      );
    }
    const brief = MARRIAGE_STARS_BRIEF[name];
    if (brief) starBlocks.push(`${name}：${brief}`);
  }

  const sihuaLines: string[] = [];
  for (const [label, chart] of [['甲', chartA], ['乙', chartB]] as const) {
    const palaces = [palaceByName(chart, '夫妻宫'), palaceByName(chart, '福德宫')];
    const seen = new Set<string>();
    for (const palace of palaces) {
      for (const star of palace?.stars ?? []) {
        if (!star.siHua) continue;
        const key = `化${star.siHua}` as keyof typeof SIHUA_IN_FUQI_GU;
        if (seen.has(key) || !SIHUA_IN_FUQI_GU[key]) continue;
        seen.add(key);
        sihuaLines.push(`${label}方${palace?.name}有${key}：${SIHUA_IN_FUQI_GU[key]}`);
      }
    }
  }

  const scores = Object.entries(HEMING_SCORE_CRITERIA)
    .map(([key, value]) => `${key}：${value}`)
    .join('；');

  const method = [
    '合盘须同时看双方命宫、夫妻宫、福德宫（传统口诀：光看夫妻宫会漏掉感情能否长久）。',
    '天作之合：甲方夫妻宫主星=乙方命宫主星，且反向亦然。次级：单向对应，或星性互补、大限同旺。',
    '步骤：1)命格是否般配 2)夫妻宫互参与四化 3)太阳（女看伴侣）太阴（男看伴侣）庙旺或落陷 4)生年四化飞入对方盘的含义 5)当前大限是否同旺。',
    `匹配度参考：${scores}`,
  ].join('');

  return [method, sihuaLines.join('\n'), starBlocks.join('\n')].filter(Boolean).join('\n');
}
