const DATABASE_NAME = 'roomtone-local-library';
const DATABASE_VERSION = 1;
const PROJECTS_STORE = 'projects';

let databasePromise;

function openDatabase() {
  if (!('indexedDB' in window)) {
    return Promise.reject(new Error('This browser does not support local project storage.'));
  }

  if (databasePromise) return databasePromise;

  databasePromise = new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(PROJECTS_STORE)) {
        database.createObjectStore(PROJECTS_STORE, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => {
        database.close();
        databasePromise = null;
      };
      resolve(database);
    };

    request.onerror = () => {
      databasePromise = null;
      reject(request.error || new Error('The local project library could not be opened.'));
    };

  });

  return databasePromise;
}

function transactionComplete(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('The local project could not be saved.'));
    transaction.onabort = () => reject(transaction.error || new Error('The local project save was interrupted.'));
  });
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('The local project library could not be read.'));
  });
}

export async function loadLocalProjects() {
  const database = await openDatabase();
  const transaction = database.transaction(PROJECTS_STORE, 'readonly');
  const records = await requestResult(transaction.objectStore(PROJECTS_STORE).getAll());
  return records.sort((left, right) => Number(right.createdAt || 0) - Number(left.createdAt || 0));
}

export async function saveLocalProject(project) {
  const database = await openDatabase();
  const transaction = database.transaction(PROJECTS_STORE, 'readwrite');
  const complete = transactionComplete(transaction);

  transaction.objectStore(PROJECTS_STORE).put({
    key: project.key,
    name: project.name,
    file: project.file,
    blob: project.blob,
    duration: project.duration,
    size: project.size,
    settings: project.settings || null,
    createdAt: project.createdAt instanceof Date ? project.createdAt.getTime() : Number(project.createdAt) || Date.now(),
  });

  await complete;
}
