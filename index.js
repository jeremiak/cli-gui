const { default: Ansi } = require('ansi_up')
const bodyParser = require('body-parser')
const busboy = require('connect-busboy')
const express = require('express')
const flatten = require('lodash.flatten')
const transform = require('stream-transform')
const uuid = require('uuid/v1')

const config = require('./config')
const { listImageRepoTags, run, runWithPipedInStream, pullAsync } = require('./docker')

const ansi = new Ansi()
const app = express()
const port = 3000

const { tools } = config

app.use(express.static('public'))
app.use(busboy())
app.use(bodyParser.json())

const startTime = new Date()

// files stores filename to streamId matches
const files = {}
// streams store the active streams that are piped
// from the upload to the container
const streams = {}

app.get('/status.json', (req, res) => {
  res.json({ startTime })
})

app.get('/tools', (req, res) => {
  const html = `
    <link rel="stylesheet" href="/main.css">
    <nav>
      <a href="/tools">Tools</a>
      <a href="https://github.com/jeremiak/cli-gui">About</a>
    </nav>
    <h1>Registered tools</h1>
    <ul id="tools">
      ${tools.map(({ description, id, image }) => {
        return `
          <li>
            <a href="/tool/${id}">${id} (<code>${image}</code>)</a>
            <p>${description}</p>
          </li>
        `
      }).join('')}
    </ul>
    <footer>
      💫
    </footer>
  `

  res.send(html)
})

app.get('/tool/:toolId', (req, res) => {
  const { toolId } = req.params
  const matchingTool = tools.find(a => a.id.toLowerCase() === toolId.toLowerCase())
  if (!matchingTool) return res.sendStatus(404)

  const { id, description, fields, format, image } = matchingTool

  async function onSubmit (event) {
    event.preventDefault();

    const form = event.target
    const { action, elements } = form;

    const data = {};
    const files = [];
    let streamId;

    const button = document.querySelector('button')
    const iframe = document.querySelector(`iframe`);
    
    button.innerText = 'Running...'
    button.setAttribute('disabled', 'true')

    for (var i = 0; i < elements.length; i++) {
      let element = elements[i];
      if (element.type.toLowerCase() !== 'file') {
        data[element.name] = encodeURIComponent(element.value);
      } else {
        Array.prototype.slice.call(element.files).forEach(f => {
          files.push({ name: element.name, file: f })
        })
      }
    }

    const originalButtonText = button.innerText
    if (files.length > 0) {
      const fileData = new FormData()
      const { name, file } = files[0];
      const { name: filename } = file
      fileData.append(name, file);
      button.innerText = 'Uploading'
      const streamIdRequest = await axios.post('/upload', { filename })
      streamId = streamIdRequest.data.streamId
      axios.post(`/upload/${streamId}`, fileData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      }).then(({ data }) => {
        button.innerText = originalButtonText
        streamId = data.streamId
      })
    }

    const formatted = format(data);
    
    let url = `${action}?command=${formatted}`;

    if (streamId) {
      url += `&streamId=${streamId}`;
    }
    
    iframe.src = url;

  }

  const form = `
    <link rel="stylesheet" href="/main.css">
    <script>const format = (${format.toString()})</script>
    <nav>
      <a href="/tools">Tools</a>
      <a href="https://github.com/jeremiak/cli-gui">About</a>
    </nav>
    <h1>${id}</h1>
    <p>${description}</p>
    <section>
      <h2>Input</h2>
      <form action="/run/${image}" onsubmit="(${onSubmit.toString()})(event)">
        ${fields.map(field => {
          const { defaultValue, label, name, required, type } = field
          const labelText = `${ label || name} ${ required ? '(required)': '' }`

          switch(type) {
            case 'file':
              return `
                <label>
                  ${labelText}
                  <input type="file" name="${name}">
                </label>
              `
            case 'select':
              if (!field.options) {
                throw new Error('The options are required for select fields')
              }
              return `
                 <label>
                  ${labelText}
                  <select name="${name}" ${required && 'required'}>
                    <option></option>
                    ${field.options.map(option => {
                      if (!option.label) return `<option>${option}</option>`

                      return `
                        <option value="${option.value}">
                          ${option.label}
                        </option>
                      `
                    }).join('')}
                  </select>
                </label>
              `
            case 'date':
              return `
                <label>
                  ${labelText}
                  <input name="${name}" type="date" ${required && 'required'} >
                </label>
              `
            default:
              return `
                <label>
                  ${labelText}
                  <input
                    type="text"
                    name="${name}"
                    default="${defaultValue}"
                    ${required && 'required'}
                  >
                </label>
              `
          }
          }).join('')}
        <button>Run</button>
      </form>
    </section>
    <section>
      <h2>Output</h2>
      <iframe
        aria-live="polite"
        id="${id}-output"
        title="Output for the ${id} tool"
      ></iframe>
      <script src="/axios.min.js"></script>
      <script>
        const iframe = document.querySelector("#${id}-output") 

        window.addEventListener('message', ({ data }) => {
          if (data.type !== 'done') return

          const button = document.querySelector('form button')
          button.innerText = 'Run again'
          button.removeAttribute('disabled')
        })

        
      </script>

    </section>
    <footer>
      💫
    </footer>
  `

  res.send(form)
})

app.get('/run/:image', (req, res) => {
  const { image } = req.params
  const { command: urlCommand, streamId } = req.query
  const command = urlCommand ? urlCommand.split(' ') : ['']
  const transformer = transform((buffer) => {
    const d = buffer.toString()
    d.split('\n').forEach(chunk => {
      res.write(`<br>${ansi.ansi_to_html(chunk)}`)
    })
  })

  transformer.on('finish', () => {
    res.write('</div><br><br>Finished')
    res.end()
  })

  res.type('html')
  res.write(`
    <link rel="stylesheet" href="/iframe.css">
    <script>
      document.addEventListener('DOMContentLoaded', (e) => {
        parent.postMessage({ type: 'done' })
      })
      window.addEventListener('resize', () => {
        console.log('aaa')
      })
      window.addEventListener('message', ({ data }) => {
        if (data.type !== 'content:get') return

        const content = document.querySelector('#output').innerText
        parent.postMessage({ type: 'content:got', content })
      })
    </script>
  `)
  let beginning = `Running ${image} with "${command.join(' ')}"`
  if (streamId) {
    beginning += ` and stream ${streamId} (${streams[streamId].name}) as stdin`
  }
  beginning += '<br><br><div id="output">'
  res.write(beginning)

  if (streamId) {
    runWithPipedInStream({
      image,
      command,
      inStream: streams[streamId].stream,
      outStream: transformer,
    }).then(() => {
      delete streams[streamId]
    }).catch(e => {
      console.error(e)
    })
  } else {
    run({
      image,
      command,
      stream: transformer,
    })
  }
})

app.post('/upload', (req, res) => {
  const streamId = uuid()
  const { filename } = req.body

  files[filename] = streamId
  res.json({ streamId })
})

app.post('/upload/:uuid', (req, res) => {
  if (!req.busboy) {
    return res.end()
  }

  let i = 0
  const { uuid: streamId } = req.params
  const transformer = transform(d => {
    i += 1
    return d
  })

  req.busboy.on('file', (fieldname, file, filename) => {
    const match = files[filename]
    if (match !== streamId) {
      res.status(400).json({ message: `${streamId} is not the UUID for ${filename}`})
      return
    }
    streams[streamId] = {
      name: filename,
      stream: file.pipe(transformer)
    }
  })

  req.pipe(req.busboy)
  res.json({ streamId })
})

app.get('/', (req, res) => {
  res.redirect('/tools')
})

console.log('Checking for docker images by tools')
listImageRepoTags()
  .then(repoTags => {
    const tags = flatten(repoTags)
    const pulls = []

    console.log(`Found ${tools.length} tools and ${tags.length} repo tags`)
    tools.forEach(tool => {
      const { image } = tool

      if (tags.includes(image)) return

      pulls.push(pullAsync(image))
    })

    if (pulls.length) {
      console.log(`Installing any images required for the tools`)
    } else {
      console.log(`All images are already pulled`)
    }

    Promise.all(pulls).then(() => {
      if (pulls.length) console.log(`Pulled ${pulls.length} images`)

      app.listen(port, () => console.log(`Listening on port ${port}!`))
    })
  })

