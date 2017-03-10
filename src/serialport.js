"use strict";
var serialport = require("serialport");
var SerialPort = (function () {
    function SerialPort(name, baudrate, writeDelay, logDelay) {
        if (writeDelay === void 0) { writeDelay = 2; }
        if (logDelay === void 0) { logDelay = 5; }
        var _this = this;
        this.name = name;
        this.baudrate = baudrate;
        this.writeDelay = writeDelay;
        this.logDelay = logDelay;
        this.flushLog = function () {
            var time = new Date();
            console.log("\n" + time.toISOString() + " [" + _this.name + "]:");
            hex(_this.logBuffer);
            _this.logBuffer = new Buffer('');
            _this.logBufferLock = false;
        };
        this.flushWrite = function () {
            _this.write(_this.writeBuffer);
            _this.writeBuffer = new Buffer('');
            _this.writeBufferLock = false;
        };
        this.serial = new serialport(name, {
            baudRate: baudrate,
            autoOpen: false,
            parser: this.parser([0x0D, 0x0A])
        });
        this.logBuffer = new Buffer('');
        this.writeBuffer = new Buffer('');
    }
    SerialPort.prototype.parser = function (delimiter) {
        if (Object.prototype.toString.call(delimiter) !== '[object Array]') {
            delimiter = [delimiter];
        }
        var buf = [];
        var nextDelimIndex = 0;
        var handshake_done = false;
        var last_char = 0x00;
        return function (emitter, buffer) {
            var d = new Buffer(buffer);
            if (handshake_done) {
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
            }
            else if (d.compare(new Buffer([0x1C]))) {
                last_char = 0x1C;
                emitter.emit('data', d);
            }
            else if (d.compare(new Buffer([0x55]))) {
                if (last_char == 0x1C) {
                    handshake_done = true;
                }
                else {
                    last_char = 0x00;
                }
                emitter.emit('data', d);
            }
        };
    };
    SerialPort.prototype.open = function () {
        var _this = this;
        this.serial.open(function (err) {
            if (err)
                console.log("Error: " + err.message);
        });
        this.serial.on('open', function () {
            _this.serial.flush(function (err) {
                if (err)
                    console.log("Error: " + err.message);
            });
        });
    };
    SerialPort.prototype.onData = function (callback) {
        this.serial.on('data', callback);
    };
    SerialPort.prototype.write = function (buffer) {
        this.serial.write(buffer);
    };
    SerialPort.prototype.logData = function (data) {
        if (this.logBufferLock) {
            clearTimeout(this.logTimeout);
        }
        else {
            this.logBufferLock = true;
        }
        this.logBuffer = Buffer.concat([this.logBuffer, data]);
        this.logTimeout = setTimeout(this.flushLog, this.logDelay);
    };
    SerialPort.prototype.writeData = function (data) {
        if (this.writeBufferLock) {
            clearTimeout(this.writeTimeout);
        }
        else {
            this.writeBuffer = Buffer.concat([this.writeBuffer, data]);
            if (this.writeBuffer[this.writeBuffer.length - 1] == 0x0A &&
                this.writeBuffer[this.writeBuffer.length - 2] == 0x0D) {
                this.flushWrite();
            }
            else {
                this.writeTimeout = setTimeout(this.flushWrite, this.writeDelay);
            }
        }
    };
    return SerialPort;
}());
exports.SerialPort = SerialPort;
