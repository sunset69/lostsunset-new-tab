/**
 * 统一的异步结果形态，详见设计文档第 7 节。
 * UI 只根据错误码展示文案，不直接依赖底层异常字符串。
 */
export type AppError = {
  code: string
  message: string
  cause?: unknown
}

export type AsyncResult<T, E = AppError> =
  | { ok: true; data: T }
  | { ok: false; error: E }

export function ok<T>(data: T): AsyncResult<T, never> {
  return { ok: true, data }
}

export function fail<E>(error: E): AsyncResult<never, E> {
  return { ok: false, error }
}
