import { EventEmitter } from 'events';
import { isFunction } from 'lodash';
import * as MY_SPECIAL_WORKER_KEY from 'worker_threads';
import { getLog, Logger } from '../logging';
import { Serializer } from '../serialization';
import { ErrorMessage } from './messages/error';
import { ExitMessage } from './messages/exit';
import { ReadyMessage } from './messages/ready';
import { GetPacketDescription } from './messages/utils';
import { Packet } from './packet';

export type IMessagePost = {
  postMessage: (msg: any, transferList?: Array<ArrayBuffer | MY_SPECIAL_WORKER_KEY.MessagePort>) => void;
};
export type NativeChannel = EventEmitter & IMessagePost;
export type PacketHandler = (source: CommunicationChannel, msg: Packet) => void;

export class CommunicationChannel {
  private readonly _handlers: PacketHandler[] = [];
  private readonly _log: Logger;
  constructor(private readonly _handler: NativeChannel, id = `${MY_SPECIAL_WORKER_KEY.threadId}`) {
    this._log = getLog(`[ComChannel-${id}]`);
    this._handler.on('error', error => {
      this._invoke(new ErrorMessage(error));
    });

    this._handler.on('exit', () => {
      this._invoke(new ExitMessage());
      this._handler.removeAllListeners();
    });

    this._handler.on('online', () => {
      this._invoke(new ReadyMessage());
    });

    this._handler.on('message', (msg: any) => {
      this._invoke(msg);
    });
  }

  public listen(handler: PacketHandler): void {
    if (!isFunction(handler) || handler.length !== 2) {
      throw new Error('Stop doing weird stuff. Can only register PacketHandler(s).');
    }
    this._handlers.push(handler);
  }

  private _invoke(msg: any): void {
    if (!(msg instanceof Packet)) {
      // Try and deserialize maybe we manage to do that
      msg = Serializer.deserialize(msg);
      if (!(msg instanceof Packet)) {
        this._log(`Got Unknown Message ${JSON.stringify(msg)}`);
        // There is nothing we can do about this packet. We don't know what it is about
        //    this should be an error, since we most likely have a promise pending somewhere
        //    that will never get resolved
        this.send(new ErrorMessage('Message received is not an instance of a Packet.'));
      }
    }
    this._log(`Got Message ${GetPacketDescription(msg)}`);

    for (const handler of this._handlers) {
      try {
        handler(this, msg);
      } catch (err) {
        // The one that was supposed to handle this failed,
        // where will we end up if we can't rely on anyhing, the handlers SHOULD not fail
        // find the one responsible and ... stuff :(
        // The Good thing is we caught this.
        // The Bad thing is there is nothing we can do to recover from this
        //    The packet might be a normal one and someone might be waiting for a result
        //       Do we send an error back? It might not even be the handler that takes care of the packet
        //    If we remove the handler someone might be stuck waiting for a reply
        //    If we 'handle' an error, the same / other handler might fail
        // -------------------------------------------------------
        // Simple choice, screw this and throw an error
        // -------------------------------------------------------
        // TODO: Keep in mind this code is running in main and in workers
        // If we are a worker it is safe to throw (the other side of the channel will catch the error)
        // If we are the main thread this should close everything down.
        this.send(new ErrorMessage(err, msg.id));
      }
    }
  }

  public send(msg: Packet): void {
    this._log(`Send Message ${GetPacketDescription(msg)}`);
    this._handler.postMessage(Serializer.serialize(msg));
  }
}
