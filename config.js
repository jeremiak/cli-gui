const config = {
  tools: [
    {
      id: 'alpine',
      image: 'alpine:latest',
      description: 'This is just linux.',
      fields: [
        {
          name: 'command',
          label: 'Enter a linux bash command',
          defaultValue: '',
          type: 'string',
        },
      ],
      format: (fields) => {
        return fields.command
      }
    },
    {
      id: 'sherlock',
      image: 'sherlock:latest',
      description: 'Sherlock is a tool for searching for a username across many social networks',
      fields: [
        {
          name: 'username',
          label: 'Enter username for search query',
          defaultValue: '',
          type: 'string',
        },
      ],
      format: (fields) => {
        const { username } = fields
        return username
      }
    },
    {
      id: 'node',
      image: 'node:10',
      description: 'Node version 10',
      fields: [
        {
          name: '$1',
          label: 'Enter username for search query',
          defaultValue: '',
          type: 'string',
        },
        {
          name: 'version',
          label: 'Enter whatever',
          defaultValue: 'XZZ',
          type: 'select',
          options: [
            {
              label: 'dude',
              value: 'somethign else',
            },
            {
              value: '10'
            }
          ]
        }
      ],
      format: (fields) => {
        return `${fields['$1']}`
      }
    }
  ]
}

module.exports = config