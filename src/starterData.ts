import type { Collection, ImageRef } from "./types";

// 只在首次開啟且 IndexedDB / localStorage 都沒有資料時寫入；不覆蓋既有收藏。
export const STARTER_COLLECTIONS: Collection[] = [
  {
    "name": "Miniature Worlds",
    "referenceImages": [
      {
        "id": "c3cb9e1c-1907-46a2-bcb9-f2ba56abf497",
        "width": 880,
        "height": 587,
        "mimeType": "image/webp",
        "byteSize": 58656,
        "createdAt": "2026-09-11T11:19:10.040Z"
      },
      {
        "id": "32021f5e-e2c6-4b8d-bfb7-c313483a8666",
        "width": 880,
        "height": 575,
        "mimeType": "image/webp",
        "byteSize": 46590,
        "createdAt": "2026-09-11T11:19:25.789Z"
      }
    ],
    "coverSource": {
      "type": "reference",
      "imageId": "c3cb9e1c-1907-46a2-bcb9-f2ba56abf497"
    },
    "originalPrompt": "",
    "promptPending": true,
    "tags": [],
    "status": "ref",
    "isFavorite": false,
    "collectionNotes": "",
    "source": "https://www.boredpanda.com/miniature-worlds-micro-photography-werkaandemuur/",
    "id": "5549b4f2-6348-4d3f-a71a-d02be7028c62",
    "attempts": [],
    "createdAt": "2026-09-11T11:20:07.664Z",
    "updatedAt": "2026-09-11T11:20:07.664Z"
  },
  {
    "name": "天文館學者",
    "referenceImages": [
      {
        "id": "cb1061a7-ccab-4f79-8514-f45d57bae9d0",
        "width": 1370,
        "height": 1148,
        "mimeType": "image/webp",
        "byteSize": 201710,
        "createdAt": "2026-09-11T10:58:29.760Z"
      }
    ],
    "coverSource": {
      "type": "reference",
      "imageId": "cb1061a7-ccab-4f79-8514-f45d57bae9d0"
    },
    "originalPrompt": "masterpiece, best quality, ultra detailed, absurdres,\n1girl, solo, young adult woman, elegant, intelligent, quiet aura,\n\nsemi-realistic, 2.5D, semi-realistic anime style, delicate face,\noval face, refined features, pale skin, natural skin texture,\nsoft lips, straight nose, slightly tired eyes, calm gaze, introspective expression,\n\nlong black hair, straight hair, soft layered ends,\nslightly messy bangs, loose strands framing face,\ndark brown eyes,\n\ndark academia, subtle celestial aesthetic,\nvintage scholar outfit,\ncream high-neck blouse, dark pleated long skirt,\ndeep navy fitted vest, long wool coat draped over chair,\nthin round glasses,\nsilver ring, delicate necklace,\n\nsitting beside a large wooden desk,\nold books, handwritten notes, fountain pen, folded star chart,\nbrass telescope, vintage lamp, porcelain coffee cup,\nastronomy library, old European observatory reading room,\ntall bookshelves, wooden cabinets, celestial globe, moon map,\n\nnight scene, rain outside the window,\nwarm lamp light, cool moonlight from tall window,\nsoft rim light, subtle volumetric lighting,\ndust particles in the air,\n\nquiet, melancholic, intellectual, nostalgic atmosphere,\nmysterious but gentle, reserved, thoughtful,\ncinematic composition, shallow depth of field,\nforeground blur, highly detailed environment,\nmuted navy, brown, ivory, brass, and soft grey palette",
    "promptPending": false,
    "tags": [
      "人物",
      "女性"
    ],
    "status": "tried",
    "isFavorite": false,
    "collectionNotes": "參考圖是使用GPT。",
    "id": "dd4c8788-16ad-46d9-a822-7f0b67880959",
    "attempts": [
      {
        "images": [
          {
            "id": "de3b3b65-3549-44e6-91ef-bef54a7d4d0a",
            "width": 960,
            "height": 1280,
            "mimeType": "image/webp",
            "byteSize": 148520,
            "createdAt": "2026-09-11T11:02:40.379Z"
          },
          {
            "id": "ed6afd5d-9d5d-439a-9f6d-586caa318428",
            "width": 960,
            "height": 1280,
            "mimeType": "image/webp",
            "byteSize": 129636,
            "createdAt": "2026-09-11T11:02:40.398Z"
          }
        ],
        "platform": "PixAI",
        "promptMode": "custom",
        "prompt": "masterpiece, best quality, ultra detailed, absurdres,\n1girl, solo, young adult woman, elegant, intelligent, quiet aura,\n\nsemi-realistic, 2.5D, semi-realistic anime style, delicate face,\noval face, refined features, pale skin, natural skin texture,\nsoft lips, straight nose, slightly tired eyes, calm gaze, introspective expression,\n\nlong blonde hair, wavy hair, soft layered ends, swept bangs, loose strands framing face,\ndark brown eyes,\n\ndark academia, subtle celestial aesthetic,\nvintage scholar outfit,\ncream high-neck blouse, dark pleated long skirt,\ndeep navy fitted vest, long wool coat draped over chair,\nthin round glasses,\nsilver ring, delicate necklace,\n\nsitting beside a large wooden desk,\nold books, handwritten notes, fountain pen, folded star chart,\nbrass telescope, vintage lamp, porcelain coffee cup,\nastronomy library, old European observatory reading room,\ntall bookshelves, wooden cabinets, celestial globe, moon map,\n\nnight scene, rain outside the window,\nwarm lamp light, cool moonlight from tall window,\nsoft rim light, subtle volumetric lighting,\ndust particles in the air,\n\nquiet, melancholic, intellectual, nostalgic atmosphere,\nmysterious but gentle, reserved, thoughtful,\ncinematic composition, shallow depth of field,\nforeground blur, highly detailed environment,\nmuted navy, brown, ivory, brass, and soft grey palette",
        "model": "Tsubaki.2",
        "notes": "LoRA: LaLa 7 girl",
        "rating": null,
        "date": "2026-09-11",
        "id": "99f692be-dca4-49d9-92cb-562596cc88f0",
        "createdAt": "2026-09-11T11:04:11.711Z"
      },
      {
        "images": [
          {
            "id": "6d8c4705-4820-436e-abec-a6e8f396da5a",
            "width": 2048,
            "height": 1117,
            "mimeType": "image/webp",
            "byteSize": 171024,
            "createdAt": "2026-09-11T11:10:20.645Z"
          }
        ],
        "platform": "Gemini",
        "promptMode": "original",
        "prompt": "masterpiece, best quality, ultra detailed, absurdres,\n1girl, solo, young adult woman, elegant, intelligent, quiet aura,\n\nsemi-realistic, 2.5D, semi-realistic anime style, delicate face,\noval face, refined features, pale skin, natural skin texture,\nsoft lips, straight nose, slightly tired eyes, calm gaze, introspective expression,\n\nlong black hair, straight hair, soft layered ends,\nslightly messy bangs, loose strands framing face,\ndark brown eyes,\n\ndark academia, subtle celestial aesthetic,\nvintage scholar outfit,\ncream high-neck blouse, dark pleated long skirt,\ndeep navy fitted vest, long wool coat draped over chair,\nthin round glasses,\nsilver ring, delicate necklace,\n\nsitting beside a large wooden desk,\nold books, handwritten notes, fountain pen, folded star chart,\nbrass telescope, vintage lamp, porcelain coffee cup,\nastronomy library, old European observatory reading room,\ntall bookshelves, wooden cabinets, celestial globe, moon map,\n\nnight scene, rain outside the window,\nwarm lamp light, cool moonlight from tall window,\nsoft rim light, subtle volumetric lighting,\ndust particles in the air,\n\nquiet, melancholic, intellectual, nostalgic atmosphere,\nmysterious but gentle, reserved, thoughtful,\ncinematic composition, shallow depth of field,\nforeground blur, highly detailed environment,\nmuted navy, brown, ivory, brass, and soft grey palette",
        "model": "Nano Banana 2",
        "notes": "",
        "rating": null,
        "date": "2026-09-11",
        "id": "4eb2f5b2-9ac6-4107-aa26-61da3b9e7454",
        "createdAt": "2026-09-11T11:10:21.791Z"
      }
    ],
    "createdAt": "2026-09-11T11:00:54.304Z",
    "updatedAt": "2026-09-11T11:10:21.791Z",
    "promptClassification": {
      "sourcePrompt": "masterpiece, best quality, ultra detailed, absurdres,\n1girl, solo, young adult woman, elegant, intelligent, quiet aura,\n\nsemi-realistic, 2.5D, semi-realistic anime style, delicate face,\noval face, refined features, pale skin, natural skin texture,\nsoft lips, straight nose, slightly tired eyes, calm gaze, introspective expression,\n\nlong black hair, straight hair, soft layered ends,\nslightly messy bangs, loose strands framing face,\ndark brown eyes,\n\ndark academia, subtle celestial aesthetic,\nvintage scholar outfit,\ncream high-neck blouse, dark pleated long skirt,\ndeep navy fitted vest, long wool coat draped over chair,\nthin round glasses,\nsilver ring, delicate necklace,\n\nsitting beside a large wooden desk,\nold books, handwritten notes, fountain pen, folded star chart,\nbrass telescope, vintage lamp, porcelain coffee cup,\nastronomy library, old European observatory reading room,\ntall bookshelves, wooden cabinets, celestial globe, moon map,\n\nnight scene, rain outside the window,\nwarm lamp light, cool moonlight from tall window,\nsoft rim light, subtle volumetric lighting,\ndust particles in the air,\n\nquiet, melancholic, intellectual, nostalgic atmosphere,\nmysterious but gentle, reserved, thoughtful,\ncinematic composition, shallow depth of field,\nforeground blur, highly detailed environment,\nmuted navy, brown, ivory, brass, and soft grey palette",
      "overrides": {
        "519": "clothing",
        "568": "clothing",
        "1005": "background"
      }
    }
  },
  {
    "name": "非現實新物種",
    "referenceImages": [
      {
        "id": "43f79e08-13eb-4328-8f2b-8f8ed1ac46c9",
        "width": 1312,
        "height": 1199,
        "mimeType": "image/webp",
        "byteSize": 286898,
        "createdAt": "2026-09-11T10:50:17.876Z"
      }
    ],
    "coverSource": {
      "type": "reference",
      "imageId": "43f79e08-13eb-4328-8f2b-8f8ed1ac46c9"
    },
    "originalPrompt": "請根據你對我的理解，設計一種不存在於現實世界的全新生物，這種生物不是單純代表「我像哪一種動物」，而是要把我的個性、思考方式、情緒模式、矛盾點、習慣、美感傾向、優點與弱點，轉化成牠的外型與生態特徵。\n\n請完整設計牠的：\n\n- 物種定位與整體外觀\n- 身體結構與比例\n- 毛髮、羽毛、鱗片、角、翅膀或其他特殊器官\n- 顏色與紋路\n- 眼神與表情特徵\n- 棲息環境\n- 晝行性或夜行性\n- 防衛方式與生存策略\n- 牠會收集或圍繞在身邊的物品\n- 一個能象徵我內在矛盾的特殊演化特徵\n\n重點是：每一個外觀與能力設定，都要能對應到某種人格面向，而不是隨便拼湊可愛元素。\n\n最後請把牠描繪成一種剛被發現的神祕物種，單獨出現在牠的自然棲地中，像是奇幻博物誌、幻想生物圖鑑或自然學家第一次觀察到牠時留下的影像紀錄。\n\n整體感覺不要太可愛，也不要純粹走怪物風，而是要帶點異樣感與靈性。風格偏半寫實，細節精緻，生物結構可信，帶有電影感光影、淺景深、自然紋理與低調神祕的氣氛。",
    "promptPending": false,
    "tags": [
      "奇幻",
      "生物"
    ],
    "status": "tried",
    "isFavorite": true,
    "collectionNotes": "",
    "id": "688eda13-ca2f-4084-94a0-058f573f0f90",
    "attempts": [
      {
        "name": "頭上長角又有蜘蛛網的貓",
        "images": [
          {
            "id": "f14fa390-71cf-4b7b-8428-67f34eb0d8a6",
            "width": 2048,
            "height": 1117,
            "mimeType": "image/webp",
            "byteSize": 248846,
            "createdAt": "2026-09-11T11:14:42.198Z"
          }
        ],
        "platform": "Gemini",
        "promptMode": "original",
        "prompt": "請根據你對我的理解，設計一種不存在於現實世界的全新生物，這種生物不是單純代表「我像哪一種動物」，而是要把我的個性、思考方式、情緒模式、矛盾點、習慣、美感傾向、優點與弱點，轉化成牠的外型與生態特徵。\n\n請完整設計牠的：\n\n- 物種定位與整體外觀\n- 身體結構與比例\n- 毛髮、羽毛、鱗片、角、翅膀或其他特殊器官\n- 顏色與紋路\n- 眼神與表情特徵\n- 棲息環境\n- 晝行性或夜行性\n- 防衛方式與生存策略\n- 牠會收集或圍繞在身邊的物品\n- 一個能象徵我內在矛盾的特殊演化特徵\n\n重點是：每一個外觀與能力設定，都要能對應到某種人格面向，而不是隨便拼湊可愛元素。\n\n最後請把牠描繪成一種剛被發現的神祕物種，單獨出現在牠的自然棲地中，像是奇幻博物誌、幻想生物圖鑑或自然學家第一次觀察到牠時留下的影像紀錄。\n\n整體感覺不要太可愛，也不要純粹走怪物風，而是要帶點異樣感與靈性。風格偏半寫實，細節精緻，生物結構可信，帶有電影感光影、淺景深、自然紋理與低調神祕的氣氛。",
        "model": "Nano Banana 2",
        "notes": "Gemini我真的不懂你......",
        "rating": 2,
        "date": "2026-09-11",
        "id": "03d13f78-fa38-4e3e-9123-bafe9d01dca0",
        "createdAt": "2026-09-11T11:15:09.832Z"
      }
    ],
    "createdAt": "2026-09-11T10:51:05.352Z",
    "updatedAt": "2026-09-11T11:22:04.472Z"
  },
  {
    "name": "被自然重新接管的世界",
    "referenceImages": [
      {
        "id": "48c1b577-e2ca-4193-9a0c-0ddedbae56aa",
        "width": 1672,
        "height": 941,
        "mimeType": "image/webp",
        "byteSize": 385358,
        "createdAt": "2026-09-11T10:40:56.536Z"
      }
    ],
    "coverSource": {
      "type": "reference",
      "imageId": "48c1b577-e2ca-4193-9a0c-0ddedbae56aa"
    },
    "originalPrompt": "根據我提供的風景參考圖進行再創作，保留原本的大地形、建築位置、透視角度、主要構圖與可辨識地標，但把整個場景改造成一個「人類消失數百年後，被自然重新接管的世界」。\n\n讓植物、藤蔓、苔蘚、野花與樹根逐漸覆蓋道路、牆面與建築結構；石縫中長出草木，舊有的人造空間被時間與自然慢慢吞沒。可以加入一些細節，暗示這裡曾有人生活過，例如褪色招牌、破舊書頁、生鏽腳踏車、玻璃杯、荒廢的咖啡座位等，但畫面中不要出現任何人。\n\n整體氛圍請偏向安靜、夢幻、帶點憂鬱感的後文明世界，不是災難片式的末日，而是一種「世界在沒有人之後，仍然溫柔地繼續生長」的感覺。畫面風格像古老歐洲街區與植物遺跡融合的場景，帶有微霧、空氣粒子、午後斜陽與柔和的體積光。\n\n請呈現半寫實、電影感的環境畫面，細節豐富、材質真實，色調以低飽和的大地色、森林綠、舊石牆灰與暖金色陽光為主，整體安靜、美麗、神祕、沉浸感強。",
    "promptPending": false,
    "tags": [
      "風景",
      "自然",
      "末日後"
    ],
    "status": "tried",
    "isFavorite": false,
    "collectionNotes": "",
    "id": "3a42b95f-8863-45eb-8552-eedace67af74",
    "attempts": [
      {
        "name": "咖啡街",
        "images": [
          {
            "id": "aeee9fc6-5031-4268-9330-42382fd88ef1",
            "width": 941,
            "height": 1672,
            "mimeType": "image/webp",
            "byteSize": 650372,
            "createdAt": "2026-09-11T10:42:00.478Z"
          }
        ],
        "platform": "ChatGPT",
        "promptMode": "original",
        "prompt": "根據我提供的風景參考圖進行再創作，保留原本的大地形、建築位置、透視角度、主要構圖與可辨識地標，但把整個場景改造成一個「人類消失數百年後，被自然重新接管的世界」。\n\n讓植物、藤蔓、苔蘚、野花與樹根逐漸覆蓋道路、牆面與建築結構；石縫中長出草木，舊有的人造空間被時間與自然慢慢吞沒。可以加入一些細節，暗示這裡曾有人生活過，例如褪色招牌、破舊書頁、生鏽腳踏車、玻璃杯、荒廢的咖啡座位等，但畫面中不要出現任何人。\n\n整體氛圍請偏向安靜、夢幻、帶點憂鬱感的後文明世界，不是災難片式的末日，而是一種「世界在沒有人之後，仍然溫柔地繼續生長」的感覺。畫面風格像古老歐洲街區與植物遺跡融合的場景，帶有微霧、空氣粒子、午後斜陽與柔和的體積光。\n\n請呈現半寫實、電影感的環境畫面，細節豐富、材質真實，色調以低飽和的大地色、森林綠、舊石牆灰與暖金色陽光為主，整體安靜、美麗、神祕、沉浸感強。",
        "notes": "",
        "rating": 4,
        "date": "2026-09-11",
        "id": "6da836fc-739c-4860-8507-9db72ac0252f",
        "createdAt": "2026-09-11T10:42:37.936Z"
      },
      {
        "images": [
          {
            "id": "94021c5b-2e24-4791-86c9-693828badfe6",
            "width": 2048,
            "height": 1153,
            "mimeType": "image/webp",
            "byteSize": 417632,
            "createdAt": "2026-09-11T10:48:18.175Z"
          }
        ],
        "platform": "Gemini",
        "promptMode": "custom",
        "prompt": "根據我提供的風景參考圖進行再創作，保留原本的大地形、建築位置、透視角度、主要構圖與可辨識地標，但把整個場景改造成一個「人類消失數百年後，被自然重新接管的世界」。\n\n讓植物、藤蔓、苔蘚、野花與樹根逐漸覆蓋道路、牆面與建築結構；石縫中長出草木，舊有的人造空間被時間與自然慢慢吞沒。可以加入一些細節，暗示這裡曾有人生活過，但畫面中不要出現任何人。\n\n整體氛圍請偏向安靜、夢幻、帶點憂鬱感的後文明世界，不是災難片式的末日，而是一種「世界在沒有人之後，仍然溫柔地繼續生長」的感覺。畫面風格像古老歐洲街區與植物遺跡融合的場景，帶有微霧、空氣粒子、午後斜陽與柔和的體積光。\n\n請呈現半寫實、電影感的環境畫面，細節豐富、材質真實，色調以低飽和的大地色、森林綠、舊石牆灰與暖金色陽光為主，整體安靜、美麗、神祕、沉浸感強。",
        "notes": "刪除物品範例。",
        "rating": null,
        "date": "2026-09-11",
        "id": "515d18dc-30b5-4bf5-9968-40aa9c75d317",
        "createdAt": "2026-09-11T10:49:11.687Z"
      }
    ],
    "createdAt": "2026-09-11T10:41:46.992Z",
    "updatedAt": "2026-09-11T10:49:11.687Z"
  }
];

export function starterImageAssetPath(image: ImageRef): string {
  const extension = image.mimeType === "image/webp" ? "webp" : image.mimeType === "image/jpeg" ? "jpg" : "png";
  return `starter/${image.id}.${extension}`;
}

export function starterImageUrl(image: ImageRef, baseUrl: string): string {
  const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return `${base}${starterImageAssetPath(image)}`;
}

export function starterImageRefs(collections: Collection[] = STARTER_COLLECTIONS): ImageRef[] {
  const refs = new Map<string, ImageRef>();
  for (const collection of collections) {
    for (const image of collection.referenceImages) refs.set(image.id, image);
    for (const attempt of collection.attempts) for (const image of attempt.images) refs.set(image.id, image);
  }
  return [...refs.values()];
}
