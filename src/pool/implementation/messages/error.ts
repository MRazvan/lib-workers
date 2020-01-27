import { isNil } from 'lodash';
import { Serialize } from '../../attributes/serializer';
import { Packet, VOID_PACKET_ID } from '../packet';

@Serialize()
export class ErrorMessage extends Packet {
  constructor(public error: any, id: number = VOID_PACKET_ID) {
    super(id);
  }
}

export function getErrorMessage(err: any, id = VOID_PACKET_ID): ErrorMessage {
  if (isNil(err)) {
    return new ErrorMessage('Unknown error', id);
  }
  if (err instanceof Error) {
    return new ErrorMessage({ message: err.message, name: err.name, stack: err.stack }, id);
  }
  return new ErrorMessage(err.toString(), id);
}
