import * as WP from '../src/pool';

function wait(timeout: number): Promise<never> {
  return new Promise(resolve => {
    setTimeout(resolve, timeout);
  });
}

export const MY_SUPER_DUPER_MUTEX_KEY = 1;
@WP.ThreadLoad()
export class MutexTest {
  public async waitOnMutex(): Promise<number> {
    console.log(`Mutex ${WP.Threading.threadId} - TRY AND GET THE LOCK `);

    const mutex = WP.Mutex.createOrGet(MY_SUPER_DUPER_MUTEX_KEY);
    mutex.lock(); // Try and get the lock
    {
      // CRITICAL SECTION :) In a 'single threaded' v8 execution context, with no way to easily share data :D
      //  Just for fun we can still dream about them
      console.log(`Mutex ${WP.Threading.threadId} - WE GOT THE LOCK RELEASE IN 1 second  `);
      await wait(1000);
      console.log(`Mutex ${WP.Threading.threadId} - RELEASE `);
    }
    mutex.unlock();
    return Promise.resolve(WP.Threading.threadId);
  }
}
