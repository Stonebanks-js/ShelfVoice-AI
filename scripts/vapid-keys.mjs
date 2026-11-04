// Makes a VAPID key pair for web push and writes it to a file, so the
// private key is never printed. Usage: node scripts/vapid-keys.mjs <out-file>
import { generateKeyPairSync } from "node:crypto";
import { writeFileSync } from "node:fs";

const out = process.argv[2];
if (!out) throw new Error("Usage: node scripts/vapid-keys.mjs <out-file>");
const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const jwkPublic = publicKey.export({ format: "jwk" });
const jwkPrivate = privateKey.export({ format: "jwk" });
// The public key as an uncompressed point (0x04 || x || y), base64url.
const point = Buffer.concat([Buffer.from([4]), Buffer.from(jwkPublic.x, "base64url"), Buffer.from(jwkPublic.y, "base64url")]);
writeFileSync(out, `VAPID_PUBLIC_KEY=${point.toString("base64url")}\nVAPID_PRIVATE_KEY=${jwkPrivate.d}\n`, { mode: 0o600 });
console.log(`Wrote a VAPID key pair to ${out}`);
