# Фаза 2: упаковка в Android (Capacitor)

Первая версия приложения — статический сайт + PWA. Для установки как APK используйте **Capacitor** (рекомендуется) или Cordova.

## Предварительные условия

- Установлены [Node.js](https://nodejs.org/) и npm.
- Для сборки Android: Android Studio, JDK и переменная `ANDROID_HOME`.

## Capacitor

1. В корне веб-проекта (где лежит `index.html`):

   ```bash
   npm init -y
   npm install @capacitor/core @capacitor/cli @capacitor/android
   npx cap init "ННО Тренажёр" com.example.nnctrainer --web-dir .
   ```

2. Добавить платформу Android:

   ```bash
   npx cap add android
   ```

3. Скопировать статические файлы в каталог, который указан в `capacitor.config` как `webDir` (если оставили `.`, текущая папка уже подходит).

4. Синхронизация:

   ```bash
   npx cap sync android
   ```

5. Открыть проект в Android Studio: `npx cap open android`, затем **Run** на устройстве или эмуляторе.

6. Иконки и splash: замените ресурсы в `android/app/src/main/res/` или используйте плагины `@capacitor/assets` по документации Capacitor.

## Важно

- Приложение использует **ES-модули** (`import` в `js/app.js`). Загрузка с `file://` в WebView обычно настраивается Capacitor автоматически при использовании `capacitor://` или локального сервера — при проблемах проверьте `server` в `capacitor.config.ts`.
- Для продакшена имеет смысл собрать минифицированный бандл (Vite/Rollup) и указать `webDir` на папку `dist`.

## Локальный просмотр в браузере

Из папки проекта:

```bash
npx serve .
```

Откройте указанный URL — так корректно подгрузятся JSON-справочники и модули.

## Cordova (альтернатива)

```bash
npm install -g cordova
cordova create nnvc com.example.nnctrainer "ННО Тренажёр"
# Скопируйте содержимое этого проекта в www/
cordova platform add android
cordova build android
```

Убедитесь, что `config.xml` указывает `index.html` в `www/` и включена поддержка `file://` для модулей при необходимости (иногда проще отдавать приложение через `cordova-plugin-whitelist` и локальный HTTP).
