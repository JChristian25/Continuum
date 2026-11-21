// A file bundle can exceed localStorage quota. Keep one recoverable import per
// account in IndexedDB until both admission and workspace navigation succeed.
function openImportDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('continuum-service-imports', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('imports', { keyPath: 'actorId' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withImportStore(mode, apply) {
  const database = await openImportDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction('imports', mode);
      const result = apply(transaction.objectStore('imports'));
      transaction.oncomplete = () => resolve(result.result);
      transaction.onabort = () => reject(transaction.error || new Error('The import could not be saved in this browser.'));
    });
  } finally {
    database.close();
  }
}

export const readImport = actorId => withImportStore('readonly', store => store.get(actorId));
export const rememberImport = entry => withImportStore('readwrite', store => store.add(entry));

export function clearImport(entry) {
  return withImportStore('readwrite', store => {
    const request = store.get(entry.actorId);
    request.onsuccess = () => {
      if (request.result?.payload.requestId === entry.payload.requestId) store.delete(entry.actorId);
    };
    return request;
  });
}
