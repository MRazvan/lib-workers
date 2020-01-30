import { ClassData } from 'lib-reflect';
import { isEmpty, isNil, uniq } from 'lodash';
import { isString } from 'util';
import * as MY_SPECIAL_WORKER_KEY from 'worker_threads';
import { GetThreadLoadClasses, ThreadLoadBagKey } from '../../attributes/thread.load';
import { IInitializer, IMessageHandler, Message } from '../../handlers/handler';
import { getLog, Logger } from '../../logging';
import { ErrorMessage } from '../messages/error';
import { OnlineMessage } from '../messages/online';
import { Packet, VOID_PACKET_ID } from '../packet';
import { THREAD_ANY } from './constants';
import { IThreading, ThreadData } from './i.implementation';
import { ThreadingMain } from './thread.main';
import { ThreadingWorker } from './thread.worker';

export enum ThreadingEnvType {
  MAIN,
  WORKER
}

export abstract class Threading {
  protected static _packetIdSharedBuffer: Uint32Array = null;

  protected static _messageInterceptors: IMessageHandler[] = [];
  protected static _threadInitializers: IInitializer[] = [];
  protected static _initialized = false;
  protected static _context: any;
  protected static _log: Logger = getLog('');
  protected static _implementation: IThreading = null;

  public static get workers(): ThreadData[] {
    return Threading._implementation.workers;
  }

  public static get context(): any {
    return Threading._context;
  }

  public static get initialized(): boolean {
    return Threading._initialized;
  }

  public static get type(): ThreadingEnvType {
    return MY_SPECIAL_WORKER_KEY.isMainThread ? ThreadingEnvType.MAIN : ThreadingEnvType.WORKER;
  }

  public static get log(): Logger {
    return Threading._log;
  }

  public static get threadId(): number {
    return MY_SPECIAL_WORKER_KEY.threadId;
  }

  public static getNextPacketId(): number {
    const msgId = Atomics.add(Threading._packetIdSharedBuffer, 0, 1);
    if (msgId === VOID_PACKET_ID) {
      // We wrapped around a UINT32 we have been busy
      return Atomics.add(Threading._packetIdSharedBuffer, 0, 1);
    }
    return msgId;
  }

  public static initialize(workers?: number): void {
    if (Threading._initialized) {
      return;
    }

    Threading._initialized = true;
    // Go through the message handlers and call init on them
    // We need to go about this in a particular way
    //  In main we can safely register initializers, handlers before calling init
    //  In a worker, the first thing that loads is this file, after that if we keep
    //   the same order as in the main, initialize will be called even though we did not
    //   register any initializers, so we need to switch the order
    //   the init method will be called first, that will load the worker script (this file)
    //   and and initializer / handler files the main has sent them for registration
    if (Threading.type === ThreadingEnvType.MAIN) {
      Threading._implementation = new ThreadingMain(Threading._runMessageInterceptors);
      Threading._log(`Initializing main thread.`);

      // Just enough for message id
      Threading._packetIdSharedBuffer = new Uint32Array(new SharedArrayBuffer(4));
      Threading._packetIdSharedBuffer[0] = 1;

      Threading._context = {
        threading: {
          shared: Threading._packetIdSharedBuffer,
          workerMain: __filename,
          requireFiles: Threading._getThreadLoadFiles()
        }
      };

      Threading._threadInitializers.forEach((handler: IInitializer) => handler.initialize(Threading._context));
      // Finally add the initializers and the handlers
      Threading._implementation.init(workers, Threading._context);
    } else {
      Threading._implementation = new ThreadingWorker(Threading._runMessageInterceptors);
      // In the worker environment we need to go the other way around,
      // First initialize the worker
      //  Then run initializers since the 'init' will load all 'initializers'
      Threading._log(`Initializing child thread ${Threading.threadId}`);

      // Set the context and initialize the rest of the messages
      Threading._context = MY_SPECIAL_WORKER_KEY.workerData;
      Threading._packetIdSharedBuffer = Threading._context.threading.shared;
      Threading._implementation.init(workers, Threading._context.threading);
      Threading._threadInitializers.forEach((handler: IInitializer) => handler.initialize(Threading._context));
      // Notify the parent that we finished loading
      Threading.send(new OnlineMessage()).catch((err: any) => {
        Threading._log('Error in sending OnlineMessage.', err);
      });
    }
  }

  public static send(msg: Packet, to: number = THREAD_ANY): Promise<any> {
    if (!(msg instanceof Packet)) {
      throw new Error('Cannot send anything else, except Packet(s).');
    }
    return Threading._implementation.sendAsync(msg, to);
  }

  public static registerHandler(handler: IMessageHandler): void {
    // Check to see if we already have this handler registered
    const exists = Threading._messageInterceptors.find(
      (existing: IMessageHandler) => existing.constructor === handler.constructor
    );
    if (!exists) {
      Threading._messageInterceptors.push(handler);
    }
  }

  public static registerInitializer(handler: IInitializer): void {
    // Check to see if we already have this initializer registered
    const exists = Threading._threadInitializers.find(
      (existing: IInitializer) => existing.constructor === handler.constructor
    );
    if (!exists) {
      Threading._threadInitializers.push(handler);
    }
  }

  protected static _runMessageInterceptors(message: Message): void {
    for (const handler of Threading._messageInterceptors) {
      handler.handle(message);
    }

    Threading._finalMessageHandler(message);
  }

  protected static _getThreadLoadFiles(): string[] {
    return uniq(
      GetThreadLoadClasses()
        .map((cd: ClassData) => cd.tags[ThreadLoadBagKey])
        .filter((fileName: string) => !isEmpty(fileName) && isString(fileName))
    );
  }

  protected static _finalMessageHandler(message: Message): void {
    // TODO: Improve to handle errors, and exits
    // Finally if not one handler took care of the message we do it
    if (isNil(message.deferred)) {
      if (message.packet instanceof ErrorMessage) {
        // TODO: Recreate an error and throw?
        Threading._log('Error ', message.packet);
      }
      return;
    }

    if (message.deferred.resolved) {
      return;
    }

    if (message.packet instanceof ErrorMessage) {
      message.deferred.reject(message.packet);
    } else {
      message.deferred.resolve(message.packet);
    }
  }
}

if (Threading.type === ThreadingEnvType.WORKER) {
  Threading.initialize();
}
