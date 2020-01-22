import { Serialize } from '../attributes/serializer';

@Serialize()
export class DoneMsg {
  constructor(public payload?: any) {}
}
