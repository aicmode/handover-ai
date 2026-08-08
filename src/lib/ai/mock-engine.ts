import type {
  HandoverInput,
  NextShiftTask,
  RiskItem,
  RiskLevel,
  Sbar,
} from "../types";
import { hasAllergy } from "../format";
import {
  compareLevelDesc,
  extractFacts,
  isDecreasingSeries,
  matchedKeywords,
  maxLevel,
  type ClinicalFacts,
} from "./analysis";

/**
 * モックAIエンジン。
 * APIキー未設定でもデモできるよう、ルールベースで
 * 確認候補の抽出・SBAR・観察項目・要約を生成する。
 *
 * 設計方針（医療安全）:
 * - 診断・治療方針・看護指示を新たに作らない。
 * - 観察頻度（「4時間ごと」等）や閾値をAI側で決めない。
 *   閾値は「入力済みの医師指示に書かれている値」だけを引用する。
 * - HIGH / MEDIUM / LOW は医学的重症度ではなく「申し送り時の確認優先度」。
 * - 単一の測定値から状態を断定せず、「確認候補」として提示する。
 * - 時系列（過去値と現在値）を混同しない。
 */

interface RiskDraft {
  category: string;
  level: RiskLevel;
  detail: string;
  evidence: string[];
}

const slug = (category: string): string =>
  `risk-${category.replace(/[^\p{Letter}\p{Number}]+/gu, "-")}`;

const formatJaDate = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return `${date.getMonth() + 1}月${date.getDate()}日`;
};

const genderLabel = (gender: HandoverInput["patient"]["gender"]): string =>
  gender === "male" ? "男性" : gender === "female" ? "女性" : "その他";

/* ------------------------------------------------------------------ */
/* 確認候補の抽出                                                      */
/* ------------------------------------------------------------------ */

/**
 * 体温。
 * 過去の発熱記録と現在値を混同しないよう、両方を並べて提示する。
 */
const temperatureCheck = (facts: ClinicalFacts): RiskDraft | null => {
  const feverWords = matchedKeywords(facts.observationText, [
    "発熱",
    "熱発",
    "悪寒",
    "戦慄",
    "解熱",
  ]);
  const peak = facts.peakTemperature;
  const current = facts.currentTemperature;
  if (peak === null && feverWords.length === 0) return null;

  const hasFeverSignal =
    (peak !== null && peak >= 37.5) || feverWords.length > 0;
  if (!hasFeverSignal) return null;

  const evidence: string[] = [];
  if (peak !== null) evidence.push(`入力された最高体温 ${peak}℃`);
  if (current !== null) evidence.push(`直近の体温 ${current}℃`);
  if (feverWords.length > 0) evidence.push(`記載: ${feverWords.join("・")}`);

  const orderThreshold = facts.orderThresholds.temperatureAtOrAbove;

  // 確認優先度は「現在の入力値」を基準に決める（過去のピーク値では上げない）。
  let level: RiskLevel = "MEDIUM";
  if (current !== null && current >= 38.0) level = "HIGH";
  if (
    orderThreshold !== null &&
    current !== null &&
    current >= orderThreshold
  ) {
    level = "HIGH";
  }

  const parts: string[] = [];
  if (peak !== null && current !== null && peak - current >= 0.3) {
    parts.push(
      `入力に${peak}℃の記録があり、直近の体温は${current}℃です。再発熱の有無を確認してください。`,
    );
  } else if (current !== null) {
    parts.push(`直近の体温は${current}℃です。体温の推移を確認してください。`);
  } else if (peak !== null) {
    parts.push(`入力に${peak}℃の記録があります。体温の推移を確認してください。`);
  } else {
    parts.push("体温に関する記載があります。体温の推移を確認してください。");
  }

  // 閾値はAIが決めず、入力済み医師指示に書かれた表記をそのまま引用する。
  const orderThresholdText = facts.orderThresholds.temperatureAtOrAboveText;
  if (orderThresholdText !== null) {
    parts.push(
      `入力済みの医師指示に基準の記載があります（${orderThresholdText}℃以上）。基準と入力値の比較を確認してください。`,
    );
    evidence.push(`入力済み医師指示の基準 ${orderThresholdText}℃以上`);
  }

  return {
    category: "体温・再発熱の確認",
    level,
    detail: parts.join(""),
    evidence,
  };
};

/**
 * SpO2。
 * 単一の測定値からは状態を断定せず、推移・酸素投与・平時値の確認候補として提示する。
 */
const spo2Check = (facts: ClinicalFacts): RiskDraft | null => {
  const min = facts.minSpo2;
  if (min === null) return null;

  const current = facts.currentSpo2;
  const series = facts.spo2Series;
  const threshold = facts.orderThresholds.spo2Below;
  const belowOrder =
    threshold !== null && current !== null && current < threshold;

  if (min >= 95 && !belowOrder) return null;

  let level: RiskLevel = "MEDIUM";
  if (min <= 92) level = "HIGH";
  if (belowOrder) level = "HIGH";

  const evidence: string[] = [];
  if (series.length > 0) evidence.push(`記載順のSpO2 ${series.join("% → ")}%`);
  if (current !== null) evidence.push(`入力されたSpO2 ${current}%`);

  const parts: string[] = [];
  if (series.length >= 2) {
    parts.push(
      `入力に記載されたSpO2は記載順に${series.join("% → ")}%です。${
        isDecreasingSeries(series, 2)
          ? "記載順では低下しています。測定条件と酸素投与の有無を含めて推移を確認してください。"
          : "測定条件と酸素投与の有無を含めて推移を確認してください。"
      }`,
    );
  } else {
    parts.push(
      `入力されたSpO2は${current ?? min}%です。単一の測定値のため、推移・酸素投与の有無・平時値を確認してください。`,
    );
  }

  // 閾値はAIが決めず、入力済み医師指示に書かれた表記をそのまま引用する。
  const thresholdText = facts.orderThresholds.spo2BelowText;
  if (thresholdText !== null) {
    parts.push(
      current !== null
        ? `入力済みの医師指示に基準の記載があります（${thresholdText}%未満）。現在値${current}%と基準${thresholdText}%未満の比較を確認してください。`
        : `入力済みの医師指示に基準の記載があります（${thresholdText}%未満）。基準と入力値の比較を確認してください。`,
    );
    evidence.push(`入力済み医師指示の基準 ${thresholdText}%未満`);
  }

  return {
    category: "SpO2値・推移の確認",
    level,
    detail: parts.join(""),
    evidence,
  };
};

const respiratoryCheck = (facts: ClinicalFacts): RiskDraft | null => {
  const words = matchedKeywords(facts.observationText, [
    "呼吸困難",
    "息切れ",
    "喘鳴",
    "努力呼吸",
    "起座呼吸",
    "陥没呼吸",
    "喀痰",
    "吸引",
    "酸素",
    "咳嗽",
  ]);
  const rr = facts.respiratoryRate;
  const rrAbnormal = rr !== null && (rr >= 25 || rr <= 9);
  const rrBorderline = rr !== null && rr >= 21 && rr < 25;

  if (words.length === 0 && !rrAbnormal && !rrBorderline) return null;

  let level: RiskLevel = "LOW";
  if (rrAbnormal) level = "HIGH";
  else if (rrBorderline) level = "MEDIUM";
  if (
    words.some((word) =>
      ["呼吸困難", "努力呼吸", "陥没呼吸", "起座呼吸"].includes(word),
    )
  ) {
    level = maxLevel(level, "HIGH");
  } else if (words.length > 0) {
    level = maxLevel(level, "MEDIUM");
  }

  const evidence: string[] = [];
  if (rr !== null) evidence.push(`呼吸数 ${rr}回/分`);
  if (words.length > 0) evidence.push(`記載: ${words.join("・")}`);

  return {
    category: "呼吸状態の変化に関する確認",
    level,
    detail:
      "呼吸に関する記載・数値が入力されています。呼吸数・呼吸音・努力呼吸の有無と、入力済み医師指示の実施状況を確認してください。",
    evidence,
  };
};

const fallCheck = (facts: ClinicalFacts, input: HandoverInput): RiskDraft | null => {
  const unsteady = matchedKeywords(facts.observationText, [
    "ふらつき",
    "ふらふら",
    "めまい",
    "眩暈",
    "立ちくらみ",
    "転倒",
    "歩行不安定",
    "バランス",
  ]);
  const nightMobility = matchedKeywords(facts.observationText, [
    "夜間トイレ",
    "夜間排尿",
    "夜間",
    "トイレ介助",
    "頻尿",
    "離床センサー",
    "中途覚醒",
  ]);
  const sedation = matchedKeywords(facts.observationText, [
    "眠剤",
    "睡眠薬",
    "せん妄",
    "不穏",
    "傾眠",
    "鎮痛剤",
  ]);
  const baseline = input.patient.fallRisk;

  if (unsteady.length === 0 && nightMobility.length === 0 && baseline === "LOW") {
    return null;
  }

  let level: RiskLevel = baseline === "HIGH" ? "MEDIUM" : "LOW";
  if (unsteady.length > 0 && nightMobility.length > 0) level = "HIGH";
  else if (unsteady.length > 0) level = maxLevel(level, "MEDIUM");
  if (unsteady.length > 0 && baseline === "HIGH") level = "HIGH";
  if (unsteady.length > 0 && sedation.length > 0) level = "HIGH";
  if (nightMobility.length > 0 && baseline === "HIGH") {
    level = maxLevel(level, "MEDIUM");
  }

  const evidence: string[] = [`患者背景の転倒リスク: ${baseline}`];
  if (unsteady.length > 0) evidence.push(`記載: ${unsteady.join("・")}`);
  if (nightMobility.length > 0) evidence.push(`夜間行動: ${nightMobility.join("・")}`);
  if (sedation.length > 0) evidence.push(`鎮静系の記載: ${sedation.join("・")}`);

  return {
    category: "転倒関連の確認",
    level,
    detail:
      level === "HIGH"
        ? "ふらつきと夜間の移動に関する記載が重なっています。現在実施されている転倒予防対策の内容と、移動・歩行時の状態を確認してください。"
        : "移動に関する記載があります。現在実施されている転倒予防対策の内容と、移動・歩行時の状態を確認してください。",
    evidence,
  };
};

const intakeCheck = (facts: ClinicalFacts): RiskDraft | null => {
  const words = matchedKeywords(facts.observationText, [
    "食欲低下",
    "摂取不良",
    "食事拒否",
    "絶食",
    "嘔気",
    "嘔吐",
  ]);
  const fraction = facts.mealFraction;
  if (fraction === null && words.length === 0) return null;

  let level: RiskLevel = "LOW";
  const evidence: string[] = [];
  if (fraction !== null) {
    evidence.push(`入力された食事摂取量 ${fraction}割`);
    if (fraction <= 3) level = "HIGH";
    else if (fraction <= 5) level = "MEDIUM";
  }
  if (words.length > 0) {
    evidence.push(`記載: ${words.join("・")}`);
    level = maxLevel(level, "MEDIUM");
  }
  if (level === "LOW") return null;

  return {
    category: "食事摂取量の確認",
    level,
    detail:
      "入力された食事摂取量が少なめに記載されています。摂取量の経過と、入力済みの食事形態・医師指示に関する記載を確認してください。",
    evidence,
  };
};

/** 「脱水」と断定せず、水分出納に関する確認候補として提示する。 */
const fluidBalanceCheck = (
  facts: ClinicalFacts,
  temperatureLevel: RiskLevel | null,
  intakeLevel: RiskLevel | null,
): RiskDraft | null => {
  const words = matchedKeywords(facts.observationText, [
    "脱水",
    "口渇",
    "皮膚乾燥",
    "口腔乾燥",
    "ツルゴール",
  ]);
  const fluid = facts.fluidMl;
  const lowFluid = fluid !== null && fluid < 800;

  if (!lowFluid && words.length === 0 && !(temperatureLevel && intakeLevel)) {
    return null;
  }

  let level: RiskLevel = "LOW";
  const evidence: string[] = [];
  if (lowFluid) {
    level = "MEDIUM";
    evidence.push(`入力された水分摂取量 約${fluid}ml`);
  }
  if (words.length > 0) {
    level = maxLevel(level, "MEDIUM");
    evidence.push(`記載: ${words.join("・")}`);
  }
  if (temperatureLevel && intakeLevel) {
    level = maxLevel(level, "MEDIUM");
    evidence.push("体温に関する記載と摂取量低下の記載が併存");
  }
  if (level === "LOW") return null;

  return {
    category: "水分出納の確認",
    level,
    detail:
      "水分・食事摂取量に関する記載があります。飲水量・尿量・口腔や皮膚の乾燥所見の記録を確認してください。脱水の有無は入力情報だけでは判断できません。",
    evidence,
  };
};

const urineCheck = (facts: ClinicalFacts): RiskDraft | null => {
  const words = matchedKeywords(facts.observationText, [
    "乏尿",
    "無尿",
    "尿量減少",
    "尿閉",
    "尿混濁",
    "血尿",
  ]);
  const count = facts.urineCount;
  const lowCount = count !== null && count <= 2;
  if (words.length === 0 && !lowCount) return null;

  const level: RiskLevel = words.some((word) =>
    ["乏尿", "無尿", "尿閉"].includes(word),
  )
    ? "HIGH"
    : "MEDIUM";

  const evidence: string[] = [];
  if (count !== null) evidence.push(`入力された排尿回数 ${count}回`);
  if (words.length > 0) evidence.push(`記載: ${words.join("・")}`);

  return {
    category: "排尿状況の確認",
    level,
    detail:
      "排尿に関する記載があります。排尿回数・尿量の記録と、腹部の状態に関する記載を確認してください。",
    evidence,
  };
};

const painCheck = (facts: ClinicalFacts): RiskDraft | null => {
  const words = matchedKeywords(facts.observationText, [
    "疼痛増強",
    "痛み強い",
    "疼痛",
    "痛み",
    "鎮痛剤",
  ]);
  const nrs = facts.maxNrs;
  if (nrs === null && words.length === 0) return null;

  let level: RiskLevel = "LOW";
  const evidence: string[] = [];
  if (nrs !== null) {
    evidence.push(`入力されたNRS 最大 ${nrs}`);
    if (nrs >= 7) level = "HIGH";
    else if (nrs >= 4) level = "MEDIUM";
  }
  if (matchedKeywords(facts.observationText, ["疼痛増強", "痛み強い"]).length > 0) {
    level = maxLevel(level, "MEDIUM");
  }
  if (level === "LOW") return null;
  if (words.length > 0) evidence.push(`記載: ${words.slice(0, 3).join("・")}`);

  return {
    category: "疼痛に関する確認",
    level,
    detail:
      "疼痛に関する記載があります。疼痛スケールの推移と、入力済みの鎮痛剤使用に関する記載・使用後の記録を確認してください。",
    evidence,
  };
};

const circulationCheck = (facts: ClinicalFacts): RiskDraft | null => {
  const evidence: string[] = [];
  let level: RiskLevel = "LOW";
  const parts: string[] = [];

  if (facts.systolicBp !== null) {
    if (facts.systolicBp < 90) {
      level = "HIGH";
      parts.push(`入力された収縮期血圧は${facts.systolicBp}mmHgです。`);
      evidence.push(`収縮期血圧 ${facts.systolicBp}mmHg`);
    } else if (facts.systolicBp < 100) {
      level = maxLevel(level, "MEDIUM");
      parts.push(`入力された収縮期血圧は${facts.systolicBp}mmHgです。`);
      evidence.push(`収縮期血圧 ${facts.systolicBp}mmHg`);
    } else if (facts.systolicBp >= 180) {
      level = maxLevel(level, "MEDIUM");
      parts.push(`入力された収縮期血圧は${facts.systolicBp}mmHgです。`);
      evidence.push(`収縮期血圧 ${facts.systolicBp}mmHg`);
    }
  }

  if (facts.pulse !== null) {
    if (facts.pulse >= 120 || facts.pulse < 45) {
      level = "HIGH";
      parts.push(`入力された脈拍は${facts.pulse}回/分です。`);
      evidence.push(`脈拍 ${facts.pulse}回/分`);
    } else if (facts.pulse > 100) {
      level = maxLevel(level, "MEDIUM");
      parts.push(`入力された脈拍は${facts.pulse}回/分です。`);
      evidence.push(`脈拍 ${facts.pulse}回/分`);
    }
  }

  if (level === "LOW") return null;

  return {
    category: "血圧・脈拍の確認",
    level,
    detail: `${parts.join("")}単一の測定値のため、測定条件・平時値・推移と、入力済み医師指示との比較を確認してください。`,
    evidence,
  };
};

const consciousnessCheck = (facts: ClinicalFacts): RiskDraft | null => {
  const words = matchedKeywords(facts.observationText, [
    "せん妄",
    "不穏",
    "傾眠",
    "見当識障害",
    "意識レベル低下",
    "呼びかけに反応",
  ]);
  if (words.length === 0) return null;
  const level: RiskLevel = words.some((word) =>
    ["意識レベル低下", "せん妄"].includes(word),
  )
    ? "HIGH"
    : "MEDIUM";
  return {
    category: "意識状態に関する確認",
    level,
    detail:
      "意識状態に関する記載があります。前勤務との比較と、記録されている評価スケールの推移を確認してください。",
    evidence: [`記載: ${words.join("・")}`],
  };
};

const lineCheck = (facts: ClinicalFacts): RiskDraft | null => {
  const lineWords = matchedKeywords(facts.observationText, [
    "点滴",
    "ルート",
    "末梢",
    "CV",
    "カテーテル",
    "ドレーン",
  ]);
  if (lineWords.length === 0) return null;

  const trouble = matchedKeywords(facts.observationText, [
    "自己抜去",
    "漏れ",
    "腫脹",
    "発赤",
    "滴下不良",
    "閉塞",
    "刺入部",
    "疼痛あり",
  ]);
  const level: RiskLevel = trouble.length > 0 ? "HIGH" : "LOW";

  return {
    category: "ルート・刺入部の確認",
    level,
    detail:
      level === "HIGH"
        ? "ルートに関する所見の記載があります。刺入部の状態と、入力済み医師指示・記録内容を確認してください。"
        : "留置中のルートに関する記載があります。刺入部の状態と滴下状況の記録を確認してください。",
    evidence: [
      `留置に関する記載: ${lineWords.join("・")}`,
      ...(trouble.length > 0 ? [`所見の記載: ${trouble.join("・")}`] : []),
    ],
  };
};

/**
 * 登録アレルギー。
 * 登録情報の提示にとどめ、禁忌薬・代替薬の提案は行わない。
 */
const allergyCheck = (input: HandoverInput, facts: ClinicalFacts): RiskDraft | null => {
  if (!hasAllergy(input.patient.allergies)) return null;
  const drugMention = matchedKeywords(facts.observationText, [
    "抗菌薬",
    "点滴",
    "内服",
    "造影",
    "新規",
    "処方",
  ]);
  const level: RiskLevel = drugMention.length > 0 ? "MEDIUM" : "LOW";
  return {
    category: "登録アレルギーの確認",
    level,
    detail: `登録アレルギー：${input.patient.allergies}。投薬前に登録アレルギー情報を確認してください。`,
    evidence: [
      `登録アレルギー: ${input.patient.allergies}`,
      ...(drugMention.length > 0 ? [`薬剤関連の記載: ${drugMention.join("・")}`] : []),
    ],
  };
};

const infectionCheck = (input: HandoverInput): RiskDraft | null => {
  const control = input.patient.infectionControl;
  if (!/飛沫|接触|空気|隔離/.test(control)) return null;
  return {
    category: "感染対策の確認",
    level: "MEDIUM",
    detail: `登録されている感染対策：${control}。実施状況を確認してください。`,
    evidence: [`感染対策: ${control}`],
  };
};

const woundCheck = (facts: ClinicalFacts): RiskDraft | null => {
  const site = matchedKeywords(facts.observationText, ["創部", "術後", "縫合", "ドレーン"]);
  if (site.length === 0) return null;
  const abnormal = matchedKeywords(facts.observationText, [
    "浸出液",
    "出血",
    "離開",
    "発赤",
    "膿",
    "腫脹",
  ]);
  const level: RiskLevel = abnormal.length > 0 ? "MEDIUM" : "LOW";
  if (level === "LOW") return null;
  return {
    category: "創部の確認",
    level,
    detail:
      "創部に関する所見の記載があります。創部の状態とガーゼの汚染に関する記録を確認してください。",
    evidence: [`部位の記載: ${site.join("・")}`, `所見の記載: ${abnormal.join("・")}`],
  };
};

const glucoseCheck = (facts: ClinicalFacts): RiskDraft | null => {
  const words = matchedKeywords(facts.observationText, [
    "低血糖",
    "高血糖",
    "インスリン",
    "血糖測定",
  ]);
  const value = facts.bloodGlucose;
  if (words.length === 0 && value === null) return null;

  let level: RiskLevel = "LOW";
  const evidence: string[] = [];
  if (value !== null) {
    evidence.push(`入力された血糖値 ${value}mg/dL`);
    if (value < 70) level = "HIGH";
    else if (value >= 300) level = "MEDIUM";
  }
  if (facts.observationText.includes("低血糖")) level = maxLevel(level, "HIGH");
  else if (words.length > 0) level = maxLevel(level, "LOW");
  if (level === "LOW") return null;
  if (words.length > 0) evidence.push(`記載: ${words.join("・")}`);

  return {
    category: "血糖値の確認",
    level,
    detail:
      "血糖に関する記載があります。測定値の推移と、入力済み医師指示の実施状況を確認してください。",
    evidence,
  };
};

/** HIGH が複数ある場合に、申し送り時の優先確認としてまとめる。 */
const multipleHighCheck = (risks: RiskDraft[]): RiskDraft | null => {
  const highs = risks.filter((risk) => risk.level === "HIGH");
  if (highs.length < 2) return null;
  return {
    category: "確認優先度HIGHの重複",
    level: "HIGH",
    detail:
      "確認優先度HIGHの項目が複数あります。申し送り時にこれらを優先して確認し、入力済み医師指示の報告基準を次勤務者と共有してください。",
    evidence: highs.map((risk) => `${risk.category}: HIGH`),
  };
};

export const detectRisks = (input: HandoverInput): RiskItem[] => {
  const facts = extractFacts(input);
  const drafts: RiskDraft[] = [];

  const temperature = temperatureCheck(facts);
  const intake = intakeCheck(facts);

  const candidates = [
    temperature,
    spo2Check(facts),
    respiratoryCheck(facts),
    fallCheck(facts, input),
    intake,
    fluidBalanceCheck(facts, temperature?.level ?? null, intake?.level ?? null),
    urineCheck(facts),
    painCheck(facts),
    circulationCheck(facts),
    consciousnessCheck(facts),
    lineCheck(facts),
    woundCheck(facts),
    glucoseCheck(facts),
    allergyCheck(input, facts),
    infectionCheck(input),
  ];

  for (const candidate of candidates) {
    if (candidate) drafts.push(candidate);
  }

  // まとめ項目は個別の確認候補より後ろに置く（ソートは安定なのでHIGH群の末尾になる）。
  const multipleHigh = multipleHighCheck(drafts);
  if (multipleHigh) drafts.push(multipleHigh);

  return drafts
    .sort((a, b) => compareLevelDesc(a.level, b.level))
    .map((draft) => ({
      id: slug(draft.category),
      category: draft.category,
      level: draft.level,
      detail: draft.detail,
      evidence: draft.evidence,
    }));
};

/* ------------------------------------------------------------------ */
/* 次勤務への観察項目                                                  */
/* ------------------------------------------------------------------ */

/**
 * 確認候補ごとの観察項目。
 * 観察頻度・投与開始などの新しい指示は含めず、「確認する」対象のみを並べる。
 */
const TASKS_BY_CATEGORY: Record<string, string[]> = {
  "体温・再発熱の確認": ["再発熱の有無と体温の推移", "入力済み医師指示（解熱に関する記載）の実施状況"],
  "SpO2値・推移の確認": [
    "SpO2の推移（測定条件・酸素投与の有無を含む）",
    "入力済みの酸素に関する指示基準と現在値の比較",
  ],
  "呼吸状態の変化に関する確認": ["呼吸数・呼吸音・努力呼吸の有無", "喀痰の性状と自己喀出の可否"],
  "転倒関連の確認": [
    "移動・歩行時の状態（ふらつきの有無）",
    "現在実施されている転倒予防対策の内容と実施状況",
  ],
  "食事摂取量の確認": ["食事摂取量の経過", "嚥下状態と入力済みの食事形態"],
  "水分出納の確認": ["水分摂取量と尿量の記録", "口腔・皮膚の乾燥所見の記録"],
  "排尿状況の確認": ["排尿回数と尿量の記録", "下腹部の張り・残尿感に関する訴えの有無"],
  "疼痛に関する確認": ["疼痛スケール（NRS）の推移", "入力済みの鎮痛剤使用に関する記載と使用後の記録"],
  "血圧・脈拍の確認": ["血圧・脈拍の推移と測定条件", "起立時のふらつき・冷汗に関する訴えの有無"],
  "意識状態に関する確認": ["意識状態の前勤務との比較", "夜間の言動に関する記録"],
  "ルート・刺入部の確認": ["点滴ルート刺入部の状態", "入力済み指示の輸液の滴下状況"],
  "創部の確認": ["創部の状態とガーゼ汚染の有無", "創部痛に関する訴えの有無"],
  "血糖値の確認": ["血糖測定値の推移", "低血糖に関連する自覚症状の訴えの有無"],
  "登録アレルギーの確認": ["投薬前の登録アレルギー情報の確認"],
  "感染対策の確認": ["登録されている感染対策の実施状況"],
  // 「確認優先度HIGHの重複」はまとめ項目のため、観察項目は生成しない（重複を避ける）。
};

const BASELINE_TASKS = [
  "バイタルサインの値と前勤務値との比較",
  "食事摂取量・水分摂取量の記録",
  "排泄回数と性状の記録",
];

export const generateNextShiftTasks = (
  input: HandoverInput,
  risks: RiskItem[],
): NextShiftTask[] => {
  const tasks: NextShiftTask[] = [];
  const seen = new Set<string>();

  const push = (label: string, priority: RiskLevel) => {
    if (seen.has(label)) return;
    seen.add(label);
    tasks.push({
      id: `task-${seen.size}`,
      label,
      priority,
      done: false,
    });
  };

  for (const risk of risks) {
    for (const label of TASKS_BY_CATEGORY[risk.category] ?? []) {
      push(label, risk.level);
    }
  }

  // 医師指示・検査は内容を切り詰めず、「入力済みの内容を確認する」項目として扱う。
  if (input.structured.doctorOrder.trim()) {
    push("入力済み医師指示の内容と実施状況の確認", "MEDIUM");
  }
  if (input.structured.examination.trim()) {
    push("入力済みの検査予定の準備と結果の確認", "MEDIUM");
  }
  if (input.structured.family.trim()) {
    push("入力済みの家族対応内容の確認", "LOW");
  }

  for (const label of BASELINE_TASKS) push(label, "LOW");

  // 確認優先度の高い順に並べ替えてから件数を制限する。
  return tasks
    .sort((a, b) => compareLevelDesc(a.priority, b.priority))
    .slice(0, 14);
};

/* ------------------------------------------------------------------ */
/* SBAR / 要約                                                         */
/* ------------------------------------------------------------------ */

const vitalsLine = (facts: ClinicalFacts, input: HandoverInput): string => {
  const { vitals } = input.structured;
  const parts = [
    vitals.temperature && `体温${vitals.temperature}℃`,
    vitals.bloodPressure && `血圧${vitals.bloodPressure}mmHg`,
    vitals.pulse && `脈拍${vitals.pulse}回/分`,
    vitals.spo2 && `SpO2 ${vitals.spo2}%`,
    vitals.respiratoryRate && `呼吸数${vitals.respiratoryRate}回/分`,
  ].filter(Boolean);
  if (parts.length > 0) return parts.join("、");
  if (facts.currentTemperature !== null) return `体温${facts.currentTemperature}℃`;
  return "";
};

/** 自由記載から代表的な文を最大 n 件取り出す。 */
const keySentences = (freeText: string, limit: number): string[] =>
  freeText
    .split(/[。\n]/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0)
    .slice(0, limit);

export const generateSbar = (input: HandoverInput, risks: RiskItem[]): Sbar => {
  const { patient, structured, freeText } = input;
  const facts = extractFacts(input);
  const vitals = vitalsLine(facts, input);
  const topRisks = risks.filter((risk) => risk.level !== "LOW").slice(0, 3);

  const situationParts = [
    `${patient.room} ${patient.name}さん（${patient.age}歳・${genderLabel(patient.gender)}）。`,
    vitals ? `入力された直近のバイタルは${vitals}。` : "",
    ...keySentences(freeText, 3).map((sentence) => `${sentence}。`),
    topRisks.length > 0
      ? `申し送り時に優先して確認する項目は${topRisks
          .map((risk) => `${risk.category}（${risk.level}）`)
          .join("、")}です。`
      : "",
  ];

  const backgroundParts = [
    `${formatJaDate(patient.admissionDate)}に${patient.primaryDiagnosis}で入院。主治医は${patient.attendingDoctor}。`,
    `ADLは${patient.adl}。`,
    `登録アレルギー: ${hasAllergy(patient.allergies) ? patient.allergies : "登録なし"}。コードステータス: ${patient.codeStatus}。`,
    `感染対策: ${patient.infectionControl}。`,
    structured.medication.trim() ? `内服・注射（入力内容）: ${structured.medication.trim()}。` : "",
    structured.treatment.trim() ? `実施中の処置（入力内容）: ${structured.treatment.trim()}。` : "",
  ];

  const assessmentParts = [
    "以下は入力情報から抽出した確認候補です（医学的な評価の確定ではありません）。",
    ...(risks.length > 0
      ? risks.slice(0, 5).map((risk) => `【${risk.level}】${risk.category}: ${risk.detail}`)
      : ["入力情報からは特記すべき確認候補は抽出されませんでした。継続して経過を確認してください。"]),
  ];

  // Recommendation は「入力済みの医師指示」と「次勤務での確認候補」のみで構成する。
  // 医師指示は原文のまま引用し、AIが新しい指示を作らない。
  const recommendationParts = [
    "【入力済みの医師指示（入力内容をそのまま記載）】",
    structured.doctorOrder.trim() || "（入力なし）",
    "",
    "【次勤務での確認候補】",
    ...generateNextShiftTasks(input, risks)
      .slice(0, 6)
      .map((task) => `・${task.label}`),
    ...(structured.family.trim()
      ? ["", "【家族対応（入力内容）】", structured.family.trim()]
      : []),
  ];

  return {
    situation: situationParts.filter(Boolean).join(""),
    background: backgroundParts.filter(Boolean).join(""),
    assessment: assessmentParts.join("\n"),
    recommendation: recommendationParts.join("\n"),
  };
};

/**
 * 口頭申し送り用の要約。
 * 患者識別 → 主病名 → 直近の変化 → 現在状態 → 入力済み医師指示 → 確認候補 の順に整理する。
 */
export const generateBriefSummary = (
  input: HandoverInput,
  risks: RiskItem[],
): string => {
  const { patient, structured, freeText } = input;
  const facts = extractFacts(input);
  const vitals = vitalsLine(facts, input);
  const highlights = keySentences(freeText, 2);
  const topTasks = generateNextShiftTasks(input, risks).slice(0, 3);

  const sentences = [
    // 患者識別・主病名
    `${patient.room}、${patient.name}さん、${patient.age}歳${genderLabel(patient.gender)}、${patient.primaryDiagnosis}で${formatJaDate(patient.admissionDate)}入院です。`,
    // 重要な直近変化
    highlights.length > 0 ? `${highlights.join("。")}。` : "",
    // 現在状態
    vitals ? `入力された直近のバイタルは${vitals}です。` : "",
    structured.mealIntake.trim() ? `食事は${structured.mealIntake.trim()}。` : "",
    structured.infusion.trim() ? `点滴は${structured.infusion.trim()}。` : "",
    hasAllergy(patient.allergies)
      ? `登録アレルギーは${patient.allergies}です。`
      : "",
    // 入力済み医師指示（原文のまま）
    structured.doctorOrder.trim()
      ? `入力済みの医師指示は「${structured.doctorOrder.trim()}」です。`
      : "",
    // 次勤務への確認候補（確認優先度の一覧は High Priority / 確認優先度セクションで提示するため、
    // 要約では重複させず確認候補のみを述べる）
    topTasks.length > 0
      ? `次勤務での確認候補は、${topTasks.map((task) => task.label).join("、")}です。`
      : "",
  ];

  return sentences.filter(Boolean).join("");
};

export const generateMockHandover = (input: HandoverInput) => {
  const risks = detectRisks(input);
  return {
    briefSummary: generateBriefSummary(input, risks),
    sbar: generateSbar(input, risks),
    risks,
    tasks: generateNextShiftTasks(input, risks),
  };
};
