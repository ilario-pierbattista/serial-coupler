import serialport = require('serialport')
import inquirer = require('inquirer')
import cliArgs = require('command-line-args')
import getUsage = require('command-line-usage')
import {SerialPort} from './src/serialport'
let hex = require('hex');

class Main {
    private coupler: Coupler;
    private options: any;

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
            let readyConfig = <CouplerConfig>ans;
            if (!Coupler.isConfigValid(ans)) {
                readyConfig = {
                    serial_a: ans['serial_a'],
                    baudrate_a: Number(ans['baudrate_a']),
                    serial_b: ans['serial_b'],
                    baudrate_b: Number(ans['baudrate_b'])
                };
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
                    if (err) reject(err);

                    // Preparing data
                    let serialPortsChoices = [];
                    ports.forEach(function (p) {
                        serialPortsChoices.push(p.comName)
                    });
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
    public serial_a: string;
    public baudrate_a: Number;
    public serial_b: string;
    public baudrate_b: Number
}

interface SerialPortLib {
    on(event: String, callback: Function)
    open(callback: Function)
    write(buffer: Buffer)
    flush(cb: (err: Error) => any)
}


class Coupler {
    private serialA: SerialPort;
    private serialB: SerialPort;

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
            const buffer = new Buffer(data);
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