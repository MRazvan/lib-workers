import { isNil } from 'lodash';
import * as MY_SPECIAL_WORKER_KEY from 'worker_threads';
import { Message } from '../../handlers/handler';
import { getLog, Logger } from '../../logging';
import { CommunicationChannel } from '../communication';
import { Deferred } from '../deferred';
import { GetPacketDescription } from '../messages/utils';
import { Packet } from '../packet';
import { IThreading, ThreadData } from './i.implementation';

export class ThreadingWorker implements IThreading {
  private _comChannel: CommunicationChannel = null;
  private readonly _deferredInWork: Deferred[] = [];
  private readonly _log: Logger = getLog('');

  constructor(private readonly _runMessageHandlers: (message: Message) => void) {
    this._listen = this._listen.bind(this);
  }

  public get workers(): ThreadData[] {
    return [];
  }

  public init(workers: number, workerData: any): void {
    // Load all scripts that the parent want's us to load
    this._loadScripts(workerData);
    // Setup the channel for comunication
    this._comChannel = new CommunicationChannel(MY_SPECIAL_WORKER_KEY.parentPort, `M`);
    this._comChannel.listen(this._listen);
  }

  public send(msg: Packet, to: number): Promise<any> {
    // this._log(`Send message ${msg.id}`);
    // We don't care about 'TO' in the worker, the only place where the message can go
    //  is to the parent
    const promise = new Promise((resolve, reject) => {
      this._deferredInWork.push(new Deferred(resolve, reject, msg));
    });
    this._comChannel.send(msg);
    return promise;
  }

  private _listen(channel: CommunicationChannel, msg: Packet): void {
    const def = this._deferredInWork.find(d => d.packet.id === msg.id);
    const handleMessage = new Message(0, def, msg);
    this._log(
      `Handle message. Packet ${GetPacketDescription(msg)}. Deferred ${
        def ? ': Source - ' + GetPacketDescription(def.packet) : 'none'
      }`
    );
    this._runMessageHandlers(handleMessage);
  }

  private _loadScripts(workerData: { requireFiles: string[] }): void {
    if (isNil(workerData)) {
      // Nothing to load...
      return;
    }
    const scripts: string[] = workerData.requireFiles || [];
    this._log(`Load scripts : [${scripts.join(', ')}]`);
    // Load the scripts
    scripts.forEach((file: string) => require(file));
  }
}
