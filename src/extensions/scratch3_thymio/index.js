/**
* Thymio exension for Scratch 3.0
* v 1.0 for internal use
* Created by Pollen Robotics on May 7, 2018
*
* This program is free software: you can redistribute it and/or modify
* it under the terms of the GNU Lesser General Public License as published
* by the Free Software Foundation, version 3 of the License.
*
* This program is distributed in the hope that it will be useful,
* but WITHOUT ANY WARRANTY; without even the implied warranty of
* MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
* GNU Lesser General Public License for more details.
*
* You should have received a copy of the GNU Lesser General Public License
* along with this program. If not, see <http://www.gnu.org/licenses/>.
*/

const ArgumentType = require('../../extension-support/argument-type');
const BlockType = require('../../extension-support/block-type');
const Timer = require('../../util/timer');
const Cast = require('../../util/cast');
const log = require('../../util/log');

const aeslString = require('./aesl');
const blockIconURI = require('./icon');


const clamp = function (val, min, max) {
    val = (val < min ? min : (val > max ? max : val));
    return val;
};

const makeLedsRGBVector = function (color) {
    const rgb = [];
    switch (parseInt(color / 33, 10)) {
    case 0:
        rgb[0] = 33;
        rgb[1] = color % 33;
        rgb[2] = 0;
        break;
    case 1:
        rgb[0] = 33 - (color % 33);
        rgb[1] = 33;
        rgb[2] = 0;
        break;
    case 2:
        rgb[0] = 0;
        rgb[1] = 33;
        rgb[2] = color % 33;
        break;
    case 3:
        rgb[0] = 0;
        rgb[1] = 33 - (color % 33);
        rgb[2] = 33;
        break;
    case 4:
        rgb[0] = color % 33;
        rgb[1] = 0;
        rgb[2] = 33;
        break;
    case 5:
        rgb[0] = 33;
        rgb[1] = 0;
        rgb[2] = 33 - (color % 33);
        break;
    }
    return rgb;
};

class Thymio {
    static get ASEBA_HTTP_URL () {
        return 'http://127.0.0.1:3000';
    }
    static get VMIN () {
        return -500;
    }
    static get VMAX () {
        return 500;
    }
    static get LMIN () {
        return 0;
    }
    static get LMAX () {
        return 32;
    }
    constructor () {
        this.source = null;
        this.connected = 0;
        this.eventCompleteCallback = false;
        this.cachedValues = Array();
        this._leds = [0, 0, 0];
        this._dial = -1;

        this.loadAesl();
        this.connect();
    }
    /**
     * The function subscribes to the Thymio’s SSE stream, sets an Event Listener on messages received
     * and stores R_state variable in cachedValues
     */
    connect () {
        if (this.source) {
            this.disconnect();
        }

        const url = `${Thymio.ASEBA_HTTP_URL}/nodes/thymio-II/events`;
        this.source = new EventSource(url);

        this.source.addEventListener('open', () => {
            log.info('Connection opened with Thymio web bridge.');
        });
        this.source.addEventListener('message', e => {
            const eventData = e.data.split(' ');
            this.connected = 2;

            if (eventData[0] === 'R_state_update') {
                this.cachedValues = eventData;
            } else {
                log.info(`Thymio emitted: ${eventData}`);
            }
            // If block requires to check event message for completion, it will set eventCompleteCallback
            if (typeof this.eventCompleteCallback === 'function') {
                // We pass eventData to be able to read event message
                this.eventCompleteCallback(eventData);
            }
        });
        this.source.addEventListener('error', () => {
            this.disconnect('Event stream closed');
            this.connected = 0;
            this.connect();
        });
    }
    /**
     * The function closes the Event Source.
     */
    disconnect () {
        if (this.source) {
            this.source.close();
            this.source = null;
        }
        this.connected = 0;
    }
    /**
     * The function sends code of thymio_motion.aesl to asebahttp bridge
     */
    loadAesl () {
        log.info('Send Aesl for Thymio.');

        const xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange = () => {
            if (xhttp.readyState === 4) {
                log.info('thymio_motion.aesl sent.');
                this.connect();
            }
        };

        xhttp.open('PUT', `${Thymio.ASEBA_HTTP_URL}/nodes/thymio-II`, true);
        xhttp.send(aeslString);
    }
    sendAction (action, args, callback) {
        log.info(`Send action ${action} with ${args}`);

        const params = args.join('/');

        const xmlhttp = new XMLHttpRequest();
        xmlhttp.responseType = 'json';
        const url = `${Thymio.ASEBA_HTTP_URL}/nodes/thymio-II/${action}/${params}`;

        if (typeof callback === 'function') {
            xmlhttp.onreadystatechange  = () => {
				if (xmlhttp.readyState !== 4) {
					return;
				}
			callback(xmlhttp);
			};
        }

        xmlhttp.open('GET', url, true);
        xmlhttp.send();
    }
    requestSend (args, method, callback) {
        switch (method) {
        case 1:
            method = 'GET';
            break;
        case 2:
            method = 'POST';
            break;
        case 3:
            method = 'PUT';
            break;
        default:
            method = 'GET';
            break;
        }

        // First argument is node name
        const url = `${Thymio.ASEBA_HTTP_URL}/nodes/thymio-II/${args[0]}`;

        const req = new XMLHttpRequest();
        if (!req) {
            return;
        }
        req.open(method, url, true);
        req.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
        req.onreadystatechange = () => {
            if (req.readyState !== 4) {
                return;
            }
            callback(req);
        };
        if (req.readyState === 4) {
            return;
        }

        const quid = 3;
        // let payload = '';
        // payload += '&body[]=' + quid;
        // payload += '&body[]=' + args[1];
        // payload += '&body[]=' + args[2];
        // payload += '&body[]=' + args[3];

        // Send http request
        const a = parseInt(args[1], 10);
        const b = parseInt(args[2], 10);
        const c = parseInt(args[3], 10);

        req.send(`[${quid},${a},${b},${c}]`);
    }
    /**
     * Run the left/right/all motors.
     * @param {string} motor - Item of menu 'leftrightal'.
     * @param {value} value - Speed in Aseba unities.
     */
    setMotor (motor, value) {
        value = parseInt(clamp(value, Thymio.VMIN, Thymio.VMAX), 10);
        const args = [value];

        log.info(`Set motor ${motor} to ${value}`);

        if (motor === 'left') {
            this.sendAction('M_motor_left', args);
        } else if (motor === 'right') {
            this.sendAction('M_motor_right', args);
        } else {
            this.sendAction('M_motor_left', args, () => {
                this.sendAction('M_motor_right', args);
            });
        }
    }
    /**
     * The robot stops.
     */
    stopMotors () {
        log.info('Stop all motors.');
        const args = [0];

        this.sendAction('M_motor_left', args, () => {
            this.sendAction('M_motor_right', args);
        });
    }
    move (distance, callback) {
        const mm = parseInt(distance, 10);
        if (mm === 0) {
            const args = [100 * 32 / 10]; // speed=10mm/s
            this.sendAction('M_motor_left', args, () => {
                this.sendAction('M_motor_right', args, callback);
            });

        } else {
            let speed;
            if (Math.abs(mm) < 20) {
                speed = 20;
            } else if (Math.abs(mm) > 150) {
                speed = 150;
            } else {
                speed = Math.abs(mm);
            }
            const time = Math.abs(mm) * 100 / speed; // time measured in 100 Hz ticks
            speed = speed * 32 / 10;

            const args = Array();
            args.push('Q_add_motion');
            args.push(time);
            if (mm > 0) {
                args.push(speed);
                args.push(speed);
            } else {
                args.push(speed * -1);
                args.push(speed * -1);
            }
            this.requestSend(args, 2, () => {
                // Set message to look for in event "message" and execute callback (next block) when received
                this.eventCompleteCallback = eventData => {
                    if (eventData[0].match(/^Q_motion_noneleft/)) {
                        callback();
                    }
                };
            });
        }
    }
    moveWithSpeed (distance, speed, callback) {
        // Construct args to send with request
        const mm = parseInt(distance, 10);
        speed = parseInt(Math.abs(speed), 10);
        speed = parseInt(clamp(speed, Thymio.VMIN * 10 / 32, Thymio.VMAX * 10 / 32), 10);

        if (mm === 0) {
            const args = [speed * 32 / 10]; // speed=10mm/s
            this.sendAction('M_motor_left', args, () => {
                this.sendAction('M_motor_right', args, callback);
            });
        } else {
            const time = Math.abs(mm) * 100 / speed; // time measured in 100 Hz ticks
            speed = speed * 32 / 10;

            const args = Array();
            args.push('Q_add_motion');
            args.push(time);
            if (mm > 0) {
                args.push(speed);
                args.push(speed);
            } else {
                args.push(speed * -1);
                args.push(speed * -1);
            }
            // Send request
            this.requestSend(args, 2, () => {
                // Set message to look for in event "message" and execute callback (next block) when received
                this.eventCompleteCallback = eventData => {
                    if (eventData[0].match(/^Q_motion_noneleft/)) {
                        callback();
                    }
                };
            });
        }
    }
    moveWithTime (distance, time, callback) {
        const mm = parseInt(distance, 10);
        time = parseInt(Math.abs(time), 10);
        let speed = parseInt(Math.abs(mm) / time, 10);
        speed = parseInt(clamp(speed, Thymio.VMIN * 10 / 32, Thymio.VMAX * 10 / 32), 10);

        time = time * 100; // time measured in 100 Hz ticks
        speed = speed * 32 / 10;

        const args = Array();

        args.push('Q_add_motion');
        args.push(time);
        if (mm > 0) {
            args.push(speed);
            args.push(speed);
        } else {
            args.push(speed * -1);
            args.push(speed * -1);
        }

        // Send request
        this.requestSend(args, 2, () => {
            // Set message to look for in event "message" and execute callback (next block) when received
            this.eventCompleteCallback = eventData => {
                if (eventData[0].match(/^Q_motion_noneleft/)) {
                    callback();
                }
            };
        });
    }
    turn (angle, callback) {
        angle = parseInt(angle, 10);
        let speed;
        let time;
        if (Math.abs(angle) > 90) {
            speed = 65 * 32 / 10;
            time = Math.abs(angle) * 1.3;
        } else {
            speed = 43 * 32 / 10;
            time = Math.abs(angle) * 2.0;
            time = angle * angle * 2.0 / ((Math.abs(angle) * 1.016) - 0.52); // nonlinear correction
        }

        const args = Array();
        args.push('Q_add_motion');
        args.push(time);
        args.push((angle > 0) ? speed : speed * -1);
        args.push((angle > 0) ? speed * -1 : speed);


        // Send request
        this.requestSend(args, 2, () => {
            // Set message to look for in event "message" and execute callback (next block) when received
            this.eventCompleteCallback = eventData => {
                if (eventData[0].match(/^Q_motion_noneleft/)) {
                    callback();
                }
            };
        });
    }
    turnWithSpeed (angle, speed, callback) {
        angle = parseInt(angle, 10) * 0.78;
        speed = parseInt(Math.abs(speed), 10);
        speed = parseInt(clamp(speed, Thymio.VMIN * 10 / 32, Thymio.VMAX * 10 / 32), 10);

        if (angle === 0) {
            const args = Array();
            args.push(speed * 32 / 10); // speed=10mm/s

            this.sendAction('M_motor_left', args, () => {
                args[0] = -args[0];
                this.sendAction('M_motor_right', args, callback);
            });
        } else {
            const time = Math.abs(angle) * 100 / speed; // time measured in 100 Hz ticks
            speed = speed * 32 / 10;

            const args = Array();
            args.push('Q_add_motion');
            args.push(time);

            if (angle > 0) {
                args.push(speed);
                args.push(speed * -1);
            } else {
                args.push(speed * -1);
                args.push(speed);
            }

            this.requestSend(args, 2, () => {
                // Set message to look for in event "message" and execute callback (next block) when received
                this.eventCompleteCallback = eventData => {
                    if (eventData[0].match(/^Q_motion_noneleft/)) {
                        callback();
                    }
                };
            });
        }
    }
    turnWithTime (angle, time, callback) {
        angle = parseInt(angle, 10) * 0.78;
        time = parseInt(Math.abs(time), 10);

        let speed = Math.abs(angle) / time; // time measured in 100 Hz ticks
        speed = speed * 32 / 10;

        const args = Array();
        args.push('Q_add_motion');
        args.push(time * 100);

        if (angle > 0) {
            args.push(speed);
            args.push(speed * -1);
        } else {
            args.push(speed * -1);
            args.push(speed);
        }

        this.requestSend(args, 2, () => {
            // Set message to look for in event "message" and execute callback (next block) when received
            this.eventCompleteCallback = eventData => {
                if (eventData[0].match(/^Q_motion_noneleft/)) {
                    callback();
                }
            };
        });
    }
    /**
     * Returns the value returned by a given position sensor.
     * @param {number} sensor - 0 to 6 (front 0 to 4, back 6 or 7)
     * @returns {number} value returned by a given position sensor.
     */
    getProximity (sensor) {
        log.info(`Thymio called proximity ${sensor}`);

        sensor = parseInt(sensor, 10);
        if (sensor >= 0 && sensor <= 6) {
            return parseInt(this.cachedValues[17 + sensor], 10);
        }

        return 0;
    }
    /**
     * @param {number} sensor - 0 for the left, 1 for the right
     * @returns {number} value returned by a given position sensor.
     */
    ground (sensor) {
        sensor = parseInt(sensor, 10);
        if (sensor === 0 || sensor === 1) {
            return parseInt(this.cachedValues[15 + sensor], 10);
        }
        return 0;
    }
    /**
     * @param {string} sensor - (front, back, ground)
     * @returns {number} Distance from an obstacle calculated from the given sensors
     */
    distance (sensor) {
        const num = parseInt(this.cachedValues[5], 10);

        if (sensor === 'front') {
            const front = num & 0xff;
            return clamp(front, 0, 190);
        } else if (sensor === 'back') {
            const back = ((num >> 8) & 0xff);
            return clamp(back, 0, 125);
        }
        const ground = parseInt(this.cachedValues[15], 10) + parseInt(this.cachedValues[16], 10);
        if (ground > 1000) {
            return 0;
        }
        return 500;
    }
    /**
     * @param {string} sensor - (front, back, ground)
     * @returns {number} Angle under which an obstacle is seen from the robot,
     * calculated from the horizontal sensors of an obstacle.
     */
    angle (sensor) {
        if (sensor === 'front') {
            return parseInt(this.cachedValues[4], 10);
        }
        const num = parseInt(this.cachedValues[3], 10);
        const back = (num % 256) - 90;
        const ground = ((num >> 8) % 256) - 90;

        if (sensor === 'back') {
            return back;
        }
        return ground;
    }
    touching (sensor) {
        if (sensor === 'front') {
            let value = 0;
            for (let i = 0; i < 5; i++) {
                value = value + parseInt(this.cachedValues[17 + i], 10);
            }
            if (value / 1000 > 0) {
                return true;
            }
            return false;
        } else if (sensor === 'back') {
            const value = parseInt(this.cachedValues[22], 10) + parseInt(this.cachedValues[23], 10);
            if (value / 1000 > 0) {
                return true;
            }
            return false;
        }
        const value = parseInt(this.cachedValues[15], 10) + parseInt(this.cachedValues[16], 10);
        if (value > 50) {
            return true;
        }
        return false;
    }
    touchingThreshold (sensor, threshold) {
        let limit = 0;
		if (threshold === 'far')
			limit=1000;
		else
			limit=3000;
		if (sensor === 'front') {
                if (parseInt(this.cachedValues[19], 10) > limit) {
                    return true;
                }
			return false;	
            }
		else if (sensor === 'left') {
			if (parseInt(this.cachedValues[17], 10) > limit || parseInt(this.cachedValues[18], 10) > limit) {
                    return true;
				}
				return false;			
		}
		else if (sensor === 'right') {
            if (parseInt(this.cachedValues[20], 10) > limit || parseInt(this.cachedValues[21], 10) > limit) {
                return true;
			}
			return false;			
		}
		else if (sensor === 'back') {
            if (parseInt(this.cachedValues[22], 10) > limit || parseInt(this.cachedValues[23], 10) > limit) {
                return true;
            }
            return false;
        }
		if (threshold === 'far')
			limit=50;
		else
			limit=600;
        if (parseInt(this.cachedValues[15], 10) > limit || parseInt(this.cachedValues[16], 10) > limit) {
            return true;
        }
        return false;
    }
    leds (led, r, g, b) {
        const args = [
            parseInt(clamp(r, Thymio.LMIN, Thymio.LMAX), 10),
            parseInt(clamp(g, Thymio.LMIN, Thymio.LMAX), 10),
            parseInt(clamp(b, Thymio.LMIN, Thymio.LMAX), 10)
        ];

        if (led === 'all') {
            this.sendAction('V_leds_top', args);
            args.unshift(0);
            this.sendAction('V_leds_bottom', args);
            args[0] = 1;
            this.sendAction('V_leds_bottom', args);
        } else if (led === 'top') {
            this.sendAction('V_leds_top', args);
        } else if (led === 'bottom') {
            args.unshift(0);
            this.sendAction('V_leds_bottom', args);
            args[0] = 1;
            this.sendAction('V_leds_bottom', args);
        } else if (led === 'bottom-left') {
            args.unshift(0);
            this.sendAction('V_leds_bottom', args);
        } else if (led === 'bottom-right') {
            args.unshift(1);
            this.sendAction('V_leds_bottom', args);
        }
    }
    setLeds (led, color) {
        color = parseInt(color, 10) % 198;
        let mask;
        if (led === 'all') {
            mask = 7;
        } else if (led === 'top') {
            mask = 1;
        } else if (led === 'bottom') {
            mask = 6;
        } else if (led === 'bottom-left') {
            mask = 2;
        } else if (led === 'bottom-right') {
            mask = 4;
        } else {
            mask = 7;
        }

        const rgb = makeLedsRGBVector(color); // by default, "V_leds_top"

        if (mask === 1) {
            this.sendAction('V_leds_top', rgb, () => {
                this._leds[0] = color;
            });
        } else if (mask === 2) {
            rgb.unshift(0);
            this.sendAction('V_leds_bottom', rgb, () => {
                this._leds[1] = color;
            });
        } else if (mask === 4) {
            rgb.unshift(1);
            this.sendAction('V_leds_bottom', rgb, () => {
                this._leds[2] = color;
            });
        } else if (mask === 6) {
            rgb.unshift(0);
            this.sendAction('V_leds_bottom', rgb, () => {
                this._leds[1] = color;
                rgb[0] = 1;
                this.sendAction('V_leds_bottom', rgb, () => {
                    this._leds[2] = color;
                });
            });
        } else {
            this.sendAction('V_leds_top', rgb, () => {
                this._leds[0] = color;
                rgb.unshift(0);
                this.sendAction('V_leds_bottom', rgb, () => {
                    this._leds[1] = color;
                    rgb[0] = 1;
                    this.sendAction('V_leds_bottom', rgb, () => {
                        this._leds[2] = color;
                    });
                });
            });
        }
    }
    changeLeds (led, color) {
        let mask;
        if (led === 'all') {
            mask = 7;
        } else if (led === 'top') {
            mask = 1;
        } else if (led === 'bottom') {
            mask = 6;
        } else if (led === 'bottom-left') {
            mask = 2;
        } else if (led === 'bottom-right') {
            mask = 4;
        } else {
            mask = 7;
        }

        if (mask === 1) {
            const rgb = makeLedsRGBVector((parseInt(color + this._leds[0], 10) % 198));
            this.sendAction('V_leds_top', rgb, () => {
                this._leds[0] = color + this._leds[0];
            });
        } else if (mask === 2) {
            const rgb = makeLedsRGBVector((parseInt(color + this._leds[1], 10) % 198));
            rgb.unshift(0);
            this.sendAction('V_leds_bottom', rgb, () => {
                this._leds[1] = color + this._leds[1];
            });
        } else if (mask === 4) {
            const rgb = makeLedsRGBVector((parseInt(color + this._leds[2], 10) % 198));
            rgb.unshift(1);
            this.sendAction('V_leds_bottom', rgb, () => {
                this._leds[2] = color + this._leds[2];
            });
        } else if (mask === 6) {
            let rgb = makeLedsRGBVector((parseInt(color + this._leds[1], 10) % 198));
            rgb.unshift(0);
            this.sendAction('V_leds_bottom', rgb, () => {
                this._leds[1] = color + this._leds[1];
                rgb = makeLedsRGBVector((parseInt(color + this._leds[2], 10) % 198));
                rgb.unshift(1);
                this.sendAction('V_leds_bottom', rgb, () => {
                    this._leds[2] = color + this._leds[2];
                });
            });
        } else {
            let rgb = makeLedsRGBVector((parseInt(color + this._leds[0], 10) % 198));
            this.sendAction('V_leds_top', rgb, () => {
                this._leds[0] = color + this._leds[0];
                rgb = makeLedsRGBVector((parseInt(color + this._leds[1], 10) % 198));
                rgb.unshift(0);
                this.sendAction('V_leds_bottom', rgb, () => {
                    this._leds[1] = color + this._leds[1];
                    rgb = makeLedsRGBVector((parseInt(color + this._leds[2], 10) % 198));
                    rgb.unshift(1);
                    this.sendAction('V_leds_bottom', rgb, () => {
                        this._leds[2] = color + this._leds[2];
                    });
                });
            });
        }
    }
    clearLeds () {
        this.sendAction('V_leds_circle', [0, 0, 0, 0, 0, 0, 0, 0], () => {
            this.sendAction('V_leds_top', [0, 0, 0], () => {
                this.sendAction('V_leds_bottom', [0, 0, 0, 0], () => {
                    this.sendAction('V_leds_bottom', [1, 0, 0, 0], () => {});
                });
            });
        });
    }
    arc (radius, angle, callback) {
        angle = parseInt(angle, 10);
        radius = parseInt(radius, 10);

        if (Math.abs(radius) < 100) {
            radius = (radius < 0) ? -100 : 100; // although actually, we should just call scratch_turn
        }

        const ratio = (Math.abs(radius) - 95) * 10000 / Math.abs(radius);
        const time = (angle * ((50.36 * radius) + 25)) / 3600;

        let vOut = 400;
        let vIn = vOut * ratio / 10000;

        if (radius < 0) {
            vIn = -vIn;
            vOut = -vOut;
        }

        const args = Array();
        args.push('Q_add_motion');
        args.push(time);
        args.push((angle > 0) ? vOut : vIn);
        args.push((angle > 0) ? vIn : vOut);

        this.requestSend(args, 2, () => {
            // Set message to look for in event "message" and execute callback (next block) when received
            this.eventCompleteCallback = eventData => {
                if (eventData[0].match(/^Q_motion_noneleft/)) {
                    callback();
                }
            };
        });
    }
    soundSystem (sound) {
        this.sendAction('A_sound_system', [parseInt(sound, 10)]);
    }
    soundFreq (freq, duration) {
        this.sendAction('A_sound_freq', [parseInt(freq, 10), parseFloat(duration) * 60]);
    }
    soundPlaySd (sound) {
        this.sendAction('A_sound_play', [parseInt(sound, 10)]);
    }
    soundRecord (sound) {
        this.sendAction('A_sound_record', [parseInt(sound, 10)]);
    }
    soundReplay (sound) {
        this.sendAction('A_sound_replay', [parseInt(sound, 10)]);
    }
    /**
     * @returns {string} values of the 7 proximity sensors.
     */
    getProximityHorizontal () {
        let value = this.cachedValues[17];

        for (let i = 1; i < 7; i++) {
            value = `${value} ${this.cachedValues[(17 + i)]}`;
        }

        return value;
    }
    micIntensity () {
        const num = parseInt(this.cachedValues[2], 10);
        const intensity = parseInt(((num >> 8) % 8), 10);
        return intensity;
    }
    soundDetected () {
        const num = parseInt(this.cachedValues[2], 10);
        const intensity = parseInt(((num >> 8) % 8), 10);

        if (intensity > 2) {
            return true;
        }
        return false;
    }
    bump (value) {
        value = parseInt(value, 10);
        const num = this.cachedValues[1];
        const acc0 = (((num >> 10) % 32) - 16) * 2;
        const acc1 = (((num >> 5) % 32) - 16) * 2;
        const acc2 = ((num % 32) - 16) * 2;
        const ave = (acc0 + acc1 + acc2) / 3;
        if (parseInt(ave, 10) > value) {
            return true;
        }
        return false;
    }
    tilt (menu) {
        const num = this.cachedValues[1];
        if (menu === 'left-right') {
            return (((num >> 10) % 32) - 16) * 2;
        } else if (menu === 'front-back') {
            return (((num >> 5) % 32) - 16) * 2;
        } else if (menu === 'top-bottom') {
            return ((num % 32) - 16) * 2;
        }
        return 0;
    }
    setOdomoter (theta, x, y) {
        this.sendAction('Q_set_odometer', [parseInt(theta, 10), parseInt(x, 10), parseInt(y, 10)]);
    }
    odometer (odo) {
        if (odo === 'direction') {
            return parseInt(this.cachedValues[10], 10);
        } else if (odo === 'x') {
            return parseInt(this.cachedValues[11] / 28, 10);
        } else if (odo === 'y') {
            return parseInt(this.cachedValues[12] / 28, 10);
        }
    }
    motor (motor) {
        if (motor === 'left') {
            return parseInt(this.cachedValues[8], 10);
        } else if (motor === 'right') {
            return parseInt(this.cachedValues[9], 10);
        }
    }
    nextDial (dir) {
        if (this._dial === -1) {
            this._dial = 0;
        } else if (dir === 'left') {
            this._dial = (this._dial + 1) % 8;
        } else {
            this._dial = (8 + (this._dial - 1)) % 8;
        }
        const args = [0, 0, 0, 0, 0, 0, 0, 0];
        args[this._dial] = 32;
        this.sendAction('V_leds_circle', args);
    }
    ledsCircle (l0, l1, l2, l3, l4, l5, l6, l7) {
        const args = [
            parseInt(clamp(l0, Thymio.LMIN, Thymio.LMAX), 10),
            parseInt(clamp(l1, Thymio.LMIN, Thymio.LMAX), 10),
            parseInt(clamp(l2, Thymio.LMIN, Thymio.LMAX), 10),
            parseInt(clamp(l3, Thymio.LMIN, Thymio.LMAX), 10),
            parseInt(clamp(l4, Thymio.LMIN, Thymio.LMAX), 10),
            parseInt(clamp(l5, Thymio.LMIN, Thymio.LMAX), 10),
            parseInt(clamp(l6, Thymio.LMIN, Thymio.LMAX), 10),
            parseInt(clamp(l7, Thymio.LMIN, Thymio.LMAX), 10)
        ];

        this.sendAction('V_leds_circle', args);
    }
    ledsProxH (fl, flm, flc, frc, frm, fr, br, bl) {
        const args = [
            parseInt(clamp(fl, Thymio.LMIN, Thymio.LMAX), 10),
            parseInt(clamp(flm, Thymio.LMIN, Thymio.LMAX), 10),
            parseInt(clamp(flc, Thymio.LMIN, Thymio.LMAX), 10),
            parseInt(clamp(frc, Thymio.LMIN, Thymio.LMAX), 10),
            parseInt(clamp(frm, Thymio.LMIN, Thymio.LMAX), 10),
            parseInt(clamp(fr, Thymio.LMIN, Thymio.LMAX), 10),
            parseInt(clamp(br, Thymio.LMIN, Thymio.LMAX), 10),
            parseInt(clamp(bl, Thymio.LMIN, Thymio.LMAX), 10)
        ];

        this.sendAction('V_leds_prox_h', args);
    }
    ledsProxV (left, right) {
        const args = [
            parseInt(clamp(left, Thymio.LMIN, Thymio.LMAX), 10),
            parseInt(clamp(right, Thymio.LMIN, Thymio.LMAX), 10)
        ];
        this.sendAction('V_leds_prox_v', args);
    }
    ledsButtons (forward, right, backward, left) {
        const args = [
            parseInt(clamp(forward, Thymio.LMIN, Thymio.LMAX), 10),
            parseInt(clamp(right, Thymio.LMIN, Thymio.LMAX), 10),
            parseInt(clamp(backward, Thymio.LMIN, Thymio.LMAX), 10),
            parseInt(clamp(left, Thymio.LMIN, Thymio.LMAX), 10)
        ];
        this.sendAction('V_leds_buttons', args);
    }
    ledsTemperature (hot, cold) {
        const args = [
            parseInt(clamp(hot, Thymio.LMIN, Thymio.LMAX), 10),
            parseInt(clamp(cold, Thymio.LMIN, Thymio.LMAX), 10)
        ];

        this.sendAction('V_leds_temperature', args);
    }
    ledsRc (value) {
        this.sendAction('V_leds_rc', [parseInt(clamp(value, Thymio.LMIN, Thymio.LMAX), 10)]);
    }
    ledsSound (value) {
        this.sendAction('V_leds_sound', [parseInt(clamp(value, Thymio.LMIN, Thymio.LMAX), 10)]);
    }
    emit (value) {
        value = parseInt(value, 10);
        this.sendAction('prox.comm.tx', [value]);
    }
    receive () {
        return parseInt(this.cachedValues[13], 10);
    }
    whenButton (button) {
        const num = parseInt(this.cachedValues[2], 10);

        if (button === 'center') {
            const center = parseInt((num >> 3) & 1, 10);
            if (center === 1) {
                return true;
            }
            return false;
        } else if (button === 'front') {
            const forward = parseInt((num >> 2) & 1, 10);
            if (forward === 1) {
                return true;
            }
            return false;
        } else if (button === 'back') {
            const backward = parseInt((num >> 4) & 1, 10);
            if (backward === 1) {
                return true;
            }
            return false;
        } else if (button === 'left') {
            const left = parseInt((num >> 1) & 1, 10);
            if (left === 1) {
                return true;
            }
            return false;
        } else if (button === 'right') {
            const right = parseInt((num) & 1, 10);
            if (right === 1) {
                return true;
            }
            return false;
        }
    }
}

/**
 * Scratch 3.0 blocks to interact with a Thymio-II robot.
 */
class Scratch3ThymioBlocks {
    /**
     * Construct a set of Thymio blocks.
     * @param {Runtime} runtime - the Scratch 3.0 runtime.
     */
    constructor (runtime) {
        /**
         * The Scratch 3.0 runtime.
         * @type {Runtime}
         */
        this.runtime = runtime;

        this.thymio = new Thymio();
    }
    /**
     * @returns {object} metadata for this extension and its blocks.
     */
    getInfo () {
        return {
            id: 'thymio',
            name: 'Thymio',
            blockIconURI: blockIconURI,
            blocks: [
                {
                    opcode: 'setMotor',
                    text: 'motor [M] [N]',
                    blockType: BlockType.COMMAND,
                    arguments: {
                        M: {
                            type: ArgumentType.STRING,
                            menu: 'leftrightall',
                            defaultValue: 'left'
                        },
                        N: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 50
                        }
                    }
                },
                {
                    opcode: 'stopMotors',
                    text: 'stop motors',
                    blockType: BlockType.COMMAND
                },
                {
                    opcode: 'move',
                    text: 'move [N]',
                    blockType: BlockType.COMMAND,
                    arguments: {
                        N: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 50
                        }
                    }
                },
                {
                    opcode: 'moveWithSpeed',
                    text: 'move [N] with speed [S]',
                    blockType: BlockType.COMMAND,
                    arguments: {
                        N: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 50
                        },
                        S: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 50
                        }
                    }
                },
                {
                    opcode: 'moveWithTime',
                    text: 'move [N] in [S]s',
                    blockType: BlockType.COMMAND,
                    arguments: {
                        N: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 50
                        },
                        S: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 1
                        }
                    }
                },
                {
                    opcode: 'turn',
                    text: 'turn [N]',
                    blockType: BlockType.COMMAND,
                    arguments: {
                        N: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 45
                        }
                    }
                },
                {
                    opcode: 'turnWithSpeed',
                    text: 'turn [N] with speed [S]',
                    blockType: BlockType.COMMAND,
                    arguments: {
                        N: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 90
                        },
                        S: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 50
                        }
                    }
                },
                {
                    opcode: 'turnWithTime',
                    text: 'turn [N] in [S]s',
                    blockType: BlockType.COMMAND,
                    arguments: {
                        N: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 90
                        },
                        S: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 1
                        }
                    }
                },
                {
                    opcode: 'proximity',
                    text: 'proximity sensor [N]',
                    blockType: BlockType.REPORTER,
                    arguments: {
                        N: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 2
                        }
                    }
                },
                {
                    opcode: 'ground',
                    text: 'ground sensor [N]',
                    blockType: BlockType.REPORTER,
                    arguments: {
                        N: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 0
                        }
                    }
                },
                {
                    opcode: 'distance',
                    text: 'distance [S]',
                    blockType: BlockType.REPORTER,
                    arguments: {
                        S: {
                            type: ArgumentType.STRING,
                            menu: 'sensors',
                            defaultValue: 'front'
                        }
                    }
                },
                {
                    opcode: 'angle',
                    text: 'angle [S]',
                    blockType: BlockType.REPORTER,
                    arguments: {
                        S: {
                            type: ArgumentType.STRING,
                            menu: 'angles',
                            defaultValue: 'front'
                        }
                    }
                },
                {
                    opcode: 'touching',
                    text: 'object detected [S]',
                    blockType: BlockType.HAT,
                    arguments: {
                        S: {
                            type: ArgumentType.STRING,
                            menu: 'sensors',
                            defaultValue: 'front'
                        }
                    }
                },
                {
                    opcode: 'touchingThreshold',
                    text: 'object detected [S] [N]',
                    blockType: BlockType.HAT,
                    arguments: {
                        S: {
                            type: ArgumentType.STRING,
                            menu: 'sensors2',
                            defaultValue: 'front'
                        },
                        N: {
                            type: ArgumentType.STRING,
							menu: 'nearfar',
							defaultValue: 'near'
                        }
                    }
                },
                {
                    opcode: 'leds',
                    text: 'leds RGB [L] [R] [G] [B]',
                    blockType: BlockType.COMMAND,
                    arguments: {
                        L: {
                            type: ArgumentType.STRING,
                            menu: 'light',
                            defaultValue: 'all'
                        },
                        R: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 32
                        },
                        G: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 0
                        },
                        B: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 0
                        }
                    }
                },
                {
                    opcode: 'setLeds',
                    text: 'leds set color [C] on [L]',
                    blockType: BlockType.COMMAND,
                    arguments: {
                        L: {
                            type: ArgumentType.STRING,
                            menu: 'light',
                            defaultValue: 'all'
                        },
                        C: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 0
                        }
                    }
                },
                {
                    opcode: 'changeLeds',
                    text: 'leds change color [C] on [L]',
                    blockType: BlockType.COMMAND,
                    arguments: {
                        L: {
                            type: ArgumentType.STRING,
                            menu: 'light',
                            defaultValue: 'all'
                        },
                        C: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 33
                        }
                    }
                },
                {
                    opcode: 'clearLeds',
                    text: 'leds clear',
                    blockType: BlockType.COMMAND
                },
                {
                    opcode: 'arc',
                    text: 'circle radius [R] angle [A]',
                    blockType: BlockType.COMMAND,
                    arguments: {
                        R: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 150
                        },
                        A: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 45
                        }
                    }
                },
                {
                    opcode: 'soundSystem',
                    text: 'play system sound [S]',
                    blockType: BlockType.COMMAND,
                    arguments: {
                        S: {
                            type: ArgumentType.STRING,
                            menu: 'sounds',
                            defaultValue: 1
                        }
                    }
                },
                {
                    opcode: 'soundFreq',
                    text: 'play note [N] during [S]s',
                    blockType: BlockType.COMMAND,
                    arguments: {
                        N: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 440
                        },
                        S: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 1
                        }
                    }
                },
                {
                    opcode: 'soundPlaySd',
                    text: 'play sound SD [N]',
                    blockType: BlockType.COMMAND,
                    arguments: {
                        N: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 0
                        }
                    }
                },
                {
                    opcode: 'soundRecord',
                    text: 'record sound [N]',
                    blockType: BlockType.COMMAND,
                    arguments: {
                        N: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 0
                        }
                    }
                },
                {
                    opcode: 'soundReplay',
                    text: 'replay sound [N]',
                    blockType: BlockType.COMMAND,
                    arguments: {
                        N: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 0
                        }
                    }
                },
                {
                    opcode: 'proxHorizontal',
                    text: 'proximity sensors',
                    blockType: BlockType.REPORTER
                },
                {
                    opcode: 'proxGroundDelta',
                    text: 'ground sensors',
                    blockType: BlockType.REPORTER 
                },
                {
                    opcode: 'micIntensity',
                    text: 'sound level',
                    blockType: BlockType.REPORTER
                },
                {
                    opcode: 'soundDetected',
                    text: 'sound detected',
                    blockType: BlockType.HAT
                },
                {
                    opcode: 'bump',
                    text: 'tap [N]',
                    blockType: BlockType.HAT,
                    arguments: {
                        N: {
                            type: ArgumentType.NUMBER,
							defaultValue: 8
                        }
                    }
                },
                {
                    opcode: 'tilt',
                    text: 'tilt on [T]',
                    blockType: BlockType.REPORTER,
                    arguments: {
                        T: {
                            type: ArgumentType.STRING,
                            menu: 'tilts',
                            defaultValue: 'front-back'
                        }
                    }
                },
                {
                    opcode: 'setOdomoter',
                    text: 'set odometer [N] [O] [P]',
                    blockType: BlockType.COMMAND,
                    arguments: {
                        N: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 90
                        },
                        O: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 0
                        },
                        P: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 0
                        }
                    }
                },
                {
                    opcode: 'odometer',
                    text: 'odometer [O]',
                    blockType: BlockType.REPORTER,
                    arguments: {
                        O: {
                            type: ArgumentType.STRING,
                            menu: 'odo',
                            defaultValue: 'direction'
                        }
                    }
                },
                {
                    opcode: 'motor',
                    text: 'measure motor [M]',
                    blockType: BlockType.REPORTER,
                    arguments: {
                        M: {
                            type: ArgumentType.STRING,
                            menu: 'leftright',
                            defaultValue: 'left'
                        }
                    }
                },
                {
                    opcode: 'nextDial',
                    text: 'leds next dial [L]',
                    blockType: BlockType.COMMAND,
                    arguments: {
                        L: {
                            type: ArgumentType.STRING,
                            menu: 'leftright',
                            defaultValue: 'left'
                        }
                    }
                },
                {
                    opcode: 'ledsCircle',
                    text: 'leds dial all [A] [B] [C] [D] [E] [F] [G] [H]',
                    blockType: BlockType.COMMAND,
                    arguments: {
                        A: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 0
                        },
                        B: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 8
                        },
                        C: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 16
                        },
                        D: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 32
                        },
                        E: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 0
                        },
                        F: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 8
                        },
                        G: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 16
                        },
                        H: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 32
                        }
                    }
                },
                {
                    opcode: 'ledsProxH',
                    text: 'leds sensors h [A] [B] [C] [D] [E] [F] [G] [H]',
                    blockType: BlockType.COMMAND,
                    arguments: {
                        A: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 0
                        },
                        B: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 8
                        },
                        C: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 16
                        },
                        D: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 32
                        },
                        E: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 0
                        },
                        F: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 8
                        },
                        G: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 16
                        },
                        H: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 32
                        }
                    }
                },
                {
                    opcode: 'ledsProxV',
                    text: 'leds sensors v [A] [B]',
                    blockType: BlockType.COMMAND,
                    arguments: {
                        A: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 32
                        },
                        B: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 32
                        }
                    }
                },
                {
                    opcode: 'ledsButtons',
                    text: 'leds buttons [A] [B] [C] [D]',
                    blockType: BlockType.COMMAND,
                    arguments: {
                        A: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 16
                        },
                        B: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 32
                        },
                        C: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 16
                        },
                        D: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 32
                        }
                    }
                },
                {
                    opcode: 'ledsTemperature',
                    text: 'leds temperature [A] [B]',
                    blockType: BlockType.COMMAND,
                    arguments: {
                        A: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 32
                        },
                        B: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 8
                        }
                    }
                },
                {
                    opcode: 'ledsRc',
                    text: 'leds rc [A]',
                    blockType: BlockType.COMMAND,
                    arguments: {
                        A: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 16
                        }
                    }
                },
                {
                    opcode: 'ledsSound',
                    text: 'leds sound [A]',
                    blockType: BlockType.COMMAND,
                    arguments: {
                        A: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 32
                        }
                    }
                },
                {
                    opcode: 'emit',
                    text: 'emit [N]',
                    blockType: BlockType.REPORTER,
                    arguments: {
                        N: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 1
                        }
                    }
                },
                {
                    opcode: 'receive',
                    text: 'receive',
                    blockType: BlockType.REPORTER
                },
                {
                    opcode: 'whenButton',
                    text: 'when button [B]',
                    blockType: BlockType.HAT,
                    arguments: {
                        B: {
                            type: ArgumentType.STRING,
                            menu: 'buttons',
                            defaultValue: 'center'
                        }
                    }
                }
            ],
            menus: {
                leftrightall: ['left', 'right', 'all'],
                leftright: ['left', 'right'],
                sensors: ['front', 'back', 'ground'],
				sensors2: ['left', 'front', 'right', 'back', 'ground'],
                proxsensors: [
                    {text: 'front far left', value: 0},
                    {text: 'front left', value: 1},
                    {text: 'front center', value: 2},
                    {text: 'front right', value: 3},
                    {text: 'front far right', value: 4},
                    {text: 'back left', value: 5},
                    {text: 'back right', value: 6}
                ],
                light: ['all', 'top', 'bottom', 'bottom-left', 'bottom-right'],
                angles: ['front', 'back', 'ground'],
                sounds: ['0', '1', '2', '3', '4', '5', '6', '7'],
                odo: ['direction', 'x', 'y'],
                tilts: ['front-back', 'top-bottom', 'left-right'],
                buttons: ['center', 'front', 'back', 'left', 'right'],
				nearfar: ['near', 'far']
            }
        };
    }
    /**
     * Check if the stack timer needs initialization.
     * @param {object} util - utility object provided by the runtime.
     * @return {boolean} - true if the stack timer needs to be initialized.
     * @private
     */
    _stackTimerNeedsInit (util) {
        return !util.stackFrame.timer;
    }

    /**
     * Start the stack timer and the yield the thread if necessary.
     * @param {object} util - utility object provided by the runtime.
     * @param {number} duration - a duration in seconds to set the timer for.
     * @private
     */
    _startStackTimer (util, duration) {
        this._running = true;

        util.stackFrame.timer = new Timer();
        util.stackFrame.timer.start();
        util.stackFrame.duration = duration;
        util.yield();
    }

    /**
     * Check the stack timer, and if its time is not up yet, yield the thread.
     * @param {object} util - utility object provided by the runtime.
     * @private
     */
    _checkStackTimer (util) {
        const timeElapsed = util.stackFrame.timer.timeElapsed();
        if (this._running && timeElapsed < util.stackFrame.duration * 1000) {
            util.yield();
        }
    }
    _stopStackTimer () {
        this._running = false;
    }
    /**
     * Run the left/right/all motors.
     * @param {object} args - the block's arguments.
     * @property {M} string - Item of menu 'leftrightall'.
     * @property {N} value - Speed in Aseba unities.
     */
    setMotor (args) {
        this.thymio.setMotor(args.M, Cast.toNumber(args.N));
    }
    /**
     * Stop all motors.
     */
    stopMotors () {
        this.thymio.stopMotors();
    }
    move (args, util) {
        if (this._stackTimerNeedsInit(util)) {
            this.thymio.move(Cast.toNumber(args.N), () => this._stopStackTimer());
            this._startStackTimer(util, 1000000);
        } else {
            this._checkStackTimer(util);
        }
    }
    moveWithSpeed (args, util) {
        if (this._stackTimerNeedsInit(util)) {
            this.thymio.moveWithSpeed(
                Cast.toNumber(args.N),
                Cast.toNumber(args.S),
                () => this._stopStackTimer()
            );
            this._startStackTimer(util, 1000000);
        } else {
            this._checkStackTimer(util);
        }
    }
    moveWithTime (args, util) {
        if (this._stackTimerNeedsInit(util)) {
            this.thymio.moveWithTime(
                Cast.toNumber(args.N),
                Cast.toNumber(args.S),
                () => this._stopStackTimer()
            );
            this._startStackTimer(util, 1000000);
        } else {
            this._checkStackTimer(util);
        }
    }
    turn (args, util) {
        if (this._stackTimerNeedsInit(util)) {
            this.thymio.turn(
                Cast.toNumber(args.N),
                () => this._stopStackTimer()
            );
            this._startStackTimer(util, 1000000);
        } else {
            this._checkStackTimer(util);
        }
    }
    turnWithSpeed (args, util) {
        if (this._stackTimerNeedsInit(util)) {
            this.thymio.turnWithSpeed(
                Cast.toNumber(args.N),
                Cast.toNumber(args.S),
                () => this._stopStackTimer()
            );
            this._startStackTimer(util, 1000000);
        } else {
            this._checkStackTimer(util);
        }
    }
    turnWithTime (args, util) {
        if (this._stackTimerNeedsInit(util)) {
            this.thymio.turnWithTime(
                Cast.toNumber(args.N),
                Cast.toNumber(args.S),
                () => this._stopStackTimer()
            );
            this._startStackTimer(util, 1000000);
        } else {
            this._checkStackTimer(util);
        }
    }
    /**
     * Proximity sensor
     * @param {object} args - the block's arguments.
     * @property {N} number - 0 to 6 (front 0 to 4, back 5 or 6)
     * @returns {number} value returned by a given position sensor.
     */
    proximity (args) {
        return this.thymio.getProximity(Cast.toNumber(args.N));
    }
    /**
     * @param {object} args - the block's arguments.
     * @property {number} N - 0 for the left, 1 for the right
     * @returns {number} value returned by a given position sensor.
     */
    ground (args) {
        return this.thymio.ground(Cast.toNumber(args.N));
    }
    /**
     * @param {object} args - the block's arguments.
     * @property {S} string - (front, back, ground)
     * @returns {number} Distance from an obstacle calculated from the given sensors
     */
    distance (args) {
        return this.thymio.distance(args.S);
    }
    /**
     * @param {object} args - the block's arguments.
     * @property {S} string - (front, back, ground)
     * @returns {number} Angle under which an obstacle is seen from the robot,
     * calculated from the horizontal sensors of an obstacle.
     */
    angle (args) {
        return this.thymio.angle(args.S);
    }
    touching (args) {
        return this.thymio.touching(args.S);
    }
    touchingThreshold (args) {
        return this.thymio.touchingThreshold(args.S, args.N);
    }
    leds (args) {
        this.thymio.leds(args.L, args.R, args.G, args.B);
    }
    setLeds (args) {
        this.thymio.setLeds(args.L, args.C);
    }
    changeLeds (args) {
        this.thymio.changeLeds(args.L, args.C);
    }
    clearLeds () {
        this.thymio.clearLeds();
    }
    arc (args, util) {
        if (this._stackTimerNeedsInit(util)) {
            this.thymio.arc(
                Cast.toNumber(args.R),
                Cast.toNumber(args.A),
                () => this._stopStackTimer()
            );
            this._startStackTimer(util, 1000000);
        } else {
            this._checkStackTimer(util);
        }
    }
    soundSystem (args) {
        this.thymio.soundSystem(args.S);
    }
    soundFreq (args) {
        this.thymio.soundFreq(Cast.toNumber(args.N), Cast.toNumber(args.S));
    }
    soundPlaySd (args) {
        this.thymio.soundPlaySd(args.N);
    }
    soundRecord (args) {
        this.thymio.soundRecord(args.N);
    }
    soundReplay (args) {
        this.thymio.soundReplay(args.N);
    }
    /**
     * @returns {string} values of the 7 proximity sensors.
     */
    proxHorizontal () {
        return this.thymio.getProximityHorizontal();
    }
    /**
     * @returns {string} values of the 2 lower sensors.
     */
    proxGroundDelta () {
        const left = this.thymio.ground(0);
        const right = this.thymio.ground(1);
        return `${left} ${right}`;
    }
    micIntensity () {
        return this.thymio.micIntensity();
    }
    soundDetected () {
        return this.thymio.soundDetected();
    }
    bump (args) {
        return this.thymio.bump(Cast.toNumber(args.N));
    }
    tilt (args) {
        return this.thymio.tilt(args.T);
    }
    setOdomoter (args) {
        this.thymio.setOdomoter(Cast.toNumber(args.N), Cast.toNumber(args.O), Cast.toNumber(args.P));
    }
    odometer (args) {
        return this.thymio.odometer(args.O);
    }
    motor (args) {
        return this.thymio.motor(args.M);
    }
    nextDial (args) {
        this.thymio.nextDial(args.L);
    }
    ledsCircle (args) {
        this.thymio.ledsCircle(
            Cast.toNumber(args.A),
            Cast.toNumber(args.B),
            Cast.toNumber(args.C),
            Cast.toNumber(args.D),
            Cast.toNumber(args.E),
            Cast.toNumber(args.F),
            Cast.toNumber(args.G),
            Cast.toNumber(args.H)
        );
    }
    ledsProxH (args) {
        this.thymio.ledsProxH(
            Cast.toNumber(args.A),
            Cast.toNumber(args.B),
            Cast.toNumber(args.C),
            Cast.toNumber(args.D),
            Cast.toNumber(args.E),
            Cast.toNumber(args.F),
            Cast.toNumber(args.G),
            Cast.toNumber(args.H)
        );
    }
    ledsProxV (args) {
        this.thymio.ledsProxV(
            Cast.toNumber(args.A),
            Cast.toNumber(args.B)
        );
    }
    ledsButtons (args) {
        this.thymio.ledsButtons(
            Cast.toNumber(args.A),
            Cast.toNumber(args.B),
            Cast.toNumber(args.C),
            Cast.toNumber(args.D)
        );
    }
    ledsTemperature (args) {
        this.thymio.ledsTemperature(
            Cast.toNumber(args.A),
            Cast.toNumber(args.B)
        );
    }
    ledsRc (args) {
        this.thymio.ledsRc(Cast.toNumber(args.A));
    }
    ledsSound (args) {
        this.thymio.ledsSound(Cast.toNumber(args.A));
    }
    emit (args) {
        this.thymio.emit(Cast.toNumber(args.N));
    }
    receive () {
        return this.thymio.receive();
    }
    whenButton (args) {
        return this.thymio.whenButton(args.B);
    }
}

module.exports = Scratch3ThymioBlocks;
