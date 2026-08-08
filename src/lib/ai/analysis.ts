import type { HandoverInput, RiskLevel, StructuredNote } from "../types";

/**
 * 入力テキストから臨床的な事実を抽出するための解析ユーティリティ。
 * モックAIエンジンと、将来の実AI連携時のプロンプト組み立ての双方から利用する。
 */

const LEVEL_ORDER: Record<RiskLevel, number> = { LOW: 0, MEDIUM: 1, HIGH: 2 };

export const maxLevel = (a: RiskLevel, b: RiskLevel): RiskLevel =>
  LEVEL_ORDER[a] >= LEVEL_ORDER[b] ? a : b;

export const compareLevelDesc = (a: RiskLevel, b: RiskLevel): number =>
  LEVEL_ORDER[b] - LEVEL_ORDER[a];

/** 全角数字を半角へ変換する。 */
const normalizeDigits = (value: string): string =>
  value.replace(/[０-９]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0xfee0),
  );

/** 文字列の先頭に現れる数値を取り出す。取れない場合は null。 */
export const firstNumber = (value: string | undefined): number | null => {
  if (!value) return null;
  const match = normalizeDigits(value).match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
};

/**
 * 「SpO2 93%未満で酸素開始」「38.0℃以上でカロナール」のような
 * 医師指示の基準値を、実測値として拾わないための判定。
 */
const THRESHOLD_SUFFIX =
  /^\s*(?:%|℃|度|回|mmHg)?\s*(?:未満|以上|以下|より|を?下回|を?上回|を?超)/;

const isThresholdValue = (text: string, endIndex: number): boolean =>
  THRESHOLD_SUFFIX.test(text.slice(endIndex, endIndex + 8));

/** 正規表現に一致した数値をすべて取り出す（医師指示の基準値は除外）。 */
const allNumbers = (text: string, pattern: RegExp): number[] => {
  const normalized = normalizeDigits(text);
  const values: number[] = [];
  for (const match of normalized.matchAll(pattern)) {
    const parsed = Number(match[1]);
    if (!Number.isFinite(parsed)) continue;
    if (
      match.index !== undefined &&
      isThresholdValue(normalized, match.index + match[0].length)
    ) {
      continue;
    }
    values.push(parsed);
  }
  return values;
};

/** 与えたキーワードのうち、テキストに含まれるものを返す。 */
export const matchedKeywords = (text: string, keywords: string[]): string[] =>
  keywords.filter((keyword) => text.includes(keyword));

export const structuredToText = (structured: StructuredNote): string => {
  const { vitals, ...rest } = structured;
  const vitalText = [
    vitals.temperature && `体温 ${vitals.temperature}℃`,
    vitals.bloodPressure && `血圧 ${vitals.bloodPressure}`,
    vitals.pulse && `脈拍 ${vitals.pulse}`,
    vitals.spo2 && `SpO2 ${vitals.spo2}%`,
    vitals.respiratoryRate && `呼吸数 ${vitals.respiratoryRate}`,
  ]
    .filter(Boolean)
    .join(" / ");

  const labels: Record<keyof Omit<StructuredNote, "vitals">, string> = {
    consciousness: "意識状態",
    pain: "疼痛",
    mealIntake: "食事摂取量",
    fluidIntake: "水分摂取",
    elimination: "排泄",
    sleep: "睡眠",
    infusion: "点滴",
    medication: "内服",
    treatment: "処置",
    examination: "検査",
    doctorOrder: "医師指示",
    family: "家族対応",
    other: "その他注意事項",
  };

  const lines = (
    Object.keys(labels) as Array<keyof Omit<StructuredNote, "vitals">>
  )
    .map((key) => {
      const value = rest[key]?.trim();
      return value ? `${labels[key]}: ${value}` : "";
    })
    .filter(Boolean);

  return [vitalText && `バイタル: ${vitalText}`, ...lines]
    .filter(Boolean)
    .join("\n");
};

/**
 * 医師指示から読み取れる基準値。
 * AIが独自の閾値を作らないよう、あくまで「入力されたテキストに書かれている値」だけを抽出する。
 */
export interface OrderThresholds {
  /** 医師指示の原文（改変せずそのまま保持する） */
  raw: string;
  /** 「SpO2 93%未満で〜」の 93 */
  spo2Below: number | null;
  /** 表示用の原文表記（"93" など、入力の書き方をそのまま使う） */
  spo2BelowText: string | null;
  /** 「38.0℃以上で〜」の 38.0 */
  temperatureAtOrAbove: number | null;
  /** 表示用の原文表記（"38.0" など） */
  temperatureAtOrAboveText: string | null;
}

export const extractOrderThresholds = (doctorOrder: string): OrderThresholds => {
  const raw = doctorOrder.trim();
  const text = normalizeDigits(raw);
  const spo2Match = text.match(
    /spo2[^0-9]{0,8}(\d{2,3})\s*%?\s*(?:未満|以下|を?下回)/i,
  );
  const tempMatch = text.match(/(\d{2}(?:\.\d)?)\s*(?:℃|度)\s*(?:以上|を?超)/);

  return {
    raw,
    spo2Below: spo2Match ? Number(spo2Match[1]) : null,
    spo2BelowText: spo2Match ? spo2Match[1] : null,
    temperatureAtOrAbove: tempMatch ? Number(tempMatch[1]) : null,
    // 入力が「38.0℃」なら「38」に丸めず、そのままの表記で提示する。
    temperatureAtOrAboveText: tempMatch ? tempMatch[1] : null,
  };
};

/** 文（。・改行区切り）へ分割する。 */
const splitSentences = (text: string): string[] =>
  text
    .split(/[。\n]/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);

/**
 * 時系列として低下していると言えるか。
 * 値が2つ以上あり、最後の値が最初の値より明確に低い場合のみ true。
 * 単一の測定値から「低下傾向」と表現しないための判定。
 */
export const isDecreasingSeries = (
  series: number[],
  minimumDrop = 1,
): boolean =>
  series.length >= 2 && series[0] - series[series.length - 1] >= minimumDrop;

export interface ClinicalFacts {
  /** 解析対象テキスト（自由記載＋構造化入力） */
  text: string;
  /**
   * 観察内容のテキスト（医師指示を除いた自由記載＋構造化入力）。
   * 「SpO2 93%未満で酸素開始」のような条件付きの指示文を、
   * 実際に観察された所見として拾わないためにキーワード判定へ使う。
   */
  observationText: string;
  /** 最高体温（℃） */
  peakTemperature: number | null;
  /** 直近の体温（℃） */
  currentTemperature: number | null;
  /** 自由記載に現れた体温を記載順に並べたもの（時系列判定用） */
  temperatureSeries: number[];
  /** 解熱の記載があるか */
  defervescence: boolean;
  /** 最低SpO2（%） */
  minSpo2: number | null;
  /** 構造化入力のSpO2（現在値として扱う） */
  currentSpo2: number | null;
  /** 自由記載に現れたSpO2を記載順に並べたもの（時系列判定用） */
  spo2Series: number[];
  /** 医師指示から読み取れた基準値 */
  orderThresholds: OrderThresholds;
  respiratoryRate: number | null;
  systolicBp: number | null;
  diastolicBp: number | null;
  pulse: number | null;
  /** 食事摂取量（割） */
  mealFraction: number | null;
  /** 水分摂取量の合計（ml） */
  fluidMl: number | null;
  /** 疼痛スケール NRS の最大値 */
  maxNrs: number | null;
  /** 排尿回数 */
  urineCount: number | null;
  bloodGlucose: number | null;
  hasInput: boolean;
}

export const extractFacts = (input: HandoverInput): ClinicalFacts => {
  const { freeText, structured } = input;
  const text = normalizeDigits(
    [freeText, structuredToText(structured)].filter(Boolean).join("\n"),
  );
  // 医師指示は「条件付きの指示」であって観察結果ではないため、キーワード判定からは除く。
  const observationText = normalizeDigits(
    [freeText, structuredToText({ ...structured, doctorOrder: "" })]
      .filter(Boolean)
      .join("\n"),
  );

  const vitalTemp = firstNumber(structured.vitals.temperature);
  const textTemps = allNumbers(text, /(\d{2}(?:\.\d)?)\s*(?:℃|度)/g).filter(
    (value) => value >= 33 && value <= 43,
  );
  const freeTextTemps = allNumbers(
    freeText,
    /(\d{2}(?:\.\d)?)\s*(?:℃|度)/g,
  ).filter((value) => value >= 33 && value <= 43);
  const allTemps = [...textTemps, ...(vitalTemp !== null ? [vitalTemp] : [])];

  const vitalSpo2 = firstNumber(structured.vitals.spo2);
  /*
   * SpO2 に言及している文に含まれる「NN%」を記載順にすべて拾う。
   * 例:「SpO2 room air 91%まで低下し、酸素1L/分開始後 94%へ改善」→ [91, 94]
   * 時系列で低下しているかを判定するため、自由記載のみを対象とする。
   */
  const textSpo2 = splitSentences(freeText)
    .filter((sentence) => /spo2|サチュレーション/i.test(sentence))
    .flatMap((sentence) => allNumbers(sentence, /(\d{2,3})\s*%/g))
    .filter((value) => value >= 50 && value <= 100);
  const allSpo2 = [...textSpo2, ...(vitalSpo2 !== null ? [vitalSpo2] : [])];

  const bpSource = structured.vitals.bloodPressure || text;
  const bpMatch = normalizeDigits(bpSource).match(/(\d{2,3})\s*\/\s*(\d{2,3})/);

  const mealSource = `${structured.mealIntake}\n${freeText}`;
  const mealFractions = allNumbers(
    normalizeDigits(mealSource),
    /(\d{1,2})\s*割/g,
  ).filter((value) => value >= 0 && value <= 10);

  const fluidSource = `${structured.fluidIntake}`;
  const fluidValues = allNumbers(normalizeDigits(fluidSource), /(\d{2,4})\s*ml/gi);

  const nrsValues = allNumbers(
    text.toLowerCase(),
    /nrs[^0-9]{0,4}(\d{1,2})/g,
  ).filter((value) => value <= 10);

  const urineMatch = normalizeDigits(
    `${structured.elimination}\n${freeText}`,
  ).match(/排尿\s*(\d{1,2})\s*回/);

  const glucoseMatch = normalizeDigits(text).match(/血糖\s*[:：]?\s*(\d{2,3})/);

  return {
    text,
    observationText,
    peakTemperature: allTemps.length ? Math.max(...allTemps) : null,
    currentTemperature:
      vitalTemp ?? (textTemps.length ? textTemps[textTemps.length - 1] : null),
    temperatureSeries: freeTextTemps,
    defervescence: /解熱|下がっ|平熱/.test(text),
    minSpo2: allSpo2.length ? Math.min(...allSpo2) : null,
    currentSpo2: vitalSpo2 ?? (textSpo2.length ? textSpo2[textSpo2.length - 1] : null),
    spo2Series: textSpo2,
    orderThresholds: extractOrderThresholds(structured.doctorOrder),
    respiratoryRate: firstNumber(structured.vitals.respiratoryRate),
    systolicBp: bpMatch ? Number(bpMatch[1]) : null,
    diastolicBp: bpMatch ? Number(bpMatch[2]) : null,
    pulse: firstNumber(structured.vitals.pulse),
    mealFraction: mealFractions.length ? Math.min(...mealFractions) : null,
    fluidMl: fluidValues.length
      ? fluidValues.reduce((sum, value) => sum + value, 0)
      : null,
    maxNrs: nrsValues.length ? Math.max(...nrsValues) : null,
    urineCount: urineMatch ? Number(urineMatch[1]) : null,
    bloodGlucose: glucoseMatch ? Number(glucoseMatch[1]) : null,
    hasInput: text.trim().length > 0,
  };
};
