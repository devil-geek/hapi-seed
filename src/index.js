import { start } from './server'
import { startSignalServer } from './signalServer'
import mediaServer from './MediaServer'

mediaServer.CreateWorkers().then(async () => {
  const server = await start()
  server.app.mediaServer = mediaServer
  startSignalServer()
})
