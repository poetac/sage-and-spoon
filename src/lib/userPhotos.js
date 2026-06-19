/* ----------------------------- user photo store --------------------------- */
// Cook-supplied recipe photos live in IndexedDB (localStorage is too small for
// images). One record per recipe id; the value is an array of resized data
// URLs, newest first. Everything is best-effort: where IndexedDB is missing
// (private modes, the test jsdom) the helpers degrade to no-ops and the
// in-memory app state still works for the session.

const DB_NAME = "sage-and-spoon";
const STORE = "ss_user_photos";
const VERSION = 1;

const hasIDB = typeof indexedDB !== "undefined" && indexedDB !== null;

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("indexeddb open failed"));
  });
}

// Returns { [recipeId]: string[] } for every recipe that has stored photos.
export async function loadAllUserPhotos() {
  if (!hasIDB) return {};
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const out = {};
      const req = db.transaction(STORE, "readonly").objectStore(STORE).openCursor();
      req.onsuccess = () => {
        const cur = req.result;
        if (cur) {
          if (Array.isArray(cur.value) && cur.value.length) out[cur.key] = cur.value;
          cur.continue();
        } else resolve(out);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return {};
  }
}

// Wipe every cook-supplied photo (used by Settings → Start over).
export async function clearAllUserPhotos() {
  if (!hasIDB) return;
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error("transaction aborted"));
    });
  } catch {
    /* best-effort */
  }
}

// Persist (or clear, when empty) the photo list for one recipe.
export async function saveUserPhotos(id, photos) {
  if (!hasIDB) return;
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      const os = tx.objectStore(STORE);
      if (photos && photos.length) os.put(photos, id);
      else os.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error("transaction aborted"));
    });
  } catch {
    /* best-effort: the in-memory state still reflects this change for the session */
  }
}
