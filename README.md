# LeaveNow — React Native / Expo Go

可在 **VS Code** 持續開發的獨立 React Native 專案。介面使用 JavaScript / JSX、Expo Router；這是原生 View、Text、Pressable 等元件，不是 WebView 包裝網站。

## 最快開始（Mac + iPhone）

1. 在 VS Code 選 **File → Open Folder**，開啟本資料夾 `LeaveNow-Expo`，或開啟 `LeaveNow.code-workspace`。
2. iPhone 安裝 **Expo Go**，並讓 iPhone 和 Mac 連上相同 Wi-Fi。
3. VS Code Terminal 執行：

   ```sh
   npm install
   npm run dev
   ```

4. 用 **iPhone 相機**掃終端機 QR code，選擇用 Expo Go 開啟；若系統詢問區域網路存取，允許連到這台 Mac。
5. 儲存程式碼後會 Fast Refresh。完成後在終端機按 `Ctrl+C`，同時停止 Expo 和本機交通 API。

已安裝過依賴時只需要 `npm run dev`。不需要 OpenAI API key，也不會為播放已生成的聲音再次扣 API 點數。

需要 Node.js 22.13+；目前在 Node 24 測試。套件版本由 `package-lock.json` 鎖定，換電腦可用 `npm ci`。

## Expo Go 版本

本專案使用 **Expo SDK 57 / React Native 0.86.3 / React 19.2.3**，依你的 iPhone Expo Go 顯示的 SDK 57 版本配對。不要混用舊 SDK 54 的開發服務或 bundle；升級後可用 `npm run dev -- --clear --port 8083` 清除快取再掃新 QR code。

- [SDK 57 官方參考](https://docs.expo.dev/versions/v57.0.0/)
- [SDK 57 升級說明](https://expo.dev/changelog/sdk-57)

新增依賴使用 `npx expo install <package>`，讓版本符合 SDK。未來升級應整組升級 Expo SDK 與相依套件。

## 開發方式

| 指令                         | 用途                                                               |
| ---------------------------- | ------------------------------------------------------------------ |
| `npm run dev`                | 一次啟動 Expo Go 及本機交通 API；自動偵測 Mac 的 LAN IP，避開已佔用的 API 連接埠            |
| `npm run dev -- --port 8083` | Expo 使用其他連接埠                                                |
| `npm run dev -- --web`       | 同時開啟 React Native Web 預覽                                     |
| `npm start`                  | 只啟動 Expo；需要另行啟動 API 並設定其網址                         |
| `npm run api`                | 只啟動開發用交通 API（4174）                                       |
| `npm run check`              | ESLint、TypeScript 專案檢查、核心行為測試                      |
| `npx expo-doctor`            | Expo 依賴與設定相容性檢查                                          |
| `npm run export`             | 匯出 iOS / Android Hermes JS bundles 與 Web bundle；不是簽署安裝檔 |

JS/JSX 為目前主要語言；`tsconfig.json` 為日後加入 TypeScript 提供基礎，現有 JS 尚未開啟完整 `checkJs` 語意檢查。

## 程式碼位置

```text
src/app/                 Expo Router 原生畫面
  index.jsx              精簡首頁：吉祥物、目的地、時間規劃
  settings.jsx           設定、Demo 入口、About LeaveNow
  voice.jsx              語音開關、試聽與自訂錄音入口
  place.jsx              Home / Uni / Work / 自訂與一次性目的地
  preparation.jsx        準備活動提示與本次總分鐘數
  routes.jsx             真實交通班次、步行與替代旅程
  trip.jsx               開始 / 完成準備、倒數、出門、鬧鐘匯入
  feedback.jsx           大類 → 多選細節，可略過
  result.jsx             回饋結果、解鎖與 AI 建議
  crew.jsx               8 個角色與累積成功日
  recordings.jsx         4 種自訂提醒錄音（手機）
  privacy.jsx            平常時間、樣本排除、刪除紀錄
src/components/          共用視覺、吉祥物、原生時間選擇器
src/state/               AsyncStorage 狀態、Demo 隔離與音訊
src/domain/              由原網頁版本保留的純 JS 規則
src/services/            API、聲音資產、Hermes 相容處理
assets/                  吉祥物圖集、Ballad 澳洲英文音檔
server/                  Node 開發交通 API，沿用原 Translink 解析邏輯
tools/dev.mjs            一鍵啟動工具
```

畫面樣式主要在 `src/components/ui.jsx`。首頁比例在 `src/app/index.jsx`。改角色台詞可看 `src/domain/companion.mjs`；改文字不會自動重製已生成的音檔。

## 已移植的互動

- Home 固定出發；Uni、Work、自訂常用地點與一次性目的地。
- iOS 原生日期／時間選擇器。所有計畫以 Brisbane 時區計算。
- 七個可略過的準備活動提示；只設定本次總準備時間，不改平常設定。
- 真實 Translink 位置搜尋與路線規劃；準備時間參與班次可行性與開始準備時間計算。
- 前景倒數、開始準備與出門語音、Start / Ready 實測總時長。
- 3 筆實測開始個人平均估計、8 筆納入時間情境；接受、修改或保留。
- 二層回饋、計畫／紀錄時長比較、不因錯過或交通問題自動增加準備時間。
- 吉祥物表情與說話動作、關閉語音／動畫、尊重系統減少動態設定。
- 8 個交通角色、1/3/7/21/66 個累積成功日，依 Brisbane 出門日去重。
- Demo 與真實狀態隔離，完整準備 → 出門 → 回報 → 解鎖；收藏頁可切換示範里程碑。
- 4 種短錄音、字幕、先聽再存、刪除；本機保存、不做聲音複製。Demo 不保存麥克風錄音。
- 獨立的設定、資料來源與學生概念標示。

## 真實交通資料如何連線

`npm run dev` 同時啟動本機 `server/index.mjs`，自動以 `EXPO_PUBLIC_API_BASE_URL=http://<Mac LAN IP>:4174` 連接。Mac 必須保持開機、同 Wi-Fi，且允許 Node 接受區域網路連線。Demo 不需要交通 API。

這個轉接服務只處理 `/api/locations`、`/api/plan`、`/health`；不儲存或列印使用者地址。活動、回饋和錄音不放進交通查詢。依賴 Translink 網站的公開端點，並非具 SLA 的正式第三方 API；格式或可用性變動時會顯示錯誤及官方連結。**班次是真實規劃結果，但沒有宣稱即時預測已確認。**

若 Mac 有 VPN 或多網卡導致自動偵測錯誤，可參照 `.env.example`，在終端機明確設定：

```sh
EXPO_PUBLIC_API_BASE_URL=http://你的Mac區域網路IP:4174 npm run dev
```

`EXPO_PUBLIC_*` 是可見的 App 設定，不能放秘密金鑰。不要把原私人 Sites 網址直接填為 API；Expo Go 不會共用 Safari 的登入 cookie。若將來要離開家中 Wi-Fi 獨立使用，需把這個轉接服務另行部署到 HTTPS 主機，或換成有正式授權的交通 API。本機 API 不應直接暴露到公網。

## 鎖屏提醒：與已安裝 iPhone App 的關係

Expo Go 不包含自訂 AlarmKit 原生模組。這一版只在 App 前景播放角色語音；背景／鎖屏不宣稱準時播放。

旅程頁的 **Set iPhone lock-screen alarms** 保留原本 `leavenow://alarms` 交接協定，可以開啟先前已安裝的 **LeaveNow Alarms**，讓你在原生 App 確認排程。首次安裝 LeaveNow Expo 本身不會安裝那個鬧鐘 App。要把 AlarmKit 整合進同一個 App，下一步需要 Expo development build 與 Swift 原生模組。

開啟外部 App 不等於成功設定鬧鐘。變更、取消或完成旅程後，已匯入的鬧鐘仍需在 LeaveNow Alarms 內更新／取消。自訂錄音與 Ballad 不會自動成為該 App 的鎖屏鬧鐘聲音。

## 本機資料與素材

- 原 Safari 網站、Expo Go、LeaveNow Alarms 三者目前不自動同步資料。
- 所有實際 Start / Ready 記錄、回饋與角色天數放在 Expo Go 的 AsyncStorage；錄音放在此 App 的文件目錄。
- Ballad 音檔已隨專案打包，沒有內嵌 API key；播放不呼叫 OpenAI。
- Bluey／Bingo 與交通業者相關設計仍是學生概念素材。轉成 React Native 不會改變其權利狀態；商業發布前需處理授權或替換原創角色。

## 驗證與待做

已完成 lint、專案檢查、核心行為測試、Expo doctor，以及 iOS / Android / Web bundle 匯出。以 React Native Web 做了手機尺寸操作驗證：Demo 的活動提示、40 分鐘本次估計、實測示例、回報、解鎖、退出 Demo 後真實進度不變；交通提前回饋保持平常準備時間不變。也以公開地點完成真實 Translink 搜尋與班次查詢。原生權限、iPhone 麥克風、音訊與 AlarmKit 交接仍需在實機測試；bundle 匯出不等於實機驗證。

開發依賴目前仍有 npm audit 的上游警示（包含 Metro/Jest/Expo 工具鏈）。已執行不跨版本的修補；未用 `--force` 破壞 Expo Go 相容性。這是本機開發／課程原型，正式發布前應重新評估支援的 SDK、開發伺服器與套件安全更新。

來源基準：原 LeaveNow 網站 commit `3932b9b1b1103b0963451243677f98bb43692ccf`（2026-10-14）。網頁與原 Swift 鬧鐘專案仍各自保留；此專案不需要其資料夾即可開發。

若 4174 已被使用，`npm run dev` 會選用 4175–4184 的空閒連接埠，並自動把正確 API 網址交給 Expo。請使用這次啟動後終端機顯示的新 QR code。
