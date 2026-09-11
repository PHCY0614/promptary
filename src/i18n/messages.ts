import type { Status } from "../types";
import type { PromptCategory } from "../promptClassification";
import type { ErrorCode } from "./errorCodes";
import type { Locale } from "./locale";

export type Messages = {
  brandSubtitle: string;
  languageSwitcher: string;
  languageZhTW: string;
  languageEn: string;
  switchLanguage: string;
  searchPlaceholder: string;
  sortNewest: string;
  sortUpdated: string;
  sortOldest: string;
  add: string;
  manage: string;
  importAction: string;
  exportAction: string;
  clearAction: string;
  storageAction: string;
  statusAll: string;
  statusFavorite: string;
  allTags: string;
  close: string;
  searchTags: string;
  searchTagsPlaceholder: string;
  noMatchingTags: string;
  reset: string;
  noMatchingCollections: string;
  clearFilters: string;
  collectionCount: (shown: number, total: number) => string;
  promptPending: string;
  attemptCount: (n: number) => string;
  addFavorite: string;
  removeFavorite: string;
  loadingArchive: string;
  loadFailed: string;
  retryLoad: string;
  dismissStorageError: string;
  back: string;
  edit: string;
  delete: string;
  confirmDelete: string;
  confirm: string;
  cancel: string;
  unsavedChangesTitle: string;
  discardChangesPrompt: string;
  continueEditing: string;
  discardChanges: string;
  myResults: string;
  compare: string;
  referenceOriginal: string;
  noReferenceImage: string;
  collapse: string;
  changeCover: string;
  originalPrompt: string;
  collectionNotes: string;
  source: string;
  attemptLog: (n: number) => string;
  addAttempt: string;
  noAttempts: string;
  addFirstAttempt: string;
  collectedOn: (date: string) => string;
  zoom: (label: string) => string;
  referenceImageN: (n: number) => string;
  attemptCoverLabel: (platform: string, date: string, n: number) => string;
  notes: string;
  unchanged: string;
  attemptPrompt: string;
  newCollection: string;
  editCollection: string;
  nameOptional: string;
  referenceImagesOptional: string;
  retry: string;
  retryNamed: (name: string) => string;
  localLibraryHint: string;
  imageSaveBlocked: string;
  originalPromptOptional: string;
  skipForNow: string;
  promptPlaceholder: string;
  tagsComma: string;
  tagsPlaceholder: string;
  status: string;
  sourceUrl: string;
  urlPlaceholder: string;
  notesPlaceholder: string;
  saving: string;
  reading: string;
  saveChanges: string;
  newAttempt: string;
  editAttempt: string;
  resultImages: string;
  platform: string;
  customPlatform: string;
  platformName: string;
  addPlatform: string;
  manageCustomPlatforms: string;
  deletePlatformHint: string;
  deletePlatformOption: (name: string) => string;
  modelOptional: string;
  promptUsed: string;
  useOriginalUnchanged: string;
  restoreOriginalPrompt: string;
  rating: string;
  generatedDate: string;
  uploading: string;
  readerMode: (title: string) => string;
  original: string;
  categoryView: string;
  saveOrCancelCategories: string;
  originalContent: (title: string) => string;
  collapsePrompt: string;
  expandPrompt: string;
  doneAdjusting: string;
  adjustCategories: string;
  restoreDefaultCategories: string;
  confirmRestoreCategories: string;
  categoryContent: (title: string) => string;
  categorize: (text: string) => string;
  categoryManual: string;
  categoryAmbiguous: string;
  categoryUnrecognized: string;
  categorySuggested: string;
  noFragments: string;
  unsavedCategoryChanges: string;
  savingCategories: string;
  saveCategories: string;
  categoriesSaved: string;
  categoriesSaveFailed: string;
  promptCategory: Record<PromptCategory, string>;
  selectImageAbove: string;
  comparisonPromptTitle: (n: number, platform: string, model: string | undefined, unchanged: boolean) => string;
  compareSection: string;
  comparePicker: string;
  deselectImageFirst: string;
  imageSlot: (slot: "A" | "B") => string;
  selectSlotImage: (slot: "A" | "B") => string;
  zoomSlot: (slot: "A" | "B") => string;
  noComparableImages: string;
  compareInfo: string;
  showLeftInfo: string;
  showRightInfo: string;
  leftInfo: string;
  rightInfo: string;
  leftColumn: string;
  rightColumn: string;
  zoomColumn: (side: "left" | "right") => string;
  comparisonAttemptLabel: (attemptIndex: number, platform: string, date: string, imageIndex: number) => string;
  copied: string;
  copyPrompt: string;
  copiedPrompt: string;
  copyFailed: string;
  dismissCopyError: string;
  manualCopyPrompt: string;
  importBackup: string;
  importHelp: string;
  chooseBackupZip: string;
  chooseBackupFile: string;
  changeFile: string;
  noFileChosen: string;
  importPreview: (total: number, added: number, updated: number, kept: number) => string;
  confirmImport: string;
  processing: string;
  importComplete: (added: number, updated: number, kept: number) => string;
  clearData: string;
  clearDataHelp: string;
  clearing: string;
  localData: string;
  storageUsed: string;
  dataProtection: string;
  storageEnabled: string;
  storageNotEnabled: string;
  storageUnavailable: string;
  loadingStorage: string;
  resizeHandle: string;
  resizeHint: string;
  statusLabel: Record<Status, string>;
  errors: Record<ErrorCode, string>;
};

const zhTW: Messages = {
  unsavedChangesTitle: "尚未儲存",
  discardChangesPrompt: "要捨棄目前的變更嗎？",
  continueEditing: "繼續編輯",
  discardChanges: "捨棄",
  brandSubtitle: "你的咒語收藏庫",
  languageSwitcher: "語言",
  languageZhTW: "正體中文",
  languageEn: "English",
  switchLanguage: "Switch to English",
  searchPlaceholder: "搜尋咒語、筆記、標籤……",
  sortNewest: "最新收藏",
  sortUpdated: "最近更新",
  sortOldest: "最早收藏",
  add: "+ 新增",
  manage: "管理",
  importAction: "匯入",
  exportAction: "匯出",
  clearAction: "清除",
  storageAction: "空間",
  statusAll: "全部",
  statusFavorite: "最愛",
  allTags: "所有標籤",
  close: "關閉",
  searchTags: "搜尋標籤",
  searchTagsPlaceholder: "搜尋標籤……",
  noMatchingTags: "沒有符合的標籤",
  reset: "重設",
  noMatchingCollections: "沒有符合的收藏",
  clearFilters: "清除篩選",
  collectionCount: (shown, total) => `${shown} / ${total} 張收藏`,
  promptPending: "咒語待補",
  attemptCount: (n) => `${n} 次嘗試`,
  addFavorite: "加入最愛",
  removeFavorite: "取消最愛",
  loadingArchive: "正在載入收藏……",
  loadFailed: "收藏載入失敗，原有資料仍保留。",
  retryLoad: "重試載入",
  dismissStorageError: "關閉儲存錯誤提示",
  back: "← 返回",
  edit: "編輯",
  delete: "刪除",
  confirmDelete: "確認刪除？",
  confirm: "確認",
  cancel: "取消",
  myResults: "我的成果",
  compare: "並排比較",
  referenceOriginal: "參考原圖",
  noReferenceImage: "尚無參考圖",
  collapse: "收起",
  changeCover: "更換封面",
  originalPrompt: "原始咒語",
  collectionNotes: "收藏筆記",
  source: "來源：",
  attemptLog: (n) => `嘗試紀錄 (${n})`,
  addAttempt: "+ 新增嘗試",
  noAttempts: "還沒有嘗試紀錄",
  addFirstAttempt: "新增第一次嘗試",
  collectedOn: (date) => `收藏於 ${date}`,
  zoom: (label) => `放大${label}`,
  referenceImageN: (n) => `參考圖 ${n}`,
  attemptCoverLabel: (platform, date, n) => `${platform} ${date} · 圖${n}`,
  notes: "筆記",
  unchanged: "無修改",
  attemptPrompt: "這次嘗試的咒語",
  newCollection: "新增收藏",
  editCollection: "編輯收藏",
  nameOptional: "名稱",
  referenceImagesOptional: "參考圖片",
  retry: "重試",
  retryNamed: (name) => `重試 ${name}`,
  localLibraryHint: "本機圖庫：支援 JPG、PNG、WebP，每張圖片最多 10 MB。\n匯入後會自動最佳化，並僅儲存在此裝置。",
  imageSaveBlocked: "請重試或移除失敗圖片後再儲存，已填內容會保留。",
  originalPromptOptional: "原始咒語",
  skipForNow: "待補",
  promptPlaceholder: "貼上或輸入咒語",
  tagsComma: "標籤（逗號分隔）",
  tagsPlaceholder: "例如：人物、風景、物品……",
  status: "狀態",
  sourceUrl: "來源連結",
  urlPlaceholder: "填入網址",
  notesPlaceholder: "記錄心得與想法",
  saving: "儲存中……",
  reading: "讀取中……",
  saveChanges: "儲存變更",
  newAttempt: "新增嘗試",
  editAttempt: "編輯嘗試紀錄",
  resultImages: "成果圖片（可多張）",
  platform: "平台",
  customPlatform: "自訂",
  platformName: "平台名稱",
  addPlatform: "加入平台選單",
  manageCustomPlatforms: "管理自訂平台",
  deletePlatformHint: "刪除選項不影響既有嘗試紀錄。",
  deletePlatformOption: (name) => `刪除平台選項 ${name}`,
  modelOptional: "模型版本（選填）",
  promptUsed: "實際使用的咒語",
  useOriginalUnchanged: "使用原始咒語，無修改",
  restoreOriginalPrompt: "恢復原始咒語",
  rating: "評分",
  generatedDate: "生成日期",
  uploading: "上傳中……",
  readerMode: (title) => `${title}閱讀方式`,
  original: "原文",
  categoryView: "分類閱讀",
  saveOrCancelCategories: "請先儲存或取消分類調整",
  originalContent: (title) => `${title}原文內容`,
  collapsePrompt: "收起咒語",
  expandPrompt: "展開完整咒語",
  doneAdjusting: "完成調整",
  adjustCategories: "調整分類",
  restoreDefaultCategories: "恢復預設分類",
  confirmRestoreCategories: "確定恢復預設分類？目前所有手動分類會被清除。",
  categoryContent: (title) => `${title}分類內容`,
  categorize: (text) => `分類：${text}`,
  categoryManual: "手動調整",
  categoryAmbiguous: "涉及多類，請確認",
  categoryUnrecognized: "尚未辨識",
  categorySuggested: "自動建議",
  noFragments: "沒有可分類的詞句。",
  unsavedCategoryChanges: "有未儲存的分類調整",
  savingCategories: "儲存中……",
  saveCategories: "儲存分類",
  categoriesSaved: "✓ 分類已儲存",
  categoriesSaveFailed: "分類未儲存，調整仍保留，請重試。",
  promptCategory: {
    appearance: "人物外表",
    clothing: "服裝與配件",
    pose: "姿勢與表情",
    background: "背景與場景",
    composition: "構圖與鏡頭",
    lighting: "光線與色彩",
    style: "畫風與品質",
    other: "未分類",
  },
  selectImageAbove: "請從上方選擇圖片",
  comparisonPromptTitle: (n, platform, model, unchanged) =>
    `嘗試 ${n} · ${platform}${model ? ` · ${model}` : ""}${unchanged ? " · 無修改" : " 的咒語"}`,
  compareSection: "圖片與咒語並排比較",
  comparePicker: "比較選圖",
  deselectImageFirst: "請先取消一張已選圖片",
  imageSlot: (slot) => `${slot} 圖片`,
  selectSlotImage: (slot) => `請選擇 ${slot} 圖片`,
  zoomSlot: (slot) => `放大 ${slot} 圖片`,
  noComparableImages: "尚無可比較的圖片",
  compareInfo: "比較圖片資訊",
  showLeftInfo: "顯示左圖資訊",
  showRightInfo: "顯示右圖資訊",
  leftInfo: "左圖資訊",
  rightInfo: "右圖資訊",
  leftColumn: "左側比較欄",
  rightColumn: "右側比較欄",
  zoomColumn: (side) => `放大${side === "left" ? "左" : "右"}欄圖片`,
  comparisonAttemptLabel: (attemptIndex, platform, date, imageIndex) =>
    `嘗試 ${attemptIndex} · ${platform} · ${date} · 圖 ${imageIndex}`,
  copied: "已複製",
  copyPrompt: "複製咒語",
  copiedPrompt: "已複製咒語",
  copyFailed: "複製失敗，可重試或手動選取。",
  dismissCopyError: "關閉複製錯誤提示",
  manualCopyPrompt: "手動複製咒語",
  importBackup: "匯入備份",
  importHelp: "相同收藏僅保留最新版本。",
  chooseBackupZip: "選擇備份 ZIP",
  chooseBackupFile: "選擇備份檔案",
  changeFile: "更換檔案",
  noFileChosen: "尚未選擇檔案",
  importPreview: (_total, added, updated, kept) => `新增 ${added}　更新 ${updated}　保留 ${kept}`,
  confirmImport: "確認匯入",
  processing: "處理中……",
  importComplete: (added, updated, kept) => `匯入完成：新增 ${added}　更新 ${updated}　保留 ${kept}`,
  clearData: "清除本機資料",
  clearDataHelp: "永久刪除這個瀏覽器中的所有 Promptary 資料。",
  clearing: "清除中……",
  localData: "本機資料",
  storageUsed: "目前使用空間",
  dataProtection: "資料保護",
  storageEnabled: "已啟用",
  storageNotEnabled: "未啟用",
  storageUnavailable: "無法確認",
  loadingStorage: "讀取中……",
  resizeHandle: "調整欄位高度",
  resizeHint: "向上或向下拖曳以調整高度",
  statusLabel: { tried: "試過", want: "想試", ref: "靈感" },
  errors: {
    transactionAborted: "儲存交易中止，請重試。",
    dbBlocked: "資料庫被其他分頁占用，請關閉其他圖庫分頁後重試。",
    revisionConflict: "其他分頁已更新收藏。請先保留未儲存的文字，再重新整理此頁。",
    imageMissingRetry: "找不到圖片資料，表單仍保留，請重試或重新加入圖片。",
    legacyImageUnrecognized: "舊圖片資料格式無法辨識，原有收藏未變更。",
    archiveUnrecognized: "收藏資料格式無法辨識，原有收藏未變更。",
    legacyRemoteImage: "舊版遠端圖片無法轉成本機圖片，原有收藏未變更。",
    legacyImageMissing: "找不到舊版圖片資料，原有收藏未變更。",
    imageMissing: "找不到圖片資料。",
    quotaExceeded: "此瀏覽器可用儲存空間不足。請釋放裝置空間或刪除不需要的收藏後重試；表單仍保留。",
    storagePermission: "瀏覽器目前不允許使用本機資料庫，請檢查網站儲存權限後重試；表單仍保留。",
    storageFailed: "本機資料庫操作失敗，請重試；表單仍保留。",
    backupImagesIncomplete: "備份圖片不完整，原有收藏未變更。",
    backupDuplicateImageId: "備份內含重複但內容不同的圖片 ID，原有收藏未變更。",
    backupInvalid: "備份格式不完整或不支援，請選擇 Promptary 匯出的 ZIP。原有收藏未變更。",
    backupDuplicateMeta: "備份內含重複但中繼資料不同的圖片 ID，原有收藏未變更。",
    backupZipTooLarge: "備份 ZIP 超過 100 MiB，原有收藏未變更。",
    backupZipTooMany: "備份 ZIP 內容過大，原有收藏未變更。",
    backupZipUnsupported: "備份 ZIP 使用不支援的加密或壓縮格式，原有收藏未變更。",
    backupZipUnsafePath: "備份 ZIP 內含不安全的檔案路徑，原有收藏未變更。",
    backupZipEntryTooLarge: "備份 ZIP 內含過大的檔案，原有收藏未變更。",
    backupZipUncompressed: "備份 ZIP 解壓後內容過大，原有收藏未變更。",
    backupImageMissing: "備份內的圖片遺失或過大，原有收藏未變更。",
    importZipTooLarge: "目前單份 ZIP 匯入上限為 100 MiB，請選擇較小的備份。",
    importReadFailed: "讀取失敗，請重新選擇完整的 ZIP 備份。",
    importSaveFailed: "儲存失敗，原有收藏未變更。可關閉其他分頁或釋出儲存空間後重試；備份預覽仍保留。",
    importFailed: "匯入失敗，請重試。",
    imageReadFailed: "圖片讀取失敗，請重試。",
    imageProcessFailed: "圖片處理失敗，請重試。",
    imageBatchTooLarge: "單次最多選取 10 張圖片，請分批加入。",
    imageParseFailed: "無法解析圖片，請確認檔案完整或更換圖片。",
    imageEncodeFailed: "瀏覽器無法產生可用的圖片，請重新整理後重試。",
    imageSizeUnknown: "圖片尺寸無法辨識，請更換圖片。",
    imageTooManyPixels: "圖片解碼後超過 4,000 萬像素，請縮小尺寸後再匯入。",
    imageCanvasFailed: "瀏覽器無法處理圖片，請重新整理後再試。",
    imageOptimizeFailed: "最佳化後的圖片驗證失敗，原有資料未變更。",
    imageTypeUnsupported: "僅支援 JPG、PNG、WebP，請更換檔案。",
    imageFileTooLarge: "單張圖片不可超過 10 MB，請更換較小的檔案。",
    imageOutputTypeUnsupported: "瀏覽器產生了不支援的圖片格式，請重新整理後重試。",
    backupImageTypeUnsupported: "備份內含不支援的圖片格式，原有收藏未變更。",
    backupImageSizeMismatch: "備份圖片尺寸不符合 Promptary 規格，原有收藏未變更。",
    backupImageManifestMismatch: "備份圖片與 manifest 記錄不一致，原有收藏未變更。",
    platformSaveFailed: "無法儲存平台選單，請確認瀏覽器允許儲存後重試。已填內容仍保留。",
    platformNameRequired: "請輸入平台名稱。",
  },
};

const en: Messages = {
  unsavedChangesTitle: "Unsaved changes",
  discardChangesPrompt: "Discard your current changes?",
  continueEditing: "Continue editing",
  discardChanges: "Discard",
  brandSubtitle: "Your AI image prompt library",
  languageSwitcher: "Language",
  languageZhTW: "正體中文",
  languageEn: "English",
  switchLanguage: "切換至正體中文",
  searchPlaceholder: "Search prompts, notes, tags…",
  sortNewest: "Newest",
  sortUpdated: "Edited",
  sortOldest: "Oldest",
  add: "+ New",
  manage: "Manage",
  importAction: "Import",
  exportAction: "Export",
  clearAction: "Clear",
  storageAction: "Storage",
  statusAll: "All",
  statusFavorite: "Favourites",
  allTags: "All tags",
  close: "Close",
  searchTags: "Search tags",
  searchTagsPlaceholder: "Search tags…",
  noMatchingTags: "No matching tags",
  reset: "Reset",
  noMatchingCollections: "No matching collections",
  clearFilters: "Clear filters",
  collectionCount: (shown, total) => `${shown} / ${total} ${total === 1 ? "collection" : "collections"}`,
  promptPending: "Prompt pending",
  attemptCount: (n) => n === 1 ? "1 Attempt" : `${n} Attempts`,
  addFavorite: "Add to favourites",
  removeFavorite: "Remove from favourites",
  loadingArchive: "Loading your collection…",
  loadFailed: "Couldn’t load collections. Existing data is unchanged.",
  retryLoad: "Retry",
  dismissStorageError: "Dismiss storage error",
  back: "← Back",
  edit: "Edit",
  delete: "Delete",
  confirmDelete: "Delete?",
  confirm: "Confirm",
  cancel: "Cancel",
  myResults: "My Results",
  compare: "Compare",
  referenceOriginal: "Reference",
  noReferenceImage: "No reference image",
  collapse: "Collapse",
  changeCover: "Change cover",
  originalPrompt: "Original Prompt",
  collectionNotes: "Collection notes",
  source: "Source: ",
  attemptLog: (n) => `Attempts (${n})`,
  addAttempt: "+ New attempt",
  noAttempts: "No attempts yet",
  addFirstAttempt: "Add first attempt",
  collectedOn: (date) => `Collected ${date}`,
  zoom: (label) => `Zoom ${label}`,
  referenceImageN: (n) => `Reference ${n}`,
  attemptCoverLabel: (platform, date, n) => `${platform} ${date} · Image ${n}`,
  notes: "Notes",
  unchanged: "Unchanged",
  attemptPrompt: "Attempt prompt",
  newCollection: "New collection",
  editCollection: "Edit collection",
  nameOptional: "Name (optional)",
  referenceImagesOptional: "Reference images (optional)",
  retry: "Retry",
  retryNamed: (name) => `Retry ${name}`,
  localLibraryHint: "Local library: JPG, PNG, WebP. Max 10 MB each.\nImages are optimised and stored on this device only.",
  imageSaveBlocked: "Retry or remove failed images to save. Other fields are kept.",
  originalPromptOptional: "Original prompt",
  skipForNow: "Skip for now",
  promptPlaceholder: "Paste or type a prompt",
  tagsComma: "Tags (comma-separated)",
  tagsPlaceholder: "e.g. portrait, cosmic, cinematic…",
  status: "Status",
  sourceUrl: "Source URL",
  urlPlaceholder: "URL",
  notesPlaceholder: "Notes and thoughts",
  saving: "Saving…",
  reading: "Reading…",
  saveChanges: "Save changes",
  newAttempt: "New attempt",
  editAttempt: "Edit attempt",
  resultImages: "Result images",
  platform: "Platform",
  customPlatform: "Custom",
  platformName: "Platform name",
  addPlatform: "Add to menu",
  manageCustomPlatforms: "Manage custom platforms",
  deletePlatformHint: "Removing a menu option does not change saved attempts.",
  deletePlatformOption: (name) => `Remove platform ${name}`,
  modelOptional: "Model (optional)",
  promptUsed: "Prompt used",
  useOriginalUnchanged: "Use original prompt, unchanged",
  restoreOriginalPrompt: "Restore original prompt",
  rating: "Rating",
  generatedDate: "Date",
  uploading: "Uploading…",
  readerMode: (title) => `${title} view`,
  original: "Original",
  categoryView: "By category",
  saveOrCancelCategories: "Save or cancel category changes first",
  originalContent: (title) => `${title} original`,
  collapsePrompt: "Collapse prompt",
  expandPrompt: "Expand prompt",
  doneAdjusting: "Done",
  adjustCategories: "Edit categories",
  restoreDefaultCategories: "Restore defaults",
  confirmRestoreCategories: "Restore default categories? Manual assignments will be cleared.",
  categoryContent: (title) => `${title} categories`,
  categorize: (text) => `Category: ${text}`,
  categoryManual: "Manual",
  categoryAmbiguous: "Multiple matches",
  categoryUnrecognized: "Uncategorised",
  categorySuggested: "Suggested",
  noFragments: "Nothing to categorise.",
  unsavedCategoryChanges: "Unsaved category changes",
  savingCategories: "Saving…",
  saveCategories: "Save categories",
  categoriesSaved: "✓ Categories saved",
  categoriesSaveFailed: "Categories not saved. Changes are kept — retry.",
  promptCategory: {
    appearance: "Appearance",
    clothing: "Clothing",
    pose: "Pose",
    background: "Background",
    composition: "Composition",
    lighting: "Lighting",
    style: "Style",
    other: "Other",
  },
  selectImageAbove: "Select an image above",
  comparisonPromptTitle: (n, platform, model, unchanged) =>
    `Attempt ${n} · ${platform}${model ? ` · ${model}` : ""}${unchanged ? " · Unchanged" : " · Prompt"}`,
  compareSection: "Image and prompt comparison",
  comparePicker: "Comparison picker",
  deselectImageFirst: "Deselect an image first",
  imageSlot: (slot) => `Image ${slot}`,
  selectSlotImage: (slot) => `Select image ${slot}`,
  zoomSlot: (slot) => `Zoom image ${slot}`,
  noComparableImages: "No images to compare",
  compareInfo: "Comparison info",
  showLeftInfo: "Show left info",
  showRightInfo: "Show right info",
  leftInfo: "Left info",
  rightInfo: "Right info",
  leftColumn: "Left column",
  rightColumn: "Right column",
  zoomColumn: (side) => `Zoom ${side} image`,
  comparisonAttemptLabel: (attemptIndex, platform, date, imageIndex) =>
    `Attempt ${attemptIndex} · ${platform} · ${date} · Image ${imageIndex}`,
  copied: "Copied",
  copyPrompt: "Copy prompt",
  copiedPrompt: "Prompt copied",
  copyFailed: "Copy failed. Retry or select the text.",
  dismissCopyError: "Dismiss copy error",
  manualCopyPrompt: "Prompt to copy",
  importBackup: "Import backup",
  importHelp: "Only the newest version of matching collections is kept.",
  chooseBackupZip: "Choose backup ZIP",
  chooseBackupFile: "Choose backup",
  changeFile: "Change file",
  noFileChosen: "No file chosen",
  importPreview: (_total, added, updated, kept) => `Added ${added} · Updated ${updated} · Kept ${kept}`,
  confirmImport: "Import",
  processing: "Working…",
  importComplete: (added, updated, kept) => `Imported: ${added} added · ${updated} updated · ${kept} kept`,
  clearData: "Clear local data",
  clearDataHelp: "Permanently delete all Promptary data in this browser.",
  clearing: "Clearing…",
  localData: "Local Data",
  storageUsed: "Storage used",
  dataProtection: "Data protection",
  storageEnabled: "Enabled",
  storageNotEnabled: "Not enabled",
  storageUnavailable: "Unavailable",
  loadingStorage: "Loading…",
  resizeHandle: "Resize field",
  resizeHint: "Drag up or down to resize",
  statusLabel: { tried: "Tried", want: "To Try", ref: "Inspo" },
  errors: {
    transactionAborted: "Save was interrupted. Retry.",
    dbBlocked: "The database is in use in another tab. Close other gallery tabs and retry.",
    revisionConflict: "Another tab updated the archive. Keep unsaved text, then reload.",
    imageMissingRetry: "Image data is missing. The form is kept — retry or re-add the image.",
    legacyImageUnrecognized: "Legacy image data is unreadable. Existing collections are unchanged.",
    archiveUnrecognized: "Collection data is unreadable. Existing collections are unchanged.",
    legacyRemoteImage: "Legacy remote images cannot be converted. Existing collections are unchanged.",
    legacyImageMissing: "Legacy image data is missing. Existing collections are unchanged.",
    imageMissing: "Image data is missing.",
    quotaExceeded: "Not enough browser storage. Free space or delete collections, then retry. The form is kept.",
    storagePermission: "This browser blocked local storage. Check site permissions and retry. The form is kept.",
    storageFailed: "Local database failed. Retry. The form is kept.",
    backupImagesIncomplete: "Backup images are incomplete. Existing collections are unchanged.",
    backupDuplicateImageId: "Backup has duplicate image IDs with different content. Existing collections are unchanged.",
    backupInvalid: "Backup is incomplete or unsupported. Choose a ZIP exported from Promptary. Existing collections are unchanged.",
    backupDuplicateMeta: "Backup has duplicate image IDs with different metadata. Existing collections are unchanged.",
    backupZipTooLarge: "Backup ZIP exceeds 100 MiB. Existing collections are unchanged.",
    backupZipTooMany: "Backup ZIP is too large. Existing collections are unchanged.",
    backupZipUnsupported: "Backup ZIP uses unsupported encryption or compression. Existing collections are unchanged.",
    backupZipUnsafePath: "Backup ZIP contains an unsafe path. Existing collections are unchanged.",
    backupZipEntryTooLarge: "Backup ZIP contains a file that is too large. Existing collections are unchanged.",
    backupZipUncompressed: "Uncompressed backup is too large. Existing collections are unchanged.",
    backupImageMissing: "A backup image is missing or too large. Existing collections are unchanged.",
    importZipTooLarge: "ZIP import is limited to 100 MiB. Choose a smaller backup.",
    importReadFailed: "Couldn’t read the file. Choose a complete ZIP backup.",
    importSaveFailed: "Save failed. Existing collections are unchanged. Close other tabs or free storage, then retry. The preview is kept.",
    importFailed: "Import failed. Retry.",
    imageReadFailed: "Couldn’t read the image. Retry.",
    imageProcessFailed: "Couldn’t process the image. Retry.",
    imageBatchTooLarge: "Choose up to 10 images at a time, then add another batch.",
    imageParseFailed: "Couldn’t parse the image. Use a complete file, or choose another.",
    imageEncodeFailed: "The browser couldn’t encode the image. Reload and retry.",
    imageSizeUnknown: "Image size is unknown. Choose another file.",
    imageTooManyPixels: "Decoded image exceeds 40 million pixels. Scale it down, then import.",
    imageCanvasFailed: "The browser couldn’t process the image. Reload and retry.",
    imageOptimizeFailed: "Optimised image failed verification. Existing data is unchanged.",
    imageTypeUnsupported: "JPG, PNG, and WebP only. Choose another file.",
    imageFileTooLarge: "Each image must be 10 MB or smaller.",
    imageOutputTypeUnsupported: "The browser produced an unsupported image type. Reload and retry.",
    backupImageTypeUnsupported: "Backup contains an unsupported image type. Existing collections are unchanged.",
    backupImageSizeMismatch: "Backup image size doesn’t match Promptary specs. Existing collections are unchanged.",
    backupImageManifestMismatch: "Backup image doesn’t match the manifest. Existing collections are unchanged.",
    platformSaveFailed: "Couldn’t save the platform menu. Allow storage and retry. Other fields are kept.",
    platformNameRequired: "Enter a platform name.",
  },
};

export const translations: Record<Locale, Messages> = {
  "zh-TW": zhTW,
  en,
};

export function translateError(code: string, t: Messages): string {
  return t.errors[code as ErrorCode] ?? t.errors.storageFailed;
}
