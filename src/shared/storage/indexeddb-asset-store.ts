import type { WallpaperAsset } from '../models/asset'
import type { AssetStore } from './asset-store'

export const WALLPAPER_DB_NAME = 'lostsunset-new-tab'
export const WALLPAPER_DB_VERSION = 1
export const WALLPAPER_STORE_NAME = 'wallpaper-assets'

/** 打开（必要时创建）壁纸资产数据库。 */
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(WALLPAPER_DB_NAME, WALLPAPER_DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(WALLPAPER_STORE_NAME)) {
        db.createObjectStore(WALLPAPER_STORE_NAME, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('打开壁纸数据库失败'))
  })
}

function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDatabase().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(WALLPAPER_STORE_NAME, mode)
        const request = run(transaction.objectStore(WALLPAPER_STORE_NAME))
        request.onsuccess = () => {
          resolve(request.result)
        }
        request.onerror = () => reject(request.error ?? new Error('壁纸数据库操作失败'))
        transaction.oncomplete = () => db.close()
        transaction.onerror = () => {
          db.close()
          reject(transaction.error ?? new Error('壁纸数据库事务失败'))
        }
      }),
  )
}

/** 基于 IndexedDB 的壁纸资产存储（unlimitedStorage 已在 manifest 声明）。 */
export const indexedDbAssetStore: AssetStore = {
  async get(assetId: string) {
    return withStore<WallpaperAsset | undefined>('readonly', (store) =>
      store.get(assetId) as IDBRequest<WallpaperAsset | undefined>,
    )
  },

  async put(asset: WallpaperAsset) {
    await withStore<IDBValidKey>('readwrite', (store) => store.put(asset))
  },

  async remove(assetId: string) {
    await withStore<undefined>('readwrite', (store) =>
      store.delete(assetId) as IDBRequest<undefined>,
    )
  },
}
