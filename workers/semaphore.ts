import * as WP from '../src/pool';

function wait(timeout: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, timeout);
  });
}

export const MY_SUPER_DUPER_SEMAPHORE_KEY = 1;
@WP.ThreadLoad()
export class SemaphoreTest {
  public async waitOnSemaphore(): Promise<number> {
    const sem = WP.BinarySemaphore.createOrGet(MY_SUPER_DUPER_SEMAPHORE_KEY);
    console.log(`Semaphore ${WP.Threading.threadId} - TRY AND GET THE LOCK `);
    sem.take(); // Try and get the lock
    {
      console.log(`Semaphore ${WP.Threading.threadId} - WE GOT THE SEMAPHORE RELEASE IN 1 second  `);
      await wait(1000);
    }
    sem.give();
    console.log(`Semaphore ${WP.Threading.threadId} - RELEASE `);
    return Promise.resolve(WP.Threading.threadId);
  }
}
