# 生字考試網站

這個目錄是主要專案，提供國小生字手寫練習與測驗功能。網站為純前端靜態頁面，不需要安裝套件，也不需要建置流程。

## 專案檔案

- `index.html`：頁面結構
- `styles.css`：畫面樣式
- `app.js`：互動邏輯
- `lessons.js`：題庫資料
- `serve.ps1`：本機靜態伺服器

## 本機啟動

在 `myquiz` 目錄執行：

```powershell
powershell -ExecutionPolicy Bypass -File .\serve.ps1 -Port 8080
```

然後開啟：

`http://127.0.0.1:8080/`

如果有 Python，也可以用：

```powershell
python -m http.server 8081
```

然後開啟：

`http://127.0.0.1:8081/`

## 目前功能

- 課程切換
- 題目挖空與逐字作答
- 手寫畫布
- 橡皮擦按鈕與固定大小擦除範圍
- 橡皮擦圓形游標提示
- 逐題複習
- 題庫前端編輯
- 注音輔助輸入
- `localStorage` 本機保存題庫資料

## 題庫格式

題庫定義在 `lessons.js` 的 `window.LESSONS`。

每課包含：

- `id`
- `name`
- `description`
- `quizCount`
- `items`

每題至少包含：

- `text`
- `answer`
- `hint`

## 備註

- 這是純前端專案，沒有後端 API。
- 如果畫面內容和原始檔不一致，先檢查瀏覽器 `localStorage` 是否已有舊資料。
- 建議透過 `serve.ps1` 或本機靜態伺服器開啟，不要直接雙擊 HTML。
