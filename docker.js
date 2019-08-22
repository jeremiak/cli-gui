const fs = require('fs')
const { promisify } = require('util')

const Docker = require('dockerode')

const socketPath = '/var/run/docker.sock'
if (!fs.statSync(socketPath)) {
  throw new Error('Are you sure the docker is running?');
}

const docker = new Docker({ socketPath })

const listImagesAsync = opts => {
  return new Promise((resolve, reject) => {
    docker.listImages(opts, (err, images) => {
      if (err) {
        reject(err)
        return
      }

      resolve(images)
    })
    promisify(docker.listImages)
  })
}
const pullAsync = (tag, opts) => {
  return new Promise((resolve, reject) => {
    docker.pull(tag, opts, (err, result) => {
      if (err) {
        reject(err)
        return
      }

      resolve(result)
    })
  })
}
const listImageRepoTags = async () => {
  const images = await listImagesAsync()

  const repoTags = images.map(image => image.RepoTags)
  return repoTags
}
const run = ({ image, command, stream }) => docker.run(image, command, stream)


const runWithPipedInStream = ({ image, command, inStream, outStream }) => {
  const containerOpts = {
    AttachStdin: true,
    AttachStdout: true,
    AttachStderr: true,
    Tty: false,
    OpenStdin: true,
    StdinOnce: true,
    Cmd: command,
    Image: image
  }
  const attachOpts = {
    hijack: true,
    stream: true,
    stdin: true,
    stdout: true,
    stderr: true,
  }

  return new Promise((resolve, reject) => {
    docker.createContainer(containerOpts, (createErr, container) => {
      if (createErr) {
        return reject(createErr)
      }
      container.attach(attachOpts, (attachErr, stream) => {
        if (attachErr) {
          return reject(attachErr)
        }

        stream.pipe(outStream)

        container.start((startErr) => {
          outStream.on('finish', () => { resolve() })
          if (startErr) {
            return reject(startErr)
          }
          inStream.pipe(stream)

          container.wait(() => {
            resolve()
          })
        })
      })
    })
  })
}

module.exports = {
  docker,
  run,
  runWithPipedInStream,
  listImageRepoTags,
  pullAsync,
}