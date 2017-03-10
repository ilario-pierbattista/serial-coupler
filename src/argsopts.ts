const cliOptsDefs = [
    { name: 'serial_a', alias: 'a', type: String },
    { name: 'serial_b', alias: 'b', type: String },
    { name: 'baudrate_a', type: Number },
    { name: 'baudrate_b', type: Number },
    { name: 'baudrate', alias: 'r', type: Number },
    { name: 'help', alias: 'h', type: Boolean }
]

const usageSections = [
    {
        header: 'A serial coupler',
        content: 'It couples [two] serial devices {together}, providing a simple and useful debugging tool.'
    },
    {
        header: 'Options',
        optionList: [
            {
                name: 'serial-a',
                alias: 'a',
                typeLabel: '[underline]{file}',
                description: 'The first serial port.'
            }, {
                name: 'serial-b',
                alias: 'b',
                typeLabel: '[underline]{file}',
                description: 'The second serial port.'
            }, {
                name: 'baudrate-a',
                typeLabel: '[underline]{baudrate}',
                description: 'Baudrate for first serial.'
            }, {
                name: 'baudrate-b',
                typeLabel: '[underline]{baudrate}',
                description: 'Baudrate for second serial.'
            }, {
                name: 'baudrate',
                alias: 'r',
                typeLabel: '[underline]{baudrate}',
                description: 'Baudrate for both serial ports.'
            }, {
                name: 'help',
                description: 'Print this usage guide.'
            }
        ]
    }
]