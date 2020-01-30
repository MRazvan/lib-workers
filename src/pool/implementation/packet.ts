import { Serialize } from '../attributes/serializer';

export const VOID_PACKET_ID = 0;

@Serialize()
export class Packet {
  constructor(public id: number = VOID_PACKET_ID) {}
}
