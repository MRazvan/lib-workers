import { Packet } from '../packet';

export function GetPacketDescription(packet: Packet): string {
  return `'${packet.constructor.name}' (Id: ${packet.id})`;
}
