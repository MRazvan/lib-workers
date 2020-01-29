import { isNumber } from 'lodash';
import { Serialize } from '../../../attributes/serializer';
import { Threading } from '../../../implementation/threading/threading';
import { getLog, Logger } from '../../../logging';
import { PrimitiveType } from '../primitive.types';
import { INVALID_PRIMITIVE_INDEX, Synchronization } from '../sync';

export enum MutexState {
  LOCKED = 1,
  UNLOCKED = 0
}

// Offset in the buffer where the pieces of information as stored
const MUTEX_STATE_OFFSET = 0;
const OWNING_THREAD_OFFSET = 1;

// Some id that indicates that a certain threadId is invalid
const NO_OWNING_THREAD = -1;

// Make it so it's serializable, we can send it to other workers
@Serialize()
export class Mutex {
  private static readonly _log: Logger = getLog('[Mutex]');
  private constructor(public key: string | number, private readonly _index: number) {}

  public get state(): MutexState {
    return Atomics.load(Synchronization.getBuffer(), this._index + MUTEX_STATE_OFFSET) === MutexState.LOCKED
      ? MutexState.LOCKED
      : MutexState.UNLOCKED;
  }

  public get owningThreadId(): number {
    return Atomics.load(Synchronization.getBuffer(), this._index + OWNING_THREAD_OFFSET);
  }

  public lock(timeout: number = Number.MAX_SAFE_INTEGER): boolean {
    const buffer = Synchronization.getBuffer();
    Mutex._log('Wait', this.key);

    let lockAquired = false;
    while (!lockAquired) {
      // Wait for the 'lock' to release
      const start = Date.now();
      Atomics.wait(buffer, this._index + MUTEX_STATE_OFFSET, MutexState.LOCKED, timeout);
      // Try and get the lock
      const value = Atomics.compareExchange(
        buffer,
        this._index + MUTEX_STATE_OFFSET,
        // Expected state
        MutexState.UNLOCKED,
        // New state
        MutexState.LOCKED
      );

      // Somebody else beat us to the lock or the timeout expired
      if (value === MutexState.LOCKED) {
        timeout -= Date.now() - start;
        // Timeout expired
        if (timeout <= 0) {
          return false;
        }
        // We still have a timeout
        continue;
      }

      // We managed to take the lock
      // Set the thread id
      // Theoretically between 'compareExchange' and 'store' some other thread could release the lock
      //  however that thread should have id: -1 and as far as I know that is not possible
      Atomics.store(buffer, this._index + OWNING_THREAD_OFFSET, Threading.threadId);
      lockAquired = true;
    }
    Mutex._log('Lock', this.key);
    return lockAquired;
  }

  public unlock(): void {
    Mutex._log('Unlock', this.key);
    if (this.owningThreadId !== Threading.threadId) {
      // Don't try and do something funny from another worker
      //  we are not the worker that got the lock
      throw new Error('Mutex. Cannot unlock a mutex that is not locked by us.');
    }

    const buffer = Synchronization.getBuffer();
    // Clear the owning thread id
    Atomics.store(
      buffer,
      this._index + OWNING_THREAD_OFFSET,
      // If we are successfull clear the id
      NO_OWNING_THREAD
    );
    // Release the lock
    Atomics.store(buffer, this._index + MUTEX_STATE_OFFSET, MutexState.UNLOCKED);
    // Wakeup waiting agents
    Atomics.notify(buffer, this._index + MUTEX_STATE_OFFSET, Number.MAX_SAFE_INTEGER);
  }

  public static createOrGet(mutexKey: number, state: MutexState = MutexState.UNLOCKED): Mutex {
    if (!isNumber(mutexKey) || isNaN(mutexKey) || !isFinite(mutexKey)) {
      throw new Error(`The Mutex key must be a number. Got ${mutexKey}`);
    }
    // In case we create a new Mutex, the following state should be set
    //    in the data portion
    // If we return an existing mutex, we don't change the state
    const mutexInitialState: [number, number] = [-1, -1];
    mutexInitialState[MUTEX_STATE_OFFSET] = state; // This should be 0 or 1
    mutexInitialState[OWNING_THREAD_OFFSET] = state === MutexState.LOCKED ? Threading.threadId : NO_OWNING_THREAD;

    const mutexBufferIndex = Synchronization.getIndexForPrimitive(mutexKey, PrimitiveType.MUTEX, mutexInitialState);
    if (mutexBufferIndex === INVALID_PRIMITIVE_INDEX) {
      throw new Error('Cannot allocated space for Mutex');
    }
    return new Mutex(mutexKey, mutexBufferIndex);
  }
}
