import { helloHandler } from "../handlers/hello.handler"

const routes = {
  method: "GET",
  path: "/",
  handler: helloHandler,
}

export default routes
