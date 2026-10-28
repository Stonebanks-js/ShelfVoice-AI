// Spike S0 and S1 (doc 09): the key works, and Muse Spark answers from India.
// Usage: node spike/s1-reachability.mjs
import { call, saveEvidence } from "./meta.mjs";

const models = await call("GET", "/models");
console.log(`GET /models -> ${models.status} in ${models.latencyMs} ms`);
const ids = Array.isArray(models.body?.data) ? models.body.data.map((m) => m.id) : [];
if (ids.length) console.log(`models: ${ids.join(", ")}`);
else console.log("body:", JSON.stringify(models.body).slice(0, 400));
console.log(`evidence: ${saveEvidence("s1-models", models)}`);

const reply = await call("POST", "/responses", {
  json: {
    model: "muse-spark-1.3",
    input: "Reply with the single word: ok",
    max_output_tokens: 16,
  },
});
console.log(`POST /responses -> ${reply.status} in ${reply.latencyMs} ms`);
const text = reply.body?.output_text ?? JSON.stringify(reply.body).slice(0, 500);
console.log("reply:", text);
if (reply.body?.usage) console.log("usage:", JSON.stringify(reply.body.usage));
console.log(`evidence: ${saveEvidence("s1-responses", reply)}`);
