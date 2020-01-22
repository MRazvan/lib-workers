import { InternalWorkerPool } from "../internal.worker.pool";
import { Serialize } from "../attributes/serializer";

// Make it so it's serializable, we can send it to other workers
@Serialize()
export class Barrier {
    private constructor(public key: string| number, private _index: number){}

    // Wait on this until someone call's notify
    public wait(){
        Atomics.wait(InternalWorkerPool.getSharedMemory(), this._index, 1);
    }

    public notify() {
        // Releae the lock
        Atomics.store(InternalWorkerPool.getSharedMemory(), this._index, 0);
        // Wakeup waiting agents
        Atomics.notify(InternalWorkerPool.getSharedMemory(), this._index, Number.MAX_SAFE_INTEGER);
    }

    public reset(){
        Atomics.store(InternalWorkerPool.getSharedMemory(), this._index, 1);
    }

    public static async get(key: string | number): Promise<Barrier> {
        const idx = await InternalWorkerPool.getCell(key);
        const barrier =  new Barrier(key, idx);
        barrier.reset();
        return barrier;
    }
}