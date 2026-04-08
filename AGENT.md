# AGENT.md

## 專案概述
本專案是「生字考試」的純前端靜態網站，提供：
- 課程選擇
- 挖空題作答（可逐字填答）
- 手寫畫布作答（含橡皮擦）
- 錯題/完成檢視
- 自訂題庫（新增、編輯、刪除）

不依賴後端 API，資料來源為本地 `lessons.js`，使用 `localStorage` 做使用者題庫持久化。

## 目錄與檔案職責
- `index.html`：頁面結構與元件容器（課程側欄、作答區、檢視區、題庫對話框、模板）
- `styles.css`：版面樣式、互動狀態樣式、RWD 規則
- `lessons.js`：課程資料（`window.LESSONS`）
- `app.js`：主要應用邏輯（狀態管理、渲染、事件、畫布、題庫 CRUD、儲存）
- `serve.ps1`：本機靜態檔案伺服器（PowerShell TCP listener）

## 執行方式
在 `myquiz` 目錄執行：

```powershell
powershell -ExecutionPolicy Bypass -File .\serve.ps1 -Port 8080
```

瀏覽器開啟：
- `http://127.0.0.1:8080/`

也可用 Python：

```powershell
python -m http.server 8081
```

## 資料模型

### 1) 原始課程資料（`window.LESSONS`）
定義於 `lessons.js`，基本格式：

```js
{
  id: "lesson-1",
  name: "課程名稱",
  description: "課程描述",
  quizCount: 9, // 可選，實際會以 app.js 規則處理
  items: [
    {
      text: "題目句子（含答案字）",
      answer: "答案字或詞",
      hint: "注音提示（多字以空白分隔）"
    }
  ]
}
```

### 2) 執行期課程物件（`app.js` 轉換後）
初始化時由 `window.LESSONS` 轉為 `state.lessons`，每課包含：
- `id`, `name`, `description`
- `quizCount`
- `bankItems`：完整題庫（原始 + 使用者自訂）
- `items`：本輪抽題結果（預設最多 10 題）
- `currentIndex`：目前題號

### 3) 題目物件（作答期）
每題含：
- `id`
- `text`
- `answer`
- `hint`
- `handwritingImages`：每個答案字對應一張 canvas data URL（可為 `null`）
- `currentCharIndex`：目前作答字索引
- `isDone`：是否完成
- `isCustom`：是否為自訂題目

## 狀態管理
`app.js` 內部 `state`：
- `lessons`：轉換後課程列表
- `currentLessonId`：目前課程 ID
- `storedBankItemsByLesson`：從 localStorage 讀出的題庫快取
- `editingBankItemId`：題庫編輯模式的題目 ID

畫布/顯示相關旗標：
- `drawing`, `hasInk`, `isErasing`, `isCanvasExpanded`, `isLessonPanelCollapsed`

## API 與資料流

### 1) 外部 API
- 無後端 API 呼叫
- 無 fetch / XHR

### 2) 內部資料 API
- 全域資料入口：`window.LESSONS`

### 3) 本地儲存（localStorage）
- 主要鍵：`myquiz-lesson-bank-items-v2`
- 舊版鍵：`myquiz-custom-bank-items-v1`（向後相容）

讀取流程：
1. 優先讀 `v2`
2. 若無，嘗試讀舊鍵並轉為新結構

寫入流程：
- 題庫 CRUD 後寫入 `v2`

## 主要功能流程

### A. 初始化
1. `normalizeStaticLabels()`
2. `setQuizScreenActive(false)`
3. `initializeState()`
4. `renderBopomofoPalette()`
5. `setupCanvas()`
6. `bindEvents()`
7. `render()`

### B. 渲染
- `renderLessonList()`：左側課程清單與完成數
- `renderCurrentLesson()`：切換題目階段 / 複習階段
- `renderQuestion()`：目前題目、提示、逐字狀態
- `renderReview()`：完成後總覽（含手寫預覽）

### C. 作答
- `submitCurrentQuestion()`
  - 若不是最後一字：儲存該字畫布圖、跳到下一字
  - 若是最後一字：標記 `isDone = true`
- `goPrevQuestion()` / `goNextQuestion()`：題目切換

### D. 題庫管理（Bank）
- `openBankDialog()` / `closeBankDialog()`
- `renderBankList()`：列出所有 bank 題目
- `handleBankFormSubmit()`：新增或更新
- `handleBankListClick()`：編輯或刪除
- `persistLessonBankItems()`：寫入 localStorage

### E. 手寫畫布
- `setupCanvas()`：綁定 pointer/mouse/touch 事件
- `clearCanvas()`：清空畫布
- `toggleEraserMode()` / `applyCanvasTool()`：筆刷與橡皮擦切換
- `restoreCanvasFromSavedImage()`：回填已存圖像
- `syncCanvasInkState()`：偵測是否有筆跡

## 抽題與規則
- 預設常數：`DEFAULT_QUIZ_COUNT = 10`
- `resolveQuizCount(availableCount)`：每課出題數 = `min(10, 題庫數)`
- `buildQuizItemsFromBank()`：題庫洗牌後取前 N 題

## 文字與提示處理
- `splitAnswerUnits(answer)`：把答案拆成字單位
- `splitHintUnits(hint, count)`：把 hint 依空白拆分並對齊字數
- `buildPromptMarkup()`：題幹挖空 + 注音 ruby
- `buildAnswerMarkup()`：複習區顯示正解 + 注音 ruby

## 安全與伺服器
`serve.ps1` 特性：
- 只允許 `GET`
- 會解析請求路徑並限制在 `$Root` 內，避免路徑穿越
- 依副檔名回傳 Content-Type

## 維護建議
- 若要新增課程：修改 `lessons.js` 的 `window.LESSONS`
- 若要調整 UI/流程：優先查看 `app.js` 的 `render*` 與 `handle*`
- 若要調整抽題數：修改 `DEFAULT_QUIZ_COUNT`
- 若要重置自訂題庫：清除對應 localStorage key
