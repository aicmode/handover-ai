/** 条件付きのクラス名を結合する小さなヘルパー。 */
export const cn = (
  ...values: Array<string | false | null | undefined>
): string => values.filter(Boolean).join(" ");
