import { Serialize } from '../attributes/serializer';
import { InternalWorkerPool } from '../internal.worker.pool';

export enum SemaphoreState {
  LOCKED = 1,
  UNLOCKED = 0
}

// Make it so it's serializable, we can send it to other workers
@Serialize()
export class BinarySemaphore {
  private constructor(public key: string | number, private readonly _index: number) {}

  public get state(): SemaphoreState {
    return Atomics.load(InternalWorkerPool.getSharedMemory(), this._index) === 1
      ? SemaphoreState.LOCKED
      : SemaphoreState.UNLOCKED;
  }

  public lock(timeout: number = Number.MAX_SAFE_INTEGER): boolean {
    let lockAquired = false;
    while (!lockAquired) {
      // Wait for the 'lock' to release
      Atomics.wait(InternalWorkerPool.getSharedMemory(), this._index, 1, timeout);
      // Try and get the lock
      const value = Atomics.compareExchange(InternalWorkerPool.getSharedMemory(), this._index, 0, 1);

      // The value in the array was 1 and we could not replace it
      if (value === 1) {
        if (timeout !== Number.MAX_SAFE_INTEGER) {
          return false;
        }
        // Somebody else beat us to it, go again
        continue;
      }
      if (value > 1 || value < 0) {
        // ?? TODO:  At least write a log somewhere, somebody (gamma particle) changed the value of the lock to some invalid value
        //    That means all workers waiting on this lock were released, so we are in an invalid situation
        // TODO: Close process, close worker what?
        // For now just throw
        throw new Error(`Invalid semaphore state. ${this.key} - ${value}. Cannot continue.`);
      }
      // We managed to take the lock
      lockAquired = true;
    }
    return lockAquired;
  }

  public unlock(): void {
    // Release the lock
    Atomics.store(InternalWorkerPool.getSharedMemory(), this._index, 0);
    // Wakeup waiting agents
    Atomics.notify(InternalWorkerPool.getSharedMemory(), this._index, Number.MAX_SAFE_INTEGER);
  }

  public static create(key: string | number): BinarySemaphore {
    const idx = InternalWorkerPool.getCell(key);
    return new BinarySemaphore(key, idx);
  }
}
