import { init } from "../src/server"

describe("GET /", () => {
  let server

  beforeEach(async () => {
    server = await init()
  })

  afterEach(async () => {
    await server.stop()
  })

  it("responds with 200", async () => {
    const res = await server.inject({
      method: "get",
      url: "/",
    })
    expect(res.statusCode).toEqual(200)
  })
})
