import { Message } from "../attributes/message";

@Message()
export class SharedArray {
   constructor(public _arr: Uint8Array){}
}