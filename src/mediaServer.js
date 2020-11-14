/* eslint-disable class-methods-use-this */
import * as mediasoup from 'mediasoup'
//import os from "os"
import DotEnv from 'dotenv'
//import pidusage from "pidusage"
import config from './config'

DotEnv.config()

class MediaServer {
  constructor() {
    this.workers = []
    this.actualWorker = 0
    this.rooms = {}
    this.numWorkers = 1 // Object.keys(os.cpus()).length;
  }

  GetNumWorkers() {
    return this.workers.length
  }
  async CreateWorkers() {
    let workers = []

    for (let i = 0; i < this.numWorkers; i += 1) {
      workers[i] = mediasoup.createWorker({
        logLevel: config.worker.logLevel,
        logTags: config.worker.logTags,
        rtcMinPort: Number(config.worker.rtcMinPort),
        rtcMaxPort: Number(config.worker.rtcMaxPort),
      })
    }

    workers = await Promise.all(workers)

    workers = workers.map((worker) => {
      worker.on('died', () => {
        console.error(
          'Worker died, exiting in 2 seconds... [pid:%d]',
          worker.pid
        )
        setTimeout(() => process.exit(1), 2000)
      })
      worker.observer.on('close', () => {
        console.log('Worker close')
      })
      worker.observer.on('newrouter', (router) => {
        console.log('new router created [id:%s]', router.id)
      })
      worker.on('error', (e) => {
        console.error(`ERROR WORKER ${e}`)
        process.exit(1)
      })
      return worker
    })
    console.log('Workers created')

    this.workers = workers
  }

  GetActualWorker() {
    const worker = this.workers[this.actualWorker]
    this.actualWorker += 1

    if (this.actualWorker === this.workers.length) {
      this.actualWorker = 0
    }

    return worker
  }

  async CreateRoom(id, owner, subject, password) {
    const { mediaCodecs } = config.router
    const worker = this.GetActualWorker()
    const peers = {}
    const activeSpeaker = { producerId: null, volume: null, peerId: null }
    const router = await worker.createRouter({ mediaCodecs })

    router.observer.on('close', () => {
      console.log('router closed [id:%s]', router.id)
    })

    router.observer.on('newtransport', (transport) => {
      console.log('new transport created [id:%s]', transport.id)
    })

    const audioLevelObserver = await router.createAudioLevelObserver({
      interval: 800,
      threshold: -60,
    })

    audioLevelObserver.on('volumes', (volumes) => {
      const { producer, volume } = volumes[0]
      activeSpeaker.producerId = producer.id
      activeSpeaker.volume = volume
      activeSpeaker.peerId = producer.appData.peerId
    })

    audioLevelObserver.on('silence', () => {
      activeSpeaker.producerId = null
      activeSpeaker.volume = null
      activeSpeaker.peerId = null
    })

    const room = {
      id,
      subject,
      password,
      owner,
      peers,
      activeSpeaker,
      router,
      audioLevelObserver,
    }

    this.rooms[id] = room

    return room
  }

  GetRoom(id) {
    return this.rooms[id]
  }

  async CreateWebRtcTransport(roomId, peerId, direction) {
    const room = this.GetRoom(roomId)
    const peer = room.peers[peerId]
    const { router } = room
    const {
      listenIps,
      initialAvailableOutgoingBitrate,
    } = config.webRtcTransport

    const transport = await router.createWebRtcTransport({
      listenIps,
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
      preferTcp: false,
      initialAvailableOutgoingBitrate,
      appData: { peerId, clientDirection: direction },
    })

    peer.transports[transport.id] = transport

    return transport
  }

  async ClosePeer(roomId, peerId) {
    try {
      const room = this.GetRoom(roomId)
      const peer = room.peers[peerId]

      Object.values(peer.transports).forEach((transport) => {
        if (transport.appData.peerId === peerId) {
          transport.close()
          delete peer.transports[transport.id]
        }
      })

      delete room.peers[peerId]

      if (Object.keys(room.peers).length === 0) {
        console.log('Closing Room', roomId)
        room.router.close()
        delete this.rooms[roomId]
      }
      return true
    } catch (e) {
      console.error('ERROR in resume-consumer', e)
      return false
    }
  }

  async CreateProducer(
    roomId,
    peerId,
    transportId,
    kind,
    rtpParameters,
    paused,
    appData
  ) {
    const room = this.GetRoom(roomId)
    const { audioLevelObserver } = room
    const peer = room.peers[peerId]
    const transport = peer.transports[transportId]

    if (!transport) {
      console.error(`server-side transport ${transportId} not found`)
      return null
    }

    const producer = await transport.produce({
      kind,
      rtpParameters,
      paused,
      appData: { ...appData, peerId, transportId },
    })

    // if our associated transport closes, close ourself, too
    producer.on('transportclose', async () => {
      console.log("producer's transport closed", producer.id)
      await producer.close()
    })

    // monitor audio level of this producer. we call addProducer() here,
    // but we don't ever need to call removeProducer() because the core
    // AudioLevelObserver code automatically removes closed producers
    if (producer.kind === 'audio') {
      audioLevelObserver.addProducer({ producerId: producer.id })
    }

    peer.producers[producer.id] = producer
    /* peer.media[producer.appData.mediaTag] = {
      paused: false
    } */

    return producer
  }

  async PauseProducer(roomId, peerId, producerId) {
    console.log('pausing producer', producerId)
    const room = this.GetRoom(roomId)
    const peer = room.peers[peerId]
    const producer = peer.producers[producerId]
    try {
      await producer.pause()
      //peer.media[producer.appData.mediaTag].paused = true
      return true
    } catch (e) {
      console.error('ERROR PAUSE PRODUCER', e)
      return false
    }
  }

  async ResumeProducer(roomId, peerId, producerId) {
    console.log('resuming producer', producerId)
    const room = this.GetRoom(roomId)
    const peer = room.peers[peerId]
    const producer = peer.producers[producerId]

    try {
      await producer.resume()
      //peer.media[producer.appData.mediaTag].paused = false
      return true
    } catch (e) {
      console.error('ERROR RESUME PRODUCER', e)
      return false
    }
  }

  async CloseProducer(roomId, peerId, producerId) {
    console.log('closing producer', producerId)
    const room = this.GetRoom(roomId)
    const peer = room.peers[peerId]
    const producer = peer.producers[producerId]

    try {
      await producer.close()
      delete peer.producers[producerId]
      return true
    } catch (e) {
      console.error('ERROR CLOSE PRODUCER', e)
      return false
    }
  }

  async CreateConsumer(
    roomId,
    peerId,
    peerIdProducer,
    transportId,
    producerId,
    mediaTag,
    rtpCapabilities
  ) {
    const room = this.GetRoom(roomId)
    const { router } = room
    const peer = room.peers[peerId]
    const peerProducer = room.peers[peerIdProducer]
    const transport = peer.transports[transportId]
    const producer = peerProducer.producers[producerId]

    if (!router.canConsume({ producerId: producer.id, rtpCapabilities })) {
      console.error(
        'ERROR in /recv-track',
        `server-side recv-track client cannot consume ${peerIdProducer}:${mediaTag}`
      )
      return null
    }

    const consumer = await transport.consume({
      producerId: producer.id,
      rtpCapabilities,
      paused: true, // see note above about always starting paused
      appData: { peerId, peerIdProducer, mediaTag },
    })

    consumer.on('transportclose', () => {
      console.log(`consumer's transport closed`, consumer.id)
      this.CloseConsumer(roomId, peerId, consumer)
    })

    consumer.on('producerclose', () => {
      console.log(`consumer's producer closed`, consumer.id)
      this.CloseConsumer(roomId, peerId, consumer)
    })

    consumer.on('layerschange', (layers) => {
      console.log(
        `consumer layerschange ${peerIdProducer}->${peerId}`,
        mediaTag,
        layers
      )
    })

    peer.consumers[consumer.id] = consumer

    return consumer
  }

  async ResumeConsumer(roomId, peerId, consumerId) {
    const room = this.GetRoom(roomId)
    const peer = room.peers[peerId]
    const consumer = peer.consumers[consumerId]
    if (!consumer) {
      console.error('ERROR in resume-consumer')
      return false
    }
    await consumer.resume()
    return true
  }

  async CloseConsumer(roomId, peerId, consumerId) {
    try {
      const room = this.GetRoom(roomId)
      const peer = room.peers[peerId]
      const consumer = peer.consumers[consumerId]
      console.log('closing consumer', consumer.id, consumer.appData)

      await consumer.close()

      delete peer.consumers[consumer.id]
      return true
    } catch (e) {
      console.error('ERROR in resume-consumer', e)
      return false
    }
  }

  async GetPeerBySocketId(socketId) {
    let peerId = null
    let roomId = null
    Object.values(this.rooms).forEach((room) => {
      Object.values(room.peers).forEach((peer) => {
        if (peer.socket === socketId) {
          peerId = peer.peerId
          roomId = room.id
        }
      })
    })
    return { roomId, peerId }
  }

  async RemovePeer(socketId) {
    const { roomId, peerId } = await this.GetPeerBySocketId(socketId)
    if (!roomId || !peerId) {
      console.error('PEER NOT FOUND CANT REMOVE')
      return { roomId, peerId }
    }
    await this.ClosePeer(roomId, peerId)
    console.log('REMOVED', peerId, roomId)
    return { roomId, peerId }
  }
}

export default new MediaServer()
