// Run after `expo prebuild`: makes the release build type use the CI keystore.
// Reads env: ANDROID_KEYSTORE_PATH, ANDROID_KEYSTORE_PASSWORD, ANDROID_KEY_ALIAS, ANDROID_KEY_PASSWORD.
const fs = require("fs");
const p = "android/app/build.gradle";
let s = fs.readFileSync(p, "utf8");
const release = `
        release {
            storeFile file(System.getenv("ANDROID_KEYSTORE_PATH"))
            storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD")
            keyAlias System.getenv("ANDROID_KEY_ALIAS")
            keyPassword System.getenv("ANDROID_KEY_PASSWORD")
        }`;
if (!/signingConfigs\s*\{/.test(s)) throw new Error("signingConfigs block not found");
s = s.replace(/signingConfigs\s*\{/, (m) => m + release);
const i = s.indexOf("buildTypes");
const j = s.indexOf("release {", i);
if (i < 0 || j < 0) throw new Error("release buildType not found");
const head = s.slice(0, j);
let tail = s.slice(j);
if (!/signingConfig signingConfigs\.debug/.test(tail)) throw new Error("release signingConfig line not found");
tail = tail.replace(/signingConfig signingConfigs\.debug/, "signingConfig signingConfigs.release");
fs.writeFileSync(p, head + tail);
const abis = (process.env.ANDROID_ABIS || "").split(",").filter(Boolean);
if (abis.length) {
  let t = fs.readFileSync(p, "utf8");
  if (!/defaultConfig\s*\{/.test(t)) throw new Error("defaultConfig block not found");
  t = t.replace(/defaultConfig\s*\{/, (m) => m + `\n        ndk { abiFilters ${abis.map((a) => `"${a}"`).join(", ")} }`);
  const drop = ["x86", "x86_64", "arm64-v8a", "armeabi-v7a"].filter((a) => !abis.includes(a));
  t = t.replace(/\bandroid\s*\{/, (m) => m + `\n    packagingOptions { jniLibs { excludes += [${drop.map((a) => `"lib/${a}/**"`).join(", ")}] } }`);
  fs.writeFileSync(p, t);
  console.log("abiFilters injected: " + abis.join(","));
}
console.log("release signing injected");
