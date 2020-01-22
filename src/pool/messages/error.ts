import { Message } from '../attributes/message';

@Message()
export class ErrorMsg {
  constructor(public msg: string, public name?: string, public stack?: string) {}
}
