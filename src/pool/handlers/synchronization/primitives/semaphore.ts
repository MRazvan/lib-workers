import { isNumber } from 'lodash';
import { Serialize } from '../../../attributes/serializer';
import { getLog, Logger } from '../../../logging';
import { PrimitiveType } from '../primitive.types';
import { INVALID_PRIMITIVE_INDEX, Synchronization } from '../sync';

export enum SemaphoreState {
  LOCKED = 1,
  UNLOCKED = 0
}

// Make it so it's serializable, we can send it to other workers
@Serialize()
export class BinarySemaphore {
  private static readonly _log: Logger = getLog('[Semaphore]');
  private constructor(public key: string | number, private readonly _index: number) {}

  public get state(): SemaphoreState {
    return Atomics.load(Synchronization.getBuffer(), this._index) === SemaphoreState.LOCKED
      ? SemaphoreState.LOCKED
      : SemaphoreState.UNLOCKED;
  }

  public take(timeout: number = Number.MAX_SAFE_INTEGER): boolean {
    let lockAquired = false;
    BinarySemaphore._log('Wait', this.key);
    while (!lockAquired) {
      const start = Date.now();
      // Wait for the 'lock' to release
      // We don't care about the result of the wait, the code bellow will work regardless
      Atomics.wait(Synchronization.getBuffer(), this._index, SemaphoreState.LOCKED, timeout);
      // Try and get the lock
      const value = Atomics.compareExchange(
        Synchronization.getBuffer(),
        this._index,
        // Expected state
        SemaphoreState.UNLOCKED,
        // New state
        SemaphoreState.LOCKED
      );

      // Somebody else beat us to the lock or the timeout expired
      if (value === SemaphoreState.LOCKED) {
        timeout -= Date.now() - start;
        // Timeout expired
        if (timeout <= 0) {
          return false;
        }
        // We still have a timeout
        continue;
      }

      // We managed to take the lock
      lockAquired = true;
    }
    BinarySemaphore._log('Take', this.key);
    return lockAquired;
  }

  public give(): void {
    // Release the lock
    Atomics.store(Synchronization.getBuffer(), this._index, SemaphoreState.UNLOCKED);
    // Wakeup waiting agents
    Atomics.notify(Synchronization.getBuffer(), this._index, Number.MAX_SAFE_INTEGER);
    BinarySemaphore._log('Give', this.key);
  }

  public static createOrGet(semaphoreKey: number, state: SemaphoreState = SemaphoreState.UNLOCKED): BinarySemaphore {
    if (!isNumber(semaphoreKey) || isNaN(semaphoreKey) || !isFinite(semaphoreKey)) {
      throw new Error(`The BinarySemaphore key must be a number. Got ${semaphoreKey}`);
    }
    const semaphoreBufferIndex = Synchronization.getIndexForPrimitive(semaphoreKey, PrimitiveType.SEMAPHORE, [
      state,
      SemaphoreState.UNLOCKED
    ]);
    if (semaphoreBufferIndex === INVALID_PRIMITIVE_INDEX) {
      throw new Error('Cannot allocate space for BinarySemaphore');
    }
    return new BinarySemaphore(semaphoreKey, semaphoreBufferIndex);
  }
}
