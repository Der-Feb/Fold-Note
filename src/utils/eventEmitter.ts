/**
 * A minimal EventEmitter that works in both VS Code extension host
 * and plain Node (unit tests).
 */
export class SimpleEventEmitter<T> {
  private _listeners: Array<(e: T) => void> = [];

  event = (listener: (e: T) => void): { dispose: () => void } => {
    this._listeners.push(listener);
    return {
      dispose: () => {
        this._listeners = this._listeners.filter((l) => l !== listener);
      },
    };
  };

  fire(e: T): void {
    for (const listener of this._listeners) {
      listener(e);
    }
  }

  dispose(): void {
    this._listeners = [];
  }
}
