import { Serialize } from '../attributes/serializer';
import { Serializer } from '../serialization';

@Serialize({
  serialize: (data: ExecuteMsg): any => {
    return {
      target: data.target,
      method: data.method,
      args: Serializer.serialize(data.args)
    };
  },
  deserialize: (data: any): ExecuteMsg => {
    return new ExecuteMsg(data.target, data.method, Serializer.deserialize(data.args));
  }
})
export class ExecuteMsg {
  constructor(public target: string, public method: string, public args: any[]) {}
}
