"use strict";
var serialport = require("serialport");
var inquirer = require("inquirer");
var cliArgs = require("command-line-args");
var getUsage = require("command-line-usage");
var serialport_1 = require("./src/serialport");
var hex = require('hex');
var Main = (function () {
    function Main() {
        this.options = cliArgs(cliOptsDefs);
    }
    Main.prototype.run = function () {
        var _this = this;
        // Modalità interattiva
        if (Object.keys(this.options).length === 0) {
            this.selectSerialPorts()
                .then(this.createCoupler)
                .then(function (c) {
                _this.coupler = c;
                _this.coupler.begin();
            })
                .catch(function (err) {
                console.log("Error: " + err.message);
            });
        }
        else if (this.options['help']) {
            console.log(getUsage(usageSections));
        }
        else {
            var config = new CouplerConfig();
            config.serial_a = this.options['serial_a'];
            config.serial_b = this.options['serial_b'];
            if (typeof this.options['baudrate'] !== undefined) {
                config.baudrate_a = this.options['baudrate'];
                config.baudrate_b = this.options['baudrate'];
            }
            else {
                config.baudrate_a = this.options['baudrate_a'];
                config.baudrate_b = this.options['baudrate_b'];
            }
            this.createCoupler(config)
                .then(function (c) {
                _this.coupler = c;
                _this.coupler.begin();
            })
                .catch(function (err) {
                console.log("Error: " + err.message);
            });
        }
    };
    /**
     * Creation of the coupler
     */
    Main.prototype.createCoupler = function (ans) {
        return new Promise(function (resolve, reject) {
            var readyConfig = ans;
            if (!Coupler.isConfigValid(ans)) {
                readyConfig = {
                    serial_a: ans['serial_a'],
                    baudrate_a: Number(ans['baudrate_a']),
                    serial_b: ans['serial_b'],
                    baudrate_b: Number(ans['baudrate_b'])
                };
            }
            try {
                return resolve(new Coupler(readyConfig));
            }
            catch (err) {
                return reject(err);
            }
        });
    };
    /**
     * Select the serial ports to couple together
     */
    Main.prototype.selectSerialPorts = function () {
        return new Promise(function (resolve, reject) {
            serialport.list(function (err, ports) {
                if (err)
                    reject(err);
                // Preparing data
                var serialPortsChoices = [];
                ports.forEach(function (p) {
                    serialPortsChoices.push(p.comName);
                });
                var baudates = ['110', '300', '1200', '2400', '4800', '9600', '14400', '19200', '38400', '57600', '115200'].reverse();
                // Creating questions
                var questions = [{
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
                    .catch(reject);
            });
        });
    };
    Object.defineProperty(Main.prototype, "couplerConfig", {
        get: function () {
            return this._couplerConfig;
        },
        set: function (v) {
            this._couplerConfig = v;
        },
        enumerable: true,
        configurable: true
    });
    return Main;
}());
// Oggetto di configurazione dell'accopiatore
var CouplerConfig = (function () {
    function CouplerConfig() {
    }
    return CouplerConfig;
}());
var Coupler = (function () {
    function Coupler(config) {
        this.serialA = new serialport_1.SerialPort(config.serial_a, config.baudrate_a);
        this.serialB = new serialport_1.SerialPort(config.serial_b, config.baudrate_b);
    }
    Coupler.prototype.begin = function () {
        var serialA = this.serialA;
        var serialB = this.serialB;
        this.serialA.onData(this.dumpAndRedirect(this.serialA, this.serialB));
        this.serialB.onData(this.dumpAndRedirect(this.serialB, this.serialA));
        this.serialA.open();
        this.serialB.open();
    };
    Coupler.prototype.dumpAndRedirect = function (input, output) {
        return function (data) {
            var buffer = new Buffer(data);
            // var time = new Date();
            output.writeData(buffer);
            // console.log(`\n${time.toISOString()} [${input.name}]:`);
            // hex(buffer);            
            input.logData(buffer);
        };
    };
    Coupler.isConfigValid = function (config) {
        return config.baudrate_a !== undefined;
    };
    return Coupler;
}());
var main = new Main();
main.run();
