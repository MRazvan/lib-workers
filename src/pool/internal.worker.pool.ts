import { WorkerPool } from "./worker.pool";
import { isNil } from "lodash";

class ReservedCell {
    constructor(public index: number,
    public key: string | number){}
}

export class InternalWorkerPool extends WorkerPool {
    private static _reservedCells : ReservedCell[] = [];
    private static _nextCell: number = 0;
    
    public static getSharedMemory(): Int32Array {
        return WorkerPool._sharedArray;
    }

    public static getCell(key: string | number): Promise<number> {
        if (WorkerPool.isWorker()){
            // We need to request from the parent an id
        }else{
            const cell = InternalWorkerPool._reservedCells.find((rc) => rc.key === key);
            if (!isNil(cell)){
                return Promise.resolve(cell.index);
            }
            const id = InternalWorkerPool._nextCell++;
            InternalWorkerPool._reservedCells.push(new ReservedCell(id, key));
            return Promise.resolve(id);
        }
    }
}