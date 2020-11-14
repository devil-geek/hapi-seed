export const helloHandler = (req, res) => {
  const hw = 'hello world es6'
  const { mediaServer } = req.server.app
  console.log(mediaServer.GetNumWorkers())
  return hw
}
