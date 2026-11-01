# LeaveNow — React Native / Expo Go

English | [繁體中文](README.zh-TW.md)

LeaveNow is a departure assistant for Brisbane, Queensland. It plans when to start getting ready and when to leave the house, based on real Translink journeys and how long you actually take to get ready.

This is a standalone React Native project you can keep developing in **VS Code**. The UI is written in JavaScript / JSX with Expo Router, using native `View`, `Text`, `Pressable` and similar components. It is not a website wrapped in a WebView.

> Independent student project. Not an official Translink service.

## Quick start (Mac + iPhone)

1. In VS Code, choose **File → Open Folder** and open this folder, or open `LeaveNow.code-workspace`.
2. Install **Expo Go** on your iPhone, and connect the iPhone and the Mac to the same Wi-Fi network.
3. In the VS Code terminal, run:

   ```sh
   npm install
   npm run dev
   ```

4. Scan the QR code in the terminal with the **iPhone Camera** and open it in Expo Go. If iOS asks for local network access, allow it to connect to your Mac.
5. Saving code triggers Fast Refresh. When you are done, press `Ctrl+C` in the terminal to stop both Expo and the local transport API.

Once dependencies are installed, you only need `npm run dev`. No OpenAI API key is needed, and playing the pre-generated voice clips does not use any API credits.

Requires Node.js 22.13 or later; currently tested on Node 24. Package versions are locked in `package-lock.json`, so on a new machine you can use `npm ci`.

## Expo Go version

This project uses **Expo SDK 57 / React Native 0.86.3 / React 19.2.3**, matched to the SDK 57 version shown in Expo Go on the iPhone. Do not mix in dev servers or bundles from the old SDK 54. After an upgrade, run `npm run dev -- --clear --port 8083` to clear the cache, then scan the new QR code.

- [SDK 57 reference](https://docs.expo.dev/versions/v57.0.0/)
- [SDK 57 changelog](https://expo.dev/changelog/sdk-57)

Add dependencies with `npx expo install <package>` so versions match the SDK. Future upgrades should move the Expo SDK and its dependencies together.

## Development commands

| Command                      | What it does                                                                                            |
| ---------------------------- | ------------------------------------------------------------------------------------------------------- |
| `npm run dev`                | Starts Expo Go and the local transport API together; detects the Mac's LAN IP and skips a busy API port |
| `npm run dev -- --port 8083` | Runs Expo on a different port                                                                           |
| `npm run dev -- --web`       | Also opens the React Native Web preview                                                                 |
| `npm start`                  | Starts Expo only; you need to start the API separately and set its URL                                  |
| `npm run api`                | Starts only the development transport API (port 4174)                                                   |
| `npm run check`              | ESLint, TypeScript project check and core behaviour tests                                               |
| `npx expo-doctor`            | Checks Expo dependency and config compatibility                                                         |
| `npm run export`             | Exports iOS / Android Hermes JS bundles and the Web bundle; this is not a signed installable build      |

JS/JSX is the main language for now. `tsconfig.json` is there as a base for adding TypeScript later; full `checkJs` checking is not yet enabled for the existing JS.

## Where the code lives

```text
src/app/                 Expo Router native screens
  index.jsx              Minimal home screen: mascot, destination, time planning
  settings.jsx           Settings, Demo entry, About LeaveNow
  voice.jsx              Voice on/off, preview and custom recordings entry
  place.jsx              Home / Uni / Work / custom and one-off destinations
  preparation.jsx        Preparation activity prompts and total minutes for this trip
  routes.jsx             Real transit services, walking and alternative journeys
  trip.jsx               Start / finish getting ready, countdown, leave, alarm import
  feedback.jsx           Category → multi-select details, skippable
  result.jsx             Feedback result, unlocks and AI suggestions
  crew.jsx               8 characters and cumulative success days
  recordings.jsx         4 custom reminder recordings (phone)
  privacy.jsx            Usual times, excluding samples, deleting records
src/components/          Shared UI, mascot, native date/time picker
src/state/               AsyncStorage state, Demo isolation and audio
src/domain/              Pure JS rules kept from the original web version
src/services/            API, voice assets, Hermes compatibility
assets/                  Mascot sprites, Ballad Australian English voice clips
server/                  Node development transport API, reusing the original Translink parsing logic
tools/dev.mjs            One-command startup tool
```

Most styling lives in `src/components/ui.jsx`. Home screen proportions are in `src/app/index.jsx`. Character lines are in `src/domain/companion.mjs`; editing the text does not regenerate the existing voice clips.

## Features ported from the web version

- Fixed Home starting point; Uni, Work, custom saved places and one-off destinations.
- Native iOS date and time pickers. All plans are calculated in Brisbane time.
- Seven optional preparation activity prompts. You set the total preparation time for this trip only, without changing your usual setting.
- Real Translink location search and journey planning. Preparation time is used to check which services are feasible and when to start getting ready.
- Foreground countdown, voice prompts to start getting ready and to leave, and measured Start / Ready totals.
- A personal average estimate starts after 3 measured records, and time-of-day context is included after 8; you can accept, edit or keep your setting.
- Two-level feedback and planned vs. recorded duration comparison. Missed services or transit problems never automatically add preparation time.
- Mascot expressions and talking animation; voice and animation can be turned off, and the system Reduce Motion setting is respected.
- 8 transit characters unlocked at 1 / 3 / 7 / 21 / 66 cumulative success days, counted once per Brisbane departure day.
- Demo mode is isolated from real data and walks through prepare → leave → report → unlock; the collection screen can switch between demo milestones.
- 4 short recordings with captions, listen-before-save and delete. Stored on the device only, with no voice cloning. Demo mode never saves microphone recordings.
- Separate settings, data source notes and student-concept labels.

## How real transit data connects

`npm run dev` also starts the local `server/index.mjs` and points the app at it with `EXPO_PUBLIC_API_BASE_URL=http://<Mac LAN IP>:4174`. The Mac must stay on, be on the same Wi-Fi, and allow Node to accept local network connections. Demo mode does not need the transit API.

This proxy only handles `/api/locations`, `/api/plan` and `/health`. It does not store or log user addresses. Activities, feedback and recordings are never sent with transit requests. It relies on public endpoints of the Translink website, not a third-party API with an SLA; if their format or availability changes, the app shows an error and a link to the official site. **Services are real journey-planner results, but the app does not claim they are confirmed real-time predictions.**

If a VPN or multiple network interfaces make auto-detection pick the wrong address, set it explicitly in the terminal, as shown in `.env.example`:

```sh
EXPO_PUBLIC_API_BASE_URL=http://<your-Mac-LAN-IP>:4174 npm run dev
```

`EXPO_PUBLIC_*` values are visible app configuration, so never put secret keys in them. Do not use the original private Sites URL as the API; Expo Go does not share Safari's login cookies. To use the app away from your home Wi-Fi, deploy this proxy to an HTTPS host or switch to a properly licensed transit API. Do not expose the local API directly to the internet.

If port 4174 is already in use, `npm run dev` picks a free port between 4175 and 4184 and passes the correct API URL to Expo. Use the new QR code shown in the terminal for that run.

## Lock-screen reminders and the installed iPhone app

Expo Go does not include the custom AlarmKit native module. This version only plays character voice prompts while the app is in the foreground; it does not claim to play on time in the background or on the lock screen.

On the trip screen, **Set iPhone lock-screen alarms** keeps the original `leavenow://alarms` hand-off, which opens the previously installed **LeaveNow Alarms** app so you can confirm the schedule in that native app. Installing LeaveNow Expo does not install the alarm app. Bringing AlarmKit into the same app needs an Expo development build and a Swift native module.

Opening the external app does not mean the alarms were set. If you change, cancel or finish a trip, update or cancel the imported alarms in LeaveNow Alarms. Custom recordings and Ballad clips do not become that app's lock-screen alarm sounds.

## Local data and assets

- The original Safari website, Expo Go and LeaveNow Alarms do not sync data with each other.
- All real Start / Ready records, feedback and character days are stored in Expo Go's AsyncStorage; recordings are stored in this app's document directory.
- Ballad voice clips are bundled with the project with no API key embedded; playback does not call OpenAI.
- Bluey / Bingo and transit-operator-related designs are student concept assets. Moving to React Native does not change their rights status; before any commercial release, they need licensing or replacement with original characters.

## Verification and to-do

Done: lint, project check, core behaviour tests, Expo doctor, and iOS / Android / Web bundle export. Phone-size interaction was checked in React Native Web: Demo activity prompts, the 40-minute estimate for this trip, measured examples, reporting, unlocking, and real progress staying unchanged after leaving Demo; feedback about an early service keeps the usual preparation time unchanged. Real Translink search and journey lookups were also completed with public locations. Native permissions, the iPhone microphone, audio and the AlarmKit hand-off still need testing on a real device; a bundle export is not device verification.

Dev dependencies still show upstream `npm audit` warnings (including the Metro / Jest / Expo toolchain). Non-breaking fixes have been applied; `--force` was not used, to avoid breaking Expo Go compatibility. This is a local development / course prototype; before a public release, re-evaluate the supported SDK, dev server and package security updates.

Source baseline: original LeaveNow website commit `3932b9b1b1103b0963451243677f98bb43692ccf` (2026-10-14). The website and the original Swift alarm project are kept separately; this project does not need their folders for development.
