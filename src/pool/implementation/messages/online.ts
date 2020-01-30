import { Serialize } from '../../attributes/serializer';
import { Packet } from '../packet';

@Serialize()
export class OnlineMessage extends Packet {}
