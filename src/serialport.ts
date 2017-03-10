import serialport = require('serialport')


export class SerialPort {
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