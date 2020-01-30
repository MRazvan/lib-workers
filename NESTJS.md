# nestjs integration example

The integration in nestjs is as simple as possible, in your service / controller delegate the work to the worker threads.

- [nestjs integration example](#nestjs-integration-example)
  - [Worker](#worker)
  - [Controller](#controller)
  - [Main](#main)

## Worker
```typescript
@WP.ThreadLoad()
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

## Main
```typescript
async function bootstrap() {
  WP.Threading.initialize();
  const app = await NestFactory.create(AppModule);
  await app.listen(3000);
}
bootstrap();
```
