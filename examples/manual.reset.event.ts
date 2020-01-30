import * as WP from '../src/pool';
export const MY_SUPER_DUPER_EVENT_KEY = 1;

@WP.ThreadLoad()
export class EventTest {
  public async waitOnEvent(): Promise<number> {
    console.log(`Manual Event ${WP.Threading.threadId} - TRY AND GET THE LOCK `);
    const event = WP.ManualResetEvent.createOrGet(MY_SUPER_DUPER_EVENT_KEY);

    event.waitOne(); // Wait for the barrier to release

    console.log(`Manual Event ${WP.Threading.threadId} - WE ARE ALOWED TO CONTINUE  `);
    return Promise.resolve(WP.Threading.threadId);
  }
}
