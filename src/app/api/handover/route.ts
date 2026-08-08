import { NextResponse } from "next/server";
import { generateHandover, isAiConfigured } from "@/lib/handover-ai";
import { emptyStructuredNote } from "@/lib/demo-data";
import type { HandoverInput, Patient, StructuredNote } from "@/lib/types";

/**
 * 申し送り生成API。
 * APIキーはサーバー側の環境変数からのみ参照するため、
 * クライアントはこのRoute Handler経由でAI処理を呼び出す。
 */

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const parseInput = (body: unknown): HandoverInput | null => {
  if (!isRecord(body)) return null;
  if (!isRecord(body.patient)) return null;
  if (typeof body.freeText !== "string") return null;
  if (!isRecord(body.structured)) return null;

  return {
    patient: body.patient as unknown as Patient,
    freeText: body.freeText,
    structured: {
      ...emptyStructuredNote(),
      ...(body.structured as unknown as StructuredNote),
    },
  };
};

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const input = parseInput(body);
  if (!input) {
    return NextResponse.json(
      { error: "patient / freeText / structured are required" },
      { status: 400 },
    );
  }

  const result = await generateHandover(input);
  return NextResponse.json({ result });
}

export async function GET() {
  return NextResponse.json({ aiConfigured: isAiConfigured() });
}
