import Hapi from "@hapi/hapi"
import Nes from "@hapi/nes"

const signalServer = Hapi.server({
  port: 8081,
  host: "localhost",
})

const startSignalServer = async () => {
  await signalServer.register(Nes)

  signalServer.route({
    method: "GET",
    path: "/h",
    config: {
      id: "hello",
      handler: (request, h) => {
        return "world!"
      },
    },
  })
  await signalServer.start()
  console.log(`signalServer running at: ${signalServer.info.uri}`)
  return signalServer
}

process.on("unhandledRejection", (err) => {
  console.error(err)
  process.exit(1)
})

export { startSignalServer }
