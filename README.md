# 生字出題器

這是一個可直接在手機瀏覽器開啟的靜態網頁，適合練習國小三年級下學期國語 1 到 6 課的生字。

## 使用方式

1. 直接開啟 [index.html](E:\CodeX\生字考試\index.html)。
2. 先選課，再點題目中的按鈕進入全螢幕手寫。
3. 如果要用 AI 判讀，先按「AI 設定」填入支援圖片辨識的 API。
4. 如果暫時沒有 API，可切到人工檢查模式，寫完後再按「顯示答案」核對。

## 題庫調整

- 課文題庫放在 [lessons.js](E:\CodeX\生字考試\lessons.js)。
- 每一題由 `text` 和 `answer` 組成，系統會自動把答案在句子中挖空。
- 如果之後想補更多句子或修正教材原文，直接編輯 `window.LESSONS` 即可。

## 備註

- 目前第 1 到 6 課已先整理成可使用版本。
- 第 3 到第 6 課部分句子是依圖片整理後輸入，若要完全逐字對齊課本，可再繼續微調題庫。

## 免費發佈

### 方案 A：Cloudflare Pages

這個專案是純靜態網站，不需要安裝套件，也不需要建置指令。

1. 先把整個資料夾上傳到 GitHub 新 repo。
2. 登入 Cloudflare，進入 Pages。
3. 選 `Connect to Git`，挑選剛剛的 repo。
4. Framework preset 選 `None`。
5. Build command 留空。
6. Build output directory 留空，或填 `/`。
7. 按下 Deploy。

部署成功後，Cloudflare 會給你一個公開網址，電腦和手機都能直接開。

### 方案 B：GitHub Pages

1. 把這個專案上傳到 GitHub repo。
2. 到 repo 的 `Settings`。
3. 進入 `Pages`。
4. `Source` 選 `Deploy from a branch`。
5. Branch 選 `main`，資料夾選 `/ (root)`。
6. 儲存後等待幾分鐘。

之後網站通常會出現在：

`https://你的帳號.github.io/你的-repo-名稱/`

如果 repo 名稱是帳號站以外的一般名稱，分享網址通常會是：

`https://你的帳號.github.io/生字考試/`
