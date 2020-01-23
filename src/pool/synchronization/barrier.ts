import { Serialize } from '../attributes/serializer';
import { InternalWorkerPool } from '../internal.worker.pool';

export enum BarrierState {
  LOCKED,
  UNLOCKED
}
// Make it so it's serializable, we can send it to other workers
@Serialize()
export class Barrier {
  private constructor(public key: string | number, private readonly _index: number) {}

  public get state(): BarrierState {
    return Atomics.load(InternalWorkerPool.getSharedMemory(), this._index) === 1
      ? BarrierState.LOCKED
      : BarrierState.UNLOCKED;
  }

  // Wait on this until someone call's notify
  public wait(timeout: number = Number.MAX_SAFE_INTEGER): boolean {
    return Atomics.wait(InternalWorkerPool.getSharedMemory(), this._index, 1, timeout) === 'ok';
  }

  public notify(): void {
    // Release the lock
    Atomics.store(InternalWorkerPool.getSharedMemory(), this._index, 0);
    // Wakeup waiting agents
    Atomics.notify(InternalWorkerPool.getSharedMemory(), this._index, Number.MAX_SAFE_INTEGER);
  }

  public reset(): void {
    Atomics.store(InternalWorkerPool.getSharedMemory(), this._index, 1);
  }

  public static create(key: string | number): Barrier {
    const idx = InternalWorkerPool.getCell(key);
    const barrier = new Barrier(key, idx);
    barrier.reset();
    return barrier;
  }
}
