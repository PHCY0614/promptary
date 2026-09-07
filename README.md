# Promptary

*你的咒語收藏庫 —☆ﾟ.*･*

Promptary 是一個收藏 AI 生圖 prompt 與實測紀錄的小工具。

常常在網路上看到好看的 prompt，卻沒有一個方便保存和整理的地方，所以趁 Codex 重置前燒 token 做了 Promptary，把參考圖片、原始 prompt、來源，以及自己的生成結果和心得都放在一起。

🔗 [線上使用 Promptary](https://phcy0614.github.io/promptary/)

目前資料都保存在使用者自己的瀏覽器裡，不需要登入，也還不支援跨裝置同步。

## 使用流程

1. 上傳參考圖片，貼上 prompt、來源與收藏筆記；也可以先存圖片，之後補文字。
2. 在首頁透過搜尋、標籤與狀態篩選找回收藏。
3. 複製 prompt 到生圖平台使用。
4. 在收藏內新增「我的嘗試」，保存實際 prompt、成果圖片、平台與心得。
5. 選取兩張圖片並排比較。

## 目前功能

- 收藏參考圖片、prompt、來源、標籤與筆記，可搜尋、篩選、排序及標記最愛。
- 每筆收藏可記錄多次生成嘗試，保存實際 prompt、成果圖、平台、模型、評分與心得。
- 可將參考圖或成果圖設為封面，並挑選兩張圖片並排比較。
- Prompt 可依本機中英文關鍵字分類閱讀，也能手動調整分類；不會改動原文或複製順序。
- 支援 JSON 匯出與匯入備份；相同收藏 ID 會跳過，不會覆蓋既有資料。

## 資料保存與備份

資料只保存在目前瀏覽器的本機空間，不需登入，也不會跨裝置同步。清除網站資料、使用無痕模式，或改用其他瀏覽器／網址，都可能看不到原本的收藏，請定期匯出備份。

參考圖片支援 JPG、PNG、WebP，單張上限 2 MB；成果圖目前未設統一格式與大小限制。圖片與收藏一起匯出為 JSON，但自訂平台選單不包含在備份內。

1. 點「管理 → 匯出」下載 JSON。
2. 在另一個瀏覽器或裝置開啟 Promptary，點「管理 → 匯入」。
3. 選擇備份，查看預計新增與跳過的數量，再確認匯入。

匯入檔案上限為 **100 MB**。匯入前會預覽新增與跳過數量；相同收藏 ID 不會合併或覆蓋。

## 本機開發

技術組合：

- React 19
- TypeScript
- Vite 8
- Tailwind CSS v4
- IndexedDB

以 Figma Make 產出的介面為基礎，並在開發與除錯過程中使用 OpenAI Codex 協助。

使用 Node.js 22 與 pnpm 10.34.3，請使用近期的 Node.js 22 修補版本。

```sh
pnpm install
pnpm dev
```

### 檢查與建置

```sh
pnpm typecheck
pnpm test
pnpm build
```

更詳細的資料結構、測試與開發紀錄放在：

`docs/開發說明.md`

## 關鍵程式與資料流

```text
新增／編輯表單
  → store.ts：序列化資料更新
  → archiveStorage.ts：圖片轉 Blob、版本檢查、IndexedDB 交易
  → 寫入成功後更新 React 畫面

匯入 JSON
  → backup.ts：格式檢查、依 ID 去重
  → ImportBackup.tsx：顯示預覽並等待確認
  → store.ts → archiveStorage.ts → 更新卡片
```

| 檔案 | 用途 |
| --- | --- |
| `src/App.tsx` | 頁面切換、表單與儲存錯誤提示 |
| `src/Gallery.tsx` | 首頁搜尋、排序、篩選與卡片 |
| `src/DetailView.tsx` | 收藏詳情與嘗試紀錄 |
| `src/CollectionModal.tsx`、`src/AttemptModal.tsx` | 新增與編輯表單 |
| `src/PromptReader.tsx`、`src/promptClassification.ts` | Prompt 閱讀、分類規則與手動調整 |
| `src/ImageComparison.tsx`、`src/comparisonImages.ts` | 圖片與 prompt 對照、選取邏輯 |
| `src/store.ts`、`src/archiveStorage.ts` | 狀態更新與本機持久化 |
| `src/ImportBackup.tsx`、`src/backup.ts` | 管理選單、備份匯入與檢查 |
| `src/types.ts`、`src/seed.ts` | 資料型別與首次使用的起始收藏 |
| `tests/` | 行為與資料可靠性測試 |
| `docs/開發說明.md` | 分階段開發紀錄，較早段落可能描述舊版行為 |

## 部署

Promptary 目前使用 GitHub Pages：

[https://phcy0614.github.io/promptary/](https://phcy0614.github.io/promptary/)
