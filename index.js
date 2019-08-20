const ansi = require('ansi-html-stream')
const express = require('express')
const flatten = require('lodash.flatten')

const config = require('./config')
const { listImageRepoTags, run, pullAsync } = require('./docker')

const app = express()
const port = 3000

const { tools } = config

app.get('/tools', (req, res) => {
  const html = `
    <h1>Registered apps</h1>
    <ul>
      ${tools.map(({ id, description }) => {
        return `
          <li>
            <a href="/tool/${id}">${id}</a>
            <p>${description}</p>
          </li>
        `
      }).join('')}
    </ul>
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
    <style>
      iframe {
        min-height: 300px;
        width: 80%;
      }
      legend {
        font-size: 21px;
      }
      label {
        display: block;
      }
      button {
        display: block;
      }
    </style>
    <script>const format = (${format.toString()})</script>
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
        const iframe = document.querySelector('#${id}-output')
        iframe.onmessage(msg => {
          console.log({ msg })
        })
    </section>
  `

  res.send(form)
})

app.get('/run/:image', (req, res) => {
  const { image } = req.params
  const { command: urlCommand } = req.query
  const command = urlCommand ? urlCommand.split(' ') : ['']
  res.write(`Running ${image} with ${command.join(' ')}\n`)
  res.write(`
    <script>
      document.addEventListener('DOMContentLoaded', (e) => {
        window.location.href = '/tools'
      })
    </script>
  `)
  run({
    image,
    command,
    stream: res,
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

