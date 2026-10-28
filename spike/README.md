# Day-1 spike

Doc 09's spike proves the unknowns behind the plan before features are built on them. Each check gets PASS, FAIL, BLOCKED or NOT RUN, with evidence in `evidence/` (requests and responses, API key removed).

Run any script from the repo root, for example `node spike/s2-structured.mjs`. They read `META_API_KEY` from `.env.local` and call the live Meta Model API, so they spend a little credit.

## Results (Oct 29, 2026, from a laptop in India)

| Check | Status | Evidence | Finding |
|---|---|---|---|
| S0 Credit and key | **PASS** (end date assumed) | `s1-models.json` | The key works. `META_CREDIT_ENDS_AT` is set to 2026-11-05 07:30 IST, the submission deadline, until the real end date is confirmed in the Meta dashboard or with the organisers (errata E-03) |
| S1 Meta API reachable from India | **PASS** from India; Vercel bom1 **NOT RUN** | `s1-models.json`, `s1-responses.json` | `GET /models` and `POST /responses` return 200 from India. The bom1 half runs once the Vercel project exists (W-03, checkpoint C-07) |
| S2 Structured output | **PASS** | `s2-structured.json` | 10 of 10 transcripts (Hinglish, English, Devanagari, fillers, a spoken correction) returned JSON that passed the Zod schema through `text.format`. 0 invented values. 3.7–9.2 s per call; $0.0375 for all ten |
| S3 Transcribe request and response shape | **PASS** for the request and response format; `keywords` and `languageBias` **not confirmed** | `s3-*.json` | See "Transcription API" below. The API ignores unknown fields, so whether keywords and language bias take effect can only be measured with real speech in S4 |
| S4 Hinglish accuracy | **NOT RUN** | — | Needs 20 real clips from the team (checkpoint C-09). Run them with and without `keywords` to confirm the parameter works |
| S5 SAM 3.1 masks | **NOT RUN** | — | Needs one shelf photo (C-09) |
| S6 Region latency | **NOT RUN** | — | Measured against the production project in ap-south-1 (errata E-28), which doesn't exist yet |

## What the spike established

### Muse Spark (Responses API)

- Endpoint `POST https://api.meta.ai/v1/responses`, model `muse-spark-1.3`, bearer key.
- **Reasoning effort defaults to `high`.** A 16-token test spent 14 tokens reasoning and returned `status: "incomplete"`. Set `reasoning: { effort: "low" }` for extraction (doc 02) and allow enough `max_output_tokens`.
- **The raw response has no `output_text` field.** The text is in the `output` item with `type: "message"`, in its `content` part with `type: "output_text"`.
- Structured output works with `text: { format: { type: "json_schema", name, strict: true, schema } }`. Nullable fields are written as `"type": ["string", "null"]`.
- `GET /models` lists `muse-spark-1.3`, `muse-voice-transcribe-1.0`, `sam-3.1`, plus contributor-tier variants that Shelf Voice must not use (doc 02).

### Transcription API

- Endpoint `POST https://api.meta.ai/v1/asr/transcribe`, multipart with exactly two parts:
  - `request`: JSON, `{ "model": "muse-voice-transcribe-1.0", "audioEncoding": "WAV", "mode": "PUSH_TO_TALK", "keywords": [...], "languageBias": [...] }`. `audioEncoding` is required, and `"WAV"` is accepted.
  - `audio`: the WAV file (16 kHz mono 16-bit, encoded in the browser per doc 02).
- Response: `{ "sessionId", "transcript", "audioDurationMs", "turns": [] }`. A 2-second tone gave an empty transcript, not invented words.
- Validation: unknown fields and a nonsense `languageBias` value are accepted silently; an invalid `mode` returns 400 "Malformed request". So `mode` is a real field, while `keywords`, `languageBias` and `sampleRateHertz` may be ignored. S4 must test them.

### Prompt notes for W-09

S2 passed on schema and invented values. These are prompt improvements, not failures:
- `category` was always null because the prompt doesn't ask for it.
- Pack sizes stay inside names ("Dettol 125 ml" with no unit).
- Filler words stay in names ("Parle-G ka chhota wala").
