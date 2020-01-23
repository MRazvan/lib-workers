/* eslint-disable @typescript-eslint/no-use-before-define */
// Disable the rule, place the most important part first on top of the file
import * as WP from './src/pool';

// Declare our class and mark it for WorkerThread processing
@WP.WorkerContext()
export class MutexTest {
  public async waitOnMutex(m: WP.Mutex): Promise<number> {
    // Some long running stuff
    console.log(`${WP.getThreadId()} - TRY AND GET THE LOCK `);
    m.lock();
    console.log(`${WP.getThreadId()} - WE GOT THE LOCK RELEASE IN 1 second  `);
    await WP.wait(1000);
    console.log(`${WP.getThreadId()} - RELEASE `);
    m.unlock();

    return Promise.resolve(WP.getThreadId());
  }
}
