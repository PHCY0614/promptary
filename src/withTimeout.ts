export function withTimeout<T>(promise: Promise<T>, ms: number, error: Error): Promise<T> {
  if (ms <= 0) return promise;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(error), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}
