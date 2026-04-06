# 生字考試網站

這是一個給國小生使用的靜態生字手寫測驗網站，主要用來練習國語課本第 1 到第 6 課的生字與詞語。整個專案目前不需要安裝套件，也不需要建置流程，直接用瀏覽器或本機靜態伺服器就能使用。

## 專案位置

- 主要網站目錄： [myquiz](E:\CodeX\生字考試\myquiz)
- 畫面結構： [index.html](E:\CodeX\生字考試\myquiz\index.html)
- 互動邏輯： [app.js](E:\CodeX\生字考試\myquiz\app.js)
- 題庫資料： [lessons.js](E:\CodeX\生字考試\myquiz\lessons.js)
- 樣式： [styles.css](E:\CodeX\生字考試\myquiz\styles.css)
- 本機伺服器腳本： [serve.ps1](E:\CodeX\生字考試\myquiz\serve.ps1)

## 如何啟動本機後台

這個專案的「後台」目前不是資料庫或 API 伺服器，而是本機靜態網站伺服器，用來把這個網站跑起來給瀏覽器開啟。

### 方式 1：用專案內建的 PowerShell 伺服器

在 [myquiz](E:\CodeX\生字考試\myquiz) 目錄執行：

```powershell
powershell -ExecutionPolicy Bypass -File .\serve.ps1 -Port 8080
```

啟動後用瀏覽器打開：

[http://127.0.0.1:8080/](http://127.0.0.1:8080/)

### 方式 2：用 Python 快速啟動靜態伺服器

如果電腦上有可用的 Python，可在 [myquiz](E:\CodeX\生字考試\myquiz) 目錄執行：

```powershell
python -m http.server 8081
```

或 Windows 上指定 Python 3.11：

```powershell
C:\Users\weitz\AppData\Local\Programs\Python\Python311\python.exe -m http.server 8081
```

啟動後用瀏覽器打開：

[http://127.0.0.1:8081/](http://127.0.0.1:8081/)

## 目前已完成的工作

目前這個版本已經完成：

- 第 1 到第 6 課的預設題庫整理與匯入。
- 課程切換介面，可在不同課次之間切換。
- 題目顯示與挖空邏輯，會依 `answer` 自動在句子中標示要作答的字詞。
- 手寫畫布，可直接在頁面上書寫作答。
- 逐題 / 逐字瀏覽流程，包含上一題、下一題與字位提示。
- 交卷後的複習畫面，可回看每題答案與手寫內容。
- 題庫管理功能，可在前端新增、修改、刪除每一課的題目。
- 注音輸入輔助工具，可用符號盤手動拼出提示注音。
- 題庫資料本機保存，會存到瀏覽器 `localStorage`。
- 重新開始課程時可重新洗牌並抽題。
- 手機瀏覽器可使用的單頁靜態網站版本。

## 題庫格式與修改方式

題庫在 [lessons.js](E:\CodeX\生字考試\myquiz\lessons.js) 的 `window.LESSONS`，每課大致包含：

- `id`
- `name`
- `description`
- `quizCount`
- `items`

每個 `item` 目前至少有：

- `text`：完整句子
- `answer`：要考的字或詞
- `hint`：注音提示

如果要調整教材內容、補題、改字詞，直接修改 `lessons.js` 即可。

## 題庫編輯器與資料保存

除了 `lessons.js` 的預設題庫，網站也支援在前端直接編輯題庫。這些手動新增或修改的內容會存在目前瀏覽器的 `localStorage`，不會自動回寫到原始檔。

目前使用到的 key：

- `myquiz-lesson-bank-items-v2`
- 舊版相容：`myquiz-custom-bank-items-v1`

如果之後發現「畫面上的題庫和原始檔不一樣」，要先檢查是不是瀏覽器已經有保存過本機題庫資料。

## 使用方式

1. 啟動本機靜態伺服器。
2. 打開網站首頁。
3. 選擇要練習的課次。
4. 依句子提示在畫布上手寫作答。
5. 用上一題 / 下一題切換，完成後查看複習結果。
6. 如需補題或修題，可開啟題庫面板直接編輯。

## 注意事項

- 這是純前端靜態網站，目前沒有真正的資料庫後端或 API 服務。
- 如果直接雙擊 `index.html` 開啟，有些瀏覽器行為可能和經過本機伺服器時不同，因此平常建議還是用 `serve.ps1` 或 `http.server`。
- 如果畫面出現中文亂碼，優先檢查檔案編碼是否為 UTF-8，以及伺服器是否有回傳正確的 UTF-8 `Content-Type`。

## 部署

這個專案可以直接部署到靜態網站平台。

### Cloudflare Pages

1. 把整個專案推到 GitHub。
2. 到 Cloudflare Pages 連接該 repo。
3. Framework preset 選 `None`。
4. Build command 留空。
5. Build output directory 留空或填 `/`。
6. 部署完成後即可直接分享網址。

### GitHub Pages

1. 把整個專案推到 GitHub。
2. 到 repo 的 `Settings` > `Pages`。
3. `Source` 選 `Deploy from a branch`。
4. Branch 選 `main`，資料夾選 `/ (root)`。
5. 儲存後等待部署完成。
