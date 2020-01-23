/* eslint-disable @typescript-eslint/no-use-before-define */
// Disable the rule, place the most important part first on top of the file
import * as WP from './src/pool';

// Declare our class and mark it for WorkerThread processing
@WP.WorkerContext()
export class BarrierTest {
  public async waitOnBarrier(m: WP.Barrier): Promise<number> {
    console.log(`${WP.getThreadId()} - WAIT FOR BARRIER `);
    m.wait();
    console.log(`${WP.getThreadId()} - BARRIER LIFTED `);
    return Promise.resolve(WP.getThreadId());
  }
}
