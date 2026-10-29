import type { MessageKey } from "@/i18n/dictionary";

import { api, ApiFailure } from "./api";
import { errorKey } from "./errors";

interface VoiceResult {
  proposal: { id: string };
  question: string | null;
  rejected: string[];
}

const extrasKey = (id: string) => `sv_proposal_${id}`;

// Turns an uploaded clip into a proposal (doc 02 voice pipeline). The
// clarifying question and left-out items aren't stored with the proposal,
// so they ride along to the Check and confirm screen in this tab's storage.
export async function submitVoice(path: string, kind: "SETUP" | "COMMAND"): Promise<string> {
  const result = await api<VoiceResult>("/api/v1/proposals/voice", { json: { path, kind } });
  try {
    sessionStorage.setItem(extrasKey(result.proposal.id), JSON.stringify({ question: result.question, rejected: result.rejected }));
  } catch {
    // Private mode: the screen just won't show the question.
  }
  return result.proposal.id;
}

export function proposalExtrasRaw(id: string): string | null {
  try {
    return sessionStorage.getItem(extrasKey(id));
  } catch {
    return null;
  }
}

export function parseExtras(raw: string | null): { question: string | null; rejected: string[] } {
  try {
    if (raw) return JSON.parse(raw) as { question: string | null; rejected: string[] };
  } catch {
    // Unreadable: nothing extra to show.
  }
  return { question: null, rejected: [] };
}

// What the voice pipeline's failures mean for the owner (doc 05: the
// recording is saved, so "try again" reuses it).
export function voiceErrorKey(error: unknown): MessageKey {
  if (error instanceof ApiFailure) {
    if (error.code === "NOTHING_HEARD") return "mic.error.nothingHeard";
    if (error.code === "AI_PAUSED") return "mic.paused";
    if (error.code === "AI_UNAVAILABLE" || error.code === "AI_NOT_UNDERSTOOD") return "mic.error.notUnderstood";
    if (error.code === "BAD_AUDIO" || error.code === "UPLOAD_MISSING") return "mic.error.badAudio";
  }
  return errorKey(error);
}
