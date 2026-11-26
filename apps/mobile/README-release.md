# booqi Business — mobil release (Android/iOS)

Workflow: `.github/workflows/release-mobile.yml`. Çatışmayan secret olan addım xəbərdarlıqla keçilir, build düşmür.

## GitHub-a əlavə ediləcək secret-lər (Settings > Secrets and variables > Actions)
- `FIREBASE_SERVICE_ACCOUNT_JSON` — Firebase console > Project settings (booqi-9ecc8) > Service accounts > Generate new private key; JSON faylın bütün məzmunu.
- `FIREBASE_ANDROID_APP_ID` — Firebase > Project settings > Your apps > az.booqi.business (Android) > App ID (`1:...:android:...`). Əvvəl bu app-i Firebase-də əlavə et. Secret və ya Variable ola bilər.
- `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` — customer-new-app repo-dakı eyni keystore-u təkrar istifadə et (dəyərləri oradakından köçür) və ya yenisini yarat (`keytool -genkey ...`, sonra `base64 -i release.keystore`). Yoxdursa APK debug açarı ilə imzalanır.
- `APPLE_TEAM_ID` (YFLCTZJ668), `ASC_ISSUER_ID`, `ASC_KEY_ID`, `ASC_KEY_P8` — App Store Connect > Users and Access > Integrations > App Store Connect API; `.p8` faylı base64 ilə (`base64 -i AuthKey_X.p8`). Əvvəl App Store Connect-də `az.booqi.business` app-i yaradılmalıdır. Yoxdursa iOS imzasız simulyator build-i verir (TestFlight yoxdur).

## İşə salma
GitHub > Actions > release-mobile > Run workflow: version (məs. `0.1.0`), android / ios / distribute seç.
Və ya tag: `business-android-v0.1.1`, `business-ios-v0.1.1` push et.
Android: APK GitHub Release-ə və Firebase `testers` qrupuna gedir. iOS (macOS, 10x dəqiqə): TestFlight-a yüklənir.
