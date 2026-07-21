# Build Android (Capacitor)

Le client web est packagé en application Android via **Capacitor**. Le dossier natif
`android/` est **généré** (gitignoré) — reproductible via les étapes ci-dessous.

## Prérequis

- JDK 17, Android SDK (platforms 34+, build-tools 34+), Gradle.
- `ANDROID_HOME` pointant sur le SDK.

## Étapes

```bash
# 1. Build web (génère dist/ + PWA)
npm run build

# 2. Ajout de la plateforme Android (une fois)
npx cap add android

# 3. Permissions de localisation — ajouter dans
#    android/app/src/main/AndroidManifest.xml :
#    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
#    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />

# 4. Synchroniser le web + les plugins à chaque changement
npx cap sync android

# 5. Construire l'APK debug
cd android && ./gradlew assembleDebug
# → app/build/outputs/apk/debug/app-debug.apk
```

## Notes

- Le GPS natif passe par `@capacitor/geolocation` (voir `src/input/GeolocationSource.ts`),
  avec repli automatique sur l'API web du navigateur.
- Le client cible ses backends via `VITE_GAME_URL` / `VITE_CAMPAIGN_URL` au build.
- Pour un APK release signé : configurer un keystore et `./gradlew assembleRelease`.
