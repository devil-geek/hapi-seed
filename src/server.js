import Hapi from '@hapi/hapi'
import routes from './routes/routes'

const server = Hapi.server({
  port: 8080,
  host: 'localhost',
})

server.route(routes)

const init = async () => {
  await server.initialize()
  return server
}

const start = async () => {
  await server.start()
  console.log(`Server running at: ${server.info.uri}`)
  return server
}

process.on('unhandledRejection', (err) => {
  console.error(err)
  process.exit(1)
})

export { init, start }
