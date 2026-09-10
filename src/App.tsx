import { useRef, useState } from "react";
import { useStore } from "./store";
import { Collection, Attempt } from "./types";
import Gallery from "./Gallery";
import DetailView from "./DetailView";
import CollectionModal from "./CollectionModal";
import AttemptModal from "./AttemptModal";

type Modal =
  | { type: "addCollection" }
  | { type: "editCollection"; collection: Collection }
  | { type: "addAttempt"; collection: Collection }
  | { type: "editAttempt"; collection: Collection; attempt: Attempt };

export default function App() {
  const store = useStore();
  const [openId, setOpenId] = useState<string | null>(null);
  const [modal, setModal] = useState<Modal | null>(null);
  const scrollPos = useRef(0);

  const openCollection = store.collections.find((c) => c.id === openId);

  function handleOpenCollection(id: string) {
    scrollPos.current = 0; // scroll pos is saved in Gallery via onScroll
    setOpenId(id);
  }

  function handleBack() {
    setOpenId(null);
  }

  return (
    <div className="h-full">
      {/* 儲存錯誤跨表單顯示；失敗時不關閉表單、不切換頁面。 */}
      {store.storageError && (
        <div role="alert" className="fixed top-3 left-4 right-4 z-[100] rounded-lg bg-[#2a1010] border border-[#e06e6e] p-3 text-sm text-[#ffcaca]">
          <div className="flex items-start justify-between gap-3">
            <span>{store.storageError}</span>
            <button type="button" onClick={store.dismissStorageError} aria-label="關閉儲存錯誤提示" className="shrink-0 rounded px-2 text-lg hover:bg-white/10">×</button>
          </div>
        </div>
      )}
      {store.loadState !== "ready" && (
        <div className="flex h-full flex-col items-center justify-center gap-4 text-sm text-[#c8c4bc]">
          <p role="status">{store.loadState === "loading" ? "正在載入本機收藏（首次開啟會搬移舊資料）……" : "收藏載入失敗，原有資料仍保留。"}</p>
          {store.loadState === "error" && <button onClick={() => void store.reload()} className="rounded bg-[#c9a96e] px-4 py-2 text-black">重試載入</button>}
        </div>
      )}
      {/* Gallery */}
      <div className={`h-full ${openId || store.loadState !== "ready" ? "hidden" : "block"}`}>
        <Gallery
          store={store}
          scrollPos={scrollPos}
          onOpen={handleOpenCollection}
          onAdd={() => setModal({ type: "addCollection" })}
        />
      </div>

      {/* Detail view */}
      {openCollection && (
        <div className={`h-full ${openId ? "block" : "hidden"}`}>
          <DetailView
            key={openCollection.id}
            collection={openCollection}
            store={store}
            onBack={handleBack}
            onAddAttempt={() => setModal({ type: "addAttempt", collection: openCollection })}
            onEditAttempt={(a) =>
              setModal({ type: "editAttempt", collection: openCollection, attempt: a })
            }
            onEditCollection={() =>
              setModal({ type: "editCollection", collection: openCollection })
            }
          />
        </div>
      )}

      {/* Modals */}
      {modal?.type === "addCollection" && (
        <CollectionModal
          onSave={async (data) => {
            const id = await store.addCollection(data);
            if (!id) return;
            setModal(null);
            setOpenId(id);
          }}
          onClose={() => setModal(null)}
        />
      )}

      {modal?.type === "editCollection" && (
        <CollectionModal
          existing={modal.collection}
          onSave={async (data) => {
            if (!await store.editCollection(modal.collection.id, data)) return;
            setModal(null);
          }}
          onClose={() => setModal(null)}
        />
      )}

      {modal?.type === "addAttempt" && (
        <AttemptModal
          originalPrompt={modal.collection.originalPrompt}
          onSave={async (data) => {
            if (!await store.addAttempt(modal.collection.id, data)) return;
            setModal(null);
          }}
          onClose={() => setModal(null)}
        />
      )}

      {modal?.type === "editAttempt" && (
        <AttemptModal
          originalPrompt={modal.collection.originalPrompt}
          existing={modal.attempt}
          onSave={async (data) => {
            if (!await store.editAttempt(modal.collection.id, modal.attempt.id, data)) return;
            setModal(null);
          }}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
