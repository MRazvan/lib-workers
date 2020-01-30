import { find, isNil, isNumber, remove } from 'lodash';
import * as os from 'os';
import * as MY_SPECIAL_WORKER_KEY from 'worker_threads';
import { Message } from '../../handlers/handler';
import { getLog, Logger } from '../../logging';
import { CommunicationChannel } from '../communication';
import { Deferred } from '../deferred';
import { ExitMessage } from '../messages/exit';
import { OnlineMessage } from '../messages/online';
import { GetPacketDescription } from '../messages/utils';
import { Packet } from '../packet';
import { THREAD_ALL, THREAD_ANY } from './constants';
import { ThreadGroup } from './groups';
import { IThreading, ThreadData } from './i.implementation';

class WorkerData extends ThreadData {
  public comChannel: CommunicationChannel;
  public ready = false;
  public free = true;
  public threadId = 0;
  public group: ThreadGroup;
  constructor(public worker: MY_SPECIAL_WORKER_KEY.Worker) {
    super();
    this.comChannel = new CommunicationChannel(worker, worker.threadId);
    this.threadId = worker.threadId;
  }
}

export class ThreadingMain implements IThreading {
  private readonly _workers: WorkerData[] = [];
  private readonly _deferredAllQueue: Deferred[] = [];
  private readonly _deferredInWork: Map<number, Deferred[]> = new Map();
  private readonly _deferredPinnedQueue: Map<number, Deferred[]> = new Map();
  private readonly _log: Logger = getLog('');

  constructor(private readonly _runMessageHandlers: (message: Message) => void) {
    this._listen = this._listen.bind(this);
  }

  public get workers(): ThreadData[] {
    return this._workers;
  }

  public init(workers: number, workerData: any): void {
    const availableCpus = os.cpus().length - 1;
    workers = isNil(workers) ? (availableCpus > 0 ? availableCpus : 1) : workers;
    // We can't have 0 workers or can we?
    if (workers <= 0) {
      this._log(`WorkerPool not started. The number of workers is invalid: ${workers}`);
      throw new Error(`Invalid number of workers ${workers}`);
    }
    this._log(`USING Worker file '${workerData.threading.workerMain}'`);

    // We are using the streams from main for out / error in the workers
    // Set the default number of listeners back to the expected 10 before warnings happen
    process.stdout.setMaxListeners(workers + 10);
    // Set the default number of listeners back to the expected 10 before warnings happen
    process.stderr.setMaxListeners(workers + 10);
    // Create the workers
    for (let idx = 0; idx < workers; ++idx) {
      const worker = new WorkerData(new MY_SPECIAL_WORKER_KEY.Worker(workerData.threading.workerMain, { workerData }));
      worker.comChannel.listen((source: CommunicationChannel, packet: Packet) => this._listen(worker, packet));
      // Init the queues for the worker
      this._deferredInWork.set(worker.threadId, []);
      this._deferredPinnedQueue.set(worker.threadId, []);
      this._workers.push(worker);
    }
  }

  public sendAsync(msg: Packet, to: number): Promise<any> {
    const promise = new Promise((resolve, reject) => {
      const deferred = new Deferred(resolve, reject, msg);

      // Send to any thread that can take the message?
      if (!isNumber(to) || to === THREAD_ANY) {
        this._log(`Queue message for any, ${GetPacketDescription(deferred.packet)}`);
        this._deferredAllQueue.push(deferred);
        return;
      }

      // Send to all
      if (to === THREAD_ALL) {
        this._log(`Queue message for all, ${GetPacketDescription(deferred.packet)}`);
        this._workers.forEach((worker: WorkerData) => {
          this._deferredPinnedQueue.get(worker.threadId).push(deferred);
        });
        return;
      }

      // Specific target
      if (!this._isValidThreadId(to)) {
        reject(new Error(`Invalid thread id for pinned message: W-${to}. ${GetPacketDescription(deferred.packet)}`));
        return;
      }
      this._log(`Queue message for W-${to}. ${GetPacketDescription(deferred.packet)}`);
      this._deferredPinnedQueue.get(to).push(deferred);
    });
    this._scheduleWork();
    return promise;
  }

  private _listen(worker: WorkerData, msg: Packet): void {
    if (msg instanceof OnlineMessage) {
      worker.ready = true;
    } else if (msg instanceof ExitMessage) {
      this._log(`Got ExitMessage from worker W-${worker.threadId}. Removing from available workers.`);
      this._removeWorker(worker);
      // Remove this worker from the list of available workers
    }

    const _work = this._deferredInWork.get(worker.threadId);
    // Find the deferred responsible
    const def = find(_work, (d: Deferred) => d.packet.id === msg.id);
    if (!isNil(def)) {
      remove(_work, def);
    }
    worker.free = _work.length === 0;
    this._log(
      `Handle message from worker W-${worker.threadId}. Packet ${GetPacketDescription(msg)}. Deferred ${
        def ? 'Source - ' + GetPacketDescription(def.packet) : 'none'
      }`
    );
    const handleMessage = new Message(worker.threadId, def, msg);
    this._runMessageHandlers(handleMessage);
    // Schedule more work if needed
    this._scheduleWork();
  }

  private _scheduleWork(): void {
    // Go through all workers and check if we find one that has nothing to do
    const workers = this._workers.filter((w: WorkerData) => w.free && w.ready);
    // We have no workers available :| wait for a worker to finish and call us again
    if (workers.length === 0) {
      this._log('No available worker to schedule');
      return;
    }

    // We have all the free workers, dispatch work to those workers
    for (const worker of workers) {
      let deferred = this._deferredPinnedQueue.get(worker.threadId).shift();
      if (!isNil(deferred)) {
        this._log(`Found pinned message for worker ${worker.threadId}.`);
      }
      if (this._deferredAllQueue.length > 0) {
        deferred = this._deferredAllQueue.shift();
      }

      if (isNil(deferred)) {
        // We did not find a message to process
        // Nothing to schedule on this worker
        continue;
      }

      this._log(`Scheduled work on worker W-${worker.threadId}. ${GetPacketDescription(deferred.packet)}`);
      worker.free = false;
      this._deferredInWork.get(worker.threadId).push(deferred);
      worker.comChannel.send(deferred.packet);
    }
  }

  private _isValidThreadId(id: number): boolean {
    return this._workers.some((workerData: WorkerData) => workerData.threadId === id);
  }

  private _removeWorker(worker: WorkerData): void {
    // Find the worker from the list and cleanup the defered list
    remove(this._workers, worker);

    // We can't do anything with the pinned messages, we need to just reject them
    //  there is no way to recover from a closed workthread
    const pinnedQueue = this._deferredPinnedQueue.get(worker.threadId);
    this._deferredPinnedQueue.delete(worker.threadId);
    pinnedQueue.forEach((deferred: Deferred) => deferred.reject('ClosedWorker'));

    // Same thing for the in work queue
    const inWorkItems = this._deferredInWork.get(worker.threadId);
    this._deferredInWork.delete(worker.threadId);
    inWorkItems.forEach((deferred: Deferred) => deferred.reject('ClosedWorker'));
  }
}
