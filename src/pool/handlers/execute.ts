import { ClassData } from 'lib-reflect';
/* eslint-disable @typescript-eslint/no-use-before-define */
import { isFunction, isNil } from 'lodash';
import { Serialize } from '../attributes/serializer';
import { GetThreadLoadClasses, ThreadLoad } from '../attributes/thread.load';
import { getErrorMessage } from '../implementation/messages/error';
import { Packet, VOID_PACKET_ID } from '../implementation/packet';
import { Threading } from '../implementation/threading/threading';
import { Serializer } from '../serialization';
import { IMessageHandler, Message } from './handler';

@Serialize({
  serialize: (data: ExecuteMessage): any => {
    return {
      target: data.target,
      method: data.method,
      args: Serializer.serialize(data.args)
    };
  },
  deserialize: (data: any): ExecuteMessage => {
    return new ExecuteMessage(data.target, data.method, Serializer.deserialize(data.args), data.id);
  }
})
export class ExecuteMessage extends Packet {
  constructor(public target: string, public method: string, public args: any[], packetId: number = VOID_PACKET_ID) {
    super(packetId === VOID_PACKET_ID ? Threading.getNextPacketId() : packetId);
  }
}

@Serialize()
export class ExecuteResultMessage extends Packet {
  constructor(public result: any, targetMessageId: number) {
    super(targetMessageId);
  }
}

@ThreadLoad()
export class ExecuteHandler implements IMessageHandler {
  public handle(message: Message): void {
    if (message.packet instanceof ExecuteMessage) {
      // We need to execute the function
      this._execute(message.packet);
    } else if (message.packet instanceof ExecuteResultMessage) {
      message.deferred.resolve(Serializer.deserialize(message.packet.result));
    }
  }

  private _execute(packet: ExecuteMessage): void {
    // First we need to check the worker classes
    const cd = GetThreadLoadClasses().find((cd: ClassData) => cd.name === packet.target);
    if (isNil(cd)) {
      Threading.send(getErrorMessage(`Cannot find execution target ${packet.target}`));
      return;
    }
    try {
      const instance = Reflect.construct(cd.target, []);
      const method: Function = instance[packet.method];
      // Sanity check
      if (!isFunction(method)) {
        Threading.send(getErrorMessage(`Cannot find method on target ${packet.target}.${packet.method}`, packet.id));
        return;
      }
      // Execute the method
      const result = method.apply(instance, packet.args || []);
      // We should always return a promise from a method that is supposed to run in a worker
      //  we can have situations where that is not the case
      if (result instanceof Promise) {
        result
          .then(val => {
            Threading.send(new ExecuteResultMessage(val, packet.id));
          })
          .catch(err => {
            Threading.send(getErrorMessage(err, packet.id));
          });
      } else {
        // Not a promise
        Threading.send(new ExecuteResultMessage(result, packet.id));
      }
    } catch (err) {
      Threading.send(getErrorMessage(err, packet.id));
    }
  }
}

Threading.registerHandler(new ExecuteHandler());
