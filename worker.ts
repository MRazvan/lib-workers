import * as WP from './src/pool';

@WP.ThreadLoad()
export class Test {
  public resu(): Promise<string> {
    return Promise.resolve('Hello World ' + WP.Threading.threadId);
  }
}
