import { Message } from '../attributes/message';

@Message()
export class ExecuteMsg {
  constructor(public target: string, public method: string, public args: any[]) {}
}
