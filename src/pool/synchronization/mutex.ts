import { Serialize } from '../attributes/serializer';
import { InternalWorkerPool } from '../internal.worker.pool';
import { getThreadId } from '../worker.pool';

export enum MutexState {
  LOCKED = 1,
  UNLOCKED = 0
}

// Make it so it's serializable, we can send it to other workers
@Serialize()
export class Mutex {
  private constructor(public key: string | number, private readonly _index: number) {}

  public get state(): MutexState {
    return Atomics.load(InternalWorkerPool.getSharedMemory(), this._index) === 1
      ? MutexState.LOCKED
      : MutexState.UNLOCKED;
  }

  public get owningThreadId(): number {
    return Atomics.load(InternalWorkerPool.getSharedMemory(), this._index + 1);
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
        throw new Error(`Invalid mutex state. ${this.key} - ${value}. Cannot continue.`);
      }
      this._setOwningWorkerId();
      // We managed to take the lock
      lockAquired = true;
    }
    return lockAquired;
  }

  public unlock(): void {
    if (this.owningThreadId !== getThreadId()) {
      // Don't try and do something funny from another worker
      //  we are not the worker that got the lock
      throw new Error('Mutex. Cannot unlock a mutex that is not locked by us.');
    }

    const owningThread = Atomics.compareExchange(
      InternalWorkerPool.getSharedMemory(),
      this._index + 1,
      // We expect the value to be our id
      getThreadId(),
      // If we are successfull clear the id
      -1
    );
    if (owningThread !== getThreadId()) {
      // We did not have ownership, how the F did we get here
    }
    // Release the lock
    Atomics.store(InternalWorkerPool.getSharedMemory(), this._index, 0);
    // Wakeup waiting agents
    Atomics.notify(InternalWorkerPool.getSharedMemory(), this._index, Number.MAX_SAFE_INTEGER);
  }

  private _setOwningWorkerId(): void {
    Atomics.compareExchange(InternalWorkerPool.getSharedMemory(), this._index + 1, -1, getThreadId());
  }

  public static create(key: string | number): Mutex {
    const idx = InternalWorkerPool.getCell(key, 2, [0, -1]);
    return new Mutex(key, idx);
  }
}
