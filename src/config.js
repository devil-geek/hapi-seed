import { networkInterfaces as _networkInterfaces } from "os"
const networkInterfaces = _networkInterfaces()
const arr = networkInterfaces["en0"]
const localIp = arr[1].address

const config = {
  app: process.env.APP_PATH,
  sslCrt: process.env.SSL_CERT_PATH,
  sslKey: process.env.SSL_KEY_PATH,
  port: Number(process.env.PORT),
  debug: process.env.DEBUG,
  worker: {
    rtcMinPort: Number(process.env.RTC_MIN_PORT),
    rtcMaxPort: Number(process.env.RTC_MAX_PORT),
    logLevel: process.env.LOG_LEVEL,
    logTags: [
      "info",
      "ice",
      "dtls",
      "rtp",
      "srtp",
      "rtcp",
      "rtx",
      "bwe",
      "score",
      "simulcast",
      "svc",
    ],
  },
  router: {
    mediaCodecs: [
      {
        kind: "audio",
        mimeType: "audio/opus",
        clockRate: 48000,
        channels: 2,
      },
      {
        kind: "video",
        mimeType: "video/VP8",
        clockRate: 90000,
        parameters: {
          "x-google-start-bitrate": 1000,
        },
      },
      {
        kind: "video",
        mimeType: "video/VP9",
        clockRate: 90000,
        parameters: {
          "profile-id": 2,
          "x-google-start-bitrate": 1000,
        },
      },
      {
        kind: "video",
        mimeType: "video/h264",
        clockRate: 90000,
        parameters: {
          "packetization-mode": 1,
          "profile-level-id": "4d0032",
          "level-asymmetry-allowed": 1,
          "x-google-start-bitrate": 1000,
        },
      },
      {
        kind: "video",
        mimeType: "video/h264",
        clockRate: 90000,
        parameters: {
          "packetization-mode": 1,
          "profile-level-id": "42e01f",
          "level-asymmetry-allowed": 1,
          "x-google-start-bitrate": 1000,
        },
      },
    ],
  },
  webRtcTransport: {
    listenIps: [
      {
        ip: process.env.LISTEN_IP || localIp,
        announcedIp: process.env.ANNOUNCED_IP || null,
      },
    ],
    initialAvailableOutgoingBitrate: 1000000,
    minimumAvailableOutgoingBitrate: 600000,
  },
  api: "https://qa2x978msi.execute-api.us-east-1.amazonaws.com/latest/meets",
}

export default config
