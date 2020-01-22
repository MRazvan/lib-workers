import { ClassData } from 'lib-reflect';
import { isNil, remove } from 'lodash';
import * as os from 'os';
import * as MY_SPECIAL_WORKER_KEY from 'worker_threads';
import { GetWorkerContexts, WorkerScheduledFileNameTagKey } from './attributes/worker.context';
import { DoneMsg } from './messages/done';
import { ErrorMsg } from './messages/error';
import { ExecuteMsg } from './messages/execute';
import { LoadScript } from './messages/load.script';
import { Serializer } from './serialization';

class Defered {
  constructor(public resolve: any, public reject: any, public message: any, public pinnedWorker: WorkerData) {}
}

class WorkerData {
  public ready: boolean;
  public deferred: Defered;
  public threadId: number;
  constructor(public id: number, public handler: MY_SPECIAL_WORKER_KEY.Worker) {
    this.threadId = handler.threadId;
    this.deferred = null;
    this.ready = false;
  }
}

export function getThreadId(): number {
  return MY_SPECIAL_WORKER_KEY.threadId;
}

function getErrorMessage(err: any): ErrorMsg {
  if (isNil(err)){
    return new ErrorMsg('Unknown error');
  }
  if (err instanceof Error){
    return new ErrorMsg(err.message, err.name, err.stack);
  }
  return new ErrorMsg(err.toString());
}

export class WorkerPool {
  private static readonly _messages: Defered[] = [];
  private static readonly _workers: WorkerData[] = [];
  private static _initialized = false;
  private static _isEnabled = true;

  public static isWorker(): boolean {
    return !MY_SPECIAL_WORKER_KEY.isMainThread;
  }

  public static isEnabled(): boolean {
    return WorkerPool._isEnabled;
  }

  public static workersCount(): number {
    return WorkerPool.isWorker() ? -1 : WorkerPool._workers.length;
  }

  public static pendingMessages(): number {
    return WorkerPool.isWorker() ? -1 : WorkerPool._messages.length;
  }

  public static initialize(workers?: number): void {
    if (WorkerPool._initialized) return;
    WorkerPool._initialized = true;

    if (!WorkerPool.isWorker()) {
      workers = isNil(workers) ? os.cpus().length - 1 : workers;
      // We can't have 0 workers or can we?
      if (workers <= 0) {
        WorkerPool._isEnabled = false;
        return;
      }

      for (let idx = 0; idx < workers; ++idx) {
        WorkerPool._workers.push(new WorkerData(idx, new MY_SPECIAL_WORKER_KEY.Worker(__filename)));
      }

      // Attach handlers
      for (const worker of WorkerPool._workers) {
        worker.handler.on('online', () => {
          worker.ready = true;
          // We should check to see what is loaded and what not in this thread for now brute force
          const cl = GetWorkerContexts();
          for (const cw of cl) {
            WorkerPool.sendToWorker(new LoadScript(cw.tags[WorkerScheduledFileNameTagKey]), worker);
          }
          // Schedule the rest of the work
          WorkerPool._scheduleWork();
        });
        worker.handler.on('error', err => {
          WorkerPool._onWorkerMessage(worker, new ErrorMsg(err.message));
        });
        worker.handler.on('message', value => WorkerPool._onWorkerMessage(worker, value));
      }
    } else {
      // Set the shared array
      MY_SPECIAL_WORKER_KEY.parentPort.on('message', val => WorkerPool._onParentMessage(val));
    }
  }

  public static sendToParent(msg: any): void {
    MY_SPECIAL_WORKER_KEY.parentPort.postMessage(Serializer.serialize(msg));
  }

  public static sendToWorker(msg: any, pinnedWorker?: WorkerData): Promise<any> {
    // Serialize the payload
    const serialized = Serializer.serialize(msg);
    // Return a promise and notify any available worker to pickup the task
    return new Promise((resolve, reject) => {
      WorkerPool._messages.push(new Defered(resolve, reject, serialized, pinnedWorker));
      WorkerPool._scheduleWork();
    });
  }

  private static _onParentMessage(val: any): void {
    // ///////////////////
    // ///// WORKER //////
    // ///////////////////
    // We need to handle message from the main thread. Do what?
    const des = Serializer.deserialize(val);
    if (des instanceof LoadScript) {
      require(des.fileName);
      WorkerPool.sendToParent(new DoneMsg());
    } else if (des instanceof ExecuteMsg) {
      // First we need to check the worker classes
      const cd = GetWorkerContexts().find((cd: ClassData) => cd.name === des.target);
      if (isNil(cd)) {
        WorkerPool.sendToParent(getErrorMessage(`Cannot find execution target ${des.target}`));
        return;
      }
      try {
        const instance = Reflect.construct(cd.target, []);
        const method: Function = instance[des.method];
        if (isNil(method)) {
          WorkerPool.sendToParent(getErrorMessage(`Cannot find method on target ${des.target}.${des.method}`));
          return;
        }
        const result = method.apply(instance, des.args || []);
        if (result instanceof Promise) {
          result
            .then(val => {
              WorkerPool.sendToParent(new DoneMsg(val));
            })
            .catch(err => {
              WorkerPool.sendToParent(getErrorMessage(err));
            });
        } else {
          WorkerPool.sendToParent(getErrorMessage(result));
        }
      } catch (err) {
        WorkerPool.sendToParent(getErrorMessage(err));
        return;
      }
    }
  }

  private static _onWorkerMessage(wkd: WorkerData, msg: any): void {
    // ///////////////////
    // ///// PARENT //////
    // ///////////////////
    // Handle messages from the workers
    if (!wkd.deferred) {
      return;
    }
    const des = Serializer.deserialize(msg);
    if (des instanceof DoneMsg) {
      wkd.deferred.resolve(des);
    } else if (des instanceof ErrorMsg) {
      const err = new Error(des.msg);
      err.name = des.name || err.name;
      err.stack = des.stack || err.stack;
      wkd.deferred.reject(err);
    } else {
      wkd.deferred.resolve();
    }
    wkd.deferred = null;
    WorkerPool._scheduleWork();
  }

  private static _scheduleWork(): boolean {
    // We have no message :| soooo let's watch the paint dry and wait for a message to call us again
    if (WorkerPool._messages.length === 0) {
      return false;
    }

    // Go through all workers and check if we find one that has nothing to do
    const workers = WorkerPool._workers.filter((w: WorkerData) => !w.deferred && w.ready);
    // We have no workers available :| wait for a worker finish to call us
    if (workers.length === 0) {
      return false;
    }

    // We have all the free workers, dispatch work to those workers
    for (const worker of workers) {
      // First search for a pinned message
      let deferred = WorkerPool._messages.find(dfd => dfd.pinnedWorker === worker);
      if (isNil(deferred)) {
        // We don't have a pinned message, use standard QUEUE functionality to get a message that is not pinned to any worker
        //  This can be optimized by having different queues one for the worker and one for everyone
        //  not bothered to do that for now
        deferred = WorkerPool._messages.find(dfd => isNil(dfd.pinnedWorker));
      }
      if (isNil(deferred)) {
        // We did not find a message to process
        // Nothing to schedule on this worker
        continue;
      }
      // We have a pinned or a message for anyone, remove it from the list so we can process it
      remove(WorkerPool._messages, deferred);
      worker.deferred = deferred;
      worker.handler.postMessage(deferred.message);
    }
  }

  private static _sendDirectly(
    worker: WorkerData,
    msg: any,
    transferList?: Array<ArrayBuffer | MY_SPECIAL_WORKER_KEY.MessagePort>
  ): Promise<any> {
    const promise = new Promise((resolve, reject) => {
      worker.deferred = new Defered(resolve, reject, Serializer.serialize(msg), worker);
    });
    worker.handler.postMessage(worker.deferred.message, transferList);
    return promise;
  }
}

if (WorkerPool.isWorker()) {
  // If we are in a worker initialize the pool (basically setup communication with the parent)
  //    else let the main thread initialize the number of workers
  WorkerPool.initialize();
}
