import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { Bindings } from './bindings.js'


export type honoContext = { Bindings: Bindings, Variables: {} }

const app = new Hono<honoContext>()

// // Middleware to log all requests
// app.use('*', async (c, next) => {
//   const requestLoggerMiddleware = createRequestLoggerMiddleware(c.env.LOGGER_STORAGE);
//   return requestLoggerMiddleware(c, next);
// });


// Middleware to inject providers
app.use('*', async (c, next) => {
  await next();
});

app.onError((err, c) => {
  console.error('Error:', err)
  return c.json({ status: 'received' }, 200)
})

// Health check
app.get('/', (c) => {
  return c.text('Hello from the STICKIT AVATAR CREATOR App from Stickit')
})





export default app

