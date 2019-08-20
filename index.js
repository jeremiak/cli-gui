const { default: Ansi } = require('ansi_up')
const express = require('express')
const flatten = require('lodash.flatten')
const transform = require('stream-transform')

const config = require('./config')
const { listImageRepoTags, run, pullAsync } = require('./docker')

const ansi = new Ansi()
const app = express()
const port = 3000

const { tools } = config

app.use(express.static('public'))

const startTime = new Date()

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

  function onSubmit (event) {
    event.preventDefault();

    const form = event.target
    const { action, elements } = form;
    const data = {};

    form.querySelector('button').setAttribute('disabled', 'true')

    for (var i = 0; i < elements.length; i++) {
      let element = elements[i];
      data[element.name] = encodeURIComponent(element.value);
    }

    const formatted = format(data);
    const url = `${action}?command=${formatted}`;
    const iframe = document.querySelector(`iframe`)
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
          const { defaultValue, label, name, type } = field

          switch(type) {
            case 'select':
              return `
                 <label>
                  ${label || name}
                  <select name="${name}">
                    ${field.options.map(option => {
                      if (!option.label) return `<option>${option.value}</option>`

                      return `
                        <option value="${option.value}">
                          ${option.label}
                        </option>
                      `
                    }).join('')}
                  </select>
                </label>
              `
            default:
              return `
                <label>
                  ${label || name}
                  <input type="text" name="${name}" default="${defaultValue}">
                </label>
              `
          }
          }).join('')}
        <button>Run</button>
      </form>
    </section>
    <section>
      <h2>Output</h2>
      <iframe id="${id}-output"></iframe>
      <script>
        const iframe = document.querySelector("#${id}-output") 

        window.addEventListener('message', ({ data }) => {
          if (data !== 'done') return

          document.querySelector('button').removeAttribute('disabled')
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
  const { command: urlCommand } = req.query
  const command = urlCommand ? urlCommand.split(' ') : ['']
  const transformer = transform((d) => {
    const html = d.split('\n').forEach(chunk => {
      res.write(`<br>${ansi.ansi_to_html(chunk)}`)
    })
  })

  transformer.on('finish', () => {
    res.write('<br><br>Finished')
    res.end()
  })

  res.type('html')
  res.write(`
    <script>
      document.addEventListener('DOMContentLoaded', (e) => {
        parent.postMessage('done')
      })
    </script>
    <style>
    html { background-color: #ccc; }
    * { font-family: monospace; }
    </style>
  `)
  res.write(`Running ${image} with "${command.join(' ')}"<br><br>`)

  run({
    image,
    command,
    stream: transformer,
  })
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

