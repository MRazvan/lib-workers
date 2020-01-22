import { Message } from '../attributes/message';

@Message()
export class LoadScript {
  constructor(public fileName: string) {}
}
