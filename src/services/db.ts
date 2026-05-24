/**
 * ScanNest Local persistent sandbox database service using vanilla IndexedDB.
 * Completely client-side, zero cloud telemetry, highly optimized for raw Blob storage.
 */

export interface ScannedDocRecord {
  id: string;
  title: string;
  createdAt: number;
  type: 'document' | 'qr';
  // PDF specific parameters (optional)
  pageCount?: number;
  sizeBytes?: number;
  fileName?: string;
  pdfBlob?: Blob;
  // QR/Barcode specific parameters (optional)
  value?: string;
}

const DB_NAME = 'ScanNestDB';
const DB_VERSION = 1;
const STORE_NAME = 'scans';

/**
 * Initialize IndexedDB instance, establishing store structures
 */
export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error('IndexedDB is not supported by this browser.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        console.log('[ScanNest DB] scans object store initialized successfully.');
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      console.error('[ScanNest DB] Initialization error:', request.error);
      reject(request.error);
    };
  });
};

/**
 * Save a compiled PDF record to IndexedDB
 */
export const saveScan = async (record: ScannedDocRecord): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(record);

    request.onsuccess = () => {
      console.log(`[ScanNest DB] Saved document scan: ${record.title} (${record.sizeBytes} bytes)`);
      resolve();
    };

    request.onerror = () => {
      console.error('[ScanNest DB] Save failed:', request.error);
      reject(request.error);
    };
  });
};

/**
 * Query all scans ordered by creation date descending
 */
export const getAllScans = async (): Promise<ScannedDocRecord[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      // Sort in-memory chronologically descending (newest scans first)
      const sorted = (request.result as ScannedDocRecord[]).sort(
        (a, b) => b.createdAt - a.createdAt
      );
      resolve(sorted);
    };

    request.onerror = () => {
      console.error('[ScanNest DB] Query failed:', request.error);
      reject(request.error);
    };
  });
};

/**
 * Permanently erase a scanned PDF record by unique ID
 */
export const deleteScan = async (id: string): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => {
      console.log(`[ScanNest DB] Deleted scan record: ${id}`);
      resolve();
    };

    request.onerror = () => {
      console.error('[ScanNest DB] Delete failed:', request.error);
      reject(request.error);
    };
  });
};

/**
 * Rename a scanned document title metadata field by ID
 */
export const renameScan = async (id: string, newTitle: string): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    // Retrieve record first, update, and write back
    const getRequest = store.get(id);

    getRequest.onsuccess = () => {
      const record = getRequest.result as ScannedDocRecord;
      if (!record) {
        reject(new Error(`Scan record not found: ${id}`));
        return;
      }

      record.title = newTitle.trim();
      const putRequest = store.put(record);

      putRequest.onsuccess = () => {
        console.log(`[ScanNest DB] Renamed scan ${id} to: ${newTitle}`);
        resolve();
      };

      putRequest.onerror = () => {
        reject(putRequest.error);
      };
    };

    getRequest.onerror = () => {
      reject(getRequest.error);
    };
  });
};
