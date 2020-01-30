# nestjs integration example

The integration in nestjs is as simple as possible, in your service / controller delegate the work to the worker threads.

- [nestjs integration example](#nestjs-integration-example)
  - [Worker](#worker)
  - [Controller](#controller)
  - [Main](#main)

## Worker
```typescript
@WP.ThreadLoad()
@Injectable()
export class Work {
   public doWork(timeout:number): Promise<string> {
      return new Promise((resolve) => setTimeout(resolve, timeout)).then(() => 'Done Work.');
   }
}
```

## Controller
```typescript
@Controller()
export class AppController {
  @Get()
  getHello(@Query('t') timeout = 1000): Promise<string> {
    const work = WP.Create<Work>(Work);
    return work.doWork(+timeout);
  }
}
```
Second option is to register the Work as a service and inject that into the controller.
 For this option to work, we need to be carefull on how we register the provider. We can't create / proxify the class directly in the 'providers' property. We need to delay the creation until the Pool has started.

```typescript
@Module({
  imports: [],
  controllers: [AppController],
  providers: [{
    provide: Work,
    useFactory: () => WP.Create(Work)
  }]
})
export class AppModule {}
```
Use the service
```typescript
@Controller()
export class AppController {
  constructor(private readonly work: Work){}
  @Get()
  getHello(@Query('t') timeout = 1000): Promise<string> {
    // Queue work on the worker threads.
    return this.work.doWork(+timeout);
  }
}
```
## Main
```typescript
async function bootstrap() {
  WP.Threading.initialize();
  const app = await NestFactory.create(AppModule);
  await app.listen(3000);
}
bootstrap();
```
