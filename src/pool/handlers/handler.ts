import { Deferred } from '../implementation/deferred';
import { Packet } from '../implementation/packet';

export class Message {
  constructor(public source: number, public deferred: Deferred, public packet: Packet) {}
}

export interface IInitializer {
  initialize(workerData: any): void;
}

export interface IMessageHandler {
  handle(message: Message): void;
}
