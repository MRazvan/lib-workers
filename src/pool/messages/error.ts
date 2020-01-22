import { Serialize } from '../attributes/serializer';

@Serialize()
export class ErrorMsg {
  constructor(public msg: string, public name?: string, public stack?: string) {}
}
