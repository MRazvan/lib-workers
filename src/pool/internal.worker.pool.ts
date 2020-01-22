import { isNil, isNumber } from 'lodash';
import { isArray } from 'util';
import { WorkerPool } from './worker.pool';

class ReservedCell {
  constructor(public index: number, public key: string | number) {}
}

export class InternalWorkerPool extends WorkerPool {
  private static readonly _reservedCells: ReservedCell[] = [];
  private static _nextCell = 0;

  public static getSharedMemory(): Int32Array {
    return WorkerPool._sharedArray;
  }

  public static getCell(key: string | number, numberOfCells = 1, clearValue?: number | number[]): number {
    if (WorkerPool.isWorker()) {
      throw new Error('Cannot create Synchronization Primitives from a worker thread');
    }
    // First check to see if we already have this reserved
    const cell = InternalWorkerPool._reservedCells.find(rc => rc.key === key);
    if (!isNil(cell)) {
      return cell.index;
    }
    const id = InternalWorkerPool._nextCell;
    InternalWorkerPool._nextCell += numberOfCells;

    if (isNumber(clearValue)) {
      for (let idx = 0; idx < numberOfCells; ++idx) {
        WorkerPool._sharedArray[id + idx] = clearValue;
      }
    } else if (isArray(clearValue)) {
      for (let idx = 0; idx < numberOfCells; ++idx) {
        WorkerPool._sharedArray[id + idx] = clearValue[idx];
      }
    }

    InternalWorkerPool._reservedCells.push(new ReservedCell(id, key));
    return id;
  }
}
