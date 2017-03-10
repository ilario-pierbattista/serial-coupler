import serialport = require('serialport')
import inquirer = require('inquirer')
import cliArgs = require('command-line-args')
import getUsage = require('command-line-usage')
var hex = require('hex');


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

class Main {
    private coupler: Coupler
    private options: any

    public constructor() {
        this.options = cliArgs(cliOptsDefs);
    }

    public run() {
        // Modalità interattiva
        if (Object.keys(this.options).length === 0) {
            this.selectSerialPorts()
                .then(this.createCoupler)
                .then((c: Coupler) => {
                    this.coupler = c;
                    this.coupler.begin();
                })
                .catch((err: Error) => {
                    console.log(`Error: ${err.message}`);
                })
        } else if (this.options['help']) {  // Help usage
            console.log(getUsage(usageSections));
        } else {  // Modalità CLI
            let config: CouplerConfig = new CouplerConfig();

            config.serial_a = this.options['serial_a'];
            config.serial_b = this.options['serial_b'];
            if (typeof this.options['baudrate'] !== undefined) {
                config.baudrate_a = this.options['baudrate'];
                config.baudrate_b = this.options['baudrate'];
            } else {
                config.baudrate_a = this.options['baudrate_a'];
                config.baudrate_b = this.options['baudrate_b'];
            }

            this.createCoupler(config)
                .then((c: Coupler) => {
                    this.coupler = c;
                    this.coupler.begin();
                })
                .catch((err: Error) => {
                    console.log(`Error: ${err.message}`)
                })
        }
    }

    /**
     * Creation of the coupler
     */
    public createCoupler(ans: inquirer.Answers | CouplerConfig): Promise<any> {
        return new Promise<Coupler>((resolve: (c: Coupler) => any, reject: (err: Error) => any) => {
            var readyConfig = <CouplerConfig>ans;
            if (!Coupler.isConfigValid(ans)) {
                let config: CouplerConfig = {
                    serial_a: ans['serial_a'],
                    baudrate_a: Number(ans['baudrate_a']),
                    serial_b: ans['serial_b'],
                    baudrate_b: Number(ans['baudrate_b'])
                }
                readyConfig = config;
            }
            try {
                return resolve(new Coupler(readyConfig))
            } catch (err) {
                return reject(err)
            }
        })
    }

    /**
     * Select the serial ports to couple together
     */
    private selectSerialPorts(): Promise<inquirer.Answers> {
        return new Promise<inquirer.Answers>(
            (resolve: (ans: inquirer.Answers) => any, reject: (err: Error) => any) => {
                serialport.list(function (err: Error, ports) {
                    if (err) reject(err)

                    // Preparing data
                    let serialPortsChoices = [];
                    ports.forEach(function (p) {
                        serialPortsChoices.push(p.comName)
                    })
                    let baudates = ['110', '300', '1200', '2400', '4800', '9600', '14400', '19200', '38400', '57600', '115200'].reverse();

                    // Creating questions
                    let questions: inquirer.Questions = [{
                        type: 'rawlist',
                        name: 'serial_a',
                        message: 'First serial port',
                        choices: serialPortsChoices,
                    }, {
                        type: 'rawlist',
                        name: 'baudrate_a',
                        message: 'First serial baudrate',
                        choices: baudates,
                        paginated: false
                    }, {
                        type: 'rawlist',
                        name: 'serial_b',
                        message: 'Second serial port',
                        choices: serialPortsChoices
                    }, {
                        type: 'rawlist',
                        name: 'baudrate_b',
                        message: 'Second serial baudrate',
                        choices: baudates,
                        paginated: false
                    }];

                    // Asking for prompt
                    return inquirer.prompt(questions)
                        .then(resolve)
                        .catch(reject)
                });
            })

    }

    private _couplerConfig: CouplerConfig;
    public get couplerConfig(): CouplerConfig {
        return this._couplerConfig;
    }
    public set couplerConfig(v: CouplerConfig) {
        this._couplerConfig = v;
    }
}


// Oggetto di configurazione dell'accopiatore
class CouplerConfig {
    public serial_a: string
    public baudrate_a: Number
    public serial_b: string
    public baudrate_b: Number
}

interface SerialPortLib {
    on(event: String, callback: Function)
    open(callback: Function)
    write(buffer: Buffer)
    flush(cb: (err: Error) => any)
}

class SerialPort {
    serial: SerialPortLib
    public logBuffer: Buffer
    public writeBuffer: Buffer
    public logBufferLock: boolean
    public writeBufferLock: boolean
    private logTimeout: NodeJS.Timer
    private writeTimeout: NodeJS.Timer

    constructor(public name: string, public baudrate: Number, private writeDelay: number = 2, private logDelay: number = 5) {
        this.serial = new serialport(name, {
            baudRate: baudrate,
            autoOpen: false,
            parser: this.parser([0x0D, 0x0A])
        });
        this.logBuffer = new Buffer('');
        this.writeBuffer = new Buffer('');
    }

    private parser(delimiter: any) {
        if (Object.prototype.toString.call(delimiter) !== '[object Array]') {
            delimiter = [delimiter];
        }
        var buf = [];
        var nextDelimIndex = 0;
        var handshake_done = false;
        var last_char = 0x00;
        return function (emitter: NodeJS.EventEmitter, buffer: string) {
            var d = new Buffer(buffer);
            if(handshake_done) {
                for (var i = 0; i < buffer.length; i++) {
                    buf[buf.length] = buffer[i];
                    if (buf[buf.length - 1] === delimiter[nextDelimIndex]) {
                        nextDelimIndex++;
                    }
                    if (nextDelimIndex === delimiter.length) {
                        emitter.emit('data', buf);
                        buf = [];
                        nextDelimIndex = 0;
                    }
                }
            } else if(d.compare(new Buffer([0x1C]))) {
                last_char = 0x1C;
                emitter.emit('data', d);
            } else if(d.compare(new Buffer([0x55]))) {
                if(last_char == 0x1C) {
                    handshake_done = true;
                } else {
                    last_char = 0x00;
                }
                emitter.emit('data', d);
            }
        };
    }

    public open() {
        this.serial.open(function (err: Error) {
            if (err) console.log(`Error: ${err.message}`);
        });
        this.serial.on('open', () => {
            this.serial.flush((err: Error) => {
                if (err) console.log(`Error: ${err.message}`)
            });
        });
    }

    public onData(callback: Function) {
        this.serial.on('data', callback);
    }

    public write(buffer: Buffer) {
        this.serial.write(buffer);
    }

    public logData(data: Buffer) {
        if (this.logBufferLock) {
            clearTimeout(this.logTimeout);
        } else {
            this.logBufferLock = true;
        }
        this.logBuffer = Buffer.concat([this.logBuffer, data]);
        this.logTimeout = setTimeout(this.flushLog, this.logDelay);
    }

    public writeData(data: Buffer) {
        if (this.writeBufferLock) {
            clearTimeout(this.writeTimeout);
        } else {
            this.writeBuffer = Buffer.concat([this.writeBuffer, data]);
            if (this.writeBuffer[this.writeBuffer.length - 1] == 0x0A &&
                this.writeBuffer[this.writeBuffer.length - 2] == 0x0D) {
                this.flushWrite();
            } else {
                this.writeTimeout = setTimeout(this.flushWrite, this.writeDelay);
            }
        }
    }

    private flushLog = () => {
        var time = new Date();
        console.log(`\n${time.toISOString()} [${this.name}]:`);
        hex(this.logBuffer);
        this.logBuffer = new Buffer('');
        this.logBufferLock = false;
    };

    private flushWrite = () => {
        this.write(this.writeBuffer);
        this.writeBuffer = new Buffer('');
        this.writeBufferLock = false;
    }
}

class Coupler {
    private serialA: SerialPort
    private serialB: SerialPort

    constructor(config: CouplerConfig) {
        this.serialA = new SerialPort(config.serial_a, config.baudrate_a);
        this.serialB = new SerialPort(config.serial_b, config.baudrate_b);
    }

    public begin() {
        let serialA = this.serialA;
        let serialB = this.serialB;

        this.serialA.onData(this.dumpAndRedirect(this.serialA, this.serialB));
        this.serialB.onData(this.dumpAndRedirect(this.serialB, this.serialA));

        this.serialA.open();
        this.serialB.open();
    }

    private dumpAndRedirect(input: SerialPort, output: SerialPort): (data: string) => void {
        return (data: string) => {
            var buffer = new Buffer(data);
            // var time = new Date();
            output.writeData(buffer);
            // console.log(`\n${time.toISOString()} [${input.name}]:`);
            // hex(buffer);            
            input.logData(buffer);
        }
    }

    public static isConfigValid(config: any) {
        return (<CouplerConfig>config).baudrate_a !== undefined;
    }
}

let main = new Main();
main.run();