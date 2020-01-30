# Express Integration

Example showing how to integrate in [express](https://expressjs.com/) in plain javascript.

- [Express Integration](#express-integration)
  - [Work Handler](#work-handler)
  - [Main](#main)
  - [Run](#run)

## Work Handler
```javascript
// worker.js
const WP = require('lib-workers');

class Worker {
  doWork(){
    return new Promise((resolve) => setTimeout(resolve, 1000))
    .then(() => {
      return 'Work Done.';
    });
  }
}

// Decorate our class
WP.ThreadLoad()(Worker);

module.exports = Worker
```

## Main

```javascript
// index.js
const app = require('express')();
const WP = require('lib-workers');
const Worker = require('./worker');

WP.Threading.initialize();

app.use('/doWork', (req, res) => {
  const workHandler = WP.Create(Worker);
  workHandler
    .doWork()
    .then((result) => res.send(result).end());
});

app.listen(3020, () => console.log('Started'));
```

## Run
```
node --experimental-worker index.js
```