const config = {
  apps: [
    {
      id: 'alpine',
      image: 'alpine:latest',
      description: 'Some text can go here',
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
        return 'ls /'
      }
    },
    {
      id: 'sherlock',
      image: 'sherlock:latest',
      description: 'Some text can go here',
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
      id: 'test',
      image: 'node:10',
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