import { Serialize } from '../attributes/serializer';

@Serialize()
export class LoadScript {
  constructor(public fileName: string) {}
}
