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
          type: 'text',
        },
        {
          name: 'afile',
          label: 'Trying to get file uploads to work',
          type: 'file',
        },
      ],
      format: (fields) => {
        return fields.command
      }
    },
    {
      id: 'calendar',
      image: 'alpine:latest',
      description: 'This is an example of UI for the <code>cal</code> program.',
      fields: [
        {
          name: 'month',
          label: 'Enter a month',
          type: 'select',
          options: [{ label: 'January', value: '01' }, '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'],
          required: true
        },
        {
          name: 'year',
          label: 'Enter a year',
          type: 'select',
          options: ['2015', '2016', '2017', '2018', '2019']
        },
      ],
      format: (fields) => {
        const { month, year } = fields

        return `cal ${month} ${year}`
      }
    },
    {
      id: 'sherlock',
      image: 'sherlock:latest',
      description: 'Sherlock is a tool for searching for a username across many social networks (<a href="https://github.com/sherlock-project/sherlock">website</a>)',
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
    }
  ]
}

module.exports = config