export const MAX_IMAGES_PER_BATCH = 10;
export const MAX_CONCURRENT_IMAGE_PROCESSING = 2;

export async function processImageBatch<T>(
  items: readonly T[],
  processItem: (item: T) => Promise<void>,
  isActive: () => boolean,
): Promise<boolean> {
  if (items.length > MAX_IMAGES_PER_BATCH) return false;
  let nextIndex = 0;
  async function worker() {
    while (isActive()) {
      const index = nextIndex++;
      if (index >= items.length) return;
      await processItem(items[index]);
    }
  }
  await Promise.all(Array.from(
    { length: Math.min(MAX_CONCURRENT_IMAGE_PROCESSING, items.length) },
    () => worker(),
  ));
  return true;
}

export function enqueueImageBatch<T>(
  queue: Promise<void>,
  items: readonly T[],
  processItem: (item: T) => Promise<void>,
  isActive: () => boolean,
): Promise<void> {
  return queue.then(async () => {
    await processImageBatch(items, processItem, isActive);
  });
}
