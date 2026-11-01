// Generates the Android app (a Trusted Web Activity) in android/ with
// Bubblewrap (npm i -g @bubblewrap/cli). The app opens shelfvoice.vercel.app
// full screen in Chrome; public/.well-known/assetlinks.json proves the link.
//
// Usage: node scripts/android-project.mjs [manifest URL]
// The icons are read from the given manifest URL (a local `pnpm start` works
// before a release); twa-manifest.json always points at the live site.
// Then build: cd android && bubblewrap build --skipPwaValidation
import { execSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);

const globalModules = execSync("npm root -g").toString().trim();
const cli = path.join(globalModules, "@bubblewrap", "cli");
const core = require(path.join(cli, "node_modules", "@bubblewrap", "core"));
const { computeChecksum } = require(path.join(cli, "dist", "lib", "cmds", "shared.js"));

const HOST = "shelfvoice.vercel.app";
const LIVE = `https://${HOST}`;
const source = process.argv[2] ?? `${LIVE}/manifest.webmanifest`;
const keyDir = path.join(os.homedir(), ".shelfvoice-android");
const target = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "android");

{
  const twa = await core.TwaManifest.fromWebManifest(source);
  Object.assign(twa, {
    packageId: "app.vercel.shelfvoice.twa",
    host: HOST,
    name: "Shelf Voice",
    launcherName: "Shelf Voice",
    startUrl: "/",
    enableNotifications: true, // order alerts reach the owner through the app
    enableSiteSettingsShortcut: true,
    fallbackType: "customtabs",
    orientation: "portrait",
    minSdkVersion: 24, // Android 7.0: what androidbrowserhelper 2.7 needs
    appVersionCode: 1,
    appVersionName: "1.0.0",
    signingKey: { path: path.join(keyDir, "shelfvoice-upload.keystore"), alias: "shelfvoice" },
    fingerprints: [{ name: "upload key", value: fs.readFileSync(path.join(keyDir, "sha256.txt"), "utf8").trim() }],
    // The phone's navigation bar matches the app's background, light or dark.
    navigationColor: twa.themeColor,
    navigationDividerColor: twa.themeColor,
  });
  fs.mkdirSync(target, { recursive: true });
  await new core.TwaGenerator().createTwaProject(target, twa, new core.ConsoleLog("android"));
  // Saved with the live site's URLs, whatever manifest the icons came from.
  const manifestFile = path.join(target, "twa-manifest.json");
  await twa.saveToFile(manifestFile);
  const live = (file) => fs.writeFileSync(file, fs.readFileSync(file, "utf8").split(new URL(source).origin).join(LIVE));
  live(manifestFile);
  live(path.join(target, "app", "build.gradle"));
  // The launcher must be exported: the home screen icon and the shop's https
  // links open it. Reviewed for Semgrep, which flags every exported activity.
  const androidManifest = path.join(target, "app", "src", "main", "AndroidManifest.xml");
  fs.writeFileSync(
    androidManifest,
    fs
      .readFileSync(androidManifest, "utf8")
      .replace(
        '<activity android:name="LauncherActivity"',
        '<!-- nosemgrep: java.android.security.exported_activity.exported_activity (the launcher and https links need it) -->\n        <activity android:name="LauncherActivity"',
      ),
  );
  const json = fs.readFileSync(manifestFile, "utf8");
  fs.writeFileSync(path.join(target, "manifest-checksum.txt"), computeChecksum(Buffer.from(json)));
  console.log(`Android project written to ${target}`);
}
