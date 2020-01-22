import { InternalWorkerPool } from "../internal.worker.pool";
import { Serialize } from "../attributes/serializer";

// Make it so it's serializable, we can send it to other workers
@Serialize()
export class Mutex {
    private constructor(public key: string| number, private _index: number){
        
    }

    private __init(){
        Atomics.store(InternalWorkerPool.getSharedMemory(), this._index, 0);
    }

    public lock(){
        while(true){
            // Wait for the 'lock' to release
            Atomics.wait(InternalWorkerPool.getSharedMemory(), this._index, 1);
            // Try and get the lock
            const value = Atomics.compareExchange(InternalWorkerPool.getSharedMemory(), this._index, 0, 1);
            
            // The value in the array was 1 and we could not replace it
            if (value === 1){
                // Somebody else beat us to it, go again
                continue;
            }
            // We managed to take the lock
            break;            
        }
    }

    public unlock() {
        // Release the lock
        Atomics.store(InternalWorkerPool.getSharedMemory(), this._index, 0);
        // Wakeup waiting agents
        Atomics.notify(InternalWorkerPool.getSharedMemory(), this._index, Number.MAX_SAFE_INTEGER);
    }

    public static async get(key: string | number): Promise<Mutex> {
        const idx = await InternalWorkerPool.getCell(key);
        const mutex = new Mutex(key, idx);
        mutex.__init();
        return mutex;
    }
}