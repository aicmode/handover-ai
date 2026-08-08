import type {
  HandoverInput,
  NextShiftTask,
  RiskItem,
  RiskLevel,
  Sbar,
} from "../types";
import {
  compareLevelDesc,
  extractFacts,
  matchedKeywords,
  maxLevel,
  type ClinicalFacts,
} from "./analysis";

/**
 * モックAIエンジン。
 * APIキー未設定でもデモできるよう、ルールベースで
 * リスク抽出・SBAR・観察項目・要約を生成する。
 * 単語一致だけでなく、数値条件と組み合わせ条件で判定する。
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

const hasAllergy = (value: string): boolean => {
  const trimmed = value.trim();
  return trimmed.length > 0 && !/^(なし|無し|特になし|none)$/i.test(trimmed);
};

/* ------------------------------------------------------------------ */
/* リスク抽出                                                          */
/* ------------------------------------------------------------------ */

const feverRisk = (facts: ClinicalFacts): RiskDraft | null => {
  const feverWords = matchedKeywords(facts.text, [
    "発熱",
    "熱発",
    "悪寒",
    "戦慄",
    "解熱",
  ]);
  const peak = facts.peakTemperature;
  if (peak === null && feverWords.length === 0) return null;

  const evidence: string[] = [];
  let level: RiskLevel = "LOW";
  let detail = "体温の推移に注意が必要です。";

  if (peak !== null && peak >= 38.5) {
    level = "HIGH";
    evidence.push(`最高体温 ${peak}℃`);
    detail = "38.5℃以上の高熱を確認。感染徴候の増悪と再発熱に注意。";
  } else if (peak !== null && peak >= 38.0) {
    level = "MEDIUM";
    evidence.push(`最高体温 ${peak}℃`);
    detail = "38℃以上の発熱あり。解熱後の再発熱に注意。";
  } else if (peak !== null && peak >= 37.5) {
    level = "MEDIUM";
    evidence.push(`最高体温 ${peak}℃`);
    detail = "微熱が持続しています。感染徴候の推移を観察。";
  } else if (feverWords.length > 0) {
    level = "MEDIUM";
    detail = "発熱に関する記載があります。体温推移の確認が必要です。";
  }

  // 平熱かつ発熱に関する記載もない場合はリスクとして扱わない。
  if (level === "LOW") return null;

  if (feverWords.length > 0) evidence.push(`記載: ${feverWords.join("・")}`);

  if (
    facts.defervescence &&
    facts.currentTemperature !== null &&
    facts.currentTemperature < 37.5
  ) {
    detail = `${detail} 現在は${facts.currentTemperature}℃まで解熱していますが、再発熱の可能性があります。`;
    evidence.push(`現在体温 ${facts.currentTemperature}℃`);
    if (level === "HIGH") level = "MEDIUM";
  }

  return { category: "発熱・再発熱", level, detail, evidence };
};

const spo2Risk = (facts: ClinicalFacts): RiskDraft | null => {
  if (facts.minSpo2 === null) return null;
  const value = facts.minSpo2;
  if (value >= 95) return null;

  const level: RiskLevel = value <= 92 ? "HIGH" : "MEDIUM";
  return {
    category: "SpO2低下",
    level,
    detail:
      value <= 92
        ? `SpO2 ${value}% と低下しています。酸素化の悪化に注意し、指示された基準値で医師へ報告してください。`
        : `SpO2 ${value}% とやや低下傾向です。労作時の低下に注意してください。`,
    evidence: [`SpO2 ${value}%`],
  };
};

const respiratoryRisk = (facts: ClinicalFacts): RiskDraft | null => {
  const words = matchedKeywords(facts.text, [
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
  if (words.some((word) => ["呼吸困難", "努力呼吸", "陥没呼吸", "起座呼吸"].includes(word))) {
    level = maxLevel(level, "HIGH");
  } else if (words.length > 0) {
    level = maxLevel(level, "MEDIUM");
  }

  const evidence: string[] = [];
  if (rr !== null) evidence.push(`呼吸数 ${rr}回/分`);
  if (words.length > 0) evidence.push(`記載: ${words.join("・")}`);

  return {
    category: "呼吸状態悪化",
    level,
    detail:
      level === "HIGH"
        ? "呼吸状態の悪化が疑われます。呼吸数・呼吸音・努力呼吸の有無を頻回に観察してください。"
        : "呼吸状態の変化に注意が必要です。労作時の症状と呼吸音を観察してください。",
    evidence,
  };
};

const fallRisk = (
  facts: ClinicalFacts,
  input: HandoverInput,
): RiskDraft | null => {
  const unsteady = matchedKeywords(facts.text, [
    "ふらつき",
    "ふらふら",
    "めまい",
    "眩暈",
    "立ちくらみ",
    "転倒",
    "歩行不安定",
    "バランス",
  ]);
  const nightMobility = matchedKeywords(facts.text, [
    "夜間トイレ",
    "夜間排尿",
    "夜間",
    "トイレ介助",
    "頻尿",
    "離床センサー",
    "中途覚醒",
  ]);
  const sedation = matchedKeywords(facts.text, [
    "眠剤",
    "睡眠薬",
    "せん妄",
    "不穏",
    "傾眠",
    "鎮痛剤",
  ]);
  const baseline = input.patient.fallRisk;

  if (
    unsteady.length === 0 &&
    nightMobility.length === 0 &&
    baseline === "LOW"
  ) {
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
  if (sedation.length > 0) evidence.push(`鎮静系: ${sedation.join("・")}`);

  return {
    category: "転倒リスク",
    level,
    detail:
      level === "HIGH"
        ? "ふらつきと夜間の移動が重なっており、転倒の危険が高い状態です。夜間はナースコール徹底と付き添いを検討してください。"
        : "移動時の転倒に注意が必要です。環境整備と履物の確認を行ってください。",
    evidence,
  };
};

const intakeRisk = (facts: ClinicalFacts): RiskDraft | null => {
  const words = matchedKeywords(facts.text, [
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
    evidence.push(`食事摂取量 ${fraction}割`);
    if (fraction <= 3) level = "HIGH";
    else if (fraction <= 5) level = "MEDIUM";
  }
  if (words.length > 0) {
    evidence.push(`記載: ${words.join("・")}`);
    level = maxLevel(level, "MEDIUM");
  }
  if (level === "LOW") return null;

  return {
    category: "食事摂取低下",
    level,
    detail:
      level === "HIGH"
        ? "摂取量が著明に低下しています。必要栄養量の確保と、医師への報告を検討してください。"
        : "食事摂取量が低下しています。毎食の摂取量を記録し、経過を確認してください。",
    evidence,
  };
};

const dehydrationRisk = (
  facts: ClinicalFacts,
  feverLevel: RiskLevel | null,
  intakeLevel: RiskLevel | null,
): RiskDraft | null => {
  const words = matchedKeywords(facts.text, [
    "脱水",
    "口渇",
    "皮膚乾燥",
    "口腔乾燥",
    "ツルゴール",
  ]);
  const fluid = facts.fluidMl;
  const lowFluid = fluid !== null && fluid < 800;

  if (!lowFluid && words.length === 0 && !(feverLevel && intakeLevel)) {
    return null;
  }

  let level: RiskLevel = "LOW";
  const evidence: string[] = [];
  if (lowFluid) {
    level = "MEDIUM";
    evidence.push(`水分摂取量 約${fluid}ml`);
  }
  if (words.length > 0) {
    level = maxLevel(level, "MEDIUM");
    evidence.push(`記載: ${words.join("・")}`);
  }
  if (feverLevel && intakeLevel) {
    level = maxLevel(level, "MEDIUM");
    evidence.push("発熱と摂取量低下の併存");
  }
  if (lowFluid && feverLevel === "HIGH") level = "HIGH";
  if (level === "LOW") return null;

  return {
    category: "脱水",
    level,
    detail:
      "水分出納バランスの悪化が疑われます。飲水量・尿量・皮膚や口腔の乾燥を観察してください。",
    evidence,
  };
};

const urineRisk = (facts: ClinicalFacts): RiskDraft | null => {
  const words = matchedKeywords(facts.text, [
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
  if (count !== null) evidence.push(`排尿回数 ${count}回`);
  if (words.length > 0) evidence.push(`記載: ${words.join("・")}`);

  return {
    category: "尿量低下",
    level,
    detail:
      "尿量・排尿状況の低下がみられます。尿量測定と腹部膨満の確認、必要時は医師へ報告してください。",
    evidence,
  };
};

const painRisk = (facts: ClinicalFacts): RiskDraft | null => {
  const words = matchedKeywords(facts.text, [
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
    evidence.push(`NRS ${nrs}`);
    if (nrs >= 7) level = "HIGH";
    else if (nrs >= 4) level = "MEDIUM";
  }
  if (matchedKeywords(facts.text, ["疼痛増強", "痛み強い"]).length > 0) {
    level = maxLevel(level, "MEDIUM");
  }
  if (level === "LOW") return null;
  if (words.length > 0) evidence.push(`記載: ${words.slice(0, 3).join("・")}`);

  return {
    category: "疼痛増強",
    level,
    detail:
      level === "HIGH"
        ? "強い疼痛の訴えがあります。鎮痛剤の効果判定と、疼痛によるADL低下・睡眠障害に注意してください。"
        : "疼痛のコントロールが必要です。鎮痛剤使用後の効果を評価してください。",
    evidence,
  };
};

const circulationRisk = (facts: ClinicalFacts): RiskDraft | null => {
  const evidence: string[] = [];
  let level: RiskLevel = "LOW";
  let detail = "";

  if (facts.systolicBp !== null) {
    if (facts.systolicBp < 90) {
      level = "HIGH";
      detail = "収縮期血圧90mmHg未満です。循環動態の悪化に注意してください。";
      evidence.push(`収縮期血圧 ${facts.systolicBp}mmHg`);
    } else if (facts.systolicBp < 100) {
      level = maxLevel(level, "MEDIUM");
      detail = "血圧が低めに推移しています。起立時の血圧低下に注意してください。";
      evidence.push(`収縮期血圧 ${facts.systolicBp}mmHg`);
    } else if (facts.systolicBp >= 180) {
      level = maxLevel(level, "MEDIUM");
      detail = "血圧が高値です。医師指示の降圧基準を確認してください。";
      evidence.push(`収縮期血圧 ${facts.systolicBp}mmHg`);
    }
  }

  if (facts.pulse !== null) {
    if (facts.pulse >= 120 || facts.pulse < 45) {
      level = "HIGH";
      detail = `${detail} 脈拍${facts.pulse}回/分と異常値です。`.trim();
      evidence.push(`脈拍 ${facts.pulse}回/分`);
    } else if (facts.pulse > 100) {
      level = maxLevel(level, "MEDIUM");
      detail = `${detail} 頻脈傾向（${facts.pulse}回/分）です。`.trim();
      evidence.push(`脈拍 ${facts.pulse}回/分`);
    }
  }

  if (level === "LOW") return null;
  return {
    category: "循環動態の変動",
    level,
    detail: detail || "循環動態の変動に注意してください。",
    evidence,
  };
};

const consciousnessRisk = (facts: ClinicalFacts): RiskDraft | null => {
  const words = matchedKeywords(facts.text, [
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
    category: "意識状態の変化",
    level,
    detail:
      "意識状態の変化がみられます。JCS/GCSでの評価と、ライン自己抜去・転倒の二次リスクに注意してください。",
    evidence: [`記載: ${words.join("・")}`],
  };
};

const lineRisk = (facts: ClinicalFacts): RiskDraft | null => {
  const lineWords = matchedKeywords(facts.text, [
    "点滴",
    "ルート",
    "末梢",
    "CV",
    "カテーテル",
    "ドレーン",
  ]);
  if (lineWords.length === 0) return null;

  const trouble = matchedKeywords(facts.text, [
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
    category: "ルートトラブル",
    level,
    detail:
      level === "HIGH"
        ? "ルートに関するトラブルの記載があります。刺入部の状態確認と再挿入の要否を確認してください。"
        : "留置中のルートがあります。刺入部の発赤・腫脹・滴下状況を定期的に確認してください。",
    evidence: [
      `留置: ${lineWords.join("・")}`,
      ...(trouble.length > 0 ? [`異常所見: ${trouble.join("・")}`] : []),
    ],
  };
};

const allergyRisk = (input: HandoverInput, facts: ClinicalFacts): RiskDraft | null => {
  if (!hasAllergy(input.patient.allergies)) return null;
  const drugMention = matchedKeywords(facts.text, [
    "抗菌薬",
    "点滴",
    "内服",
    "造影",
    "新規",
    "処方",
  ]);
  const level: RiskLevel = drugMention.length > 0 ? "MEDIUM" : "LOW";
  return {
    category: "アレルギー",
    level,
    detail: `アレルギー歴（${input.patient.allergies}）があります。新規薬剤の投与前に必ず確認してください。`,
    evidence: [
      `登録アレルギー: ${input.patient.allergies}`,
      ...(drugMention.length > 0 ? [`薬剤関連の記載: ${drugMention.join("・")}`] : []),
    ],
  };
};

const infectionRisk = (input: HandoverInput): RiskDraft | null => {
  const control = input.patient.infectionControl;
  if (!/飛沫|接触|空気|隔離/.test(control)) return null;
  return {
    category: "感染対策",
    level: "MEDIUM",
    detail: `${control}が指示されています。個人防護具の着脱手順を遵守してください。`,
    evidence: [`感染対策: ${control}`],
  };
};

const woundRisk = (facts: ClinicalFacts): RiskDraft | null => {
  const site = matchedKeywords(facts.text, ["創部", "術後", "縫合", "ドレーン"]);
  if (site.length === 0) return null;
  const abnormal = matchedKeywords(facts.text, [
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
    category: "創部トラブル",
    level,
    detail: "創部に異常所見の記載があります。ガーゼ汚染と感染徴候を観察してください。",
    evidence: [`部位: ${site.join("・")}`, `所見: ${abnormal.join("・")}`],
  };
};

const glucoseRisk = (facts: ClinicalFacts): RiskDraft | null => {
  const words = matchedKeywords(facts.text, [
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
    evidence.push(`血糖値 ${value}mg/dL`);
    if (value < 70) level = "HIGH";
    else if (value >= 300) level = "MEDIUM";
  }
  if (facts.text.includes("低血糖")) level = maxLevel(level, "HIGH");
  else if (words.length > 0) level = maxLevel(level, "LOW");
  if (level === "LOW") return null;
  if (words.length > 0) evidence.push(`記載: ${words.join("・")}`);

  return {
    category: "血糖変動",
    level,
    detail: "血糖値の変動に注意が必要です。測定値と自覚症状を併せて観察してください。",
    evidence,
  };
};

const deteriorationRisk = (risks: RiskDraft[]): RiskDraft | null => {
  const highs = risks.filter((risk) => risk.level === "HIGH");
  if (highs.length < 2) return null;
  return {
    category: "急変リスク",
    level: "HIGH",
    detail:
      "複数の高リスク項目が重なっています。バイタルサインの頻回測定と、早期の医師報告基準の共有を行ってください。",
    evidence: highs.map((risk) => `${risk.category}: HIGH`),
  };
};

export const detectRisks = (input: HandoverInput): RiskItem[] => {
  const facts = extractFacts(input);
  const drafts: RiskDraft[] = [];

  const fever = feverRisk(facts);
  const intake = intakeRisk(facts);

  const candidates = [
    fever,
    spo2Risk(facts),
    respiratoryRisk(facts),
    fallRisk(facts, input),
    intake,
    dehydrationRisk(facts, fever?.level ?? null, intake?.level ?? null),
    urineRisk(facts),
    painRisk(facts),
    circulationRisk(facts),
    consciousnessRisk(facts),
    lineRisk(facts),
    woundRisk(facts),
    glucoseRisk(facts),
    allergyRisk(input, facts),
    infectionRisk(input),
  ];

  for (const candidate of candidates) {
    if (candidate) drafts.push(candidate);
  }

  const deterioration = deteriorationRisk(drafts);
  if (deterioration) drafts.unshift(deterioration);

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

const TASKS_BY_CATEGORY: Record<string, string[]> = {
  "発熱・再発熱": ["再発熱の有無（体温を4時間ごとに測定）", "解熱剤使用後の効果判定"],
  SpO2低下: ["SpO2の推移（安静時・労作時）", "酸素投与量と指示基準の確認"],
  呼吸状態悪化: ["呼吸数・呼吸音・努力呼吸の有無", "喀痰の性状と自己喀出の可否"],
  転倒リスク: [
    "歩行時・立位時のふらつきの有無",
    "転倒予防対策（ベッド柵・センサー・履物）の実施状況",
    "夜間のトイレ移動時の付き添い",
  ],
  食事摂取低下: ["毎食の食事摂取量", "嚥下状態と食事形態の適合"],
  脱水: ["水分摂取量と尿量のバランス", "口腔・皮膚の乾燥所見"],
  尿量低下: ["排尿回数と尿量", "下腹部膨満・残尿感の有無"],
  疼痛増強: ["疼痛スケール（NRS）の推移", "鎮痛剤使用後の効果と副作用"],
  循環動態の変動: ["血圧・脈拍の推移", "起立時のふらつき・冷汗の有無"],
  意識状態の変化: ["意識レベル（JCS）の評価", "夜間のせん妄・不穏の有無"],
  ルートトラブル: ["点滴ルート刺入部の発赤・腫脹・漏れ", "指示された輸液の滴下状況"],
  創部トラブル: ["創部の発赤・浸出液・ガーゼ汚染", "創部痛の程度"],
  血糖変動: ["血糖測定値の推移", "低血糖症状（冷汗・動悸・意識レベル）の有無"],
  アレルギー: ["新規薬剤投与前のアレルギー歴確認"],
  感染対策: ["感染対策（個人防護具）の実施状況"],
  急変リスク: ["バイタルサインの頻回測定と医師報告基準の確認"],
};

const BASELINE_TASKS = [
  "バイタルサインの測定と前勤務値との比較",
  "食事摂取量・水分摂取量の記録",
  "排泄回数と性状の確認",
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

  const doctorOrder = input.structured.doctorOrder.trim();
  if (doctorOrder) {
    push(`医師指示の実施・確認（${doctorOrder.slice(0, 40)}）`, "MEDIUM");
  }
  const examination = input.structured.examination.trim();
  if (examination) {
    push(`予定されている検査の準備と結果確認（${examination.slice(0, 30)}）`, "MEDIUM");
  }
  const family = input.structured.family.trim();
  if (family) push("家族対応の申し送り内容の確認", "LOW");

  for (const label of BASELINE_TASKS) push(label, "LOW");

  return tasks.slice(0, 14);
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

export const generateSbar = (
  input: HandoverInput,
  risks: RiskItem[],
): Sbar => {
  const { patient, structured, freeText } = input;
  const facts = extractFacts(input);
  const vitals = vitalsLine(facts, input);
  const topRisks = risks.filter((risk) => risk.level !== "LOW").slice(0, 3);

  const situationParts = [
    `${patient.room} ${patient.name}さん（${patient.age}歳・${genderLabel(patient.gender)}）。`,
    vitals ? `現在のバイタルは${vitals}。` : "",
    ...keySentences(freeText, 3).map((sentence) => `${sentence}。`),
    topRisks.length > 0
      ? `現時点で最も注意すべきは${topRisks.map((risk) => `${risk.category}（${risk.level}）`).join("、")}です。`
      : "",
  ];

  const backgroundParts = [
    `${formatJaDate(patient.admissionDate)}に${patient.primaryDiagnosis}で入院。主治医は${patient.attendingDoctor}。`,
    `ADLは${patient.adl}。`,
    `アレルギー: ${patient.allergies || "情報なし"}。コードステータス: ${patient.codeStatus}。`,
    `感染対策: ${patient.infectionControl}。`,
    structured.medication.trim() ? `内服・注射: ${structured.medication.trim()}。` : "",
    structured.treatment.trim() ? `実施中の処置: ${structured.treatment.trim()}。` : "",
  ];

  const assessmentParts =
    risks.length > 0
      ? risks
          .slice(0, 5)
          .map((risk) => `【${risk.level}】${risk.category}: ${risk.detail}`)
      : ["現時点で特記すべきリスクは抽出されていません。継続して経過を観察してください。"];

  const recommendationParts = [
    structured.doctorOrder.trim()
      ? `医師指示: ${structured.doctorOrder.trim()}`
      : "",
    ...generateNextShiftTasks(input, risks)
      .slice(0, 6)
      .map((task) => `・${task.label}`),
    structured.family.trim() ? `家族対応: ${structured.family.trim()}` : "",
  ];

  return {
    situation: situationParts.filter(Boolean).join(""),
    background: backgroundParts.filter(Boolean).join(""),
    assessment: assessmentParts.join("\n"),
    recommendation: recommendationParts.filter(Boolean).join("\n"),
  };
};

export const generateBriefSummary = (
  input: HandoverInput,
  risks: RiskItem[],
): string => {
  const { patient, structured, freeText } = input;
  const facts = extractFacts(input);
  const vitals = vitalsLine(facts, input);
  const highlights = keySentences(freeText, 2);
  const topRisks = risks.filter((risk) => risk.level !== "LOW").slice(0, 2);
  const topTasks = generateNextShiftTasks(input, risks).slice(0, 3);

  const sentences = [
    `${patient.room}、${patient.name}さん、${patient.age}歳${genderLabel(patient.gender)}、${patient.primaryDiagnosis}で${formatJaDate(patient.admissionDate)}入院です。`,
    highlights.length > 0 ? `${highlights.join("。")}。` : "",
    vitals ? `現在のバイタルは${vitals}です。` : "",
    structured.mealIntake.trim() ? `食事は${structured.mealIntake.trim()}。` : "",
    structured.infusion.trim() ? `点滴は${structured.infusion.trim()}。` : "",
    topRisks.length > 0
      ? `注意点は${topRisks.map((risk) => `${risk.category}（${risk.level}）`).join("と")}です。`
      : "",
    topTasks.length > 0
      ? `次勤務では${topTasks.map((task) => task.label).join("、")}をお願いします。`
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
