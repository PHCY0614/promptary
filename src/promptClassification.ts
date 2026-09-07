export const PROMPT_CATEGORIES = [
  { id: "appearance", label: "人物外表", hint: "頭髮、眼睛、五官、身形" },
  { id: "clothing", label: "服裝與配件", hint: "衣服、鞋子、飾品" },
  { id: "pose", label: "姿勢與表情", hint: "動作、視線、情緒" },
  { id: "background", label: "背景與場景", hint: "地點、環境、物件" },
  { id: "composition", label: "構圖與鏡頭", hint: "景別、角度、鏡頭" },
  { id: "lighting", label: "光線與色彩", hint: "照明、色調、配色" },
  { id: "style", label: "畫風與品質", hint: "風格、媒材、品質詞" },
  { id: "other", label: "未分類", hint: "未辨識或同時涉及多個分類" },
] as const;
export type PromptCategory = typeof PROMPT_CATEGORIES[number]["id"];
export interface PromptClassification {
  sourcePrompt: string;
  overrides: Record<string, PromptCategory>;
}
export interface PromptFragment { id: string; text: string; category: PromptCategory; ambiguous: boolean }

// ── 常見中英文規則：英文使用詞界，避免 dress 命中 address ──
// 多個分類同時命中時交給使用者，不以規則順序強迫歸類。
const RULES: { category: PromptCategory; pattern: RegExp }[] = [
  { category: "appearance", pattern: /\b(?:\d*girls?|\d*boys?|woman|women|man|men|hair|hairstyle|braids?|bangs|eyes?|eyelashes|eyebrows|skin|lips|nose|face|freckles|moles?|physique|anatomy|body type|aegyo sal)\b|頭髮|头发|長髮|短髮|黑髮|紅髮|髮色|卷髮|捲髮|眼睛|瞳孔|五官|膚色|肤色|皮膚|身形|身材|嘴唇|睫毛|美人痣/iu },
  { category: "clothing", pattern: /\b(?:dress|skirt|shirt|sweater|coat|jacket|hoodie|pants|trousers|shorts|sleeves?|sleeveless|turtleneck|necklace|earrings?|jewelry|accessories|scarf|bow|boots?|shoes?|hat|gloves?|uniform|kimono|ribbon|v neck|outfit|clothing)\b|衣服|服裝|服装|洋裝|洋装|長裙|短裙|裙子|毛衣|襯衫|衬衫|外套|長褲|短褲|項鍊|项链|耳環|耳环|圍巾|围巾|鞋|帽子|制服|袖/iu },
  { category: "pose", pattern: /\b(?:sitting|standing|walking|running|lying|kneeling|holding|smiling|smile|blush|laughing|crying|looking|gaze|expression|pose|head rest|hand on|daydreaming|languid|crossed arms)\b|坐姿|站姿|坐著|站著|坐着|站着|微笑|表情|姿勢|姿势|拿著|拿着|手持|凝視|凝视|回頭|回头|奔跑|托腮/iu },
  { category: "background", pattern: /\b(?:background|classroom|bookshelves|bookshelf|library|cafe|café|city|urban|street|forest|ocean|sea|mountains?|landscape|beach|sky|clouds?|room|interior|architecture|building|garden|stairs|book|dust motes|flowers?|trees?)\b|背景|場景|场景|教室|圖書館|图书馆|書架|书架|咖啡|城市|街道|森林|海洋|山景|天空|房間|房间|建築|建筑|花園|花园|樓梯|楼梯/iu },
  { category: "composition", pattern: /\b(?:portrait|close up|wide shot|cowboy shot|full body|upper body|half body|angle|composition|perspective|lens|camera|depth of field|negative space|macro photography)\b|構圖|构图|鏡頭|镜头|特寫|特写|半身|全身|俯視|俯视|仰視|仰视|低角度|景深|留白/iu },
  { category: "lighting", pattern: /\b(?:light|lighting|sunlight|backlit|backlight|shadows?|color|colors|palette|saturation|contrast|monochrome|golden hour|pastel|neon|bokeh|glowing|bioluminescent)\b|光線|光线|照明|柔光|逆光|陽光|阳光|陰影|阴影|色調|色调|配色|飽和|饱和|單色|单色|霓虹/iu },
  { category: "style", pattern: /\b(?:masterpiece|quality|detailed|detail|realistic|realism|hyperrealistic|photorealistic|anime|manga|watercolor|painting|artstyle|aesthetic|aesthetics|illustration|rendering|render|cinematic|8k|4k|2\.5d|3d|ink wash)\b|畫風|画风|水彩|油畫|油画|寫實|写实|動漫|动漫|插畫|插画|高品質|高品质|傑作|杰作|細節|细节|渲染/iu },
];

// ── 分段只用於閱讀：逗號、換行等切段，括號權重／LoRA 標記保持完整 ──
export function classifyPrompt(prompt: string): PromptFragment[] {
  const fragments: PromptFragment[] = [];
  const stack: string[] = [];
  const closing: Record<string, string> = { "(": ")", "[": "]", "{": "}", "<": ">", "（": "）" };
  let start = 0;
  const push = (end: number) => {
    const text = prompt.slice(start, end).trim();
    if (!text) return;
    const normalized = text.replace(/_/g, " ");
    const matches = RULES.filter((rule) => rule.pattern.test(normalized));
    fragments.push({ id: String(start), text, category: matches.length === 1 ? matches[0].category : "other", ambiguous: matches.length > 1 });
  };
  for (let i = 0; i < prompt.length; i++) {
    const char = prompt[i];
    if (closing[char]) stack.push(closing[char]);
    else if (stack.at(-1) === char) stack.pop();
    if (!stack.length && /[,，;；\n\r。！？!?、]/u.test(char)) { push(i); start = i + 1; }
  }
  push(prompt.length);
  return fragments;
}

// 舊分類只適用當時的完整原文，修改 Prompt 後重新建議，避免位置錯配。
export function classificationOverrides(prompt: string, saved?: PromptClassification): Record<string, PromptCategory> {
  if (!saved || saved.sourcePrompt !== prompt) return {};
  const ids = new Set(classifyPrompt(prompt).map((part) => part.id));
  return Object.fromEntries(Object.entries(saved.overrides ?? {}).filter(([id, category]) => ids.has(id) && PROMPT_CATEGORIES.some((item) => item.id === category)));
}
