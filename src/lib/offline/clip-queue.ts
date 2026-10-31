import { ApiFailure } from "@/lib/api";

// Voice notes waiting for a connection (F-03b; doc 02 "Offline behaviour",
// doc 07 "Offline queue"). Each clip keeps the client ID it was recorded
// with, so however often it's retried, Storage holds one file and the
// server makes one proposal from it.

export interface QueuedClip {
  clientId: string;
  ownerId: string; // only the owner who recorded it sends it
  kind: "COMMAND" | "SETUP";
  wav: Uint8Array<ArrayBuffer>;
  path: string | null; // set once the upload has finished
  createdAt: number;
  attempts: number;
  nextAttemptAt: number;
}

const DB = "shelfvoice";
const STORE = "clips";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "clientId" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const request = work(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export const saveClip = (clip: QueuedClip) => run("readwrite", (store) => store.put(clip)).then(() => undefined);
export const removeClip = (clientId: string) => run("readwrite", (store) => store.delete(clientId)).then(() => undefined);
export const listClips = (ownerId: string) =>
  run("readonly", (store) => store.getAll() as IDBRequest<QueuedClip[]>).then((all) =>
    all.filter((clip) => clip.ownerId === ownerId).sort((a, b) => a.createdAt - b.createdAt),
  );

// 5 s, 10 s, 20 s … up to 5 minutes between tries; coming back online or
// opening the app tries at once.
export function retryDelayMs(attempts: number): number {
  return Math.min(5_000 * 2 ** Math.max(0, attempts - 1), 300_000);
}

// No connection, or one that dropped mid-upload: keep the clip and wait.
export function isConnectionProblem(error: unknown): boolean {
  return error instanceof ApiFailure && (error.status === 0 || error.code === "UPLOAD_TIMEOUT");
}

// Worth trying again later: the connection, the server, the rate limit, or
// the AI resting. Anything else (nothing heard, unreadable audio) won't get
// better by waiting.
export function isRetryable(error: unknown): boolean {
  if (!(error instanceof ApiFailure)) return true;
  if (isConnectionProblem(error)) return true;
  if (error.status === 401 || error.status === 429 || error.status >= 500) return true;
  return error.code === "UPLOAD_FAILED";
}
