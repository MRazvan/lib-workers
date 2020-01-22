import { Message } from '../attributes/message';

@Message()
export class DoneMsg {
  constructor(public payload?: any) {}
}
