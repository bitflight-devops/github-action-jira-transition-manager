import * as os from 'os';
import os__default, { EOL } from 'os';
import * as crypto from 'crypto';
import crypto__default from 'crypto';
import * as fs from 'fs';
import fs__default, { promises, existsSync as existsSync$1, readFileSync } from 'fs';
import path$1, { resolve } from 'path';
import http from 'http';
import https from 'https';
import require$$0$9 from 'net';
import require$$1$1 from 'tls';
import events$1, { EventEmitter } from 'events';
import require$$5$5 from 'assert';
import require$$1 from 'util';
import require$$0$2 from 'node:assert';
import require$$0$4 from 'node:net';
import require$$2 from 'node:http';
import require$$0$3 from 'node:stream';
import require$$0$1 from 'node:buffer';
import require$$0$5 from 'node:util';
import require$$7 from 'node:querystring';
import require$$8 from 'node:events';
import require$$0$6 from 'node:diagnostics_channel';
import require$$5 from 'node:tls';
import require$$1$3 from 'node:zlib';
import require$$5$1 from 'node:perf_hooks';
import require$$8$1 from 'node:util/types';
import require$$1$2 from 'node:worker_threads';
import require$$1$4 from 'node:url';
import require$$5$2 from 'node:async_hooks';
import require$$1$5 from 'node:console';
import require$$1$6 from 'node:dns';
import require$$5$3 from 'string_decoder';
import 'child_process';
import 'timers';
import * as fs$1 from 'node:fs';
import require$$0$7 from 'process';
import require$$0$8 from 'buffer';
import stream, { Readable } from 'stream';
import require$$5$4 from 'url';
import require$$1$7 from 'tty';
import http2 from 'http2';
import zlib from 'zlib';
import * as path from 'node:path';

// We use any as a valid input type
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Sanitizes an input into a string so it can be passed into issueCommand safely
 * @param input input to sanitize into a string
 */
function toCommandValue(input) {
    if (input === null || input === undefined) {
        return '';
    }
    else if (typeof input === 'string' || input instanceof String) {
        return input;
    }
    return JSON.stringify(input);
}
/**
 *
 * @param annotationProperties
 * @returns The command properties to send with the actual annotation command
 * See IssueCommandProperties: https://github.com/actions/runner/blob/main/src/Runner.Worker/ActionCommandManager.cs#L646
 */
function toCommandProperties(annotationProperties) {
    if (!Object.keys(annotationProperties).length) {
        return {};
    }
    return {
        title: annotationProperties.title,
        file: annotationProperties.file,
        line: annotationProperties.startLine,
        endLine: annotationProperties.endLine,
        col: annotationProperties.startColumn,
        endColumn: annotationProperties.endColumn
    };
}

/**
 * Issues a command to the GitHub Actions runner
 *
 * @param command - The command name to issue
 * @param properties - Additional properties for the command (key-value pairs)
 * @param message - The message to include with the command
 * @remarks
 * This function outputs a specially formatted string to stdout that the Actions
 * runner interprets as a command. These commands can control workflow behavior,
 * set outputs, create annotations, mask values, and more.
 *
 * Command Format:
 *   ::name key=value,key=value::message
 *
 * @example
 * ```typescript
 * // Issue a warning annotation
 * issueCommand('warning', {}, 'This is a warning message');
 * // Output: ::warning::This is a warning message
 *
 * // Set an environment variable
 * issueCommand('set-env', { name: 'MY_VAR' }, 'some value');
 * // Output: ::set-env name=MY_VAR::some value
 *
 * // Add a secret mask
 * issueCommand('add-mask', {}, 'secretValue123');
 * // Output: ::add-mask::secretValue123
 * ```
 *
 * @internal
 * This is an internal utility function that powers the public API functions
 * such as setSecret, warning, error, and exportVariable.
 */
function issueCommand(command, properties, message) {
    const cmd = new Command(command, properties, message);
    process.stdout.write(cmd.toString() + os.EOL);
}
const CMD_STRING = '::';
class Command {
    constructor(command, properties, message) {
        if (!command) {
            command = 'missing.command';
        }
        this.command = command;
        this.properties = properties;
        this.message = message;
    }
    toString() {
        let cmdStr = CMD_STRING + this.command;
        if (this.properties && Object.keys(this.properties).length > 0) {
            cmdStr += ' ';
            let first = true;
            for (const key in this.properties) {
                if (this.properties.hasOwnProperty(key)) {
                    const val = this.properties[key];
                    if (val) {
                        if (first) {
                            first = false;
                        }
                        else {
                            cmdStr += ',';
                        }
                        cmdStr += `${key}=${escapeProperty(val)}`;
                    }
                }
            }
        }
        cmdStr += `${CMD_STRING}${escapeData(this.message)}`;
        return cmdStr;
    }
}
function escapeData(s) {
    return toCommandValue(s)
        .replace(/%/g, '%25')
        .replace(/\r/g, '%0D')
        .replace(/\n/g, '%0A');
}
function escapeProperty(s) {
    return toCommandValue(s)
        .replace(/%/g, '%25')
        .replace(/\r/g, '%0D')
        .replace(/\n/g, '%0A')
        .replace(/:/g, '%3A')
        .replace(/,/g, '%2C');
}

// For internal use, subject to change.
// We use any as a valid input type
/* eslint-disable @typescript-eslint/no-explicit-any */
function issueFileCommand(command, message) {
    const filePath = process.env[`GITHUB_${command}`];
    if (!filePath) {
        throw new Error(`Unable to find environment variable for file command ${command}`);
    }
    if (!fs.existsSync(filePath)) {
        throw new Error(`Missing file at path: ${filePath}`);
    }
    fs.appendFileSync(filePath, `${toCommandValue(message)}${os.EOL}`, {
        encoding: 'utf8'
    });
}
function prepareKeyValueMessage(key, value) {
    const delimiter = `ghadelimiter_${crypto.randomUUID()}`;
    const convertedValue = toCommandValue(value);
    // These should realistically never happen, but just in case someone finds a
    // way to exploit uuid generation let's not allow keys or values that contain
    // the delimiter.
    if (key.includes(delimiter)) {
        throw new Error(`Unexpected input: name should not contain the delimiter "${delimiter}"`);
    }
    if (convertedValue.includes(delimiter)) {
        throw new Error(`Unexpected input: value should not contain the delimiter "${delimiter}"`);
    }
    return `${key}<<${delimiter}${os.EOL}${convertedValue}${os.EOL}${delimiter}`;
}

var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

function getDefaultExportFromCjs (x) {
	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
}

var tunnel$1 = {};

var hasRequiredTunnel$1;

function requireTunnel$1 () {
	if (hasRequiredTunnel$1) return tunnel$1;
	hasRequiredTunnel$1 = 1;
	var tls = require$$1$1;
	var http$1 = http;
	var https$1 = https;
	var events = events$1;
	var util = require$$1;


	tunnel$1.httpOverHttp = httpOverHttp;
	tunnel$1.httpsOverHttp = httpsOverHttp;
	tunnel$1.httpOverHttps = httpOverHttps;
	tunnel$1.httpsOverHttps = httpsOverHttps;


	function httpOverHttp(options) {
	  var agent = new TunnelingAgent(options);
	  agent.request = http$1.request;
	  return agent;
	}

	function httpsOverHttp(options) {
	  var agent = new TunnelingAgent(options);
	  agent.request = http$1.request;
	  agent.createSocket = createSecureSocket;
	  agent.defaultPort = 443;
	  return agent;
	}

	function httpOverHttps(options) {
	  var agent = new TunnelingAgent(options);
	  agent.request = https$1.request;
	  return agent;
	}

	function httpsOverHttps(options) {
	  var agent = new TunnelingAgent(options);
	  agent.request = https$1.request;
	  agent.createSocket = createSecureSocket;
	  agent.defaultPort = 443;
	  return agent;
	}


	function TunnelingAgent(options) {
	  var self = this;
	  self.options = options || {};
	  self.proxyOptions = self.options.proxy || {};
	  self.maxSockets = self.options.maxSockets || http$1.Agent.defaultMaxSockets;
	  self.requests = [];
	  self.sockets = [];

	  self.on('free', function onFree(socket, host, port, localAddress) {
	    var options = toOptions(host, port, localAddress);
	    for (var i = 0, len = self.requests.length; i < len; ++i) {
	      var pending = self.requests[i];
	      if (pending.host === options.host && pending.port === options.port) {
	        // Detect the request to connect same origin server,
	        // reuse the connection.
	        self.requests.splice(i, 1);
	        pending.request.onSocket(socket);
	        return;
	      }
	    }
	    socket.destroy();
	    self.removeSocket(socket);
	  });
	}
	util.inherits(TunnelingAgent, events.EventEmitter);

	TunnelingAgent.prototype.addRequest = function addRequest(req, host, port, localAddress) {
	  var self = this;
	  var options = mergeOptions({request: req}, self.options, toOptions(host, port, localAddress));

	  if (self.sockets.length >= this.maxSockets) {
	    // We are over limit so we'll add it to the queue.
	    self.requests.push(options);
	    return;
	  }

	  // If we are under maxSockets create a new one.
	  self.createSocket(options, function(socket) {
	    socket.on('free', onFree);
	    socket.on('close', onCloseOrRemove);
	    socket.on('agentRemove', onCloseOrRemove);
	    req.onSocket(socket);

	    function onFree() {
	      self.emit('free', socket, options);
	    }

	    function onCloseOrRemove(err) {
	      self.removeSocket(socket);
	      socket.removeListener('free', onFree);
	      socket.removeListener('close', onCloseOrRemove);
	      socket.removeListener('agentRemove', onCloseOrRemove);
	    }
	  });
	};

	TunnelingAgent.prototype.createSocket = function createSocket(options, cb) {
	  var self = this;
	  var placeholder = {};
	  self.sockets.push(placeholder);

	  var connectOptions = mergeOptions({}, self.proxyOptions, {
	    method: 'CONNECT',
	    path: options.host + ':' + options.port,
	    agent: false,
	    headers: {
	      host: options.host + ':' + options.port
	    }
	  });
	  if (options.localAddress) {
	    connectOptions.localAddress = options.localAddress;
	  }
	  if (connectOptions.proxyAuth) {
	    connectOptions.headers = connectOptions.headers || {};
	    connectOptions.headers['Proxy-Authorization'] = 'Basic ' +
	        new Buffer(connectOptions.proxyAuth).toString('base64');
	  }

	  debug('making CONNECT request');
	  var connectReq = self.request(connectOptions);
	  connectReq.useChunkedEncodingByDefault = false; // for v0.6
	  connectReq.once('response', onResponse); // for v0.6
	  connectReq.once('upgrade', onUpgrade);   // for v0.6
	  connectReq.once('connect', onConnect);   // for v0.7 or later
	  connectReq.once('error', onError);
	  connectReq.end();

	  function onResponse(res) {
	    // Very hacky. This is necessary to avoid http-parser leaks.
	    res.upgrade = true;
	  }

	  function onUpgrade(res, socket, head) {
	    // Hacky.
	    process.nextTick(function() {
	      onConnect(res, socket, head);
	    });
	  }

	  function onConnect(res, socket, head) {
	    connectReq.removeAllListeners();
	    socket.removeAllListeners();

	    if (res.statusCode !== 200) {
	      debug('tunneling socket could not be established, statusCode=%d',
	        res.statusCode);
	      socket.destroy();
	      var error = new Error('tunneling socket could not be established, ' +
	        'statusCode=' + res.statusCode);
	      error.code = 'ECONNRESET';
	      options.request.emit('error', error);
	      self.removeSocket(placeholder);
	      return;
	    }
	    if (head.length > 0) {
	      debug('got illegal response body from proxy');
	      socket.destroy();
	      var error = new Error('got illegal response body from proxy');
	      error.code = 'ECONNRESET';
	      options.request.emit('error', error);
	      self.removeSocket(placeholder);
	      return;
	    }
	    debug('tunneling connection has established');
	    self.sockets[self.sockets.indexOf(placeholder)] = socket;
	    return cb(socket);
	  }

	  function onError(cause) {
	    connectReq.removeAllListeners();

	    debug('tunneling socket could not be established, cause=%s\n',
	          cause.message, cause.stack);
	    var error = new Error('tunneling socket could not be established, ' +
	                          'cause=' + cause.message);
	    error.code = 'ECONNRESET';
	    options.request.emit('error', error);
	    self.removeSocket(placeholder);
	  }
	};

	TunnelingAgent.prototype.removeSocket = function removeSocket(socket) {
	  var pos = this.sockets.indexOf(socket);
	  if (pos === -1) {
	    return;
	  }
	  this.sockets.splice(pos, 1);

	  var pending = this.requests.shift();
	  if (pending) {
	    // If we have pending requests and a socket gets closed a new one
	    // needs to be created to take over in the pool for the one that closed.
	    this.createSocket(pending, function(socket) {
	      pending.request.onSocket(socket);
	    });
	  }
	};

	function createSecureSocket(options, cb) {
	  var self = this;
	  TunnelingAgent.prototype.createSocket.call(self, options, function(socket) {
	    var hostHeader = options.request.getHeader('host');
	    var tlsOptions = mergeOptions({}, self.options, {
	      socket: socket,
	      servername: hostHeader ? hostHeader.replace(/:.*$/, '') : options.host
	    });

	    // 0 is dummy port for v0.6
	    var secureSocket = tls.connect(0, tlsOptions);
	    self.sockets[self.sockets.indexOf(socket)] = secureSocket;
	    cb(secureSocket);
	  });
	}


	function toOptions(host, port, localAddress) {
	  if (typeof host === 'string') { // since v0.10
	    return {
	      host: host,
	      port: port,
	      localAddress: localAddress
	    };
	  }
	  return host; // for v0.11 or later
	}

	function mergeOptions(target) {
	  for (var i = 1, len = arguments.length; i < len; ++i) {
	    var overrides = arguments[i];
	    if (typeof overrides === 'object') {
	      var keys = Object.keys(overrides);
	      for (var j = 0, keyLen = keys.length; j < keyLen; ++j) {
	        var k = keys[j];
	        if (overrides[k] !== undefined) {
	          target[k] = overrides[k];
	        }
	      }
	    }
	  }
	  return target;
	}


	var debug;
	if (process.env.NODE_DEBUG && /\btunnel\b/.test(process.env.NODE_DEBUG)) {
	  debug = function() {
	    var args = Array.prototype.slice.call(arguments);
	    if (typeof args[0] === 'string') {
	      args[0] = 'TUNNEL: ' + args[0];
	    } else {
	      args.unshift('TUNNEL:');
	    }
	    console.error.apply(console, args);
	  };
	} else {
	  debug = function() {};
	}
	tunnel$1.debug = debug; // for test
	return tunnel$1;
}

var tunnel;
var hasRequiredTunnel;

function requireTunnel () {
	if (hasRequiredTunnel) return tunnel;
	hasRequiredTunnel = 1;
	tunnel = requireTunnel$1();
	return tunnel;
}

requireTunnel();

var undici = {};

var symbols$4;
var hasRequiredSymbols$4;

function requireSymbols$4 () {
	if (hasRequiredSymbols$4) return symbols$4;
	hasRequiredSymbols$4 = 1;
	symbols$4 = {
	  kClose: Symbol('close'),
	  kDestroy: Symbol('destroy'),
	  kDispatch: Symbol('dispatch'),
	  kUrl: Symbol('url'),
	  kWriting: Symbol('writing'),
	  kResuming: Symbol('resuming'),
	  kQueue: Symbol('queue'),
	  kConnect: Symbol('connect'),
	  kConnecting: Symbol('connecting'),
	  kKeepAliveDefaultTimeout: Symbol('default keep alive timeout'),
	  kKeepAliveMaxTimeout: Symbol('max keep alive timeout'),
	  kKeepAliveTimeoutThreshold: Symbol('keep alive timeout threshold'),
	  kKeepAliveTimeoutValue: Symbol('keep alive timeout'),
	  kKeepAlive: Symbol('keep alive'),
	  kHeadersTimeout: Symbol('headers timeout'),
	  kBodyTimeout: Symbol('body timeout'),
	  kServerName: Symbol('server name'),
	  kLocalAddress: Symbol('local address'),
	  kHost: Symbol('host'),
	  kNoRef: Symbol('no ref'),
	  kBodyUsed: Symbol('used'),
	  kBody: Symbol('abstracted request body'),
	  kRunning: Symbol('running'),
	  kBlocking: Symbol('blocking'),
	  kPending: Symbol('pending'),
	  kSize: Symbol('size'),
	  kBusy: Symbol('busy'),
	  kQueued: Symbol('queued'),
	  kFree: Symbol('free'),
	  kConnected: Symbol('connected'),
	  kClosed: Symbol('closed'),
	  kNeedDrain: Symbol('need drain'),
	  kReset: Symbol('reset'),
	  kDestroyed: Symbol.for('nodejs.stream.destroyed'),
	  kResume: Symbol('resume'),
	  kOnError: Symbol('on error'),
	  kMaxHeadersSize: Symbol('max headers size'),
	  kRunningIdx: Symbol('running index'),
	  kPendingIdx: Symbol('pending index'),
	  kError: Symbol('error'),
	  kClients: Symbol('clients'),
	  kClient: Symbol('client'),
	  kParser: Symbol('parser'),
	  kOnDestroyed: Symbol('destroy callbacks'),
	  kPipelining: Symbol('pipelining'),
	  kSocket: Symbol('socket'),
	  kHostHeader: Symbol('host header'),
	  kConnector: Symbol('connector'),
	  kStrictContentLength: Symbol('strict content length'),
	  kMaxRedirections: Symbol('maxRedirections'),
	  kMaxRequests: Symbol('maxRequestsPerClient'),
	  kProxy: Symbol('proxy agent options'),
	  kCounter: Symbol('socket request counter'),
	  kInterceptors: Symbol('dispatch interceptors'),
	  kMaxResponseSize: Symbol('max response size'),
	  kHTTP2Session: Symbol('http2Session'),
	  kHTTP2SessionState: Symbol('http2Session state'),
	  kRetryHandlerDefaultRetry: Symbol('retry agent default retry'),
	  kConstruct: Symbol('constructable'),
	  kListeners: Symbol('listeners'),
	  kHTTPContext: Symbol('http context'),
	  kMaxConcurrentStreams: Symbol('max concurrent streams'),
	  kNoProxyAgent: Symbol('no proxy agent'),
	  kHttpProxyAgent: Symbol('http proxy agent'),
	  kHttpsProxyAgent: Symbol('https proxy agent')
	};
	return symbols$4;
}

var errors$1;
var hasRequiredErrors$1;

function requireErrors$1 () {
	if (hasRequiredErrors$1) return errors$1;
	hasRequiredErrors$1 = 1;

	const kUndiciError = Symbol.for('undici.error.UND_ERR');
	class UndiciError extends Error {
	  constructor (message) {
	    super(message);
	    this.name = 'UndiciError';
	    this.code = 'UND_ERR';
	  }

	  static [Symbol.hasInstance] (instance) {
	    return instance && instance[kUndiciError] === true
	  }

	  [kUndiciError] = true
	}

	const kConnectTimeoutError = Symbol.for('undici.error.UND_ERR_CONNECT_TIMEOUT');
	class ConnectTimeoutError extends UndiciError {
	  constructor (message) {
	    super(message);
	    this.name = 'ConnectTimeoutError';
	    this.message = message || 'Connect Timeout Error';
	    this.code = 'UND_ERR_CONNECT_TIMEOUT';
	  }

	  static [Symbol.hasInstance] (instance) {
	    return instance && instance[kConnectTimeoutError] === true
	  }

	  [kConnectTimeoutError] = true
	}

	const kHeadersTimeoutError = Symbol.for('undici.error.UND_ERR_HEADERS_TIMEOUT');
	class HeadersTimeoutError extends UndiciError {
	  constructor (message) {
	    super(message);
	    this.name = 'HeadersTimeoutError';
	    this.message = message || 'Headers Timeout Error';
	    this.code = 'UND_ERR_HEADERS_TIMEOUT';
	  }

	  static [Symbol.hasInstance] (instance) {
	    return instance && instance[kHeadersTimeoutError] === true
	  }

	  [kHeadersTimeoutError] = true
	}

	const kHeadersOverflowError = Symbol.for('undici.error.UND_ERR_HEADERS_OVERFLOW');
	class HeadersOverflowError extends UndiciError {
	  constructor (message) {
	    super(message);
	    this.name = 'HeadersOverflowError';
	    this.message = message || 'Headers Overflow Error';
	    this.code = 'UND_ERR_HEADERS_OVERFLOW';
	  }

	  static [Symbol.hasInstance] (instance) {
	    return instance && instance[kHeadersOverflowError] === true
	  }

	  [kHeadersOverflowError] = true
	}

	const kBodyTimeoutError = Symbol.for('undici.error.UND_ERR_BODY_TIMEOUT');
	class BodyTimeoutError extends UndiciError {
	  constructor (message) {
	    super(message);
	    this.name = 'BodyTimeoutError';
	    this.message = message || 'Body Timeout Error';
	    this.code = 'UND_ERR_BODY_TIMEOUT';
	  }

	  static [Symbol.hasInstance] (instance) {
	    return instance && instance[kBodyTimeoutError] === true
	  }

	  [kBodyTimeoutError] = true
	}

	const kResponseStatusCodeError = Symbol.for('undici.error.UND_ERR_RESPONSE_STATUS_CODE');
	class ResponseStatusCodeError extends UndiciError {
	  constructor (message, statusCode, headers, body) {
	    super(message);
	    this.name = 'ResponseStatusCodeError';
	    this.message = message || 'Response Status Code Error';
	    this.code = 'UND_ERR_RESPONSE_STATUS_CODE';
	    this.body = body;
	    this.status = statusCode;
	    this.statusCode = statusCode;
	    this.headers = headers;
	  }

	  static [Symbol.hasInstance] (instance) {
	    return instance && instance[kResponseStatusCodeError] === true
	  }

	  [kResponseStatusCodeError] = true
	}

	const kInvalidArgumentError = Symbol.for('undici.error.UND_ERR_INVALID_ARG');
	class InvalidArgumentError extends UndiciError {
	  constructor (message) {
	    super(message);
	    this.name = 'InvalidArgumentError';
	    this.message = message || 'Invalid Argument Error';
	    this.code = 'UND_ERR_INVALID_ARG';
	  }

	  static [Symbol.hasInstance] (instance) {
	    return instance && instance[kInvalidArgumentError] === true
	  }

	  [kInvalidArgumentError] = true
	}

	const kInvalidReturnValueError = Symbol.for('undici.error.UND_ERR_INVALID_RETURN_VALUE');
	class InvalidReturnValueError extends UndiciError {
	  constructor (message) {
	    super(message);
	    this.name = 'InvalidReturnValueError';
	    this.message = message || 'Invalid Return Value Error';
	    this.code = 'UND_ERR_INVALID_RETURN_VALUE';
	  }

	  static [Symbol.hasInstance] (instance) {
	    return instance && instance[kInvalidReturnValueError] === true
	  }

	  [kInvalidReturnValueError] = true
	}

	const kAbortError = Symbol.for('undici.error.UND_ERR_ABORT');
	class AbortError extends UndiciError {
	  constructor (message) {
	    super(message);
	    this.name = 'AbortError';
	    this.message = message || 'The operation was aborted';
	    this.code = 'UND_ERR_ABORT';
	  }

	  static [Symbol.hasInstance] (instance) {
	    return instance && instance[kAbortError] === true
	  }

	  [kAbortError] = true
	}

	const kRequestAbortedError = Symbol.for('undici.error.UND_ERR_ABORTED');
	class RequestAbortedError extends AbortError {
	  constructor (message) {
	    super(message);
	    this.name = 'AbortError';
	    this.message = message || 'Request aborted';
	    this.code = 'UND_ERR_ABORTED';
	  }

	  static [Symbol.hasInstance] (instance) {
	    return instance && instance[kRequestAbortedError] === true
	  }

	  [kRequestAbortedError] = true
	}

	const kInformationalError = Symbol.for('undici.error.UND_ERR_INFO');
	class InformationalError extends UndiciError {
	  constructor (message) {
	    super(message);
	    this.name = 'InformationalError';
	    this.message = message || 'Request information';
	    this.code = 'UND_ERR_INFO';
	  }

	  static [Symbol.hasInstance] (instance) {
	    return instance && instance[kInformationalError] === true
	  }

	  [kInformationalError] = true
	}

	const kRequestContentLengthMismatchError = Symbol.for('undici.error.UND_ERR_REQ_CONTENT_LENGTH_MISMATCH');
	class RequestContentLengthMismatchError extends UndiciError {
	  constructor (message) {
	    super(message);
	    this.name = 'RequestContentLengthMismatchError';
	    this.message = message || 'Request body length does not match content-length header';
	    this.code = 'UND_ERR_REQ_CONTENT_LENGTH_MISMATCH';
	  }

	  static [Symbol.hasInstance] (instance) {
	    return instance && instance[kRequestContentLengthMismatchError] === true
	  }

	  [kRequestContentLengthMismatchError] = true
	}

	const kResponseContentLengthMismatchError = Symbol.for('undici.error.UND_ERR_RES_CONTENT_LENGTH_MISMATCH');
	class ResponseContentLengthMismatchError extends UndiciError {
	  constructor (message) {
	    super(message);
	    this.name = 'ResponseContentLengthMismatchError';
	    this.message = message || 'Response body length does not match content-length header';
	    this.code = 'UND_ERR_RES_CONTENT_LENGTH_MISMATCH';
	  }

	  static [Symbol.hasInstance] (instance) {
	    return instance && instance[kResponseContentLengthMismatchError] === true
	  }

	  [kResponseContentLengthMismatchError] = true
	}

	const kClientDestroyedError = Symbol.for('undici.error.UND_ERR_DESTROYED');
	class ClientDestroyedError extends UndiciError {
	  constructor (message) {
	    super(message);
	    this.name = 'ClientDestroyedError';
	    this.message = message || 'The client is destroyed';
	    this.code = 'UND_ERR_DESTROYED';
	  }

	  static [Symbol.hasInstance] (instance) {
	    return instance && instance[kClientDestroyedError] === true
	  }

	  [kClientDestroyedError] = true
	}

	const kClientClosedError = Symbol.for('undici.error.UND_ERR_CLOSED');
	class ClientClosedError extends UndiciError {
	  constructor (message) {
	    super(message);
	    this.name = 'ClientClosedError';
	    this.message = message || 'The client is closed';
	    this.code = 'UND_ERR_CLOSED';
	  }

	  static [Symbol.hasInstance] (instance) {
	    return instance && instance[kClientClosedError] === true
	  }

	  [kClientClosedError] = true
	}

	const kSocketError = Symbol.for('undici.error.UND_ERR_SOCKET');
	class SocketError extends UndiciError {
	  constructor (message, socket) {
	    super(message);
	    this.name = 'SocketError';
	    this.message = message || 'Socket error';
	    this.code = 'UND_ERR_SOCKET';
	    this.socket = socket;
	  }

	  static [Symbol.hasInstance] (instance) {
	    return instance && instance[kSocketError] === true
	  }

	  [kSocketError] = true
	}

	const kNotSupportedError = Symbol.for('undici.error.UND_ERR_NOT_SUPPORTED');
	class NotSupportedError extends UndiciError {
	  constructor (message) {
	    super(message);
	    this.name = 'NotSupportedError';
	    this.message = message || 'Not supported error';
	    this.code = 'UND_ERR_NOT_SUPPORTED';
	  }

	  static [Symbol.hasInstance] (instance) {
	    return instance && instance[kNotSupportedError] === true
	  }

	  [kNotSupportedError] = true
	}

	const kBalancedPoolMissingUpstreamError = Symbol.for('undici.error.UND_ERR_BPL_MISSING_UPSTREAM');
	class BalancedPoolMissingUpstreamError extends UndiciError {
	  constructor (message) {
	    super(message);
	    this.name = 'MissingUpstreamError';
	    this.message = message || 'No upstream has been added to the BalancedPool';
	    this.code = 'UND_ERR_BPL_MISSING_UPSTREAM';
	  }

	  static [Symbol.hasInstance] (instance) {
	    return instance && instance[kBalancedPoolMissingUpstreamError] === true
	  }

	  [kBalancedPoolMissingUpstreamError] = true
	}

	const kHTTPParserError = Symbol.for('undici.error.UND_ERR_HTTP_PARSER');
	class HTTPParserError extends Error {
	  constructor (message, code, data) {
	    super(message);
	    this.name = 'HTTPParserError';
	    this.code = code ? `HPE_${code}` : undefined;
	    this.data = data ? data.toString() : undefined;
	  }

	  static [Symbol.hasInstance] (instance) {
	    return instance && instance[kHTTPParserError] === true
	  }

	  [kHTTPParserError] = true
	}

	const kResponseExceededMaxSizeError = Symbol.for('undici.error.UND_ERR_RES_EXCEEDED_MAX_SIZE');
	class ResponseExceededMaxSizeError extends UndiciError {
	  constructor (message) {
	    super(message);
	    this.name = 'ResponseExceededMaxSizeError';
	    this.message = message || 'Response content exceeded max size';
	    this.code = 'UND_ERR_RES_EXCEEDED_MAX_SIZE';
	  }

	  static [Symbol.hasInstance] (instance) {
	    return instance && instance[kResponseExceededMaxSizeError] === true
	  }

	  [kResponseExceededMaxSizeError] = true
	}

	const kRequestRetryError = Symbol.for('undici.error.UND_ERR_REQ_RETRY');
	class RequestRetryError extends UndiciError {
	  constructor (message, code, { headers, data }) {
	    super(message);
	    this.name = 'RequestRetryError';
	    this.message = message || 'Request retry error';
	    this.code = 'UND_ERR_REQ_RETRY';
	    this.statusCode = code;
	    this.data = data;
	    this.headers = headers;
	  }

	  static [Symbol.hasInstance] (instance) {
	    return instance && instance[kRequestRetryError] === true
	  }

	  [kRequestRetryError] = true
	}

	const kResponseError = Symbol.for('undici.error.UND_ERR_RESPONSE');
	class ResponseError extends UndiciError {
	  constructor (message, code, { headers, data }) {
	    super(message);
	    this.name = 'ResponseError';
	    this.message = message || 'Response error';
	    this.code = 'UND_ERR_RESPONSE';
	    this.statusCode = code;
	    this.data = data;
	    this.headers = headers;
	  }

	  static [Symbol.hasInstance] (instance) {
	    return instance && instance[kResponseError] === true
	  }

	  [kResponseError] = true
	}

	const kSecureProxyConnectionError = Symbol.for('undici.error.UND_ERR_PRX_TLS');
	class SecureProxyConnectionError extends UndiciError {
	  constructor (cause, message, options) {
	    super(message, { cause, ...(options ?? {}) });
	    this.name = 'SecureProxyConnectionError';
	    this.message = message || 'Secure Proxy Connection failed';
	    this.code = 'UND_ERR_PRX_TLS';
	    this.cause = cause;
	  }

	  static [Symbol.hasInstance] (instance) {
	    return instance && instance[kSecureProxyConnectionError] === true
	  }

	  [kSecureProxyConnectionError] = true
	}

	const kMessageSizeExceededError = Symbol.for('undici.error.UND_ERR_WS_MESSAGE_SIZE_EXCEEDED');
	class MessageSizeExceededError extends UndiciError {
	  constructor (message) {
	    super(message);
	    this.name = 'MessageSizeExceededError';
	    this.message = message || 'Max decompressed message size exceeded';
	    this.code = 'UND_ERR_WS_MESSAGE_SIZE_EXCEEDED';
	  }

	  static [Symbol.hasInstance] (instance) {
	    return instance && instance[kMessageSizeExceededError] === true
	  }

	  get [kMessageSizeExceededError] () {
	    return true
	  }
	}

	errors$1 = {
	  AbortError,
	  HTTPParserError,
	  UndiciError,
	  HeadersTimeoutError,
	  HeadersOverflowError,
	  BodyTimeoutError,
	  RequestContentLengthMismatchError,
	  ConnectTimeoutError,
	  ResponseStatusCodeError,
	  InvalidArgumentError,
	  InvalidReturnValueError,
	  RequestAbortedError,
	  ClientDestroyedError,
	  ClientClosedError,
	  InformationalError,
	  SocketError,
	  NotSupportedError,
	  ResponseContentLengthMismatchError,
	  BalancedPoolMissingUpstreamError,
	  ResponseExceededMaxSizeError,
	  RequestRetryError,
	  ResponseError,
	  SecureProxyConnectionError,
	  MessageSizeExceededError
	};
	return errors$1;
}

var constants$4;
var hasRequiredConstants$4;

function requireConstants$4 () {
	if (hasRequiredConstants$4) return constants$4;
	hasRequiredConstants$4 = 1;

	/** @type {Record<string, string | undefined>} */
	const headerNameLowerCasedRecord = {};

	// https://developer.mozilla.org/docs/Web/HTTP/Headers
	const wellknownHeaderNames = [
	  'Accept',
	  'Accept-Encoding',
	  'Accept-Language',
	  'Accept-Ranges',
	  'Access-Control-Allow-Credentials',
	  'Access-Control-Allow-Headers',
	  'Access-Control-Allow-Methods',
	  'Access-Control-Allow-Origin',
	  'Access-Control-Expose-Headers',
	  'Access-Control-Max-Age',
	  'Access-Control-Request-Headers',
	  'Access-Control-Request-Method',
	  'Age',
	  'Allow',
	  'Alt-Svc',
	  'Alt-Used',
	  'Authorization',
	  'Cache-Control',
	  'Clear-Site-Data',
	  'Connection',
	  'Content-Disposition',
	  'Content-Encoding',
	  'Content-Language',
	  'Content-Length',
	  'Content-Location',
	  'Content-Range',
	  'Content-Security-Policy',
	  'Content-Security-Policy-Report-Only',
	  'Content-Type',
	  'Cookie',
	  'Cross-Origin-Embedder-Policy',
	  'Cross-Origin-Opener-Policy',
	  'Cross-Origin-Resource-Policy',
	  'Date',
	  'Device-Memory',
	  'Downlink',
	  'ECT',
	  'ETag',
	  'Expect',
	  'Expect-CT',
	  'Expires',
	  'Forwarded',
	  'From',
	  'Host',
	  'If-Match',
	  'If-Modified-Since',
	  'If-None-Match',
	  'If-Range',
	  'If-Unmodified-Since',
	  'Keep-Alive',
	  'Last-Modified',
	  'Link',
	  'Location',
	  'Max-Forwards',
	  'Origin',
	  'Permissions-Policy',
	  'Pragma',
	  'Proxy-Authenticate',
	  'Proxy-Authorization',
	  'RTT',
	  'Range',
	  'Referer',
	  'Referrer-Policy',
	  'Refresh',
	  'Retry-After',
	  'Sec-WebSocket-Accept',
	  'Sec-WebSocket-Extensions',
	  'Sec-WebSocket-Key',
	  'Sec-WebSocket-Protocol',
	  'Sec-WebSocket-Version',
	  'Server',
	  'Server-Timing',
	  'Service-Worker-Allowed',
	  'Service-Worker-Navigation-Preload',
	  'Set-Cookie',
	  'SourceMap',
	  'Strict-Transport-Security',
	  'Supports-Loading-Mode',
	  'TE',
	  'Timing-Allow-Origin',
	  'Trailer',
	  'Transfer-Encoding',
	  'Upgrade',
	  'Upgrade-Insecure-Requests',
	  'User-Agent',
	  'Vary',
	  'Via',
	  'WWW-Authenticate',
	  'X-Content-Type-Options',
	  'X-DNS-Prefetch-Control',
	  'X-Frame-Options',
	  'X-Permitted-Cross-Domain-Policies',
	  'X-Powered-By',
	  'X-Requested-With',
	  'X-XSS-Protection'
	];

	for (let i = 0; i < wellknownHeaderNames.length; ++i) {
	  const key = wellknownHeaderNames[i];
	  const lowerCasedKey = key.toLowerCase();
	  headerNameLowerCasedRecord[key] = headerNameLowerCasedRecord[lowerCasedKey] =
	    lowerCasedKey;
	}

	// Note: object prototypes should not be able to be referenced. e.g. `Object#hasOwnProperty`.
	Object.setPrototypeOf(headerNameLowerCasedRecord, null);

	constants$4 = {
	  wellknownHeaderNames,
	  headerNameLowerCasedRecord
	};
	return constants$4;
}

var tree_1;
var hasRequiredTree;

function requireTree () {
	if (hasRequiredTree) return tree_1;
	hasRequiredTree = 1;

	const {
	  wellknownHeaderNames,
	  headerNameLowerCasedRecord
	} = requireConstants$4();

	class TstNode {
	  /** @type {any} */
	  value = null
	  /** @type {null | TstNode} */
	  left = null
	  /** @type {null | TstNode} */
	  middle = null
	  /** @type {null | TstNode} */
	  right = null
	  /** @type {number} */
	  code
	  /**
	   * @param {string} key
	   * @param {any} value
	   * @param {number} index
	   */
	  constructor (key, value, index) {
	    if (index === undefined || index >= key.length) {
	      throw new TypeError('Unreachable')
	    }
	    const code = this.code = key.charCodeAt(index);
	    // check code is ascii string
	    if (code > 0x7F) {
	      throw new TypeError('key must be ascii string')
	    }
	    if (key.length !== ++index) {
	      this.middle = new TstNode(key, value, index);
	    } else {
	      this.value = value;
	    }
	  }

	  /**
	   * @param {string} key
	   * @param {any} value
	   */
	  add (key, value) {
	    const length = key.length;
	    if (length === 0) {
	      throw new TypeError('Unreachable')
	    }
	    let index = 0;
	    let node = this;
	    while (true) {
	      const code = key.charCodeAt(index);
	      // check code is ascii string
	      if (code > 0x7F) {
	        throw new TypeError('key must be ascii string')
	      }
	      if (node.code === code) {
	        if (length === ++index) {
	          node.value = value;
	          break
	        } else if (node.middle !== null) {
	          node = node.middle;
	        } else {
	          node.middle = new TstNode(key, value, index);
	          break
	        }
	      } else if (node.code < code) {
	        if (node.left !== null) {
	          node = node.left;
	        } else {
	          node.left = new TstNode(key, value, index);
	          break
	        }
	      } else if (node.right !== null) {
	        node = node.right;
	      } else {
	        node.right = new TstNode(key, value, index);
	        break
	      }
	    }
	  }

	  /**
	   * @param {Uint8Array} key
	   * @return {TstNode | null}
	   */
	  search (key) {
	    const keylength = key.length;
	    let index = 0;
	    let node = this;
	    while (node !== null && index < keylength) {
	      let code = key[index];
	      // A-Z
	      // First check if it is bigger than 0x5a.
	      // Lowercase letters have higher char codes than uppercase ones.
	      // Also we assume that headers will mostly contain lowercase characters.
	      if (code <= 0x5a && code >= 0x41) {
	        // Lowercase for uppercase.
	        code |= 32;
	      }
	      while (node !== null) {
	        if (code === node.code) {
	          if (keylength === ++index) {
	            // Returns Node since it is the last key.
	            return node
	          }
	          node = node.middle;
	          break
	        }
	        node = node.code < code ? node.left : node.right;
	      }
	    }
	    return null
	  }
	}

	class TernarySearchTree {
	  /** @type {TstNode | null} */
	  node = null

	  /**
	   * @param {string} key
	   * @param {any} value
	   * */
	  insert (key, value) {
	    if (this.node === null) {
	      this.node = new TstNode(key, value, 0);
	    } else {
	      this.node.add(key, value);
	    }
	  }

	  /**
	   * @param {Uint8Array} key
	   * @return {any}
	   */
	  lookup (key) {
	    return this.node?.search(key)?.value ?? null
	  }
	}

	const tree = new TernarySearchTree();

	for (let i = 0; i < wellknownHeaderNames.length; ++i) {
	  const key = headerNameLowerCasedRecord[wellknownHeaderNames[i]];
	  tree.insert(key, key);
	}

	tree_1 = {
	  TernarySearchTree,
	  tree
	};
	return tree_1;
}

var util$7;
var hasRequiredUtil$7;

function requireUtil$7 () {
	if (hasRequiredUtil$7) return util$7;
	hasRequiredUtil$7 = 1;

	const assert = require$$0$2;
	const { kDestroyed, kBodyUsed, kListeners, kBody } = requireSymbols$4();
	const { IncomingMessage } = require$$2;
	const stream = require$$0$3;
	const net = require$$0$4;
	const { Blob } = require$$0$1;
	const nodeUtil = require$$0$5;
	const { stringify } = require$$7;
	const { EventEmitter: EE } = require$$8;
	const { InvalidArgumentError } = requireErrors$1();
	const { headerNameLowerCasedRecord } = requireConstants$4();
	const { tree } = requireTree();

	const [nodeMajor, nodeMinor] = process.versions.node.split('.').map(v => Number(v));

	class BodyAsyncIterable {
	  constructor (body) {
	    this[kBody] = body;
	    this[kBodyUsed] = false;
	  }

	  async * [Symbol.asyncIterator] () {
	    assert(!this[kBodyUsed], 'disturbed');
	    this[kBodyUsed] = true;
	    yield * this[kBody];
	  }
	}

	function wrapRequestBody (body) {
	  if (isStream(body)) {
	    // TODO (fix): Provide some way for the user to cache the file to e.g. /tmp
	    // so that it can be dispatched again?
	    // TODO (fix): Do we need 100-expect support to provide a way to do this properly?
	    if (bodyLength(body) === 0) {
	      body
	        .on('data', function () {
	          assert(false);
	        });
	    }

	    if (typeof body.readableDidRead !== 'boolean') {
	      body[kBodyUsed] = false;
	      EE.prototype.on.call(body, 'data', function () {
	        this[kBodyUsed] = true;
	      });
	    }

	    return body
	  } else if (body && typeof body.pipeTo === 'function') {
	    // TODO (fix): We can't access ReadableStream internal state
	    // to determine whether or not it has been disturbed. This is just
	    // a workaround.
	    return new BodyAsyncIterable(body)
	  } else if (
	    body &&
	    typeof body !== 'string' &&
	    !ArrayBuffer.isView(body) &&
	    isIterable(body)
	  ) {
	    // TODO: Should we allow re-using iterable if !this.opts.idempotent
	    // or through some other flag?
	    return new BodyAsyncIterable(body)
	  } else {
	    return body
	  }
	}

	function nop () {}

	function isStream (obj) {
	  return obj && typeof obj === 'object' && typeof obj.pipe === 'function' && typeof obj.on === 'function'
	}

	// based on https://github.com/node-fetch/fetch-blob/blob/8ab587d34080de94140b54f07168451e7d0b655e/index.js#L229-L241 (MIT License)
	function isBlobLike (object) {
	  if (object === null) {
	    return false
	  } else if (object instanceof Blob) {
	    return true
	  } else if (typeof object !== 'object') {
	    return false
	  } else {
	    const sTag = object[Symbol.toStringTag];

	    return (sTag === 'Blob' || sTag === 'File') && (
	      ('stream' in object && typeof object.stream === 'function') ||
	      ('arrayBuffer' in object && typeof object.arrayBuffer === 'function')
	    )
	  }
	}

	function buildURL (url, queryParams) {
	  if (url.includes('?') || url.includes('#')) {
	    throw new Error('Query params cannot be passed when url already contains "?" or "#".')
	  }

	  const stringified = stringify(queryParams);

	  if (stringified) {
	    url += '?' + stringified;
	  }

	  return url
	}

	function isValidPort (port) {
	  const value = parseInt(port, 10);
	  return (
	    value === Number(port) &&
	    value >= 0 &&
	    value <= 65535
	  )
	}

	function isHttpOrHttpsPrefixed (value) {
	  return (
	    value != null &&
	    value[0] === 'h' &&
	    value[1] === 't' &&
	    value[2] === 't' &&
	    value[3] === 'p' &&
	    (
	      value[4] === ':' ||
	      (
	        value[4] === 's' &&
	        value[5] === ':'
	      )
	    )
	  )
	}

	function parseURL (url) {
	  if (typeof url === 'string') {
	    url = new URL(url);

	    if (!isHttpOrHttpsPrefixed(url.origin || url.protocol)) {
	      throw new InvalidArgumentError('Invalid URL protocol: the URL must start with `http:` or `https:`.')
	    }

	    return url
	  }

	  if (!url || typeof url !== 'object') {
	    throw new InvalidArgumentError('Invalid URL: The URL argument must be a non-null object.')
	  }

	  if (!(url instanceof URL)) {
	    if (url.port != null && url.port !== '' && isValidPort(url.port) === false) {
	      throw new InvalidArgumentError('Invalid URL: port must be a valid integer or a string representation of an integer.')
	    }

	    if (url.path != null && typeof url.path !== 'string') {
	      throw new InvalidArgumentError('Invalid URL path: the path must be a string or null/undefined.')
	    }

	    if (url.pathname != null && typeof url.pathname !== 'string') {
	      throw new InvalidArgumentError('Invalid URL pathname: the pathname must be a string or null/undefined.')
	    }

	    if (url.hostname != null && typeof url.hostname !== 'string') {
	      throw new InvalidArgumentError('Invalid URL hostname: the hostname must be a string or null/undefined.')
	    }

	    if (url.origin != null && typeof url.origin !== 'string') {
	      throw new InvalidArgumentError('Invalid URL origin: the origin must be a string or null/undefined.')
	    }

	    if (!isHttpOrHttpsPrefixed(url.origin || url.protocol)) {
	      throw new InvalidArgumentError('Invalid URL protocol: the URL must start with `http:` or `https:`.')
	    }

	    const port = url.port != null
	      ? url.port
	      : (url.protocol === 'https:' ? 443 : 80);
	    let origin = url.origin != null
	      ? url.origin
	      : `${url.protocol || ''}//${url.hostname || ''}:${port}`;
	    let path = url.path != null
	      ? url.path
	      : `${url.pathname || ''}${url.search || ''}`;

	    if (origin[origin.length - 1] === '/') {
	      origin = origin.slice(0, origin.length - 1);
	    }

	    if (path && path[0] !== '/') {
	      path = `/${path}`;
	    }
	    // new URL(path, origin) is unsafe when `path` contains an absolute URL
	    // From https://developer.mozilla.org/en-US/docs/Web/API/URL/URL:
	    // If first parameter is a relative URL, second param is required, and will be used as the base URL.
	    // If first parameter is an absolute URL, a given second param will be ignored.
	    return new URL(`${origin}${path}`)
	  }

	  if (!isHttpOrHttpsPrefixed(url.origin || url.protocol)) {
	    throw new InvalidArgumentError('Invalid URL protocol: the URL must start with `http:` or `https:`.')
	  }

	  return url
	}

	function parseOrigin (url) {
	  url = parseURL(url);

	  if (url.pathname !== '/' || url.search || url.hash) {
	    throw new InvalidArgumentError('invalid url')
	  }

	  return url
	}

	function getHostname (host) {
	  if (host[0] === '[') {
	    const idx = host.indexOf(']');

	    assert(idx !== -1);
	    return host.substring(1, idx)
	  }

	  const idx = host.indexOf(':');
	  if (idx === -1) return host

	  return host.substring(0, idx)
	}

	// IP addresses are not valid server names per RFC6066
	// > Currently, the only server names supported are DNS hostnames
	function getServerName (host) {
	  if (!host) {
	    return null
	  }

	  assert(typeof host === 'string');

	  const servername = getHostname(host);
	  if (net.isIP(servername)) {
	    return ''
	  }

	  return servername
	}

	function deepClone (obj) {
	  return JSON.parse(JSON.stringify(obj))
	}

	function isAsyncIterable (obj) {
	  return !!(obj != null && typeof obj[Symbol.asyncIterator] === 'function')
	}

	function isIterable (obj) {
	  return !!(obj != null && (typeof obj[Symbol.iterator] === 'function' || typeof obj[Symbol.asyncIterator] === 'function'))
	}

	function bodyLength (body) {
	  if (body == null) {
	    return 0
	  } else if (isStream(body)) {
	    const state = body._readableState;
	    return state && state.objectMode === false && state.ended === true && Number.isFinite(state.length)
	      ? state.length
	      : null
	  } else if (isBlobLike(body)) {
	    return body.size != null ? body.size : null
	  } else if (isBuffer(body)) {
	    return body.byteLength
	  }

	  return null
	}

	function isDestroyed (body) {
	  return body && !!(body.destroyed || body[kDestroyed] || (stream.isDestroyed?.(body)))
	}

	function destroy (stream, err) {
	  if (stream == null || !isStream(stream) || isDestroyed(stream)) {
	    return
	  }

	  if (typeof stream.destroy === 'function') {
	    if (Object.getPrototypeOf(stream).constructor === IncomingMessage) {
	      // See: https://github.com/nodejs/node/pull/38505/files
	      stream.socket = null;
	    }

	    stream.destroy(err);
	  } else if (err) {
	    queueMicrotask(() => {
	      stream.emit('error', err);
	    });
	  }

	  if (stream.destroyed !== true) {
	    stream[kDestroyed] = true;
	  }
	}

	const KEEPALIVE_TIMEOUT_EXPR = /timeout=(\d+)/;
	function parseKeepAliveTimeout (val) {
	  const m = val.toString().match(KEEPALIVE_TIMEOUT_EXPR);
	  return m ? parseInt(m[1], 10) * 1000 : null
	}

	/**
	 * Retrieves a header name and returns its lowercase value.
	 * @param {string | Buffer} value Header name
	 * @returns {string}
	 */
	function headerNameToString (value) {
	  return typeof value === 'string'
	    ? headerNameLowerCasedRecord[value] ?? value.toLowerCase()
	    : tree.lookup(value) ?? value.toString('latin1').toLowerCase()
	}

	/**
	 * Receive the buffer as a string and return its lowercase value.
	 * @param {Buffer} value Header name
	 * @returns {string}
	 */
	function bufferToLowerCasedHeaderName (value) {
	  return tree.lookup(value) ?? value.toString('latin1').toLowerCase()
	}

	/**
	 * @param {Record<string, string | string[]> | (Buffer | string | (Buffer | string)[])[]} headers
	 * @param {Record<string, string | string[]>} [obj]
	 * @returns {Record<string, string | string[]>}
	 */
	function parseHeaders (headers, obj) {
	  if (obj === undefined) obj = {};
	  for (let i = 0; i < headers.length; i += 2) {
	    const key = headerNameToString(headers[i]);
	    let val = obj[key];

	    if (val) {
	      if (typeof val === 'string') {
	        val = [val];
	        obj[key] = val;
	      }
	      val.push(headers[i + 1].toString('utf8'));
	    } else {
	      const headersValue = headers[i + 1];
	      if (typeof headersValue === 'string') {
	        obj[key] = headersValue;
	      } else {
	        obj[key] = Array.isArray(headersValue) ? headersValue.map(x => x.toString('utf8')) : headersValue.toString('utf8');
	      }
	    }
	  }

	  // See https://github.com/nodejs/node/pull/46528
	  if ('content-length' in obj && 'content-disposition' in obj) {
	    obj['content-disposition'] = Buffer.from(obj['content-disposition']).toString('latin1');
	  }

	  return obj
	}

	function parseRawHeaders (headers) {
	  const len = headers.length;
	  const ret = new Array(len);

	  let hasContentLength = false;
	  let contentDispositionIdx = -1;
	  let key;
	  let val;
	  let kLen = 0;

	  for (let n = 0; n < headers.length; n += 2) {
	    key = headers[n];
	    val = headers[n + 1];

	    typeof key !== 'string' && (key = key.toString());
	    typeof val !== 'string' && (val = val.toString('utf8'));

	    kLen = key.length;
	    if (kLen === 14 && key[7] === '-' && (key === 'content-length' || key.toLowerCase() === 'content-length')) {
	      hasContentLength = true;
	    } else if (kLen === 19 && key[7] === '-' && (key === 'content-disposition' || key.toLowerCase() === 'content-disposition')) {
	      contentDispositionIdx = n + 1;
	    }
	    ret[n] = key;
	    ret[n + 1] = val;
	  }

	  // See https://github.com/nodejs/node/pull/46528
	  if (hasContentLength && contentDispositionIdx !== -1) {
	    ret[contentDispositionIdx] = Buffer.from(ret[contentDispositionIdx]).toString('latin1');
	  }

	  return ret
	}

	function isBuffer (buffer) {
	  // See, https://github.com/mcollina/undici/pull/319
	  return buffer instanceof Uint8Array || Buffer.isBuffer(buffer)
	}

	function validateHandler (handler, method, upgrade) {
	  if (!handler || typeof handler !== 'object') {
	    throw new InvalidArgumentError('handler must be an object')
	  }

	  if (typeof handler.onConnect !== 'function') {
	    throw new InvalidArgumentError('invalid onConnect method')
	  }

	  if (typeof handler.onError !== 'function') {
	    throw new InvalidArgumentError('invalid onError method')
	  }

	  if (typeof handler.onBodySent !== 'function' && handler.onBodySent !== undefined) {
	    throw new InvalidArgumentError('invalid onBodySent method')
	  }

	  if (upgrade || method === 'CONNECT') {
	    if (typeof handler.onUpgrade !== 'function') {
	      throw new InvalidArgumentError('invalid onUpgrade method')
	    }
	  } else {
	    if (typeof handler.onHeaders !== 'function') {
	      throw new InvalidArgumentError('invalid onHeaders method')
	    }

	    if (typeof handler.onData !== 'function') {
	      throw new InvalidArgumentError('invalid onData method')
	    }

	    if (typeof handler.onComplete !== 'function') {
	      throw new InvalidArgumentError('invalid onComplete method')
	    }
	  }
	}

	// A body is disturbed if it has been read from and it cannot
	// be re-used without losing state or data.
	function isDisturbed (body) {
	  // TODO (fix): Why is body[kBodyUsed] needed?
	  return !!(body && (stream.isDisturbed(body) || body[kBodyUsed]))
	}

	function isErrored (body) {
	  return !!(body && stream.isErrored(body))
	}

	function isReadable (body) {
	  return !!(body && stream.isReadable(body))
	}

	function getSocketInfo (socket) {
	  return {
	    localAddress: socket.localAddress,
	    localPort: socket.localPort,
	    remoteAddress: socket.remoteAddress,
	    remotePort: socket.remotePort,
	    remoteFamily: socket.remoteFamily,
	    timeout: socket.timeout,
	    bytesWritten: socket.bytesWritten,
	    bytesRead: socket.bytesRead
	  }
	}

	/** @type {globalThis['ReadableStream']} */
	function ReadableStreamFrom (iterable) {
	  // We cannot use ReadableStream.from here because it does not return a byte stream.

	  let iterator;
	  return new ReadableStream(
	    {
	      async start () {
	        iterator = iterable[Symbol.asyncIterator]();
	      },
	      async pull (controller) {
	        const { done, value } = await iterator.next();
	        if (done) {
	          queueMicrotask(() => {
	            controller.close();
	            controller.byobRequest?.respond(0);
	          });
	        } else {
	          const buf = Buffer.isBuffer(value) ? value : Buffer.from(value);
	          if (buf.byteLength) {
	            controller.enqueue(new Uint8Array(buf));
	          }
	        }
	        return controller.desiredSize > 0
	      },
	      async cancel (reason) {
	        await iterator.return();
	      },
	      type: 'bytes'
	    }
	  )
	}

	// The chunk should be a FormData instance and contains
	// all the required methods.
	function isFormDataLike (object) {
	  return (
	    object &&
	    typeof object === 'object' &&
	    typeof object.append === 'function' &&
	    typeof object.delete === 'function' &&
	    typeof object.get === 'function' &&
	    typeof object.getAll === 'function' &&
	    typeof object.has === 'function' &&
	    typeof object.set === 'function' &&
	    object[Symbol.toStringTag] === 'FormData'
	  )
	}

	function addAbortListener (signal, listener) {
	  if ('addEventListener' in signal) {
	    signal.addEventListener('abort', listener, { once: true });
	    return () => signal.removeEventListener('abort', listener)
	  }
	  signal.addListener('abort', listener);
	  return () => signal.removeListener('abort', listener)
	}

	const hasToWellFormed = typeof String.prototype.toWellFormed === 'function';
	const hasIsWellFormed = typeof String.prototype.isWellFormed === 'function';

	/**
	 * @param {string} val
	 */
	function toUSVString (val) {
	  return hasToWellFormed ? `${val}`.toWellFormed() : nodeUtil.toUSVString(val)
	}

	/**
	 * @param {string} val
	 */
	// TODO: move this to webidl
	function isUSVString (val) {
	  return hasIsWellFormed ? `${val}`.isWellFormed() : toUSVString(val) === `${val}`
	}

	/**
	 * @see https://tools.ietf.org/html/rfc7230#section-3.2.6
	 * @param {number} c
	 */
	function isTokenCharCode (c) {
	  switch (c) {
	    case 0x22:
	    case 0x28:
	    case 0x29:
	    case 0x2c:
	    case 0x2f:
	    case 0x3a:
	    case 0x3b:
	    case 0x3c:
	    case 0x3d:
	    case 0x3e:
	    case 0x3f:
	    case 0x40:
	    case 0x5b:
	    case 0x5c:
	    case 0x5d:
	    case 0x7b:
	    case 0x7d:
	      // DQUOTE and "(),/:;<=>?@[\]{}"
	      return false
	    default:
	      // VCHAR %x21-7E
	      return c >= 0x21 && c <= 0x7e
	  }
	}

	/**
	 * @param {string} characters
	 */
	function isValidHTTPToken (characters) {
	  if (characters.length === 0) {
	    return false
	  }
	  for (let i = 0; i < characters.length; ++i) {
	    if (!isTokenCharCode(characters.charCodeAt(i))) {
	      return false
	    }
	  }
	  return true
	}

	// headerCharRegex have been lifted from
	// https://github.com/nodejs/node/blob/main/lib/_http_common.js

	/**
	 * Matches if val contains an invalid field-vchar
	 *  field-value    = *( field-content / obs-fold )
	 *  field-content  = field-vchar [ 1*( SP / HTAB ) field-vchar ]
	 *  field-vchar    = VCHAR / obs-text
	 */
	const headerCharRegex = /[^\t\x20-\x7e\x80-\xff]/;

	/**
	 * @param {string} characters
	 */
	function isValidHeaderValue (characters) {
	  return !headerCharRegex.test(characters)
	}

	// Parsed accordingly to RFC 9110
	// https://www.rfc-editor.org/rfc/rfc9110#field.content-range
	function parseRangeHeader (range) {
	  if (range == null || range === '') return { start: 0, end: null, size: null }

	  const m = range ? range.match(/^bytes (\d+)-(\d+)\/(\d+)?$/) : null;
	  return m
	    ? {
	        start: parseInt(m[1]),
	        end: m[2] ? parseInt(m[2]) : null,
	        size: m[3] ? parseInt(m[3]) : null
	      }
	    : null
	}

	function addListener (obj, name, listener) {
	  const listeners = (obj[kListeners] ??= []);
	  listeners.push([name, listener]);
	  obj.on(name, listener);
	  return obj
	}

	function removeAllListeners (obj) {
	  for (const [name, listener] of obj[kListeners] ?? []) {
	    obj.removeListener(name, listener);
	  }
	  obj[kListeners] = null;
	}

	function errorRequest (client, request, err) {
	  try {
	    request.onError(err);
	    assert(request.aborted);
	  } catch (err) {
	    client.emit('error', err);
	  }
	}

	const kEnumerableProperty = Object.create(null);
	kEnumerableProperty.enumerable = true;

	const normalizedMethodRecordsBase = {
	  delete: 'DELETE',
	  DELETE: 'DELETE',
	  get: 'GET',
	  GET: 'GET',
	  head: 'HEAD',
	  HEAD: 'HEAD',
	  options: 'OPTIONS',
	  OPTIONS: 'OPTIONS',
	  post: 'POST',
	  POST: 'POST',
	  put: 'PUT',
	  PUT: 'PUT'
	};

	const normalizedMethodRecords = {
	  ...normalizedMethodRecordsBase,
	  patch: 'patch',
	  PATCH: 'PATCH'
	};

	// Note: object prototypes should not be able to be referenced. e.g. `Object#hasOwnProperty`.
	Object.setPrototypeOf(normalizedMethodRecordsBase, null);
	Object.setPrototypeOf(normalizedMethodRecords, null);

	util$7 = {
	  kEnumerableProperty,
	  nop,
	  isDisturbed,
	  isErrored,
	  isReadable,
	  toUSVString,
	  isUSVString,
	  isBlobLike,
	  parseOrigin,
	  parseURL,
	  getServerName,
	  isStream,
	  isIterable,
	  isAsyncIterable,
	  isDestroyed,
	  headerNameToString,
	  bufferToLowerCasedHeaderName,
	  addListener,
	  removeAllListeners,
	  errorRequest,
	  parseRawHeaders,
	  parseHeaders,
	  parseKeepAliveTimeout,
	  destroy,
	  bodyLength,
	  deepClone,
	  ReadableStreamFrom,
	  isBuffer,
	  validateHandler,
	  getSocketInfo,
	  isFormDataLike,
	  buildURL,
	  addAbortListener,
	  isValidHTTPToken,
	  isValidHeaderValue,
	  isTokenCharCode,
	  parseRangeHeader,
	  normalizedMethodRecordsBase,
	  normalizedMethodRecords,
	  isValidPort,
	  isHttpOrHttpsPrefixed,
	  nodeMajor,
	  nodeMinor,
	  safeHTTPMethods: ['GET', 'HEAD', 'OPTIONS', 'TRACE'],
	  wrapRequestBody
	};
	return util$7;
}

var diagnostics;
var hasRequiredDiagnostics;

function requireDiagnostics () {
	if (hasRequiredDiagnostics) return diagnostics;
	hasRequiredDiagnostics = 1;
	const diagnosticsChannel = require$$0$6;
	const util = require$$0$5;

	const undiciDebugLog = util.debuglog('undici');
	const fetchDebuglog = util.debuglog('fetch');
	const websocketDebuglog = util.debuglog('websocket');
	let isClientSet = false;
	const channels = {
	  // Client
	  beforeConnect: diagnosticsChannel.channel('undici:client:beforeConnect'),
	  connected: diagnosticsChannel.channel('undici:client:connected'),
	  connectError: diagnosticsChannel.channel('undici:client:connectError'),
	  sendHeaders: diagnosticsChannel.channel('undici:client:sendHeaders'),
	  // Request
	  create: diagnosticsChannel.channel('undici:request:create'),
	  bodySent: diagnosticsChannel.channel('undici:request:bodySent'),
	  headers: diagnosticsChannel.channel('undici:request:headers'),
	  trailers: diagnosticsChannel.channel('undici:request:trailers'),
	  error: diagnosticsChannel.channel('undici:request:error'),
	  // WebSocket
	  open: diagnosticsChannel.channel('undici:websocket:open'),
	  close: diagnosticsChannel.channel('undici:websocket:close'),
	  socketError: diagnosticsChannel.channel('undici:websocket:socket_error'),
	  ping: diagnosticsChannel.channel('undici:websocket:ping'),
	  pong: diagnosticsChannel.channel('undici:websocket:pong')
	};

	if (undiciDebugLog.enabled || fetchDebuglog.enabled) {
	  const debuglog = fetchDebuglog.enabled ? fetchDebuglog : undiciDebugLog;

	  // Track all Client events
	  diagnosticsChannel.channel('undici:client:beforeConnect').subscribe(evt => {
	    const {
	      connectParams: { version, protocol, port, host }
	    } = evt;
	    debuglog(
	      'connecting to %s using %s%s',
	      `${host}${port ? `:${port}` : ''}`,
	      protocol,
	      version
	    );
	  });

	  diagnosticsChannel.channel('undici:client:connected').subscribe(evt => {
	    const {
	      connectParams: { version, protocol, port, host }
	    } = evt;
	    debuglog(
	      'connected to %s using %s%s',
	      `${host}${port ? `:${port}` : ''}`,
	      protocol,
	      version
	    );
	  });

	  diagnosticsChannel.channel('undici:client:connectError').subscribe(evt => {
	    const {
	      connectParams: { version, protocol, port, host },
	      error
	    } = evt;
	    debuglog(
	      'connection to %s using %s%s errored - %s',
	      `${host}${port ? `:${port}` : ''}`,
	      protocol,
	      version,
	      error.message
	    );
	  });

	  diagnosticsChannel.channel('undici:client:sendHeaders').subscribe(evt => {
	    const {
	      request: { method, path, origin }
	    } = evt;
	    debuglog('sending request to %s %s/%s', method, origin, path);
	  });

	  // Track Request events
	  diagnosticsChannel.channel('undici:request:headers').subscribe(evt => {
	    const {
	      request: { method, path, origin },
	      response: { statusCode }
	    } = evt;
	    debuglog(
	      'received response to %s %s/%s - HTTP %d',
	      method,
	      origin,
	      path,
	      statusCode
	    );
	  });

	  diagnosticsChannel.channel('undici:request:trailers').subscribe(evt => {
	    const {
	      request: { method, path, origin }
	    } = evt;
	    debuglog('trailers received from %s %s/%s', method, origin, path);
	  });

	  diagnosticsChannel.channel('undici:request:error').subscribe(evt => {
	    const {
	      request: { method, path, origin },
	      error
	    } = evt;
	    debuglog(
	      'request to %s %s/%s errored - %s',
	      method,
	      origin,
	      path,
	      error.message
	    );
	  });

	  isClientSet = true;
	}

	if (websocketDebuglog.enabled) {
	  if (!isClientSet) {
	    const debuglog = undiciDebugLog.enabled ? undiciDebugLog : websocketDebuglog;
	    diagnosticsChannel.channel('undici:client:beforeConnect').subscribe(evt => {
	      const {
	        connectParams: { version, protocol, port, host }
	      } = evt;
	      debuglog(
	        'connecting to %s%s using %s%s',
	        host,
	        port ? `:${port}` : '',
	        protocol,
	        version
	      );
	    });

	    diagnosticsChannel.channel('undici:client:connected').subscribe(evt => {
	      const {
	        connectParams: { version, protocol, port, host }
	      } = evt;
	      debuglog(
	        'connected to %s%s using %s%s',
	        host,
	        port ? `:${port}` : '',
	        protocol,
	        version
	      );
	    });

	    diagnosticsChannel.channel('undici:client:connectError').subscribe(evt => {
	      const {
	        connectParams: { version, protocol, port, host },
	        error
	      } = evt;
	      debuglog(
	        'connection to %s%s using %s%s errored - %s',
	        host,
	        port ? `:${port}` : '',
	        protocol,
	        version,
	        error.message
	      );
	    });

	    diagnosticsChannel.channel('undici:client:sendHeaders').subscribe(evt => {
	      const {
	        request: { method, path, origin }
	      } = evt;
	      debuglog('sending request to %s %s/%s', method, origin, path);
	    });
	  }

	  // Track all WebSocket events
	  diagnosticsChannel.channel('undici:websocket:open').subscribe(evt => {
	    const {
	      address: { address, port }
	    } = evt;
	    websocketDebuglog('connection opened %s%s', address, port ? `:${port}` : '');
	  });

	  diagnosticsChannel.channel('undici:websocket:close').subscribe(evt => {
	    const { websocket, code, reason } = evt;
	    websocketDebuglog(
	      'closed connection to %s - %s %s',
	      websocket.url,
	      code,
	      reason
	    );
	  });

	  diagnosticsChannel.channel('undici:websocket:socket_error').subscribe(err => {
	    websocketDebuglog('connection errored - %s', err.message);
	  });

	  diagnosticsChannel.channel('undici:websocket:ping').subscribe(evt => {
	    websocketDebuglog('ping received');
	  });

	  diagnosticsChannel.channel('undici:websocket:pong').subscribe(evt => {
	    websocketDebuglog('pong received');
	  });
	}

	diagnostics = {
	  channels
	};
	return diagnostics;
}

var request$2;
var hasRequiredRequest$1;

function requireRequest$1 () {
	if (hasRequiredRequest$1) return request$2;
	hasRequiredRequest$1 = 1;

	const {
	  InvalidArgumentError,
	  NotSupportedError
	} = requireErrors$1();
	const assert = require$$0$2;
	const {
	  isValidHTTPToken,
	  isValidHeaderValue,
	  isStream,
	  destroy,
	  isBuffer,
	  isFormDataLike,
	  isIterable,
	  isBlobLike,
	  buildURL,
	  validateHandler,
	  getServerName,
	  normalizedMethodRecords
	} = requireUtil$7();
	const { channels } = requireDiagnostics();
	const { headerNameLowerCasedRecord } = requireConstants$4();

	// Verifies that a given path is valid does not contain control chars \x00 to \x20
	const invalidPathRegex = /[^\u0021-\u00ff]/;

	const kHandler = Symbol('handler');

	class Request {
	  constructor (origin, {
	    path,
	    method,
	    body,
	    headers,
	    query,
	    idempotent,
	    blocking,
	    upgrade,
	    headersTimeout,
	    bodyTimeout,
	    reset,
	    throwOnError,
	    expectContinue,
	    servername
	  }, handler) {
	    if (typeof path !== 'string') {
	      throw new InvalidArgumentError('path must be a string')
	    } else if (
	      path[0] !== '/' &&
	      !(path.startsWith('http://') || path.startsWith('https://')) &&
	      method !== 'CONNECT'
	    ) {
	      throw new InvalidArgumentError('path must be an absolute URL or start with a slash')
	    } else if (invalidPathRegex.test(path)) {
	      throw new InvalidArgumentError('invalid request path')
	    }

	    if (typeof method !== 'string') {
	      throw new InvalidArgumentError('method must be a string')
	    } else if (normalizedMethodRecords[method] === undefined && !isValidHTTPToken(method)) {
	      throw new InvalidArgumentError('invalid request method')
	    }

	    if (upgrade && typeof upgrade !== 'string') {
	      throw new InvalidArgumentError('upgrade must be a string')
	    }

	    if (upgrade && !isValidHeaderValue(upgrade)) {
	      throw new InvalidArgumentError('invalid upgrade header')
	    }

	    if (headersTimeout != null && (!Number.isFinite(headersTimeout) || headersTimeout < 0)) {
	      throw new InvalidArgumentError('invalid headersTimeout')
	    }

	    if (bodyTimeout != null && (!Number.isFinite(bodyTimeout) || bodyTimeout < 0)) {
	      throw new InvalidArgumentError('invalid bodyTimeout')
	    }

	    if (reset != null && typeof reset !== 'boolean') {
	      throw new InvalidArgumentError('invalid reset')
	    }

	    if (expectContinue != null && typeof expectContinue !== 'boolean') {
	      throw new InvalidArgumentError('invalid expectContinue')
	    }

	    this.headersTimeout = headersTimeout;

	    this.bodyTimeout = bodyTimeout;

	    this.throwOnError = throwOnError === true;

	    this.method = method;

	    this.abort = null;

	    if (body == null) {
	      this.body = null;
	    } else if (isStream(body)) {
	      this.body = body;

	      const rState = this.body._readableState;
	      if (!rState || !rState.autoDestroy) {
	        this.endHandler = function autoDestroy () {
	          destroy(this);
	        };
	        this.body.on('end', this.endHandler);
	      }

	      this.errorHandler = err => {
	        if (this.abort) {
	          this.abort(err);
	        } else {
	          this.error = err;
	        }
	      };
	      this.body.on('error', this.errorHandler);
	    } else if (isBuffer(body)) {
	      this.body = body.byteLength ? body : null;
	    } else if (ArrayBuffer.isView(body)) {
	      this.body = body.buffer.byteLength ? Buffer.from(body.buffer, body.byteOffset, body.byteLength) : null;
	    } else if (body instanceof ArrayBuffer) {
	      this.body = body.byteLength ? Buffer.from(body) : null;
	    } else if (typeof body === 'string') {
	      this.body = body.length ? Buffer.from(body) : null;
	    } else if (isFormDataLike(body) || isIterable(body) || isBlobLike(body)) {
	      this.body = body;
	    } else {
	      throw new InvalidArgumentError('body must be a string, a Buffer, a Readable stream, an iterable, or an async iterable')
	    }

	    this.completed = false;

	    this.aborted = false;

	    this.upgrade = upgrade || null;

	    this.path = query ? buildURL(path, query) : path;

	    this.origin = origin;

	    this.idempotent = idempotent == null
	      ? method === 'HEAD' || method === 'GET'
	      : idempotent;

	    this.blocking = blocking == null ? false : blocking;

	    this.reset = reset == null ? null : reset;

	    this.host = null;

	    this.contentLength = null;

	    this.contentType = null;

	    this.headers = [];

	    // Only for H2
	    this.expectContinue = expectContinue != null ? expectContinue : false;

	    if (Array.isArray(headers)) {
	      if (headers.length % 2 !== 0) {
	        throw new InvalidArgumentError('headers array must be even')
	      }
	      for (let i = 0; i < headers.length; i += 2) {
	        processHeader(this, headers[i], headers[i + 1]);
	      }
	    } else if (headers && typeof headers === 'object') {
	      if (headers[Symbol.iterator]) {
	        for (const header of headers) {
	          if (!Array.isArray(header) || header.length !== 2) {
	            throw new InvalidArgumentError('headers must be in key-value pair format')
	          }
	          processHeader(this, header[0], header[1]);
	        }
	      } else {
	        const keys = Object.keys(headers);
	        for (let i = 0; i < keys.length; ++i) {
	          processHeader(this, keys[i], headers[keys[i]]);
	        }
	      }
	    } else if (headers != null) {
	      throw new InvalidArgumentError('headers must be an object or an array')
	    }

	    validateHandler(handler, method, upgrade);

	    this.servername = servername || getServerName(this.host);

	    this[kHandler] = handler;

	    if (channels.create.hasSubscribers) {
	      channels.create.publish({ request: this });
	    }
	  }

	  onBodySent (chunk) {
	    if (this[kHandler].onBodySent) {
	      try {
	        return this[kHandler].onBodySent(chunk)
	      } catch (err) {
	        this.abort(err);
	      }
	    }
	  }

	  onRequestSent () {
	    if (channels.bodySent.hasSubscribers) {
	      channels.bodySent.publish({ request: this });
	    }

	    if (this[kHandler].onRequestSent) {
	      try {
	        return this[kHandler].onRequestSent()
	      } catch (err) {
	        this.abort(err);
	      }
	    }
	  }

	  onConnect (abort) {
	    assert(!this.aborted);
	    assert(!this.completed);

	    if (this.error) {
	      abort(this.error);
	    } else {
	      this.abort = abort;
	      return this[kHandler].onConnect(abort)
	    }
	  }

	  onResponseStarted () {
	    return this[kHandler].onResponseStarted?.()
	  }

	  onHeaders (statusCode, headers, resume, statusText) {
	    assert(!this.aborted);
	    assert(!this.completed);

	    if (channels.headers.hasSubscribers) {
	      channels.headers.publish({ request: this, response: { statusCode, headers, statusText } });
	    }

	    try {
	      return this[kHandler].onHeaders(statusCode, headers, resume, statusText)
	    } catch (err) {
	      this.abort(err);
	    }
	  }

	  onData (chunk) {
	    assert(!this.aborted);
	    assert(!this.completed);

	    try {
	      return this[kHandler].onData(chunk)
	    } catch (err) {
	      this.abort(err);
	      return false
	    }
	  }

	  /**
	   * @param {number|null} statusCode
	   * @param {Buffer[]|null} headers
	   * @param {import('node:stream').Duplex} socket
	   * @param {string} [statusText]
	   */
	  onUpgrade (statusCode, headers, socket, statusText = '') {
	    this.onFinally();

	    assert(!this.aborted);
	    assert(!this.completed);

	    if (statusCode !== null) {
	      this.#publishUpgradeHeaders(statusCode, headers, statusText);
	    }

	    const result = this[kHandler].onUpgrade(statusCode, headers, socket);

	    if (!this.aborted) {
	      this.completed = true;
	      if (statusCode !== null) {
	        this.#publishUpgradeTrailers();
	      }
	    }

	    return result
	  }

	  /**
	   * @param {number} statusCode
	   * @param {import('node:http2').IncomingHttpHeaders} headers
	   * @param {(headers: import('node:http2').IncomingHttpHeaders) => Buffer[]} parseHeaders
	   * @param {string} [statusText]
	   */
	  onUpgradeResponse (statusCode, headers, parseHeaders, statusText = '') {
	    assert(!this.aborted);
	    assert(this.completed);

	    if (channels.headers.hasSubscribers) {
	      this.#publishUpgradeHeaders(statusCode, parseHeaders(headers), statusText);
	    }
	    this.#publishUpgradeTrailers();
	  }

	  /**
	   * @param {Error} error
	   */
	  onUpgradeError (error) {
	    assert(!this.aborted);
	    assert(this.completed);

	    if (channels.error.hasSubscribers) {
	      channels.error.publish({ request: this, error });
	    }
	  }

	  /**
	   * @param {number} statusCode
	   * @param {Buffer[]} headers
	   * @param {string} statusText
	   */
	  #publishUpgradeHeaders (statusCode, headers, statusText) {
	    if (channels.headers.hasSubscribers) {
	      channels.headers.publish({ request: this, response: { statusCode, headers, statusText } });
	    }
	  }

	  #publishUpgradeTrailers () {
	    if (channels.trailers.hasSubscribers) {
	      channels.trailers.publish({ request: this, trailers: [] });
	    }
	  }

	  onComplete (trailers) {
	    this.onFinally();

	    assert(!this.aborted);

	    this.completed = true;
	    if (channels.trailers.hasSubscribers) {
	      channels.trailers.publish({ request: this, trailers });
	    }

	    try {
	      return this[kHandler].onComplete(trailers)
	    } catch (err) {
	      // TODO (fix): This might be a bad idea?
	      this.onError(err);
	    }
	  }

	  onError (error) {
	    this.onFinally();

	    if (channels.error.hasSubscribers) {
	      channels.error.publish({ request: this, error });
	    }

	    if (this.aborted) {
	      return
	    }
	    this.aborted = true;

	    return this[kHandler].onError(error)
	  }

	  onFinally () {
	    if (this.errorHandler) {
	      this.body.off('error', this.errorHandler);
	      this.errorHandler = null;
	    }

	    if (this.endHandler) {
	      this.body.off('end', this.endHandler);
	      this.endHandler = null;
	    }
	  }

	  addHeader (key, value) {
	    processHeader(this, key, value);
	    return this
	  }
	}

	function processHeader (request, key, val) {
	  if (val && (typeof val === 'object' && !Array.isArray(val))) {
	    throw new InvalidArgumentError(`invalid ${key} header`)
	  } else if (val === undefined) {
	    return
	  }

	  let headerName = headerNameLowerCasedRecord[key];

	  if (headerName === undefined) {
	    headerName = key.toLowerCase();
	    if (headerNameLowerCasedRecord[headerName] === undefined && !isValidHTTPToken(headerName)) {
	      throw new InvalidArgumentError('invalid header key')
	    }
	  }

	  if (Array.isArray(val)) {
	    const arr = [];
	    for (let i = 0; i < val.length; i++) {
	      if (typeof val[i] === 'string') {
	        if (!isValidHeaderValue(val[i])) {
	          throw new InvalidArgumentError(`invalid ${key} header`)
	        }
	        arr.push(val[i]);
	      } else if (val[i] === null) {
	        arr.push('');
	      } else if (typeof val[i] === 'object') {
	        throw new InvalidArgumentError(`invalid ${key} header`)
	      } else {
	        // Coerce primitives (and reject unsafe coercions such as functions
	        // with a crafted toString/Symbol.toPrimitive).
	        const str = `${val[i]}`;
	        if (!isValidHeaderValue(str)) {
	          throw new InvalidArgumentError(`invalid ${key} header`)
	        }
	        arr.push(str);
	      }
	    }
	    val = arr;
	  } else if (typeof val === 'string') {
	    if (!isValidHeaderValue(val)) {
	      throw new InvalidArgumentError(`invalid ${key} header`)
	    }
	  } else if (val === null) {
	    val = '';
	  } else {
	    // Coerce primitives (and reject unsafe coercions such as functions
	    // with a crafted toString/Symbol.toPrimitive).
	    val = `${val}`;
	    if (!isValidHeaderValue(val)) {
	      throw new InvalidArgumentError(`invalid ${key} header`)
	    }
	  }

	  if (headerName === 'host') {
	    if (request.host !== null) {
	      throw new InvalidArgumentError('duplicate host header')
	    }
	    if (typeof val !== 'string') {
	      throw new InvalidArgumentError('invalid host header')
	    }
	    // Consumed by Client
	    request.host = val;
	  } else if (headerName === 'content-length') {
	    if (request.contentLength !== null) {
	      throw new InvalidArgumentError('duplicate content-length header')
	    }
	    request.contentLength = parseInt(val, 10);
	    if (!Number.isFinite(request.contentLength)) {
	      throw new InvalidArgumentError('invalid content-length header')
	    }
	  } else if (request.contentType === null && headerName === 'content-type') {
	    request.contentType = val;
	    request.headers.push(key, val);
	  } else if (headerName === 'transfer-encoding' || headerName === 'keep-alive' || headerName === 'upgrade') {
	    throw new InvalidArgumentError(`invalid ${headerName} header`)
	  } else if (headerName === 'connection') {
	    const value = typeof val === 'string' ? val.toLowerCase() : null;
	    if (value !== 'close' && value !== 'keep-alive') {
	      throw new InvalidArgumentError('invalid connection header')
	    }

	    if (value === 'close') {
	      request.reset = true;
	    }
	  } else if (headerName === 'expect') {
	    throw new NotSupportedError('expect header not supported')
	  } else {
	    request.headers.push(key, val);
	  }
	}

	request$2 = Request;
	return request$2;
}

var dispatcher;
var hasRequiredDispatcher;

function requireDispatcher () {
	if (hasRequiredDispatcher) return dispatcher;
	hasRequiredDispatcher = 1;
	const EventEmitter = require$$8;

	class Dispatcher extends EventEmitter {
	  dispatch () {
	    throw new Error('not implemented')
	  }

	  close () {
	    throw new Error('not implemented')
	  }

	  destroy () {
	    throw new Error('not implemented')
	  }

	  compose (...args) {
	    // So we handle [interceptor1, interceptor2] or interceptor1, interceptor2, ...
	    const interceptors = Array.isArray(args[0]) ? args[0] : args;
	    let dispatch = this.dispatch.bind(this);

	    for (const interceptor of interceptors) {
	      if (interceptor == null) {
	        continue
	      }

	      if (typeof interceptor !== 'function') {
	        throw new TypeError(`invalid interceptor, expected function received ${typeof interceptor}`)
	      }

	      dispatch = interceptor(dispatch);

	      if (dispatch == null || typeof dispatch !== 'function' || dispatch.length !== 2) {
	        throw new TypeError('invalid interceptor')
	      }
	    }

	    return new ComposedDispatcher(this, dispatch)
	  }
	}

	class ComposedDispatcher extends Dispatcher {
	  #dispatcher = null
	  #dispatch = null

	  constructor (dispatcher, dispatch) {
	    super();
	    this.#dispatcher = dispatcher;
	    this.#dispatch = dispatch;
	  }

	  dispatch (...args) {
	    this.#dispatch(...args);
	  }

	  close (...args) {
	    return this.#dispatcher.close(...args)
	  }

	  destroy (...args) {
	    return this.#dispatcher.destroy(...args)
	  }
	}

	dispatcher = Dispatcher;
	return dispatcher;
}

var dispatcherBase;
var hasRequiredDispatcherBase;

function requireDispatcherBase () {
	if (hasRequiredDispatcherBase) return dispatcherBase;
	hasRequiredDispatcherBase = 1;

	const Dispatcher = requireDispatcher();
	const {
	  ClientDestroyedError,
	  ClientClosedError,
	  InvalidArgumentError
	} = requireErrors$1();
	const { kDestroy, kClose, kClosed, kDestroyed, kDispatch, kInterceptors } = requireSymbols$4();

	const kOnDestroyed = Symbol('onDestroyed');
	const kOnClosed = Symbol('onClosed');
	const kInterceptedDispatch = Symbol('Intercepted Dispatch');
	const kWebSocketOptions = Symbol('webSocketOptions');

	class DispatcherBase extends Dispatcher {
	  constructor (opts) {
	    super();

	    this[kDestroyed] = false;
	    this[kOnDestroyed] = null;
	    this[kClosed] = false;
	    this[kOnClosed] = [];
	    this[kWebSocketOptions] = opts?.webSocket ?? {};
	  }

	  get webSocketOptions () {
	    return {
	      maxFragments: this[kWebSocketOptions].maxFragments ?? 131072,
	      maxPayloadSize: this[kWebSocketOptions].maxPayloadSize ?? 128 * 1024 * 1024
	    }
	  }

	  get destroyed () {
	    return this[kDestroyed]
	  }

	  get closed () {
	    return this[kClosed]
	  }

	  get interceptors () {
	    return this[kInterceptors]
	  }

	  set interceptors (newInterceptors) {
	    if (newInterceptors) {
	      for (let i = newInterceptors.length - 1; i >= 0; i--) {
	        const interceptor = this[kInterceptors][i];
	        if (typeof interceptor !== 'function') {
	          throw new InvalidArgumentError('interceptor must be an function')
	        }
	      }
	    }

	    this[kInterceptors] = newInterceptors;
	  }

	  close (callback) {
	    if (callback === undefined) {
	      return new Promise((resolve, reject) => {
	        this.close((err, data) => {
	          return err ? reject(err) : resolve(data)
	        });
	      })
	    }

	    if (typeof callback !== 'function') {
	      throw new InvalidArgumentError('invalid callback')
	    }

	    if (this[kDestroyed]) {
	      queueMicrotask(() => callback(new ClientDestroyedError(), null));
	      return
	    }

	    if (this[kClosed]) {
	      if (this[kOnClosed]) {
	        this[kOnClosed].push(callback);
	      } else {
	        queueMicrotask(() => callback(null, null));
	      }
	      return
	    }

	    this[kClosed] = true;
	    this[kOnClosed].push(callback);

	    const onClosed = () => {
	      const callbacks = this[kOnClosed];
	      this[kOnClosed] = null;
	      for (let i = 0; i < callbacks.length; i++) {
	        callbacks[i](null, null);
	      }
	    };

	    // Should not error.
	    this[kClose]()
	      .then(() => this.destroy())
	      .then(() => {
	        queueMicrotask(onClosed);
	      });
	  }

	  destroy (err, callback) {
	    if (typeof err === 'function') {
	      callback = err;
	      err = null;
	    }

	    if (callback === undefined) {
	      return new Promise((resolve, reject) => {
	        this.destroy(err, (err, data) => {
	          return err ? /* istanbul ignore next: should never error */ reject(err) : resolve(data)
	        });
	      })
	    }

	    if (typeof callback !== 'function') {
	      throw new InvalidArgumentError('invalid callback')
	    }

	    if (this[kDestroyed]) {
	      if (this[kOnDestroyed]) {
	        this[kOnDestroyed].push(callback);
	      } else {
	        queueMicrotask(() => callback(null, null));
	      }
	      return
	    }

	    if (!err) {
	      err = new ClientDestroyedError();
	    }

	    this[kDestroyed] = true;
	    this[kOnDestroyed] = this[kOnDestroyed] || [];
	    this[kOnDestroyed].push(callback);

	    const onDestroyed = () => {
	      const callbacks = this[kOnDestroyed];
	      this[kOnDestroyed] = null;
	      for (let i = 0; i < callbacks.length; i++) {
	        callbacks[i](null, null);
	      }
	    };

	    // Should not error.
	    this[kDestroy](err).then(() => {
	      queueMicrotask(onDestroyed);
	    });
	  }

	  [kInterceptedDispatch] (opts, handler) {
	    if (!this[kInterceptors] || this[kInterceptors].length === 0) {
	      this[kInterceptedDispatch] = this[kDispatch];
	      return this[kDispatch](opts, handler)
	    }

	    let dispatch = this[kDispatch].bind(this);
	    for (let i = this[kInterceptors].length - 1; i >= 0; i--) {
	      dispatch = this[kInterceptors][i](dispatch);
	    }
	    this[kInterceptedDispatch] = dispatch;
	    return dispatch(opts, handler)
	  }

	  dispatch (opts, handler) {
	    if (!handler || typeof handler !== 'object') {
	      throw new InvalidArgumentError('handler must be an object')
	    }

	    try {
	      if (!opts || typeof opts !== 'object') {
	        throw new InvalidArgumentError('opts must be an object.')
	      }

	      if (this[kDestroyed] || this[kOnDestroyed]) {
	        throw new ClientDestroyedError()
	      }

	      if (this[kClosed]) {
	        throw new ClientClosedError()
	      }

	      return this[kInterceptedDispatch](opts, handler)
	    } catch (err) {
	      if (typeof handler.onError !== 'function') {
	        throw new InvalidArgumentError('invalid onError method')
	      }

	      handler.onError(err);

	      return false
	    }
	  }
	}

	dispatcherBase = DispatcherBase;
	return dispatcherBase;
}

var timers;
var hasRequiredTimers;

function requireTimers () {
	if (hasRequiredTimers) return timers;
	hasRequiredTimers = 1;

	/**
	 * This module offers an optimized timer implementation designed for scenarios
	 * where high precision is not critical.
	 *
	 * The timer achieves faster performance by using a low-resolution approach,
	 * with an accuracy target of within 500ms. This makes it particularly useful
	 * for timers with delays of 1 second or more, where exact timing is less
	 * crucial.
	 *
	 * It's important to note that Node.js timers are inherently imprecise, as
	 * delays can occur due to the event loop being blocked by other operations.
	 * Consequently, timers may trigger later than their scheduled time.
	 */

	/**
	 * The fastNow variable contains the internal fast timer clock value.
	 *
	 * @type {number}
	 */
	let fastNow = 0;

	/**
	 * RESOLUTION_MS represents the target resolution time in milliseconds.
	 *
	 * @type {number}
	 * @default 1000
	 */
	const RESOLUTION_MS = 1e3;

	/**
	 * TICK_MS defines the desired interval in milliseconds between each tick.
	 * The target value is set to half the resolution time, minus 1 ms, to account
	 * for potential event loop overhead.
	 *
	 * @type {number}
	 * @default 499
	 */
	const TICK_MS = (RESOLUTION_MS >> 1) - 1;

	/**
	 * fastNowTimeout is a Node.js timer used to manage and process
	 * the FastTimers stored in the `fastTimers` array.
	 *
	 * @type {NodeJS.Timeout}
	 */
	let fastNowTimeout;

	/**
	 * The kFastTimer symbol is used to identify FastTimer instances.
	 *
	 * @type {Symbol}
	 */
	const kFastTimer = Symbol('kFastTimer');

	/**
	 * The fastTimers array contains all active FastTimers.
	 *
	 * @type {FastTimer[]}
	 */
	const fastTimers = [];

	/**
	 * These constants represent the various states of a FastTimer.
	 */

	/**
	 * The `NOT_IN_LIST` constant indicates that the FastTimer is not included
	 * in the `fastTimers` array. Timers with this status will not be processed
	 * during the next tick by the `onTick` function.
	 *
	 * A FastTimer can be re-added to the `fastTimers` array by invoking the
	 * `refresh` method on the FastTimer instance.
	 *
	 * @type {-2}
	 */
	const NOT_IN_LIST = -2;

	/**
	 * The `TO_BE_CLEARED` constant indicates that the FastTimer is scheduled
	 * for removal from the `fastTimers` array. A FastTimer in this state will
	 * be removed in the next tick by the `onTick` function and will no longer
	 * be processed.
	 *
	 * This status is also set when the `clear` method is called on the FastTimer instance.
	 *
	 * @type {-1}
	 */
	const TO_BE_CLEARED = -1;

	/**
	 * The `PENDING` constant signifies that the FastTimer is awaiting processing
	 * in the next tick by the `onTick` function. Timers with this status will have
	 * their `_idleStart` value set and their status updated to `ACTIVE` in the next tick.
	 *
	 * @type {0}
	 */
	const PENDING = 0;

	/**
	 * The `ACTIVE` constant indicates that the FastTimer is active and waiting
	 * for its timer to expire. During the next tick, the `onTick` function will
	 * check if the timer has expired, and if so, it will execute the associated callback.
	 *
	 * @type {1}
	 */
	const ACTIVE = 1;

	/**
	 * The onTick function processes the fastTimers array.
	 *
	 * @returns {void}
	 */
	function onTick () {
	  /**
	   * Increment the fastNow value by the TICK_MS value, despite the actual time
	   * that has passed since the last tick. This approach ensures independence
	   * from the system clock and delays caused by a blocked event loop.
	   *
	   * @type {number}
	   */
	  fastNow += TICK_MS;

	  /**
	   * The `idx` variable is used to iterate over the `fastTimers` array.
	   * Expired timers are removed by replacing them with the last element in the array.
	   * Consequently, `idx` is only incremented when the current element is not removed.
	   *
	   * @type {number}
	   */
	  let idx = 0;

	  /**
	   * The len variable will contain the length of the fastTimers array
	   * and will be decremented when a FastTimer should be removed from the
	   * fastTimers array.
	   *
	   * @type {number}
	   */
	  let len = fastTimers.length;

	  while (idx < len) {
	    /**
	     * @type {FastTimer}
	     */
	    const timer = fastTimers[idx];

	    // If the timer is in the ACTIVE state and the timer has expired, it will
	    // be processed in the next tick.
	    if (timer._state === PENDING) {
	      // Set the _idleStart value to the fastNow value minus the TICK_MS value
	      // to account for the time the timer was in the PENDING state.
	      timer._idleStart = fastNow - TICK_MS;
	      timer._state = ACTIVE;
	    } else if (
	      timer._state === ACTIVE &&
	      fastNow >= timer._idleStart + timer._idleTimeout
	    ) {
	      timer._state = TO_BE_CLEARED;
	      timer._idleStart = -1;
	      timer._onTimeout(timer._timerArg);
	    }

	    if (timer._state === TO_BE_CLEARED) {
	      timer._state = NOT_IN_LIST;

	      // Move the last element to the current index and decrement len if it is
	      // not the only element in the array.
	      if (--len !== 0) {
	        fastTimers[idx] = fastTimers[len];
	      }
	    } else {
	      ++idx;
	    }
	  }

	  // Set the length of the fastTimers array to the new length and thus
	  // removing the excess FastTimers elements from the array.
	  fastTimers.length = len;

	  // If there are still active FastTimers in the array, refresh the Timer.
	  // If there are no active FastTimers, the timer will be refreshed again
	  // when a new FastTimer is instantiated.
	  if (fastTimers.length !== 0) {
	    refreshTimeout();
	  }
	}

	function refreshTimeout () {
	  // If the fastNowTimeout is already set, refresh it.
	  if (fastNowTimeout) {
	    fastNowTimeout.refresh();
	  // fastNowTimeout is not instantiated yet, create a new Timer.
	  } else {
	    clearTimeout(fastNowTimeout);
	    fastNowTimeout = setTimeout(onTick, TICK_MS);

	    // If the Timer has an unref method, call it to allow the process to exit if
	    // there are no other active handles.
	    if (fastNowTimeout.unref) {
	      fastNowTimeout.unref();
	    }
	  }
	}

	/**
	 * The `FastTimer` class is a data structure designed to store and manage
	 * timer information.
	 */
	class FastTimer {
	  [kFastTimer] = true

	  /**
	   * The state of the timer, which can be one of the following:
	   * - NOT_IN_LIST (-2)
	   * - TO_BE_CLEARED (-1)
	   * - PENDING (0)
	   * - ACTIVE (1)
	   *
	   * @type {-2|-1|0|1}
	   * @private
	   */
	  _state = NOT_IN_LIST

	  /**
	   * The number of milliseconds to wait before calling the callback.
	   *
	   * @type {number}
	   * @private
	   */
	  _idleTimeout = -1

	  /**
	   * The time in milliseconds when the timer was started. This value is used to
	   * calculate when the timer should expire.
	   *
	   * @type {number}
	   * @default -1
	   * @private
	   */
	  _idleStart = -1

	  /**
	   * The function to be executed when the timer expires.
	   * @type {Function}
	   * @private
	   */
	  _onTimeout

	  /**
	   * The argument to be passed to the callback when the timer expires.
	   *
	   * @type {*}
	   * @private
	   */
	  _timerArg

	  /**
	   * @constructor
	   * @param {Function} callback A function to be executed after the timer
	   * expires.
	   * @param {number} delay The time, in milliseconds that the timer should wait
	   * before the specified function or code is executed.
	   * @param {*} arg
	   */
	  constructor (callback, delay, arg) {
	    this._onTimeout = callback;
	    this._idleTimeout = delay;
	    this._timerArg = arg;

	    this.refresh();
	  }

	  /**
	   * Sets the timer's start time to the current time, and reschedules the timer
	   * to call its callback at the previously specified duration adjusted to the
	   * current time.
	   * Using this on a timer that has already called its callback will reactivate
	   * the timer.
	   *
	   * @returns {void}
	   */
	  refresh () {
	    // In the special case that the timer is not in the list of active timers,
	    // add it back to the array to be processed in the next tick by the onTick
	    // function.
	    if (this._state === NOT_IN_LIST) {
	      fastTimers.push(this);
	    }

	    // If the timer is the only active timer, refresh the fastNowTimeout for
	    // better resolution.
	    if (!fastNowTimeout || fastTimers.length === 1) {
	      refreshTimeout();
	    }

	    // Setting the state to PENDING will cause the timer to be reset in the
	    // next tick by the onTick function.
	    this._state = PENDING;
	  }

	  /**
	   * The `clear` method cancels the timer, preventing it from executing.
	   *
	   * @returns {void}
	   * @private
	   */
	  clear () {
	    // Set the state to TO_BE_CLEARED to mark the timer for removal in the next
	    // tick by the onTick function.
	    this._state = TO_BE_CLEARED;

	    // Reset the _idleStart value to -1 to indicate that the timer is no longer
	    // active.
	    this._idleStart = -1;
	  }
	}

	/**
	 * This module exports a setTimeout and clearTimeout function that can be
	 * used as a drop-in replacement for the native functions.
	 */
	timers = {
	  /**
	   * The setTimeout() method sets a timer which executes a function once the
	   * timer expires.
	   * @param {Function} callback A function to be executed after the timer
	   * expires.
	   * @param {number} delay The time, in milliseconds that the timer should
	   * wait before the specified function or code is executed.
	   * @param {*} [arg] An optional argument to be passed to the callback function
	   * when the timer expires.
	   * @returns {NodeJS.Timeout|FastTimer}
	   */
	  setTimeout (callback, delay, arg) {
	    // If the delay is less than or equal to the RESOLUTION_MS value return a
	    // native Node.js Timer instance.
	    return delay <= RESOLUTION_MS
	      ? setTimeout(callback, delay, arg)
	      : new FastTimer(callback, delay, arg)
	  },
	  /**
	   * The clearTimeout method cancels an instantiated Timer previously created
	   * by calling setTimeout.
	   *
	   * @param {NodeJS.Timeout|FastTimer} timeout
	   */
	  clearTimeout (timeout) {
	    // If the timeout is a FastTimer, call its own clear method.
	    if (timeout[kFastTimer]) {
	      /**
	       * @type {FastTimer}
	       */
	      timeout.clear();
	      // Otherwise it is an instance of a native NodeJS.Timeout, so call the
	      // Node.js native clearTimeout function.
	    } else {
	      clearTimeout(timeout);
	    }
	  },
	  /**
	   * The setFastTimeout() method sets a fastTimer which executes a function once
	   * the timer expires.
	   * @param {Function} callback A function to be executed after the timer
	   * expires.
	   * @param {number} delay The time, in milliseconds that the timer should
	   * wait before the specified function or code is executed.
	   * @param {*} [arg] An optional argument to be passed to the callback function
	   * when the timer expires.
	   * @returns {FastTimer}
	   */
	  setFastTimeout (callback, delay, arg) {
	    return new FastTimer(callback, delay, arg)
	  },
	  /**
	   * The clearTimeout method cancels an instantiated FastTimer previously
	   * created by calling setFastTimeout.
	   *
	   * @param {FastTimer} timeout
	   */
	  clearFastTimeout (timeout) {
	    timeout.clear();
	  },
	  /**
	   * The now method returns the value of the internal fast timer clock.
	   *
	   * @returns {number}
	   */
	  now () {
	    return fastNow
	  },
	  /**
	   * Trigger the onTick function to process the fastTimers array.
	   * Exported for testing purposes only.
	   * Marking as deprecated to discourage any use outside of testing.
	   * @deprecated
	   * @param {number} [delay=0] The delay in milliseconds to add to the now value.
	   */
	  tick (delay = 0) {
	    fastNow += delay - RESOLUTION_MS + 1;
	    onTick();
	    onTick();
	  },
	  /**
	   * Reset FastTimers.
	   * Exported for testing purposes only.
	   * Marking as deprecated to discourage any use outside of testing.
	   * @deprecated
	   */
	  reset () {
	    fastNow = 0;
	    fastTimers.length = 0;
	    clearTimeout(fastNowTimeout);
	    fastNowTimeout = null;
	  },
	  /**
	   * Exporting for testing purposes only.
	   * Marking as deprecated to discourage any use outside of testing.
	   * @deprecated
	   */
	  kFastTimer
	};
	return timers;
}

var connect;
var hasRequiredConnect;

function requireConnect () {
	if (hasRequiredConnect) return connect;
	hasRequiredConnect = 1;

	const net = require$$0$4;
	const assert = require$$0$2;
	const util = requireUtil$7();
	const { InvalidArgumentError, ConnectTimeoutError } = requireErrors$1();
	const timers = requireTimers();

	function noop () {}

	let tls; // include tls conditionally since it is not always available

	// TODO: session re-use does not wait for the first
	// connection to resolve the session and might therefore
	// resolve the same servername multiple times even when
	// re-use is enabled.

	let SessionCache;
	// FIXME: remove workaround when the Node bug is fixed
	// https://github.com/nodejs/node/issues/49344#issuecomment-1741776308
	if (commonjsGlobal.FinalizationRegistry && !(process.env.NODE_V8_COVERAGE || process.env.UNDICI_NO_FG)) {
	  SessionCache = class WeakSessionCache {
	    constructor (maxCachedSessions) {
	      this._maxCachedSessions = maxCachedSessions;
	      this._sessionCache = new Map();
	      this._sessionRegistry = new commonjsGlobal.FinalizationRegistry((key) => {
	        if (this._sessionCache.size < this._maxCachedSessions) {
	          return
	        }

	        const ref = this._sessionCache.get(key);
	        if (ref !== undefined && ref.deref() === undefined) {
	          this._sessionCache.delete(key);
	        }
	      });
	    }

	    get (sessionKey) {
	      const ref = this._sessionCache.get(sessionKey);
	      return ref ? ref.deref() : null
	    }

	    set (sessionKey, session) {
	      if (this._maxCachedSessions === 0) {
	        return
	      }

	      this._sessionCache.set(sessionKey, new WeakRef(session));
	      this._sessionRegistry.register(session, sessionKey);
	    }
	  };
	} else {
	  SessionCache = class SimpleSessionCache {
	    constructor (maxCachedSessions) {
	      this._maxCachedSessions = maxCachedSessions;
	      this._sessionCache = new Map();
	    }

	    get (sessionKey) {
	      return this._sessionCache.get(sessionKey)
	    }

	    set (sessionKey, session) {
	      if (this._maxCachedSessions === 0) {
	        return
	      }

	      if (this._sessionCache.size >= this._maxCachedSessions) {
	        // remove the oldest session
	        const { value: oldestKey } = this._sessionCache.keys().next();
	        this._sessionCache.delete(oldestKey);
	      }

	      this._sessionCache.set(sessionKey, session);
	    }
	  };
	}

	function buildConnector ({ allowH2, maxCachedSessions, socketPath, timeout, session: customSession, ...opts }) {
	  if (maxCachedSessions != null && (!Number.isInteger(maxCachedSessions) || maxCachedSessions < 0)) {
	    throw new InvalidArgumentError('maxCachedSessions must be a positive integer or zero')
	  }

	  const options = { path: socketPath, ...opts };
	  const sessionCache = new SessionCache(maxCachedSessions == null ? 100 : maxCachedSessions);
	  timeout = timeout == null ? 10e3 : timeout;
	  allowH2 = allowH2 != null ? allowH2 : false;
	  return function connect ({ hostname, host, protocol, port, servername, localAddress, httpSocket }, callback) {
	    let socket;
	    if (protocol === 'https:') {
	      if (!tls) {
	        tls = require$$5;
	      }
	      servername = servername || options.servername || util.getServerName(host) || null;

	      const sessionKey = servername || hostname;
	      assert(sessionKey);

	      const session = customSession || sessionCache.get(sessionKey) || null;

	      port = port || 443;

	      socket = tls.connect({
	        highWaterMark: 16384, // TLS in node can't have bigger HWM anyway...
	        ...options,
	        servername,
	        session,
	        localAddress,
	        // TODO(HTTP/2): Add support for h2c
	        ALPNProtocols: allowH2 ? ['http/1.1', 'h2'] : ['http/1.1'],
	        socket: httpSocket, // upgrade socket connection
	        port,
	        host: hostname
	      });

	      socket
	        .on('session', function (session) {
	          // TODO (fix): Can a session become invalid once established? Don't think so?
	          sessionCache.set(sessionKey, session);
	        });
	    } else {
	      assert(!httpSocket, 'httpSocket can only be sent on TLS update');

	      port = port || 80;

	      socket = net.connect({
	        highWaterMark: 64 * 1024, // Same as nodejs fs streams.
	        ...options,
	        localAddress,
	        port,
	        host: hostname
	      });
	    }

	    // Set TCP keep alive options on the socket here instead of in connect() for the case of assigning the socket
	    if (options.keepAlive == null || options.keepAlive) {
	      const keepAliveInitialDelay = options.keepAliveInitialDelay === undefined ? 60e3 : options.keepAliveInitialDelay;
	      socket.setKeepAlive(true, keepAliveInitialDelay);
	    }

	    const clearConnectTimeout = setupConnectTimeout(new WeakRef(socket), { timeout, hostname, port });

	    socket
	      .setNoDelay(true)
	      .once(protocol === 'https:' ? 'secureConnect' : 'connect', function () {
	        queueMicrotask(clearConnectTimeout);

	        if (callback) {
	          const cb = callback;
	          callback = null;
	          cb(null, this);
	        }
	      })
	      .on('error', function (err) {
	        queueMicrotask(clearConnectTimeout);

	        if (callback) {
	          const cb = callback;
	          callback = null;
	          cb(err);
	        }
	      });

	    return socket
	  }
	}

	/**
	 * @param {WeakRef<net.Socket>} socketWeakRef
	 * @param {object} opts
	 * @param {number} opts.timeout
	 * @param {string} opts.hostname
	 * @param {number} opts.port
	 * @returns {() => void}
	 */
	const setupConnectTimeout = process.platform === 'win32'
	  ? (socketWeakRef, opts) => {
	      if (!opts.timeout) {
	        return noop
	      }

	      let s1 = null;
	      let s2 = null;
	      const fastTimer = timers.setFastTimeout(() => {
	      // setImmediate is added to make sure that we prioritize socket error events over timeouts
	        s1 = setImmediate(() => {
	        // Windows needs an extra setImmediate probably due to implementation differences in the socket logic
	          s2 = setImmediate(() => onConnectTimeout(socketWeakRef.deref(), opts));
	        });
	      }, opts.timeout);
	      return () => {
	        timers.clearFastTimeout(fastTimer);
	        clearImmediate(s1);
	        clearImmediate(s2);
	      }
	    }
	  : (socketWeakRef, opts) => {
	      if (!opts.timeout) {
	        return noop
	      }

	      let s1 = null;
	      const fastTimer = timers.setFastTimeout(() => {
	      // setImmediate is added to make sure that we prioritize socket error events over timeouts
	        s1 = setImmediate(() => {
	          onConnectTimeout(socketWeakRef.deref(), opts);
	        });
	      }, opts.timeout);
	      return () => {
	        timers.clearFastTimeout(fastTimer);
	        clearImmediate(s1);
	      }
	    };

	/**
	 * @param {net.Socket} socket
	 * @param {object} opts
	 * @param {number} opts.timeout
	 * @param {string} opts.hostname
	 * @param {number} opts.port
	 */
	function onConnectTimeout (socket, opts) {
	  // The socket could be already garbage collected
	  if (socket == null) {
	    return
	  }

	  let message = 'Connect Timeout Error';
	  if (Array.isArray(socket.autoSelectFamilyAttemptedAddresses)) {
	    message += ` (attempted addresses: ${socket.autoSelectFamilyAttemptedAddresses.join(', ')},`;
	  } else {
	    message += ` (attempted address: ${opts.hostname}:${opts.port},`;
	  }

	  message += ` timeout: ${opts.timeout}ms)`;

	  util.destroy(socket, new ConnectTimeoutError(message));
	}

	connect = buildConnector;
	return connect;
}

var constants$3 = {};

var utils$2 = {};

var hasRequiredUtils;

function requireUtils () {
	if (hasRequiredUtils) return utils$2;
	hasRequiredUtils = 1;
	Object.defineProperty(utils$2, "__esModule", { value: true });
	utils$2.enumToMap = void 0;
	function enumToMap(obj) {
	    const res = {};
	    Object.keys(obj).forEach((key) => {
	        const value = obj[key];
	        if (typeof value === 'number') {
	            res[key] = value;
	        }
	    });
	    return res;
	}
	utils$2.enumToMap = enumToMap;
	
	return utils$2;
}

var hasRequiredConstants$3;

function requireConstants$3 () {
	if (hasRequiredConstants$3) return constants$3;
	hasRequiredConstants$3 = 1;
	(function (exports) {
		Object.defineProperty(exports, "__esModule", { value: true });
		exports.SPECIAL_HEADERS = exports.HEADER_STATE = exports.MINOR = exports.MAJOR = exports.CONNECTION_TOKEN_CHARS = exports.HEADER_CHARS = exports.TOKEN = exports.STRICT_TOKEN = exports.HEX = exports.URL_CHAR = exports.STRICT_URL_CHAR = exports.USERINFO_CHARS = exports.MARK = exports.ALPHANUM = exports.NUM = exports.HEX_MAP = exports.NUM_MAP = exports.ALPHA = exports.FINISH = exports.H_METHOD_MAP = exports.METHOD_MAP = exports.METHODS_RTSP = exports.METHODS_ICE = exports.METHODS_HTTP = exports.METHODS = exports.LENIENT_FLAGS = exports.FLAGS = exports.TYPE = exports.ERROR = void 0;
		const utils_1 = requireUtils();
		(function (ERROR) {
		    ERROR[ERROR["OK"] = 0] = "OK";
		    ERROR[ERROR["INTERNAL"] = 1] = "INTERNAL";
		    ERROR[ERROR["STRICT"] = 2] = "STRICT";
		    ERROR[ERROR["LF_EXPECTED"] = 3] = "LF_EXPECTED";
		    ERROR[ERROR["UNEXPECTED_CONTENT_LENGTH"] = 4] = "UNEXPECTED_CONTENT_LENGTH";
		    ERROR[ERROR["CLOSED_CONNECTION"] = 5] = "CLOSED_CONNECTION";
		    ERROR[ERROR["INVALID_METHOD"] = 6] = "INVALID_METHOD";
		    ERROR[ERROR["INVALID_URL"] = 7] = "INVALID_URL";
		    ERROR[ERROR["INVALID_CONSTANT"] = 8] = "INVALID_CONSTANT";
		    ERROR[ERROR["INVALID_VERSION"] = 9] = "INVALID_VERSION";
		    ERROR[ERROR["INVALID_HEADER_TOKEN"] = 10] = "INVALID_HEADER_TOKEN";
		    ERROR[ERROR["INVALID_CONTENT_LENGTH"] = 11] = "INVALID_CONTENT_LENGTH";
		    ERROR[ERROR["INVALID_CHUNK_SIZE"] = 12] = "INVALID_CHUNK_SIZE";
		    ERROR[ERROR["INVALID_STATUS"] = 13] = "INVALID_STATUS";
		    ERROR[ERROR["INVALID_EOF_STATE"] = 14] = "INVALID_EOF_STATE";
		    ERROR[ERROR["INVALID_TRANSFER_ENCODING"] = 15] = "INVALID_TRANSFER_ENCODING";
		    ERROR[ERROR["CB_MESSAGE_BEGIN"] = 16] = "CB_MESSAGE_BEGIN";
		    ERROR[ERROR["CB_HEADERS_COMPLETE"] = 17] = "CB_HEADERS_COMPLETE";
		    ERROR[ERROR["CB_MESSAGE_COMPLETE"] = 18] = "CB_MESSAGE_COMPLETE";
		    ERROR[ERROR["CB_CHUNK_HEADER"] = 19] = "CB_CHUNK_HEADER";
		    ERROR[ERROR["CB_CHUNK_COMPLETE"] = 20] = "CB_CHUNK_COMPLETE";
		    ERROR[ERROR["PAUSED"] = 21] = "PAUSED";
		    ERROR[ERROR["PAUSED_UPGRADE"] = 22] = "PAUSED_UPGRADE";
		    ERROR[ERROR["PAUSED_H2_UPGRADE"] = 23] = "PAUSED_H2_UPGRADE";
		    ERROR[ERROR["USER"] = 24] = "USER";
		})(exports.ERROR || (exports.ERROR = {}));
		(function (TYPE) {
		    TYPE[TYPE["BOTH"] = 0] = "BOTH";
		    TYPE[TYPE["REQUEST"] = 1] = "REQUEST";
		    TYPE[TYPE["RESPONSE"] = 2] = "RESPONSE";
		})(exports.TYPE || (exports.TYPE = {}));
		(function (FLAGS) {
		    FLAGS[FLAGS["CONNECTION_KEEP_ALIVE"] = 1] = "CONNECTION_KEEP_ALIVE";
		    FLAGS[FLAGS["CONNECTION_CLOSE"] = 2] = "CONNECTION_CLOSE";
		    FLAGS[FLAGS["CONNECTION_UPGRADE"] = 4] = "CONNECTION_UPGRADE";
		    FLAGS[FLAGS["CHUNKED"] = 8] = "CHUNKED";
		    FLAGS[FLAGS["UPGRADE"] = 16] = "UPGRADE";
		    FLAGS[FLAGS["CONTENT_LENGTH"] = 32] = "CONTENT_LENGTH";
		    FLAGS[FLAGS["SKIPBODY"] = 64] = "SKIPBODY";
		    FLAGS[FLAGS["TRAILING"] = 128] = "TRAILING";
		    // 1 << 8 is unused
		    FLAGS[FLAGS["TRANSFER_ENCODING"] = 512] = "TRANSFER_ENCODING";
		})(exports.FLAGS || (exports.FLAGS = {}));
		(function (LENIENT_FLAGS) {
		    LENIENT_FLAGS[LENIENT_FLAGS["HEADERS"] = 1] = "HEADERS";
		    LENIENT_FLAGS[LENIENT_FLAGS["CHUNKED_LENGTH"] = 2] = "CHUNKED_LENGTH";
		    LENIENT_FLAGS[LENIENT_FLAGS["KEEP_ALIVE"] = 4] = "KEEP_ALIVE";
		})(exports.LENIENT_FLAGS || (exports.LENIENT_FLAGS = {}));
		var METHODS;
		(function (METHODS) {
		    METHODS[METHODS["DELETE"] = 0] = "DELETE";
		    METHODS[METHODS["GET"] = 1] = "GET";
		    METHODS[METHODS["HEAD"] = 2] = "HEAD";
		    METHODS[METHODS["POST"] = 3] = "POST";
		    METHODS[METHODS["PUT"] = 4] = "PUT";
		    /* pathological */
		    METHODS[METHODS["CONNECT"] = 5] = "CONNECT";
		    METHODS[METHODS["OPTIONS"] = 6] = "OPTIONS";
		    METHODS[METHODS["TRACE"] = 7] = "TRACE";
		    /* WebDAV */
		    METHODS[METHODS["COPY"] = 8] = "COPY";
		    METHODS[METHODS["LOCK"] = 9] = "LOCK";
		    METHODS[METHODS["MKCOL"] = 10] = "MKCOL";
		    METHODS[METHODS["MOVE"] = 11] = "MOVE";
		    METHODS[METHODS["PROPFIND"] = 12] = "PROPFIND";
		    METHODS[METHODS["PROPPATCH"] = 13] = "PROPPATCH";
		    METHODS[METHODS["SEARCH"] = 14] = "SEARCH";
		    METHODS[METHODS["UNLOCK"] = 15] = "UNLOCK";
		    METHODS[METHODS["BIND"] = 16] = "BIND";
		    METHODS[METHODS["REBIND"] = 17] = "REBIND";
		    METHODS[METHODS["UNBIND"] = 18] = "UNBIND";
		    METHODS[METHODS["ACL"] = 19] = "ACL";
		    /* subversion */
		    METHODS[METHODS["REPORT"] = 20] = "REPORT";
		    METHODS[METHODS["MKACTIVITY"] = 21] = "MKACTIVITY";
		    METHODS[METHODS["CHECKOUT"] = 22] = "CHECKOUT";
		    METHODS[METHODS["MERGE"] = 23] = "MERGE";
		    /* upnp */
		    METHODS[METHODS["M-SEARCH"] = 24] = "M-SEARCH";
		    METHODS[METHODS["NOTIFY"] = 25] = "NOTIFY";
		    METHODS[METHODS["SUBSCRIBE"] = 26] = "SUBSCRIBE";
		    METHODS[METHODS["UNSUBSCRIBE"] = 27] = "UNSUBSCRIBE";
		    /* RFC-5789 */
		    METHODS[METHODS["PATCH"] = 28] = "PATCH";
		    METHODS[METHODS["PURGE"] = 29] = "PURGE";
		    /* CalDAV */
		    METHODS[METHODS["MKCALENDAR"] = 30] = "MKCALENDAR";
		    /* RFC-2068, section 19.6.1.2 */
		    METHODS[METHODS["LINK"] = 31] = "LINK";
		    METHODS[METHODS["UNLINK"] = 32] = "UNLINK";
		    /* icecast */
		    METHODS[METHODS["SOURCE"] = 33] = "SOURCE";
		    /* RFC-7540, section 11.6 */
		    METHODS[METHODS["PRI"] = 34] = "PRI";
		    /* RFC-2326 RTSP */
		    METHODS[METHODS["DESCRIBE"] = 35] = "DESCRIBE";
		    METHODS[METHODS["ANNOUNCE"] = 36] = "ANNOUNCE";
		    METHODS[METHODS["SETUP"] = 37] = "SETUP";
		    METHODS[METHODS["PLAY"] = 38] = "PLAY";
		    METHODS[METHODS["PAUSE"] = 39] = "PAUSE";
		    METHODS[METHODS["TEARDOWN"] = 40] = "TEARDOWN";
		    METHODS[METHODS["GET_PARAMETER"] = 41] = "GET_PARAMETER";
		    METHODS[METHODS["SET_PARAMETER"] = 42] = "SET_PARAMETER";
		    METHODS[METHODS["REDIRECT"] = 43] = "REDIRECT";
		    METHODS[METHODS["RECORD"] = 44] = "RECORD";
		    /* RAOP */
		    METHODS[METHODS["FLUSH"] = 45] = "FLUSH";
		})(METHODS = exports.METHODS || (exports.METHODS = {}));
		exports.METHODS_HTTP = [
		    METHODS.DELETE,
		    METHODS.GET,
		    METHODS.HEAD,
		    METHODS.POST,
		    METHODS.PUT,
		    METHODS.CONNECT,
		    METHODS.OPTIONS,
		    METHODS.TRACE,
		    METHODS.COPY,
		    METHODS.LOCK,
		    METHODS.MKCOL,
		    METHODS.MOVE,
		    METHODS.PROPFIND,
		    METHODS.PROPPATCH,
		    METHODS.SEARCH,
		    METHODS.UNLOCK,
		    METHODS.BIND,
		    METHODS.REBIND,
		    METHODS.UNBIND,
		    METHODS.ACL,
		    METHODS.REPORT,
		    METHODS.MKACTIVITY,
		    METHODS.CHECKOUT,
		    METHODS.MERGE,
		    METHODS['M-SEARCH'],
		    METHODS.NOTIFY,
		    METHODS.SUBSCRIBE,
		    METHODS.UNSUBSCRIBE,
		    METHODS.PATCH,
		    METHODS.PURGE,
		    METHODS.MKCALENDAR,
		    METHODS.LINK,
		    METHODS.UNLINK,
		    METHODS.PRI,
		    // TODO(indutny): should we allow it with HTTP?
		    METHODS.SOURCE,
		];
		exports.METHODS_ICE = [
		    METHODS.SOURCE,
		];
		exports.METHODS_RTSP = [
		    METHODS.OPTIONS,
		    METHODS.DESCRIBE,
		    METHODS.ANNOUNCE,
		    METHODS.SETUP,
		    METHODS.PLAY,
		    METHODS.PAUSE,
		    METHODS.TEARDOWN,
		    METHODS.GET_PARAMETER,
		    METHODS.SET_PARAMETER,
		    METHODS.REDIRECT,
		    METHODS.RECORD,
		    METHODS.FLUSH,
		    // For AirPlay
		    METHODS.GET,
		    METHODS.POST,
		];
		exports.METHOD_MAP = utils_1.enumToMap(METHODS);
		exports.H_METHOD_MAP = {};
		Object.keys(exports.METHOD_MAP).forEach((key) => {
		    if (/^H/.test(key)) {
		        exports.H_METHOD_MAP[key] = exports.METHOD_MAP[key];
		    }
		});
		(function (FINISH) {
		    FINISH[FINISH["SAFE"] = 0] = "SAFE";
		    FINISH[FINISH["SAFE_WITH_CB"] = 1] = "SAFE_WITH_CB";
		    FINISH[FINISH["UNSAFE"] = 2] = "UNSAFE";
		})(exports.FINISH || (exports.FINISH = {}));
		exports.ALPHA = [];
		for (let i = 'A'.charCodeAt(0); i <= 'Z'.charCodeAt(0); i++) {
		    // Upper case
		    exports.ALPHA.push(String.fromCharCode(i));
		    // Lower case
		    exports.ALPHA.push(String.fromCharCode(i + 0x20));
		}
		exports.NUM_MAP = {
		    0: 0, 1: 1, 2: 2, 3: 3, 4: 4,
		    5: 5, 6: 6, 7: 7, 8: 8, 9: 9,
		};
		exports.HEX_MAP = {
		    0: 0, 1: 1, 2: 2, 3: 3, 4: 4,
		    5: 5, 6: 6, 7: 7, 8: 8, 9: 9,
		    A: 0XA, B: 0XB, C: 0XC, D: 0XD, E: 0XE, F: 0XF,
		    a: 0xa, b: 0xb, c: 0xc, d: 0xd, e: 0xe, f: 0xf,
		};
		exports.NUM = [
		    '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
		];
		exports.ALPHANUM = exports.ALPHA.concat(exports.NUM);
		exports.MARK = ['-', '_', '.', '!', '~', '*', '\'', '(', ')'];
		exports.USERINFO_CHARS = exports.ALPHANUM
		    .concat(exports.MARK)
		    .concat(['%', ';', ':', '&', '=', '+', '$', ',']);
		// TODO(indutny): use RFC
		exports.STRICT_URL_CHAR = [
		    '!', '"', '$', '%', '&', '\'',
		    '(', ')', '*', '+', ',', '-', '.', '/',
		    ':', ';', '<', '=', '>',
		    '@', '[', '\\', ']', '^', '_',
		    '`',
		    '{', '|', '}', '~',
		].concat(exports.ALPHANUM);
		exports.URL_CHAR = exports.STRICT_URL_CHAR
		    .concat(['\t', '\f']);
		// All characters with 0x80 bit set to 1
		for (let i = 0x80; i <= 0xff; i++) {
		    exports.URL_CHAR.push(i);
		}
		exports.HEX = exports.NUM.concat(['a', 'b', 'c', 'd', 'e', 'f', 'A', 'B', 'C', 'D', 'E', 'F']);
		/* Tokens as defined by rfc 2616. Also lowercases them.
		 *        token       = 1*<any CHAR except CTLs or separators>
		 *     separators     = "(" | ")" | "<" | ">" | "@"
		 *                    | "," | ";" | ":" | "\" | <">
		 *                    | "/" | "[" | "]" | "?" | "="
		 *                    | "{" | "}" | SP | HT
		 */
		exports.STRICT_TOKEN = [
		    '!', '#', '$', '%', '&', '\'',
		    '*', '+', '-', '.',
		    '^', '_', '`',
		    '|', '~',
		].concat(exports.ALPHANUM);
		exports.TOKEN = exports.STRICT_TOKEN.concat([' ']);
		/*
		 * Verify that a char is a valid visible (printable) US-ASCII
		 * character or %x80-FF
		 */
		exports.HEADER_CHARS = ['\t'];
		for (let i = 32; i <= 255; i++) {
		    if (i !== 127) {
		        exports.HEADER_CHARS.push(i);
		    }
		}
		// ',' = \x44
		exports.CONNECTION_TOKEN_CHARS = exports.HEADER_CHARS.filter((c) => c !== 44);
		exports.MAJOR = exports.NUM_MAP;
		exports.MINOR = exports.MAJOR;
		var HEADER_STATE;
		(function (HEADER_STATE) {
		    HEADER_STATE[HEADER_STATE["GENERAL"] = 0] = "GENERAL";
		    HEADER_STATE[HEADER_STATE["CONNECTION"] = 1] = "CONNECTION";
		    HEADER_STATE[HEADER_STATE["CONTENT_LENGTH"] = 2] = "CONTENT_LENGTH";
		    HEADER_STATE[HEADER_STATE["TRANSFER_ENCODING"] = 3] = "TRANSFER_ENCODING";
		    HEADER_STATE[HEADER_STATE["UPGRADE"] = 4] = "UPGRADE";
		    HEADER_STATE[HEADER_STATE["CONNECTION_KEEP_ALIVE"] = 5] = "CONNECTION_KEEP_ALIVE";
		    HEADER_STATE[HEADER_STATE["CONNECTION_CLOSE"] = 6] = "CONNECTION_CLOSE";
		    HEADER_STATE[HEADER_STATE["CONNECTION_UPGRADE"] = 7] = "CONNECTION_UPGRADE";
		    HEADER_STATE[HEADER_STATE["TRANSFER_ENCODING_CHUNKED"] = 8] = "TRANSFER_ENCODING_CHUNKED";
		})(HEADER_STATE = exports.HEADER_STATE || (exports.HEADER_STATE = {}));
		exports.SPECIAL_HEADERS = {
		    'connection': HEADER_STATE.CONNECTION,
		    'content-length': HEADER_STATE.CONTENT_LENGTH,
		    'proxy-connection': HEADER_STATE.CONNECTION,
		    'transfer-encoding': HEADER_STATE.TRANSFER_ENCODING,
		    'upgrade': HEADER_STATE.UPGRADE,
		};
		
	} (constants$3));
	return constants$3;
}

var llhttpWasm;
var hasRequiredLlhttpWasm;

function requireLlhttpWasm () {
	if (hasRequiredLlhttpWasm) return llhttpWasm;
	hasRequiredLlhttpWasm = 1;

	const { Buffer } = require$$0$1;

	llhttpWasm = Buffer.from('AGFzbQEAAAABJwdgAX8Bf2ADf39/AX9gAX8AYAJ/fwBgBH9/f38Bf2AAAGADf39/AALLAQgDZW52GHdhc21fb25faGVhZGVyc19jb21wbGV0ZQAEA2VudhV3YXNtX29uX21lc3NhZ2VfYmVnaW4AAANlbnYLd2FzbV9vbl91cmwAAQNlbnYOd2FzbV9vbl9zdGF0dXMAAQNlbnYUd2FzbV9vbl9oZWFkZXJfZmllbGQAAQNlbnYUd2FzbV9vbl9oZWFkZXJfdmFsdWUAAQNlbnYMd2FzbV9vbl9ib2R5AAEDZW52GHdhc21fb25fbWVzc2FnZV9jb21wbGV0ZQAAAy0sBQYAAAIAAAAAAAACAQIAAgICAAADAAAAAAMDAwMBAQEBAQEBAQEAAAIAAAAEBQFwARISBQMBAAIGCAF/AUGA1AQLB9EFIgZtZW1vcnkCAAtfaW5pdGlhbGl6ZQAIGV9faW5kaXJlY3RfZnVuY3Rpb25fdGFibGUBAAtsbGh0dHBfaW5pdAAJGGxsaHR0cF9zaG91bGRfa2VlcF9hbGl2ZQAvDGxsaHR0cF9hbGxvYwALBm1hbGxvYwAxC2xsaHR0cF9mcmVlAAwEZnJlZQAMD2xsaHR0cF9nZXRfdHlwZQANFWxsaHR0cF9nZXRfaHR0cF9tYWpvcgAOFWxsaHR0cF9nZXRfaHR0cF9taW5vcgAPEWxsaHR0cF9nZXRfbWV0aG9kABAWbGxodHRwX2dldF9zdGF0dXNfY29kZQAREmxsaHR0cF9nZXRfdXBncmFkZQASDGxsaHR0cF9yZXNldAATDmxsaHR0cF9leGVjdXRlABQUbGxodHRwX3NldHRpbmdzX2luaXQAFQ1sbGh0dHBfZmluaXNoABYMbGxodHRwX3BhdXNlABcNbGxodHRwX3Jlc3VtZQAYG2xsaHR0cF9yZXN1bWVfYWZ0ZXJfdXBncmFkZQAZEGxsaHR0cF9nZXRfZXJybm8AGhdsbGh0dHBfZ2V0X2Vycm9yX3JlYXNvbgAbF2xsaHR0cF9zZXRfZXJyb3JfcmVhc29uABwUbGxodHRwX2dldF9lcnJvcl9wb3MAHRFsbGh0dHBfZXJybm9fbmFtZQAeEmxsaHR0cF9tZXRob2RfbmFtZQAfEmxsaHR0cF9zdGF0dXNfbmFtZQAgGmxsaHR0cF9zZXRfbGVu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PgtBhwEMPQtBiAEMPAtBiQEMOwtBigEMOgtBiwEMOQtBjAEMOAtBjQEMNwtBjgEMNgtBjwEMNQtBkAEMNAtBkQEMMwtBkgEMMgtBkwEMMQtBlAEMMAtBlQEMLwtBlgEMLgtBlwEMLQtBmAEMLAtBmQEMKwtBmgEMKgtBmwEMKQtBnAEMKAtBnQEMJwtBngEMJgtBnwEMJQtBoAEMJAtBoQEMIwtBogEMIgtBowEMIQtBpAEMIAtBpQEMHwtBpgEMHgtBpwEMHQtBqAEMHAtBqQEMGwtBqgEMGgtBqwEMGQtBrAEMGAtBrQEMFwtBrgEMFgtBAQwVC0GvAQwUC0GwAQwTC0GxAQwSC0GzAQwRC0GyAQwQC0G0AQwPC0G1AQwOC0G2AQwNC0G3AQwMC0G4AQwLC0G5AQwKC0G6AQwJC0G7AQwIC0HGAQwHC0G8AQwGC0G9AQwFC0G+AQwEC0G/AQwDC0HAAQwCC0HCAQwBC0HBAQshAwNAAkACQAJAAkACQAJAAkACQAJAIAICfwJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJ/AkACQAJAAkACQAJAAkACQAJAAkACQAJAAkAgAgJ/AkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACfwJAAkACfwJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkAC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iQEhAwykAgtBASABLQAAQd8ARw1nGiABQQFqIQEMXgtBigEhAyABIARGDaICIAIoAgAiACAEIAFraiEFIAEgAGtBAWohBgNAIAEtAAAgAEGMzwBqLQAARw1kIABBAUYN+gEgAEEBaiEAIAQgAUEBaiIBRw0ACyACIAU2AgAMogILQYsBIQMgASAERg2hAiACKAIAIgAgBCABa2ohBSABIABrQQJqIQYCQANAIAEtAAAgAEGOzwBqLQAARw1kIABBAkYNASAAQQFqIQAgBCABQQFqIgFHDQALIAIgBTYCAAyiAgsgAkEANgIAIAZBAWohAUECDGULQYwBIQMgASAERg2gAiACKAIAIgAgBCABa2ohBSABIABrQQFqIQYCQANAIAEtAAAgAEHwzwBqLQAARw1jIABBAUYNASAAQQFqIQAgBCABQQFqIgFHDQALIAIgBTYCAAyhAgsgAkEANgIAIAZBAWohAUEfDGQLQY0BIQMgASAERg2fAiACKAIAIgAgBCABa2ohBSABIABrQQFqIQYCQANAIAEtAAAgAEHyzwBqLQAARw1iIABBAUYNASAAQQFqIQAgBCABQQFqIgFHDQALIAIgBTYCAAygAgsgAkEANgIAIAZBAWohAUEJDGMLIAEgBEYEQEGOASEDDJ8CCwJAAkAgAS0AAEHJAGsOBwBiYmJiYgFiCyABQQFqIQFB+AAhAwyGAgsgAUEBaiEBQfkAIQMMhQILQY8BIQMgASAERg2dAiACKAIAIgAgBCABa2ohBSABIABrQQVqIQYCQANAIAEtAAAgAEGRzwBqLQAARw1gIABBBUYNASAAQQFqIQAgBCABQQFqIgFHDQALIAIgBTYCAAyeAgsgAkEANgIAIAZBAWohAUEYDGELQZABIQMgASAERg2cAiACKAIAIgAgBCABa2ohBSABIABrQQJqIQYCQANAIAEtAAAgAEGXzwBqLQAARw1fIABBAkYNASAAQQFqIQAgBCABQQFqIgFHDQALIAIgBTYCAAydAgsgAkEANgIAIAZBAWohAUEXDGALQZEBIQMgASAERg2bAiACKAIAIgAgBCABa2ohBSABIABrQQZqIQYCQANAIAEtAAAgAEGazwBqLQAARw1eIABBBkYNASAAQQFqIQAgBCABQQFqIgFHDQALIAIgBTYCAAycAgsgAkEANgIAIAZBAWohAUEV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JSIARQ0RIAJB5QA2AhwgAiABNgIUIAIgADYCDEEAIQMMtAELIAIoAgQhACACQQA2AgQgAiAAIAEQJSIARQ0gIAJB0wA2AhwgAiABNgIUIAIgADYCDEEAIQMMswELIAIoAgQhACACQQA2AgQgAiAAIAEQJSIARQ0iIAJB0gA2AhwgAiABNgIUIAIgADYCDEEAIQMMsgELIAIoAgQhACACQQA2AgQgAiAAIAEQJSIARQ0OIAJB5QA2AhwgAiABNgIUIAIgADYCDEEAIQMMsQELIAIoAgQhACACQQA2AgQgAiAAIAEQJSIARQ0dIAJB0wA2AhwgAiABNgIUIAIgADYCDEEAIQMMsAELIAIoAgQhACACQQA2AgQgAiAAIAEQJSIARQ0fIAJB0gA2AhwgAiABNgIUIAIgADYCDEEAIQMMrwELIABBP0cNASABQQFqCyEBQQUhAwyUAQtBACEDIAJBADYCHCACIAE2AhQgAkH9EjYCECACQQc2AgwMrAELIAJBADYCHCACIAE2AhQgAkHcCDYCECACQQc2AgxBACEDDKsBCyACKAIEIQAgAkEANgIEIAIgACABECUiAEUNByACQeUANgIcIAIgATYCFCACIAA2AgxBACEDDKoBCyACKAIEIQAgAkEANgIEIAIgACABECUiAEUNFiACQdMANgIcIAIgATYCFCACIAA2AgxBACEDDKkBCyACKAIEIQAgAkEANgIEIAIgACABECUiAEUNGCACQdIANgIcIAIgATYCFCACIAA2AgxBACEDDKgBCyACQQA2AhwgAiABNgIUIAJBxgo2AhAgAkEHNgIMQQAhAwynAQsgAigCBCEAIAJBADYCBCACIAAgARAlIgBFDQMgAkHlADYCHCACIAE2AhQgAiAANgIMQQAhAwymAQsgAigCBCEAIAJBADYCBCACIAAgARAlIgBFDRIgAkHTADYCHCACIAE2AhQgAiAANgIMQQAhAwylAQsgAigCBCEAIAJBADYCBCACIAAgARAlIgBFDRQgAkHSADYCHCACIAE2AhQgAiAANgIMQQAhAwykAQsgAigCBCEAIAJBADYCBCACIAAgARAlIgBFDQAgAkHlADYCHCACIAE2AhQgAiAANgIMQQAhAwyjAQtB1QAhAwyJAQsgAEEVRwRAIAJBADYCHCACIAE2AhQgAkG5DTYCECACQRo2AgxB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AkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAIABB5ABrDvQDY2IAAWFhYWFhYQIDBAVhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhBgcICQoLDA0OD2FhYWFhEGFhYWFhYWFhYWFhEWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYRITFBUWFxgZGhthYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhHB0eHyAhIiMkJSYnKCkqKywtLi8wMTIzNDU2YTc4OTphYWFhYWFhYTthYWE8YWFhYT0+P2FhYWFhYWFhQGFhQWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYUJDREVGR0hJSktMTU5PUFFSU2FhYWFhYWFhVFVWV1hZWlthXF1hYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFeYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhX2BhC0HhJw8LQaQhDwtByywPC0H+MQ8LQcAkDwtBqyQPC0GNKA8LQeImDwtBgDAPC0G5Lw8LQdckDwtB7x8PC0HhHw8LQfofDwtB8iAPC0GoLw8LQa4yDwtBiDAPC0HsJw8LQYIiDwtBjh0PC0HQLg8LQcojDwtBxTIPC0HfHA8LQdIcDwtBxCAPC0HXIA8LQaIfDwtB7S4PC0GrMA8LQdQlDwtBzC4PC0H6Lg8LQfwrDwtB0jAPC0HxHQ8LQbsgDwtB9ysPC0GQMQ8LQdcxDwtBoi0PC0HUJw8LQeArDwtBnywPC0HrMQ8LQdUfDwtByjEPC0HeJQ8LQdQeDwtB9BwPC0GnMg8LQbEdDwtBoB0PC0G5MQ8LQbwwDwtBkiEPC0GzJg8LQeksDwtBrB4PC0HUKw8LQfcmDwtBgCYPC0GwIQ8LQf4eDwtBjSMPC0GJLQ8LQfciDwtBoDEPC0GuHw8LQcYlDwtB6B4PC0GTIg8LQcIvDwtBwx0PC0GLLA8LQeEdDwtBjS8PC0HqIQ8LQbQtDwtB0i8PC0HfMg8LQdIyDwtB8DAPC0GpIg8LQfkjDwtBmR4PC0G1LA8LQZswDwtBkjIPC0G2Kw8LQcIiDwtB+DIPC0GeJQ8LQdAiDwtBuh4PC0GBHg8LAAtB1iEhAQsgAQsWACAAIAAtAC1B/gFxIAFBAEdyOgAtCxkAIAAgAC0ALUH9AXEgAUEAR0EBdHI6AC0LGQAgACAALQAtQfsBcSABQQBHQQJ0cjoALQsZACAAIAAtAC1B9wFxIAFBAEdBA3RyOgAtCz4BAn8CQCAAKAI4IgNFDQAgAygCBCIDRQ0AIAAgASACIAFrIAMRAQAiBEF/Rw0AIABBxhE2AhBBGCEECyAECz4BAn8CQCAAKAI4IgNFDQAgAygCCCIDRQ0AIAAgASACIAFrIAMRAQAiBEF/Rw0AIABB9go2AhBBGCEECyAECz4BAn8CQCAAKAI4IgNFDQAgAygCDCIDRQ0AIAAgASACIAFrIAMRAQAiBEF/Rw0AIABB7Ro2AhBBGCEECyAECz4BAn8CQCAAKAI4IgNFDQAgAygCECIDRQ0AIAAgASACIAFrIAMRAQAiBEF/Rw0AIABBlRA2AhBBGCEECyAECz4BAn8CQCAAKAI4IgNFDQAgAygCFCIDRQ0AIAAgASACIAFrIAMRAQAiBEF/Rw0AIABBqhs2AhBBGCEECyAECz4BAn8CQCAAKAI4IgNFDQAgAygCGCIDRQ0AIAAgASACIAFrIAMRAQAiBEF/Rw0AIABB7RM2AhBBGCEECyAECz4BAn8CQCAAKAI4IgNFDQAgAygCKCIDRQ0AIAAgASACIAFrIAMRAQAiBEF/Rw0AIABB9gg2AhBBGCEECyAECz4BAn8CQCAAKAI4IgNFDQAgAygCHCIDRQ0AIAAgASACIAFrIAMRAQAiBEF/Rw0AIABBwhk2AhBBGCEECyAECz4BAn8CQCAAKAI4IgNFDQAgAygCICIDRQ0AIAAgASACIAFrIAMRAQAiBEF/Rw0AIABBlBQ2AhBBGCEECyAEC1kBAn8CQCAALQAoQQFGDQAgAC8BMiIBQeQAa0HkAEkNACABQcwBRg0AIAFBsAJGDQAgAC8BMCIAQcAAcQ0AQQEhAiAAQYgEcUGABEYNACAAQShxRSECCyACC4wBAQJ/AkACQAJAIAAtACpFDQAgAC0AK0UNACAALwEwIgFBAnFFDQEMAgsgAC8BMCIBQQFxRQ0BC0EBIQIgAC0AKEEBRg0AIAAvATIiAEHkAGtB5ABJDQAgAEHMAUYNACAAQbACRg0AIAFBwABxDQBBACECIAFBiARxQYAERg0AIAFBKHFBAEchAgsgAgtXACAAQRhqQgA3AwAgAEIANwMAIABBOGpCADcDACAAQTBqQgA3AwAgAEEoakIANwMAIABBIGpCADcDACAAQRBqQgA3AwAgAEEIakIANwMAIABB3QE2AhwLBgAgABAyC5otAQt/IwBBEGsiCiQAQaTQACgCACIJRQRAQeTTACgCACIFRQRAQfDTAEJ/NwIAQejTAEKAgISAgIDAADcCAEHk0wAgCkEIakFwcUHYqtWqBXMiBTYCAEH40wBBADYCAEHI0wBBADYCAAtBzNMAQYDUBDYCAEGc0ABBgNQENgIAQbDQACAFNgIAQazQAEF/NgIAQdDTAEGArAM2AgADQCABQcjQAGogAUG80ABqIgI2AgAgAiABQbTQAGoiAzYCACABQcDQAGogAzYCACABQdDQAGogAUHE0ABqIgM2AgAgAyACNgIAIAFB2NAAaiABQczQAGoiAjYCACACIAM2AgAgAUHU0ABqIAI2AgAgAUEgaiIBQYACRw0AC0GM1ARBwasDNgIAQajQAEH00wAoAgA2AgBBmNAAQcCrAzYCAEGk0ABBiNQENgIAQcz/B0E4NgIAQYjUBCEJCwJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAIABB7AFNBEBBjNAAKAIAIgZBECAAQRNqQXBxIABBC0kbIgRBA3YiAHYiAUEDcQRAAkAgAUEBcSAAckEBcyICQQN0IgBBtNAAaiIBIABBvNAAaigCACIAKAIIIgNGBEBBjNAAIAZBfiACd3E2AgAMAQsgASADNgIIIAMgATYCDAsgAEEIaiEBIAAgAkEDdCICQQNyNgIEIAAgAmoiACAAKAIEQQFyNgIEDBELQZTQACgCACIIIARPDQEgAQRAAkBBAiAAdCICQQAgAmtyIAEgAHRxaCIAQQN0IgJBtNAAaiIBIAJBvNAAaigCACICKAIIIgNGBEBBjNAAIAZBfiAAd3EiBjYCAAwBCyABIAM2AgggAyABNgIMCyACIARBA3I2AgQgAEEDdCIAIARrIQUgACACaiAFNgIAIAIgBGoiBCAFQQFyNgIEIAgEQCAIQXhxQbTQAGohAEGg0AAoAgAhAwJ/QQEgCEEDdnQiASAGcUUEQEGM0AAgASAGcjYCACAADAELIAAoAggLIgEgAzYCDCAAIAM2AgggAyAANgIMIAMgATYCCAsgAkEIaiEBQaDQACAENgIAQZTQACAFNgIADBELQZDQACgCACILRQ0BIAtoQQJ0QbzSAGooAgAiACgCBEF4cSAEayEFIAAhAgNAAkAgAigCECIBRQRAIAJBFGooAgAiAUUNAQsgASgCBEF4cSAEayIDIAVJIQIgAyAFIAIbIQUgASAAIAIbIQAgASECDAELCyAAKAIYIQkgACgCDCIDIABHBEBBnNAAKAIAGiADIAAoAggiATYCCCABIAM2AgwMEAsgAEEUaiICKAIAIgFFBEAgACgCECIBRQ0DIABBEGohAgsDQCACIQcgASIDQRRqIgIoAgAiAQ0AIANBEGohAiADKAIQIgENAAsgB0EANgIADA8LQX8hBCAAQb9/Sw0AIABBE2oiAUFwcSEEQZDQACgCACIIRQ0AQQAgBGshBQJAAkACQAJ/QQAgBEGAAkkNABpBHyAEQf///wdLDQAaIARBJiABQQh2ZyIAa3ZBAXEgAEEBdGtBPmoLIgZBAnRBvNIAaigCACICRQRAQQAhAUEAIQMMAQtBACEBIARBGSAGQQF2a0EAIAZBH0cbdCEAQQAhAwNAAkAgAigCBEF4cSAEayIHIAVPDQAgAiEDIAciBQ0AQQAhBSACIQEMAwsgASACQRRqKAIAIgcgByACIABBHXZBBHFqQRBqKAIAIgJGGyABIAcbIQEgAEEBdCEAIAINAAsLIAEgA3JFBEBBACEDQQIgBnQiAEEAIABrciAIcSIARQ0DIABoQQJ0QbzSAGooAgAhAQsgAUUNAQsDQCABKAIEQXhxIARrIgIgBUkhACACIAUgABshBSABIAMgABshAyABKAIQIgAEfyAABSABQRRqKAIACyIBDQALCyADRQ0AIAVBlNAAKAIAIARrTw0AIAMoAhghByADIAMoAgwiAEcEQEGc0AAoAgAaIAAgAygCCCIBNgIIIAEgADYCDAwOCyADQRRqIgIoAgAiAUUEQCADKAIQIgFFDQMgA0EQaiECCwNAIAIhBiABIgBBFGoiAigCACIBDQAgAEEQaiECIAAoAhAiAQ0ACyAGQQA2AgAMDQtBlNAAKAIAIgMgBE8EQEGg0AAoAgAhAQJAIAMgBGsiAkEQTwRAIAEgBGoiACACQQFyNgIEIAEgA2ogAjYCACABIARBA3I2AgQMAQsgASADQQNyNgIEIAEgA2oiACAAKAIEQQFyNgIEQQAhAEEAIQILQZTQACACNgIAQaDQACAANgIAIAFBCGohAQwPC0GY0AAoAgAiAyAESwRAIAQgCWoiACADIARrIgFBAXI2AgRBpNAAIAA2AgBBmNAAIAE2AgAgCSAEQQNyNgIEIAlBCGohAQwPC0EAIQEgBAJ/QeTTACgCAARAQezTACgCAAwBC0Hw0wBCfzcCAEHo0wBCgICEgICAwAA3AgBB5NMAIApBDGpBcHFB2KrVqgVzNgIAQfjTAEEANgIAQcjTAEEANgIAQYCABAsiACAEQccAaiIFaiIGQQAgAGsiB3EiAk8EQEH80wBBMDYCAAwPCwJAQcTTACgCACIBRQ0AQbzTACgCACIIIAJqIQAgACABTSAAIAhLcQ0AQQAhAUH80wBBMDYCAAwPC0HI0wAtAABBBHENBAJAAkAgCQRAQczTACEBA0AgASgCACIAIAlNBEAgACABKAIEaiAJSw0DCyABKAIIIgENAAsLQQAQMyIAQX9GDQUgAiEGQejTACgCACIBQQFrIgMgAHEEQCACIABrIAAgA2pBACABa3FqIQYLIAQgBk8NBSAGQf7///8HSw0FQcTTACgCACIDBEBBvNMAKAIAIgcgBmohASABIAdNDQYgASADSw0GCyAGEDMiASAARw0BDAcLIAYgA2sgB3EiBkH+////B0sNBCAGEDMhACAAIAEoAgAgASgCBGpGDQMgACEBCwJAIAYgBEHIAGpPDQAgAUF/Rg0AQezTACgCACIAIAUgBmtqQQAgAGtxIgBB/v///wdLBEAgASEADAcLIAAQM0F/RwRAIAAgBmohBiABIQAMBwtBACAGaxAzGgwECyABIgBBf0cNBQwDC0EAIQMMDAtBACEADAoLIABBf0cNAgtByNMAQcjTACgCAEEEcjYCAAsgAkH+////B0sNASACEDMhAEEAEDMhASAAQX9GDQEgAUF/Rg0BIAAgAU8NASABIABrIgYgBEE4ak0NAQtBvNMAQbzTACgCACAGaiIBNgIAQcDTACgCACABSQRAQcDTACABNgIACwJAAkACQEGk0AAoAgAiAgRAQczTACEBA0AgACABKAIAIgMgASgCBCIFakYNAiABKAIIIgENAAsMAgtBnNAAKAIAIgFBAEcgACABT3FFBEBBnNAAIAA2AgALQQAhAUHQ0wAgBjYCAEHM0wAgADYCAEGs0ABBfzYCAEGw0ABB5NMAKAIANgIAQdjTAEEANgIAA0AgAUHI0ABqIAFBvNAAaiICNgIAIAIgAUG00ABqIgM2AgAgAUHA0ABqIAM2AgAgAUHQ0ABqIAFBxNAAaiIDNgIAIAMgAjYCACABQdjQAGogAUHM0ABqIgI2AgAgAiADNgIAIAFB1NAAaiACNgIAIAFBIGoiAUGAAkcNAAtBeCAAa0EPcSIBIABqIgIgBkE4ayIDIAFrIgFBAXI2AgRBqNAAQfTTACgCADYCAEGY0AAgATYCAEGk0AAgAjYCACAAIANqQTg2AgQMAgsgACACTQ0AIAIgA0kNACABKAIMQQhxDQBBeCACa0EPcSIAIAJqIgNBmNAAKAIAIAZqIgcgAGsiAEEBcjYCBCABIAUgBmo2AgRBqNAAQfTTACgCADYCAEGY0AAgADYCAEGk0AAgAzYCACACIAdqQTg2AgQMAQsgAEGc0AAoAgBJBEBBnNAAIAA2AgALIAAgBmohA0HM0wAhAQJAAkACQANAIAMgASgCAEcEQCABKAIIIgENAQwCCwsgAS0ADEEIcUUNAQtBzNMAIQEDQCABKAIAIgMgAk0EQCADIAEoAgRqIgUgAksNAwsgASgCCCEBDAALAAsgASAANgIAIAEgASgCBCAGajYCBCAAQXggAGtBD3FqIgkgBEEDcjYCBCADQXggA2tBD3FqIgYgBCAJaiIEayEBIAIgBkYEQEGk0AAgBDYCAEGY0ABBmNAAKAIAIAFqIgA2AgAgBCAAQQFyNgIEDAgLQaDQACgCACAGRgRAQaDQACAENgIAQZTQAEGU0AAoAgAgAWoiADYCACAEIABBAXI2AgQgACAEaiAANgIADAgLIAYoAgQiBUEDcUEBRw0GIAVBeHEhCCAFQf8BTQRAIAVBA3YhAyAGKAIIIgAgBigCDCICRgRAQYzQAEGM0AAoAgBBfiADd3E2AgAMBwsgAiAANgIIIAAgAjYCDAwGCyAGKAIYIQcgBiAGKAIMIgBHBEAgACAGKAIIIgI2AgggAiAANgIMDAULIAZBFGoiAigCACIFRQRAIAYoAhAiBUUNBCAGQRBqIQILA0AgAiEDIAUiAEEUaiICKAIAIgUNACAAQRBqIQIgACgCECIFDQALIANBADYCAAwEC0F4IABrQQ9xIgEgAGoiByAGQThrIgMgAWsiAUEBcjYCBCAAIANqQTg2AgQgAiAFQTcgBWtBD3FqQT9rIgMgAyACQRBqSRsiA0EjNgIEQajQAEH00wAoAgA2AgBBmNAAIAE2AgBBpNAAIAc2AgAgA0EQakHU0wApAgA3AgAgA0HM0wApAgA3AghB1NMAIANBCGo2AgBB0NMAIAY2AgBBzNMAIAA2AgBB2NMAQQA2AgAgA0EkaiEBA0AgAUEHNgIAIAUgAUEEaiIBSw0ACyACIANGDQAgAyADKAIEQX5xNgIEIAMgAyACayIFNgIAIAIgBUEBcjYCBCAFQf8BTQRAIAVBeHFBtNAAaiEAAn9BjNAAKAIAIgFBASAFQQN2dCIDcUUEQEGM0AAgASADcjYCACAADAELIAAoAggLIgEgAjYCDCAAIAI2AgggAiAANgIMIAIgATYCCAwBC0EfIQEgBUH///8HTQRAIAVBJiAFQQh2ZyIAa3ZBAXEgAEEBdGtBPmohAQsgAiABNgIcIAJCADcCECABQQJ0QbzSAGohAEGQ0AAoAgAiA0EBIAF0IgZxRQRAIAAgAjYCAEGQ0AAgAyAGcjYCACACIAA2AhggAiACNgIIIAIgAjYCDAwBCyAFQRkgAUEBdmtBACABQR9HG3QhASAAKAIAIQMCQANAIAMiACgCBEF4cSAFRg0BIAFBHXYhAyABQQF0IQEgACADQQRxakEQaiIGKAIAIgMNAAsgBiACNgIAIAIgADYCGCACIAI2AgwgAiACNgIIDAELIAAoAggiASACNgIMIAAgAjYCCCACQQA2AhggAiAANgIMIAIgATYCCAtBmNAAKAIAIgEgBE0NAEGk0AAoAgAiACAEaiICIAEgBGsiAUEBcjYCBEGY0AAgATYCAEGk0AAgAjYCACAAIARBA3I2AgQgAEEIaiEBDAgLQQAhAUH80wBBMDYCAAwHC0EAIQALIAdFDQACQCAGKAIcIgJBAnRBvNIAaiIDKAIAIAZGBEAgAyAANgIAIAANAUGQ0ABBkNAAKAIAQX4gAndxNgIADAILIAdBEEEUIAcoAhAgBkYbaiAANgIAIABFDQELIAAgBzYCGCAGKAIQIgIEQCAAIAI2AhAgAiAANgIYCyAGQRRqKAIAIgJFDQAgAEEUaiACNgIAIAIgADYCGAsgASAIaiEBIAYgCGoiBigCBCEFCyAGIAVBfnE2AgQgASAEaiABNgIAIAQgAUEBcjYCBCABQf8BTQRAIAFBeHFBtNAAaiEAAn9BjNAAKAIAIgJBASABQQN2dCIBcUUEQEGM0AAgASACcjYCACAADAELIAAoAggLIgEgBDYCDCAAIAQ2AgggBCAANgIMIAQgATYCCAwBC0EfIQUgAUH///8HTQRAIAFBJiABQQh2ZyIAa3ZBAXEgAEEBdGtBPmohBQsgBCAFNgIcIARCADcCECAFQQJ0QbzSAGohAEGQ0AAoAgAiAkEBIAV0IgNxRQRAIAAgBDYCAEGQ0AAgAiADcjYCACAEIAA2AhggBCAENgIIIAQgBDYCDAwBCyABQRkgBUEBdmtBACAFQR9HG3QhBSAAKAIAIQACQANAIAAiAigCBEF4cSABRg0BIAVBHXYhACAFQQF0IQUgAiAAQQRxakEQaiIDKAIAIgANAAsgAyAENgIAIAQgAjYCGCAEIAQ2AgwgBCAENgIIDAELIAIoAggiACAENgIMIAIgBDYCCCAEQQA2AhggBCACNgIMIAQgADYCCAsgCUEIaiEBDAILAkAgB0UNAAJAIAMoAhwiAUECdEG80gBqIgIoAgAgA0YEQCACIAA2AgAgAA0BQZDQACAIQX4gAXdxIgg2AgAMAgsgB0EQQRQgBygCECADRhtqIAA2AgAgAEUNAQsgACAHNgIYIAMoAhAiAQRAIAAgATYCECABIAA2AhgLIANBFGooAgAiAUUNACAAQRRqIAE2AgAgASAANgIYCwJAIAVBD00EQCADIAQgBWoiAEEDcjYCBCAAIANqIgAgACgCBEEBcjYCBAwBCyADIARqIgIgBUEBcjYCBCADIARBA3I2AgQgAiAFaiAFNgIAIAVB/wFNBEAgBUF4cUG00ABqIQACf0GM0AAoAgAiAUEBIAVBA3Z0IgVxRQRAQYzQACABIAVyNgIAIAAMAQsgACgCCAsiASACNgIMIAAgAjYCCCACIAA2AgwgAiABNgIIDAELQR8hASAFQf///wdNBEAgBUEmIAVBCHZnIgBrdkEBcSAAQQF0a0E+aiEBCyACIAE2AhwgAkIANwIQIAFBAnRBvNIAaiEAQQEgAXQiBCAIcUUEQCAAIAI2AgBBkNAAIAQgCHI2AgAgAiAANgIYIAIgAjYCCCACIAI2AgwMAQsgBUEZIAFBAXZrQQAgAUEfRxt0IQEgACgCACEEAkADQCAEIgAoAgRBeHEgBUYNASABQR12IQQgAUEBdCEBIAAgBEEEcWpBEGoiBigCACIEDQALIAYgAjYCACACIAA2AhggAiACNgIMIAIgAjYCCAwBCyAAKAIIIgEgAjYCDCAAIAI2AgggAkEANgIYIAIgADYCDCACIAE2AggLIANBCGohAQwBCwJAIAlFDQACQCAAKAIcIgFBAnRBvNIAaiICKAIAIABGBEAgAiADNgIAIAMNAUGQ0AAgC0F+IAF3cTYCAAwCCyAJQRBBFCAJKAIQIABGG2ogAzYCACADRQ0BCyADIAk2AhggACgCECIBBEAgAyABNgIQIAEgAzYCGAsgAEEUaigCACIBRQ0AIANBFGogATYCACABIAM2AhgLAkAgBUEPTQRAIAAgBCAFaiIBQQNyNgIEIAAgAWoiASABKAIEQQFyNgIEDAELIAAgBGoiByAFQQFyNgIEIAAgBEEDcjYCBCAFIAdqIAU2AgAgCARAIAhBeHFBtNAAaiEBQaDQACgCACEDAn9BASAIQQN2dCICIAZxRQRAQYzQACACIAZyNgIAIAEMAQsgASgCCAsiAiADNgIMIAEgAzYCCCADIAE2AgwgAyACNgIIC0Gg0AAgBzYCAEGU0AAgBTYCAAsgAEEIaiEBCyAKQRBqJAAgAQtDACAARQRAPwBBEHQPCwJAIABB//8DcQ0AIABBAEgNACAAQRB2QAAiAEF/RgRAQfzTAEEwNgIAQX8PCyAAQRB0DwsACwvcPyIAQYAICwkBAAAAAgAAAAMAQZQICwUEAAAABQBBpAgLCQYAAAAHAAAACABB3AgLii1JbnZhbGlkIGNoYXIgaW4gdXJsIHF1ZXJ5AFNwYW4gY2FsbGJhY2sgZXJyb3IgaW4gb25fYm9keQBDb250ZW50LUxlbmd0aCBvdmVyZmxvdwBDaHVuayBzaXplIG92ZXJmbG93AFJlc3BvbnNlIG92ZXJmbG93AEludmFsaWQgbWV0aG9kIGZvciBIVFRQL3gueCByZXF1ZXN0AEludmFsaWQgbWV0aG9kIGZvciBSVFNQL3gueCByZXF1ZXN0AEV4cGVjdGVkIFNPVVJDRSBtZXRob2QgZm9yIElDRS94LnggcmVxdWVzdABJbnZhbGlkIGNoYXIgaW4gdXJsIGZyYWdtZW50IHN0YXJ0AEV4cGVjdGVkIGRvdABTcGFuIGNhbGxiYWNrIGVycm9yIGluIG9uX3N0YXR1cwBJbnZhbGlkIHJlc3BvbnNlIHN0YXR1cwBJbnZhbGlkIGNoYXJhY3RlciBpbiBjaHVuayBleHRlbnNpb25zAFVzZXIgY2FsbGJhY2sgZXJyb3IAYG9uX3Jlc2V0YCBjYWxsYmFjayBlcnJvcgBgb25fY2h1bmtfaGVhZGVyYCBjYWxsYmFjayBlcnJvcgBgb25fbWVzc2FnZV9iZWdpbmAgY2FsbGJhY2sgZXJyb3IAYG9uX2NodW5rX2V4dGVuc2lvbl92YWx1ZWAgY2FsbGJhY2sgZXJyb3IAYG9uX3N0YXR1c19jb21wbGV0ZWAgY2FsbGJhY2sgZXJyb3IAYG9uX3ZlcnNpb25fY29tcGxldGVgIGNhbGxiYWNrIGVycm9yAGBvbl91cmxfY29tcGxldGVgIGNhbGxiYWNrIGVycm9yAGBvbl9jaHVua19jb21wbGV0ZWAgY2FsbGJhY2sgZXJyb3IAYG9uX2hlYWRlcl92YWx1ZV9jb21wbGV0ZWAgY2FsbGJhY2sgZXJyb3IAYG9uX21lc3NhZ2VfY29tcGxldGVgIGNhbGxiYWNrIGVycm9yAGBvbl9tZXRob2RfY29tcGxldGVgIGNhbGxiYWNrIGVycm9yAGBvbl9oZWFkZXJfZmllbGRfY29tcGxldGVgIGNhbGxiYWNrIGVycm9yAGBvbl9jaHVua19leHRlbnNpb25fbmFtZWAgY2FsbGJhY2sgZXJyb3IAVW5leHBlY3RlZCBjaGFyIGluIHVybCBzZXJ2ZXIASW52YWxpZCBoZWFkZXIgdmFsdWUgY2hhcgBJbnZhbGlkIGhlYWRlciBmaWVsZCBjaGFyAFNwYW4gY2FsbGJhY2sgZXJyb3IgaW4gb25fdmVyc2lvbgBJbnZhbGlkIG1pbm9yIHZlcnNpb24ASW52YWxpZCBtYWpvciB2ZXJzaW9uAEV4cGVjdGVkIHNwYWNlIGFmdGVyIHZlcnNpb24ARXhwZWN0ZWQgQ1JMRiBhZnRlciB2ZXJzaW9uAEludmFsaWQgSFRUUCB2ZXJzaW9uAEludmFsaWQgaGVhZGVyIHRva2VuAFNwYW4gY2FsbGJhY2sgZXJyb3IgaW4gb25fdXJsAEludmFsaWQgY2hhcmFjdGVycyBpbiB1cmwAVW5leHBlY3RlZCBzdGFydCBjaGFyIGluIHVybABEb3VibGUgQCBpbiB1cmwARW1wdHkgQ29udGVudC1MZW5ndGgASW52YWxpZCBjaGFyYWN0ZXIgaW4gQ29udGVudC1MZW5ndGgARHVwbGljYXRlIENvbnRlbnQtTGVuZ3RoAEludmFsaWQgY2hhciBpbiB1cmwgcGF0aABDb250ZW50LUxlbmd0aCBjYW4ndCBiZSBwcmVzZW50IHdpdGggVHJhbnNmZXItRW5jb2RpbmcASW52YWxpZCBjaGFyYWN0ZXIgaW4gY2h1bmsgc2l6ZQBTcGFuIGNhbGxiYWNrIGVycm9yIGluIG9uX2hlYWRlcl92YWx1ZQBTcGFuIGNhbGxiYWNrIGVycm9yIGluIG9uX2NodW5rX2V4dGVuc2lvbl92YWx1ZQBJbnZhbGlkIGNoYXJhY3RlciBpbiBjaHVuayBleHRlbnNpb25zIHZhbHVlAE1pc3NpbmcgZXhwZWN0ZWQgTEYgYWZ0ZXIgaGVhZGVyIHZhbHVlAEludmFsaWQgYFRyYW5zZmVyLUVuY29kaW5nYCBoZWFkZXIgdmFsdWUASW52YWxpZCBjaGFyYWN0ZXIgaW4gY2h1bmsgZXh0ZW5zaW9ucyBxdW90ZSB2YWx1ZQBJbnZhbGlkIGNoYXJhY3RlciBpbiBjaHVuayBleHRlbnNpb25zIHF1b3RlZCB2YWx1ZQBQYXVzZWQgYnkgb25faGVhZGVyc19jb21wbGV0ZQBJbnZhbGlkIEVPRiBzdGF0ZQBvbl9yZXNldCBwYXVzZQBvbl9jaHVua19oZWFkZXIgcGF1c2UAb25fbWVzc2FnZV9iZWdpbiBwYXVzZQBvbl9jaHVua19leHRlbnNpb25fdmFsdWUgcGF1c2UAb25fc3RhdHVzX2NvbXBsZXRlIHBhdXNlAG9uX3ZlcnNpb25fY29tcGxldGUgcGF1c2UAb25fdXJsX2NvbXBsZXRlIHBhdXNlAG9uX2NodW5rX2NvbXBsZXRlIHBhdXNlAG9uX2hlYWRlcl92YWx1ZV9jb21wbGV0ZSBwYXVzZQBvbl9tZXNzYWdlX2NvbXBsZXRlIHBhdXNlAG9uX21ldGhvZF9jb21wbGV0ZSBwYXVzZQBvbl9oZWFkZXJfZmllbGRfY29tcGxldGUgcGF1c2UAb25fY2h1bmtfZXh0ZW5zaW9uX25hbWUgcGF1c2UAVW5leHBlY3RlZCBzcGFjZSBhZnRlciBzdGFydCBsaW5lAFNwYW4gY2FsbGJhY2sgZXJyb3IgaW4gb25fY2h1bmtfZXh0ZW5zaW9uX25hbWUASW52YWxpZCBjaGFyYWN0ZXIgaW4gY2h1bmsgZXh0ZW5zaW9ucyBuYW1lAFBhdXNlIG9uIENPTk5FQ1QvVXBncmFkZQBQYXVzZSBvbiBQUkkvVXBncmFkZQBFeHBlY3RlZCBIVFRQLzIgQ29ubmVjdGlvbiBQcmVmYWNlAFNwYW4gY2FsbGJhY2sgZXJyb3IgaW4gb25fbWV0aG9kAEV4cGVjdGVkIHNwYWNlIGFmdGVyIG1ldGhvZABTcGFuIGNhbGxiYWNrIGVycm9yIGluIG9uX2hlYWRlcl9maWVsZABQYXVzZWQASW52YWxpZCB3b3JkIGVuY291bnRlcmVkAEludmFsaWQgbWV0aG9kIGVuY291bnRlcmVkAFVuZXhwZWN0ZWQgY2hhciBpbiB1cmwgc2NoZW1hAFJlcXVlc3QgaGFzIGludmFsaWQgYFRyYW5zZmVyLUVuY29kaW5nYABTV0lUQ0hfUFJPWFkAVVNFX1BST1hZAE1LQUNUSVZJVFkAVU5QUk9DRVNTQUJMRV9FTlRJVFkAQ09QWQBNT1ZFRF9QRVJNQU5FTlRMWQBUT09fRUFSTFkATk9USUZZAEZBSUxFRF9ERVBFTkRFTkNZAEJBRF9HQVRFV0FZAFBMQVkAUFVUAENIRUNLT1VUAEdBVEVXQVlfVElNRU9VVABSRVFVRVNUX1RJTUVPVVQATkVUV09SS19DT05ORUNUX1RJTUVPVVQAQ09OTkVDVElPTl9USU1FT1VUAExPR0lOX1RJTUVPVVQATkVUV09SS19SRUFEX1RJTUVPVVQAUE9TVABNSVNESVJFQ1RFRF9SRVFVRVNUAENMSUVOVF9DTE9TRURfUkVRVUVTVABDTElFTlRfQ0xPU0VEX0xPQURfQkFMQU5DRURfUkVRVUVTVABCQURfUkVRVUVTVABIVFRQX1JFUVVFU1RfU0VOVF9UT19IVFRQU19QT1JUAFJFUE9SVABJTV9BX1RFQVBPVABSRVNFVF9DT05URU5UAE5PX0NPTlRFTlQAUEFSVElBTF9DT05URU5UAEhQRV9JTlZBTElEX0NPTlNUQU5UAEhQRV9DQl9SRVNFVABHRVQASFBFX1NUUklDVABDT05GTElDVABURU1QT1JBUllfUkVESVJFQ1QAUEVSTUFORU5UX1JFRElSRUNUAENPTk5FQ1QATVVMVElfU1RBVFVTAEhQRV9JTlZBTElEX1NUQVRVUwBUT09fTUFOWV9SRVFVRVNUUwBFQVJMWV9ISU5UUwBVTkFWQUlMQUJMRV9GT1JfTEVHQUxfUkVBU09OUwBPUFRJT05TAFNXSVRDSElOR19QUk9UT0NPTFMAVkFSSUFOVF9BTFNPX05FR09USUFURVMATVVMVElQTEVfQ0hPSUNFUwBJTlRFUk5BTF9TRVJWRVJfRVJST1IAV0VCX1NFUlZFUl9VTktOT1dOX0VSUk9SAFJBSUxHVU5fRVJST1IASURFTlRJVFlfUFJPVklERVJfQVVUSEVOVElDQVRJT05fRVJST1IAU1NMX0NFUlRJRklDQVRFX0VSUk9SAElOVkFMSURfWF9GT1JXQVJERURfRk9SAFNFVF9QQVJBTUVURVIAR0VUX1BBUkFNRVRFUgBIUEVfVVNFUgBTRUVfT1RIRVIASFBFX0NCX0NIVU5LX0hFQURFUgBNS0NBTEVOREFSAFNFVFVQAFdFQl9TRVJWRVJfSVNfRE9XTgBURUFSRE9XTgBIUEVfQ0xPU0VEX0NPTk5FQ1RJT04ASEVVUklTVElDX0VYUElSQVRJT04ARElTQ09OTkVDVEVEX09QRVJBVElPTgBOT05fQVVUSE9SSVRBVElWRV9JTkZPUk1BVElPTgBIUEVfSU5WQUxJRF9WRVJTSU9OAEhQRV9DQl9NRVNTQUdFX0JFR0lOAFNJVEVfSVNfRlJPWkVOAEhQRV9JTlZBTElEX0hFQURFUl9UT0tFTgBJTlZBTElEX1RPS0VOAEZPUkJJRERFTgBFTkhBTkNFX1lPVVJfQ0FMTQBIUEVfSU5WQUxJRF9VUkwAQkxPQ0tFRF9CWV9QQVJFTlRBTF9DT05UUk9MAE1LQ09MAEFDTABIUEVfSU5URVJOQUwAUkVRVUVTVF9IRUFERVJfRklFTERTX1RPT19MQVJHRV9VTk9GRklDSUFMAEhQRV9PSwBVTkxJTksAVU5MT0NLAFBSSQBSRVRSWV9XSVRIAEhQRV9JTlZBTElEX0NPTlRFTlRfTEVOR1RIAEhQRV9VTkVYUEVDVEVEX0NPTlRFTlRfTEVOR1RIAEZMVVNIAFBST1BQQVRDSABNLVNFQVJDSABVUklfVE9PX0xPTkcAUFJPQ0VTU0lORwBNSVNDRUxMQU5FT1VTX1BFUlNJU1RFTlRfV0FSTklORwBNSVNDRUxMQU5FT1VTX1dBUk5JTkcASFBFX0lOVkFMSURfVFJBTlNGRVJfRU5DT0RJTkcARXhwZWN0ZWQgQ1JMRgBIUEVfSU5WQUxJRF9DSFVOS19TSVpFAE1PVkUAQ09OVElOVUUASFBFX0NCX1NUQVRVU19DT01QTEVURQBIUEVfQ0JfSEVBREVSU19DT01QTEVURQBIUEVfQ0JfVkVSU0lPTl9DT01QTEVURQBIUEVfQ0JfVVJMX0NPTVBMRVRFAEhQRV9DQl9DSFVOS19DT01QTEVURQBIUEVfQ0JfSEVBREVSX1ZBTFVFX0NPTVBMRVRFAEhQRV9DQl9DSFVOS19FWFRFTlNJT05fVkFMVUVfQ09NUExFVEUASFBFX0NCX0NIVU5LX0VYVEVOU0lPTl9OQU1FX0NPTVBMRVRFAEhQRV9DQl9NRVNTQUdFX0NPTVBMRVRFAEhQRV9DQl9NRVRIT0RfQ09NUExFVEUASFBFX0NCX0hFQURFUl9GSUVMRF9DT01QTEVURQBERUxFVEUASFBFX0lOVkFMSURfRU9GX1NUQVRFAElOVkFMSURfU1NMX0NFUlRJRklDQVRFAFBBVVNFAE5PX1JFU1BPTlNFAFVOU1VQUE9SVEVEX01FRElBX1RZUEUAR09ORQBOT1RfQUNDRVBUQUJMRQBTRVJWSUNFX1VOQVZBSUxBQkxFAFJBTkdFX05PVF9TQVRJU0ZJQUJMRQBPUklHSU5fSVNfVU5SRUFDSEFCTEUAUkVTUE9OU0VfSVNfU1RBTEUAUFVSR0UATUVSR0UAUkVRVUVTVF9IRUFERVJfRklFTERTX1RPT19MQVJHRQBSRVFVRVNUX0hFQURFUl9UT09fTEFSR0UAUEFZTE9BRF9UT09fTEFSR0UASU5TVUZGSUNJRU5UX1NUT1JBR0UASFBFX1BBVVNFRF9VUEdSQURFAEhQRV9QQVVTRURfSDJfVVBHUkFERQBTT1VSQ0UAQU5OT1VOQ0UAVFJBQ0UASFBFX1VORVhQRUNURURfU1BBQ0UAREVTQ1JJQkUAVU5TVUJTQ1JJQkUAUkVDT1JEAEhQRV9JTlZBTElEX01FVEhPRABOT1RfRk9VTkQAUFJPUEZJTkQAVU5CSU5EAFJFQklORABVTkFVVEhPUklaRUQATUVUSE9EX05PVF9BTExPV0VEAEhUVFBfVkVSU0lPTl9OT1RfU1VQUE9SVEVEAEFMUkVBRFlfUkVQT1JURUQAQUNDRVBURUQATk9UX0lNUExFTUVOVEVEAExPT1BfREVURUNURUQASFBFX0NSX0VYUEVDVEVEAEhQRV9MRl9FWFBFQ1RFRABDUkVBVEVEAElNX1VTRUQASFBFX1BBVVNFRABUSU1FT1VUX09DQ1VSRUQAUEFZTUVOVF9SRVFVSVJFRABQUkVDT05ESVRJT05fUkVRVUlSRUQAUFJPWFlfQVVUSEVOVElDQVRJT05fUkVRVUlSRUQATkVUV09SS19BVVRIRU5USUNBVElPTl9SRVFVSVJFRABMRU5HVEhfUkVRVUlSRUQAU1NMX0NFUlRJRklDQVRFX1JFUVVJUkVEAFVQR1JBREVfUkVRVUlSRUQAUEFHRV9FWFBJUkVEAFBSRUNPTkRJVElPTl9GQUlMRUQARVhQRUNUQVRJT05fRkFJTEVEAFJFVkFMSURBVElPTl9GQUlMRUQAU1NMX0hBTkRTSEFLRV9GQUlMRUQATE9DS0VEAFRSQU5TRk9STUFUSU9OX0FQUExJRUQATk9UX01PRElGSUVEAE5PVF9FWFRFTkRFRABCQU5EV0lEVEhfTElNSVRfRVhDRUVERUQAU0lURV9JU19PVkVSTE9BREVEAEhFQUQARXhwZWN0ZWQgSFRUUC8AAF4TAAAmEwAAMBAAAPAXAACdEwAAFRIAADkXAADwEgAAChAAAHUSAACtEgAAghMAAE8UAAB/EAAAoBUAACMUAACJEgAAixQAAE0VAADUEQAAzxQAABAYAADJFgAA3BYAAMERAADgFwAAuxQAAHQUAAB8FQAA5RQAAAgXAAAfEAAAZRUAAKMUAAAoFQAAAhUAAJkVAAAsEAAAixkAAE8PAADUDgAAahAAAM4QAAACFwAAiQ4AAG4TAAAcEwAAZhQAAFYXAADBEwAAzRMAAGwTAABoFwAAZhcAAF8XAAAiEwAAzg8AAGkOAADYDgAAYxYAAMsTAACqDgAAKBcAACYXAADFEwAAXRYAAOgRAABnEwAAZRMAAPIWAABzEwAAHRcAAPkWAADzEQAAzw4AAM4VAAAMEgAAsxEAAKURAABhEAAAMhcAALsTAEH5NQsBAQBBkDYL4AEBAQIBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEAAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQBB/TcLAQEAQZE4C14CAwICAgICAAACAgACAgACAgICAgICAgICAAQAAAAAAAICAgICAgICAgICAgICAgICAgICAgICAgICAAAAAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAAgACAEH9OQsBAQBBkToLXgIAAgICAgIAAAICAAICAAICAgICAgICAgIAAwAEAAAAAgICAgICAgICAgICAgICAgICAgICAgICAgIAAAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgACAAIAQfA7Cw1sb3NlZWVwLWFsaXZlAEGJPAsBAQBBoDwL4AEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQABAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQBBiT4LAQEAQaA+C+cBAQEBAQEBAQEBAQEBAgEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEAAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQFjaHVua2VkAEGwwAALXwEBAAEBAQEBAAABAQABAQABAQEBAQEBAQEBAAAAAAAAAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAAAAAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEAAQABAEGQwgALIWVjdGlvbmVudC1sZW5ndGhvbnJveHktY29ubmVjdGlvbgBBwMIACy1yYW5zZmVyLWVuY29kaW5ncGdyYWRlDQoNCg0KU00NCg0KVFRQL0NFL1RTUC8AQfnCAAsFAQIAAQMAQZDDAAvgAQQBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAEH5xAALBQECAAEDAEGQxQAL4AEEAQEFAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQABAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQBB+cYACwQBAAABAEGRxwAL3wEBAQABAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEAAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAEH6yAALBAEAAAIAQZDJAAtfAwQAAAQEBAQEBAQEBAQEBQQEBAQEBAQEBAQEBAAEAAYHBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEAAQABAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAAAAAQAQfrKAAsEAQAAAQBBkMsACwEBAEGqywALQQIAAAAAAAADAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwAAAAAAAAMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAEH6zAALBAEAAAEAQZDNAAsBAQBBms0ACwYCAAAAAAIAQbHNAAs6AwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMAAAAAAAADAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwBB8M4AC5YBTk9VTkNFRUNLT1VUTkVDVEVURUNSSUJFTFVTSEVURUFEU0VBUkNIUkdFQ1RJVklUWUxFTkRBUlZFT1RJRllQVElPTlNDSFNFQVlTVEFUQ0hHRU9SRElSRUNUT1JUUkNIUEFSQU1FVEVSVVJDRUJTQ1JJQkVBUkRPV05BQ0VJTkROS0NLVUJTQ1JJQkVIVFRQL0FEVFAv', 'base64');
	return llhttpWasm;
}

var llhttp_simdWasm;
var hasRequiredLlhttp_simdWasm;

function requireLlhttp_simdWasm () {
	if (hasRequiredLlhttp_simdWasm) return llhttp_simdWasm;
	hasRequiredLlhttp_simdWasm = 1;

	const { Buffer } = require$$0$1;

	llhttp_simdWasm = Buffer.from('AGFzbQEAAAABJwdgAX8Bf2ADf39/AX9gAX8AYAJ/fwBgBH9/f38Bf2AAAGADf39/AALLAQgDZW52GHdhc21fb25faGVhZGVyc19jb21wbGV0ZQAEA2VudhV3YXNtX29uX21lc3NhZ2VfYmVnaW4AAANlbnYLd2FzbV9vbl91cmwAAQNlbnYOd2FzbV9vbl9zdGF0dXMAAQNlbnYUd2FzbV9vbl9oZWFkZXJfZmllbGQAAQNlbnYUd2FzbV9vbl9oZWFkZXJfdmFsdWUAAQNlbnYMd2FzbV9vbl9ib2R5AAEDZW52GHdhc21fb25fbWVzc2FnZV9jb21wbGV0ZQAAAy0sBQYAAAIAAAAAAAACAQIAAgICAAADAAAAAAMDAwMBAQEBAQEBAQEAAAIAAAAEBQFwARISBQMBAAIGCAF/AUGA1AQLB9EFIgZtZW1vcnkCAAtfaW5pdGlhbGl6ZQAIGV9faW5kaXJlY3RfZnVuY3Rpb25fdGFibGUBAAtsbGh0dHBfaW5pdAAJGGxsaHR0cF9zaG91bGRfa2VlcF9hbGl2ZQAvDGxsaHR0cF9hbGxvYwALBm1hbGxvYwAxC2xsaHR0cF9mcmVlAAwEZnJlZQAMD2xsaHR0cF9nZXRfdHlwZQANFWxsaHR0cF9nZXRfaHR0cF9tYWpvcgAOFWxsaHR0cF9nZXRfaHR0cF9taW5vcgAPEWxsaHR0cF9nZXRfbWV0aG9kABAWbGxodHRwX2dldF9zdGF0dXNfY29kZQAREmxsaHR0cF9nZXRfdXBncmFkZQASDGxsaHR0cF9yZXNldAATDmxsaHR0cF9leGVjdXRlABQUbGxodHRwX3NldHRpbmdzX2luaXQAFQ1sbGh0dHBfZmluaXNoABYMbGxodHRwX3BhdXNlABcNbGxodHRwX3Jlc3VtZQAYG2xsaHR0cF9yZXN1bWVfYWZ0ZXJfdXBncmFkZQAZEGxsaHR0cF9nZXRfZXJybm8AGhdsbGh0dHBfZ2V0X2Vycm9yX3JlYXNvbgAbF2xsaHR0cF9zZXRfZXJyb3JfcmVhc29uABwUbGxodHRwX2dldF9lcnJvcl9wb3MAHRFsbGh0dHBfZXJybm9fbmFtZQAeEmxsaHR0cF9tZXRob2RfbmFtZQAfEmxsaHR0cF9zdGF0dXNfbmFtZQAgGmxsaHR0cF9zZXRfbGVu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PgtBhwEMPQtBiAEMPAtBiQEMOwtBigEMOgtBiwEMOQtBjAEMOAtBjQEMNwtBjgEMNgtBjwEMNQtBkAEMNAtBkQEMMwtBkgEMMgtBkwEMMQtBlAEMMAtBlQEMLwtBlgEMLgtBlwEMLQtBmAEMLAtBmQEMKwtBmgEMKgtBmwEMKQtBnAEMKAtBnQEMJwtBngEMJgtBnwEMJQtBoAEMJAtBoQEMIwtBogEMIgtBowEMIQtBpAEMIAtBpQEMHwtBpgEMHgtBpwEMHQtBqAEMHAtBqQEMGwtBqgEMGgtBqwEMGQtBrAEMGAtBrQEMFwtBrgEMFgtBAQwVC0GvAQwUC0GwAQwTC0GxAQwSC0GzAQwRC0GyAQwQC0G0AQwPC0G1AQwOC0G2AQwNC0G3AQwMC0G4AQwLC0G5AQwKC0G6AQwJC0G7AQwIC0HGAQwHC0G8AQwGC0G9AQwFC0G+AQwEC0G/AQwDC0HAAQwCC0HCAQwBC0HBAQshAwNAAkACQAJAAkACQAJAAkACQAJAIAICfwJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJ/AkACQAJAAkACQAJAAkACQAJAAkACQAJAAkAgAgJ/AkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACfwJAAkACfwJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkAC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iQEhAwykAgtBASABLQAAQd8ARw1nGiABQQFqIQEMXgtBigEhAyABIARGDaICIAIoAgAiACAEIAFraiEFIAEgAGtBAWohBgNAIAEtAAAgAEGMzwBqLQAARw1kIABBAUYN+gEgAEEBaiEAIAQgAUEBaiIBRw0ACyACIAU2AgAMogILQYsBIQMgASAERg2hAiACKAIAIgAgBCABa2ohBSABIABrQQJqIQYCQANAIAEtAAAgAEGOzwBqLQAARw1kIABBAkYNASAAQQFqIQAgBCABQQFqIgFHDQALIAIgBTYCAAyiAgsgAkEANgIAIAZBAWohAUECDGULQYwBIQMgASAERg2gAiACKAIAIgAgBCABa2ohBSABIABrQQFqIQYCQANAIAEtAAAgAEHwzwBqLQAARw1jIABBAUYNASAAQQFqIQAgBCABQQFqIgFHDQALIAIgBTYCAAyhAgsgAkEANgIAIAZBAWohAUEfDGQLQY0BIQMgASAERg2fAiACKAIAIgAgBCABa2ohBSABIABrQQFqIQYCQANAIAEtAAAgAEHyzwBqLQAARw1iIABBAUYNASAAQQFqIQAgBCABQQFqIgFHDQALIAIgBTYCAAygAgsgAkEANgIAIAZBAWohAUEJDGMLIAEgBEYEQEGOASEDDJ8CCwJAAkAgAS0AAEHJAGsOBwBiYmJiYgFiCyABQQFqIQFB+AAhAwyGAgsgAUEBaiEBQfkAIQMMhQILQY8BIQMgASAERg2dAiACKAIAIgAgBCABa2ohBSABIABrQQVqIQYCQANAIAEtAAAgAEGRzwBqLQAARw1gIABBBUYNASAAQQFqIQAgBCABQQFqIgFHDQALIAIgBTYCAAyeAgsgAkEANgIAIAZBAWohAUEYDGELQZABIQMgASAERg2cAiACKAIAIgAgBCABa2ohBSABIABrQQJqIQYCQANAIAEtAAAgAEGXzwBqLQAARw1fIABBAkYNASAAQQFqIQAgBCABQQFqIgFHDQALIAIgBTYCAAydAgsgAkEANgIAIAZBAWohAUEXDGALQZEBIQMgASAERg2bAiACKAIAIgAgBCABa2ohBSABIABrQQZqIQYCQANAIAEtAAAgAEGazwBqLQAARw1eIABBBkYNASAAQQFqIQAgBCABQQFqIgFHDQALIAIgBTYCAAycAgsgAkEANgIAIAZBAWohAUEV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JSIARQ0RIAJB5QA2AhwgAiABNgIUIAIgADYCDEEAIQMMtAELIAIoAgQhACACQQA2AgQgAiAAIAEQJSIARQ0gIAJB0wA2AhwgAiABNgIUIAIgADYCDEEAIQMMswELIAIoAgQhACACQQA2AgQgAiAAIAEQJSIARQ0iIAJB0gA2AhwgAiABNgIUIAIgADYCDEEAIQMMsgELIAIoAgQhACACQQA2AgQgAiAAIAEQJSIARQ0OIAJB5QA2AhwgAiABNgIUIAIgADYCDEEAIQMMsQELIAIoAgQhACACQQA2AgQgAiAAIAEQJSIARQ0dIAJB0wA2AhwgAiABNgIUIAIgADYCDEEAIQMMsAELIAIoAgQhACACQQA2AgQgAiAAIAEQJSIARQ0fIAJB0gA2AhwgAiABNgIUIAIgADYCDEEAIQMMrwELIABBP0cNASABQQFqCyEBQQUhAwyUAQtBACEDIAJBADYCHCACIAE2AhQgAkH9EjYCECACQQc2AgwMrAELIAJBADYCHCACIAE2AhQgAkHcCDYCECACQQc2AgxBACEDDKsBCyACKAIEIQAgAkEANgIEIAIgACABECUiAEUNByACQeUANgIcIAIgATYCFCACIAA2AgxBACEDDKoBCyACKAIEIQAgAkEANgIEIAIgACABECUiAEUNFiACQdMANgIcIAIgATYCFCACIAA2AgxBACEDDKkBCyACKAIEIQAgAkEANgIEIAIgACABECUiAEUNGCACQdIANgIcIAIgATYCFCACIAA2AgxBACEDDKgBCyACQQA2AhwgAiABNgIUIAJBxgo2AhAgAkEHNgIMQQAhAwynAQsgAigCBCEAIAJBADYCBCACIAAgARAlIgBFDQMgAkHlADYCHCACIAE2AhQgAiAANgIMQQAhAwymAQsgAigCBCEAIAJBADYCBCACIAAgARAlIgBFDRIgAkHTADYCHCACIAE2AhQgAiAANgIMQQAhAwylAQsgAigCBCEAIAJBADYCBCACIAAgARAlIgBFDRQgAkHSADYCHCACIAE2AhQgAiAANgIMQQAhAwykAQsgAigCBCEAIAJBADYCBCACIAAgARAlIgBFDQAgAkHlADYCHCACIAE2AhQgAiAANgIMQQAhAwyjAQtB1QAhAwyJAQsgAEEVRwRAIAJBADYCHCACIAE2AhQgAkG5DTYCECACQRo2AgxB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AkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAIABB5ABrDvQDY2IAAWFhYWFhYQIDBAVhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhBgcICQoLDA0OD2FhYWFhEGFhYWFhYWFhYWFhEWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYRITFBUWFxgZGhthYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhHB0eHyAhIiMkJSYnKCkqKywtLi8wMTIzNDU2YTc4OTphYWFhYWFhYTthYWE8YWFhYT0+P2FhYWFhYWFhQGFhQWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYUJDREVGR0hJSktMTU5PUFFSU2FhYWFhYWFhVFVWV1hZWlthXF1hYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFeYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhX2BhC0HhJw8LQaQhDwtByywPC0H+MQ8LQcAkDwtBqyQPC0GNKA8LQeImDwtBgDAPC0G5Lw8LQdckDwtB7x8PC0HhHw8LQfofDwtB8iAPC0GoLw8LQa4yDwtBiDAPC0HsJw8LQYIiDwtBjh0PC0HQLg8LQcojDwtBxTIPC0HfHA8LQdIcDwtBxCAPC0HXIA8LQaIfDwtB7S4PC0GrMA8LQdQlDwtBzC4PC0H6Lg8LQfwrDwtB0jAPC0HxHQ8LQbsgDwtB9ysPC0GQMQ8LQdcxDwtBoi0PC0HUJw8LQeArDwtBnywPC0HrMQ8LQdUfDwtByjEPC0HeJQ8LQdQeDwtB9BwPC0GnMg8LQbEdDwtBoB0PC0G5MQ8LQbwwDwtBkiEPC0GzJg8LQeksDwtBrB4PC0HUKw8LQfcmDwtBgCYPC0GwIQ8LQf4eDwtBjSMPC0GJLQ8LQfciDwtBoDEPC0GuHw8LQcYlDwtB6B4PC0GTIg8LQcIvDwtBwx0PC0GLLA8LQeEdDwtBjS8PC0HqIQ8LQbQtDwtB0i8PC0HfMg8LQdIyDwtB8DAPC0GpIg8LQfkjDwtBmR4PC0G1LA8LQZswDwtBkjIPC0G2Kw8LQcIiDwtB+DIPC0GeJQ8LQdAiDwtBuh4PC0GBHg8LAAtB1iEhAQsgAQsWACAAIAAtAC1B/gFxIAFBAEdyOgAtCxkAIAAgAC0ALUH9AXEgAUEAR0EBdHI6AC0LGQAgACAALQAtQfsBcSABQQBHQQJ0cjoALQsZACAAIAAtAC1B9wFxIAFBAEdBA3RyOgAtCz4BAn8CQCAAKAI4IgNFDQAgAygCBCIDRQ0AIAAgASACIAFrIAMRAQAiBEF/Rw0AIABBxhE2AhBBGCEECyAECz4BAn8CQCAAKAI4IgNFDQAgAygCCCIDRQ0AIAAgASACIAFrIAMRAQAiBEF/Rw0AIABB9go2AhBBGCEECyAECz4BAn8CQCAAKAI4IgNFDQAgAygCDCIDRQ0AIAAgASACIAFrIAMRAQAiBEF/Rw0AIABB7Ro2AhBBGCEECyAECz4BAn8CQCAAKAI4IgNFDQAgAygCECIDRQ0AIAAgASACIAFrIAMRAQAiBEF/Rw0AIABBlRA2AhBBGCEECyAECz4BAn8CQCAAKAI4IgNFDQAgAygCFCIDRQ0AIAAgASACIAFrIAMRAQAiBEF/Rw0AIABBqhs2AhBBGCEECyAECz4BAn8CQCAAKAI4IgNFDQAgAygCGCIDRQ0AIAAgASACIAFrIAMRAQAiBEF/Rw0AIABB7RM2AhBBGCEECyAECz4BAn8CQCAAKAI4IgNFDQAgAygCKCIDRQ0AIAAgASACIAFrIAMRAQAiBEF/Rw0AIABB9gg2AhBBGCEECyAECz4BAn8CQCAAKAI4IgNFDQAgAygCHCIDRQ0AIAAgASACIAFrIAMRAQAiBEF/Rw0AIABBwhk2AhBBGCEECyAECz4BAn8CQCAAKAI4IgNFDQAgAygCICIDRQ0AIAAgASACIAFrIAMRAQAiBEF/Rw0AIABBlBQ2AhBBGCEECyAEC1kBAn8CQCAALQAoQQFGDQAgAC8BMiIBQeQAa0HkAEkNACABQcwBRg0AIAFBsAJGDQAgAC8BMCIAQcAAcQ0AQQEhAiAAQYgEcUGABEYNACAAQShxRSECCyACC4wBAQJ/AkACQAJAIAAtACpFDQAgAC0AK0UNACAALwEwIgFBAnFFDQEMAgsgAC8BMCIBQQFxRQ0BC0EBIQIgAC0AKEEBRg0AIAAvATIiAEHkAGtB5ABJDQAgAEHMAUYNACAAQbACRg0AIAFBwABxDQBBACECIAFBiARxQYAERg0AIAFBKHFBAEchAgsgAgtzACAAQRBq/QwAAAAAAAAAAAAAAAAAAAAA/QsDACAA/QwAAAAAAAAAAAAAAAAAAAAA/QsDACAAQTBq/QwAAAAAAAAAAAAAAAAAAAAA/QsDACAAQSBq/QwAAAAAAAAAAAAAAAAAAAAA/QsDACAAQd0BNgIcCwYAIAAQMguaLQELfyMAQRBrIgokAEGk0AAoAgAiCUUEQEHk0wAoAgAiBUUEQEHw0wBCfzcCAEHo0wBCgICEgICAwAA3AgBB5NMAIApBCGpBcHFB2KrVqgVzIgU2AgBB+NMAQQA2AgBByNMAQQA2AgALQczTAEGA1AQ2AgBBnNAAQYDUBDYCAEGw0AAgBTYCAEGs0ABBfzYCAEHQ0wBBgKwDNgIAA0AgAUHI0ABqIAFBvNAAaiICNgIAIAIgAUG00ABqIgM2AgAgAUHA0ABqIAM2AgAgAUHQ0ABqIAFBxNAAaiIDNgIAIAMgAjYCACABQdjQAGogAUHM0ABqIgI2AgAgAiADNgIAIAFB1NAAaiACNgIAIAFBIGoiAUGAAkcNAAtBjNQEQcGrAzYCAEGo0ABB9NMAKAIANgIAQZjQAEHAqwM2AgBBpNAAQYjUBDYCAEHM/wdBODYCAEGI1AQhCQsCQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQCAAQewBTQRAQYzQACgCACIGQRAgAEETakFwcSAAQQtJGyIEQQN2IgB2IgFBA3EEQAJAIAFBAXEgAHJBAXMiAkEDdCIAQbTQAGoiASAAQbzQAGooAgAiACgCCCIDRgRAQYzQACAGQX4gAndxNgIADAELIAEgAzYCCCADIAE2AgwLIABBCGohASAAIAJBA3QiAkEDcjYCBCAAIAJqIgAgACgCBEEBcjYCBAwRC0GU0AAoAgAiCCAETw0BIAEEQAJAQQIgAHQiAkEAIAJrciABIAB0cWgiAEEDdCICQbTQAGoiASACQbzQAGooAgAiAigCCCIDRgRAQYzQACAGQX4gAHdxIgY2AgAMAQsgASADNgIIIAMgATYCDAsgAiAEQQNyNgIEIABBA3QiACAEayEFIAAgAmogBTYCACACIARqIgQgBUEBcjYCBCAIBEAgCEF4cUG00ABqIQBBoNAAKAIAIQMCf0EBIAhBA3Z0IgEgBnFFBEBBjNAAIAEgBnI2AgAgAAwBCyAAKAIICyIBIAM2AgwgACADNgIIIAMgADYCDCADIAE2AggLIAJBCGohAUGg0AAgBDYCAEGU0AAgBTYCAAwRC0GQ0AAoAgAiC0UNASALaEECdEG80gBqKAIAIgAoAgRBeHEgBGshBSAAIQIDQAJAIAIoAhAiAUUEQCACQRRqKAIAIgFFDQELIAEoAgRBeHEgBGsiAyAFSSECIAMgBSACGyEFIAEgACACGyEAIAEhAgwBCwsgACgCGCEJIAAoAgwiAyAARwRAQZzQACgCABogAyAAKAIIIgE2AgggASADNgIMDBALIABBFGoiAigCACIBRQRAIAAoAhAiAUUNAyAAQRBqIQILA0AgAiEHIAEiA0EUaiICKAIAIgENACADQRBqIQIgAygCECIBDQALIAdBADYCAAwPC0F/IQQgAEG/f0sNACAAQRNqIgFBcHEhBEGQ0AAoAgAiCEUNAEEAIARrIQUCQAJAAkACf0EAIARBgAJJDQAaQR8gBEH///8HSw0AGiAEQSYgAUEIdmciAGt2QQFxIABBAXRrQT5qCyIGQQJ0QbzSAGooAgAiAkUEQEEAIQFBACEDDAELQQAhASAEQRkgBkEBdmtBACAGQR9HG3QhAEEAIQMDQAJAIAIoAgRBeHEgBGsiByAFTw0AIAIhAyAHIgUNAEEAIQUgAiEBDAMLIAEgAkEUaigCACIHIAcgAiAAQR12QQRxakEQaigCACICRhsgASAHGyEBIABBAXQhACACDQALCyABIANyRQRAQQAhA0ECIAZ0IgBBACAAa3IgCHEiAEUNAyAAaEECdEG80gBqKAIAIQELIAFFDQELA0AgASgCBEF4cSAEayICIAVJIQAgAiAFIAAbIQUgASADIAAbIQMgASgCECIABH8gAAUgAUEUaigCAAsiAQ0ACwsgA0UNACAFQZTQACgCACAEa08NACADKAIYIQcgAyADKAIMIgBHBEBBnNAAKAIAGiAAIAMoAggiATYCCCABIAA2AgwMDgsgA0EUaiICKAIAIgFFBEAgAygCECIBRQ0DIANBEGohAgsDQCACIQYgASIAQRRqIgIoAgAiAQ0AIABBEGohAiAAKAIQIgENAAsgBkEANgIADA0LQZTQACgCACIDIARPBEBBoNAAKAIAIQECQCADIARrIgJBEE8EQCABIARqIgAgAkEBcjYCBCABIANqIAI2AgAgASAEQQNyNgIEDAELIAEgA0EDcjYCBCABIANqIgAgACgCBEEBcjYCBEEAIQBBACECC0GU0AAgAjYCAEGg0AAgADYCACABQQhqIQEMDwtBmNAAKAIAIgMgBEsEQCAEIAlqIgAgAyAEayIBQQFyNgIEQaTQACAANgIAQZjQACABNgIAIAkgBEEDcjYCBCAJQQhqIQEMDwtBACEBIAQCf0Hk0wAoAgAEQEHs0wAoAgAMAQtB8NMAQn83AgBB6NMAQoCAhICAgMAANwIAQeTTACAKQQxqQXBxQdiq1aoFczYCAEH40wBBADYCAEHI0wBBADYCAEGAgAQLIgAgBEHHAGoiBWoiBkEAIABrIgdxIgJPBEBB/NMAQTA2AgAMDwsCQEHE0wAoAgAiAUUNAEG80wAoAgAiCCACaiEAIAAgAU0gACAIS3ENAEEAIQFB/NMAQTA2AgAMDwtByNMALQAAQQRxDQQCQAJAIAkEQEHM0wAhAQNAIAEoAgAiACAJTQRAIAAgASgCBGogCUsNAwsgASgCCCIBDQALC0EAEDMiAEF/Rg0FIAIhBkHo0wAoAgAiAUEBayIDIABxBEAgAiAAayAAIANqQQAgAWtxaiEGCyAEIAZPDQUgBkH+////B0sNBUHE0wAoAgAiAwRAQbzTACgCACIHIAZqIQEgASAHTQ0GIAEgA0sNBgsgBhAzIgEgAEcNAQwHCyAGIANrIAdxIgZB/v///wdLDQQgBhAzIQAgACABKAIAIAEoAgRqRg0DIAAhAQsCQCAGIARByABqTw0AIAFBf0YNAEHs0wAoAgAiACAFIAZrakEAIABrcSIAQf7///8HSwRAIAEhAAwHCyAAEDNBf0cEQCAAIAZqIQYgASEADAcLQQAgBmsQMxoMBAsgASIAQX9HDQUMAwtBACEDDAwLQQAhAAwKCyAAQX9HDQILQcjTAEHI0wAoAgBBBHI2AgALIAJB/v///wdLDQEgAhAzIQBBABAzIQEgAEF/Rg0BIAFBf0YNASAAIAFPDQEgASAAayIGIARBOGpNDQELQbzTAEG80wAoAgAgBmoiATYCAEHA0wAoAgAgAUkEQEHA0wAgATYCAAsCQAJAAkBBpNAAKAIAIgIEQEHM0wAhAQNAIAAgASgCACIDIAEoAgQiBWpGDQIgASgCCCIBDQALDAILQZzQACgCACIBQQBHIAAgAU9xRQRAQZzQACAANgIAC0EAIQFB0NMAIAY2AgBBzNMAIAA2AgBBrNAAQX82AgBBsNAAQeTTACgCADYCAEHY0wBBADYCAANAIAFByNAAaiABQbzQAGoiAjYCACACIAFBtNAAaiIDNgIAIAFBwNAAaiADNgIAIAFB0NAAaiABQcTQAGoiAzYCACADIAI2AgAgAUHY0ABqIAFBzNAAaiICNgIAIAIgAzYCACABQdTQAGogAjYCACABQSBqIgFBgAJHDQALQXggAGtBD3EiASAAaiICIAZBOGsiAyABayIBQQFyNgIEQajQAEH00wAoAgA2AgBBmNAAIAE2AgBBpNAAIAI2AgAgACADakE4NgIEDAILIAAgAk0NACACIANJDQAgASgCDEEIcQ0AQXggAmtBD3EiACACaiIDQZjQACgCACAGaiIHIABrIgBBAXI2AgQgASAFIAZqNgIEQajQAEH00wAoAgA2AgBBmNAAIAA2AgBBpNAAIAM2AgAgAiAHakE4NgIEDAELIABBnNAAKAIASQRAQZzQACAANgIACyAAIAZqIQNBzNMAIQECQAJAAkADQCADIAEoAgBHBEAgASgCCCIBDQEMAgsLIAEtAAxBCHFFDQELQczTACEBA0AgASgCACIDIAJNBEAgAyABKAIEaiIFIAJLDQMLIAEoAgghAQwACwALIAEgADYCACABIAEoAgQgBmo2AgQgAEF4IABrQQ9xaiIJIARBA3I2AgQgA0F4IANrQQ9xaiIGIAQgCWoiBGshASACIAZGBEBBpNAAIAQ2AgBBmNAAQZjQACgCACABaiIANgIAIAQgAEEBcjYCBAwIC0Gg0AAoAgAgBkYEQEGg0AAgBDYCAEGU0ABBlNAAKAIAIAFqIgA2AgAgBCAAQQFyNgIEIAAgBGogADYCAAwICyAGKAIEIgVBA3FBAUcNBiAFQXhxIQggBUH/AU0EQCAFQQN2IQMgBigCCCIAIAYoAgwiAkYEQEGM0ABBjNAAKAIAQX4gA3dxNgIADAcLIAIgADYCCCAAIAI2AgwMBgsgBigCGCEHIAYgBigCDCIARwRAIAAgBigCCCICNgIIIAIgADYCDAwFCyAGQRRqIgIoAgAiBUUEQCAGKAIQIgVFDQQgBkEQaiECCwNAIAIhAyAFIgBBFGoiAigCACIFDQAgAEEQaiECIAAoAhAiBQ0ACyADQQA2AgAMBAtBeCAAa0EPcSIBIABqIgcgBkE4ayIDIAFrIgFBAXI2AgQgACADakE4NgIEIAIgBUE3IAVrQQ9xakE/ayIDIAMgAkEQakkbIgNBIzYCBEGo0ABB9NMAKAIANgIAQZjQACABNgIAQaTQACAHNgIAIANBEGpB1NMAKQIANwIAIANBzNMAKQIANwIIQdTTACADQQhqNgIAQdDTACAGNgIAQczTACAANgIAQdjTAEEANgIAIANBJGohAQNAIAFBBzYCACAFIAFBBGoiAUsNAAsgAiADRg0AIAMgAygCBEF+cTYCBCADIAMgAmsiBTYCACACIAVBAXI2AgQgBUH/AU0EQCAFQXhxQbTQAGohAAJ/QYzQACgCACIBQQEgBUEDdnQiA3FFBEBBjNAAIAEgA3I2AgAgAAwBCyAAKAIICyIBIAI2AgwgACACNgIIIAIgADYCDCACIAE2AggMAQtBHyEBIAVB////B00EQCAFQSYgBUEIdmciAGt2QQFxIABBAXRrQT5qIQELIAIgATYCHCACQgA3AhAgAUECdEG80gBqIQBBkNAAKAIAIgNBASABdCIGcUUEQCAAIAI2AgBBkNAAIAMgBnI2AgAgAiAANgIYIAIgAjYCCCACIAI2AgwMAQsgBUEZIAFBAXZrQQAgAUEfRxt0IQEgACgCACEDAkADQCADIgAoAgRBeHEgBUYNASABQR12IQMgAUEBdCEBIAAgA0EEcWpBEGoiBigCACIDDQALIAYgAjYCACACIAA2AhggAiACNgIMIAIgAjYCCAwBCyAAKAIIIgEgAjYCDCAAIAI2AgggAkEANgIYIAIgADYCDCACIAE2AggLQZjQACgCACIBIARNDQBBpNAAKAIAIgAgBGoiAiABIARrIgFBAXI2AgRBmNAAIAE2AgBBpNAAIAI2AgAgACAEQQNyNgIEIABBCGohAQwIC0EAIQFB/NMAQTA2AgAMBwtBACEACyAHRQ0AAkAgBigCHCICQQJ0QbzSAGoiAygCACAGRgRAIAMgADYCACAADQFBkNAAQZDQACgCAEF+IAJ3cTYCAAwCCyAHQRBBFCAHKAIQIAZGG2ogADYCACAARQ0BCyAAIAc2AhggBigCECICBEAgACACNgIQIAIgADYCGAsgBkEUaigCACICRQ0AIABBFGogAjYCACACIAA2AhgLIAEgCGohASAGIAhqIgYoAgQhBQsgBiAFQX5xNgIEIAEgBGogATYCACAEIAFBAXI2AgQgAUH/AU0EQCABQXhxQbTQAGohAAJ/QYzQACgCACICQQEgAUEDdnQiAXFFBEBBjNAAIAEgAnI2AgAgAAwBCyAAKAIICyIBIAQ2AgwgACAENgIIIAQgADYCDCAEIAE2AggMAQtBHyEFIAFB////B00EQCABQSYgAUEIdmciAGt2QQFxIABBAXRrQT5qIQULIAQgBTYCHCAEQgA3AhAgBUECdEG80gBqIQBBkNAAKAIAIgJBASAFdCIDcUUEQCAAIAQ2AgBBkNAAIAIgA3I2AgAgBCAANgIYIAQgBDYCCCAEIAQ2AgwMAQsgAUEZIAVBAXZrQQAgBUEfRxt0IQUgACgCACEAAkADQCAAIgIoAgRBeHEgAUYNASAFQR12IQAgBUEBdCEFIAIgAEEEcWpBEGoiAygCACIADQALIAMgBDYCACAEIAI2AhggBCAENgIMIAQgBDYCCAwBCyACKAIIIgAgBDYCDCACIAQ2AgggBEEANgIYIAQgAjYCDCAEIAA2AggLIAlBCGohAQwCCwJAIAdFDQACQCADKAIcIgFBAnRBvNIAaiICKAIAIANGBEAgAiAANgIAIAANAUGQ0AAgCEF+IAF3cSIINgIADAILIAdBEEEUIAcoAhAgA0YbaiAANgIAIABFDQELIAAgBzYCGCADKAIQIgEEQCAAIAE2AhAgASAANgIYCyADQRRqKAIAIgFFDQAgAEEUaiABNgIAIAEgADYCGAsCQCAFQQ9NBEAgAyAEIAVqIgBBA3I2AgQgACADaiIAIAAoAgRBAXI2AgQMAQsgAyAEaiICIAVBAXI2AgQgAyAEQQNyNgIEIAIgBWogBTYCACAFQf8BTQRAIAVBeHFBtNAAaiEAAn9BjNAAKAIAIgFBASAFQQN2dCIFcUUEQEGM0AAgASAFcjYCACAADAELIAAoAggLIgEgAjYCDCAAIAI2AgggAiAANgIMIAIgATYCCAwBC0EfIQEgBUH///8HTQRAIAVBJiAFQQh2ZyIAa3ZBAXEgAEEBdGtBPmohAQsgAiABNgIcIAJCADcCECABQQJ0QbzSAGohAEEBIAF0IgQgCHFFBEAgACACNgIAQZDQACAEIAhyNgIAIAIgADYCGCACIAI2AgggAiACNgIMDAELIAVBGSABQQF2a0EAIAFBH0cbdCEBIAAoAgAhBAJAA0AgBCIAKAIEQXhxIAVGDQEgAUEddiEEIAFBAXQhASAAIARBBHFqQRBqIgYoAgAiBA0ACyAGIAI2AgAgAiAANgIYIAIgAjYCDCACIAI2AggMAQsgACgCCCIBIAI2AgwgACACNgIIIAJBADYCGCACIAA2AgwgAiABNgIICyADQQhqIQEMAQsCQCAJRQ0AAkAgACgCHCIBQQJ0QbzSAGoiAigCACAARgRAIAIgAzYCACADDQFBkNAAIAtBfiABd3E2AgAMAgsgCUEQQRQgCSgCECAARhtqIAM2AgAgA0UNAQsgAyAJNgIYIAAoAhAiAQRAIAMgATYCECABIAM2AhgLIABBFGooAgAiAUUNACADQRRqIAE2AgAgASADNgIYCwJAIAVBD00EQCAAIAQgBWoiAUEDcjYCBCAAIAFqIgEgASgCBEEBcjYCBAwBCyAAIARqIgcgBUEBcjYCBCAAIARBA3I2AgQgBSAHaiAFNgIAIAgEQCAIQXhxQbTQAGohAUGg0AAoAgAhAwJ/QQEgCEEDdnQiAiAGcUUEQEGM0AAgAiAGcjYCACABDAELIAEoAggLIgIgAzYCDCABIAM2AgggAyABNgIMIAMgAjYCCAtBoNAAIAc2AgBBlNAAIAU2AgALIABBCGohAQsgCkEQaiQAIAELQwAgAEUEQD8AQRB0DwsCQCAAQf//A3ENACAAQQBIDQAgAEEQdkAAIgBBf0YEQEH80wBBMDYCAEF/DwsgAEEQdA8LAAsL3D8iAEGACAsJAQAAAAIAAAADAEGUCAsFBAAAAAUAQaQICwkGAAAABwAAAAgAQdwIC4otSW52YWxpZCBjaGFyIGluIHVybCBxdWVyeQBTcGFuIGNhbGxiYWNrIGVycm9yIGluIG9uX2JvZHkAQ29udGVudC1MZW5ndGggb3ZlcmZsb3cAQ2h1bmsgc2l6ZSBvdmVyZmxvdwBSZXNwb25zZSBvdmVyZmxvdwBJbnZhbGlkIG1ldGhvZCBmb3IgSFRUUC94LnggcmVxdWVzdABJbnZhbGlkIG1ldGhvZCBmb3IgUlRTUC94LnggcmVxdWVzdABFeHBlY3RlZCBTT1VSQ0UgbWV0aG9kIGZvciBJQ0UveC54IHJlcXVlc3QASW52YWxpZCBjaGFyIGluIHVybCBmcmFnbWVudCBzdGFydABFeHBlY3RlZCBkb3QAU3BhbiBjYWxsYmFjayBlcnJvciBpbiBvbl9zdGF0dXMASW52YWxpZCByZXNwb25zZSBzdGF0dXMASW52YWxpZCBjaGFyYWN0ZXIgaW4gY2h1bmsgZXh0ZW5zaW9ucwBVc2VyIGNhbGxiYWNrIGVycm9yAGBvbl9yZXNldGAgY2FsbGJhY2sgZXJyb3IAYG9uX2NodW5rX2hlYWRlcmAgY2FsbGJhY2sgZXJyb3IAYG9uX21lc3NhZ2VfYmVnaW5gIGNhbGxiYWNrIGVycm9yAGBvbl9jaHVua19leHRlbnNpb25fdmFsdWVgIGNhbGxiYWNrIGVycm9yAGBvbl9zdGF0dXNfY29tcGxldGVgIGNhbGxiYWNrIGVycm9yAGBvbl92ZXJzaW9uX2NvbXBsZXRlYCBjYWxsYmFjayBlcnJvcgBgb25fdXJsX2NvbXBsZXRlYCBjYWxsYmFjayBlcnJvcgBgb25fY2h1bmtfY29tcGxldGVgIGNhbGxiYWNrIGVycm9yAGBvbl9oZWFkZXJfdmFsdWVfY29tcGxldGVgIGNhbGxiYWNrIGVycm9yAGBvbl9tZXNzYWdlX2NvbXBsZXRlYCBjYWxsYmFjayBlcnJvcgBgb25fbWV0aG9kX2NvbXBsZXRlYCBjYWxsYmFjayBlcnJvcgBgb25faGVhZGVyX2ZpZWxkX2NvbXBsZXRlYCBjYWxsYmFjayBlcnJvcgBgb25fY2h1bmtfZXh0ZW5zaW9uX25hbWVgIGNhbGxiYWNrIGVycm9yAFVuZXhwZWN0ZWQgY2hhciBpbiB1cmwgc2VydmVyAEludmFsaWQgaGVhZGVyIHZhbHVlIGNoYXIASW52YWxpZCBoZWFkZXIgZmllbGQgY2hhcgBTcGFuIGNhbGxiYWNrIGVycm9yIGluIG9uX3ZlcnNpb24ASW52YWxpZCBtaW5vciB2ZXJzaW9uAEludmFsaWQgbWFqb3IgdmVyc2lvbgBFeHBlY3RlZCBzcGFjZSBhZnRlciB2ZXJzaW9uAEV4cGVjdGVkIENSTEYgYWZ0ZXIgdmVyc2lvbgBJbnZhbGlkIEhUVFAgdmVyc2lvbgBJbnZhbGlkIGhlYWRlciB0b2tlbgBTcGFuIGNhbGxiYWNrIGVycm9yIGluIG9uX3VybABJbnZhbGlkIGNoYXJhY3RlcnMgaW4gdXJsAFVuZXhwZWN0ZWQgc3RhcnQgY2hhciBpbiB1cmwARG91YmxlIEAgaW4gdXJsAEVtcHR5IENvbnRlbnQtTGVuZ3RoAEludmFsaWQgY2hhcmFjdGVyIGluIENvbnRlbnQtTGVuZ3RoAER1cGxpY2F0ZSBDb250ZW50LUxlbmd0aABJbnZhbGlkIGNoYXIgaW4gdXJsIHBhdGgAQ29udGVudC1MZW5ndGggY2FuJ3QgYmUgcHJlc2VudCB3aXRoIFRyYW5zZmVyLUVuY29kaW5nAEludmFsaWQgY2hhcmFjdGVyIGluIGNodW5rIHNpemUAU3BhbiBjYWxsYmFjayBlcnJvciBpbiBvbl9oZWFkZXJfdmFsdWUAU3BhbiBjYWxsYmFjayBlcnJvciBpbiBvbl9jaHVua19leHRlbnNpb25fdmFsdWUASW52YWxpZCBjaGFyYWN0ZXIgaW4gY2h1bmsgZXh0ZW5zaW9ucyB2YWx1ZQBNaXNzaW5nIGV4cGVjdGVkIExGIGFmdGVyIGhlYWRlciB2YWx1ZQBJbnZhbGlkIGBUcmFuc2Zlci1FbmNvZGluZ2AgaGVhZGVyIHZhbHVlAEludmFsaWQgY2hhcmFjdGVyIGluIGNodW5rIGV4dGVuc2lvbnMgcXVvdGUgdmFsdWUASW52YWxpZCBjaGFyYWN0ZXIgaW4gY2h1bmsgZXh0ZW5zaW9ucyBxdW90ZWQgdmFsdWUAUGF1c2VkIGJ5IG9uX2hlYWRlcnNfY29tcGxldGUASW52YWxpZCBFT0Ygc3RhdGUAb25fcmVzZXQgcGF1c2UAb25fY2h1bmtfaGVhZGVyIHBhdXNlAG9uX21lc3NhZ2VfYmVnaW4gcGF1c2UAb25fY2h1bmtfZXh0ZW5zaW9uX3ZhbHVlIHBhdXNlAG9uX3N0YXR1c19jb21wbGV0ZSBwYXVzZQBvbl92ZXJzaW9uX2NvbXBsZXRlIHBhdXNlAG9uX3VybF9jb21wbGV0ZSBwYXVzZQBvbl9jaHVua19jb21wbGV0ZSBwYXVzZQBvbl9oZWFkZXJfdmFsdWVfY29tcGxldGUgcGF1c2UAb25fbWVzc2FnZV9jb21wbGV0ZSBwYXVzZQBvbl9tZXRob2RfY29tcGxldGUgcGF1c2UAb25faGVhZGVyX2ZpZWxkX2NvbXBsZXRlIHBhdXNlAG9uX2NodW5rX2V4dGVuc2lvbl9uYW1lIHBhdXNlAFVuZXhwZWN0ZWQgc3BhY2UgYWZ0ZXIgc3RhcnQgbGluZQBTcGFuIGNhbGxiYWNrIGVycm9yIGluIG9uX2NodW5rX2V4dGVuc2lvbl9uYW1lAEludmFsaWQgY2hhcmFjdGVyIGluIGNodW5rIGV4dGVuc2lvbnMgbmFtZQBQYXVzZSBvbiBDT05ORUNUL1VwZ3JhZGUAUGF1c2Ugb24gUFJJL1VwZ3JhZGUARXhwZWN0ZWQgSFRUUC8yIENvbm5lY3Rpb24gUHJlZmFjZQBTcGFuIGNhbGxiYWNrIGVycm9yIGluIG9uX21ldGhvZABFeHBlY3RlZCBzcGFjZSBhZnRlciBtZXRob2QAU3BhbiBjYWxsYmFjayBlcnJvciBpbiBvbl9oZWFkZXJfZmllbGQAUGF1c2VkAEludmFsaWQgd29yZCBlbmNvdW50ZXJlZABJbnZhbGlkIG1ldGhvZCBlbmNvdW50ZXJlZABVbmV4cGVjdGVkIGNoYXIgaW4gdXJsIHNjaGVtYQBSZXF1ZXN0IGhhcyBpbnZhbGlkIGBUcmFuc2Zlci1FbmNvZGluZ2AAU1dJVENIX1BST1hZAFVTRV9QUk9YWQBNS0FDVElWSVRZAFVOUFJPQ0VTU0FCTEVfRU5USVRZAENPUFkATU9WRURfUEVSTUFORU5UTFkAVE9PX0VBUkxZAE5PVElGWQBGQUlMRURfREVQRU5ERU5DWQBCQURfR0FURVdBWQBQTEFZAFBVVABDSEVDS09VVABHQVRFV0FZX1RJTUVPVVQAUkVRVUVTVF9USU1FT1VUAE5FVFdPUktfQ09OTkVDVF9USU1FT1VUAENPTk5FQ1RJT05fVElNRU9VVABMT0dJTl9USU1FT1VUAE5FVFdPUktfUkVBRF9USU1FT1VUAFBPU1QATUlTRElSRUNURURfUkVRVUVTVABDTElFTlRfQ0xPU0VEX1JFUVVFU1QAQ0xJRU5UX0NMT1NFRF9MT0FEX0JBTEFOQ0VEX1JFUVVFU1QAQkFEX1JFUVVFU1QASFRUUF9SRVFVRVNUX1NFTlRfVE9fSFRUUFNfUE9SVABSRVBPUlQASU1fQV9URUFQT1QAUkVTRVRfQ09OVEVOVABOT19DT05URU5UAFBBUlRJQUxfQ09OVEVOVABIUEVfSU5WQUxJRF9DT05TVEFOVABIUEVfQ0JfUkVTRVQAR0VUAEhQRV9TVFJJQ1QAQ09ORkxJQ1QAVEVNUE9SQVJZX1JFRElSRUNUAFBFUk1BTkVOVF9SRURJUkVDVABDT05ORUNUAE1VTFRJX1NUQVRVUwBIUEVfSU5WQUxJRF9TVEFUVVMAVE9PX01BTllfUkVRVUVTVFMARUFSTFlfSElOVFMAVU5BVkFJTEFCTEVfRk9SX0xFR0FMX1JFQVNPTlMAT1BUSU9OUwBTV0lUQ0hJTkdfUFJPVE9DT0xTAFZBUklBTlRfQUxTT19ORUdPVElBVEVTAE1VTFRJUExFX0NIT0lDRVMASU5URVJOQUxfU0VSVkVSX0VSUk9SAFdFQl9TRVJWRVJfVU5LTk9XTl9FUlJPUgBSQUlMR1VOX0VSUk9SAElERU5USVRZX1BST1ZJREVSX0FVVEhFTlRJQ0FUSU9OX0VSUk9SAFNTTF9DRVJUSUZJQ0FURV9FUlJPUgBJTlZBTElEX1hfRk9SV0FSREVEX0ZPUgBTRVRfUEFSQU1FVEVSAEdFVF9QQVJBTUVURVIASFBFX1VTRVIAU0VFX09USEVSAEhQRV9DQl9DSFVOS19IRUFERVIATUtDQUxFTkRBUgBTRVRVUABXRUJfU0VSVkVSX0lTX0RPV04AVEVBUkRPV04ASFBFX0NMT1NFRF9DT05ORUNUSU9OAEhFVVJJU1RJQ19FWFBJUkFUSU9OAERJU0NPTk5FQ1RFRF9PUEVSQVRJT04ATk9OX0FVVEhPUklUQVRJVkVfSU5GT1JNQVRJT04ASFBFX0lOVkFMSURfVkVSU0lPTgBIUEVfQ0JfTUVTU0FHRV9CRUdJTgBTSVRFX0lTX0ZST1pFTgBIUEVfSU5WQUxJRF9IRUFERVJfVE9LRU4ASU5WQUxJRF9UT0tFTgBGT1JCSURERU4ARU5IQU5DRV9ZT1VSX0NBTE0ASFBFX0lOVkFMSURfVVJMAEJMT0NLRURfQllfUEFSRU5UQUxfQ09OVFJPTABNS0NPTABBQ0wASFBFX0lOVEVSTkFMAFJFUVVFU1RfSEVBREVSX0ZJRUxEU19UT09fTEFSR0VfVU5PRkZJQ0lBTABIUEVfT0sAVU5MSU5LAFVOTE9DSwBQUkkAUkVUUllfV0lUSABIUEVfSU5WQUxJRF9DT05URU5UX0xFTkdUSABIUEVfVU5FWFBFQ1RFRF9DT05URU5UX0xFTkdUSABGTFVTSABQUk9QUEFUQ0gATS1TRUFSQ0gAVVJJX1RPT19MT05HAFBST0NFU1NJTkcATUlTQ0VMTEFORU9VU19QRVJTSVNURU5UX1dBUk5JTkcATUlTQ0VMTEFORU9VU19XQVJOSU5HAEhQRV9JTlZBTElEX1RSQU5TRkVSX0VOQ09ESU5HAEV4cGVjdGVkIENSTEYASFBFX0lOVkFMSURfQ0hVTktfU0laRQBNT1ZFAENPTlRJTlVFAEhQRV9DQl9TVEFUVVNfQ09NUExFVEUASFBFX0NCX0hFQURFUlNfQ09NUExFVEUASFBFX0NCX1ZFUlNJT05fQ09NUExFVEUASFBFX0NCX1VSTF9DT01QTEVURQBIUEVfQ0JfQ0hVTktfQ09NUExFVEUASFBFX0NCX0hFQURFUl9WQUxVRV9DT01QTEVURQBIUEVfQ0JfQ0hVTktfRVhURU5TSU9OX1ZBTFVFX0NPTVBMRVRFAEhQRV9DQl9DSFVOS19FWFRFTlNJT05fTkFNRV9DT01QTEVURQBIUEVfQ0JfTUVTU0FHRV9DT01QTEVURQBIUEVfQ0JfTUVUSE9EX0NPTVBMRVRFAEhQRV9DQl9IRUFERVJfRklFTERfQ09NUExFVEUAREVMRVRFAEhQRV9JTlZBTElEX0VPRl9TVEFURQBJTlZBTElEX1NTTF9DRVJUSUZJQ0FURQBQQVVTRQBOT19SRVNQT05TRQBVTlNVUFBPUlRFRF9NRURJQV9UWVBFAEdPTkUATk9UX0FDQ0VQVEFCTEUAU0VSVklDRV9VTkFWQUlMQUJMRQBSQU5HRV9OT1RfU0FUSVNGSUFCTEUAT1JJR0lOX0lTX1VOUkVBQ0hBQkxFAFJFU1BPTlNFX0lTX1NUQUxFAFBVUkdFAE1FUkdFAFJFUVVFU1RfSEVBREVSX0ZJRUxEU19UT09fTEFSR0UAUkVRVUVTVF9IRUFERVJfVE9PX0xBUkdFAFBBWUxPQURfVE9PX0xBUkdFAElOU1VGRklDSUVOVF9TVE9SQUdFAEhQRV9QQVVTRURfVVBHUkFERQBIUEVfUEFVU0VEX0gyX1VQR1JBREUAU09VUkNFAEFOTk9VTkNFAFRSQUNFAEhQRV9VTkVYUEVDVEVEX1NQQUNFAERFU0NSSUJFAFVOU1VCU0NSSUJFAFJFQ09SRABIUEVfSU5WQUxJRF9NRVRIT0QATk9UX0ZPVU5EAFBST1BGSU5EAFVOQklORABSRUJJTkQAVU5BVVRIT1JJWkVEAE1FVEhPRF9OT1RfQUxMT1dFRABIVFRQX1ZFUlNJT05fTk9UX1NVUFBPUlRFRABBTFJFQURZX1JFUE9SVEVEAEFDQ0VQVEVEAE5PVF9JTVBMRU1FTlRFRABMT09QX0RFVEVDVEVEAEhQRV9DUl9FWFBFQ1RFRABIUEVfTEZfRVhQRUNURUQAQ1JFQVRFRABJTV9VU0VEAEhQRV9QQVVTRUQAVElNRU9VVF9PQ0NVUkVEAFBBWU1FTlRfUkVRVUlSRUQAUFJFQ09ORElUSU9OX1JFUVVJUkVEAFBST1hZX0FVVEhFTlRJQ0FUSU9OX1JFUVVJUkVEAE5FVFdPUktfQVVUSEVOVElDQVRJT05fUkVRVUlSRUQATEVOR1RIX1JFUVVJUkVEAFNTTF9DRVJUSUZJQ0FURV9SRVFVSVJFRABVUEdSQURFX1JFUVVJUkVEAFBBR0VfRVhQSVJFRABQUkVDT05ESVRJT05fRkFJTEVEAEVYUEVDVEFUSU9OX0ZBSUxFRABSRVZBTElEQVRJT05fRkFJTEVEAFNTTF9IQU5EU0hBS0VfRkFJTEVEAExPQ0tFRABUUkFOU0ZPUk1BVElPTl9BUFBMSUVEAE5PVF9NT0RJRklFRABOT1RfRVhURU5ERUQAQkFORFdJRFRIX0xJTUlUX0VYQ0VFREVEAFNJVEVfSVNfT1ZFUkxPQURFRABIRUFEAEV4cGVjdGVkIEhUVFAvAABeEwAAJhMAADAQAADwFwAAnRMAABUSAAA5FwAA8BIAAAoQAAB1EgAArRIAAIITAABPFAAAfxAAAKAVAAAjFAAAiRIAAIsUAABNFQAA1BEAAM8UAAAQGAAAyRYAANwWAADBEQAA4BcAALsUAAB0FAAAfBUAAOUUAAAIFwAAHxAAAGUVAACjFAAAKBUAAAIVAACZFQAALBAAAIsZAABPDwAA1A4AAGoQAADOEAAAAhcAAIkOAABuEwAAHBMAAGYUAABWFwAAwRMAAM0TAABsEwAAaBcAAGYXAABfFwAAIhMAAM4PAABpDgAA2A4AAGMWAADLEwAAqg4AACgXAAAmFwAAxRMAAF0WAADoEQAAZxMAAGUTAADyFgAAcxMAAB0XAAD5FgAA8xEAAM8OAADOFQAADBIAALMRAAClEQAAYRAAADIXAAC7EwBB+TULAQEAQZA2C+ABAQECAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEAQf03CwEBAEGROAteAgMCAgICAgAAAgIAAgIAAgICAgICAgICAgAEAAAAAAACAgICAgICAgICAgICAgICAgICAgICAgICAgAAAAICAgICAgICAgICAgICAgICAgICAgICAgICAgICAAIAAgBB/TkLAQEAQZE6C14CAAICAgICAAACAgACAgACAgICAgICAgICAAMABAAAAAICAgICAgICAgICAgICAgICAgICAgICAgICAAAAAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAAgACAEHwOwsNbG9zZWVlcC1hbGl2ZQBBiTwLAQEAQaA8C+ABAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEAAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEAQYk+CwEBAEGgPgvnAQEBAQEBAQEBAQEBAQIBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBY2h1bmtlZABBsMAAC18BAQABAQEBAQAAAQEAAQEAAQEBAQEBAQEBAQAAAAAAAAABAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQAAAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAAEAAQBBkMIACyFlY3Rpb25lbnQtbGVuZ3Rob25yb3h5LWNvbm5lY3Rpb24AQcDCAAstcmFuc2Zlci1lbmNvZGluZ3BncmFkZQ0KDQoNClNNDQoNClRUUC9DRS9UU1AvAEH5wgALBQECAAEDAEGQwwAL4AEEAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQABAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQBB+cQACwUBAgABAwBBkMUAC+ABBAEBBQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEAAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEAQfnGAAsEAQAAAQBBkccAC98BAQEAAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQABAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQBB+sgACwQBAAACAEGQyQALXwMEAAAEBAQEBAQEBAQEBAUEBAQEBAQEBAQEBAQABAAGBwQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAAEAAQABAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQAAAAEAEH6ygALBAEAAAEAQZDLAAsBAQBBqssAC0ECAAAAAAAAAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMAAAAAAAADAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwBB+swACwQBAAABAEGQzQALAQEAQZrNAAsGAgAAAAACAEGxzQALOgMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAAAAAAAAAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMAQfDOAAuWAU5PVU5DRUVDS09VVE5FQ1RFVEVDUklCRUxVU0hFVEVBRFNFQVJDSFJHRUNUSVZJVFlMRU5EQVJWRU9USUZZUFRJT05TQ0hTRUFZU1RBVENIR0VPUkRJUkVDVE9SVFJDSFBBUkFNRVRFUlVSQ0VCU0NSSUJFQVJET1dOQUNFSU5ETktDS1VCU0NSSUJFSFRUUC9BRFRQLw==', 'base64');
	return llhttp_simdWasm;
}

var constants$2;
var hasRequiredConstants$2;

function requireConstants$2 () {
	if (hasRequiredConstants$2) return constants$2;
	hasRequiredConstants$2 = 1;

	const corsSafeListedMethods = /** @type {const} */ (['GET', 'HEAD', 'POST']);
	const corsSafeListedMethodsSet = new Set(corsSafeListedMethods);

	const nullBodyStatus = /** @type {const} */ ([101, 204, 205, 304]);

	const redirectStatus = /** @type {const} */ ([301, 302, 303, 307, 308]);
	const redirectStatusSet = new Set(redirectStatus);

	/**
	 * @see https://fetch.spec.whatwg.org/#block-bad-port
	 */
	const badPorts = /** @type {const} */ ([
	  '1', '7', '9', '11', '13', '15', '17', '19', '20', '21', '22', '23', '25', '37', '42', '43', '53', '69', '77', '79',
	  '87', '95', '101', '102', '103', '104', '109', '110', '111', '113', '115', '117', '119', '123', '135', '137',
	  '139', '143', '161', '179', '389', '427', '465', '512', '513', '514', '515', '526', '530', '531', '532',
	  '540', '548', '554', '556', '563', '587', '601', '636', '989', '990', '993', '995', '1719', '1720', '1723',
	  '2049', '3659', '4045', '4190', '5060', '5061', '6000', '6566', '6665', '6666', '6667', '6668', '6669', '6679',
	  '6697', '10080'
	]);
	const badPortsSet = new Set(badPorts);

	/**
	 * @see https://w3c.github.io/webappsec-referrer-policy/#referrer-policies
	 */
	const referrerPolicy = /** @type {const} */ ([
	  '',
	  'no-referrer',
	  'no-referrer-when-downgrade',
	  'same-origin',
	  'origin',
	  'strict-origin',
	  'origin-when-cross-origin',
	  'strict-origin-when-cross-origin',
	  'unsafe-url'
	]);
	const referrerPolicySet = new Set(referrerPolicy);

	const requestRedirect = /** @type {const} */ (['follow', 'manual', 'error']);

	const safeMethods = /** @type {const} */ (['GET', 'HEAD', 'OPTIONS', 'TRACE']);
	const safeMethodsSet = new Set(safeMethods);

	const requestMode = /** @type {const} */ (['navigate', 'same-origin', 'no-cors', 'cors']);

	const requestCredentials = /** @type {const} */ (['omit', 'same-origin', 'include']);

	const requestCache = /** @type {const} */ ([
	  'default',
	  'no-store',
	  'reload',
	  'no-cache',
	  'force-cache',
	  'only-if-cached'
	]);

	/**
	 * @see https://fetch.spec.whatwg.org/#request-body-header-name
	 */
	const requestBodyHeader = /** @type {const} */ ([
	  'content-encoding',
	  'content-language',
	  'content-location',
	  'content-type',
	  // See https://github.com/nodejs/undici/issues/2021
	  // 'Content-Length' is a forbidden header name, which is typically
	  // removed in the Headers implementation. However, undici doesn't
	  // filter out headers, so we add it here.
	  'content-length'
	]);

	/**
	 * @see https://fetch.spec.whatwg.org/#enumdef-requestduplex
	 */
	const requestDuplex = /** @type {const} */ ([
	  'half'
	]);

	/**
	 * @see http://fetch.spec.whatwg.org/#forbidden-method
	 */
	const forbiddenMethods = /** @type {const} */ (['CONNECT', 'TRACE', 'TRACK']);
	const forbiddenMethodsSet = new Set(forbiddenMethods);

	const subresource = /** @type {const} */ ([
	  'audio',
	  'audioworklet',
	  'font',
	  'image',
	  'manifest',
	  'paintworklet',
	  'script',
	  'style',
	  'track',
	  'video',
	  'xslt',
	  ''
	]);
	const subresourceSet = new Set(subresource);

	constants$2 = {
	  subresource,
	  forbiddenMethods,
	  requestBodyHeader,
	  referrerPolicy,
	  requestRedirect,
	  requestMode,
	  requestCredentials,
	  requestCache,
	  redirectStatus,
	  corsSafeListedMethods,
	  nullBodyStatus,
	  safeMethods,
	  badPorts,
	  requestDuplex,
	  subresourceSet,
	  badPortsSet,
	  redirectStatusSet,
	  corsSafeListedMethodsSet,
	  safeMethodsSet,
	  forbiddenMethodsSet,
	  referrerPolicySet
	};
	return constants$2;
}

var global$2;
var hasRequiredGlobal$1;

function requireGlobal$1 () {
	if (hasRequiredGlobal$1) return global$2;
	hasRequiredGlobal$1 = 1;

	// In case of breaking changes, increase the version
	// number to avoid conflicts.
	const globalOrigin = Symbol.for('undici.globalOrigin.1');

	function getGlobalOrigin () {
	  return globalThis[globalOrigin]
	}

	function setGlobalOrigin (newOrigin) {
	  if (newOrigin === undefined) {
	    Object.defineProperty(globalThis, globalOrigin, {
	      value: undefined,
	      writable: true,
	      enumerable: false,
	      configurable: false
	    });

	    return
	  }

	  const parsedURL = new URL(newOrigin);

	  if (parsedURL.protocol !== 'http:' && parsedURL.protocol !== 'https:') {
	    throw new TypeError(`Only http & https urls are allowed, received ${parsedURL.protocol}`)
	  }

	  Object.defineProperty(globalThis, globalOrigin, {
	    value: parsedURL,
	    writable: true,
	    enumerable: false,
	    configurable: false
	  });
	}

	global$2 = {
	  getGlobalOrigin,
	  setGlobalOrigin
	};
	return global$2;
}

var dataUrl;
var hasRequiredDataUrl;

function requireDataUrl () {
	if (hasRequiredDataUrl) return dataUrl;
	hasRequiredDataUrl = 1;

	const assert = require$$0$2;

	const encoder = new TextEncoder();

	/**
	 * @see https://mimesniff.spec.whatwg.org/#http-token-code-point
	 */
	const HTTP_TOKEN_CODEPOINTS = /^[!#$%&'*+\-.^_|~A-Za-z0-9]+$/;
	const HTTP_WHITESPACE_REGEX = /[\u000A\u000D\u0009\u0020]/; // eslint-disable-line
	const ASCII_WHITESPACE_REPLACE_REGEX = /[\u0009\u000A\u000C\u000D\u0020]/g; // eslint-disable-line
	/**
	 * @see https://mimesniff.spec.whatwg.org/#http-quoted-string-token-code-point
	 */
	const HTTP_QUOTED_STRING_TOKENS = /^[\u0009\u0020-\u007E\u0080-\u00FF]+$/; // eslint-disable-line

	// https://fetch.spec.whatwg.org/#data-url-processor
	/** @param {URL} dataURL */
	function dataURLProcessor (dataURL) {
	  // 1. Assert: dataURLâ€™s scheme is "data".
	  assert(dataURL.protocol === 'data:');

	  // 2. Let input be the result of running the URL
	  // serializer on dataURL with exclude fragment
	  // set to true.
	  let input = URLSerializer(dataURL, true);

	  // 3. Remove the leading "data:" string from input.
	  input = input.slice(5);

	  // 4. Let position point at the start of input.
	  const position = { position: 0 };

	  // 5. Let mimeType be the result of collecting a
	  // sequence of code points that are not equal
	  // to U+002C (,), given position.
	  let mimeType = collectASequenceOfCodePointsFast(
	    ',',
	    input,
	    position
	  );

	  // 6. Strip leading and trailing ASCII whitespace
	  // from mimeType.
	  // Undici implementation note: we need to store the
	  // length because if the mimetype has spaces removed,
	  // the wrong amount will be sliced from the input in
	  // step #9
	  const mimeTypeLength = mimeType.length;
	  mimeType = removeASCIIWhitespace(mimeType, true, true);

	  // 7. If position is past the end of input, then
	  // return failure
	  if (position.position >= input.length) {
	    return 'failure'
	  }

	  // 8. Advance position by 1.
	  position.position++;

	  // 9. Let encodedBody be the remainder of input.
	  const encodedBody = input.slice(mimeTypeLength + 1);

	  // 10. Let body be the percent-decoding of encodedBody.
	  let body = stringPercentDecode(encodedBody);

	  // 11. If mimeType ends with U+003B (;), followed by
	  // zero or more U+0020 SPACE, followed by an ASCII
	  // case-insensitive match for "base64", then:
	  if (/;(\u0020){0,}base64$/i.test(mimeType)) {
	    // 1. Let stringBody be the isomorphic decode of body.
	    const stringBody = isomorphicDecode(body);

	    // 2. Set body to the forgiving-base64 decode of
	    // stringBody.
	    body = forgivingBase64(stringBody);

	    // 3. If body is failure, then return failure.
	    if (body === 'failure') {
	      return 'failure'
	    }

	    // 4. Remove the last 6 code points from mimeType.
	    mimeType = mimeType.slice(0, -6);

	    // 5. Remove trailing U+0020 SPACE code points from mimeType,
	    // if any.
	    mimeType = mimeType.replace(/(\u0020)+$/, '');

	    // 6. Remove the last U+003B (;) code point from mimeType.
	    mimeType = mimeType.slice(0, -1);
	  }

	  // 12. If mimeType starts with U+003B (;), then prepend
	  // "text/plain" to mimeType.
	  if (mimeType.startsWith(';')) {
	    mimeType = 'text/plain' + mimeType;
	  }

	  // 13. Let mimeTypeRecord be the result of parsing
	  // mimeType.
	  let mimeTypeRecord = parseMIMEType(mimeType);

	  // 14. If mimeTypeRecord is failure, then set
	  // mimeTypeRecord to text/plain;charset=US-ASCII.
	  if (mimeTypeRecord === 'failure') {
	    mimeTypeRecord = parseMIMEType('text/plain;charset=US-ASCII');
	  }

	  // 15. Return a new data: URL struct whose MIME
	  // type is mimeTypeRecord and body is body.
	  // https://fetch.spec.whatwg.org/#data-url-struct
	  return { mimeType: mimeTypeRecord, body }
	}

	// https://url.spec.whatwg.org/#concept-url-serializer
	/**
	 * @param {URL} url
	 * @param {boolean} excludeFragment
	 */
	function URLSerializer (url, excludeFragment = false) {
	  if (!excludeFragment) {
	    return url.href
	  }

	  const href = url.href;
	  const hashLength = url.hash.length;

	  const serialized = hashLength === 0 ? href : href.substring(0, href.length - hashLength);

	  if (!hashLength && href.endsWith('#')) {
	    return serialized.slice(0, -1)
	  }

	  return serialized
	}

	// https://infra.spec.whatwg.org/#collect-a-sequence-of-code-points
	/**
	 * @param {(char: string) => boolean} condition
	 * @param {string} input
	 * @param {{ position: number }} position
	 */
	function collectASequenceOfCodePoints (condition, input, position) {
	  // 1. Let result be the empty string.
	  let result = '';

	  // 2. While position doesnâ€™t point past the end of input and the
	  // code point at position within input meets the condition condition:
	  while (position.position < input.length && condition(input[position.position])) {
	    // 1. Append that code point to the end of result.
	    result += input[position.position];

	    // 2. Advance position by 1.
	    position.position++;
	  }

	  // 3. Return result.
	  return result
	}

	/**
	 * A faster collectASequenceOfCodePoints that only works when comparing a single character.
	 * @param {string} char
	 * @param {string} input
	 * @param {{ position: number }} position
	 */
	function collectASequenceOfCodePointsFast (char, input, position) {
	  const idx = input.indexOf(char, position.position);
	  const start = position.position;

	  if (idx === -1) {
	    position.position = input.length;
	    return input.slice(start)
	  }

	  position.position = idx;
	  return input.slice(start, position.position)
	}

	// https://url.spec.whatwg.org/#string-percent-decode
	/** @param {string} input */
	function stringPercentDecode (input) {
	  // 1. Let bytes be the UTF-8 encoding of input.
	  const bytes = encoder.encode(input);

	  // 2. Return the percent-decoding of bytes.
	  return percentDecode(bytes)
	}

	/**
	 * @param {number} byte
	 */
	function isHexCharByte (byte) {
	  // 0-9 A-F a-f
	  return (byte >= 0x30 && byte <= 0x39) || (byte >= 0x41 && byte <= 0x46) || (byte >= 0x61 && byte <= 0x66)
	}

	/**
	 * @param {number} byte
	 */
	function hexByteToNumber (byte) {
	  return (
	    // 0-9
	    byte >= 0x30 && byte <= 0x39
	      ? (byte - 48)
	    // Convert to uppercase
	    // ((byte & 0xDF) - 65) + 10
	      : ((byte & 0xDF) - 55)
	  )
	}

	// https://url.spec.whatwg.org/#percent-decode
	/** @param {Uint8Array} input */
	function percentDecode (input) {
	  const length = input.length;
	  // 1. Let output be an empty byte sequence.
	  /** @type {Uint8Array} */
	  const output = new Uint8Array(length);
	  let j = 0;
	  // 2. For each byte byte in input:
	  for (let i = 0; i < length; ++i) {
	    const byte = input[i];

	    // 1. If byte is not 0x25 (%), then append byte to output.
	    if (byte !== 0x25) {
	      output[j++] = byte;

	    // 2. Otherwise, if byte is 0x25 (%) and the next two bytes
	    // after byte in input are not in the ranges
	    // 0x30 (0) to 0x39 (9), 0x41 (A) to 0x46 (F),
	    // and 0x61 (a) to 0x66 (f), all inclusive, append byte
	    // to output.
	    } else if (
	      byte === 0x25 &&
	      !(isHexCharByte(input[i + 1]) && isHexCharByte(input[i + 2]))
	    ) {
	      output[j++] = 0x25;

	    // 3. Otherwise:
	    } else {
	      // 1. Let bytePoint be the two bytes after byte in input,
	      // decoded, and then interpreted as hexadecimal number.
	      // 2. Append a byte whose value is bytePoint to output.
	      output[j++] = (hexByteToNumber(input[i + 1]) << 4) | hexByteToNumber(input[i + 2]);

	      // 3. Skip the next two bytes in input.
	      i += 2;
	    }
	  }

	  // 3. Return output.
	  return length === j ? output : output.subarray(0, j)
	}

	// https://mimesniff.spec.whatwg.org/#parse-a-mime-type
	/** @param {string} input */
	function parseMIMEType (input) {
	  // 1. Remove any leading and trailing HTTP whitespace
	  // from input.
	  input = removeHTTPWhitespace(input, true, true);

	  // 2. Let position be a position variable for input,
	  // initially pointing at the start of input.
	  const position = { position: 0 };

	  // 3. Let type be the result of collecting a sequence
	  // of code points that are not U+002F (/) from
	  // input, given position.
	  const type = collectASequenceOfCodePointsFast(
	    '/',
	    input,
	    position
	  );

	  // 4. If type is the empty string or does not solely
	  // contain HTTP token code points, then return failure.
	  // https://mimesniff.spec.whatwg.org/#http-token-code-point
	  if (type.length === 0 || !HTTP_TOKEN_CODEPOINTS.test(type)) {
	    return 'failure'
	  }

	  // 5. If position is past the end of input, then return
	  // failure
	  if (position.position > input.length) {
	    return 'failure'
	  }

	  // 6. Advance position by 1. (This skips past U+002F (/).)
	  position.position++;

	  // 7. Let subtype be the result of collecting a sequence of
	  // code points that are not U+003B (;) from input, given
	  // position.
	  let subtype = collectASequenceOfCodePointsFast(
	    ';',
	    input,
	    position
	  );

	  // 8. Remove any trailing HTTP whitespace from subtype.
	  subtype = removeHTTPWhitespace(subtype, false, true);

	  // 9. If subtype is the empty string or does not solely
	  // contain HTTP token code points, then return failure.
	  if (subtype.length === 0 || !HTTP_TOKEN_CODEPOINTS.test(subtype)) {
	    return 'failure'
	  }

	  const typeLowercase = type.toLowerCase();
	  const subtypeLowercase = subtype.toLowerCase();

	  // 10. Let mimeType be a new MIME type record whose type
	  // is type, in ASCII lowercase, and subtype is subtype,
	  // in ASCII lowercase.
	  // https://mimesniff.spec.whatwg.org/#mime-type
	  const mimeType = {
	    type: typeLowercase,
	    subtype: subtypeLowercase,
	    /** @type {Map<string, string>} */
	    parameters: new Map(),
	    // https://mimesniff.spec.whatwg.org/#mime-type-essence
	    essence: `${typeLowercase}/${subtypeLowercase}`
	  };

	  // 11. While position is not past the end of input:
	  while (position.position < input.length) {
	    // 1. Advance position by 1. (This skips past U+003B (;).)
	    position.position++;

	    // 2. Collect a sequence of code points that are HTTP
	    // whitespace from input given position.
	    collectASequenceOfCodePoints(
	      // https://fetch.spec.whatwg.org/#http-whitespace
	      char => HTTP_WHITESPACE_REGEX.test(char),
	      input,
	      position
	    );

	    // 3. Let parameterName be the result of collecting a
	    // sequence of code points that are not U+003B (;)
	    // or U+003D (=) from input, given position.
	    let parameterName = collectASequenceOfCodePoints(
	      (char) => char !== ';' && char !== '=',
	      input,
	      position
	    );

	    // 4. Set parameterName to parameterName, in ASCII
	    // lowercase.
	    parameterName = parameterName.toLowerCase();

	    // 5. If position is not past the end of input, then:
	    if (position.position < input.length) {
	      // 1. If the code point at position within input is
	      // U+003B (;), then continue.
	      if (input[position.position] === ';') {
	        continue
	      }

	      // 2. Advance position by 1. (This skips past U+003D (=).)
	      position.position++;
	    }

	    // 6. If position is past the end of input, then break.
	    if (position.position > input.length) {
	      break
	    }

	    // 7. Let parameterValue be null.
	    let parameterValue = null;

	    // 8. If the code point at position within input is
	    // U+0022 ("), then:
	    if (input[position.position] === '"') {
	      // 1. Set parameterValue to the result of collecting
	      // an HTTP quoted string from input, given position
	      // and the extract-value flag.
	      parameterValue = collectAnHTTPQuotedString(input, position, true);

	      // 2. Collect a sequence of code points that are not
	      // U+003B (;) from input, given position.
	      collectASequenceOfCodePointsFast(
	        ';',
	        input,
	        position
	      );

	    // 9. Otherwise:
	    } else {
	      // 1. Set parameterValue to the result of collecting
	      // a sequence of code points that are not U+003B (;)
	      // from input, given position.
	      parameterValue = collectASequenceOfCodePointsFast(
	        ';',
	        input,
	        position
	      );

	      // 2. Remove any trailing HTTP whitespace from parameterValue.
	      parameterValue = removeHTTPWhitespace(parameterValue, false, true);

	      // 3. If parameterValue is the empty string, then continue.
	      if (parameterValue.length === 0) {
	        continue
	      }
	    }

	    // 10. If all of the following are true
	    // - parameterName is not the empty string
	    // - parameterName solely contains HTTP token code points
	    // - parameterValue solely contains HTTP quoted-string token code points
	    // - mimeTypeâ€™s parameters[parameterName] does not exist
	    // then set mimeTypeâ€™s parameters[parameterName] to parameterValue.
	    if (
	      parameterName.length !== 0 &&
	      HTTP_TOKEN_CODEPOINTS.test(parameterName) &&
	      (parameterValue.length === 0 || HTTP_QUOTED_STRING_TOKENS.test(parameterValue)) &&
	      !mimeType.parameters.has(parameterName)
	    ) {
	      mimeType.parameters.set(parameterName, parameterValue);
	    }
	  }

	  // 12. Return mimeType.
	  return mimeType
	}

	// https://infra.spec.whatwg.org/#forgiving-base64-decode
	/** @param {string} data */
	function forgivingBase64 (data) {
	  // 1. Remove all ASCII whitespace from data.
	  data = data.replace(ASCII_WHITESPACE_REPLACE_REGEX, '');  // eslint-disable-line

	  let dataLength = data.length;
	  // 2. If dataâ€™s code point length divides by 4 leaving
	  // no remainder, then:
	  if (dataLength % 4 === 0) {
	    // 1. If data ends with one or two U+003D (=) code points,
	    // then remove them from data.
	    if (data.charCodeAt(dataLength - 1) === 0x003D) {
	      --dataLength;
	      if (data.charCodeAt(dataLength - 1) === 0x003D) {
	        --dataLength;
	      }
	    }
	  }

	  // 3. If dataâ€™s code point length divides by 4 leaving
	  // a remainder of 1, then return failure.
	  if (dataLength % 4 === 1) {
	    return 'failure'
	  }

	  // 4. If data contains a code point that is not one of
	  //  U+002B (+)
	  //  U+002F (/)
	  //  ASCII alphanumeric
	  // then return failure.
	  if (/[^+/0-9A-Za-z]/.test(data.length === dataLength ? data : data.substring(0, dataLength))) {
	    return 'failure'
	  }

	  const buffer = Buffer.from(data, 'base64');
	  return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength)
	}

	// https://fetch.spec.whatwg.org/#collect-an-http-quoted-string
	// tests: https://fetch.spec.whatwg.org/#example-http-quoted-string
	/**
	 * @param {string} input
	 * @param {{ position: number }} position
	 * @param {boolean?} extractValue
	 */
	function collectAnHTTPQuotedString (input, position, extractValue) {
	  // 1. Let positionStart be position.
	  const positionStart = position.position;

	  // 2. Let value be the empty string.
	  let value = '';

	  // 3. Assert: the code point at position within input
	  // is U+0022 (").
	  assert(input[position.position] === '"');

	  // 4. Advance position by 1.
	  position.position++;

	  // 5. While true:
	  while (true) {
	    // 1. Append the result of collecting a sequence of code points
	    // that are not U+0022 (") or U+005C (\) from input, given
	    // position, to value.
	    value += collectASequenceOfCodePoints(
	      (char) => char !== '"' && char !== '\\',
	      input,
	      position
	    );

	    // 2. If position is past the end of input, then break.
	    if (position.position >= input.length) {
	      break
	    }

	    // 3. Let quoteOrBackslash be the code point at position within
	    // input.
	    const quoteOrBackslash = input[position.position];

	    // 4. Advance position by 1.
	    position.position++;

	    // 5. If quoteOrBackslash is U+005C (\), then:
	    if (quoteOrBackslash === '\\') {
	      // 1. If position is past the end of input, then append
	      // U+005C (\) to value and break.
	      if (position.position >= input.length) {
	        value += '\\';
	        break
	      }

	      // 2. Append the code point at position within input to value.
	      value += input[position.position];

	      // 3. Advance position by 1.
	      position.position++;

	    // 6. Otherwise:
	    } else {
	      // 1. Assert: quoteOrBackslash is U+0022 (").
	      assert(quoteOrBackslash === '"');

	      // 2. Break.
	      break
	    }
	  }

	  // 6. If the extract-value flag is set, then return value.
	  if (extractValue) {
	    return value
	  }

	  // 7. Return the code points from positionStart to position,
	  // inclusive, within input.
	  return input.slice(positionStart, position.position)
	}

	/**
	 * @see https://mimesniff.spec.whatwg.org/#serialize-a-mime-type
	 */
	function serializeAMimeType (mimeType) {
	  assert(mimeType !== 'failure');
	  const { parameters, essence } = mimeType;

	  // 1. Let serialization be the concatenation of mimeTypeâ€™s
	  //    type, U+002F (/), and mimeTypeâ€™s subtype.
	  let serialization = essence;

	  // 2. For each name â†’ value of mimeTypeâ€™s parameters:
	  for (let [name, value] of parameters.entries()) {
	    // 1. Append U+003B (;) to serialization.
	    serialization += ';';

	    // 2. Append name to serialization.
	    serialization += name;

	    // 3. Append U+003D (=) to serialization.
	    serialization += '=';

	    // 4. If value does not solely contain HTTP token code
	    //    points or value is the empty string, then:
	    if (!HTTP_TOKEN_CODEPOINTS.test(value)) {
	      // 1. Precede each occurrence of U+0022 (") or
	      //    U+005C (\) in value with U+005C (\).
	      value = value.replace(/(\\|")/g, '\\$1');

	      // 2. Prepend U+0022 (") to value.
	      value = '"' + value;

	      // 3. Append U+0022 (") to value.
	      value += '"';
	    }

	    // 5. Append value to serialization.
	    serialization += value;
	  }

	  // 3. Return serialization.
	  return serialization
	}

	/**
	 * @see https://fetch.spec.whatwg.org/#http-whitespace
	 * @param {number} char
	 */
	function isHTTPWhiteSpace (char) {
	  // "\r\n\t "
	  return char === 0x00d || char === 0x00a || char === 0x009 || char === 0x020
	}

	/**
	 * @see https://fetch.spec.whatwg.org/#http-whitespace
	 * @param {string} str
	 * @param {boolean} [leading=true]
	 * @param {boolean} [trailing=true]
	 */
	function removeHTTPWhitespace (str, leading = true, trailing = true) {
	  return removeChars(str, leading, trailing, isHTTPWhiteSpace)
	}

	/**
	 * @see https://infra.spec.whatwg.org/#ascii-whitespace
	 * @param {number} char
	 */
	function isASCIIWhitespace (char) {
	  // "\r\n\t\f "
	  return char === 0x00d || char === 0x00a || char === 0x009 || char === 0x00c || char === 0x020
	}

	/**
	 * @see https://infra.spec.whatwg.org/#strip-leading-and-trailing-ascii-whitespace
	 * @param {string} str
	 * @param {boolean} [leading=true]
	 * @param {boolean} [trailing=true]
	 */
	function removeASCIIWhitespace (str, leading = true, trailing = true) {
	  return removeChars(str, leading, trailing, isASCIIWhitespace)
	}

	/**
	 * @param {string} str
	 * @param {boolean} leading
	 * @param {boolean} trailing
	 * @param {(charCode: number) => boolean} predicate
	 * @returns
	 */
	function removeChars (str, leading, trailing, predicate) {
	  let lead = 0;
	  let trail = str.length - 1;

	  if (leading) {
	    while (lead < str.length && predicate(str.charCodeAt(lead))) lead++;
	  }

	  if (trailing) {
	    while (trail > 0 && predicate(str.charCodeAt(trail))) trail--;
	  }

	  return lead === 0 && trail === str.length - 1 ? str : str.slice(lead, trail + 1)
	}

	/**
	 * @see https://infra.spec.whatwg.org/#isomorphic-decode
	 * @param {Uint8Array} input
	 * @returns {string}
	 */
	function isomorphicDecode (input) {
	  // 1. To isomorphic decode a byte sequence input, return a string whose code point
	  //    length is equal to inputâ€™s length and whose code points have the same values
	  //    as the values of inputâ€™s bytes, in the same order.
	  const length = input.length;
	  if ((2 << 15) - 1 > length) {
	    return String.fromCharCode.apply(null, input)
	  }
	  let result = ''; let i = 0;
	  let addition = (2 << 15) - 1;
	  while (i < length) {
	    if (i + addition > length) {
	      addition = length - i;
	    }
	    result += String.fromCharCode.apply(null, input.subarray(i, i += addition));
	  }
	  return result
	}

	/**
	 * @see https://mimesniff.spec.whatwg.org/#minimize-a-supported-mime-type
	 * @param {Exclude<ReturnType<typeof parseMIMEType>, 'failure'>} mimeType
	 */
	function minimizeSupportedMimeType (mimeType) {
	  switch (mimeType.essence) {
	    case 'application/ecmascript':
	    case 'application/javascript':
	    case 'application/x-ecmascript':
	    case 'application/x-javascript':
	    case 'text/ecmascript':
	    case 'text/javascript':
	    case 'text/javascript1.0':
	    case 'text/javascript1.1':
	    case 'text/javascript1.2':
	    case 'text/javascript1.3':
	    case 'text/javascript1.4':
	    case 'text/javascript1.5':
	    case 'text/jscript':
	    case 'text/livescript':
	    case 'text/x-ecmascript':
	    case 'text/x-javascript':
	      // 1. If mimeType is a JavaScript MIME type, then return "text/javascript".
	      return 'text/javascript'
	    case 'application/json':
	    case 'text/json':
	      // 2. If mimeType is a JSON MIME type, then return "application/json".
	      return 'application/json'
	    case 'image/svg+xml':
	      // 3. If mimeTypeâ€™s essence is "image/svg+xml", then return "image/svg+xml".
	      return 'image/svg+xml'
	    case 'text/xml':
	    case 'application/xml':
	      // 4. If mimeType is an XML MIME type, then return "application/xml".
	      return 'application/xml'
	  }

	  // 2. If mimeType is a JSON MIME type, then return "application/json".
	  if (mimeType.subtype.endsWith('+json')) {
	    return 'application/json'
	  }

	  // 4. If mimeType is an XML MIME type, then return "application/xml".
	  if (mimeType.subtype.endsWith('+xml')) {
	    return 'application/xml'
	  }

	  // 5. If mimeType is supported by the user agent, then return mimeTypeâ€™s essence.
	  // Technically, node doesn't support any mimetypes.

	  // 6. Return the empty string.
	  return ''
	}

	dataUrl = {
	  dataURLProcessor,
	  URLSerializer,
	  collectASequenceOfCodePoints,
	  collectASequenceOfCodePointsFast,
	  stringPercentDecode,
	  parseMIMEType,
	  collectAnHTTPQuotedString,
	  serializeAMimeType,
	  removeChars,
	  removeHTTPWhitespace,
	  minimizeSupportedMimeType,
	  HTTP_TOKEN_CODEPOINTS,
	  isomorphicDecode
	};
	return dataUrl;
}

var webidl_1;
var hasRequiredWebidl;

function requireWebidl () {
	if (hasRequiredWebidl) return webidl_1;
	hasRequiredWebidl = 1;

	const { types, inspect } = require$$0$5;
	const { markAsUncloneable } = require$$1$2;
	const { toUSVString } = requireUtil$7();

	/** @type {import('../../../types/webidl').Webidl} */
	const webidl = {};
	webidl.converters = {};
	webidl.util = {};
	webidl.errors = {};

	webidl.errors.exception = function (message) {
	  return new TypeError(`${message.header}: ${message.message}`)
	};

	webidl.errors.conversionFailed = function (context) {
	  const plural = context.types.length === 1 ? '' : ' one of';
	  const message =
	    `${context.argument} could not be converted to` +
	    `${plural}: ${context.types.join(', ')}.`;

	  return webidl.errors.exception({
	    header: context.prefix,
	    message
	  })
	};

	webidl.errors.invalidArgument = function (context) {
	  return webidl.errors.exception({
	    header: context.prefix,
	    message: `"${context.value}" is an invalid ${context.type}.`
	  })
	};

	// https://webidl.spec.whatwg.org/#implements
	webidl.brandCheck = function (V, I, opts) {
	  if (opts?.strict !== false) {
	    if (!(V instanceof I)) {
	      const err = new TypeError('Illegal invocation');
	      err.code = 'ERR_INVALID_THIS'; // node compat.
	      throw err
	    }
	  } else {
	    if (V?.[Symbol.toStringTag] !== I.prototype[Symbol.toStringTag]) {
	      const err = new TypeError('Illegal invocation');
	      err.code = 'ERR_INVALID_THIS'; // node compat.
	      throw err
	    }
	  }
	};

	webidl.argumentLengthCheck = function ({ length }, min, ctx) {
	  if (length < min) {
	    throw webidl.errors.exception({
	      message: `${min} argument${min !== 1 ? 's' : ''} required, ` +
	               `but${length ? ' only' : ''} ${length} found.`,
	      header: ctx
	    })
	  }
	};

	webidl.illegalConstructor = function () {
	  throw webidl.errors.exception({
	    header: 'TypeError',
	    message: 'Illegal constructor'
	  })
	};

	// https://tc39.es/ecma262/#sec-ecmascript-data-types-and-values
	webidl.util.Type = function (V) {
	  switch (typeof V) {
	    case 'undefined': return 'Undefined'
	    case 'boolean': return 'Boolean'
	    case 'string': return 'String'
	    case 'symbol': return 'Symbol'
	    case 'number': return 'Number'
	    case 'bigint': return 'BigInt'
	    case 'function':
	    case 'object': {
	      if (V === null) {
	        return 'Null'
	      }

	      return 'Object'
	    }
	  }
	};

	webidl.util.markAsUncloneable = markAsUncloneable || (() => {});
	// https://webidl.spec.whatwg.org/#abstract-opdef-converttoint
	webidl.util.ConvertToInt = function (V, bitLength, signedness, opts) {
	  let upperBound;
	  let lowerBound;

	  // 1. If bitLength is 64, then:
	  if (bitLength === 64) {
	    // 1. Let upperBound be 2^53 âˆ’ 1.
	    upperBound = Math.pow(2, 53) - 1;

	    // 2. If signedness is "unsigned", then let lowerBound be 0.
	    if (signedness === 'unsigned') {
	      lowerBound = 0;
	    } else {
	      // 3. Otherwise let lowerBound be âˆ’2^53 + 1.
	      lowerBound = Math.pow(-2, 53) + 1;
	    }
	  } else if (signedness === 'unsigned') {
	    // 2. Otherwise, if signedness is "unsigned", then:

	    // 1. Let lowerBound be 0.
	    lowerBound = 0;

	    // 2. Let upperBound be 2^bitLength âˆ’ 1.
	    upperBound = Math.pow(2, bitLength) - 1;
	  } else {
	    // 3. Otherwise:

	    // 1. Let lowerBound be -2^bitLength âˆ’ 1.
	    lowerBound = Math.pow(-2, bitLength) - 1;

	    // 2. Let upperBound be 2^bitLength âˆ’ 1 âˆ’ 1.
	    upperBound = Math.pow(2, bitLength - 1) - 1;
	  }

	  // 4. Let x be ? ToNumber(V).
	  let x = Number(V);

	  // 5. If x is âˆ’0, then set x to +0.
	  if (x === 0) {
	    x = 0;
	  }

	  // 6. If the conversion is to an IDL type associated
	  //    with the [EnforceRange] extended attribute, then:
	  if (opts?.enforceRange === true) {
	    // 1. If x is NaN, +âˆž, or âˆ’âˆž, then throw a TypeError.
	    if (
	      Number.isNaN(x) ||
	      x === Number.POSITIVE_INFINITY ||
	      x === Number.NEGATIVE_INFINITY
	    ) {
	      throw webidl.errors.exception({
	        header: 'Integer conversion',
	        message: `Could not convert ${webidl.util.Stringify(V)} to an integer.`
	      })
	    }

	    // 2. Set x to IntegerPart(x).
	    x = webidl.util.IntegerPart(x);

	    // 3. If x < lowerBound or x > upperBound, then
	    //    throw a TypeError.
	    if (x < lowerBound || x > upperBound) {
	      throw webidl.errors.exception({
	        header: 'Integer conversion',
	        message: `Value must be between ${lowerBound}-${upperBound}, got ${x}.`
	      })
	    }

	    // 4. Return x.
	    return x
	  }

	  // 7. If x is not NaN and the conversion is to an IDL
	  //    type associated with the [Clamp] extended
	  //    attribute, then:
	  if (!Number.isNaN(x) && opts?.clamp === true) {
	    // 1. Set x to min(max(x, lowerBound), upperBound).
	    x = Math.min(Math.max(x, lowerBound), upperBound);

	    // 2. Round x to the nearest integer, choosing the
	    //    even integer if it lies halfway between two,
	    //    and choosing +0 rather than âˆ’0.
	    if (Math.floor(x) % 2 === 0) {
	      x = Math.floor(x);
	    } else {
	      x = Math.ceil(x);
	    }

	    // 3. Return x.
	    return x
	  }

	  // 8. If x is NaN, +0, +âˆž, or âˆ’âˆž, then return +0.
	  if (
	    Number.isNaN(x) ||
	    (x === 0 && Object.is(0, x)) ||
	    x === Number.POSITIVE_INFINITY ||
	    x === Number.NEGATIVE_INFINITY
	  ) {
	    return 0
	  }

	  // 9. Set x to IntegerPart(x).
	  x = webidl.util.IntegerPart(x);

	  // 10. Set x to x modulo 2^bitLength.
	  x = x % Math.pow(2, bitLength);

	  // 11. If signedness is "signed" and x â‰¥ 2^bitLength âˆ’ 1,
	  //    then return x âˆ’ 2^bitLength.
	  if (signedness === 'signed' && x >= Math.pow(2, bitLength) - 1) {
	    return x - Math.pow(2, bitLength)
	  }

	  // 12. Otherwise, return x.
	  return x
	};

	// https://webidl.spec.whatwg.org/#abstract-opdef-integerpart
	webidl.util.IntegerPart = function (n) {
	  // 1. Let r be floor(abs(n)).
	  const r = Math.floor(Math.abs(n));

	  // 2. If n < 0, then return -1 Ã— r.
	  if (n < 0) {
	    return -1 * r
	  }

	  // 3. Otherwise, return r.
	  return r
	};

	webidl.util.Stringify = function (V) {
	  const type = webidl.util.Type(V);

	  switch (type) {
	    case 'Symbol':
	      return `Symbol(${V.description})`
	    case 'Object':
	      return inspect(V)
	    case 'String':
	      return `"${V}"`
	    default:
	      return `${V}`
	  }
	};

	// https://webidl.spec.whatwg.org/#es-sequence
	webidl.sequenceConverter = function (converter) {
	  return (V, prefix, argument, Iterable) => {
	    // 1. If Type(V) is not Object, throw a TypeError.
	    if (webidl.util.Type(V) !== 'Object') {
	      throw webidl.errors.exception({
	        header: prefix,
	        message: `${argument} (${webidl.util.Stringify(V)}) is not iterable.`
	      })
	    }

	    // 2. Let method be ? GetMethod(V, @@iterator).
	    /** @type {Generator} */
	    const method = typeof Iterable === 'function' ? Iterable() : V?.[Symbol.iterator]?.();
	    const seq = [];
	    let index = 0;

	    // 3. If method is undefined, throw a TypeError.
	    if (
	      method === undefined ||
	      typeof method.next !== 'function'
	    ) {
	      throw webidl.errors.exception({
	        header: prefix,
	        message: `${argument} is not iterable.`
	      })
	    }

	    // https://webidl.spec.whatwg.org/#create-sequence-from-iterable
	    while (true) {
	      const { done, value } = method.next();

	      if (done) {
	        break
	      }

	      seq.push(converter(value, prefix, `${argument}[${index++}]`));
	    }

	    return seq
	  }
	};

	// https://webidl.spec.whatwg.org/#es-to-record
	webidl.recordConverter = function (keyConverter, valueConverter) {
	  return (O, prefix, argument) => {
	    // 1. If Type(O) is not Object, throw a TypeError.
	    if (webidl.util.Type(O) !== 'Object') {
	      throw webidl.errors.exception({
	        header: prefix,
	        message: `${argument} ("${webidl.util.Type(O)}") is not an Object.`
	      })
	    }

	    // 2. Let result be a new empty instance of record<K, V>.
	    const result = {};

	    if (!types.isProxy(O)) {
	      // 1. Let desc be ? O.[[GetOwnProperty]](key).
	      const keys = [...Object.getOwnPropertyNames(O), ...Object.getOwnPropertySymbols(O)];

	      for (const key of keys) {
	        // 1. Let typedKey be key converted to an IDL value of type K.
	        const typedKey = keyConverter(key, prefix, argument);

	        // 2. Let value be ? Get(O, key).
	        // 3. Let typedValue be value converted to an IDL value of type V.
	        const typedValue = valueConverter(O[key], prefix, argument);

	        // 4. Set result[typedKey] to typedValue.
	        result[typedKey] = typedValue;
	      }

	      // 5. Return result.
	      return result
	    }

	    // 3. Let keys be ? O.[[OwnPropertyKeys]]().
	    const keys = Reflect.ownKeys(O);

	    // 4. For each key of keys.
	    for (const key of keys) {
	      // 1. Let desc be ? O.[[GetOwnProperty]](key).
	      const desc = Reflect.getOwnPropertyDescriptor(O, key);

	      // 2. If desc is not undefined and desc.[[Enumerable]] is true:
	      if (desc?.enumerable) {
	        // 1. Let typedKey be key converted to an IDL value of type K.
	        const typedKey = keyConverter(key, prefix, argument);

	        // 2. Let value be ? Get(O, key).
	        // 3. Let typedValue be value converted to an IDL value of type V.
	        const typedValue = valueConverter(O[key], prefix, argument);

	        // 4. Set result[typedKey] to typedValue.
	        result[typedKey] = typedValue;
	      }
	    }

	    // 5. Return result.
	    return result
	  }
	};

	webidl.interfaceConverter = function (i) {
	  return (V, prefix, argument, opts) => {
	    if (opts?.strict !== false && !(V instanceof i)) {
	      throw webidl.errors.exception({
	        header: prefix,
	        message: `Expected ${argument} ("${webidl.util.Stringify(V)}") to be an instance of ${i.name}.`
	      })
	    }

	    return V
	  }
	};

	webidl.dictionaryConverter = function (converters) {
	  return (dictionary, prefix, argument) => {
	    const type = webidl.util.Type(dictionary);
	    const dict = {};

	    if (type === 'Null' || type === 'Undefined') {
	      return dict
	    } else if (type !== 'Object') {
	      throw webidl.errors.exception({
	        header: prefix,
	        message: `Expected ${dictionary} to be one of: Null, Undefined, Object.`
	      })
	    }

	    for (const options of converters) {
	      const { key, defaultValue, required, converter } = options;

	      if (required === true) {
	        if (!Object.hasOwn(dictionary, key)) {
	          throw webidl.errors.exception({
	            header: prefix,
	            message: `Missing required key "${key}".`
	          })
	        }
	      }

	      let value = dictionary[key];
	      const hasDefault = Object.hasOwn(options, 'defaultValue');

	      // Only use defaultValue if value is undefined and
	      // a defaultValue options was provided.
	      if (hasDefault && value !== null) {
	        value ??= defaultValue();
	      }

	      // A key can be optional and have no default value.
	      // When this happens, do not perform a conversion,
	      // and do not assign the key a value.
	      if (required || hasDefault || value !== undefined) {
	        value = converter(value, prefix, `${argument}.${key}`);

	        if (
	          options.allowedValues &&
	          !options.allowedValues.includes(value)
	        ) {
	          throw webidl.errors.exception({
	            header: prefix,
	            message: `${value} is not an accepted type. Expected one of ${options.allowedValues.join(', ')}.`
	          })
	        }

	        dict[key] = value;
	      }
	    }

	    return dict
	  }
	};

	webidl.nullableConverter = function (converter) {
	  return (V, prefix, argument) => {
	    if (V === null) {
	      return V
	    }

	    return converter(V, prefix, argument)
	  }
	};

	// https://webidl.spec.whatwg.org/#es-DOMString
	webidl.converters.DOMString = function (V, prefix, argument, opts) {
	  // 1. If V is null and the conversion is to an IDL type
	  //    associated with the [LegacyNullToEmptyString]
	  //    extended attribute, then return the DOMString value
	  //    that represents the empty string.
	  if (V === null && opts?.legacyNullToEmptyString) {
	    return ''
	  }

	  // 2. Let x be ? ToString(V).
	  if (typeof V === 'symbol') {
	    throw webidl.errors.exception({
	      header: prefix,
	      message: `${argument} is a symbol, which cannot be converted to a DOMString.`
	    })
	  }

	  // 3. Return the IDL DOMString value that represents the
	  //    same sequence of code units as the one the
	  //    ECMAScript String value x represents.
	  return String(V)
	};

	// https://webidl.spec.whatwg.org/#es-ByteString
	webidl.converters.ByteString = function (V, prefix, argument) {
	  // 1. Let x be ? ToString(V).
	  // Note: DOMString converter perform ? ToString(V)
	  const x = webidl.converters.DOMString(V, prefix, argument);

	  // 2. If the value of any element of x is greater than
	  //    255, then throw a TypeError.
	  for (let index = 0; index < x.length; index++) {
	    if (x.charCodeAt(index) > 255) {
	      throw new TypeError(
	        'Cannot convert argument to a ByteString because the character at ' +
	        `index ${index} has a value of ${x.charCodeAt(index)} which is greater than 255.`
	      )
	    }
	  }

	  // 3. Return an IDL ByteString value whose length is the
	  //    length of x, and where the value of each element is
	  //    the value of the corresponding element of x.
	  return x
	};

	// https://webidl.spec.whatwg.org/#es-USVString
	// TODO: rewrite this so we can control the errors thrown
	webidl.converters.USVString = toUSVString;

	// https://webidl.spec.whatwg.org/#es-boolean
	webidl.converters.boolean = function (V) {
	  // 1. Let x be the result of computing ToBoolean(V).
	  const x = Boolean(V);

	  // 2. Return the IDL boolean value that is the one that represents
	  //    the same truth value as the ECMAScript Boolean value x.
	  return x
	};

	// https://webidl.spec.whatwg.org/#es-any
	webidl.converters.any = function (V) {
	  return V
	};

	// https://webidl.spec.whatwg.org/#es-long-long
	webidl.converters['long long'] = function (V, prefix, argument) {
	  // 1. Let x be ? ConvertToInt(V, 64, "signed").
	  const x = webidl.util.ConvertToInt(V, 64, 'signed', undefined, prefix, argument);

	  // 2. Return the IDL long long value that represents
	  //    the same numeric value as x.
	  return x
	};

	// https://webidl.spec.whatwg.org/#es-unsigned-long-long
	webidl.converters['unsigned long long'] = function (V, prefix, argument) {
	  // 1. Let x be ? ConvertToInt(V, 64, "unsigned").
	  const x = webidl.util.ConvertToInt(V, 64, 'unsigned', undefined, prefix, argument);

	  // 2. Return the IDL unsigned long long value that
	  //    represents the same numeric value as x.
	  return x
	};

	// https://webidl.spec.whatwg.org/#es-unsigned-long
	webidl.converters['unsigned long'] = function (V, prefix, argument) {
	  // 1. Let x be ? ConvertToInt(V, 32, "unsigned").
	  const x = webidl.util.ConvertToInt(V, 32, 'unsigned', undefined, prefix, argument);

	  // 2. Return the IDL unsigned long value that
	  //    represents the same numeric value as x.
	  return x
	};

	// https://webidl.spec.whatwg.org/#es-unsigned-short
	webidl.converters['unsigned short'] = function (V, prefix, argument, opts) {
	  // 1. Let x be ? ConvertToInt(V, 16, "unsigned").
	  const x = webidl.util.ConvertToInt(V, 16, 'unsigned', opts, prefix, argument);

	  // 2. Return the IDL unsigned short value that represents
	  //    the same numeric value as x.
	  return x
	};

	// https://webidl.spec.whatwg.org/#idl-ArrayBuffer
	webidl.converters.ArrayBuffer = function (V, prefix, argument, opts) {
	  // 1. If Type(V) is not Object, or V does not have an
	  //    [[ArrayBufferData]] internal slot, then throw a
	  //    TypeError.
	  // see: https://tc39.es/ecma262/#sec-properties-of-the-arraybuffer-instances
	  // see: https://tc39.es/ecma262/#sec-properties-of-the-sharedarraybuffer-instances
	  if (
	    webidl.util.Type(V) !== 'Object' ||
	    !types.isAnyArrayBuffer(V)
	  ) {
	    throw webidl.errors.conversionFailed({
	      prefix,
	      argument: `${argument} ("${webidl.util.Stringify(V)}")`,
	      types: ['ArrayBuffer']
	    })
	  }

	  // 2. If the conversion is not to an IDL type associated
	  //    with the [AllowShared] extended attribute, and
	  //    IsSharedArrayBuffer(V) is true, then throw a
	  //    TypeError.
	  if (opts?.allowShared === false && types.isSharedArrayBuffer(V)) {
	    throw webidl.errors.exception({
	      header: 'ArrayBuffer',
	      message: 'SharedArrayBuffer is not allowed.'
	    })
	  }

	  // 3. If the conversion is not to an IDL type associated
	  //    with the [AllowResizable] extended attribute, and
	  //    IsResizableArrayBuffer(V) is true, then throw a
	  //    TypeError.
	  if (V.resizable || V.growable) {
	    throw webidl.errors.exception({
	      header: 'ArrayBuffer',
	      message: 'Received a resizable ArrayBuffer.'
	    })
	  }

	  // 4. Return the IDL ArrayBuffer value that is a
	  //    reference to the same object as V.
	  return V
	};

	webidl.converters.TypedArray = function (V, T, prefix, name, opts) {
	  // 1. Let T be the IDL type V is being converted to.

	  // 2. If Type(V) is not Object, or V does not have a
	  //    [[TypedArrayName]] internal slot with a value
	  //    equal to Tâ€™s name, then throw a TypeError.
	  if (
	    webidl.util.Type(V) !== 'Object' ||
	    !types.isTypedArray(V) ||
	    V.constructor.name !== T.name
	  ) {
	    throw webidl.errors.conversionFailed({
	      prefix,
	      argument: `${name} ("${webidl.util.Stringify(V)}")`,
	      types: [T.name]
	    })
	  }

	  // 3. If the conversion is not to an IDL type associated
	  //    with the [AllowShared] extended attribute, and
	  //    IsSharedArrayBuffer(V.[[ViewedArrayBuffer]]) is
	  //    true, then throw a TypeError.
	  if (opts?.allowShared === false && types.isSharedArrayBuffer(V.buffer)) {
	    throw webidl.errors.exception({
	      header: 'ArrayBuffer',
	      message: 'SharedArrayBuffer is not allowed.'
	    })
	  }

	  // 4. If the conversion is not to an IDL type associated
	  //    with the [AllowResizable] extended attribute, and
	  //    IsResizableArrayBuffer(V.[[ViewedArrayBuffer]]) is
	  //    true, then throw a TypeError.
	  if (V.buffer.resizable || V.buffer.growable) {
	    throw webidl.errors.exception({
	      header: 'ArrayBuffer',
	      message: 'Received a resizable ArrayBuffer.'
	    })
	  }

	  // 5. Return the IDL value of type T that is a reference
	  //    to the same object as V.
	  return V
	};

	webidl.converters.DataView = function (V, prefix, name, opts) {
	  // 1. If Type(V) is not Object, or V does not have a
	  //    [[DataView]] internal slot, then throw a TypeError.
	  if (webidl.util.Type(V) !== 'Object' || !types.isDataView(V)) {
	    throw webidl.errors.exception({
	      header: prefix,
	      message: `${name} is not a DataView.`
	    })
	  }

	  // 2. If the conversion is not to an IDL type associated
	  //    with the [AllowShared] extended attribute, and
	  //    IsSharedArrayBuffer(V.[[ViewedArrayBuffer]]) is true,
	  //    then throw a TypeError.
	  if (opts?.allowShared === false && types.isSharedArrayBuffer(V.buffer)) {
	    throw webidl.errors.exception({
	      header: 'ArrayBuffer',
	      message: 'SharedArrayBuffer is not allowed.'
	    })
	  }

	  // 3. If the conversion is not to an IDL type associated
	  //    with the [AllowResizable] extended attribute, and
	  //    IsResizableArrayBuffer(V.[[ViewedArrayBuffer]]) is
	  //    true, then throw a TypeError.
	  if (V.buffer.resizable || V.buffer.growable) {
	    throw webidl.errors.exception({
	      header: 'ArrayBuffer',
	      message: 'Received a resizable ArrayBuffer.'
	    })
	  }

	  // 4. Return the IDL DataView value that is a reference
	  //    to the same object as V.
	  return V
	};

	// https://webidl.spec.whatwg.org/#BufferSource
	webidl.converters.BufferSource = function (V, prefix, name, opts) {
	  if (types.isAnyArrayBuffer(V)) {
	    return webidl.converters.ArrayBuffer(V, prefix, name, { ...opts, allowShared: false })
	  }

	  if (types.isTypedArray(V)) {
	    return webidl.converters.TypedArray(V, V.constructor, prefix, name, { ...opts, allowShared: false })
	  }

	  if (types.isDataView(V)) {
	    return webidl.converters.DataView(V, prefix, name, { ...opts, allowShared: false })
	  }

	  throw webidl.errors.conversionFailed({
	    prefix,
	    argument: `${name} ("${webidl.util.Stringify(V)}")`,
	    types: ['BufferSource']
	  })
	};

	webidl.converters['sequence<ByteString>'] = webidl.sequenceConverter(
	  webidl.converters.ByteString
	);

	webidl.converters['sequence<sequence<ByteString>>'] = webidl.sequenceConverter(
	  webidl.converters['sequence<ByteString>']
	);

	webidl.converters['record<ByteString, ByteString>'] = webidl.recordConverter(
	  webidl.converters.ByteString,
	  webidl.converters.ByteString
	);

	webidl_1 = {
	  webidl
	};
	return webidl_1;
}

var util$6;
var hasRequiredUtil$6;

function requireUtil$6 () {
	if (hasRequiredUtil$6) return util$6;
	hasRequiredUtil$6 = 1;

	const { Transform } = require$$0$3;
	const zlib = require$$1$3;
	const { redirectStatusSet, referrerPolicySet: referrerPolicyTokens, badPortsSet } = requireConstants$2();
	const { getGlobalOrigin } = requireGlobal$1();
	const { collectASequenceOfCodePoints, collectAnHTTPQuotedString, removeChars, parseMIMEType } = requireDataUrl();
	const { performance } = require$$5$1;
	const { isBlobLike, ReadableStreamFrom, isValidHTTPToken, normalizedMethodRecordsBase } = requireUtil$7();
	const assert = require$$0$2;
	const { isUint8Array } = require$$8$1;
	const { webidl } = requireWebidl();

	let supportedHashes = [];

	// https://nodejs.org/api/crypto.html#determining-if-crypto-support-is-unavailable
	/** @type {import('crypto')} */
	let crypto;
	try {
	  crypto = require('node:crypto');
	  const possibleRelevantHashes = ['sha256', 'sha384', 'sha512'];
	  supportedHashes = crypto.getHashes().filter((hash) => possibleRelevantHashes.includes(hash));
	/* c8 ignore next 3 */
	} catch {

	}

	function responseURL (response) {
	  // https://fetch.spec.whatwg.org/#responses
	  // A response has an associated URL. It is a pointer to the last URL
	  // in responseâ€™s URL list and null if responseâ€™s URL list is empty.
	  const urlList = response.urlList;
	  const length = urlList.length;
	  return length === 0 ? null : urlList[length - 1].toString()
	}

	// https://fetch.spec.whatwg.org/#concept-response-location-url
	function responseLocationURL (response, requestFragment) {
	  // 1. If responseâ€™s status is not a redirect status, then return null.
	  if (!redirectStatusSet.has(response.status)) {
	    return null
	  }

	  // 2. Let location be the result of extracting header list values given
	  // `Location` and responseâ€™s header list.
	  let location = response.headersList.get('location', true);

	  // 3. If location is a header value, then set location to the result of
	  //    parsing location with responseâ€™s URL.
	  if (location !== null && isValidHeaderValue(location)) {
	    if (!isValidEncodedURL(location)) {
	      // Some websites respond location header in UTF-8 form without encoding them as ASCII
	      // and major browsers redirect them to correctly UTF-8 encoded addresses.
	      // Here, we handle that behavior in the same way.
	      location = normalizeBinaryStringToUtf8(location);
	    }
	    location = new URL(location, responseURL(response));
	  }

	  // 4. If location is a URL whose fragment is null, then set locationâ€™s
	  // fragment to requestFragment.
	  if (location && !location.hash) {
	    location.hash = requestFragment;
	  }

	  // 5. Return location.
	  return location
	}

	/**
	 * @see https://www.rfc-editor.org/rfc/rfc1738#section-2.2
	 * @param {string} url
	 * @returns {boolean}
	 */
	function isValidEncodedURL (url) {
	  for (let i = 0; i < url.length; ++i) {
	    const code = url.charCodeAt(i);

	    if (
	      code > 0x7E || // Non-US-ASCII + DEL
	      code < 0x20 // Control characters NUL - US
	    ) {
	      return false
	    }
	  }
	  return true
	}

	/**
	 * If string contains non-ASCII characters, assumes it's UTF-8 encoded and decodes it.
	 * Since UTF-8 is a superset of ASCII, this will work for ASCII strings as well.
	 * @param {string} value
	 * @returns {string}
	 */
	function normalizeBinaryStringToUtf8 (value) {
	  return Buffer.from(value, 'binary').toString('utf8')
	}

	/** @returns {URL} */
	function requestCurrentURL (request) {
	  return request.urlList[request.urlList.length - 1]
	}

	function requestBadPort (request) {
	  // 1. Let url be requestâ€™s current URL.
	  const url = requestCurrentURL(request);

	  // 2. If urlâ€™s scheme is an HTTP(S) scheme and urlâ€™s port is a bad port,
	  // then return blocked.
	  if (urlIsHttpHttpsScheme(url) && badPortsSet.has(url.port)) {
	    return 'blocked'
	  }

	  // 3. Return allowed.
	  return 'allowed'
	}

	function isErrorLike (object) {
	  return object instanceof Error || (
	    object?.constructor?.name === 'Error' ||
	    object?.constructor?.name === 'DOMException'
	  )
	}

	// Check whether |statusText| is a ByteString and
	// matches the Reason-Phrase token production.
	// RFC 2616: https://tools.ietf.org/html/rfc2616
	// RFC 7230: https://tools.ietf.org/html/rfc7230
	// "reason-phrase = *( HTAB / SP / VCHAR / obs-text )"
	// https://github.com/chromium/chromium/blob/94.0.4604.1/third_party/blink/renderer/core/fetch/response.cc#L116
	function isValidReasonPhrase (statusText) {
	  for (let i = 0; i < statusText.length; ++i) {
	    const c = statusText.charCodeAt(i);
	    if (
	      !(
	        (
	          c === 0x09 || // HTAB
	          (c >= 0x20 && c <= 0x7e) || // SP / VCHAR
	          (c >= 0x80 && c <= 0xff)
	        ) // obs-text
	      )
	    ) {
	      return false
	    }
	  }
	  return true
	}

	/**
	 * @see https://fetch.spec.whatwg.org/#header-name
	 * @param {string} potentialValue
	 */
	const isValidHeaderName = isValidHTTPToken;

	/**
	 * @see https://fetch.spec.whatwg.org/#header-value
	 * @param {string} potentialValue
	 */
	function isValidHeaderValue (potentialValue) {
	  // - Has no leading or trailing HTTP tab or space bytes.
	  // - Contains no 0x00 (NUL) or HTTP newline bytes.
	  return (
	    potentialValue[0] === '\t' ||
	    potentialValue[0] === ' ' ||
	    potentialValue[potentialValue.length - 1] === '\t' ||
	    potentialValue[potentialValue.length - 1] === ' ' ||
	    potentialValue.includes('\n') ||
	    potentialValue.includes('\r') ||
	    potentialValue.includes('\0')
	  ) === false
	}

	// https://w3c.github.io/webappsec-referrer-policy/#set-requests-referrer-policy-on-redirect
	function setRequestReferrerPolicyOnRedirect (request, actualResponse) {
	  //  Given a request request and a response actualResponse, this algorithm
	  //  updates requestâ€™s referrer policy according to the Referrer-Policy
	  //  header (if any) in actualResponse.

	  // 1. Let policy be the result of executing Â§ 8.1 Parse a referrer policy
	  // from a Referrer-Policy header on actualResponse.

	  // 8.1 Parse a referrer policy from a Referrer-Policy header
	  // 1. Let policy-tokens be the result of extracting header list values given `Referrer-Policy` and responseâ€™s header list.
	  const { headersList } = actualResponse;
	  // 2. Let policy be the empty string.
	  // 3. For each token in policy-tokens, if token is a referrer policy and token is not the empty string, then set policy to token.
	  // 4. Return policy.
	  const policyHeader = (headersList.get('referrer-policy', true) ?? '').split(',');

	  // Note: As the referrer-policy can contain multiple policies
	  // separated by comma, we need to loop through all of them
	  // and pick the first valid one.
	  // Ref: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Referrer-Policy#specify_a_fallback_policy
	  let policy = '';
	  if (policyHeader.length > 0) {
	    // The right-most policy takes precedence.
	    // The left-most policy is the fallback.
	    for (let i = policyHeader.length; i !== 0; i--) {
	      const token = policyHeader[i - 1].trim();
	      if (referrerPolicyTokens.has(token)) {
	        policy = token;
	        break
	      }
	    }
	  }

	  // 2. If policy is not the empty string, then set requestâ€™s referrer policy to policy.
	  if (policy !== '') {
	    request.referrerPolicy = policy;
	  }
	}

	// https://fetch.spec.whatwg.org/#cross-origin-resource-policy-check
	function crossOriginResourcePolicyCheck () {
	  // TODO
	  return 'allowed'
	}

	// https://fetch.spec.whatwg.org/#concept-cors-check
	function corsCheck () {
	  // TODO
	  return 'success'
	}

	// https://fetch.spec.whatwg.org/#concept-tao-check
	function TAOCheck () {
	  // TODO
	  return 'success'
	}

	function appendFetchMetadata (httpRequest) {
	  //  https://w3c.github.io/webappsec-fetch-metadata/#sec-fetch-dest-header
	  //  TODO

	  //  https://w3c.github.io/webappsec-fetch-metadata/#sec-fetch-mode-header

	  //  1. Assert: râ€™s url is a potentially trustworthy URL.
	  //  TODO

	  //  2. Let header be a Structured Header whose value is a token.
	  let header = null;

	  //  3. Set headerâ€™s value to râ€™s mode.
	  header = httpRequest.mode;

	  //  4. Set a structured field value `Sec-Fetch-Mode`/header in râ€™s header list.
	  httpRequest.headersList.set('sec-fetch-mode', header, true);

	  //  https://w3c.github.io/webappsec-fetch-metadata/#sec-fetch-site-header
	  //  TODO

	  //  https://w3c.github.io/webappsec-fetch-metadata/#sec-fetch-user-header
	  //  TODO
	}

	// https://fetch.spec.whatwg.org/#append-a-request-origin-header
	function appendRequestOriginHeader (request) {
	  // 1. Let serializedOrigin be the result of byte-serializing a request origin
	  //    with request.
	  // TODO: implement "byte-serializing a request origin"
	  let serializedOrigin = request.origin;

	  // - "'client' is changed to an origin during fetching."
	  //   This doesn't happen in undici (in most cases) because undici, by default,
	  //   has no concept of origin.
	  // - request.origin can also be set to request.client.origin (client being
	  //   an environment settings object), which is undefined without using
	  //   setGlobalOrigin.
	  if (serializedOrigin === 'client' || serializedOrigin === undefined) {
	    return
	  }

	  // 2. If requestâ€™s response tainting is "cors" or requestâ€™s mode is "websocket",
	  //    then append (`Origin`, serializedOrigin) to requestâ€™s header list.
	  // 3. Otherwise, if requestâ€™s method is neither `GET` nor `HEAD`, then:
	  if (request.responseTainting === 'cors' || request.mode === 'websocket') {
	    request.headersList.append('origin', serializedOrigin, true);
	  } else if (request.method !== 'GET' && request.method !== 'HEAD') {
	    // 1. Switch on requestâ€™s referrer policy:
	    switch (request.referrerPolicy) {
	      case 'no-referrer':
	        // Set serializedOrigin to `null`.
	        serializedOrigin = null;
	        break
	      case 'no-referrer-when-downgrade':
	      case 'strict-origin':
	      case 'strict-origin-when-cross-origin':
	        // If requestâ€™s origin is a tuple origin, its scheme is "https", and
	        // requestâ€™s current URLâ€™s scheme is not "https", then set
	        // serializedOrigin to `null`.
	        if (request.origin && urlHasHttpsScheme(request.origin) && !urlHasHttpsScheme(requestCurrentURL(request))) {
	          serializedOrigin = null;
	        }
	        break
	      case 'same-origin':
	        // If requestâ€™s origin is not same origin with requestâ€™s current URLâ€™s
	        // origin, then set serializedOrigin to `null`.
	        if (!sameOrigin(request, requestCurrentURL(request))) {
	          serializedOrigin = null;
	        }
	        break
	        // Do nothing.
	    }

	    // 2. Append (`Origin`, serializedOrigin) to requestâ€™s header list.
	    request.headersList.append('origin', serializedOrigin, true);
	  }
	}

	// https://w3c.github.io/hr-time/#dfn-coarsen-time
	function coarsenTime (timestamp, crossOriginIsolatedCapability) {
	  // TODO
	  return timestamp
	}

	// https://fetch.spec.whatwg.org/#clamp-and-coarsen-connection-timing-info
	function clampAndCoarsenConnectionTimingInfo (connectionTimingInfo, defaultStartTime, crossOriginIsolatedCapability) {
	  if (!connectionTimingInfo?.startTime || connectionTimingInfo.startTime < defaultStartTime) {
	    return {
	      domainLookupStartTime: defaultStartTime,
	      domainLookupEndTime: defaultStartTime,
	      connectionStartTime: defaultStartTime,
	      connectionEndTime: defaultStartTime,
	      secureConnectionStartTime: defaultStartTime,
	      ALPNNegotiatedProtocol: connectionTimingInfo?.ALPNNegotiatedProtocol
	    }
	  }

	  return {
	    domainLookupStartTime: coarsenTime(connectionTimingInfo.domainLookupStartTime),
	    domainLookupEndTime: coarsenTime(connectionTimingInfo.domainLookupEndTime),
	    connectionStartTime: coarsenTime(connectionTimingInfo.connectionStartTime),
	    connectionEndTime: coarsenTime(connectionTimingInfo.connectionEndTime),
	    secureConnectionStartTime: coarsenTime(connectionTimingInfo.secureConnectionStartTime),
	    ALPNNegotiatedProtocol: connectionTimingInfo.ALPNNegotiatedProtocol
	  }
	}

	// https://w3c.github.io/hr-time/#dfn-coarsened-shared-current-time
	function coarsenedSharedCurrentTime (crossOriginIsolatedCapability) {
	  return coarsenTime(performance.now())
	}

	// https://fetch.spec.whatwg.org/#create-an-opaque-timing-info
	function createOpaqueTimingInfo (timingInfo) {
	  return {
	    startTime: timingInfo.startTime ?? 0,
	    redirectStartTime: 0,
	    redirectEndTime: 0,
	    postRedirectStartTime: timingInfo.startTime ?? 0,
	    finalServiceWorkerStartTime: 0,
	    finalNetworkResponseStartTime: 0,
	    finalNetworkRequestStartTime: 0,
	    endTime: 0,
	    encodedBodySize: 0,
	    decodedBodySize: 0,
	    finalConnectionTimingInfo: null
	  }
	}

	// https://html.spec.whatwg.org/multipage/origin.html#policy-container
	function makePolicyContainer () {
	  // Note: the fetch spec doesn't make use of embedder policy or CSP list
	  return {
	    referrerPolicy: 'strict-origin-when-cross-origin'
	  }
	}

	// https://html.spec.whatwg.org/multipage/origin.html#clone-a-policy-container
	function clonePolicyContainer (policyContainer) {
	  return {
	    referrerPolicy: policyContainer.referrerPolicy
	  }
	}

	// https://w3c.github.io/webappsec-referrer-policy/#determine-requests-referrer
	function determineRequestsReferrer (request) {
	  // 1. Let policy be request's referrer policy.
	  const policy = request.referrerPolicy;

	  // Note: policy cannot (shouldn't) be null or an empty string.
	  assert(policy);

	  // 2. Let environment be requestâ€™s client.

	  let referrerSource = null;

	  // 3. Switch on requestâ€™s referrer:
	  if (request.referrer === 'client') {
	    // Note: node isn't a browser and doesn't implement document/iframes,
	    // so we bypass this step and replace it with our own.

	    const globalOrigin = getGlobalOrigin();

	    if (!globalOrigin || globalOrigin.origin === 'null') {
	      return 'no-referrer'
	    }

	    // note: we need to clone it as it's mutated
	    referrerSource = new URL(globalOrigin);
	  } else if (request.referrer instanceof URL) {
	    // Let referrerSource be requestâ€™s referrer.
	    referrerSource = request.referrer;
	  }

	  // 4. Let requestâ€™s referrerURL be the result of stripping referrerSource for
	  //    use as a referrer.
	  let referrerURL = stripURLForReferrer(referrerSource);

	  // 5. Let referrerOrigin be the result of stripping referrerSource for use as
	  //    a referrer, with the origin-only flag set to true.
	  const referrerOrigin = stripURLForReferrer(referrerSource, true);

	  // 6. If the result of serializing referrerURL is a string whose length is
	  //    greater than 4096, set referrerURL to referrerOrigin.
	  if (referrerURL.toString().length > 4096) {
	    referrerURL = referrerOrigin;
	  }

	  const areSameOrigin = sameOrigin(request, referrerURL);
	  const isNonPotentiallyTrustWorthy = isURLPotentiallyTrustworthy(referrerURL) &&
	    !isURLPotentiallyTrustworthy(request.url);

	  // 8. Execute the switch statements corresponding to the value of policy:
	  switch (policy) {
	    case 'origin': return referrerOrigin != null ? referrerOrigin : stripURLForReferrer(referrerSource, true)
	    case 'unsafe-url': return referrerURL
	    case 'same-origin':
	      return areSameOrigin ? referrerOrigin : 'no-referrer'
	    case 'origin-when-cross-origin':
	      return areSameOrigin ? referrerURL : referrerOrigin
	    case 'strict-origin-when-cross-origin': {
	      const currentURL = requestCurrentURL(request);

	      // 1. If the origin of referrerURL and the origin of requestâ€™s current
	      //    URL are the same, then return referrerURL.
	      if (sameOrigin(referrerURL, currentURL)) {
	        return referrerURL
	      }

	      // 2. If referrerURL is a potentially trustworthy URL and requestâ€™s
	      //    current URL is not a potentially trustworthy URL, then return no
	      //    referrer.
	      if (isURLPotentiallyTrustworthy(referrerURL) && !isURLPotentiallyTrustworthy(currentURL)) {
	        return 'no-referrer'
	      }

	      // 3. Return referrerOrigin.
	      return referrerOrigin
	    }
	    case 'strict-origin': // eslint-disable-line
	      /**
	         * 1. If referrerURL is a potentially trustworthy URL and
	         * requestâ€™s current URL is not a potentially trustworthy URL,
	         * then return no referrer.
	         * 2. Return referrerOrigin
	        */
	    case 'no-referrer-when-downgrade': // eslint-disable-line
	      /**
	       * 1. If referrerURL is a potentially trustworthy URL and
	       * requestâ€™s current URL is not a potentially trustworthy URL,
	       * then return no referrer.
	       * 2. Return referrerOrigin
	      */

	    default: // eslint-disable-line
	      return isNonPotentiallyTrustWorthy ? 'no-referrer' : referrerOrigin
	  }
	}

	/**
	 * @see https://w3c.github.io/webappsec-referrer-policy/#strip-url
	 * @param {URL} url
	 * @param {boolean|undefined} originOnly
	 */
	function stripURLForReferrer (url, originOnly) {
	  // 1. Assert: url is a URL.
	  assert(url instanceof URL);

	  url = new URL(url);

	  // 2. If urlâ€™s scheme is a local scheme, then return no referrer.
	  if (url.protocol === 'file:' || url.protocol === 'about:' || url.protocol === 'blank:') {
	    return 'no-referrer'
	  }

	  // 3. Set urlâ€™s username to the empty string.
	  url.username = '';

	  // 4. Set urlâ€™s password to the empty string.
	  url.password = '';

	  // 5. Set urlâ€™s fragment to null.
	  url.hash = '';

	  // 6. If the origin-only flag is true, then:
	  if (originOnly) {
	    // 1. Set urlâ€™s path to Â« the empty string Â».
	    url.pathname = '';

	    // 2. Set urlâ€™s query to null.
	    url.search = '';
	  }

	  // 7. Return url.
	  return url
	}

	function isURLPotentiallyTrustworthy (url) {
	  if (!(url instanceof URL)) {
	    return false
	  }

	  // If child of about, return true
	  if (url.href === 'about:blank' || url.href === 'about:srcdoc') {
	    return true
	  }

	  // If scheme is data, return true
	  if (url.protocol === 'data:') return true

	  // If file, return true
	  if (url.protocol === 'file:') return true

	  return isOriginPotentiallyTrustworthy(url.origin)

	  function isOriginPotentiallyTrustworthy (origin) {
	    // If origin is explicitly null, return false
	    if (origin == null || origin === 'null') return false

	    const originAsURL = new URL(origin);

	    // If secure, return true
	    if (originAsURL.protocol === 'https:' || originAsURL.protocol === 'wss:') {
	      return true
	    }

	    // If localhost or variants, return true
	    if (/^127(?:\.[0-9]+){0,2}\.[0-9]+$|^\[(?:0*:)*?:?0*1\]$/.test(originAsURL.hostname) ||
	     (originAsURL.hostname === 'localhost' || originAsURL.hostname.includes('localhost.')) ||
	     (originAsURL.hostname.endsWith('.localhost'))) {
	      return true
	    }

	    // If any other, return false
	    return false
	  }
	}

	/**
	 * @see https://w3c.github.io/webappsec-subresource-integrity/#does-response-match-metadatalist
	 * @param {Uint8Array} bytes
	 * @param {string} metadataList
	 */
	function bytesMatch (bytes, metadataList) {
	  // If node is not built with OpenSSL support, we cannot check
	  // a request's integrity, so allow it by default (the spec will
	  // allow requests if an invalid hash is given, as precedence).
	  /* istanbul ignore if: only if node is built with --without-ssl */
	  if (crypto === undefined) {
	    return true
	  }

	  // 1. Let parsedMetadata be the result of parsing metadataList.
	  const parsedMetadata = parseMetadata(metadataList);

	  // 2. If parsedMetadata is no metadata, return true.
	  if (parsedMetadata === 'no metadata') {
	    return true
	  }

	  // 3. If response is not eligible for integrity validation, return false.
	  // TODO

	  // 4. If parsedMetadata is the empty set, return true.
	  if (parsedMetadata.length === 0) {
	    return true
	  }

	  // 5. Let metadata be the result of getting the strongest
	  //    metadata from parsedMetadata.
	  const strongest = getStrongestMetadata(parsedMetadata);
	  const metadata = filterMetadataListByAlgorithm(parsedMetadata, strongest);

	  // 6. For each item in metadata:
	  for (const item of metadata) {
	    // 1. Let algorithm be the alg component of item.
	    const algorithm = item.algo;

	    // 2. Let expectedValue be the val component of item.
	    const expectedValue = item.hash;

	    // See https://github.com/web-platform-tests/wpt/commit/e4c5cc7a5e48093220528dfdd1c4012dc3837a0e
	    // "be liberal with padding". This is annoying, and it's not even in the spec.

	    // 3. Let actualValue be the result of applying algorithm to bytes.
	    let actualValue = crypto.createHash(algorithm).update(bytes).digest('base64');

	    if (actualValue[actualValue.length - 1] === '=') {
	      if (actualValue[actualValue.length - 2] === '=') {
	        actualValue = actualValue.slice(0, -2);
	      } else {
	        actualValue = actualValue.slice(0, -1);
	      }
	    }

	    // 4. If actualValue is a case-sensitive match for expectedValue,
	    //    return true.
	    if (compareBase64Mixed(actualValue, expectedValue)) {
	      return true
	    }
	  }

	  // 7. Return false.
	  return false
	}

	// https://w3c.github.io/webappsec-subresource-integrity/#grammardef-hash-with-options
	// https://www.w3.org/TR/CSP2/#source-list-syntax
	// https://www.rfc-editor.org/rfc/rfc5234#appendix-B.1
	const parseHashWithOptions = /(?<algo>sha256|sha384|sha512)-((?<hash>[A-Za-z0-9+/]+|[A-Za-z0-9_-]+)={0,2}(?:\s|$)( +[!-~]*)?)?/i;

	/**
	 * @see https://w3c.github.io/webappsec-subresource-integrity/#parse-metadata
	 * @param {string} metadata
	 */
	function parseMetadata (metadata) {
	  // 1. Let result be the empty set.
	  /** @type {{ algo: string, hash: string }[]} */
	  const result = [];

	  // 2. Let empty be equal to true.
	  let empty = true;

	  // 3. For each token returned by splitting metadata on spaces:
	  for (const token of metadata.split(' ')) {
	    // 1. Set empty to false.
	    empty = false;

	    // 2. Parse token as a hash-with-options.
	    const parsedToken = parseHashWithOptions.exec(token);

	    // 3. If token does not parse, continue to the next token.
	    if (
	      parsedToken === null ||
	      parsedToken.groups === undefined ||
	      parsedToken.groups.algo === undefined
	    ) {
	      // Note: Chromium blocks the request at this point, but Firefox
	      // gives a warning that an invalid integrity was given. The
	      // correct behavior is to ignore these, and subsequently not
	      // check the integrity of the resource.
	      continue
	    }

	    // 4. Let algorithm be the hash-algo component of token.
	    const algorithm = parsedToken.groups.algo.toLowerCase();

	    // 5. If algorithm is a hash function recognized by the user
	    //    agent, add the parsed token to result.
	    if (supportedHashes.includes(algorithm)) {
	      result.push(parsedToken.groups);
	    }
	  }

	  // 4. Return no metadata if empty is true, otherwise return result.
	  if (empty === true) {
	    return 'no metadata'
	  }

	  return result
	}

	/**
	 * @param {{ algo: 'sha256' | 'sha384' | 'sha512' }[]} metadataList
	 */
	function getStrongestMetadata (metadataList) {
	  // Let algorithm be the algo component of the first item in metadataList.
	  // Can be sha256
	  let algorithm = metadataList[0].algo;
	  // If the algorithm is sha512, then it is the strongest
	  // and we can return immediately
	  if (algorithm[3] === '5') {
	    return algorithm
	  }

	  for (let i = 1; i < metadataList.length; ++i) {
	    const metadata = metadataList[i];
	    // If the algorithm is sha512, then it is the strongest
	    // and we can break the loop immediately
	    if (metadata.algo[3] === '5') {
	      algorithm = 'sha512';
	      break
	    // If the algorithm is sha384, then a potential sha256 or sha384 is ignored
	    } else if (algorithm[3] === '3') {
	      continue
	    // algorithm is sha256, check if algorithm is sha384 and if so, set it as
	    // the strongest
	    } else if (metadata.algo[3] === '3') {
	      algorithm = 'sha384';
	    }
	  }
	  return algorithm
	}

	function filterMetadataListByAlgorithm (metadataList, algorithm) {
	  if (metadataList.length === 1) {
	    return metadataList
	  }

	  let pos = 0;
	  for (let i = 0; i < metadataList.length; ++i) {
	    if (metadataList[i].algo === algorithm) {
	      metadataList[pos++] = metadataList[i];
	    }
	  }

	  metadataList.length = pos;

	  return metadataList
	}

	/**
	 * Compares two base64 strings, allowing for base64url
	 * in the second string.
	 *
	* @param {string} actualValue always base64
	 * @param {string} expectedValue base64 or base64url
	 * @returns {boolean}
	 */
	function compareBase64Mixed (actualValue, expectedValue) {
	  if (actualValue.length !== expectedValue.length) {
	    return false
	  }
	  for (let i = 0; i < actualValue.length; ++i) {
	    if (actualValue[i] !== expectedValue[i]) {
	      if (
	        (actualValue[i] === '+' && expectedValue[i] === '-') ||
	        (actualValue[i] === '/' && expectedValue[i] === '_')
	      ) {
	        continue
	      }
	      return false
	    }
	  }

	  return true
	}

	// https://w3c.github.io/webappsec-upgrade-insecure-requests/#upgrade-request
	function tryUpgradeRequestToAPotentiallyTrustworthyURL (request) {
	  // TODO
	}

	/**
	 * @link {https://html.spec.whatwg.org/multipage/origin.html#same-origin}
	 * @param {URL} A
	 * @param {URL} B
	 */
	function sameOrigin (A, B) {
	  // 1. If A and B are the same opaque origin, then return true.
	  if (A.origin === B.origin && A.origin === 'null') {
	    return true
	  }

	  // 2. If A and B are both tuple origins and their schemes,
	  //    hosts, and port are identical, then return true.
	  if (A.protocol === B.protocol && A.hostname === B.hostname && A.port === B.port) {
	    return true
	  }

	  // 3. Return false.
	  return false
	}

	function createDeferredPromise () {
	  let res;
	  let rej;
	  const promise = new Promise((resolve, reject) => {
	    res = resolve;
	    rej = reject;
	  });

	  return { promise, resolve: res, reject: rej }
	}

	function isAborted (fetchParams) {
	  return fetchParams.controller.state === 'aborted'
	}

	function isCancelled (fetchParams) {
	  return fetchParams.controller.state === 'aborted' ||
	    fetchParams.controller.state === 'terminated'
	}

	/**
	 * @see https://fetch.spec.whatwg.org/#concept-method-normalize
	 * @param {string} method
	 */
	function normalizeMethod (method) {
	  return normalizedMethodRecordsBase[method.toLowerCase()] ?? method
	}

	// https://infra.spec.whatwg.org/#serialize-a-javascript-value-to-a-json-string
	function serializeJavascriptValueToJSONString (value) {
	  // 1. Let result be ? Call(%JSON.stringify%, undefined, Â« value Â»).
	  const result = JSON.stringify(value);

	  // 2. If result is undefined, then throw a TypeError.
	  if (result === undefined) {
	    throw new TypeError('Value is not JSON serializable')
	  }

	  // 3. Assert: result is a string.
	  assert(typeof result === 'string');

	  // 4. Return result.
	  return result
	}

	// https://tc39.es/ecma262/#sec-%25iteratorprototype%25-object
	const esIteratorPrototype = Object.getPrototypeOf(Object.getPrototypeOf([][Symbol.iterator]()));

	/**
	 * @see https://webidl.spec.whatwg.org/#dfn-iterator-prototype-object
	 * @param {string} name name of the instance
	 * @param {symbol} kInternalIterator
	 * @param {string | number} [keyIndex]
	 * @param {string | number} [valueIndex]
	 */
	function createIterator (name, kInternalIterator, keyIndex = 0, valueIndex = 1) {
	  class FastIterableIterator {
	    /** @type {any} */
	    #target
	    /** @type {'key' | 'value' | 'key+value'} */
	    #kind
	    /** @type {number} */
	    #index

	    /**
	     * @see https://webidl.spec.whatwg.org/#dfn-default-iterator-object
	     * @param {unknown} target
	     * @param {'key' | 'value' | 'key+value'} kind
	     */
	    constructor (target, kind) {
	      this.#target = target;
	      this.#kind = kind;
	      this.#index = 0;
	    }

	    next () {
	      // 1. Let interface be the interface for which the iterator prototype object exists.
	      // 2. Let thisValue be the this value.
	      // 3. Let object be ? ToObject(thisValue).
	      // 4. If object is a platform object, then perform a security
	      //    check, passing:
	      // 5. If object is not a default iterator object for interface,
	      //    then throw a TypeError.
	      if (typeof this !== 'object' || this === null || !(#target in this)) {
	        throw new TypeError(
	          `'next' called on an object that does not implement interface ${name} Iterator.`
	        )
	      }

	      // 6. Let index be objectâ€™s index.
	      // 7. Let kind be objectâ€™s kind.
	      // 8. Let values be objectâ€™s target's value pairs to iterate over.
	      const index = this.#index;
	      const values = this.#target[kInternalIterator];

	      // 9. Let len be the length of values.
	      const len = values.length;

	      // 10. If index is greater than or equal to len, then return
	      //     CreateIterResultObject(undefined, true).
	      if (index >= len) {
	        return {
	          value: undefined,
	          done: true
	        }
	      }

	      // 11. Let pair be the entry in values at index index.
	      const { [keyIndex]: key, [valueIndex]: value } = values[index];

	      // 12. Set objectâ€™s index to index + 1.
	      this.#index = index + 1;

	      // 13. Return the iterator result for pair and kind.

	      // https://webidl.spec.whatwg.org/#iterator-result

	      // 1. Let result be a value determined by the value of kind:
	      let result;
	      switch (this.#kind) {
	        case 'key':
	          // 1. Let idlKey be pairâ€™s key.
	          // 2. Let key be the result of converting idlKey to an
	          //    ECMAScript value.
	          // 3. result is key.
	          result = key;
	          break
	        case 'value':
	          // 1. Let idlValue be pairâ€™s value.
	          // 2. Let value be the result of converting idlValue to
	          //    an ECMAScript value.
	          // 3. result is value.
	          result = value;
	          break
	        case 'key+value':
	          // 1. Let idlKey be pairâ€™s key.
	          // 2. Let idlValue be pairâ€™s value.
	          // 3. Let key be the result of converting idlKey to an
	          //    ECMAScript value.
	          // 4. Let value be the result of converting idlValue to
	          //    an ECMAScript value.
	          // 5. Let array be ! ArrayCreate(2).
	          // 6. Call ! CreateDataProperty(array, "0", key).
	          // 7. Call ! CreateDataProperty(array, "1", value).
	          // 8. result is array.
	          result = [key, value];
	          break
	      }

	      // 2. Return CreateIterResultObject(result, false).
	      return {
	        value: result,
	        done: false
	      }
	    }
	  }

	  // https://webidl.spec.whatwg.org/#dfn-iterator-prototype-object
	  // @ts-ignore
	  delete FastIterableIterator.prototype.constructor;

	  Object.setPrototypeOf(FastIterableIterator.prototype, esIteratorPrototype);

	  Object.defineProperties(FastIterableIterator.prototype, {
	    [Symbol.toStringTag]: {
	      writable: false,
	      enumerable: false,
	      configurable: true,
	      value: `${name} Iterator`
	    },
	    next: { writable: true, enumerable: true, configurable: true }
	  });

	  /**
	   * @param {unknown} target
	   * @param {'key' | 'value' | 'key+value'} kind
	   * @returns {IterableIterator<any>}
	   */
	  return function (target, kind) {
	    return new FastIterableIterator(target, kind)
	  }
	}

	/**
	 * @see https://webidl.spec.whatwg.org/#dfn-iterator-prototype-object
	 * @param {string} name name of the instance
	 * @param {any} object class
	 * @param {symbol} kInternalIterator
	 * @param {string | number} [keyIndex]
	 * @param {string | number} [valueIndex]
	 */
	function iteratorMixin (name, object, kInternalIterator, keyIndex = 0, valueIndex = 1) {
	  const makeIterator = createIterator(name, kInternalIterator, keyIndex, valueIndex);

	  const properties = {
	    keys: {
	      writable: true,
	      enumerable: true,
	      configurable: true,
	      value: function keys () {
	        webidl.brandCheck(this, object);
	        return makeIterator(this, 'key')
	      }
	    },
	    values: {
	      writable: true,
	      enumerable: true,
	      configurable: true,
	      value: function values () {
	        webidl.brandCheck(this, object);
	        return makeIterator(this, 'value')
	      }
	    },
	    entries: {
	      writable: true,
	      enumerable: true,
	      configurable: true,
	      value: function entries () {
	        webidl.brandCheck(this, object);
	        return makeIterator(this, 'key+value')
	      }
	    },
	    forEach: {
	      writable: true,
	      enumerable: true,
	      configurable: true,
	      value: function forEach (callbackfn, thisArg = globalThis) {
	        webidl.brandCheck(this, object);
	        webidl.argumentLengthCheck(arguments, 1, `${name}.forEach`);
	        if (typeof callbackfn !== 'function') {
	          throw new TypeError(
	            `Failed to execute 'forEach' on '${name}': parameter 1 is not of type 'Function'.`
	          )
	        }
	        for (const { 0: key, 1: value } of makeIterator(this, 'key+value')) {
	          callbackfn.call(thisArg, value, key, this);
	        }
	      }
	    }
	  };

	  return Object.defineProperties(object.prototype, {
	    ...properties,
	    [Symbol.iterator]: {
	      writable: true,
	      enumerable: false,
	      configurable: true,
	      value: properties.entries.value
	    }
	  })
	}

	/**
	 * @see https://fetch.spec.whatwg.org/#body-fully-read
	 */
	async function fullyReadBody (body, processBody, processBodyError) {
	  // 1. If taskDestination is null, then set taskDestination to
	  //    the result of starting a new parallel queue.

	  // 2. Let successSteps given a byte sequence bytes be to queue a
	  //    fetch task to run processBody given bytes, with taskDestination.
	  const successSteps = processBody;

	  // 3. Let errorSteps be to queue a fetch task to run processBodyError,
	  //    with taskDestination.
	  const errorSteps = processBodyError;

	  // 4. Let reader be the result of getting a reader for bodyâ€™s stream.
	  //    If that threw an exception, then run errorSteps with that
	  //    exception and return.
	  let reader;

	  try {
	    reader = body.stream.getReader();
	  } catch (e) {
	    errorSteps(e);
	    return
	  }

	  // 5. Read all bytes from reader, given successSteps and errorSteps.
	  try {
	    successSteps(await readAllBytes(reader));
	  } catch (e) {
	    errorSteps(e);
	  }
	}

	function isReadableStreamLike (stream) {
	  return stream instanceof ReadableStream || (
	    stream[Symbol.toStringTag] === 'ReadableStream' &&
	    typeof stream.tee === 'function'
	  )
	}

	/**
	 * @param {ReadableStreamController<Uint8Array>} controller
	 */
	function readableStreamClose (controller) {
	  try {
	    controller.close();
	    controller.byobRequest?.respond(0);
	  } catch (err) {
	    // TODO: add comment explaining why this error occurs.
	    if (!err.message.includes('Controller is already closed') && !err.message.includes('ReadableStream is already closed')) {
	      throw err
	    }
	  }
	}

	const invalidIsomorphicEncodeValueRegex = /[^\x00-\xFF]/; // eslint-disable-line

	/**
	 * @see https://infra.spec.whatwg.org/#isomorphic-encode
	 * @param {string} input
	 */
	function isomorphicEncode (input) {
	  // 1. Assert: input contains no code points greater than U+00FF.
	  assert(!invalidIsomorphicEncodeValueRegex.test(input));

	  // 2. Return a byte sequence whose length is equal to inputâ€™s code
	  //    point length and whose bytes have the same values as the
	  //    values of inputâ€™s code points, in the same order
	  return input
	}

	/**
	 * @see https://streams.spec.whatwg.org/#readablestreamdefaultreader-read-all-bytes
	 * @see https://streams.spec.whatwg.org/#read-loop
	 * @param {ReadableStreamDefaultReader} reader
	 */
	async function readAllBytes (reader) {
	  const bytes = [];
	  let byteLength = 0;

	  while (true) {
	    const { done, value: chunk } = await reader.read();

	    if (done) {
	      // 1. Call successSteps with bytes.
	      return Buffer.concat(bytes, byteLength)
	    }

	    // 1. If chunk is not a Uint8Array object, call failureSteps
	    //    with a TypeError and abort these steps.
	    if (!isUint8Array(chunk)) {
	      throw new TypeError('Received non-Uint8Array chunk')
	    }

	    // 2. Append the bytes represented by chunk to bytes.
	    bytes.push(chunk);
	    byteLength += chunk.length;

	    // 3. Read-loop given reader, bytes, successSteps, and failureSteps.
	  }
	}

	/**
	 * @see https://fetch.spec.whatwg.org/#is-local
	 * @param {URL} url
	 */
	function urlIsLocal (url) {
	  assert('protocol' in url); // ensure it's a url object

	  const protocol = url.protocol;

	  return protocol === 'about:' || protocol === 'blob:' || protocol === 'data:'
	}

	/**
	 * @param {string|URL} url
	 * @returns {boolean}
	 */
	function urlHasHttpsScheme (url) {
	  return (
	    (
	      typeof url === 'string' &&
	      url[5] === ':' &&
	      url[0] === 'h' &&
	      url[1] === 't' &&
	      url[2] === 't' &&
	      url[3] === 'p' &&
	      url[4] === 's'
	    ) ||
	    url.protocol === 'https:'
	  )
	}

	/**
	 * @see https://fetch.spec.whatwg.org/#http-scheme
	 * @param {URL} url
	 */
	function urlIsHttpHttpsScheme (url) {
	  assert('protocol' in url); // ensure it's a url object

	  const protocol = url.protocol;

	  return protocol === 'http:' || protocol === 'https:'
	}

	/**
	 * @see https://fetch.spec.whatwg.org/#simple-range-header-value
	 * @param {string} value
	 * @param {boolean} allowWhitespace
	 */
	function simpleRangeHeaderValue (value, allowWhitespace) {
	  // 1. Let data be the isomorphic decoding of value.
	  // Note: isomorphic decoding takes a sequence of bytes (ie. a Uint8Array) and turns it into a string,
	  // nothing more. We obviously don't need to do that if value is a string already.
	  const data = value;

	  // 2. If data does not start with "bytes", then return failure.
	  if (!data.startsWith('bytes')) {
	    return 'failure'
	  }

	  // 3. Let position be a position variable for data, initially pointing at the 5th code point of data.
	  const position = { position: 5 };

	  // 4. If allowWhitespace is true, collect a sequence of code points that are HTTP tab or space,
	  //    from data given position.
	  if (allowWhitespace) {
	    collectASequenceOfCodePoints(
	      (char) => char === '\t' || char === ' ',
	      data,
	      position
	    );
	  }

	  // 5. If the code point at position within data is not U+003D (=), then return failure.
	  if (data.charCodeAt(position.position) !== 0x3D) {
	    return 'failure'
	  }

	  // 6. Advance position by 1.
	  position.position++;

	  // 7. If allowWhitespace is true, collect a sequence of code points that are HTTP tab or space, from
	  //    data given position.
	  if (allowWhitespace) {
	    collectASequenceOfCodePoints(
	      (char) => char === '\t' || char === ' ',
	      data,
	      position
	    );
	  }

	  // 8. Let rangeStart be the result of collecting a sequence of code points that are ASCII digits,
	  //    from data given position.
	  const rangeStart = collectASequenceOfCodePoints(
	    (char) => {
	      const code = char.charCodeAt(0);

	      return code >= 0x30 && code <= 0x39
	    },
	    data,
	    position
	  );

	  // 9. Let rangeStartValue be rangeStart, interpreted as decimal number, if rangeStart is not the
	  //    empty string; otherwise null.
	  const rangeStartValue = rangeStart.length ? Number(rangeStart) : null;

	  // 10. If allowWhitespace is true, collect a sequence of code points that are HTTP tab or space,
	  //     from data given position.
	  if (allowWhitespace) {
	    collectASequenceOfCodePoints(
	      (char) => char === '\t' || char === ' ',
	      data,
	      position
	    );
	  }

	  // 11. If the code point at position within data is not U+002D (-), then return failure.
	  if (data.charCodeAt(position.position) !== 0x2D) {
	    return 'failure'
	  }

	  // 12. Advance position by 1.
	  position.position++;

	  // 13. If allowWhitespace is true, collect a sequence of code points that are HTTP tab
	  //     or space, from data given position.
	  // Note from Khafra: its the same step as in #8 again lol
	  if (allowWhitespace) {
	    collectASequenceOfCodePoints(
	      (char) => char === '\t' || char === ' ',
	      data,
	      position
	    );
	  }

	  // 14. Let rangeEnd be the result of collecting a sequence of code points that are
	  //     ASCII digits, from data given position.
	  // Note from Khafra: you wouldn't guess it, but this is also the same step as #8
	  const rangeEnd = collectASequenceOfCodePoints(
	    (char) => {
	      const code = char.charCodeAt(0);

	      return code >= 0x30 && code <= 0x39
	    },
	    data,
	    position
	  );

	  // 15. Let rangeEndValue be rangeEnd, interpreted as decimal number, if rangeEnd
	  //     is not the empty string; otherwise null.
	  // Note from Khafra: THE SAME STEP, AGAIN!!!
	  // Note: why interpret as a decimal if we only collect ascii digits?
	  const rangeEndValue = rangeEnd.length ? Number(rangeEnd) : null;

	  // 16. If position is not past the end of data, then return failure.
	  if (position.position < data.length) {
	    return 'failure'
	  }

	  // 17. If rangeEndValue and rangeStartValue are null, then return failure.
	  if (rangeEndValue === null && rangeStartValue === null) {
	    return 'failure'
	  }

	  // 18. If rangeStartValue and rangeEndValue are numbers, and rangeStartValue is
	  //     greater than rangeEndValue, then return failure.
	  // Note: ... when can they not be numbers?
	  if (rangeStartValue > rangeEndValue) {
	    return 'failure'
	  }

	  // 19. Return (rangeStartValue, rangeEndValue).
	  return { rangeStartValue, rangeEndValue }
	}

	/**
	 * @see https://fetch.spec.whatwg.org/#build-a-content-range
	 * @param {number} rangeStart
	 * @param {number} rangeEnd
	 * @param {number} fullLength
	 */
	function buildContentRange (rangeStart, rangeEnd, fullLength) {
	  // 1. Let contentRange be `bytes `.
	  let contentRange = 'bytes ';

	  // 2. Append rangeStart, serialized and isomorphic encoded, to contentRange.
	  contentRange += isomorphicEncode(`${rangeStart}`);

	  // 3. Append 0x2D (-) to contentRange.
	  contentRange += '-';

	  // 4. Append rangeEnd, serialized and isomorphic encoded to contentRange.
	  contentRange += isomorphicEncode(`${rangeEnd}`);

	  // 5. Append 0x2F (/) to contentRange.
	  contentRange += '/';

	  // 6. Append fullLength, serialized and isomorphic encoded to contentRange.
	  contentRange += isomorphicEncode(`${fullLength}`);

	  // 7. Return contentRange.
	  return contentRange
	}

	// A Stream, which pipes the response to zlib.createInflate() or
	// zlib.createInflateRaw() depending on the first byte of the Buffer.
	// If the lower byte of the first byte is 0x08, then the stream is
	// interpreted as a zlib stream, otherwise it's interpreted as a
	// raw deflate stream.
	class InflateStream extends Transform {
	  #zlibOptions

	  /** @param {zlib.ZlibOptions} [zlibOptions] */
	  constructor (zlibOptions) {
	    super();
	    this.#zlibOptions = zlibOptions;
	  }

	  _transform (chunk, encoding, callback) {
	    if (!this._inflateStream) {
	      if (chunk.length === 0) {
	        callback();
	        return
	      }
	      this._inflateStream = (chunk[0] & 0x0F) === 0x08
	        ? zlib.createInflate(this.#zlibOptions)
	        : zlib.createInflateRaw(this.#zlibOptions);

	      this._inflateStream.on('data', this.push.bind(this));
	      this._inflateStream.on('end', () => this.push(null));
	      this._inflateStream.on('error', (err) => this.destroy(err));
	    }

	    this._inflateStream.write(chunk, encoding, callback);
	  }

	  _final (callback) {
	    if (this._inflateStream) {
	      this._inflateStream.end();
	      this._inflateStream = null;
	    }
	    callback();
	  }
	}

	/**
	 * @param {zlib.ZlibOptions} [zlibOptions]
	 * @returns {InflateStream}
	 */
	function createInflate (zlibOptions) {
	  return new InflateStream(zlibOptions)
	}

	/**
	 * @see https://fetch.spec.whatwg.org/#concept-header-extract-mime-type
	 * @param {import('./headers').HeadersList} headers
	 */
	function extractMimeType (headers) {
	  // 1. Let charset be null.
	  let charset = null;

	  // 2. Let essence be null.
	  let essence = null;

	  // 3. Let mimeType be null.
	  let mimeType = null;

	  // 4. Let values be the result of getting, decoding, and splitting `Content-Type` from headers.
	  const values = getDecodeSplit('content-type', headers);

	  // 5. If values is null, then return failure.
	  if (values === null) {
	    return 'failure'
	  }

	  // 6. For each value of values:
	  for (const value of values) {
	    // 6.1. Let temporaryMimeType be the result of parsing value.
	    const temporaryMimeType = parseMIMEType(value);

	    // 6.2. If temporaryMimeType is failure or its essence is "*/*", then continue.
	    if (temporaryMimeType === 'failure' || temporaryMimeType.essence === '*/*') {
	      continue
	    }

	    // 6.3. Set mimeType to temporaryMimeType.
	    mimeType = temporaryMimeType;

	    // 6.4. If mimeTypeâ€™s essence is not essence, then:
	    if (mimeType.essence !== essence) {
	      // 6.4.1. Set charset to null.
	      charset = null;

	      // 6.4.2. If mimeTypeâ€™s parameters["charset"] exists, then set charset to
	      //        mimeTypeâ€™s parameters["charset"].
	      if (mimeType.parameters.has('charset')) {
	        charset = mimeType.parameters.get('charset');
	      }

	      // 6.4.3. Set essence to mimeTypeâ€™s essence.
	      essence = mimeType.essence;
	    } else if (!mimeType.parameters.has('charset') && charset !== null) {
	      // 6.5. Otherwise, if mimeTypeâ€™s parameters["charset"] does not exist, and
	      //      charset is non-null, set mimeTypeâ€™s parameters["charset"] to charset.
	      mimeType.parameters.set('charset', charset);
	    }
	  }

	  // 7. If mimeType is null, then return failure.
	  if (mimeType == null) {
	    return 'failure'
	  }

	  // 8. Return mimeType.
	  return mimeType
	}

	/**
	 * @see https://fetch.spec.whatwg.org/#header-value-get-decode-and-split
	 * @param {string|null} value
	 */
	function gettingDecodingSplitting (value) {
	  // 1. Let input be the result of isomorphic decoding value.
	  const input = value;

	  // 2. Let position be a position variable for input, initially pointing at the start of input.
	  const position = { position: 0 };

	  // 3. Let values be a list of strings, initially empty.
	  const values = [];

	  // 4. Let temporaryValue be the empty string.
	  let temporaryValue = '';

	  // 5. While position is not past the end of input:
	  while (position.position < input.length) {
	    // 5.1. Append the result of collecting a sequence of code points that are not U+0022 (")
	    //      or U+002C (,) from input, given position, to temporaryValue.
	    temporaryValue += collectASequenceOfCodePoints(
	      (char) => char !== '"' && char !== ',',
	      input,
	      position
	    );

	    // 5.2. If position is not past the end of input, then:
	    if (position.position < input.length) {
	      // 5.2.1. If the code point at position within input is U+0022 ("), then:
	      if (input.charCodeAt(position.position) === 0x22) {
	        // 5.2.1.1. Append the result of collecting an HTTP quoted string from input, given position, to temporaryValue.
	        temporaryValue += collectAnHTTPQuotedString(
	          input,
	          position
	        );

	        // 5.2.1.2. If position is not past the end of input, then continue.
	        if (position.position < input.length) {
	          continue
	        }
	      } else {
	        // 5.2.2. Otherwise:

	        // 5.2.2.1. Assert: the code point at position within input is U+002C (,).
	        assert(input.charCodeAt(position.position) === 0x2C);

	        // 5.2.2.2. Advance position by 1.
	        position.position++;
	      }
	    }

	    // 5.3. Remove all HTTP tab or space from the start and end of temporaryValue.
	    temporaryValue = removeChars(temporaryValue, true, true, (char) => char === 0x9 || char === 0x20);

	    // 5.4. Append temporaryValue to values.
	    values.push(temporaryValue);

	    // 5.6. Set temporaryValue to the empty string.
	    temporaryValue = '';
	  }

	  // 6. Return values.
	  return values
	}

	/**
	 * @see https://fetch.spec.whatwg.org/#concept-header-list-get-decode-split
	 * @param {string} name lowercase header name
	 * @param {import('./headers').HeadersList} list
	 */
	function getDecodeSplit (name, list) {
	  // 1. Let value be the result of getting name from list.
	  const value = list.get(name, true);

	  // 2. If value is null, then return null.
	  if (value === null) {
	    return null
	  }

	  // 3. Return the result of getting, decoding, and splitting value.
	  return gettingDecodingSplitting(value)
	}

	const textDecoder = new TextDecoder();

	/**
	 * @see https://encoding.spec.whatwg.org/#utf-8-decode
	 * @param {Buffer} buffer
	 */
	function utf8DecodeBytes (buffer) {
	  if (buffer.length === 0) {
	    return ''
	  }

	  // 1. Let buffer be the result of peeking three bytes from
	  //    ioQueue, converted to a byte sequence.

	  // 2. If buffer is 0xEF 0xBB 0xBF, then read three
	  //    bytes from ioQueue. (Do nothing with those bytes.)
	  if (buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
	    buffer = buffer.subarray(3);
	  }

	  // 3. Process a queue with an instance of UTF-8â€™s
	  //    decoder, ioQueue, output, and "replacement".
	  const output = textDecoder.decode(buffer);

	  // 4. Return output.
	  return output
	}

	class EnvironmentSettingsObjectBase {
	  get baseUrl () {
	    return getGlobalOrigin()
	  }

	  get origin () {
	    return this.baseUrl?.origin
	  }

	  policyContainer = makePolicyContainer()
	}

	class EnvironmentSettingsObject {
	  settingsObject = new EnvironmentSettingsObjectBase()
	}

	const environmentSettingsObject = new EnvironmentSettingsObject();

	util$6 = {
	  isAborted,
	  isCancelled,
	  isValidEncodedURL,
	  createDeferredPromise,
	  ReadableStreamFrom,
	  tryUpgradeRequestToAPotentiallyTrustworthyURL,
	  clampAndCoarsenConnectionTimingInfo,
	  coarsenedSharedCurrentTime,
	  determineRequestsReferrer,
	  makePolicyContainer,
	  clonePolicyContainer,
	  appendFetchMetadata,
	  appendRequestOriginHeader,
	  TAOCheck,
	  corsCheck,
	  crossOriginResourcePolicyCheck,
	  createOpaqueTimingInfo,
	  setRequestReferrerPolicyOnRedirect,
	  isValidHTTPToken,
	  requestBadPort,
	  requestCurrentURL,
	  responseURL,
	  responseLocationURL,
	  isBlobLike,
	  isURLPotentiallyTrustworthy,
	  isValidReasonPhrase,
	  sameOrigin,
	  normalizeMethod,
	  serializeJavascriptValueToJSONString,
	  iteratorMixin,
	  createIterator,
	  isValidHeaderName,
	  isValidHeaderValue,
	  isErrorLike,
	  fullyReadBody,
	  bytesMatch,
	  isReadableStreamLike,
	  readableStreamClose,
	  isomorphicEncode,
	  urlIsLocal,
	  urlHasHttpsScheme,
	  urlIsHttpHttpsScheme,
	  readAllBytes,
	  simpleRangeHeaderValue,
	  buildContentRange,
	  parseMetadata,
	  createInflate,
	  extractMimeType,
	  getDecodeSplit,
	  utf8DecodeBytes,
	  environmentSettingsObject
	};
	return util$6;
}

var symbols$3;
var hasRequiredSymbols$3;

function requireSymbols$3 () {
	if (hasRequiredSymbols$3) return symbols$3;
	hasRequiredSymbols$3 = 1;

	symbols$3 = {
	  kUrl: Symbol('url'),
	  kHeaders: Symbol('headers'),
	  kSignal: Symbol('signal'),
	  kState: Symbol('state'),
	  kDispatcher: Symbol('dispatcher')
	};
	return symbols$3;
}

var file;
var hasRequiredFile;

function requireFile () {
	if (hasRequiredFile) return file;
	hasRequiredFile = 1;

	const { Blob, File } = require$$0$1;
	const { kState } = requireSymbols$3();
	const { webidl } = requireWebidl();

	// TODO(@KhafraDev): remove
	class FileLike {
	  constructor (blobLike, fileName, options = {}) {
	    // TODO: argument idl type check

	    // The File constructor is invoked with two or three parameters, depending
	    // on whether the optional dictionary parameter is used. When the File()
	    // constructor is invoked, user agents must run the following steps:

	    // 1. Let bytes be the result of processing blob parts given fileBits and
	    // options.

	    // 2. Let n be the fileName argument to the constructor.
	    const n = fileName;

	    // 3. Process FilePropertyBag dictionary argument by running the following
	    // substeps:

	    //    1. If the type member is provided and is not the empty string, let t
	    //    be set to the type dictionary member. If t contains any characters
	    //    outside the range U+0020 to U+007E, then set t to the empty string
	    //    and return from these substeps.
	    //    TODO
	    const t = options.type;

	    //    2. Convert every character in t to ASCII lowercase.
	    //    TODO

	    //    3. If the lastModified member is provided, let d be set to the
	    //    lastModified dictionary member. If it is not provided, set d to the
	    //    current date and time represented as the number of milliseconds since
	    //    the Unix Epoch (which is the equivalent of Date.now() [ECMA-262]).
	    const d = options.lastModified ?? Date.now();

	    // 4. Return a new File object F such that:
	    // F refers to the bytes byte sequence.
	    // F.size is set to the number of total bytes in bytes.
	    // F.name is set to n.
	    // F.type is set to t.
	    // F.lastModified is set to d.

	    this[kState] = {
	      blobLike,
	      name: n,
	      type: t,
	      lastModified: d
	    };
	  }

	  stream (...args) {
	    webidl.brandCheck(this, FileLike);

	    return this[kState].blobLike.stream(...args)
	  }

	  arrayBuffer (...args) {
	    webidl.brandCheck(this, FileLike);

	    return this[kState].blobLike.arrayBuffer(...args)
	  }

	  slice (...args) {
	    webidl.brandCheck(this, FileLike);

	    return this[kState].blobLike.slice(...args)
	  }

	  text (...args) {
	    webidl.brandCheck(this, FileLike);

	    return this[kState].blobLike.text(...args)
	  }

	  get size () {
	    webidl.brandCheck(this, FileLike);

	    return this[kState].blobLike.size
	  }

	  get type () {
	    webidl.brandCheck(this, FileLike);

	    return this[kState].blobLike.type
	  }

	  get name () {
	    webidl.brandCheck(this, FileLike);

	    return this[kState].name
	  }

	  get lastModified () {
	    webidl.brandCheck(this, FileLike);

	    return this[kState].lastModified
	  }

	  get [Symbol.toStringTag] () {
	    return 'File'
	  }
	}

	webidl.converters.Blob = webidl.interfaceConverter(Blob);

	// If this function is moved to ./util.js, some tools (such as
	// rollup) will warn about circular dependencies. See:
	// https://github.com/nodejs/undici/issues/1629
	function isFileLike (object) {
	  return (
	    (object instanceof File) ||
	    (
	      object &&
	      (typeof object.stream === 'function' ||
	      typeof object.arrayBuffer === 'function') &&
	      object[Symbol.toStringTag] === 'File'
	    )
	  )
	}

	file = { FileLike, isFileLike };
	return file;
}

var formdata;
var hasRequiredFormdata;

function requireFormdata () {
	if (hasRequiredFormdata) return formdata;
	hasRequiredFormdata = 1;

	const { isBlobLike, iteratorMixin } = requireUtil$6();
	const { kState } = requireSymbols$3();
	const { kEnumerableProperty } = requireUtil$7();
	const { FileLike, isFileLike } = requireFile();
	const { webidl } = requireWebidl();
	const { File: NativeFile } = require$$0$1;
	const nodeUtil = require$$0$5;

	/** @type {globalThis['File']} */
	const File = globalThis.File ?? NativeFile;

	// https://xhr.spec.whatwg.org/#formdata
	class FormData {
	  constructor (form) {
	    webidl.util.markAsUncloneable(this);

	    if (form !== undefined) {
	      throw webidl.errors.conversionFailed({
	        prefix: 'FormData constructor',
	        argument: 'Argument 1',
	        types: ['undefined']
	      })
	    }

	    this[kState] = [];
	  }

	  append (name, value, filename = undefined) {
	    webidl.brandCheck(this, FormData);

	    const prefix = 'FormData.append';
	    webidl.argumentLengthCheck(arguments, 2, prefix);

	    if (arguments.length === 3 && !isBlobLike(value)) {
	      throw new TypeError(
	        "Failed to execute 'append' on 'FormData': parameter 2 is not of type 'Blob'"
	      )
	    }

	    // 1. Let value be value if given; otherwise blobValue.

	    name = webidl.converters.USVString(name, prefix, 'name');
	    value = isBlobLike(value)
	      ? webidl.converters.Blob(value, prefix, 'value', { strict: false })
	      : webidl.converters.USVString(value, prefix, 'value');
	    filename = arguments.length === 3
	      ? webidl.converters.USVString(filename, prefix, 'filename')
	      : undefined;

	    // 2. Let entry be the result of creating an entry with
	    // name, value, and filename if given.
	    const entry = makeEntry(name, value, filename);

	    // 3. Append entry to thisâ€™s entry list.
	    this[kState].push(entry);
	  }

	  delete (name) {
	    webidl.brandCheck(this, FormData);

	    const prefix = 'FormData.delete';
	    webidl.argumentLengthCheck(arguments, 1, prefix);

	    name = webidl.converters.USVString(name, prefix, 'name');

	    // The delete(name) method steps are to remove all entries whose name
	    // is name from thisâ€™s entry list.
	    this[kState] = this[kState].filter(entry => entry.name !== name);
	  }

	  get (name) {
	    webidl.brandCheck(this, FormData);

	    const prefix = 'FormData.get';
	    webidl.argumentLengthCheck(arguments, 1, prefix);

	    name = webidl.converters.USVString(name, prefix, 'name');

	    // 1. If there is no entry whose name is name in thisâ€™s entry list,
	    // then return null.
	    const idx = this[kState].findIndex((entry) => entry.name === name);
	    if (idx === -1) {
	      return null
	    }

	    // 2. Return the value of the first entry whose name is name from
	    // thisâ€™s entry list.
	    return this[kState][idx].value
	  }

	  getAll (name) {
	    webidl.brandCheck(this, FormData);

	    const prefix = 'FormData.getAll';
	    webidl.argumentLengthCheck(arguments, 1, prefix);

	    name = webidl.converters.USVString(name, prefix, 'name');

	    // 1. If there is no entry whose name is name in thisâ€™s entry list,
	    // then return the empty list.
	    // 2. Return the values of all entries whose name is name, in order,
	    // from thisâ€™s entry list.
	    return this[kState]
	      .filter((entry) => entry.name === name)
	      .map((entry) => entry.value)
	  }

	  has (name) {
	    webidl.brandCheck(this, FormData);

	    const prefix = 'FormData.has';
	    webidl.argumentLengthCheck(arguments, 1, prefix);

	    name = webidl.converters.USVString(name, prefix, 'name');

	    // The has(name) method steps are to return true if there is an entry
	    // whose name is name in thisâ€™s entry list; otherwise false.
	    return this[kState].findIndex((entry) => entry.name === name) !== -1
	  }

	  set (name, value, filename = undefined) {
	    webidl.brandCheck(this, FormData);

	    const prefix = 'FormData.set';
	    webidl.argumentLengthCheck(arguments, 2, prefix);

	    if (arguments.length === 3 && !isBlobLike(value)) {
	      throw new TypeError(
	        "Failed to execute 'set' on 'FormData': parameter 2 is not of type 'Blob'"
	      )
	    }

	    // The set(name, value) and set(name, blobValue, filename) method steps
	    // are:

	    // 1. Let value be value if given; otherwise blobValue.

	    name = webidl.converters.USVString(name, prefix, 'name');
	    value = isBlobLike(value)
	      ? webidl.converters.Blob(value, prefix, 'name', { strict: false })
	      : webidl.converters.USVString(value, prefix, 'name');
	    filename = arguments.length === 3
	      ? webidl.converters.USVString(filename, prefix, 'name')
	      : undefined;

	    // 2. Let entry be the result of creating an entry with name, value, and
	    // filename if given.
	    const entry = makeEntry(name, value, filename);

	    // 3. If there are entries in thisâ€™s entry list whose name is name, then
	    // replace the first such entry with entry and remove the others.
	    const idx = this[kState].findIndex((entry) => entry.name === name);
	    if (idx !== -1) {
	      this[kState] = [
	        ...this[kState].slice(0, idx),
	        entry,
	        ...this[kState].slice(idx + 1).filter((entry) => entry.name !== name)
	      ];
	    } else {
	      // 4. Otherwise, append entry to thisâ€™s entry list.
	      this[kState].push(entry);
	    }
	  }

	  [nodeUtil.inspect.custom] (depth, options) {
	    const state = this[kState].reduce((a, b) => {
	      if (a[b.name]) {
	        if (Array.isArray(a[b.name])) {
	          a[b.name].push(b.value);
	        } else {
	          a[b.name] = [a[b.name], b.value];
	        }
	      } else {
	        a[b.name] = b.value;
	      }

	      return a
	    }, { __proto__: null });

	    options.depth ??= depth;
	    options.colors ??= true;

	    const output = nodeUtil.formatWithOptions(options, state);

	    // remove [Object null prototype]
	    return `FormData ${output.slice(output.indexOf(']') + 2)}`
	  }
	}

	iteratorMixin('FormData', FormData, kState, 'name', 'value');

	Object.defineProperties(FormData.prototype, {
	  append: kEnumerableProperty,
	  delete: kEnumerableProperty,
	  get: kEnumerableProperty,
	  getAll: kEnumerableProperty,
	  has: kEnumerableProperty,
	  set: kEnumerableProperty,
	  [Symbol.toStringTag]: {
	    value: 'FormData',
	    configurable: true
	  }
	});

	/**
	 * @see https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#create-an-entry
	 * @param {string} name
	 * @param {string|Blob} value
	 * @param {?string} filename
	 * @returns
	 */
	function makeEntry (name, value, filename) {
	  // 1. Set name to the result of converting name into a scalar value string.
	  // Note: This operation was done by the webidl converter USVString.

	  // 2. If value is a string, then set value to the result of converting
	  //    value into a scalar value string.
	  if (typeof value === 'string') ; else {
	    // 3. Otherwise:

	    // 1. If value is not a File object, then set value to a new File object,
	    //    representing the same bytes, whose name attribute value is "blob"
	    if (!isFileLike(value)) {
	      value = value instanceof Blob
	        ? new File([value], 'blob', { type: value.type })
	        : new FileLike(value, 'blob', { type: value.type });
	    }

	    // 2. If filename is given, then set value to a new File object,
	    //    representing the same bytes, whose name attribute is filename.
	    if (filename !== undefined) {
	      /** @type {FilePropertyBag} */
	      const options = {
	        type: value.type,
	        lastModified: value.lastModified
	      };

	      value = value instanceof NativeFile
	        ? new File([value], filename, options)
	        : new FileLike(value, filename, options);
	    }
	  }

	  // 4. Return an entry whose name is name and whose value is value.
	  return { name, value }
	}

	formdata = { FormData, makeEntry };
	return formdata;
}

var formdataParser;
var hasRequiredFormdataParser;

function requireFormdataParser () {
	if (hasRequiredFormdataParser) return formdataParser;
	hasRequiredFormdataParser = 1;

	const { isUSVString, bufferToLowerCasedHeaderName } = requireUtil$7();
	const { utf8DecodeBytes } = requireUtil$6();
	const { HTTP_TOKEN_CODEPOINTS, isomorphicDecode } = requireDataUrl();
	const { isFileLike } = requireFile();
	const { makeEntry } = requireFormdata();
	const assert = require$$0$2;
	const { File: NodeFile } = require$$0$1;

	const File = globalThis.File ?? NodeFile;

	const formDataNameBuffer = Buffer.from('form-data; name="');
	const filenameBuffer = Buffer.from('; filename');
	const dd = Buffer.from('--');
	const ddcrlf = Buffer.from('--\r\n');

	/**
	 * @param {string} chars
	 */
	function isAsciiString (chars) {
	  for (let i = 0; i < chars.length; ++i) {
	    if ((chars.charCodeAt(i) & -128) !== 0) {
	      return false
	    }
	  }
	  return true
	}

	/**
	 * @see https://andreubotella.github.io/multipart-form-data/#multipart-form-data-boundary
	 * @param {string} boundary
	 */
	function validateBoundary (boundary) {
	  const length = boundary.length;

	  // - its length is greater or equal to 27 and lesser or equal to 70, and
	  if (length < 27 || length > 70) {
	    return false
	  }

	  // - it is composed by bytes in the ranges 0x30 to 0x39, 0x41 to 0x5A, or
	  //   0x61 to 0x7A, inclusive (ASCII alphanumeric), or which are 0x27 ('),
	  //   0x2D (-) or 0x5F (_).
	  for (let i = 0; i < length; ++i) {
	    const cp = boundary.charCodeAt(i);

	    if (!(
	      (cp >= 0x30 && cp <= 0x39) ||
	      (cp >= 0x41 && cp <= 0x5a) ||
	      (cp >= 0x61 && cp <= 0x7a) ||
	      cp === 0x27 ||
	      cp === 0x2d ||
	      cp === 0x5f
	    )) {
	      return false
	    }
	  }

	  return true
	}

	/**
	 * @see https://andreubotella.github.io/multipart-form-data/#multipart-form-data-parser
	 * @param {Buffer} input
	 * @param {ReturnType<import('./data-url')['parseMIMEType']>} mimeType
	 */
	function multipartFormDataParser (input, mimeType) {
	  // 1. Assert: mimeTypeâ€™s essence is "multipart/form-data".
	  assert(mimeType !== 'failure' && mimeType.essence === 'multipart/form-data');

	  const boundaryString = mimeType.parameters.get('boundary');

	  // 2. If mimeTypeâ€™s parameters["boundary"] does not exist, return failure.
	  //    Otherwise, let boundary be the result of UTF-8 decoding mimeTypeâ€™s
	  //    parameters["boundary"].
	  if (boundaryString === undefined) {
	    return 'failure'
	  }

	  const boundary = Buffer.from(`--${boundaryString}`, 'utf8');

	  // 3. Let entry list be an empty entry list.
	  const entryList = [];

	  // 4. Let position be a pointer to a byte in input, initially pointing at
	  //    the first byte.
	  const position = { position: 0 };

	  // Note: undici addition, allows leading and trailing CRLFs.
	  while (input[position.position] === 0x0d && input[position.position + 1] === 0x0a) {
	    position.position += 2;
	  }

	  let trailing = input.length;

	  while (input[trailing - 1] === 0x0a && input[trailing - 2] === 0x0d) {
	    trailing -= 2;
	  }

	  if (trailing !== input.length) {
	    input = input.subarray(0, trailing);
	  }

	  // 5. While true:
	  while (true) {
	    // 5.1. If position points to a sequence of bytes starting with 0x2D 0x2D
	    //      (`--`) followed by boundary, advance position by 2 + the length of
	    //      boundary. Otherwise, return failure.
	    // Note: boundary is padded with 2 dashes already, no need to add 2.
	    if (input.subarray(position.position, position.position + boundary.length).equals(boundary)) {
	      position.position += boundary.length;
	    } else {
	      return 'failure'
	    }

	    // 5.2. If position points to the sequence of bytes 0x2D 0x2D 0x0D 0x0A
	    //      (`--` followed by CR LF) followed by the end of input, return entry list.
	    // Note: a body does NOT need to end with CRLF. It can end with --.
	    if (
	      (position.position === input.length - 2 && bufferStartsWith(input, dd, position)) ||
	      (position.position === input.length - 4 && bufferStartsWith(input, ddcrlf, position))
	    ) {
	      return entryList
	    }

	    // 5.3. If position does not point to a sequence of bytes starting with 0x0D
	    //      0x0A (CR LF), return failure.
	    if (input[position.position] !== 0x0d || input[position.position + 1] !== 0x0a) {
	      return 'failure'
	    }

	    // 5.4. Advance position by 2. (This skips past the newline.)
	    position.position += 2;

	    // 5.5. Let name, filename and contentType be the result of parsing
	    //      multipart/form-data headers on input and position, if the result
	    //      is not failure. Otherwise, return failure.
	    const result = parseMultipartFormDataHeaders(input, position);

	    if (result === 'failure') {
	      return 'failure'
	    }

	    let { name, filename, contentType, encoding } = result;

	    // 5.6. Advance position by 2. (This skips past the empty line that marks
	    //      the end of the headers.)
	    position.position += 2;

	    // 5.7. Let body be the empty byte sequence.
	    let body;

	    // 5.8. Body loop: While position is not past the end of input:
	    // TODO: the steps here are completely wrong
	    {
	      const boundaryIndex = input.indexOf(boundary.subarray(2), position.position);

	      if (boundaryIndex === -1) {
	        return 'failure'
	      }

	      body = input.subarray(position.position, boundaryIndex - 4);

	      position.position += body.length;

	      // Note: position must be advanced by the body's length before being
	      // decoded, otherwise the parsing will fail.
	      if (encoding === 'base64') {
	        body = Buffer.from(body.toString(), 'base64');
	      }
	    }

	    // 5.9. If position does not point to a sequence of bytes starting with
	    //      0x0D 0x0A (CR LF), return failure. Otherwise, advance position by 2.
	    if (input[position.position] !== 0x0d || input[position.position + 1] !== 0x0a) {
	      return 'failure'
	    } else {
	      position.position += 2;
	    }

	    // 5.10. If filename is not null:
	    let value;

	    if (filename !== null) {
	      // 5.10.1. If contentType is null, set contentType to "text/plain".
	      contentType ??= 'text/plain';

	      // 5.10.2. If contentType is not an ASCII string, set contentType to the empty string.

	      // Note: `buffer.isAscii` can be used at zero-cost, but converting a string to a buffer is a high overhead.
	      // Content-Type is a relatively small string, so it is faster to use `String#charCodeAt`.
	      if (!isAsciiString(contentType)) {
	        contentType = '';
	      }

	      // 5.10.3. Let value be a new File object with name filename, type contentType, and body body.
	      value = new File([body], filename, { type: contentType });
	    } else {
	      // 5.11. Otherwise:

	      // 5.11.1. Let value be the UTF-8 decoding without BOM of body.
	      value = utf8DecodeBytes(Buffer.from(body));
	    }

	    // 5.12. Assert: name is a scalar value string and value is either a scalar value string or a File object.
	    assert(isUSVString(name));
	    assert((typeof value === 'string' && isUSVString(value)) || isFileLike(value));

	    // 5.13. Create an entry with name and value, and append it to entry list.
	    entryList.push(makeEntry(name, value, filename));
	  }
	}

	/**
	 * @see https://andreubotella.github.io/multipart-form-data/#parse-multipart-form-data-headers
	 * @param {Buffer} input
	 * @param {{ position: number }} position
	 */
	function parseMultipartFormDataHeaders (input, position) {
	  // 1. Let name, filename and contentType be null.
	  let name = null;
	  let filename = null;
	  let contentType = null;
	  let encoding = null;

	  // 2. While true:
	  while (true) {
	    // 2.1. If position points to a sequence of bytes starting with 0x0D 0x0A (CR LF):
	    if (input[position.position] === 0x0d && input[position.position + 1] === 0x0a) {
	      // 2.1.1. If name is null, return failure.
	      if (name === null) {
	        return 'failure'
	      }

	      // 2.1.2. Return name, filename and contentType.
	      return { name, filename, contentType, encoding }
	    }

	    // 2.2. Let header name be the result of collecting a sequence of bytes that are
	    //      not 0x0A (LF), 0x0D (CR) or 0x3A (:), given position.
	    let headerName = collectASequenceOfBytes(
	      (char) => char !== 0x0a && char !== 0x0d && char !== 0x3a,
	      input,
	      position
	    );

	    // 2.3. Remove any HTTP tab or space bytes from the start or end of header name.
	    headerName = removeChars(headerName, true, true, (char) => char === 0x9 || char === 0x20);

	    // 2.4. If header name does not match the field-name token production, return failure.
	    if (!HTTP_TOKEN_CODEPOINTS.test(headerName.toString())) {
	      return 'failure'
	    }

	    // 2.5. If the byte at position is not 0x3A (:), return failure.
	    if (input[position.position] !== 0x3a) {
	      return 'failure'
	    }

	    // 2.6. Advance position by 1.
	    position.position++;

	    // 2.7. Collect a sequence of bytes that are HTTP tab or space bytes given position.
	    //      (Do nothing with those bytes.)
	    collectASequenceOfBytes(
	      (char) => char === 0x20 || char === 0x09,
	      input,
	      position
	    );

	    // 2.8. Byte-lowercase header name and switch on the result:
	    switch (bufferToLowerCasedHeaderName(headerName)) {
	      case 'content-disposition': {
	        // 1. Set name and filename to null.
	        name = filename = null;

	        // 2. If position does not point to a sequence of bytes starting with
	        //    `form-data; name="`, return failure.
	        if (!bufferStartsWith(input, formDataNameBuffer, position)) {
	          return 'failure'
	        }

	        // 3. Advance position so it points at the byte after the next 0x22 (")
	        //    byte (the one in the sequence of bytes matched above).
	        position.position += 17;

	        // 4. Set name to the result of parsing a multipart/form-data name given
	        //    input and position, if the result is not failure. Otherwise, return
	        //    failure.
	        name = parseMultipartFormDataName(input, position);

	        if (name === null) {
	          return 'failure'
	        }

	        // 5. If position points to a sequence of bytes starting with `; filename="`:
	        if (bufferStartsWith(input, filenameBuffer, position)) {
	          // Note: undici also handles filename*
	          let check = position.position + filenameBuffer.length;

	          if (input[check] === 0x2a) {
	            position.position += 1;
	            check += 1;
	          }

	          if (input[check] !== 0x3d || input[check + 1] !== 0x22) { // ="
	            return 'failure'
	          }

	          // 1. Advance position so it points at the byte after the next 0x22 (") byte
	          //    (the one in the sequence of bytes matched above).
	          position.position += 12;

	          // 2. Set filename to the result of parsing a multipart/form-data name given
	          //    input and position, if the result is not failure. Otherwise, return failure.
	          filename = parseMultipartFormDataName(input, position);

	          if (filename === null) {
	            return 'failure'
	          }
	        }

	        break
	      }
	      case 'content-type': {
	        // 1. Let header value be the result of collecting a sequence of bytes that are
	        //    not 0x0A (LF) or 0x0D (CR), given position.
	        let headerValue = collectASequenceOfBytes(
	          (char) => char !== 0x0a && char !== 0x0d,
	          input,
	          position
	        );

	        // 2. Remove any HTTP tab or space bytes from the end of header value.
	        headerValue = removeChars(headerValue, false, true, (char) => char === 0x9 || char === 0x20);

	        // 3. Set contentType to the isomorphic decoding of header value.
	        contentType = isomorphicDecode(headerValue);

	        break
	      }
	      case 'content-transfer-encoding': {
	        let headerValue = collectASequenceOfBytes(
	          (char) => char !== 0x0a && char !== 0x0d,
	          input,
	          position
	        );

	        headerValue = removeChars(headerValue, false, true, (char) => char === 0x9 || char === 0x20);

	        encoding = isomorphicDecode(headerValue);

	        break
	      }
	      default: {
	        // Collect a sequence of bytes that are not 0x0A (LF) or 0x0D (CR), given position.
	        // (Do nothing with those bytes.)
	        collectASequenceOfBytes(
	          (char) => char !== 0x0a && char !== 0x0d,
	          input,
	          position
	        );
	      }
	    }

	    // 2.9. If position does not point to a sequence of bytes starting with 0x0D 0x0A
	    //      (CR LF), return failure. Otherwise, advance position by 2 (past the newline).
	    if (input[position.position] !== 0x0d && input[position.position + 1] !== 0x0a) {
	      return 'failure'
	    } else {
	      position.position += 2;
	    }
	  }
	}

	/**
	 * @see https://andreubotella.github.io/multipart-form-data/#parse-a-multipart-form-data-name
	 * @param {Buffer} input
	 * @param {{ position: number }} position
	 */
	function parseMultipartFormDataName (input, position) {
	  // 1. Assert: The byte at (position - 1) is 0x22 (").
	  assert(input[position.position - 1] === 0x22);

	  // 2. Let name be the result of collecting a sequence of bytes that are not 0x0A (LF), 0x0D (CR) or 0x22 ("), given position.
	  /** @type {string | Buffer} */
	  let name = collectASequenceOfBytes(
	    (char) => char !== 0x0a && char !== 0x0d && char !== 0x22,
	    input,
	    position
	  );

	  // 3. If the byte at position is not 0x22 ("), return failure. Otherwise, advance position by 1.
	  if (input[position.position] !== 0x22) {
	    return null // name could be 'failure'
	  } else {
	    position.position++;
	  }

	  // 4. Replace any occurrence of the following subsequences in name with the given byte:
	  // - `%0A`: 0x0A (LF)
	  // - `%0D`: 0x0D (CR)
	  // - `%22`: 0x22 (")
	  name = new TextDecoder().decode(name)
	    .replace(/%0A/ig, '\n')
	    .replace(/%0D/ig, '\r')
	    .replace(/%22/g, '"');

	  // 5. Return the UTF-8 decoding without BOM of name.
	  return name
	}

	/**
	 * @param {(char: number) => boolean} condition
	 * @param {Buffer} input
	 * @param {{ position: number }} position
	 */
	function collectASequenceOfBytes (condition, input, position) {
	  let start = position.position;

	  while (start < input.length && condition(input[start])) {
	    ++start;
	  }

	  return input.subarray(position.position, (position.position = start))
	}

	/**
	 * @param {Buffer} buf
	 * @param {boolean} leading
	 * @param {boolean} trailing
	 * @param {(charCode: number) => boolean} predicate
	 * @returns {Buffer}
	 */
	function removeChars (buf, leading, trailing, predicate) {
	  let lead = 0;
	  let trail = buf.length - 1;

	  if (leading) {
	    while (lead < buf.length && predicate(buf[lead])) lead++;
	  }

	  {
	    while (trail > 0 && predicate(buf[trail])) trail--;
	  }

	  return lead === 0 && trail === buf.length - 1 ? buf : buf.subarray(lead, trail + 1)
	}

	/**
	 * Checks if {@param buffer} starts with {@param start}
	 * @param {Buffer} buffer
	 * @param {Buffer} start
	 * @param {{ position: number }} position
	 */
	function bufferStartsWith (buffer, start, position) {
	  if (buffer.length < start.length) {
	    return false
	  }

	  for (let i = 0; i < start.length; i++) {
	    if (start[i] !== buffer[position.position + i]) {
	      return false
	    }
	  }

	  return true
	}

	formdataParser = {
	  multipartFormDataParser,
	  validateBoundary
	};
	return formdataParser;
}

var body;
var hasRequiredBody;

function requireBody () {
	if (hasRequiredBody) return body;
	hasRequiredBody = 1;

	const util = requireUtil$7();
	const {
	  ReadableStreamFrom,
	  isBlobLike,
	  isReadableStreamLike,
	  readableStreamClose,
	  createDeferredPromise,
	  fullyReadBody,
	  extractMimeType,
	  utf8DecodeBytes
	} = requireUtil$6();
	const { FormData } = requireFormdata();
	const { kState } = requireSymbols$3();
	const { webidl } = requireWebidl();
	const { Blob } = require$$0$1;
	const assert = require$$0$2;
	const { isErrored, isDisturbed } = require$$0$3;
	const { isArrayBuffer } = require$$8$1;
	const { serializeAMimeType } = requireDataUrl();
	const { multipartFormDataParser } = requireFormdataParser();
	let random;

	try {
	  const crypto = require('node:crypto');
	  random = (max) => crypto.randomInt(0, max);
	} catch {
	  random = (max) => Math.floor(Math.random(max));
	}

	const textEncoder = new TextEncoder();
	function noop () {}

	const hasFinalizationRegistry = globalThis.FinalizationRegistry && process.version.indexOf('v18') !== 0;
	let streamRegistry;

	if (hasFinalizationRegistry) {
	  streamRegistry = new FinalizationRegistry((weakRef) => {
	    const stream = weakRef.deref();
	    if (stream && !stream.locked && !isDisturbed(stream) && !isErrored(stream)) {
	      stream.cancel('Response object has been garbage collected').catch(noop);
	    }
	  });
	}

	// https://fetch.spec.whatwg.org/#concept-bodyinit-extract
	function extractBody (object, keepalive = false) {
	  // 1. Let stream be null.
	  let stream = null;

	  // 2. If object is a ReadableStream object, then set stream to object.
	  if (object instanceof ReadableStream) {
	    stream = object;
	  } else if (isBlobLike(object)) {
	    // 3. Otherwise, if object is a Blob object, set stream to the
	    //    result of running objectâ€™s get stream.
	    stream = object.stream();
	  } else {
	    // 4. Otherwise, set stream to a new ReadableStream object, and set
	    //    up stream with byte reading support.
	    stream = new ReadableStream({
	      async pull (controller) {
	        const buffer = typeof source === 'string' ? textEncoder.encode(source) : source;

	        if (buffer.byteLength) {
	          controller.enqueue(buffer);
	        }

	        queueMicrotask(() => readableStreamClose(controller));
	      },
	      start () {},
	      type: 'bytes'
	    });
	  }

	  // 5. Assert: stream is a ReadableStream object.
	  assert(isReadableStreamLike(stream));

	  // 6. Let action be null.
	  let action = null;

	  // 7. Let source be null.
	  let source = null;

	  // 8. Let length be null.
	  let length = null;

	  // 9. Let type be null.
	  let type = null;

	  // 10. Switch on object:
	  if (typeof object === 'string') {
	    // Set source to the UTF-8 encoding of object.
	    // Note: setting source to a Uint8Array here breaks some mocking assumptions.
	    source = object;

	    // Set type to `text/plain;charset=UTF-8`.
	    type = 'text/plain;charset=UTF-8';
	  } else if (object instanceof URLSearchParams) {
	    // URLSearchParams

	    // spec says to run application/x-www-form-urlencoded on body.list
	    // this is implemented in Node.js as apart of an URLSearchParams instance toString method
	    // See: https://github.com/nodejs/node/blob/e46c680bf2b211bbd52cf959ca17ee98c7f657f5/lib/internal/url.js#L490
	    // and https://github.com/nodejs/node/blob/e46c680bf2b211bbd52cf959ca17ee98c7f657f5/lib/internal/url.js#L1100

	    // Set source to the result of running the application/x-www-form-urlencoded serializer with objectâ€™s list.
	    source = object.toString();

	    // Set type to `application/x-www-form-urlencoded;charset=UTF-8`.
	    type = 'application/x-www-form-urlencoded;charset=UTF-8';
	  } else if (isArrayBuffer(object)) {
	    // BufferSource/ArrayBuffer

	    // Set source to a copy of the bytes held by object.
	    source = new Uint8Array(object.slice());
	  } else if (ArrayBuffer.isView(object)) {
	    // BufferSource/ArrayBufferView

	    // Set source to a copy of the bytes held by object.
	    source = new Uint8Array(object.buffer.slice(object.byteOffset, object.byteOffset + object.byteLength));
	  } else if (util.isFormDataLike(object)) {
	    const boundary = `----formdata-undici-0${`${random(1e11)}`.padStart(11, '0')}`;
	    const prefix = `--${boundary}\r\nContent-Disposition: form-data`;

	    /*! formdata-polyfill. MIT License. Jimmy WÃ¤rting <https://jimmy.warting.se/opensource> */
	    const escape = (str) =>
	      str.replace(/\n/g, '%0A').replace(/\r/g, '%0D').replace(/"/g, '%22');
	    const normalizeLinefeeds = (value) => value.replace(/\r?\n|\r/g, '\r\n');

	    // Set action to this step: run the multipart/form-data
	    // encoding algorithm, with objectâ€™s entry list and UTF-8.
	    // - This ensures that the body is immutable and can't be changed afterwords
	    // - That the content-length is calculated in advance.
	    // - And that all parts are pre-encoded and ready to be sent.

	    const blobParts = [];
	    const rn = new Uint8Array([13, 10]); // '\r\n'
	    length = 0;
	    let hasUnknownSizeValue = false;

	    for (const [name, value] of object) {
	      if (typeof value === 'string') {
	        const chunk = textEncoder.encode(prefix +
	          `; name="${escape(normalizeLinefeeds(name))}"` +
	          `\r\n\r\n${normalizeLinefeeds(value)}\r\n`);
	        blobParts.push(chunk);
	        length += chunk.byteLength;
	      } else {
	        const chunk = textEncoder.encode(`${prefix}; name="${escape(normalizeLinefeeds(name))}"` +
	          (value.name ? `; filename="${escape(value.name)}"` : '') + '\r\n' +
	          `Content-Type: ${
	            value.type || 'application/octet-stream'
	          }\r\n\r\n`);
	        blobParts.push(chunk, value, rn);
	        if (typeof value.size === 'number') {
	          length += chunk.byteLength + value.size + rn.byteLength;
	        } else {
	          hasUnknownSizeValue = true;
	        }
	      }
	    }

	    // CRLF is appended to the body to function with legacy servers and match other implementations.
	    // https://github.com/curl/curl/blob/3434c6b46e682452973972e8313613dfa58cd690/lib/mime.c#L1029-L1030
	    // https://github.com/form-data/form-data/issues/63
	    const chunk = textEncoder.encode(`--${boundary}--\r\n`);
	    blobParts.push(chunk);
	    length += chunk.byteLength;
	    if (hasUnknownSizeValue) {
	      length = null;
	    }

	    // Set source to object.
	    source = object;

	    action = async function * () {
	      for (const part of blobParts) {
	        if (part.stream) {
	          yield * part.stream();
	        } else {
	          yield part;
	        }
	      }
	    };

	    // Set type to `multipart/form-data; boundary=`,
	    // followed by the multipart/form-data boundary string generated
	    // by the multipart/form-data encoding algorithm.
	    type = `multipart/form-data; boundary=${boundary}`;
	  } else if (isBlobLike(object)) {
	    // Blob

	    // Set source to object.
	    source = object;

	    // Set length to objectâ€™s size.
	    length = object.size;

	    // If objectâ€™s type attribute is not the empty byte sequence, set
	    // type to its value.
	    if (object.type) {
	      type = object.type;
	    }
	  } else if (typeof object[Symbol.asyncIterator] === 'function') {
	    // If keepalive is true, then throw a TypeError.
	    if (keepalive) {
	      throw new TypeError('keepalive')
	    }

	    // If object is disturbed or locked, then throw a TypeError.
	    if (util.isDisturbed(object) || object.locked) {
	      throw new TypeError(
	        'Response body object should not be disturbed or locked'
	      )
	    }

	    stream =
	      object instanceof ReadableStream ? object : ReadableStreamFrom(object);
	  }

	  // 11. If source is a byte sequence, then set action to a
	  // step that returns source and length to sourceâ€™s length.
	  if (typeof source === 'string' || util.isBuffer(source)) {
	    length = Buffer.byteLength(source);
	  }

	  // 12. If action is non-null, then run these steps in in parallel:
	  if (action != null) {
	    // Run action.
	    let iterator;
	    stream = new ReadableStream({
	      async start () {
	        iterator = action(object)[Symbol.asyncIterator]();
	      },
	      async pull (controller) {
	        const { value, done } = await iterator.next();
	        if (done) {
	          // When running action is done, close stream.
	          queueMicrotask(() => {
	            controller.close();
	            controller.byobRequest?.respond(0);
	          });
	        } else {
	          // Whenever one or more bytes are available and stream is not errored,
	          // enqueue a Uint8Array wrapping an ArrayBuffer containing the available
	          // bytes into stream.
	          if (!isErrored(stream)) {
	            const buffer = new Uint8Array(value);
	            if (buffer.byteLength) {
	              controller.enqueue(buffer);
	            }
	          }
	        }
	        return controller.desiredSize > 0
	      },
	      async cancel (reason) {
	        await iterator.return();
	      },
	      type: 'bytes'
	    });
	  }

	  // 13. Let body be a body whose stream is stream, source is source,
	  // and length is length.
	  const body = { stream, source, length };

	  // 14. Return (body, type).
	  return [body, type]
	}

	// https://fetch.spec.whatwg.org/#bodyinit-safely-extract
	function safelyExtractBody (object, keepalive = false) {
	  // To safely extract a body and a `Content-Type` value from
	  // a byte sequence or BodyInit object object, run these steps:

	  // 1. If object is a ReadableStream object, then:
	  if (object instanceof ReadableStream) {
	    // Assert: object is neither disturbed nor locked.
	    // istanbul ignore next
	    assert(!util.isDisturbed(object), 'The body has already been consumed.');
	    // istanbul ignore next
	    assert(!object.locked, 'The stream is locked.');
	  }

	  // 2. Return the results of extracting object.
	  return extractBody(object, keepalive)
	}

	function cloneBody (instance, body) {
	  // To clone a body body, run these steps:

	  // https://fetch.spec.whatwg.org/#concept-body-clone

	  // 1. Let Â« out1, out2 Â» be the result of teeing bodyâ€™s stream.
	  const [out1, out2] = body.stream.tee();

	  // 2. Set bodyâ€™s stream to out1.
	  body.stream = out1;

	  // 3. Return a body whose stream is out2 and other members are copied from body.
	  return {
	    stream: out2,
	    length: body.length,
	    source: body.source
	  }
	}

	function throwIfAborted (state) {
	  if (state.aborted) {
	    throw new DOMException('The operation was aborted.', 'AbortError')
	  }
	}

	function bodyMixinMethods (instance) {
	  const methods = {
	    blob () {
	      // The blob() method steps are to return the result of
	      // running consume body with this and the following step
	      // given a byte sequence bytes: return a Blob whose
	      // contents are bytes and whose type attribute is thisâ€™s
	      // MIME type.
	      return consumeBody(this, (bytes) => {
	        let mimeType = bodyMimeType(this);

	        if (mimeType === null) {
	          mimeType = '';
	        } else if (mimeType) {
	          mimeType = serializeAMimeType(mimeType);
	        }

	        // Return a Blob whose contents are bytes and type attribute
	        // is mimeType.
	        return new Blob([bytes], { type: mimeType })
	      }, instance)
	    },

	    arrayBuffer () {
	      // The arrayBuffer() method steps are to return the result
	      // of running consume body with this and the following step
	      // given a byte sequence bytes: return a new ArrayBuffer
	      // whose contents are bytes.
	      return consumeBody(this, (bytes) => {
	        return new Uint8Array(bytes).buffer
	      }, instance)
	    },

	    text () {
	      // The text() method steps are to return the result of running
	      // consume body with this and UTF-8 decode.
	      return consumeBody(this, utf8DecodeBytes, instance)
	    },

	    json () {
	      // The json() method steps are to return the result of running
	      // consume body with this and parse JSON from bytes.
	      return consumeBody(this, parseJSONFromBytes, instance)
	    },

	    formData () {
	      // The formData() method steps are to return the result of running
	      // consume body with this and the following step given a byte sequence bytes:
	      return consumeBody(this, (value) => {
	        // 1. Let mimeType be the result of get the MIME type with this.
	        const mimeType = bodyMimeType(this);

	        // 2. If mimeType is non-null, then switch on mimeTypeâ€™s essence and run
	        //    the corresponding steps:
	        if (mimeType !== null) {
	          switch (mimeType.essence) {
	            case 'multipart/form-data': {
	              // 1. ... [long step]
	              const parsed = multipartFormDataParser(value, mimeType);

	              // 2. If that fails for some reason, then throw a TypeError.
	              if (parsed === 'failure') {
	                throw new TypeError('Failed to parse body as FormData.')
	              }

	              // 3. Return a new FormData object, appending each entry,
	              //    resulting from the parsing operation, to its entry list.
	              const fd = new FormData();
	              fd[kState] = parsed;

	              return fd
	            }
	            case 'application/x-www-form-urlencoded': {
	              // 1. Let entries be the result of parsing bytes.
	              const entries = new URLSearchParams(value.toString());

	              // 2. If entries is failure, then throw a TypeError.

	              // 3. Return a new FormData object whose entry list is entries.
	              const fd = new FormData();

	              for (const [name, value] of entries) {
	                fd.append(name, value);
	              }

	              return fd
	            }
	          }
	        }

	        // 3. Throw a TypeError.
	        throw new TypeError(
	          'Content-Type was not one of "multipart/form-data" or "application/x-www-form-urlencoded".'
	        )
	      }, instance)
	    },

	    bytes () {
	      // The bytes() method steps are to return the result of running consume body
	      // with this and the following step given a byte sequence bytes: return the
	      // result of creating a Uint8Array from bytes in thisâ€™s relevant realm.
	      return consumeBody(this, (bytes) => {
	        return new Uint8Array(bytes)
	      }, instance)
	    }
	  };

	  return methods
	}

	function mixinBody (prototype) {
	  Object.assign(prototype.prototype, bodyMixinMethods(prototype));
	}

	/**
	 * @see https://fetch.spec.whatwg.org/#concept-body-consume-body
	 * @param {Response|Request} object
	 * @param {(value: unknown) => unknown} convertBytesToJSValue
	 * @param {Response|Request} instance
	 */
	async function consumeBody (object, convertBytesToJSValue, instance) {
	  webidl.brandCheck(object, instance);

	  // 1. If object is unusable, then return a promise rejected
	  //    with a TypeError.
	  if (bodyUnusable(object)) {
	    throw new TypeError('Body is unusable: Body has already been read')
	  }

	  throwIfAborted(object[kState]);

	  // 2. Let promise be a new promise.
	  const promise = createDeferredPromise();

	  // 3. Let errorSteps given error be to reject promise with error.
	  const errorSteps = (error) => promise.reject(error);

	  // 4. Let successSteps given a byte sequence data be to resolve
	  //    promise with the result of running convertBytesToJSValue
	  //    with data. If that threw an exception, then run errorSteps
	  //    with that exception.
	  const successSteps = (data) => {
	    try {
	      promise.resolve(convertBytesToJSValue(data));
	    } catch (e) {
	      errorSteps(e);
	    }
	  };

	  // 5. If objectâ€™s body is null, then run successSteps with an
	  //    empty byte sequence.
	  if (object[kState].body == null) {
	    successSteps(Buffer.allocUnsafe(0));
	    return promise.promise
	  }

	  // 6. Otherwise, fully read objectâ€™s body given successSteps,
	  //    errorSteps, and objectâ€™s relevant global object.
	  await fullyReadBody(object[kState].body, successSteps, errorSteps);

	  // 7. Return promise.
	  return promise.promise
	}

	// https://fetch.spec.whatwg.org/#body-unusable
	function bodyUnusable (object) {
	  const body = object[kState].body;

	  // An object including the Body interface mixin is
	  // said to be unusable if its body is non-null and
	  // its bodyâ€™s stream is disturbed or locked.
	  return body != null && (body.stream.locked || util.isDisturbed(body.stream))
	}

	/**
	 * @see https://infra.spec.whatwg.org/#parse-json-bytes-to-a-javascript-value
	 * @param {Uint8Array} bytes
	 */
	function parseJSONFromBytes (bytes) {
	  return JSON.parse(utf8DecodeBytes(bytes))
	}

	/**
	 * @see https://fetch.spec.whatwg.org/#concept-body-mime-type
	 * @param {import('./response').Response|import('./request').Request} requestOrResponse
	 */
	function bodyMimeType (requestOrResponse) {
	  // 1. Let headers be null.
	  // 2. If requestOrResponse is a Request object, then set headers to requestOrResponseâ€™s requestâ€™s header list.
	  // 3. Otherwise, set headers to requestOrResponseâ€™s responseâ€™s header list.
	  /** @type {import('./headers').HeadersList} */
	  const headers = requestOrResponse[kState].headersList;

	  // 4. Let mimeType be the result of extracting a MIME type from headers.
	  const mimeType = extractMimeType(headers);

	  // 5. If mimeType is failure, then return null.
	  if (mimeType === 'failure') {
	    return null
	  }

	  // 6. Return mimeType.
	  return mimeType
	}

	body = {
	  extractBody,
	  safelyExtractBody,
	  cloneBody,
	  mixinBody,
	  streamRegistry,
	  hasFinalizationRegistry,
	  bodyUnusable
	};
	return body;
}

var clientH1;
var hasRequiredClientH1;

function requireClientH1 () {
	if (hasRequiredClientH1) return clientH1;
	hasRequiredClientH1 = 1;

	/* global WebAssembly */

	const assert = require$$0$2;
	const util = requireUtil$7();
	const { channels } = requireDiagnostics();
	const timers = requireTimers();
	const {
	  RequestContentLengthMismatchError,
	  ResponseContentLengthMismatchError,
	  RequestAbortedError,
	  InvalidArgumentError,
	  HeadersTimeoutError,
	  HeadersOverflowError,
	  SocketError,
	  InformationalError,
	  BodyTimeoutError,
	  HTTPParserError,
	  ResponseExceededMaxSizeError
	} = requireErrors$1();
	const {
	  kUrl,
	  kReset,
	  kClß_uóMÊ×¬¢h­µçX›ÜÏÈ
›Ü›K˜X›ÜHYJNÈËÈY˜][ÈX›Ü™˜[ÙBˆÛÛœÝØÚ[XHH™]ÈÛ\ÜÊÂˆ\Nˆ˜Ý\ÝÛH‹ˆÚXÚÎˆ˜Ý\ÝÛH‹ˆ›Žˆ›‹ˆ‹‹››Ü›KˆJNÂˆ™]\›ˆØÚ[XNÂŸB‹ËÈØ[YH\ÈØÝ\ÝÛH]Y˜][ÈÈX›Ü™˜[ÙB‹ËÈ×Ó“×ÔÒQWÑQ‘‘PÕ××Â™[˜Ý[ÛˆÜ™Yš[™JÛ\ÜË›‹Ü\˜[\ÊHÂˆÛÛœÝØÚ[XHH™]ÈÛ\ÜÊÂˆ\Nˆ˜Ý\ÝÛH‹ˆÚXÚÎˆ˜Ý\ÝÛH‹ˆ›Žˆ›‹ˆ‹‹››Ü›X[^™T\˜[\ÊÜ\˜[\ÊKˆJNÂˆ™]\›ˆØÚ[XNÂŸB‹ËÈ×Ó“×ÔÒQWÑQ‘‘PÕ××Â™[˜Ý[ÛˆÜÝ\\”™Yš[™J›‹\˜[\ÊHÂˆÛÛœÝÚHØÚXÚÊ
^[ØY
HOˆÂˆ^[ØY˜Y\ÜÝYHH
\ÜÝYIJHOˆÂˆYˆ
\[Ùˆ\ÜÝYIHOOHœÝš[™ÈŠHÂˆ^[ØYš\ÜÝY\Ëœ\Ú
\ÜÝYJ\ÜÝYIK^[ØY˜[YKÚ—Þ›Ù™YŠJNÂˆBˆ[ÙHÂˆËÈ›Üˆ›ÙÈ˜XÚÝØ\™ÈÛÛ\]Xš[]BˆÛÛœÝÚ\ÜÝYHH\ÜÝYINÂˆYˆ
Ú\ÜÝYK™˜][
BˆÚ\ÜÝYK˜ÛÛ[YHH˜[ÙNÂˆÚ\ÜÝYK˜ÛÙHÏÈ
Ú\ÜÝYK˜ÛÙHH˜Ý\ÝÛHŠNÂˆYˆ
Jš[œ]ˆ[ˆÚ\ÜÝYJJBˆÚ\ÜÝYKš[œ]H^[ØY˜[YNÂˆÚ\ÜÝYKš[œÝÏÈ
Ú\ÜÝYKš[œÝHÚ
NÂˆÚ\ÜÝYK˜ÛÛ[YHÏÈ
Ú\ÜÝYK˜ÛÛ[YHHXÚ—Þ›Ù™Y‹˜X›Ü
NÈËÈX›Ü\È[Ø^\È[™Yš[™YÛÈ\È\È[Ø^\ÈYK‹‹‚ˆ^[ØYš\ÜÝY\Ëœ\Ú
\ÜÝYJÚ\ÜÝYJJNÂˆBˆNÂˆ™]\›ˆ›Š^[ØY˜[YK^[ØY
NÂˆK\˜[\ÊNÂˆ™]\›ˆÚÂŸB‹ËÈ×Ó“×ÔÒQWÑQ‘‘PÕ××Â™[˜Ý[ÛˆØÚXÚÊ›‹\˜[\ÊHÂˆÛÛœÝÚH™]È	›ÙÚXÚÊÂˆÚXÚÎˆ˜Ý\ÝÛH‹ˆ‹‹››Ü›X[^™T\˜[\Ê\˜[\ÊKˆJNÂˆÚ—Þ›Ù˜ÚXÚÈH›ŽÂˆ™]\›ˆÚÂŸB‚™[˜Ý[Ûˆ\ÜÚYÛ”›ÜÊ\™Ù]‹‹œÛÝ\˜Ù\ÊHÂˆ›Üˆ
ÛÛœÝÛÝ\˜ÙHÙˆÛÝ\˜Ù\ÊHÂˆ›Üˆ
ÛÛœÝÙ^HÙˆ™Y›XÝ›ÝÛ’Ù^\ÊÛÝ\˜ÙJJHÂˆYˆ
Øš™XÝœ›ÝÝ\Kœ›Ü\R\Ñ[[Y\˜X›K˜Ø[
ÛÝ\˜ÙKÙ^JJHÂˆ\ÜÚYÛ”›Ü
\™Ù]Ù^KÛÝ\˜ÙVÚÙ^WJNÂˆBˆBˆBˆ™]\›ˆ\™Ù]ÂŸB‹ËÈ[˜Ý[Ûˆ[š]X[^™PÛÛ^^[™ÈØÚ[X\Ë‰›Ù\OŠ[œ]Îˆ”ÓÓ”ØÚ[XQÙ[™\˜]Ü”\˜[\ÏŠNˆÒ”ÓÓ”ØÚ[XPÛÛ^ˆÂ‹ËÈ™]\›ˆÂ‹ËÈ›ØÙ\ÜÛÜŽˆ[œ]Ëœ›ØÙ\ÜÛÜ‹‹ËÈY]Y]T™YÚ\ÝžNˆ[œ]Ë›Y]Y]HÏÈÛØ˜[™YÚ\ÝžK‹ËÈ\™Ù]ˆ[œ]Ë\™Ù]ÏÈ™˜YLŒŒLLˆ‹‹ËÈ[œ™\™\Ù[X›Nˆ[œ]Ë[œ™\™\Ù[X›HÏÈ›ÝÈ‹‹ËÈNÂ‹ËÈB™[˜Ý[Ûˆ[š]X[^™PÛÛ^
\˜[\ÊHÂˆËÈ›Ü›X[^™H\™Ù]ˆÛÛ™\Û›Û‹Z\[˜]Y™\œÚ[ÛœÈÈ\[˜]Y™\œÚ[ÛœÂˆ]\™Ù]H\˜[\ÏË\™Ù]ÏÈ™˜YLŒŒLLˆŽÂˆYˆ
\™Ù]OOH™˜YMŠBˆ\™Ù]H™˜YLŽÂˆYˆ
\™Ù]OOH™˜YMÈŠBˆ\™Ù]H™˜YLÈŽÂˆ™]\›ˆÂˆ›ØÙ\ÜÛÜœÎˆ\˜[\Ëœ›ØÙ\ÜÛÜœÈÏÈßKˆY]Y]T™YÚ\ÝžNˆ\˜[\ÏË›Y]Y]HÏÈÛØ˜[™YÚ\ÝžKˆ\™Ù]ˆ[œ™\™\Ù[X›Nˆ\˜[\ÏË[œ™\™\Ù[X›HÏÈ›ÝÈ‹ˆÝ™\œšYNˆ\˜[\ÏË›Ý™\œšYHÏÈ


HOˆÈJKˆ[Îˆ\˜[\ÏËš[ÈÏÈ›Ý]]‹ˆÛÝ[\ŽˆˆÙY[Žˆ™]ÈX\

KˆÚ\™YYœÑ^˜XÝY›ÜŽˆ[™Yš[™YˆÚ\™Y[Z]Û™Q›ÜŽˆ[™Yš[™YˆÞXÛ\Îˆ\˜[\ÏË˜ÞXÛ\ÈÏÈœ™Yˆ‹ˆ™]\ÙYˆ\˜[\ÏËœ™]\ÙYÏÈš[›[™H‹ˆ[\œÙXÝ[ÛœÎˆ×KˆY™\œ™Yˆ×Kˆ^\›˜[ˆ\˜[\ÏË™^\›˜[ÏÈ[™Yš[™YˆNÂŸB‹ÊŠ‚ˆ
ˆ\Y\ÈH[œ™\™\Ù[X›XÙ][™È]HÚ]H]\È›È”ÓÓˆØÚ[XH\]Z]˜[[ˆ›ÝÜÂˆ
ˆY\ÜØYÙX[›\ÜÈHÙ][™È
ÜˆH[™\‰ÜÈ™]\›ˆ˜[YJHØ^\ÈÝ\Ú\ÙKˆ™]\›œÈYXYˆBˆ
ˆÝ\ÝÛH”ÓÓˆØÚ[XHØ\ÈÜš][ˆ[ÈœÛÛ˜[ˆÚXÚØ\ÙHHØ[\ˆ]\Ý›ÝÜš]H]ÈÝÛ‹‚ˆ
‹Â™[˜Ý[Ûˆ[™U[œ™\™\Ù[X›JØÚ[XKÝœÛÛ‹\˜[\ËY\ÜØYÙJHÂˆÛÛœÝ™\Ý[H\[ÙˆÝ[œ™\™\Ù[X›HOOH™[˜Ý[Ûˆ‚ˆÈÝ[œ™\™\Ù[X›JÈ›ÙØÚ[XNˆØÚ[XK]ˆ\˜[\Ëœ]Y\ÜØYÙHJBˆˆÝ[œ™\™\Ù[X›NÂˆYˆ
™\Ý[OOH˜[žHŠBˆ™]\›ˆ˜[ÙNÂˆYˆ
™\Ý[OOH[™Yš[™Y™\Ý[OOH›ÝÈŠBˆ›ÝÈ™]È\œ›ÜŠY\ÜØYÙJNÂˆØš™XÝ˜\ÜÚYÛŠœÛÛ‹™\Ý[
NÂˆ™]\›ˆYNÂŸB‹ËÈ™]™\ˆ™[˜[YH\È˜XÚÈÈ›ØÙ\ÜØˆ[™\ˆÛYš[È[š™XÝHÜ[]™[ÛÛœÝ›ØÙ\ÜØ]H^XØ[XÛ\˜][ÛˆÙˆHØ[YH˜[YHÛÛY\ÈÚ]
ÍŒÎMÊB™[˜Ý[Ûˆ›ØÙ\ÜÔØÚ[XJØÚ[XKÝÜ\˜[\ÈHÈ]ˆ×KØÚ[XT]ˆ×HJHÂˆ˜\ˆØNÂˆÛÛœÝYˆHØÚ[XK—Þ›Ù™YŽÂˆËÈÚXÚÈ›ÜˆØÚ[XH[ˆÙY[œÂˆÛÛœÝÙY[ˆHÝœÙY[‹™Ù]
ØÚ[XJNÂˆYˆ
ÙY[ŠHÂˆÙY[‹˜ÛÝ[
ÊÎÂˆËÈÚXÚÈYˆÞXÛBˆÛÛœÝ\ÐÞXÛHHÜ\˜[\ËœØÚ[XT]š[˜ÛY\ÊØÚ[XJNÂˆYˆ
\ÐÞXÛJHÂˆÙY[‹˜ÞXÛHHÜ\˜[\Ëœ]ÂˆBˆ™]\›ˆÙY[‹œØÚ[XNÂˆBˆËÈ[š]X[^™BˆÛÛœÝ™\Ý[HÈØÚ[XNˆßKÛÝ[ˆKÞXÛNˆ[™Yš[™Y]ˆÜ\˜[\Ëœ]NÂˆÝœÙY[‹œÙ]
ØÚ[XK™\Ý[
NÂˆÝœÚ\™YYœÑ^˜XÝY›ÜˆH[™Yš[™YÂˆÝœÚ\™Y[Z]Û™Q›ÜˆH[™Yš[™YÂˆËÈÝ\ÝÛHY]ÙÝ™\œšY\ÈY˜][™Z]š[Ü‚ˆÛÛœÝÝ™\œšYTØÚ[XHHØÚ[XK—Þ›ÙÒ”ÓÓ”ØÚ[XOËŠ
NÂˆYˆ
Ý™\œšYTØÚ[XJHÂˆ™\Ý[œØÚ[XHHÝ™\œšYTØÚ[XNÂˆBˆ[ÙHÂˆÛÛœÝ\˜[\ÈHÂˆ‹‹—Ü\˜[\ËˆØÚ[XT]ˆË‹‹—Ü\˜[\ËœØÚ[XT]ØÚ[XWKˆ]ˆÜ\˜[\Ëœ]ˆNÂˆYˆ
ØÚ[XK—Þ›Ùœ›ØÙ\ÜÒ”ÓÓ”ØÚ[XJHÂˆØÚ[XK—Þ›Ùœ›ØÙ\ÜÒ”ÓÓ”ØÚ[XJÝ™\Ý[œØÚ[XK\˜[\ÊNÂˆBˆ[ÙHÂˆÛÛœÝÚœÛÛˆH™\Ý[œØÚ[XNÂˆÛÛœÝ›ØÙ\ÜÛÜˆHÝœ›ØÙ\ÜÛÜœÖÙY‹\WNÂˆYˆ
\›ØÙ\ÜÛÜŠHÂˆ›ÝÈ™]È\œ›ÜŠÝÒ”ÓÓ”ØÚ[XWNˆ›Û‹\™\™\Ù[X›H\H[˜ÛÝ[\™Yˆ	ÙY‹\_X
NÂˆBˆ›ØÙ\ÜÛÜŠØÚ[XKÝÚœÛÛ‹\˜[\ÊNÂˆBˆÛÛœÝ\™[HØÚ[XK—Þ›Ùœ\™[ÂˆYˆ
\™[
HÂˆËÈ[ÛÈÙ]™YˆYˆ›ØÙ\ÜÛÜˆY‰Ý
›Üˆ[š\š][˜ÙJBˆYˆ
\™\Ý[œ™YŠBˆ™\Ý[œ™YˆH\™[Âˆ›ØÙ\ÜÔØÚ[XJ\™[Ý\˜[\ÊNÂˆÝœÙY[‹™Ù]
\™[
Kš\Ô\™[HYNÂˆBˆBˆËÈY]Y]BˆÛÛœÝY]HHÝ›Y]Y]T™YÚ\ÝžK™Ù]
ØÚ[XJNÂˆYˆ
Y]JBˆ\ÜÚYÛ”›ÜÊ™\Ý[œØÚ[XKY]JNÂˆYˆ
Ýš[ÈOOHš[œ]ˆ	‰ˆ\Õ˜[œÙ›Ü›Z[™ÊØÚ[XJJHÂˆËÈ^[\\ËÙY˜][ÈÛ›H\HÈÝ]]\HÙˆ\Bˆ[]H™\Ý[œØÚ[XK™^[\\ÎÂˆ[]H™\Ý[œØÚ[XK™Y˜][ÂˆBˆËÈÙ]™Y˜][\ÈY˜][ˆYˆ
Ýš[ÈOOHš[œ]ˆ	‰ˆ—Ü™Y˜][ˆ[ˆ™\Ý[œØÚ[XJBˆ
ØHH™\Ý[œØÚ[XJK™Y˜][ÏÈ
ØK™Y˜][H™\Ý[œØÚ[XK—Ü™Y˜][
NÂˆ[]H™\Ý[œØÚ[XK—Ü™Y˜][ÂˆËÈ[[™Èœ™\Úœ›ÛHÝœÙY[ˆ[ˆØ\ÙH]Ø\ÈÝ™\Üš][‚ˆÛÛœÝÜ™\Ý[HÝœÙY[‹™Ù]
ØÚ[XJNÂˆ™]\›ˆÜ™\Ý[œØÚ[XNÂŸB‹ËÈ\ØØ\HH™Y™\™[˜ÙHÚÙ[ˆ›Üˆ\ÙH[ˆH”ÓÓˆÚ[\ˆœ˜YÛY[
‘ÈŽLJNˆ˜™XÛÛY\ÈŒ[™Ø™XÛÛY\ÈŒXˆH˜™\XÙ[Y[]\Ý[ˆš\œÝ‚™[˜Ý[Ûˆ[˜ÛÙR”ÓÓ”Ú[\”ÙYÛY[
ÙYÛY[
HÂˆ™]\›ˆÙYÛY[œ™\XÙJß‹ÙËŸŒŠKœ™\XÙJ×ËÙËŸŒHŠNÂŸB™[˜Ý[Ûˆ^˜XÝYœÊÝØÚ[XB‹ËÈ\˜[\Îˆ[Z]\˜[\ÂŠHÂˆËÈ]\˜]HÝ™\ˆÙY[ˆX\ÂˆÛÛœÝ›ÛÝHÝœÙY[‹™Ù]
ØÚ[XJNÂˆYˆ
\›ÛÝ
Bˆ›ÝÈ™]È\œ›ÜŠ•[œ›ØÙ\ÜÙYØÚ[XKˆ\È\ÈHYÈ[ˆ›ÙˆŠNÂˆËÈÚ]^\›˜[Ù]]™\žH™YÚ\Ý\™YØÚ[XH™\ÛÛ™\È›ÝYÚH^\›˜[œ˜[˜ÚÙˆXZÙUT’XÛÈH›ÛÝœ˜[˜Ú™[ÝÈ›ÙXÙ\ÈHØ[YH™YˆH^\›˜[œ˜[˜ÚÛÝ[8 %\È\ÜÈ\ÈY[XØ[ÚXÚ]™\ˆØÚ[XH]\ÈØ[YÚ][™Û›H™YYÈÈ[ˆÛ˜ÙK‚ˆYˆ
Ý™^\›˜[	‰ˆÝœÚ\™YYœÑ^˜XÝY›ÜˆOOHÝ™^\›˜[
Bˆ™]\›ŽÂˆËÈ˜XÚÈYÈÈ]XÝ\XØ]\ÈXÜ›ÜÜÈY™™\™[ØÚ[X\ÂˆÛÛœÝYÔØÚ[XHH™]ÈX\

NÂˆ›Üˆ
ÛÛœÝ[žHÙˆÝœÙY[‹™[šY\Ê
JHÂˆÛÛœÝYHÝ›Y]Y]T™YÚ\ÝžK™Ù]
[žVÌJOËšYÂˆYˆ
Y
HÂˆÛÛœÝ^\Ý[™ÈHYÔØÚ[XK™Ù]
Y
NÂˆYˆ
^\Ý[™È	‰ˆ^\Ý[™ÈOOH[žVÌJHÂˆ›ÝÈ™]È\œ›ÜŠ\XØ]HØÚ[XHY‰ÚYHˆ]XÝY\š[™È”ÓÓˆØÚ[XHÛÛ™\œÚ[Û‹ˆÛÈY™™\™[ØÚ[X\ÈØ[››ÝÚ\™HHØ[YHYÚ[ˆÛÛ™\YÙÙ]\‹˜
NÂˆBˆYÔØÚ[XKœÙ]
Y[žVÌJNÂˆBˆBˆËÈ™]\›œÈH™YˆÈHØÚ[XHY’YÚ[™H[\HYˆH™YˆÚ[ÈÈ[ˆ^\›˜[ØÚ[XH
ÜˆÊBˆÛÛœÝXZÙUT’HH
[žJHOˆÂˆËÈÛÛ\\š[™ÈHÙY[ˆØš™XÝÈ™XØ]\ÙHÛÛY][Y\È][\HØÚ[X\ÈX\ÈHØ[YHÙY[ˆØš™XÝˆK™Ëˆ^žBˆËÈ^\›˜[\ÈÛÛ™šYÝ\™YˆÛÛœÝYœÔÙYÛY[HÝ\™Ù]OOH™˜YLŒŒLLˆˆÈ‰YœÈˆˆ™Yš[š][ÛœÈŽÂˆYˆ
Ý™^\›˜[
HÂˆÛÛœÝ^\›˜[YHÝ™^\›˜[œ™YÚ\ÝžK™Ù]
[žVÌJOËšYÈËÈÏÈ—×ÜÚ\™YŽËËÈ×ÜØÚ[XIØÝ˜ÛÝ[\ŠÊßXÂˆËÈÚXÚÈYˆØÚ[XH\È[ˆH^\›˜[™YÚ\ÝžBˆÛÛœÝ\šQÙ[™\˜]ÜˆHÝ™^\›˜[\šHÏÈ

Y
HOˆY
NÂˆYˆ
^\›˜[Y
HÂˆ™]\›ˆÈ™YŽˆ\šQÙ[™\˜]ÜŠ^\›˜[Y
HNÂˆBˆËÈÝ\Ú\ÙKYÈ×ÜÚ\™YˆÛÛœÝYH[žVÌWK™Y’YÏÈ[žVÌWKœØÚ[XKšYÏÈØÚ[XIØÝ˜ÛÝ[\ŠÊßXÂˆ[žVÌWK™Y’YHYÈËÈÙ]Y’YÛÈ]Ú[™H™]\ÙYYˆ™YYYˆ™]\›ˆÈY’YˆY™YŽˆ	Ý\šQÙ[™\˜]ÜŠ—×ÜÚ\™YŠ_HËÉÙYœÔÙYÛY[KÉÙ[˜ÛÙR”ÓÓ”Ú[\”ÙYÛY[
Y
_XNÂˆBˆÛÛœÝ\šT™Yš^HØÂˆÛÛœÝY•\šT™Yš^H	Ý\šT™Yš^KÉÙYœÔÙYÛY[KØÂˆËÈ[ˆY[\ÜÈ›ÛÝ\È›ÝÚ\™HÈ™H^˜XÝYËÛÈ]Ý^\È[›[™H[™Ù[‹\™Y™\™[˜Ù\È\ÈØˆYˆ
[žVÌWHOOH›ÛÝ	‰ˆY[žVÌWKœØÚ[XKšY
HÂˆ™]\›ˆÈ™YŽˆ\šT™Yš^NÂˆBˆËÈÙ[‹XÛÛZ[™YØÚ[XBˆÛÛœÝY’YH[žVÌWKœØÚ[XKšYÏÈ×ÜØÚ[XIØÝ˜ÛÝ[\ŠÊßXÂˆ™]\›ˆÈY’Y™YŽˆY•\šT™Yš^
È[˜ÛÙR”ÓÓ”Ú[\”ÙYÛY[
Y’Y
HNÂˆNÂˆËÈÝÜ™YØXÚY™\œÚ[Ûˆ[ˆY˜›Ü\H™[[Ý™H[›Ü\Y\ËÙ]	™Y‚ˆÛÛœÝ^˜XÝÑYˆH
[žJHOˆÂˆËÈYˆHØÚ[XH\È[™XYHH™Y™\™[˜ÙKÈ›Ý^˜XÝ]ˆYˆ
[žVÌWKœØÚ[XK‰™YŠHÂˆ™]\›ŽÂˆBˆÛÛœÝÙY[ˆH[žVÌWNÂˆÛÛœÝÈ™Y‹Y’YHHXZÙUT’J[žJNÂˆÙY[‹™YˆHÈ‹‹œÙY[‹œØÚ[XHNÂˆËÈY’YÛÛ‰Ý™HÙ]YˆHØÚ[XH\ÈH™Y™\™[˜ÙHÈ[ˆ^\›˜[ØÚ[XHÜˆYˆHØÚ[XH\ÈH›ÛÝØÚ[XBˆYˆ
Y’Y
BˆÙY[‹™Y’YHY’YÂˆËÈÚ\H]Ø^H[›Ü\Y\È^Ù\	™Y‚ˆÛÛœÝØÚ[XHHÙY[‹œØÚ[XNÂˆ›Üˆ
ÛÛœÝÙ^H[ˆØÚ[XJHÂˆ[]HØÚ[XVÚÙ^WNÂˆBˆØÚ[XK‰™YˆH™YŽÂˆNÂˆËÈ›ÝÈÛˆÞXÛ\ÂˆËÈœ™XZÈÞXÛ\ÂˆYˆ
Ý˜ÞXÛ\ÈOOH›ÝÈŠHÂˆ›Üˆ
ÛÛœÝ[žHÙˆÝœÙY[‹™[šY\Ê
JHÂˆÛÛœÝÙY[ˆH[žVÌWNÂˆYˆ
ÙY[‹˜ÞXÛJHÂˆ›ÝÈ™]È\œ›ÜŠÞXÛH]XÝYˆˆ
ÂˆËÉÜÙY[‹˜ÞXÛOËš›Ú[Š‹ÈŠ_KÏ›ÛÝ˜
Âˆ	×—”Ù]HÞXÛ\Ø\˜[Y]\ˆÈœ™Yˆ˜È™\ÛÛ™HÞXÛXØ[ØÚ[X\ÈÚ]YœË‰ÊNÂˆBˆBˆBˆËÈ^˜XÝØÚ[X\È[È	YœÂˆ›Üˆ
ÛÛœÝ[žHÙˆÝœÙY[‹™[šY\Ê
JHÂˆÛÛœÝÙY[ˆH[žVÌWNÂˆËÈÛÛ™\›ÛÝØÚ[XHÈÈ	™Y‚ˆYˆ
ØÚ[XHOOH[žVÌJHÂˆ^˜XÝÑYŠ[žJNÈËÈ\È\ÈÜXÚX[[™[™È›ÜˆH›ÛÝØÚ[XBˆÛÛ[YNÂˆBˆËÈ^˜XÝØÚ[X\È]\™H[ˆH^\›˜[™YÚ\ÝžBˆYˆ
Ý™^\›˜[
HÂˆÛÛœÝ^HÝ™^\›˜[œ™YÚ\ÝžK™Ù]
[žVÌJOËšYÂˆYˆ
ØÚ[XHOOH[žVÌH	‰ˆ^
HÂˆ^˜XÝÑYŠ[žJNÂˆÛÛ[YNÂˆBˆBˆËÈ^˜XÝØÚ[X\ÈÚ]YY]BˆÛÛœÝYHÝ›Y]Y]T™YÚ\ÝžK™Ù]
[žVÌJOËšYÂˆYˆ
Y
HÂˆ^˜XÝÑYŠ[žJNÂˆÛÛ[YNÂˆBˆËÈœ™XZÈÞXÛ\ÂˆYˆ
ÙY[‹˜ÞXÛJHÂˆËÈ[žBˆ^˜XÝÑYŠ[žJNÂˆÛÛ[YNÂˆBˆËÈ^˜XÝ™]\ÙYØÚ[X\ÂˆYˆ
ÙY[‹˜ÛÝ[ˆJHÂˆYˆ
Ýœ™]\ÙYOOHœ™YˆŠHÂˆ^˜XÝÑYŠ[žJNÂˆBˆBˆBˆYˆ
Ý™^\›˜[
BˆÝœÚ\™YYœÑ^˜XÝY›ÜˆHÝ™^\›˜[ÂŸB‹ÊŠˆ™]Üš]\È[žSÙŽˆÞÝ\Nˆ˜HŸKÝ\Nˆ˜ˆŸWXÈ\NˆÈ˜H‹˜ˆ—XÚXÚ]™\žH”ÓÓˆØÚ[XH˜Y™X]È\È\]Z]˜[[[™[ÜÝÛÛœÝ[Y\œÈ™[™\ˆ˜\ˆ™]\ˆ›ÜˆH[X›HØ\ÙKˆÛ›Hœ˜[˜Ú\È]\™HH˜\™H\H\ÜÙ\[Ûˆ]X[YžH8 %[ž][™ÈØ\œžZ[™ÈHÛÛœÝ˜Z[	™Y˜ÛÛœÝÜˆY]Y]H\ÈY[Û™Kˆ[œÈY\ˆ›][”™Y˜ÛÈHœ˜[˜Ú[ˆÝ™\œšYHXÛÜ˜]YÜˆ	YœØ^˜XÝ[Ûˆ\›™Y[ÈH	™Y˜\È›ÈÛ™Ù\ˆ˜\™H[™ÛÜœ™XÝHÝ^\È[ˆ[žSÙ˜ˆÛ™SÙ˜\È^ÛYYˆ[YÙ\˜[™[X™\˜Ý™\›\ÛÈ™^XÝHÛ™Hˆ[™˜]X\ÝÛ™Hˆ\™H›ÝHØ[YH\™KˆÜ[THËŒ\È^ÛYYˆ]È\X]\Ý™HHÚ[™ÛHÝš[™Ëˆ
‹Â™[˜Ý[ÛˆÛÛ\XÝ\U[š[ÛŠØÚ[XJHÂˆÛÛœÝÜ[ÛœÈHØÚ[XK˜[žSÙŽÂˆYˆ
P\œ˜^Kš\Ð\œ˜^JÜ[ÛœÊHÜ[ÛœË›[™ÝOOHØÚ[XK\HOOH[™Yš[™Y
Bˆ™]\›ŽÂˆÛÛœÝ\\ÈH×NÂˆ›Üˆ
ÛÛœÝÜ[ÛˆÙˆÜ[ÛœÊHÂˆYˆ
[Ü[Ûˆ\[ÙˆÜ[ÛˆOOH›Øš™XÝŠBˆ™]\›ŽÂˆËÈHœ˜[˜Ú]\È]Ù[ˆHÛÛ\XÝX›H[š[Ûˆ›ÛÈ[È\ÈÛ™H8 %™\ÝY[žSÙ˜[™H›]\X\œ˜^HØ^HHØ[YH[™ËˆÛÛ\XÝ[™È]š\œÝ[ÛÈXZÙ\ÈH™\Ý[[™\[™[ÙˆHÜ™\ˆ\È\ÜÈØ[ÜÈHÙY[ˆX\[‹‚ˆÛÛ\XÝ\U[š[ÛŠÜ[ÛŠNÂˆÛÛœÝÙ^\ÈHØš™XÝšÙ^\ÊÜ[ÛŠNÂˆYˆ
Ù^\Ë›[™ÝOOHHÙ^\ÖÌHOOH\HŠBˆ™]\›ŽÂˆÛÛœÝ\HHÜ[Û‹\NÂˆ›Üˆ
ÛÛœÝY[X™\ˆÙˆ\œ˜^Kš\Ð\œ˜^J\JHÈ\HˆÝ\WJHÂˆYˆ
\[ÙˆY[X™\ˆOOHœÝš[™ÈŠBˆ™]\›ŽÂˆYˆ
]\\Ëš[˜ÛY\ÊY[X™\ŠJBˆ\\Ëœ\Ú
Y[X™\ŠNÂˆBˆBˆ[]HØÚ[XK˜[žSÙŽÂˆËÈH\X\œ˜^H]\Ý™H›Û‹Y[\H[™[š\]YH
Y]\ØÚ[XJNÈHÚ[™ÛHY[X™\ˆ\ÈÜ[Y\ÈH˜\™HÝš[™Ë‚ˆØÚ[XK\HH\\Ë›[™ÝOOHHÈ\\ÖÌHˆ\\ÎÂŸB‹ÊŠˆÙ^]ÛÜ™È›Û[\œÙXÝ[Û˜Û›ÝÜÈÝÈÈÛÛXš[™Kˆ[ž][™È[ÙH8 %	™Y˜]\›”›Ü\Y\Øˆ
ˆ[ˆ[››Ý][ÛˆZÙH\ØÜš\[Û˜8 %XZÙ\ÈHY[X™\ˆ[™›ÛX›KÛÈHÛÛœÝ˜Z[\ÈÙ\È›Ýˆ
ˆ[™\œÝ[™X]™\ÈH[Ù˜[Û™H[œÝXYÙˆ™Z[™ÈÚ[[H›ÜYÜˆZ\Ø]šX]Yˆ
‹Â˜ÛÛœÝ“ÓP“WÒÑVTÈH™]ÈÙ]
È\H‹œ›Ü\Y\È‹œ™\]Z\™Y‹˜Y][Û˜[›Ü\Y\È—JNÂ˜ÛÛœÝS’SÓ—ÒÑVTÈHÈ›Û™SÙˆ‹˜[žSÙˆ—NÂ‹ÊŠˆHY[X™\‰ÜÈÛÛœÝ˜Z[ÛˆHÙ^H]Ù\È›ÝXÛ\™H]Ù[‹ˆHØ]Ú[Ý]\ÈÛ™NÈ˜[ÙX[ˆXœÙ[Y][Û˜[›Ü\Y\Ø[™H[\HØÚ[XHHÛÜÙHØš™XÝ[Z]ÈÝ]H›Ý[™Ëˆ
‹Â™[˜Ý[Ûˆ[™XÛ\™YÛÛœÝ˜Z[
Y[X™\ŠHÂˆÛÛœÝ^˜HHY[X™\‹˜Y][Û˜[›Ü\Y\ÎÂˆYˆ
^˜HOOH[™Yš[™Y^˜HOOH˜[ÙH\[Ùˆ^˜HOOH›Øš™XÝˆ^˜HOOH[
Bˆ™]\›ˆ[Âˆ™]\›ˆØš™XÝšÙ^\Ê^˜JK›[™ÝÈ^˜Hˆ[ÂŸB‹ÊŠˆÛÛXš[™\ÈØš™XÝY[X™\œÈ[ÈHÚ[™ÛHØš™XÝ^H\ØÜšX™HÙÙ]\‹Üˆ™]\›œÈ[Yˆ[žHÙˆ[HØ\œšY\ÈHÙ^]ÛÜ™Ý]ÚYHÐ[šÈ“ÓP“WÒÑVTßKˆ
‹Â™[˜Ý[Ûˆ›ÛØš™XÝÊY[X™\œÊHÂˆÛÛœÝØš™XÝÈH×NÂˆ›Üˆ
ÛÛœÝY[X™\ˆÙˆY[X™\œÊHÂˆËÈH›ÛÛX[ˆÝXœØÚ[XH\ÈYØ[”ÓÓˆØÚ[XH[™Ø\œšY\È›ÈÙ^]ÛÜ™ÈÈ›Û‚ˆYˆ
\[ÙˆY[X™\ˆOOH›Øš™XÝˆY[X™\‹\HOOH›Øš™XÝŠBˆ™]\›ˆ[Âˆ›Üˆ
ÛÛœÝÙ^H[ˆY[X™\ŠHÂˆYˆ
Q“ÓP“WÒÑVTËš\ÊÙ^JJBˆ™]\›ˆ[ÂˆBˆØš™XÝËœ\Ú
Y[X™\ŠNÂˆBˆÛÛœÝ›Ü\Y\ÈHßNÂˆÛÛœÝ™\]Z\™YH™]ÈÙ]

NÂˆ›Üˆ
ÛÛœÝØš™XÝÙˆØš™XÝÊHÂˆ›Üˆ
ÛÛœÝÙ^H[ˆØš™XÝœ›Ü\Y\ÊHÂˆËÈ[˜ÛÝ[™\ÜH×Ü›Ý××ØÙ^H\È[™XYH™\Ù[šXHH›ÝÝ\HÚZ[ˆ[™ÚÚ\]‚ˆYˆ
Øš™XÝœ›ÝÝ\Kš\ÓÝÛ”›Ü\K˜Ø[
›Ü\Y\ËÙ^JJBˆÛÛ[YNÂˆËÈ]™\žHY[X™\ˆÛÛœÝ˜Z[œÈ\ÈÙ^NˆHÛ™\È]XÛ\™H]Ø^HÝË[™HØ]Ú[Y[X™\ˆÛÛœÝ˜Z[œÈ]ÛÈ]™[ˆÝYÚ]Ù\È›Ý˜[YH]ˆHÙ^H\ÈÈØ]\ÙžH[Ùˆ[KÚXÚ\ÈHØ[YH[\œÙXÝ[ÛˆÛ™H]™[ÝÛ‹‚ˆÛÛœÝ\ÈH×NÂˆ›Üˆ
ÛÛœÝÝ\ˆÙˆØš™XÝÊHÂˆÛÛœÝ\HÝ\‹œ›Ü\Y\ÏË–ÚÙ^WHÏÈ[™XÛ\™YÛÛœÝ˜Z[
Ý\ŠNÂˆYˆ
\OOH[\OOH[™Yš[™Y
BˆÛÛ[YNÂˆYˆ
\\ËœÛÛYJ
ÙY[ŠHOˆ”ÓÓ‹œÝš[™ÚYžJÙY[ŠHOOH”ÓÓ‹œÝš[™ÚYžJ\
JJBˆ\Ëœ\Ú
\
NÂˆBˆÛÛœÝY\™ÙYH\Ë›[™ÝOOHBˆÈ\ÖÌBˆˆ
›ÛØš™XÝÊ\ÊHÏÈÈ[ÙŽˆ\ÈJNÂˆ\ÜÚYÛ”›Ü
›Ü\Y\ËÙ^KY\™ÙY
NÂˆBˆ›Üˆ
ÛÛœÝÙ^HÙˆØš™XÝœ™\]Z\™YÏÈ×JBˆ™\]Z\™Y˜Y
Ù^JNÂˆBˆÛÛœÝ›ÛYHÈ\Nˆ›Øš™XÝ‹›Ü\Y\ÈNÂˆYˆ
™\]Z\™YœÚ^™JBˆ›ÛYœ™\]Z\™YHË‹‹œ™\]Z\™YNÂˆËÈHÙ^H›ÈY[X™\ˆXÛ\™\È\È™Z™XÝYÛ›HÚ[ˆ]™\žHY[X™\ˆ™Z™XÝÈ]ÛÈH›Û\ÈÛÜÙYÛ›HÚ[ˆ]™\žHY[X™\ˆ\ËˆÝ\Ú\ÙH]Ø\œšY\ÈÚ]]™\ˆHØ]Ú[Y[X™\œÈ[X[™ÙˆÝXÚHÙ^K‚ˆYˆ
Øš™XÝË™]™\žJ
Øš™XÝ
HOˆØš™XÝ˜Y][Û˜[›Ü\Y\ÈOOH˜[ÙJJHÂˆ›ÛY˜Y][Û˜[›Ü\Y\ÈH˜[ÙNÂˆBˆ[ÙHÂˆÛÛœÝÛÛœÝ˜Z[ÈH×NÂˆ›Üˆ
ÛÛœÝØš™XÝÙˆØš™XÝÊHÂˆÛÛœÝÛÛœÝ˜Z[H[™XÛ\™YÛÛœÝ˜Z[
Øš™XÝ
NÂˆYˆ
ÛÛœÝ˜Z[	‰ˆXÛÛœÝ˜Z[ËœÛÛYJ
ÙY[ŠHOˆ”ÓÓ‹œÝš[™ÚYžJÙY[ŠHOOH”ÓÓ‹œÝš[™ÚYžJÛÛœÝ˜Z[
JJBˆÛÛœÝ˜Z[Ëœ\Ú
ÛÛœÝ˜Z[
NÂˆBˆYˆ
ÛÛœÝ˜Z[Ë›[™ÝOOHJBˆ›ÛY˜Y][Û˜[›Ü\Y\ÈHÛÛœÝ˜Z[ÖÌNÂˆ[ÙHYˆ
ÛÛœÝ˜Z[Ë›[™ÝˆJBˆ›ÛY˜Y][Û˜[›Ü\Y\ÈHÈ[ÙŽˆÛÛœÝ˜Z[ÈNÂˆBˆ™]\›ˆ›ÛYÂŸB‹ÊŠˆY][Û˜[›Ü\Y\Ø[ˆ[ˆ[Ù˜Y[X™\ˆÙY\ÈÛ›H]Y[X™\‰ÜÈÝÛˆ›Ü\Y\ØÛÈÛÂˆ
ˆÛÜÙYØš™XÝY[X™\œÈ™Z™XÝXXÚÝ\‰ÜÈÙ^\È[™HØÚ[XH˜[Y]\È›Ý[™Ëˆ›Ù	ÜÈ\œÙ\‚ˆ
ˆÛÛÈHÙ^HÙ]È[œÝXY8 %[™R[\œÙXÝ[Û”™\Ý[Ø™\ÜÈHÙ^H\È[œ™XÛÙÛš^™YÛ›HÚ[‚ˆ
ˆ
™]™\žJˆÚYH™Z™XÝÈ]8 %ÛÈH[Z]YØÚ[XH\ÈÈÛÛ[HÛË[™›Û[™ÈHY[X™\œÂˆ
ˆ[ÈÛ™HØš™XÝ\ÈH[˜ÛÙ[™È]Ø^\ÈÛÈÛˆ]™\žH\™Ù]‚ˆ
‚ˆ
ˆ\È[œÈœ›ÛHš[˜[^™XY\ˆ^˜XÝYœØÚXÚ\ÈÚ]ÙY\È]ÛX\ˆÙˆH	™Y˜ˆ
ˆXXÚ[™\žNˆHY[X™\ˆ^˜XÝY[È	YœØ\È[™XYHH	™Y˜žH›ÝÈ[™XÛ[™\ÈÈ›ÛÛÈ]ˆ
ˆÙY\È]È™Y™\™[˜ÙH[™]ÈÝÛˆÛÜÙY™\ÜÈ˜]\ˆ[ˆ™Z[™È[›[™Y\ÈHÝ[HÛÜKˆ
‹Â™[˜Ý[Ûˆ›Û[\œÙXÝ[ÛŠœÛÛŠHÂˆÛÛœÝ[ÙˆHœÛÛ‹˜[ÙŽÂˆYˆ
P\œ˜^Kš\Ð\œ˜^J[ÙŠH[Ù‹›[™ÝŠBˆ™]\›ŽÂˆËÈ[ˆÝ™\œšYX[œÈ™Y›Ü™H\È\ÜÈ[™X^H]™HÜš][ˆØš™XÝÙ^]ÛÜ™ÈÛÈH[\œÙXÝ[Ûˆ]Ù[‹ˆÜÙH\™H[X™\˜]KÛÈXÛ[™H˜]\ˆ[ˆÝ™\Üš]H[K‚ˆ›Üˆ
ÛÛœÝÙ^HÙˆ“ÓP“WÒÑVTÊBˆYˆ
Ù^H[ˆœÛÛŠBˆ™]\›ŽÂˆËÈ[ˆ[\œÙXÝ[Ûˆ\ÝšX]\ÈÝ™\ˆH[š[ÛŽˆH	ˆ
JX\È
H	ˆ
H
H	ˆJXˆÛ›HHš\œÝ[š[Ûˆ\È\ÝšX]YÝ™\ŽÈHÙXÛÛ™Û™HÝ^\È[[Û™ÈHY[X™\œÈ]™\žHœ˜[˜Ú›ÛÈYØZ[œÝÚ\™H]˜Z[ÈHØš™XÝÚXÚÈ[™XÛ[™\ÈHÚÛH[\œÙXÝ[Ûˆ˜]\ˆ[ˆ][\Z[™ÈÝ]‚ˆÛÛœÝ[š[ÛœÈH[Ù‹™š[\Š
JHOˆS’SÓ—ÒÑVTËœÛÛYJ
ÊHOˆ\œ˜^Kš\Ð\œ˜^JVÚ×JJJNÂˆ]›ÛYH[ÂˆYˆ
][š[ÛœË›[™Ý
HÂˆ›ÛYH›ÛØš™XÝÊ[ÙŠNÂˆBˆ[ÙHÂˆÛÛœÝ[š[ÛˆH[š[ÛœÖÌNÂˆÛÛœÝÙ^]ÛÜ™HS’SÓ—ÒÑVTË™š[™

ÊHOˆ\œ˜^Kš\Ð\œ˜^J[š[Û–Ú×JJNÂˆYˆ
Øš™XÝšÙ^\Ê[š[ÛŠK›[™ÝOOHJBˆ™]\›ŽÂˆÛÛœÝ™\ÝH[Ù‹™š[\Š
JHOˆHOOH[š[ÛŠNÂˆÛÛœÝœ˜[˜Ú\ÈH[š[Û–ÚÙ^]ÛÜ™K›X\

œ˜[˜Ú
HOˆ›ÛØš™XÝÊË‹‹œ™\Ýœ˜[˜ÚJJNÂˆYˆ
œ˜[˜Ú\ËœÛÛYJ
ŠHOˆXŠJBˆ™]\›ŽÂˆ›ÛYHÈÚÙ^]ÛÜ™Nˆœ˜[˜Ú\ÈNÂˆBˆYˆ
Y›ÛY
Bˆ™]\›ŽÂˆ[]HœÛÛ‹˜[ÙŽÂˆ\ÜÚYÛ”›ÜÊœÛÛ‹›ÛY
NÂŸB™[˜Ý[Ûˆš[˜[^™JÝØÚ[XJHÂˆÛÛœÝ›ÛÝHÝœÙY[‹™Ù]
ØÚ[XJNÂˆYˆ
\›ÛÝ
Bˆ›ÝÈ™]È\œ›ÜŠ•[œ›ØÙ\ÜÙYØÚ[XKˆ\È\ÈHYÈ[ˆ›ÙˆŠNÂˆËÈ›][ˆ™YœÈH[š\š]›Ü\Y\Èœ›ÛH\™[ØÚ[X\ÂˆÛÛœÝ›][”™YˆH
›ÙØÚ[XJHOˆÂˆÛÛœÝÙY[ˆHÝœÙY[‹™Ù]
›ÙØÚ[XJNÂˆËÈ[™XYH›ØÙ\ÜÙYˆYˆ
ÙY[‹œ™YˆOOH[
Bˆ™]\›ŽÂˆÛÛœÝØÚ[XHHÙY[‹™YˆÏÈÙY[‹œØÚ[XNÂˆÛÛœÝØØXÚYHÈ‹‹œØÚ[XHNÂˆÛÛœÝ™YˆHÙY[‹œ™YŽÂˆÙY[‹œ™YˆH[ÈËÈ™]™[[™š[š]H™XÝ\œÚ[Û‚ˆYˆ
™YŠHÂˆ›][”™YŠ™YŠNÂˆÛÛœÝ™Y”ÙY[ˆHÝœÙY[‹™Ù]
™YŠNÂˆÛÛœÝ™Y”ØÚ[XHH™Y”ÙY[‹œØÚ[XNÂˆËÈY\™ÙH™Y™\™[˜ÙYØÚ[XH[ÈÝ\œ™[ˆYˆ
™Y”ØÚ[XK‰™Yˆ	‰ˆ
Ý\™Ù]OOH™˜YLÈˆÝ\™Ù]OOH™˜YLˆÝ\™Ù]OOH›Ü[˜\KLËŒŠJHÂˆËÈÛ\ˆ˜YÈØ[‰ÝÛÛXš[™H	™YˆÚ]Ý\ˆ›Ü\Y\ÂˆØÚ[XK˜[ÙˆHØÚ[XK˜[ÙˆÏÈ×NÂˆØÚ[XK˜[Ù‹œ\Ú
™Y”ØÚ[XJNÂˆBˆ[ÙHÂˆ\ÜÚYÛ”›ÜÊØÚ[XK™Y”ØÚ[XJNÂˆBˆËÈ™\ÝÜ™HÚ[	ÜÈÝÛˆ›Ü\Y\È
Ú[Ú[œÊBˆ\ÜÚYÛ”›ÜÊØÚ[XKØØXÚY
NÂˆÛÛœÝ\Ô\™[™YˆH›ÙØÚ[XK—Þ›Ùœ\™[OOH™YŽÂˆËÈ›Üˆ\™[ÚZ[‹Ú[\ÈH™Yš[™[Y[H™[[Ý™H\™[[Û›H›Ü\Y\ÂˆYˆ
\Ô\™[™YŠHÂˆ›Üˆ
ÛÛœÝÙ^H[ˆØÚ[XJHÂˆYˆ
Ù^HOOH‰™YˆˆÙ^HOOH˜[ÙˆŠBˆÛÛ[YNÂˆYˆ
JÙ^H[ˆØØXÚY
JHÂˆ[]HØÚ[XVÚÙ^WNÂˆBˆBˆBˆËÈÚ[ˆ™YˆØ\È^˜XÝYÈ	YœË™[[Ý™H›Ü\Y\È]X]ÚHYš[š][Û‚ˆYˆ
™Y”ØÚ[XK‰™Yˆ	‰ˆ™Y”ÙY[‹™YŠHÂˆ›Üˆ
ÛÛœÝÙ^H[ˆØÚ[XJHÂˆYˆ
Ù^HOOH‰™YˆˆÙ^HOOH˜[ÙˆŠBˆÛÛ[YNÂˆYˆ
Ù^H[ˆ™Y”ÙY[‹™Yˆ	‰ˆ”ÓÓ‹œÝš[™ÚYžJØÚ[XVÚÙ^WJHOOH”ÓÓ‹œÝš[™ÚYžJ™Y”ÙY[‹™Y–ÚÙ^WJJHÂˆ[]HØÚ[XVÚÙ^WNÂˆBˆBˆBˆBˆËÈYˆ\™[Ø\È^˜XÝY
\È	™YŠK›ÜYØ]H	™YˆÈ\ÈØÚ[XKˆ\È[™\ÈØ\Ù\ÈZÙNˆ™XYÛ›J
K›Y]JÚYJK™\ØÜšX™J
HÚ\™H›ØÙ\ÜÛÜˆÙ]È™YˆÈ[›™\•\H]\™[ÚÝ[™H™Y™\™[˜ÙYˆÛÛœÝ\™[H›ÙØÚ[XK—Þ›Ùœ\™[ÂˆYˆ
\™[	‰ˆ\™[OOH™YŠHÂˆËÈ[œÝ\™H\™[\È›ØÙ\ÜÙYš\œÝÛÈ]ÈYˆ\È[š\š]Y›Ü\Y\Âˆ›][”™YŠ\™[
NÂˆÛÛœÝ\™[ÙY[ˆHÝœÙY[‹™Ù]
\™[
NÂˆYˆ
\™[ÙY[ËœØÚ[XK‰™YŠHÂˆØÚ[XK‰™YˆH\™[ÙY[‹œØÚ[XK‰™YŽÂˆËÈKY\XØ]HÚ]\™[	ÜÈYš[š][Û‚ˆYˆ
\™[ÙY[‹™YŠHÂˆ›Üˆ
ÛÛœÝÙ^H[ˆØÚ[XJHÂˆYˆ
Ù^HOOH‰™YˆˆÙ^HOOH˜[ÙˆŠBˆÛÛ[YNÂˆYˆ
Ù^H[ˆ\™[ÙY[‹™Yˆ	‰ˆ”ÓÓ‹œÝš[™ÚYžJØÚ[XVÚÙ^WJHOOH”ÓÓ‹œÝš[™ÚYžJ\™[ÙY[‹™Y–ÚÙ^WJJHÂˆ[]HØÚ[XVÚÙ^WNÂˆBˆBˆBˆBˆBˆËÈ^XÝ]HÝ™\œšY\ÂˆÝ›Ý™\œšYJÂˆ›ÙØÚ[XNˆ›ÙØÚ[XKˆœÛÛ”ØÚ[XNˆØÚ[XKˆ]ˆÙY[‹œ]ÏÈ×KˆJNÂˆNÂˆËÈ›][š[™ÈØ[ÜÈHÚÛHX\[™ÛX\œÈXXÚ™Y˜\È]ÛÙ\ËÛÈHÙXÛÛ™Ø[Ý™\ˆHØ[YHX\\ÈH›Ë[ÜØØ[‹ˆÚÚ\]Ý]šYÚÛ˜ÙH]\È[ˆ›ÜˆH™YÚ\ÝžHÛÛ™\œÚ[Û‹‚ˆYˆ
XÝ™^\›˜[ÝœÚ\™Y[Z]Û™Q›ÜˆOOHÝ™^\›˜[
HÂˆ›Üˆ
ÛÛœÝ[žHÙˆË‹‹˜ÝœÙY[‹™[šY\Ê
WKœ™]™\œÙJ
JHÂˆ›][”™YŠ[žVÌJNÂˆBˆYˆ
Ý\™Ù]OOH›Ü[˜\KLËŒŠHÂˆ›Üˆ
ÛÛœÝ[žHÙˆÝœÙY[‹™[šY\Ê
JHÂˆÛÛ\XÝ\U[š[ÛŠ[žVÌWK™YˆÏÈ[žVÌWKœØÚ[XJNÂˆBˆBˆ›Üˆ
ÛÛœÝ™]Üš]HÙˆÝ™Y™\œ™Y
Bˆ™]Üš]J
NÂˆËÈY\ˆ›][š[™Ë]™\žHY[X™\ˆ]Ø\È^˜XÝY\ÈH	™Y˜ÛÈH›ÛÙY\ÈHš[˜[Ú\KˆHØÚ[XH][š\š]È[ˆ[\œÙXÝ[Ûˆ8 %›ÝYÚ‹›^žXÜˆ[žH™Y˜ÚZ[ˆ8 %ÛÈHØ[YH[Ù˜\œ˜^KÛÈ›ÛžH\œ˜^HY[]HÈØ]Ú]™\žHÛÜK‚ˆYˆ
Ýš[\œÙXÝ[ÛœË›[™Ý
HÂˆÛÛœÝØ\œšY\œÈH™]ÈX\

NÂˆ›Üˆ
ÛÛœÝÙY[ˆÙˆÝœÙY[‹˜[Y\Ê
JHÂˆ›Üˆ
ÛÛœÝœÛÛˆÙˆÜÙY[‹œØÚ[XKÙY[‹™Y—JHÂˆÛÛœÝ[ÙˆHœÛÛË˜[ÙŽÂˆYˆ
P\œ˜^Kš\Ð\œ˜^J[ÙŠJBˆÛÛ[YNÂˆÛÛœÝ^\Ý[™ÈHØ\œšY\œË™Ù]
[ÙŠNÂˆYˆ
^\Ý[™ÊBˆ^\Ý[™Ëœ\Ú
œÛÛŠNÂˆ[ÙBˆØ\œšY\œËœÙ]
[Ù‹ÚœÛÛ—JNÂˆBˆBˆ›Üˆ
ÛÛœÝ[ÙˆÙˆÝš[\œÙXÝ[ÛœÊHÂˆ›Üˆ
ÛÛœÝœÛÛˆÙˆØ\œšY\œË™Ù]
[ÙŠHÏÈ×JBˆ›Û[\œÙXÝ[ÛŠœÛÛŠNÂˆBˆBˆBˆÛÛœÝ™\Ý[HßNÂˆYˆ
Ý\™Ù]OOH™˜YLŒŒLLˆŠHÂˆ™\Ý[‰ØÚ[XHHšÎ‹ËÚœÛÛ‹\ØÚ[XK›Ü™ËÙ˜YÌŒŒLL‹ÜØÚ[XHŽÂˆBˆ[ÙHYˆ
Ý\™Ù]OOH™˜YLÈŠHÂˆ™\Ý[‰ØÚ[XHHš‹ËÚœÛÛ‹\ØÚ[XK›Ü™ËÙ˜YLËÜØÚ[XHÈŽÂˆBˆ[ÙHYˆ
Ý\™Ù]OOH™˜YLŠHÂˆ™\Ý[‰ØÚ[XHHš‹ËÚœÛÛ‹\ØÚ[XK›Ü™ËÙ˜YLÜØÚ[XHÈŽÂˆBˆ[ÙHYˆ
Ý\™Ù]OOH›Ü[˜\KLËŒŠHÂˆ[ÙHÂˆYˆ
Ý™^\›˜[Ë\šJHÂˆÛÛœÝYHÝ™^\›˜[œ™YÚ\ÝžK™Ù]
ØÚ[XJOËšYÂˆYˆ
ZY
Bˆ›ÝÈ™]È\œ›ÜŠ”ØÚ[XH\ÈZ\ÜÚ[™È[ˆY›Ü\HŠNÂˆ™\Ý[‰YHÝ™^\›˜[\šJY
NÂˆBˆËÈÚ[ˆH›ÛÝØ\È^˜XÝY[È	YœË›ÛÝœØÚ[XX\ÈH	™Y˜Ü˜\\ˆ[™›ÛÝ™Y˜\ÈH›ÙH]›ÝÈ]™\È[™\ˆ	YœÂˆ\ÜÚYÛ”›ÜÊ™\Ý[›ÛÝ™Y’YÈ›ÛÝœØÚ[XHˆ
›ÛÝ™YˆÏÈ›ÛÝœØÚ[XJJNÂˆËÈHY[ˆ›Y]J
X\ÈH›Ù\ÜXÚYšXÈ™YÚ\Ý˜][ÛˆYÈ\ÙYÈ^˜XÝØÚ[X\È[È	YœÈ8 %]\È›Ý\Ù\‹Y˜XÚ[™È”ÓÓˆØÚ[XHY]Y]KˆÝš\]œ›ÛHHÝ]]›ÙHÚ\™H]ÛÝ[Ý\Ú\ÙHXZËˆHY\È™\Ù\™Y[\XÚ]HšXHH	YœÈÙ^H
[™šXH	™Yˆ]ÊK‚ˆÛÛœÝ›ÛÝY]RYHÝ›Y]Y]T™YÚ\ÝžK™Ù]
ØÚ[XJOËšYÂˆYˆ
›ÛÝY]RYOOH[™Yš[™Y	‰ˆ™\Ý[šYOOH›ÛÝY]RY
Bˆ[]H™\Ý[šYÂˆËÈZ[YœÈØš™XÝˆÚ]^\›˜[YœØ\ÈHÚ\™YØš™XÝ]™\žHØÚ[XHÜš]\È[ËÛÈHØ[YH[šY\È\™H™X\ÜÚYÛ™YÛˆ]™\žHØ[ˆÚ]Ý]]YœØ\Èœ™\Ú\ˆØ[[™]\Ý™H™XZ[‚ˆÛÛœÝYœÈHÝ™^\›˜[Ë™YœÈÏÈßNÂˆYˆ
XÝ™^\›˜[ÝœÚ\™Y[Z]Û™Q›ÜˆOOHÝ™^\›˜[
HÂˆ›Üˆ
ÛÛœÝ[žHÙˆÝœÙY[‹™[šY\Ê
JHÂˆÛÛœÝÙY[ˆH[žVÌWNÂˆYˆ
ÙY[‹™Yˆ	‰ˆÙY[‹™Y’Y
HÂˆYˆ
ÙY[‹™Y‹šYOOHÙY[‹™Y’Y
Bˆ[]HÙY[‹™Y‹šYÂˆ\ÜÚYÛ”›Ü
YœËÙY[‹™Y’YÙY[‹™YŠNÂˆBˆBˆBˆYˆ
Ý™^\›˜[
BˆÝœÚ\™Y[Z]Û™Q›ÜˆHÝ™^\›˜[ÂˆËÈÙ]Yš[š][ÛœÈ[ˆ™\Ý[ˆYˆ
Ý™^\›˜[
HÂˆ[ÙHÂˆYˆ
Øš™XÝšÙ^\ÊYœÊK›[™Ýˆ
HÂˆYˆ
Ý\™Ù]OOH™˜YLŒŒLLˆŠHÂˆ™\Ý[‰YœÈHYœÎÂˆBˆ[ÙHÂˆ™\Ý[™Yš[š][ÛœÈHYœÎÂˆBˆBˆBˆžHÂˆËÈ\È™š[˜[^™\Èˆ\ÈØÚ[XH[™[œÝ\™\È[ÞXÛ\È\™H™[[Ý™YXXÚØ[Èš[˜[^™J
H\È[˜Ý[Û˜[H[™\[™[ÝYÚHÙY[ˆX\\ÈÚ\™YˆÛÛœÝš[˜[^™YH”ÓÓ‹œ\œÙJ”ÓÓ‹œÝš[™ÚYžJ™\Ý[
JNÂˆØš™XÝ™Yš[™T›Ü\Jš[˜[^™YŸœÝ[™\™‹Âˆ˜[YNˆÂˆ‹‹œØÚ[XVÈŸœÝ[™\™—KˆœÛÛ”ØÚ[XNˆÂˆ[œ]ˆÜ™X]TÝ[™\™”ÓÓ”ØÚ[XSY]Ù
ØÚ[XKš[œ]‹Ýœ›ØÙ\ÜÛÜœÊKˆÝ]]ˆÜ™X]TÝ[™\™”ÓÓ”ØÚ[XSY]Ù
ØÚ[XK›Ý]]‹Ýœ›ØÙ\ÜÛÜœÊKˆKˆKˆ[[Y\˜X›Nˆ˜[ÙKˆÜš]X›Nˆ˜[ÙKˆJNÂˆ™]\›ˆš[˜[^™YÂˆBˆØ]Ú
Ù\œŠHÂˆ›ÝÈ™]È\œ›ÜŠ‘\œ›ÜˆÛÛ™\[™ÈØÚ[XHÈ”ÓÓ‹ˆŠNÂˆBŸB™[˜Ý[Ûˆ\Õ˜[œÙ›Ü›Z[™ÊÜØÚ[XKØÝ
HÂˆÛÛœÝÝHØÝÏÈÈÙY[Žˆ™]ÈÙ]

HNÂˆYˆ
ÝœÙY[‹š\ÊÜØÚ[XJJBˆ™]\›ˆ˜[ÙNÂˆÝœÙY[‹˜Y
ÜØÚ[XJNÂˆÛÛœÝYˆHÜØÚ[XK—Þ›Ù™YŽÂˆYˆ
Y‹\HOOH˜[œÙ›Ü›HŠBˆ™]\›ˆYNÂˆYˆ
Y‹\HOOH˜\œ˜^HŠBˆ™]\›ˆ\Õ˜[œÙ›Ü›Z[™ÊY‹™[[Y[Ý
NÂˆYˆ
Y‹\HOOHœÙ]ŠBˆ™]\›ˆ\Õ˜[œÙ›Ü›Z[™ÊY‹˜[YU\KÝ
NÂˆYˆ
Y‹\HOOH›^žHŠBˆ™]\›ˆ\Õ˜[œÙ›Ü›Z[™ÊY‹™Ù]\Š
KÝ
NÂˆYˆ
Y‹\HOOHœ›ÛZ\ÙHˆˆY‹\HOOH›Ü[Û˜[ˆˆY‹\HOOH››Û›Ü[Û˜[ˆˆY‹\HOOH›[X›HˆˆY‹\HOOHœ™XYÛ›HˆˆY‹\HOOH™Y˜][ˆˆY‹\HOOHœ™Y˜][ˆˆY‹\HOOH˜Ø]ÚŠHÂˆ™]\›ˆ\Õ˜[œÙ›Ü›Z[™ÊY‹š[›™\•\KÝ
NÂˆBˆYˆ
Y‹\HOOHš[\œÙXÝ[ÛˆŠHÂˆ™]\›ˆ\Õ˜[œÙ›Ü›Z[™ÊY‹›YÝ
H\Õ˜[œÙ›Ü›Z[™ÊY‹œšYÚÝ
NÂˆBˆYˆ
Y‹\HOOHœ™XÛÜ™ˆY‹\HOOH›X\ŠHÂˆ™]\›ˆ\Õ˜[œÙ›Ü›Z[™ÊY‹šÙ^U\KÝ
H\Õ˜[œÙ›Ü›Z[™ÊY‹˜[YU\KÝ
NÂˆBˆYˆ
Y‹\HOOHœ\HŠHÂˆYˆ
ÜØÚ[XK—Þ›Ù˜Z]Ëš\Ê‰›ÙÛÙXÈŠJBˆ™]\›ˆYNÂˆ™]\›ˆ\Õ˜[œÙ›Ü›Z[™ÊY‹š[‹Ý
H\Õ˜[œÙ›Ü›Z[™ÊY‹›Ý]Ý
NÂˆBˆYˆ
Y‹\HOOH›Øš™XÝŠHÂˆ›Üˆ
ÛÛœÝÙ^H[ˆY‹œÚ\JHÂˆYˆ
\Õ˜[œÙ›Ü›Z[™ÊY‹œÚ\VÚÙ^WKÝ
JBˆ™]\›ˆYNÂˆBˆ™]\›ˆ˜[ÙNÂˆBˆYˆ
Y‹\HOOH[š[ÛˆŠHÂˆ›Üˆ
ÛÛœÝÜ[ÛˆÙˆY‹›Ü[ÛœÊHÂˆYˆ
\Õ˜[œÙ›Ü›Z[™ÊÜ[Û‹Ý
JBˆ™]\›ˆYNÂˆBˆ™]\›ˆ˜[ÙNÂˆBˆYˆ
Y‹\HOOH\HŠHÂˆ›Üˆ
ÛÛœÝ][HÙˆY‹š][\ÊHÂˆYˆ
\Õ˜[œÙ›Ü›Z[™Ê][KÝ
JBˆ™]\›ˆYNÂˆBˆYˆ
Y‹œ™\Ý	‰ˆ\Õ˜[œÙ›Ü›Z[™ÊY‹œ™\ÝÝ
JBˆ™]\›ˆYNÂˆ™]\›ˆ˜[ÙNÂˆBˆ™]\›ˆ˜[ÙNÂŸB‹ÊŠ‚ˆ
ˆÜ™X]\ÈHÒ”ÓÓ”ØÚ[XHY]Ù›ÜˆHØÚ[XH[œÝ[˜ÙK‚ˆ
ˆ\È[˜Ø\Ý[]\ÈHÙÚXÈÙˆ[š]X[^š[™ÈÛÛ^›ØÙ\ÜÚ[™Ë^˜XÝ[™ÈYœË[™š[˜[^š[™Ë‚ˆ
‹Â˜ÛÛœÝÜ™X]UÒ”ÓÓ”ØÚ[XSY]ÙH
ØÚ[XK›ØÙ\ÜÛÜœÈHßJHOˆ
\˜[\ÊHOˆÂˆÛÛœÝÝH[š]X[^™PÛÛ^
È‹‹œ\˜[\Ë›ØÙ\ÜÛÜœÈJNÂˆ›ØÙ\ÜÔØÚ[XJØÚ[XKÝ
NÂˆ^˜XÝYœÊÝØÚ[XJNÂˆ™]\›ˆš[˜[^™JÝØÚ[XJNÂŸNÂ˜ÛÛœÝÜ™X]TÝ[™\™”ÓÓ”ØÚ[XSY]ÙH
ØÚ[XK[Ë›ØÙ\ÜÛÜœÈHßJHOˆ
\˜[\ÊHOˆÂˆÛÛœÝÈXœ˜\žSÜ[ÛœË\™Ù]HH\˜[\ÈÏÈßNÂˆÛÛœÝÝH[š]X[^™PÛÛ^
È‹‹ŠXœ˜\žSÜ[ÛœÈÏÈßJK\™Ù][Ë›ØÙ\ÜÛÜœÈJNÂˆ›ØÙ\ÜÔØÚ[XJØÚ[XKÝ
NÂˆ^˜XÝYœÊÝØÚ[XJNÂˆ™]\›ˆš[˜[^™JÝØÚ[XJNÂŸNÂ‚˜ÛÛœÝ˜\œ›ÝÓZ[ˆH
YÙËÙ^K˜[YJHOˆÂˆYˆ
YÙÖÚÙ^WHOOH[™Yš[™Y˜[YHˆYÙÖÚÙ^WJBˆYÙÖÚÙ^WHH˜[YNÂŸNÂ˜ÛÛœÝ˜\œ›ÝÓX^H
YÙËÙ^K˜[YJHOˆÂˆYˆ
YÙÖÚÙ^WHOOH[™Yš[™Y˜[YHYÙÖÚÙ^WJBˆYÙÖÚÙ^WHH˜[YNÂŸNÂ˜ÛÛœÝ˜\œ›ÝÐ›ÝH
YÙË˜[YJHOˆÂˆ˜\œ›ÝÓZ[ŠYÙË›Z[š[][H‹˜[YJNÂˆ˜\œ›ÝÓX^
YÙË›X^[][H‹˜[YJNÂŸNÂ˜ÛÛœÝY]š\ÛÜˆH
YÙË˜[YJHOˆÂˆYÙË›][\SÙˆÏÈ
YÙË›][\SÙˆH×JNÂˆYˆ
XYÙË›][\SÙ‹š[˜ÛY\Ê˜[YJJBˆYÙË›][\SÙ‹œ\Ú
˜[YJNÂŸNÂ˜ÛÛœÝY]\›ˆH
YÙË]\›ŠHOˆÂˆYÙËœ]\›œÈÏÈ
YÙËœ]\›œÈH™]ÈÙ]

JNÂˆYÙËœ]\›œË˜Y
]\›ŠNÂŸNÂ˜ÛÛœÝ[\œÙXÝZ[YHH
YÙËZ[YJHOˆÂˆYÙË›Z[YHHYÙË›Z[YHÈYÙË›Z[YK™š[\Š
JHOˆZ[YKš[˜ÛY\ÊJJHˆË‹‹›Z[YWNÂŸNÂ‹ËÈ\Ý]Ú[œËX]Ú[™ÈH˜YÉÜÈ\ÝÜšXØ[Üš]HÜ™\ŽÈH›YÈÙY\È[ˆ[YÙ\ˆ›Ü›X]œ›ÛH™Z[™ÈÜÝÈH]\ˆ›Ø]Û™B˜ÛÛœÝÙ]›Ü›X]H
YÙË›Ü›X]
HOˆÂˆYÙË™›Ü›X]H›Ü›X]ÂˆYˆ
›Ü›X]š[˜ÛY\Êš[ŠJBˆYÙËš\Ò[HYNÂŸNÂ˜ÛÛœÝZ[ÛÛšX]ÜˆH
YÙËYŠHOˆ˜\œ›ÝÓZ[ŠYÙË›Z[š[][H‹Y‹›Z[š[][JNÂ˜ÛÛœÝX^ÛÛšX]ÜˆH
YÙËYŠHOˆ˜\œ›ÝÓX^
YÙË›X^[][H‹Y‹›X^[][JNÂ˜ÛÛœÝ›Ü›X]ÛÛšX]ÜˆH
˜[™Ù\ÊHOˆ
YÙËYŠHOˆÂˆÙ]›Ü›X]
YÙËY‹™›Ü›X]
NÂˆÛÛœÝÛZ[š[][KX^[][WHH˜[™Ù\ÖÙY‹™›Ü›X]NÂˆ˜\œ›ÝÓZ[ŠYÙË›Z[š[][H‹Z[š[][JNÂˆ˜\œ›ÝÓX^
YÙË›X^[][H‹X^[][JNÂŸNÂ˜ÛÛœÝÛÛšX]ÜœÈHÂˆÜ™X]\—Ý[Žˆ
YÙËYŠHOˆ˜\œ›ÝÓZ[ŠYÙËY‹š[˜Û\Ú]™HÈ›Z[š[][Hˆˆ™^Û\Ú]™SZ[š[][H‹Y‹˜[YJKˆ\Ü×Ý[Žˆ
YÙËYŠHOˆ˜\œ›ÝÓX^
YÙËY‹š[˜Û\Ú]™HÈ›X^[][Hˆˆ™^Û\Ú]™SX^[][H‹Y‹˜[YJKˆ][\WÛÙŽˆ
YÙËYŠHOˆY]š\ÛÜŠYÙËY‹˜[YJKˆ[X™\—Ù›Ü›X]ˆ›Ü›X]ÛÛšX]ÜŠ•SP‘T—Ñ“Ô“PUÔS‘ÑTÊKˆšYÚ[Ù›Ü›X]ˆ›Ü›X]ÛÛšX]ÜŠ’QÒS•Ñ“Ô“PUÔS‘ÑTÊKˆZ[—Û[™ÝˆZ[ÛÛšX]Ü‹ˆX^Û[™ÝˆX^ÛÛšX]Ü‹ˆ[™ÝÙ\]X[Îˆ
YÙËYŠHOˆ˜\œ›ÝÐ›Ý
YÙËY‹›[™Ý
KˆZ[—ÜÚ^™NˆZ[ÛÛšX]Ü‹ˆX^ÜÚ^™NˆX^ÛÛšX]Ü‹ˆÚ^™WÙ\]X[Îˆ
YÙËYŠHOˆ˜\œ›ÝÐ›Ý
YÙËY‹œÚ^™JKˆÝš[™×Ù›Ü›X]ˆ
YÙËYŠHOˆÂˆÙ]›Ü›X]
YÙËY‹™›Ü›X]
NÂˆYˆ
Y‹œ]\›ŠBˆY]\›ŠYÙËY‹œ]\›ŠNÂˆYˆ
Y‹™›Ü›X]OOH˜˜\ÙMˆY‹™›Ü›X]OOH˜˜\ÙM\›ŠBˆYÙË˜ÛÛ[[˜ÛÙ[™ÈHY‹™›Ü›X]ÂˆYˆ
Y‹›ØØ[Y‹œ™XÚ\Ú[ÛˆOOHLJBˆYÙË›^›Ü›X]HYNÂˆKˆZ[YWÝ\Nˆ
YÙËYŠHOˆ[\œÙXÝZ[YJYÙËY‹›Z[YJKŸNÂ™[˜Ý[ÛˆYÙÜ™YØ]PÚXÚÜÊØÚ[XJHÂˆÛÛœÝYÙÈHßNÂˆÛÛœÝYˆHØÚ[XK—Þ›Ù™YŽÂˆËÈH›Ü›X]ØÚ[XH\È]ÈÝÛˆš\œÝÚXÚËØ[YH[H\È	›Ù\H[š]ˆÛÛœÝ\ÝHØÚ[XK—Þ›Ù˜Z]Ëš\Ê‰›ÙÚXÚÈŠBˆÈÜØÚ[XK‹‹ŠY‹˜ÚXÚÜÈÏÈ×JWBˆˆ
Y‹˜ÚXÚÜÈÏÈ×JNÂˆ›Üˆ
ÛÛœÝÚÙˆ\Ý
BˆÛÛšX]ÜœÖØÚ—Þ›Ù™Y‹˜ÚXÚ×OËŠYÙËÚ—Þ›Ù™YŠNÂˆËÈ™XÛÛ˜Ú[HÚ]H˜YÈÛÈ\™\\HÛ˜]XÚÛÛšX][ÛœÈÝ[[™Èš\œÝ\\H™\ÚYYH\È™]™\ˆYÚ\ˆ[ˆH›ÛÛÈY\™Ú[™È]˜XÚÈ\ÈY[\Ý[›ÜˆÛ™H[™Y]]™H›ÜˆHÝ\‚ˆÛÛœÝ˜YÈHØÚ[XK—Þ›Ù˜˜YÎÂˆYˆ
˜YË›Z[š[][HOOH[™Yš[™Y
Bˆ˜\œ›ÝÓZ[ŠYÙË›Z[š[][H‹˜YË›Z[š[][JNÂˆYˆ
˜YË™^Û\Ú]™SZ[š[][HOOH[™Yš[™Y
Bˆ˜\œ›ÝÓZ[ŠYÙË™^Û\Ú]™SZ[š[][H‹˜YË™^Û\Ú]™SZ[š[][JNÂˆYˆ
˜YË›X^[][HOOH[™Yš[™Y
Bˆ˜\œ›ÝÓX^
YÙË›X^[][H‹˜YË›X^[][JNÂˆYˆ
˜YË™^Û\Ú]™SX^[][HOOH[™Yš[™Y
Bˆ˜\œ›ÝÓX^
YÙË™^Û\Ú]™SX^[][H‹˜YË™^Û\Ú]™SX^[][JNÂˆYˆ
˜YË›][\SÙˆOOH[™Yš[™Y
BˆY]š\ÛÜŠYÙË˜YË›][\SÙŠNÂˆYˆ
˜YË™›Ü›X]OOH[™Yš[™Y
HÂˆYÙË™›Ü›X]ÏÈ
YÙË™›Ü›X]H˜YË™›Ü›X]
NÂˆYˆ
˜YË™›Ü›X]š[˜ÛY\Êš[ŠJBˆYÙËš\Ò[HYNÂˆBˆYˆ
˜YË›Z[YJBˆ[\œÙXÝZ[YJYÙË˜YË›Z[YJNÂˆ›Üˆ
ÛÛœÝ]\›ˆÙˆ˜YËœ]\›œÈÏÈ×JBˆY]\›ŠYÙË]\›ŠNÂˆ™]\›ˆYÙÎÂŸB˜ÛÛœÝ›Ü›X]X\HÂˆÝZYˆ]ZY‹ˆ\›ˆ\šH‹ˆ]][YNˆ™]K][YH‹ˆœÛÛ—ÜÝš[™ÎˆšœÛÛ‹\Ýš[™È‹ˆ™YÙ^ˆˆ‹ËÈÈ›ÝÙ]ŸNÂ‹ËÈOOOOOOOOOOOOOOOOOOOHÒSTHTH“ÐÑTÔÓÔ”ÈOOOOOOOOOOOOOOOOOOOB‹ËÈH[[YH]\›œÈ\™H^ÛÈ\œÙH]È™]™\ˆÝ™\™›ÝÈH™YÙ^ÝXÚÎÈH[Z]YØÚ[XHÝØ\È[ˆH^XÝ›ØÚÈ›Ü›\ËÚXÚ›Ù]Ù[ˆ™]™\ˆ^XÝ]\Â˜ÛÛœÝ^XÝ]\›œÈH™]ÈX\
ÂˆØ˜\ÙMÚ\œÙ]˜\ÙMKˆØ˜\ÙM\›Ú\œÙ]˜\ÙM\›K—JNÂ˜ÛÛœÝ^XÝ]\›ˆH

HOˆ^XÝ]\›œË™Ù]

HÏÈÂ˜ÛÛœÝÝš[™Ô›ØÙ\ÜÛÜˆH
ØÚ[XKÝÚœÛÛ‹Ü\˜[\ÊHOˆÂˆÛÛœÝœÛÛˆHÚœÛÛŽÂˆœÛÛ‹\HHœÝš[™ÈŽÂˆÛÛœÝÈZ[š[][KX^[][K›Ü›X]]\›œËÛÛ[[˜ÛÙ[™Ë^›Ü›X]HHYÙÜ™YØ]PÚXÚÜÊØÚ[XJNÂˆYˆ
\[ÙˆZ[š[][HOOH›[X™\ˆŠBˆœÛÛ‹›Z[“[™ÝHZ[š[][NÂˆYˆ
\[ÙˆX^[][HOOH›[X™\ˆŠBˆœÛÛ‹›X^[™ÝHX^[][NÂˆËÈÝ\ÝÛH]\›ˆÝ™\œšY\È›Ü›X]ˆYˆ
›Ü›X]
HÂˆœÛÛ‹™›Ü›X]H›Ü›X]X\Ù›Ü›X]HÏÈ›Ü›X]ÂˆYˆ
œÛÛ‹™›Ü›X]OOHˆŠBˆ[]HœÛÛ‹™›Ü›X]ÈËÈ[\H›Ü›X]\È›Ý˜[YˆËÈ‹š\ÛË[YJ
X\È™]™\ˆ[][YK[™^›Ü›X]Ø\œšY\ÈH]][YHÚ\\È][ÛÈXØÙ\Ú]Z\ˆÙ^]ÛÜ™›Ü˜šYÂˆYˆ
›Ü›X]OOH[YHˆ^›Ü›X]
HÂˆ[]HœÛÛ‹™›Ü›X]ÂˆBˆBˆYˆ
ÛÛ[[˜ÛÙ[™ÊBˆœÛÛ‹˜ÛÛ[[˜ÛÙ[™ÈHÛÛ[[˜ÛÙ[™ÎÂˆYˆ
]\›œÈ	‰ˆ]\›œËœÚ^™Hˆ
HÂˆÛÛœÝ]\›“\ÝHË‹‹œ]\›œ×K›X\
^XÝ]\›ŠNÂˆYˆ
]\›“\Ý›[™ÝOOHJBˆœÛÛ‹œ]\›ˆH]\›“\ÝÌKœÛÝ\˜ÙNÂˆ[ÙHYˆ
]\›“\Ý›[™ÝˆJHÂˆœÛÛ‹˜[ÙˆHÂˆ‹‹œ]\›“\Ý›X\

™YÙ^
HOˆ
Âˆ‹‹ŠÝ\™Ù]OOH™˜YLÈˆÝ\™Ù]OOH™˜YLˆÝ\™Ù]OOH›Ü[˜\KLËŒ‚ˆÈÈ\NˆœÝš[™ÈˆBˆˆßJKˆ]\›Žˆ™YÙ^œÛÝ\˜ÙKˆJJKˆNÂˆBˆBŸNÂ˜ÛÛœÝ[X™\”›ØÙ\ÜÛÜˆH
ØÚ[XKÝÚœÛÛ‹\˜[\ÊHOˆÂˆÛÛœÝœÛÛˆHÚœÛÛŽÂˆÛÛœÝÈZ[š[][KX^[][K][\SÙ‹^Û\Ú]™SX^[][K^Û\Ú]™SZ[š[][K\Ò[HHYÙÜ™YØ]PÚXÚÜÊØÚ[XJNÂˆœÛÛ‹\HH\Ò[Èš[YÙ\ˆˆˆ›[X™\ˆŽÂˆËÈÚ[ˆ›ÝZ[š[][H[™^Û\Ú]™SZ[š[][H^\ÝXÚÈH[Ü™H™\ÝšXÝ]™HÛ™BˆÛÛœÝ^Z[ˆH\[Ùˆ^Û\Ú]™SZ[š[][HOOH›[X™\ˆˆ	‰ˆ^Û\Ú]™SZ[š[][HH
Z[š[][HÏÈ[X™\‹“‘QÐUU‘WÒS‘’S’UJNÂˆÛÛœÝ^X^H\[Ùˆ^Û\Ú]™SX^[][HOOH›[X™\ˆˆ	‰ˆ^Û\Ú]™SX^[][HH
X^[][HÏÈ[X™\‹”ÔÒUU‘WÒS‘’S’UJNÂˆÛÛœÝYØXÞHHÝ\™Ù]OOH™˜YLˆÝ\™Ù]OOH›Ü[˜\KLËŒŽÂˆYˆ
^Z[ŠHÂˆYˆ
YØXÞJHÂˆœÛÛ‹›Z[š[][HH^Û\Ú]™SZ[š[][NÂˆœÛÛ‹™^Û\Ú]™SZ[š[][HHYNÂˆBˆ[ÙHÂˆœÛÛ‹™^Û\Ú]™SZ[š[][HH^Û\Ú]™SZ[š[][NÂˆBˆBˆ[ÙHYˆ
\[ÙˆZ[š[][HOOH›[X™\ˆŠHÂˆœÛÛ‹›Z[š[][HHZ[š[][NÂˆBˆYˆ
^X^
HÂˆYˆ
YØXÞJHÂˆœÛÛ‹›X^[][HH^Û\Ú]™SX^[][NÂˆœÛÛ‹™^Û\Ú]™SX^[][HHYNÂˆBˆ[ÙHÂˆœÛÛ‹™^Û\Ú]™SX^[][HH^Û\Ú]™SX^[][NÂˆBˆBˆ[ÙHYˆ
\[ÙˆX^[][HOOH›[X™\ˆŠHÂˆœÛÛ‹›X^[][HHX^[][NÂˆBˆYˆ
][\SÙŠHÂˆËÈ”ÓÓˆØÚ[XH™\]Z\™\ÈH]š\ÛÜˆÝšXÝHÜ™X]\ˆ[ˆ™\›Ë[™H›Û‹Yš[š]HÛ™HÙ\È›ÝÝ\š]™H”ÓÓˆ][ˆH™YØ]]™H]š\ÛÜˆXØÙ\È^XÝHÚ]]ÈXœÛÛ]H˜[YHXØÙ\ËÛÈ]Ý[X\ÎÈ™\›Ë˜Sˆ[™[™š[š]H]™H›ÈÙ^]ÛÜ™›Ü›K‚ˆÛÛœÝ]š\ÛÜœÈH™]ÈÙ]

NÂˆ›Üˆ
ÛÛœÝ]š\ÛÜˆÙˆ][\SÙŠHÂˆYˆ
[X™\‹š\Ñš[š]J]š\ÛÜŠH	‰ˆ]š\ÛÜˆOOH
Bˆ]š\ÛÜœË˜Y
X]˜XœÊ]š\ÛÜŠJNÂˆ[ÙBˆ[™U[œ™\™\Ù[X›JØÚ[XKÝœÛÛ‹\˜[\ËH][\SÙˆ]š\ÛÜˆÙˆ	Ù]š\ÛÜŸHØ[››Ý™H™\™\Ù[Y[ˆ”ÓÓˆØÚ[XX
NÂˆBˆËÈÚZ[™Y]š\ÛÜœÈ\™HHÛÛš[˜Ý[ÛˆHÙ^]ÛÜ™Ø[››ÝØ\œžH[Û™KÛÈ^˜\ÈšYH[ˆ[Ù‹Ø[YH\ÈÝXÚÙY]\›œÂˆÛÛœÝÙš\œÝ‹‹œ™\ÝHH]š\ÛÜœÎÂˆYˆ
š\œÝOOH[™Yš[™Y
BˆœÛÛ‹›][\SÙˆHš\œÝÂˆYˆ
™\Ý›[™Ý
BˆœÛÛ‹˜[ÙˆHË‹‹ŠœÛÛ‹˜[ÙˆÏÈ×JK‹‹œ™\Ý›X\

JHOˆ
È][\SÙŽˆHJJWNÂˆBŸNÂ˜ÛÛœÝ›ÛÛX[”›ØÙ\ÜÛÜˆH
ÜØÚ[XKØÝœÛÛ‹Ü\˜[\ÊHOˆÂˆœÛÛ‹\HH˜›ÛÛX[ˆŽÂŸNÂ˜ÛÛœÝ™]™\”›ØÙ\ÜÛÜˆH
ÜØÚ[XKØÝœÛÛ‹Ü\˜[\ÊHOˆÂˆœÛÛ‹››ÝHßNÂŸNÂ˜ÛÛœÝ[žT›ØÙ\ÜÛÜˆH
ÜØÚ[XKØÝÚœÛÛ‹Ü\˜[\ÊHOˆÂˆËÈ[\HØÚ[XHXØÙ\È[ž][™ÂŸNÂ˜ÛÛœÝ[šÛ›ÝÛ”›ØÙ\ÜÛÜˆH
ÜØÚ[XKØÝÚœÛÛ‹Ü\˜[\ÊHOˆÂˆËÈ[\HØÚ[XHXØÙ\È[ž][™ÂŸNÂ˜ÛÛœÝ[[T›ØÙ\ÜÛÜˆH
ØÚ[XKØÝœÛÛ‹Ü\˜[\ÊHOˆÂˆÛÛœÝYˆHØÚ[XK—Þ›Ù™YŽÂˆÛÛœÝ˜[Y\ÈHÙ][[U˜[Y\ÊY‹™[šY\ÊNÂˆËÈ[ˆ[\H[[HXØÙ\È›Ý[™ËØ[YH\È‹›™]™\Š
BˆYˆ
˜[Y\Ë›[™ÝOOH
HÂˆœÛÛ‹››ÝHßNÂˆ™]\›ŽÂˆBˆËÈ[X™\ˆ[[\ÈØ[ˆ]™H›ÝÝš[™È[™[X™\ˆ˜[Y\ÂˆYˆ
˜[Y\Ë™]™\žJ
ŠHOˆ\[ÙˆˆOOH›[X™\ˆŠJBˆœÛÛ‹\HH›[X™\ˆŽÂˆYˆ
˜[Y\Ë™]™\žJ
ŠHOˆ\[ÙˆˆOOHœÝš[™ÈŠJBˆœÛÛ‹\HHœÝš[™ÈŽÂˆœÛÛ‹™[[HH˜[Y\ÎÂŸNÂ˜ÛÛœÝÝ\ÝÛT›ØÙ\ÜÛÜˆH
ØÚ[XKÝœÛÛ‹\˜[\ÊHOˆÂˆ[™U[œ™\™\Ù[X›JØÚ[XKÝœÛÛ‹\˜[\ËÝ\ÝÛH\\ÈØ[››Ý™H™\™\Ù[Y[ˆ”ÓÓˆØÚ[XHŠNÂŸNÂ˜ÛÛœÝ˜[œÙ›Ü›T›ØÙ\ÜÛÜˆH
ØÚ[XKÝœÛÛ‹\˜[\ÊHOˆÂˆ[™U[œ™\™\Ù[X›JØÚ[XKÝœÛÛ‹\˜[\Ë•˜[œÙ›Ü›\ÈØ[››Ý™H™\™\Ù[Y[ˆ”ÓÓˆØÚ[XHŠNÂŸNÂ‹ËÈOOOOOOOOOOOOOOOOOOOHÓÓTÔÒUHTH“ÐÑTÔÓÔ”ÈOOOOOOOOOOOOOOOOOOOB˜ÛÛœÝ\œ˜^T›ØÙ\ÜÛÜˆH
ØÚ[XKÝÚœÛÛ‹\˜[\ÊHOˆÂˆÛÛœÝœÛÛˆHÚœÛÛŽÂˆÛÛœÝYˆHØÚ[XK—Þ›Ù™YŽÂˆÛÛœÝÈZ[š[][KX^[][HHHYÙÜ™YØ]PÚXÚÜÊØÚ[XJNÂˆYˆ
\[ÙˆZ[š[][HOOH›[X™\ˆŠBˆœÛÛ‹›Z[’][\ÈHZ[š[][NÂˆYˆ
\[ÙˆX^[][HOOH›[X™\ˆŠBˆœÛÛ‹›X^][\ÈHX^[][NÂˆœÛÛ‹\HH˜\œ˜^HŽÂˆœÛÛ‹š][\ÈH›ØÙ\ÜÔØÚ[XJY‹™[[Y[ÝÂˆ‹‹œ\˜[\Ëˆ]ˆË‹‹œ\˜[\Ëœ]š][\È—KˆJNÂŸNÂ‹ËÈ˜[œÙ›Ü›H[™Ø]ÚÙ]Ü[ˆH›Ü[Û˜[˜][[YHÛÈH\œÙ\ˆ]È[HØœÙ\™H[‚‹ËÈXœÙ[Ù^K]Z\ˆXÛ\™Y[œ]\HÝ^\È™\]Z\™Yˆ[ˆ[œ]”ÓÓˆØÚ[XH\ØÜšX™\ÈB‹ËÈXÛ\™Y\KÛÈ™\ÛÛ™H\Ý[HÈHØÚ[XH]XÝX[HØ\œšY\ÈHÜ[Û˜[]K‚‹ËÈ\ÙYžH›ÝØš™XÝ›ØÙ\ÜÛÜ˜
›Üˆ™\]Z\™Y
H[™\T›ØÙ\ÜÛÜ˜
›ÜˆZ[’][\Ø
NÈÙYB‹ËÈÚZÚKÛÜ[Û˜[]K›Y•H”ÓÓˆØÚ[XH[Z]\ˆ™XYÈH
œÝ]XÊˆ˜[YH‹‚™[˜Ý[Ûˆ[œ]Ü[ŠØÚ[XJHÂˆÛÛœÝYˆHØÚ[XK—Þ›Ù™YŽÂˆYˆ
Y‹\HOOHœ\Hˆ	‰ˆY‹š[‹—Þ›Ù˜Z]Ëš\Ê‰›Ù˜[œÙ›Ü›HŠJHÂˆ™]\›ˆ[œ]Ü[ŠY‹›Ý]
NÂˆBˆYˆ
Y‹\HOOH˜Ø]ÚŠHÂˆ™]\›ˆ[œ]Ü[ŠY‹š[›™\•\JNÂˆBˆ™]\›ˆØÚ[XK—Þ›Ù›Ü[ŽÂŸB˜ÛÛœÝØš™XÝ›ØÙ\ÜÛÜˆH
ØÚ[XKÝÚœÛÛ‹\˜[\ÊHOˆÂˆÛÛœÝœÛÛˆHÚœÛÛŽÂˆÛÛœÝYˆHØÚ[XK—Þ›Ù™YŽÂˆÛÛœÝÚ\HHY‹œÚ\NÂˆËÈ›Ü[™È]Ú[HÝ[[Z][™ÈY][Û˜[›Ü\Y\Îˆ˜[ÙXÛÝ[[Z]HØÚ[XH]™Z™XÝÈ]H\ÈÛ™H™\]Z\™\ÂˆÛÛœÝÞ[X›ÛÙ^\ÈHØš™XÝ™Ù]ÝÛ”›Ü\TÞ[X›ÛÊÚ\JNÂˆYˆ
Þ[X›ÛÙ^\Ë›[™Ý	‰‚ˆ[™U[œ™\™\Ù[X›JØÚ[XKÝœÛÛ‹\˜[\Ë”Þ[X›ÛÙ^\ÈØ[››Ý™H™\™\Ù[Y[ˆ”ÓÓˆØÚ[XHŠJHÂˆ™]\›ŽÂˆBˆœÛÛ‹\HH›Øš™XÝŽÂˆœÛÛ‹œ›Ü\Y\ÈHßNÂˆ›Üˆ
ÛÛœÝÙ^H[ˆÚ\JHÂˆËÈ\ÜÚYÛ”›ÜÛÈH×Ü›Ý××ÈÙ^H™XÛÛY\È[ˆÝÛˆ›Ü\H[œÝXYÙˆ][™ÈH[š\š]YÙ]\ˆÛˆHZ[ˆßHÙHZ[[Âˆ\ÜÚYÛ”›Ü
œÛÛ‹œ›Ü\Y\ËÙ^K›ØÙ\ÜÔØÚ[XJÚ\VÚÙ^WKÝÂˆ‹‹œ\˜[\Ëˆ]ˆË‹‹œ\˜[\Ëœ]œ›Ü\Y\È‹Ù^WKˆJJNÂˆBˆËÈ™\]Z\™YÙ^\ÂˆÛÛœÝ™\]Z\™YÙ^\ÈH×NÂˆ›Üˆ
ÛÛœÝÙ^HÙˆØš™XÝšÙ^\ÊÚ\JJHÂˆÛÛœÝšY[HY‹œÚ\VÚÙ^WNÂˆYˆ
Ýš[ÈOOHš[œ]ˆÈ[œ]Ü[ŠšY[
HOOH[™Yš[™YˆšY[—Þ›Ù›ÜÝ]OOH[™Yš[™Y
HÂˆ™\]Z\™YÙ^\Ëœ\Ú
Ù^JNÂˆBˆBˆYˆ
™\]Z\™YÙ^\Ë›[™Ýˆ
HÂˆœÛÛ‹œ™\]Z\™YH™\]Z\™YÙ^\ÎÂˆBˆËÈØ]Ú[ˆYˆ
Y‹˜Ø]Ú[Ë—Þ›Ù™Y‹\HOOH›™]™\ˆŠHÂˆËÈÝšXÝˆœÛÛ‹˜Y][Û˜[›Ü\Y\ÈH˜[ÙNÂˆBˆ[ÙHYˆ
YY‹˜Ø]Ú[
HÂˆËÈ™YÝ[\‚ˆYˆ
Ýš[ÈOOH›Ý]]ŠBˆœÛÛ‹˜Y][Û˜[›Ü\Y\ÈH˜[ÙNÂˆBˆ[ÙHYˆ
Y‹˜Ø]Ú[
HÂˆœÛÛ‹˜Y][Û˜[›Ü\Y\ÈH›ØÙ\ÜÔØÚ[XJY‹˜Ø]Ú[ÝÂˆ‹‹œ\˜[\Ëˆ]ˆË‹‹œ\˜[\Ëœ]˜Y][Û˜[›Ü\Y\È—KˆJNÂˆBŸNÂ˜ÛÛœÝ[š[Û”›ØÙ\ÜÛÜˆH
ØÚ[XKÝœÛÛ‹\˜[\ÊHOˆÂˆÛÛœÝYˆHØÚ[XK—Þ›Ù™YŽÂˆËÈ^Û\Ú]™H[š[ÛœÈ
[˜Û\Ú]™HOOH˜[ÙJH\ÙHÛ™SÙˆ
^XÝHÛ™HX]Ú
H[œÝXYÙˆ[žSÙˆ
Û™HÜˆ[Ü™HX]Ú\ÊKˆ\È[˜ÛY\È›Ý‹žÜŠ
H[™\ØÜš[Z[˜]Y[š[ÛœÂˆÛÛœÝ\Ñ^Û\Ú]™HHY‹š[˜Û\Ú]™HOOH˜[ÙNÂˆÛÛœÝÜ[ÛœÈHY‹›Ü[ÛœË›X\

JHOˆ›ØÙ\ÜÔØÚ[XJÝÂˆ‹‹œ\˜[\Ëˆ]ˆË‹‹œ\˜[\Ëœ]\Ñ^Û\Ú]™HÈ›Û™SÙˆˆˆ˜[žSÙˆ‹WKˆJJNÂˆYˆ
\Ñ^Û\Ú]™JHÂˆœÛÛ‹›Û™SÙˆHÜ[ÛœÎÂˆBˆ[ÙHÂˆœÛÛ‹˜[žSÙˆHÜ[ÛœÎÂˆBŸNÂ˜ÛÛœÝ[\œÙXÝ[Û”›ØÙ\ÜÛÜˆH
ØÚ[XKÝœÛÛ‹\˜[\ÊHOˆÂˆÛÛœÝYˆHØÚ[XK—Þ›Ù™YŽÂˆÛÛœÝHH›ØÙ\ÜÔØÚ[XJY‹›YÝÂˆ‹‹œ\˜[\Ëˆ]ˆË‹‹œ\˜[\Ëœ]˜[Ùˆ‹KˆJNÂˆÛÛœÝˆH›ØÙ\ÜÔØÚ[XJY‹œšYÚÝÂˆ‹‹œ\˜[\Ëˆ]ˆË‹‹œ\˜[\Ëœ]˜[Ùˆ‹WKˆJNÂˆÛÛœÝ\ÔÚ[\R[\œÙXÝ[ÛˆH
˜[
HOˆ˜[Ùˆˆ[ˆ˜[	‰ˆØš™XÝšÙ^\Ê˜[
K›[™ÝOOHNÂˆÛÛœÝ[ÙˆHÂˆ‹‹Š\ÔÚ[\R[\œÙXÝ[ÛŠJHÈK˜[ÙˆˆØWJKˆ‹‹Š\ÔÚ[\R[\œÙXÝ[ÛŠŠHÈ‹˜[ÙˆˆØ—JKˆNÂˆœÛÛ‹˜[ÙˆH[ÙŽÂˆËÈ™XÛÜ™Y[›™\›[ÜÝš\œÝÛÈH™\ÝY[\œÙXÝ[Ûˆ\È[™XYH›ÛYžHH[YH\ÈÛ™H\ÈÛÛœÚY\™YˆH\œ˜^H\ÈH[™H˜]\ˆ[ˆHØÚ[XK™XØ]\ÙHHÜ˜\\ˆ][š\š]È\ÈØÚ[XHÚ\™\ÈHØ[YH\œ˜^NÈš[˜[^™X›ÛÈ]™\žHØš™XÝÛ[™È]ˆÙYH›Û[\œÙXÝ[Û˜‚ˆÝš[\œÙXÝ[ÛœËœ\Ú
[ÙŠNÂŸNÂ˜ÛÛœÝ[X›T›ØÙ\ÜÛÜˆH
ØÚ[XKÝœÛÛ‹\˜[\ÊHOˆÂˆÛÛœÝYˆHØÚ[XK—Þ›Ù™YŽÂˆÛÛœÝ[›™\ˆH›ØÙ\ÜÔØÚ[XJY‹š[›™\•\KÝ\˜[\ÊNÂˆÛÛœÝÙY[ˆHÝœÙY[‹™Ù]
ØÚ[XJNÂˆYˆ
Ý\™Ù]OOH›Ü[˜\KLËŒŠHÂˆÙY[‹œ™YˆHY‹š[›™\•\NÂˆœÛÛ‹›[X›HHYNÂˆBˆ[ÙHÂˆœÛÛ‹˜[žSÙˆHÚ[›™\‹È\Nˆ›[ˆWNÂˆBŸNÂ˜ÛÛœÝ›Û›Ü[Û˜[›ØÙ\ÜÛÜˆH
ØÚ[XKÝÚœÛÛ‹\˜[\ÊHOˆÂˆÛÛœÝYˆHØÚ[XK—Þ›Ù™YŽÂˆ›ØÙ\ÜÔØÚ[XJY‹š[›™\•\KÝ\˜[\ÊNÂˆÛÛœÝÙY[ˆHÝœÙY[‹™Ù]
ØÚ[XJNÂˆÙY[‹œ™YˆHY‹š[›™\•\NÂŸNÂ‹ÊŠˆ›Ý[™]š\ÈHY˜][˜[YH›ÝYÚ”ÓÓˆÛÈH[Z]YØÚ[XH\ÈÝX\˜[YYÈ™H˜[Y”ÓÓ‹‚ˆ
ˆHšYÒ[\È›È™[XX›H[˜ÛÙ[™ËÛÈ]ÛÙ\È›ÝYÚ[œ™\™\Ù[X›XZÙH[žHÝ\‚ˆ
ˆ[œ™\™\Ù[X›H˜[YKˆ™]\›œÈHÙ[[™[Ú[ˆHØ[\ˆ]\Ý›ÝÜš]HHY˜][Ùˆ]ÈÝÛ‹ˆ
‹Â˜ÛÛœÝS”‘T‘TÑS•P“WÑQUSHÞ[X›Û

NÂ™[˜Ý[ÛˆÙ\šX[^™QY˜][˜[YJ˜[YKØÚ[XKÝœÛÛ‹\˜[\ÊHÂˆ][œ™\™\Ù[X›HH˜[ÙNÂˆÛÛœÝÙ\šX[^™YH”ÓÓ‹œÝš[™ÚYžJ˜[YK
Ë˜[
HOˆÂˆYˆ
\[Ùˆ˜[OOH˜šYÚ[ŠBˆ™]\›ˆ˜[Âˆ[œ™\™\Ù[X›HHYNÂˆ™]\›ˆ[ÂˆJNÂˆYˆ
][œ™\™\Ù[X›JBˆ™]\›ˆ”ÓÓ‹œ\œÙJÙ\šX[^™Y
NÂˆ[™U[œ™\™\Ù[X›JØÚ[XKÝœÛÛ‹\˜[\ËšYÒ[Y˜][ÈØ[››Ý™H™\™\Ù[Y[ˆ”ÓÓˆØÚ[XHŠNÂˆ™]\›ˆS”‘T‘TÑS•P“WÑQUSÂŸB˜ÛÛœÝY˜][›ØÙ\ÜÛÜˆH
ØÚ[XKÝœÛÛ‹\˜[\ÊHOˆÂˆÛÛœÝYˆHØÚ[XK—Þ›Ù™YŽÂˆ›ØÙ\ÜÔØÚ[XJY‹š[›™\•\KÝ\˜[\ÊNÂˆÛÛœÝÙY[ˆHÝœÙY[‹™Ù]
ØÚ[XJNÂˆÙY[‹œ™YˆHY‹š[›™\•\NÂˆÛÛœÝ˜[YHHÙ\šX[^™QY˜][˜[YJY‹™Y˜][˜[YKØÚ[XKÝœÛÛ‹\˜[\ÊNÂˆYˆ
˜[YHOOHS”‘T‘TÑS•P“WÑQUS
BˆœÛÛ‹™Y˜][H˜[YNÂŸNÂ˜ÛÛœÝ™Y˜][›ØÙ\ÜÛÜˆH
ØÚ[XKÝœÛÛ‹\˜[\ÊHOˆÂˆÛÛœÝYˆHØÚ[XK—Þ›Ù™YŽÂˆ›ØÙ\ÜÔØÚ[XJY‹š[›™\•\KÝ\˜[\ÊNÂˆÛÛœÝÙY[ˆHÝœÙY[‹™Ù]
ØÚ[XJNÂˆÙY[‹œ™YˆHY‹š[›™\•\NÂˆYˆ
Ýš[ÈOOHš[œ]ŠBˆ™]\›ŽÂˆÛÛœÝ˜[YHHÙ\šX[^™QY˜][˜[YJY‹™Y˜][˜[YKØÚ[XKÝœÛÛ‹\˜[\ÊNÂˆYˆ
˜[YHOOHS”‘T‘TÑS•P“WÑQUS
BˆœÛÛ‹—Ü™Y˜][H˜[YNÂŸNÂ˜ÛÛœÝØ]Ú›ØÙ\ÜÛÜˆH
ØÚ[XKÝœÛÛ‹\˜[\ÊHOˆÂˆÛÛœÝYˆHØÚ[XK—Þ›Ù™YŽÂˆ›ØÙ\ÜÔØÚ[XJY‹š[›™\•\KÝ\˜[\ÊNÂˆÛÛœÝÙY[ˆHÝœÙY[‹™Ù]
ØÚ[XJNÂˆÙY[‹œ™YˆHY‹š[›™\•\NÂˆ]Ø]Ú˜[YNÂˆžHÂˆØ]Ú˜[YHHY‹˜Ø]Ú˜[YJ[™Yš[™Y
NÂˆBˆØ]ÚÂˆ[™U[œ™\™\Ù[X›JØÚ[XKÝœÛÛ‹\˜[\Ë‘[˜[ZXÈØ]Ú˜[Y\È\™H›ÝÝ\ÜY[ˆ”ÓÓˆØÚ[XHŠNÂˆ™]\›ŽÂˆBˆœÛÛ‹™Y˜][HØ]Ú˜[YNÂŸNÂ˜ÛÛœÝ\T›ØÙ\ÜÛÜˆH
ØÚ[XKÝÚœÛÛ‹\˜[\ÊHOˆÂˆÛÛœÝYˆHØÚ[XK—Þ›Ù™YŽÂˆÛÛœÝ[’\Õ˜[œÙ›Ü›HHY‹š[‹—Þ›Ù˜Z]Ëš\Ê‰›Ù˜[œÙ›Ü›HŠNÂˆÛÛœÝ[›™\•\HHÝš[ÈOOHš[œ]ˆÈ
[’\Õ˜[œÙ›Ü›HÈY‹›Ý]ˆY‹š[ŠHˆY‹›Ý]Âˆ›ØÙ\ÜÔØÚ[XJ[›™\•\KÝ\˜[\ÊNÂˆÛÛœÝÙY[ˆHÝœÙY[‹™Ù]
ØÚ[XJNÂˆÙY[‹œ™YˆH[›™\•\NÂŸNÂ˜ÛÛœÝ™XYÛ›T›ØÙ\ÜÛÜˆH
ØÚ[XKÝœÛÛ‹\˜[\ÊHOˆÂˆÛÛœÝYˆHØÚ[XK—Þ›Ù™YŽÂˆ›ØÙ\ÜÔØÚ[XJY‹š[›™\•\KÝ\˜[\ÊNÂˆÛÛœÝÙY[ˆHÝœÙY[‹™Ù]
ØÚ[XJNÂˆÙY[‹œ™YˆHY‹š[›™\•\NÂˆœÛÛ‹œ™XYÛ›HHYNÂŸNÂ˜ÛÛœÝÜ[Û˜[›ØÙ\ÜÛÜˆH
ØÚ[XKÝÚœÛÛ‹\˜[\ÊHOˆÂˆÛÛœÝYˆHØÚ[XK—Þ›Ù™YŽÂˆ›ØÙ\ÜÔØÚ[XJY‹š[›™\•\KÝ\˜[\ÊNÂˆÛÛœÝÙY[ˆHÝœÙY[‹™Ù]
ØÚ[XJNÂˆÙY[‹œ™YˆHY‹š[›™\•\NÂŸNÂ‚‹Êˆ›ÝÝ\\È][™XYHØ\œžHH^žH[\ˆY]ÙËˆÙYYYÚ]Bˆ
ˆ[š[œÚXÜÈÛÈ][š]ÛˆH›Ü™ZYÛˆØš™XÝ8 %]XØÙ\È[žHØš™XÝ8 %ˆ
ˆØ[ˆ™]™\ˆ[œÝ[[ˆXØÙ\ÜÛÜˆÛÈH›ÝÝ\HÙHÈ›ÝÝÛ‹ˆ
‹Â˜ÛÛœÝÚ[œÝ[Y\œ›Ü”›ÝÜÈHÊˆ×ÔT‘W×È
‹È™]ÈÙXZÔÙ]
ÓØš™XÝœ›ÝÝ\K\œ›Ü‹œ›ÝÝ\WJNÂ‹Êˆ[\ˆY]ÙÈ]™H\È›Û‹Y[[Y\˜X›H^žHÙ]\œÈÛˆHÚ\™Yˆ
ˆ›ÝÝ\H[œÝXYÙˆÝÛˆ›Ü\Y\ÈÛˆ]™\žH[œÝ[˜ÙKˆÛˆš\œÝˆ
ˆXØÙ\ÜÈHÙ]\ˆ[ØØ]\ÈH\‹Z[œÝ[˜ÙHÛÜÝ\™H[™ØXÚ\È]ˆ
ˆ\ÈH›Û‹Y[[Y\˜X›HÝÛˆ›Ü\KÛÈ]XÚY\ØYÙHÝ[ÛÜšÜÈ[™ˆ
ˆH[ØØ][ÛˆÛ›H\[œÈ›ÜˆY]ÙÈXÝX[HÝXÚYˆ
‹Â™[˜Ý[ÛˆÛ^žSY]Ù
›ÝËÙ^KXZÙJHÂˆØš™XÝ™Yš[™T›Ü\J›ÝËÙ^KÂˆÛÛ™šYÝ\˜X›NˆYKˆ[[Y\˜X›Nˆ˜[ÙKˆÙ]

HÂˆÛÛœÝ˜[YHHXZÙJ\ÊNÂˆØš™XÝ™Yš[™T›Ü\J\ËÙ^KÈ˜[YKÛÛ™šYÝ\˜X›NˆYKÜš]X›NˆYHJNÂˆ™]\›ˆ˜[YNÂˆKˆÙ]
˜[YJHÂˆØš™XÝ™Yš[™T›Ü\J\ËÙ^KÈ˜[YKÛÛ™šYÝ\˜X›NˆYKÜš]X›NˆYHJNÂˆKˆJNÂŸB˜ÛÛœÝ[š]X[^™\ˆH
[œÝ\ÜÝY\ÊHOˆÂˆ	›Ù\œ›Ü‹š[š]
[œÝ\ÜÝY\ÊNÂˆ[œÝ›˜[YHH–›Ù\œ›ÜˆŽÂˆÛÛœÝ›ÝÈHØš™XÝ™Ù]›ÝÝ\SÙŠ[œÝ
NÂˆYˆ
Ú[œÝ[Y\œ›Ü”›ÝÜËš\Ê›ÝÊJBˆ™]\›ŽÂˆÚ[œÝ[Y\œ›Ü”›ÝÜË˜Y
›ÝÊNÂˆÛ^žSY]Ù
›ÝË™›Ü›X]‹
Ù[ŠHOˆ
X\\ŠHOˆ›Ü›X]\œ›ÜŠÙ[‹X\\ŠJNÂˆÛ^žSY]Ù
›ÝË™›][ˆ‹
Ù[ŠHOˆ
X\\ŠHOˆ›][‘\œ›ÜŠÙ[‹X\\ŠJNÂˆÛ^žSY]Ù
›ÝË˜Y\ÜÝYH‹
Ù[ŠHOˆ
\ÜÝYJHOˆÂˆÙ[‹š\ÜÝY\Ëœ\Ú
\ÜÝYJNÂˆÙ[‹›Y\ÜØYÙHH”ÓÓ‹œÝš[™ÚYžJÙ[‹š\ÜÝY\ËœÛÛ”Ýš[™ÚYžT™\XÙ\‹ŠNÂˆJNÂˆÛ^žSY]Ù
›ÝË˜Y\ÜÝY\È‹
Ù[ŠHOˆ
\ÜÝY\ÊHOˆÂˆÙ[‹š\ÜÝY\Ëœ\Ú
‹‹š\ÜÝY\ÊNÂˆÙ[‹›Y\ÜØYÙHH”ÓÓ‹œÝš[™ÚYžJÙ[‹š\ÜÝY\ËœÛÛ”Ýš[™ÚYžT™\XÙ\‹ŠNÂˆJNÂˆØš™XÝ™Yš[™T›Ü\J›ÝËš\Ñ[\H‹ÂˆÛÛ™šYÝ\˜X›NˆYKˆ[[Y\˜X›Nˆ˜[ÙKˆÙ]

HÂˆ™]\›ˆ\Ëš\ÜÝY\Ë›[™ÝOOHÂˆKˆJNÂŸNÂ˜ÛÛœÝ›Ù\œ›ÜˆHÊ×ÔT‘W×Ê‹È	ÛÛœÝXÝÜŠ–›Ù\œ›Üˆ‹[š]X[^™\ŠNÂ˜ÛÛœÝ›Ù™X[\œ›ÜˆHÊ×ÔT‘W×Ê‹È	ÛÛœÝXÝÜŠ–›Ù\œ›Üˆ‹[š]X[^™\‹[™Yš[™YÂˆ\™[ˆ\œ›Ü‹ŸJNÂ‹ËÈÊŠˆ\™XØ]Y\ÙH‹˜ÛÜ™K‰›Ù\œ›Ü“X\Ý[œÝXYˆ
‹Â‹ËÈ^Ü\H\œ›Ü“X\ÝHÛÜ™K‰›Ù\œ›Ü“X\ÝÂ‚˜ÛÛœÝ\œÙHHÊˆ×ÔT‘W×È
‹ÈÜ\œÙJ›Ù™X[\œ›ÜŠNÂ˜ÛÛœÝ\œÙP\Þ[˜ÈHÊˆ×ÔT‘W×È
‹ÈÜ\œÙP\Þ[˜Ê›Ù™X[\œ›ÜŠNÂ˜ÛÛœÝØY™T\œÙHHÊˆ×ÔT‘W×È
‹ÈÜØY™T\œÙJ›Ù™X[\œ›ÜŠNÂ˜ÛÛœÝØY™T\œÙP\Þ[˜ÈHÊˆ×ÔT‘W×È
‹ÈÜØY™T\œÙP\Þ[˜Ê›Ù™X[\œ›ÜŠNÂ‹ËÈÛÙXÈ[˜Ý[ÛœÂ˜ÛÛœÝ[˜ÛÙIHHÊˆ×ÔT‘W×È
‹ÈÙ[˜ÛÙJ›Ù™X[\œ›ÜŠNÂ˜ÛÛœÝXÛÙHHÊˆ×ÔT‘W×È
‹ÈÙXÛÙJ›Ù™X[\œ›ÜŠNÂ˜ÛÛœÝ[˜ÛÙP\Þ[˜ÈHÊˆ×ÔT‘W×È
‹ÈÙ[˜ÛÙP\Þ[˜Ê›Ù™X[\œ›ÜŠNÂ˜ÛÛœÝXÛÙP\Þ[˜ÈHÊˆ×ÔT‘W×È
‹ÈÙXÛÙP\Þ[˜Ê›Ù™X[\œ›ÜŠNÂ˜ÛÛœÝØY™Q[˜ÛÙHHÊˆ×ÔT‘W×È
‹ÈÜØY™Q[˜ÛÙJ›Ù™X[\œ›ÜŠNÂ˜ÛÛœÝØY™QXÛÙHHÊˆ×ÔT‘W×È
‹ÈÜØY™QXÛÙJ›Ù™X[\œ›ÜŠNÂ˜ÛÛœÝØY™Q[˜ÛÙP\Þ[˜ÈHÊˆ×ÔT‘W×È
‹ÈÜØY™Q[˜ÛÙP\Þ[˜Ê›Ù™X[\œ›ÜŠNÂ˜ÛÛœÝØY™QXÛÙP\Þ[˜ÈHÊˆ×ÔT‘W×È
‹ÈÜØY™QXÛÙP\Þ[˜Ê›Ù™X[\œ›ÜŠNÂ‚‹ËÈ™YÚ\Ý\ˆ[™Û\Ú\ÈHY˜][ØØ[HÛˆš\œÝ›Ù\HÛÛœÝXÝ[Û‹ˆÛÚÙY[ÈH›Ù\X	ÛÛœÝXÝÜ˜
˜]\ˆ[ˆHÜ[]™[ÛÛ™šYÊ[Š
JX[ˆ^\›˜[Ø
HÛÈ[™\œÈÛ›Üš[™ÈÚYQY™™XÝÎˆ˜[ÙXØ[‰Ý™YK\ÚZÙH]Ý]8 %ÙYHÍNMLËÍMÌKˆ[ˆ^XÚ]‹˜ÛÛ™šYÊ‹›ØØ[\Ëž

JXØ[Ú[œÈ™YØ\™\ÜÈÙˆÜ™\‹Ú[˜ÙH\ÈÛ›HÙ]ÈHY˜][Ú[ˆ›Û™H\È™\Ù[‚™[˜Ý[ÛˆÙ[œÝ\™QY˜][ØØ[J
HÂˆYˆ
YÛØ˜[ÛÛ™šYË›ØØ[Q\œ›ÜŠBˆÛÛ™šYÊ[Š
JNÂŸB‹ËÈHY˜][Y[[Ú^™\ˆ\È™XYžHHÛÜ™HÛÛZ[™\ˆ[š]ÚXÚ[œÈ™Y›Ü™H›Ù\Kš[š]ÛÈXXÚÛÛZ[™\ˆØ[È\Èš\œÝ™[˜Ý[ÛˆÙ[œÝ\™QY˜][Y[[Ú^™\Š
HÂˆYˆ
YÛØ˜[ÛÛ™šYË›Y[[Ú^™\ŠBˆÛÛ™šYÊÈY[[Ú^™\ŽˆY[[Ú^™\Š
HJNÂŸB˜ÛÛœÝ›Ù\HHÊ×ÔT‘W×Ê‹È	ÛÛœÝXÝÜŠ–›Ù\H‹
[œÝYŠHOˆÂˆÙ[œÝ\™QY˜][ØØ[J
NÂˆ	›Ù\Kš[š]
[œÝYŠNÂˆ[œÝ™YˆHYŽÂˆ[œÝ\HHY‹\NÂˆ™]\›ˆ[œÝÂŸKÂˆÚXÚÊ‹‹˜ÚÜÊHÂˆÛÛœÝYˆH\Ë™YŽÂˆ™]\›ˆ\Ë˜ÛÛ™JY\™ÙQYœÊY‹ÂˆÚXÚÜÎˆÂˆ‹‹ŠY‹˜ÚXÚÜÈÏÈ×JKˆ‹‹˜ÚÜË›X\

Ú
HOˆ\[ÙˆÚOOH™[˜Ý[ÛˆˆÈÈÞ›ÙˆÈÚXÚÎˆÚYŽˆÈÚXÚÎˆ˜Ý\ÝÛHˆKÛ˜]XÚˆ×HHHˆÚ
KˆKˆJKÈ\™[ˆYHJNÂˆKˆÚ]
‹‹˜ÚÜÊHÂˆ™]\›ˆ\Ë˜ÚXÚÊ‹‹˜ÚÜÊNÂˆKˆÛÛ™JY‹\˜[\ÊHÂˆ™]\›ˆÛÛ™J\ËY‹\˜[\ÊNÂˆKˆœ˜[™

HÂˆ™]\›ˆ\ÎÂˆKˆ™YÚ\Ý\Š™YËY]JHÂˆ™YË˜Y
\ËY]JNÂˆ™]\›ˆ\ÎÂˆKˆ™Yš[™JÚXÚË\˜[\ÊHÂˆ™]\›ˆ\Ë˜ÚXÚÊ™Yš[™JÚXÚË\˜[\ÊJNÂˆKˆÝ\\”™Yš[™J™Yš[™[Y[\˜[\ÊHÂˆ™]\›ˆ\Ë˜ÚXÚÊÝ\\”™Yš[™J™Yš[™[Y[\˜[\ÊJNÂˆKˆÝ™\Üš]J›ŠHÂˆ™]\›ˆ\Ë˜ÚXÚÊÛÝ™\Üš]J›ŠJNÂˆKˆÜ[Û˜[

HÂˆ™]\›ˆÜ[Û˜[
\ÊNÂˆKˆ^XÝÜ[Û˜[

HÂˆ™]\›ˆ^XÝÜ[Û˜[
\ÊNÂˆKˆ[X›J
HÂˆ™]\›ˆ[X›J\ÊNÂˆKˆ[\Ú

HÂˆ™]\›ˆÜ[Û˜[
[X›J\ÊJNÂˆKˆ›Û›Ü[Û˜[
\˜[\ÊHÂˆ™]\›ˆ›Û›Ü[Û˜[
\Ë\˜[\ÊNÂˆKˆ\œ˜^J
HÂˆ™]\›ˆ\œ˜^J\ÊNÂˆKˆÜŠ\™ÊHÂˆ™]\›ˆ[š[ÛŠÝ\Ë\™×JNÂˆKˆ[™
\™ÊHÂˆ™]\›ˆ[\œÙXÝ[ÛŠ\Ë\™ÊNÂˆKˆ˜[œÙ›Ü›J
HÂˆ™]\›ˆ\J\Ë˜[œÙ›Ü›J
JNÂˆKˆY˜][

HÂˆ™]\›ˆÙY˜][
\Ë
NÂˆKˆ™Y˜][

HÂˆ™]\›ˆ™Y˜][
\Ë
NÂˆKˆØ]Ú
\˜[\ÊHÂˆ™]\›ˆØØ]Ú
\Ë\˜[\ÊNÂˆKˆ\J\™Ù]
HÂˆ™]\›ˆ\J\Ë\™Ù]
NÂˆKˆ™XYÛ›J
HÂˆ™]\›ˆ™XYÛ›J\ÊNÂˆKˆ\ØÜšX™J\ØÜš\[ÛŠHÂˆÛÛœÝÛH\Ë˜ÛÛ™J
NÂˆÛØ˜[™YÚ\ÝžK˜Y
ÛÈ\ØÜš\[ÛˆJNÂˆ™]\›ˆÛÂˆKˆY]J‹‹˜\™ÜÊHÂˆËÈÝ™\›ØYYˆY]J
H™]\›œÈH™YÚ\Ý\™YY]Y]KY]J]JH™]\›œÈHÛÛ™HÚ]]X™YÚ\Ý\™YˆHX\Y\HXÚÜÈ\HÙXÛÛ™Ý™\›ØYÛÈÙHXØÙ\˜\šXYXÈ[žKX\™ÜÈ[™™]\›ˆ[žXÈØ]\ÙžH›Ý][[YK‚ˆYˆ
\™ÜË›[™ÝOOH
Bˆ™]\›ˆÛØ˜[™YÚ\ÝžK™Ù]
\ÊNÂˆÛÛœÝÛH\Ë˜ÛÛ™J
NÂˆÛØ˜[™YÚ\ÝžK˜Y
Û\™ÜÖÌJNÂˆ™]\›ˆÛÂˆKˆ\ÓÜ[Û˜[

HÂˆ™]\›ˆ\ËœØY™T\œÙJ[™Yš[™Y
KœÝXØÙ\ÜÎÂˆKˆ\Ó[X›J
HÂˆ™]\›ˆ\ËœØY™T\œÙJ[
KœÝXØÙ\ÜÎÂˆKˆ\J›‹‹‹˜\™ÜÊHÂˆ™]\›ˆ\™ÜË›[™ÝOOHÈ›Š\ÊHˆ›Š\Ë‹‹˜\™ÜÊNÂˆKˆËÈÝ™\œšY\ÈÛÜ™IÜÈœÝ[™\™ÈYœÛÛ”ØÚ[XXˆ]\ÝÝ^HH›ÝÝ\H[žNˆ™YYš[š[™È]\ˆ[œÝ[˜ÙH[[Ý\È[œÝ[˜Ù\ÈÈXÝ[Û˜\žH[ÙK‚ˆÙ]ŸœÝ[™\™Š
HÂˆ™]\›ˆYJ\ËŸœÝ[™\™‹Âˆ‹‹œÝ[™\™›ÜÊ\ÊKˆœÛÛ”ØÚ[XNˆÂˆ[œ]ˆÜ™X]TÝ[™\™”ÓÓ”ØÚ[XSY]Ù
\Ëš[œ]ŠKˆÝ]]ˆÜ™X]TÝ[™\™”ÓÓ”ØÚ[XSY]Ù
\Ë›Ý]]ŠKˆKˆJNÂˆKˆÙ]ŸœÝ[™\™Š˜[YJHÂˆÝÛŠ\ËŸœÝ[™\™‹˜[YJNÂˆKˆ\œÙNˆ[˜Ý[ÛˆÜ\œÙJ]K\˜[\ÊHÂˆ™]\›ˆ\œÙJ\Ë]K\˜[\ËÈØ[YNˆÜ\œÙHJNÂˆKˆ\œÙP\Þ[˜Îˆ\Þ[˜È[˜Ý[ÛˆÜ\œÙP\Þ[˜Ê]K\˜[\ÊHÂˆ™]\›ˆ]ØZ]\œÙP\Þ[˜Ê\Ë]K\˜[\ËÈØ[YNˆÜ\œÙP\Þ[˜ÈJNÂˆKˆØY™T\œÙJ]K\˜[\ÊHÂˆ™]\›ˆØY™T\œÙJ\Ë]K\˜[\ÊNÂˆKˆ\Þ[˜ÈØY™T\œÙP\Þ[˜Ê]K\˜[\ÊHÂˆ™]\›ˆØY™T\œÙP\Þ[˜Ê\Ë]K\˜[\ÊNÂˆKˆËÈÜX\È[ˆ[X\ÎˆØ[YH[˜Ý[ÛˆØš™XÝ\ÈØY™T\œÙP\Þ[˜Ø\È™Y›Ü™K‚ˆÙ]ÜJ
HÂˆ™]\›ˆ\ÏËœØY™T\œÙP\Þ[˜ÎÂˆKˆÙ]ÜJ˜[YJHÂˆÝÛŠ\ËœÜH‹˜[YJNÂˆKˆ˜[Y]J]K\˜[\ÊHÂˆ™]\›ˆ˜[Y]J\Ë]K\˜[\ÊNÂˆKˆ˜[Y]P\Þ[˜Ê]K\˜[\ÊHÂˆ™]\›ˆ˜[Y]P\Þ[˜ÉJ\Ë]K\˜[\ÊNÂˆKˆ[˜ÛÙNˆ[˜Ý[ÛˆÙ[˜ÛÙJ]K\˜[\ÊHÂˆ™]\›ˆ[˜ÛÙIJ\Ë]K\˜[\ËÈØ[YNˆÙ[˜ÛÙHJNÂˆKˆXÛÙNˆ[˜Ý[ÛˆÙXÛÙJ]K\˜[\ÊHÂˆ™]\›ˆXÛÙJ\Ë]K\˜[\ËÈØ[YNˆÙXÛÙHJNÂˆKˆ[˜ÛÙP\Þ[˜Îˆ\Þ[˜È[˜Ý[ÛˆÙ[˜ÛÙP\Þ[˜Ê]K\˜[\ÊHÂˆ™]\›ˆ]ØZ][˜ÛÙP\Þ[˜Ê\Ë]K\˜[\ËÈØ[YNˆÙ[˜ÛÙP\Þ[˜ÈJNÂˆKˆXÛÙP\Þ[˜Îˆ\Þ[˜È[˜Ý[ÛˆÙXÛÙP\Þ[˜Ê]K\˜[\ÊHÂˆ™]\›ˆ]ØZ]XÛÙP\Þ[˜Ê\Ë]K\˜[\ËÈØ[YNˆÙXÛÙP\Þ[˜ÈJNÂˆKˆØY™Q[˜ÛÙJ]K\˜[\ÊHÂˆ™]\›ˆØY™Q[˜ÛÙJ\Ë]K\˜[\ÊNÂˆKˆØY™QXÛÙJ]K\˜[\ÊHÂˆ™]\›ˆØY™QXÛÙJ\Ë]K\˜[\ÊNÂˆKˆ\Þ[˜ÈØY™Q[˜ÛÙP\Þ[˜Ê]K\˜[\ÊHÂˆ™]\›ˆØY™Q[˜ÛÙP\Þ[˜Ê\Ë]K\˜[\ÊNÂˆKˆ\Þ[˜ÈØY™QXÛÙP\Þ[˜Ê]K\˜[\ÊHÂˆ™]\›ˆØY™QXÛÙP\Þ[˜Ê\Ë]K\˜[\ÊNÂˆKˆÒ”ÓÓ”ØÚ[XJ\˜[\ÊHÂˆ™]\›ˆÜ™X]UÒ”ÓÓ”ØÚ[XSY]Ù
\ËßJJ\˜[\ÊNÂˆKˆËÈ™XYÈ›ÝYÚÈH™YÚ\ÝžHÛˆ]™\žHXØÙ\ÜËÛÈ]]\Ý›ÝØXÚK‚ˆÙ]\ØÜš\[ÛŠ
HÂˆ™]\›ˆÛØ˜[™YÚ\ÝžK™Ù]
\ÊOË™\ØÜš\[ÛŽÂˆKˆËÈ›ÈÙ]\ŽˆØÚ[XK—ÙYˆH›ÝÜË\È]YÚ[ˆÙY˜Ø\ÈH›Û‹]Üš]X›HÝÛˆ›Ü\K‚ˆÙ]ÙYŠ
HÂˆ™]\›ˆ\Ë—Þ›Ù™YŽÂˆKŸJNÂ‹ÊŠˆ[\›˜[
‹Â˜ÛÛœÝÖ›ÙÝš[™ÈHÊ×ÔT‘W×Ê‹È	ÛÛœÝXÝÜŠ—Ö›ÙÝš[™È‹
[œÝYŠHOˆÂˆ	›ÙÝš[™Ëš[š]
[œÝYŠNÂˆ›Ù\Kš[š]
[œÝYŠNÂˆ[œÝ—Þ›Ùœ›ØÙ\ÜÒ”ÓÓ”ØÚ[XHH
ÝœÛÛ‹\˜[\ÊHOˆÝš[™Ô›ØÙ\ÜÛÜŠ[œÝÝœÛÛŠNÂŸK‹Ê×ÔT‘W×Ê‹È\š]™Y
Âˆ›Ü›X]ˆ
[œÝ
HOˆYÙÜ™YØ]PÚXÚÜÊ[œÝ
K™›Ü›X]ÏÈ[ˆZ[“[™Ýˆ
[œÝ
HOˆYÙÜ™YØ]PÚXÚÜÊ[œÝ
K›Z[š[][HÏÈ[ˆX^[™Ýˆ
[œÝ
HOˆYÙÜ™YØ]PÚXÚÜÊ[œÝ
K›X^[][HÏÈ[ŸKÂˆ™YÙ^
‹‹˜\™ÜÊHÂˆ™]\›ˆ\Ë˜ÚXÚÊÜ™YÙ^
‹‹˜\™ÜÊJNÂˆKˆ[˜ÛY\Ê‹‹˜\™ÜÊHÂˆ™]\›ˆ\Ë˜ÚXÚÊÚ[˜ÛY\Ê‹‹˜\™ÜÊJNÂˆKˆÝ\ÕÚ]
‹‹˜\™ÜÊHÂˆ™]\›ˆ\Ë˜ÚXÚÊÜÝ\ÕÚ]
‹‹˜\™ÜÊJNÂˆKˆ[™ÕÚ]
‹‹˜\™ÜÊHÂˆ™]\›ˆ\Ë˜ÚXÚÊÙ[™ÕÚ]
‹‹˜\™ÜÊJNÂˆKˆZ[Š‹‹˜\™ÜÊHÂˆ™]\›ˆ\Ë˜ÚXÚÊÛZ[“[™Ý
‹‹˜\™ÜÊJNÂˆKˆX^
‹‹˜\™ÜÊHÂˆ™]\›ˆ\Ë˜ÚXÚÊÛX^[™Ý
‹‹˜\™ÜÊJNÂˆKˆ[™Ý
‹‹˜\™ÜÊHÂˆ™]\›ˆ\Ë˜ÚXÚÊÛ[™Ý
‹‹˜\™ÜÊJNÂˆKˆ›Û™[\J‹‹˜\™ÜÊHÂˆ™]\›ˆ\Ë˜ÚXÚÊÛZ[“[™Ý
K‹‹˜\™ÜÊJNÂˆKˆÝÙ\˜Ø\ÙJ\˜[\ÊHÂˆ™]\›ˆ\Ë˜ÚXÚÊÛÝÙ\˜Ø\ÙJ\˜[\ÊJNÂˆKˆ\\˜Ø\ÙJ\˜[\ÊHÂˆ™]\›ˆ\Ë˜ÚXÚÊÝ\\˜Ø\ÙJ\˜[\ÊJNÂˆKˆš[J
HÂˆ™]\›ˆ\Ë˜ÚXÚÊÝš[J
JNÂˆKˆ›Ü›X[^™J‹‹˜\™ÜÊHÂˆ™]\›ˆ\Ë˜ÚXÚÊÛ›Ü›X[^™J‹‹˜\™ÜÊJNÂˆKˆÓÝÙ\Ø\ÙJ
HÂˆ™]\›ˆ\Ë˜ÚXÚÊÝÓÝÙ\Ø\ÙJ
JNÂˆKˆÕ\\Ø\ÙJ
HÂˆ™]\›ˆ\Ë˜ÚXÚÊÝÕ\\Ø\ÙJ
JNÂˆKˆÛYÚYžJ
HÂˆ™]\›ˆ\Ë˜ÚXÚÊÜÛYÚYžJ
JNÂˆKŸJJNÂ˜ÛÛœÝ›ÙÝš[™ÈHÊ×ÔT‘W×Ê‹È	ÛÛœÝXÝÜŠ–›ÙÝš[™È‹
[œÝYŠHOˆÂˆ	›ÙÝš[™Ëš[š]
[œÝYŠNÂˆÖ›ÙÝš[™Ëš[š]
[œÝYŠNÂŸKÂˆ[XZ[
\˜[\ÊHÂˆ™]\›ˆ\Ë˜ÚXÚÊÙ[XZ[
›Ù[XZ[\˜[\ÊJNÂˆKˆ\›
\˜[\ÊHÂˆ™]\›ˆ\Ë˜ÚXÚÊÝ\›
›ÙT“\˜[\ÊJNÂˆKˆÝ
\˜[\ÊHÂˆ™]\›ˆ\Ë˜ÚXÚÊÚÝ
›Ù•Õ\˜[\ÊJNÂˆKˆ[[ÚšJ\˜[\ÊHÂˆ™]\›ˆ\Ë˜ÚXÚÊÙ[[ÚšJ›Ù[[ÚšK\˜[\ÊJNÂˆKˆÝZY
\˜[\ÊHÂˆ™]\›ˆ\Ë˜ÚXÚÊÙÝZY
›ÙÕRQ\˜[\ÊJNÂˆKˆ]ZY
\˜[\ÊHÂˆ™]\›ˆ\Ë˜ÚXÚÊÝ]ZY
›ÙURQ\˜[\ÊJNÂˆKˆ]ZY
\˜[\ÊHÂˆ™]\›ˆ\Ë˜ÚXÚÊÝ]ZY
›ÙURQ\˜[\ÊJNÂˆKˆ]ZYŠ\˜[\ÊHÂˆ™]\›ˆ\Ë˜ÚXÚÊÝ]ZYŠ›ÙURQ\˜[\ÊJNÂˆKˆ]ZYÊ\˜[\ÊHÂˆ™]\›ˆ\Ë˜ÚXÚÊÝ]ZYÊ›ÙURQ\˜[\ÊJNÂˆKˆ˜[›ÚY
\˜[\ÊHÂˆ™]\›ˆ\Ë˜ÚXÚÊÛ˜[›ÚY
›Ù˜[›ÒQ\˜[\ÊJNÂˆKˆÝZY
\˜[\ÊHÂˆ™]\›ˆ\Ë˜ÚXÚÊØÝZY
›ÙÕRQ\˜[\ÊJNÂˆKˆÝZYŠ\˜[\ÊHÂˆ™]\›ˆ\Ë˜ÚXÚÊØÝZYŠ›ÙÕRQ‹\˜[\ÊJNÂˆKˆ[Y
\˜[\ÊHÂˆ™]\›ˆ\Ë˜ÚXÚÊÝ[Y
›ÙSQ\˜[\ÊJNÂˆKˆ˜\ÙM
\˜[\ÊHÂˆ™]\›ˆ\Ë˜ÚXÚÊØ˜\ÙM
›Ù˜\ÙM\˜[\ÊJNÂˆKˆ˜\ÙM\›
\˜[\ÊHÂˆ™]\›ˆ\Ë˜ÚXÚÊØ˜\ÙM\›
›Ù˜\ÙMT“\˜[\ÊJNÂˆKˆY
\˜[\ÊHÂˆ™]\›ˆ\Ë˜ÚXÚÊÞY
›ÙQ\˜[\ÊJNÂˆKˆÜÝZY
\˜[\ÊHÂˆ™]\›ˆ\Ë˜ÚXÚÊÚÜÝZY
›ÙÔÕRQ\˜[\ÊJNÂˆKˆ\
\˜[\ÊHÂˆ™]\›ˆ\Ë˜ÚXÚÊÚ\
›ÙT\˜[\ÊJNÂˆKˆ\Š\˜[\ÊHÂˆ™]\›ˆ\Ë˜ÚXÚÊÚ\Š›ÙT‹\˜[\ÊJNÂˆKˆÚY
\˜[\ÊHÂˆ™]\›ˆ\Ë˜ÚXÚÊØÚY
›ÙÒQ\˜[\ÊJNÂˆKˆÚYŠ\˜[\ÊHÂˆ™]\›ˆ\Ë˜ÚXÚÊØÚYŠ›ÙÒQ‹\˜[\ÊJNÂˆKˆLM
\˜[\ÊHÂˆ™]\›ˆ\Ë˜ÚXÚÊÙLM
›ÙLM\˜[\ÊJNÂˆKˆ]][YJ\˜[\ÊHÂˆ™]\›ˆ\Ë˜ÚXÚÊÚ\ÛÑ]U[YJ›ÙTÓÑ]U[YK\˜[\ÊJNÂˆKˆ]J\˜[\ÊHÂˆ™]\›ˆ\Ë˜ÚXÚÊÚ\ÛÑ]J›ÙTÓÑ]K\˜[\ÊJNÂˆKˆ[YJ\˜[\ÊHÂˆ™]\›ˆ\Ë˜ÚXÚÊÚ\ÛÕ[YJ›ÙTÓÕ[YK\˜[\ÊJNÂˆKˆ\˜][ÛŠ\˜[\ÊHÂˆ™]\›ˆ\Ë˜ÚXÚÊÚ\ÛÑ\˜][ÛŠ›ÙTÓÑ\˜][Û‹\˜[\ÊJNÂˆKŸJNÂ™[˜Ý[ÛˆÝš[™Ê\˜[\ÊHÂˆ™]\›ˆÜÝš[™Ê›ÙÝš[™Ë\˜[\ÊNÂŸB˜ÛÛœÝ›ÙÝš[™Ñ›Ü›X]HÊ×ÔT‘W×Ê‹È	ÛÛœÝXÝÜŠ–›ÙÝš[™Ñ›Ü›X]‹
[œÝYŠHOˆÂˆ	›ÙÝš[™Ñ›Ü›X]š[š]
[œÝYŠNÂˆÖ›ÙÝš[™Ëš[š]
[œÝYŠNÂŸJNÂ˜ÛÛœÝ›ÙTÓÑ]U[YHHÊ×ÔT‘W×Ê‹È	ÛÛœÝXÝÜŠ–›ÙTÓÑ]U[YH‹
[œÝYŠHOˆÂˆ	›ÙTÓÑ]U[YKš[š]
[œÝYŠNÂˆ›ÙÝš[™Ñ›Ü›X]š[š]
[œÝYŠNÂŸJNÂ˜ÛÛœÝ›ÙTÓÑ]HHÊ×ÔT‘W×Ê‹È	ÛÛœÝXÝÜŠ–›ÙTÓÑ]H‹
[œÝYŠHOˆÂˆ	›ÙTÓÑ]Kš[š]
[œÝYŠNÂˆ›ÙÝš[™Ñ›Ü›X]š[š]
[œÝYŠNÂŸJNÂ˜ÛÛœÝ›ÙTÓÕ[YHHÊ×ÔT‘W×Ê‹È	ÛÛœÝXÝÜŠ–›ÙTÓÕ[YH‹
[œÝYŠHOˆÂˆ	›ÙTÓÕ[YKš[š]
[œÝYŠNÂˆ›ÙÝš[™Ñ›Ü›X]š[š]
[œÝYŠNÂŸJNÂ˜ÛÛœÝ›ÙTÓÑ\˜][ÛˆHÊ×ÔT‘W×Ê‹È	ÛÛœÝXÝÜŠ–›ÙTÓÑ\˜][Ûˆ‹
[œÝYŠHOˆÂˆ	›ÙTÓÑ\˜][Û‹š[š]
[œÝYŠNÂˆ›ÙÝš[™Ñ›Ü›X]š[š]
[œÝYŠNÂŸJNÂ˜ÛÛœÝ›Ù[XZ[HÊ×ÔT‘W×Ê‹È	ÛÛœÝXÝÜŠ–›Ù[XZ[‹
[œÝYŠHOˆÂˆËÈ›ÙÝš[™Ñ›Ü›X]š[š]
[œÝYŠNÂˆ	›Ù[XZ[š[š]
[œÝYŠNÂˆ›ÙÝš[™Ñ›Ü›X]š[š]
[œÝYŠNÂŸJNÂ˜ÛÛœÝ›ÙÕRQHÊ×ÔT‘W×Ê‹È	ÛÛœÝXÝÜŠ–›ÙÕRQ‹
[œÝYŠHOˆÂˆËÈ›ÙÝš[™Ñ›Ü›X]š[š]
[œÝYŠNÂˆ	›ÙÕRQš[š]
[œÝYŠNÂˆ›ÙÝš[™Ñ›Ü›X]š[š]
[œÝYŠNÂŸJNÂ˜ÛÛœÝ›ÙURQHÊ×ÔT‘W×Ê‹È	ÛÛœÝXÝÜŠ–›ÙURQ‹
[œÝYŠHOˆÂˆËÈ›ÙÝš[™Ñ›Ü›X]š[š]
[œÝYŠNÂˆ	›ÙURQš[š]
[œÝYŠNÂˆ›ÙÝš[™Ñ›Ü›X]š[š]
[œÝYŠNÂŸJNÂ˜ÛÛœÝ›ÙT“HÊ×ÔT‘W×Ê‹È	ÛÛœÝXÝÜŠ–›ÙT“‹
[œÝYŠHOˆÂˆËÈ›ÙÝš[™Ñ›Ü›X]š[š]
[œÝYŠNÂˆ	›ÙT“š[š]
[œÝYŠNÂˆ›ÙÝš[™Ñ›Ü›X]š[š]
[œÝYŠNÂŸJNÂ˜ÛÛœÝ›Ù[[ÚšHHÊ×ÔT‘W×Ê‹È	ÛÛœÝXÝÜŠ–›Ù[[ÚšH‹
[œÝYŠHOˆÂˆËÈ›ÙÝš[™Ñ›Ü›X]š[š]
[œÝYŠNÂˆ	›Ù[[ÚšKš[š]
[œÝYŠNÂˆ›ÙÝš[™Ñ›Ü›X]š[š]
[œÝYŠNÂŸJNÂ˜ÛÛœÝ›Ù˜[›ÒQHÊ×ÔT‘W×Ê‹È	ÛÛœÝXÝÜŠ–›Ù˜[›ÒQ‹
[œÝYŠHOˆÂˆËÈ›ÙÝš[™Ñ›Ü›X]š[š]
[œÝYŠNÂˆ	›Ù˜[›ÒQš[š]
[œÝYŠNÂˆ›ÙÝš[™Ñ›Ü›X]š[š]
[œÝYŠNÂŸJNÂ‹ÊŠ‚ˆ
ˆ\™XØ]YÕRQŒH\È\™XØ]YžH]È]]ÜœÈYHÈ[™›Ü›X][ÛˆXZØYÙBˆ
ˆ
[Y\Ý[\È[X™YY[ˆHY
Kˆ\ÙHÐ[šÈ›ÙÕRQŸH[œÝXY‚ˆ
ˆÙYHÎ‹ËÙÚ]X‹˜ÛÛKÜ\˜[[š]™KØÝZY‚ˆ
‹Â˜ÛÛœÝ›ÙÕRQHÊ×ÔT‘W×Ê‹È	ÛÛœÝXÝÜŠ–›ÙÕRQ‹
[œÝYŠHOˆÂˆËÈ›ÙÝš[™Ñ›Ü›X]š[š]
[œÝYŠNÂˆ	›ÙÕRQš[š]
[œÝYŠNÂˆ›ÙÝš[™Ñ›Ü›X]š[š]
[œÝYŠNÂŸJNÂ˜ÛÛœÝ›ÙÕRQˆHÊ×ÔT‘W×Ê‹È	ÛÛœÝXÝÜŠ–›ÙÕRQˆ‹
[œÝYŠHOˆÂˆËÈ›ÙÝš[™Ñ›Ü›X]š[š]
[œÝYŠNÂˆ	›ÙÕRQ‹š[š]
[œÝYŠNÂˆ›ÙÝš[™Ñ›Ü›X]š[š]
[œÝYŠNÂŸJNÂ˜ÛÛœÝ›ÙSQHÊ×ÔT‘W×Ê‹È	ÛÛœÝXÝÜŠ–›ÙSQ‹
[œÝYŠHOˆÂˆËÈ›ÙÝš[™Ñ›Ü›X]š[š]
[œÝYŠNÂˆ	›ÙSQš[š]
[œÝYŠNÂˆ›ÙÝš[™Ñ›Ü›X]š[š]
[œÝYŠNÂŸJNÂ˜ÛÛœÝ›ÙQHÊ×ÔT‘W×Ê‹È	ÛÛœÝXÝÜŠ–›ÙQ‹
[œÝYŠHOˆÂˆËÈ›ÙÝš[™Ñ›Ü›X]š[š]
[œÝYŠNÂˆ	›ÙQš[š]
[œÝYŠNÂˆ›ÙÝš[™Ñ›Ü›X]š[š]
[œÝYŠNÂŸJNÂ˜ÛÛœÝ›ÙÔÕRQHÊ×ÔT‘W×Ê‹È	ÛÛœÝXÝÜŠ–›ÙÔÕRQ‹
[œÝYŠHOˆÂˆËÈ›ÙÝš[™Ñ›Ü›X]š[š]
[œÝYŠNÂˆ	›ÙÔÕRQš[š]
[œÝYŠNÂˆ›ÙÝš[™Ñ›Ü›X]š[š]
[œÝYŠNÂŸJNÂ˜ÛÛœÝ›ÙTHÊ×ÔT‘W×Ê‹È	ÛÛœÝXÝÜŠ–›ÙT‹
[œÝYŠHOˆÂˆËÈ›ÙÝš[™Ñ›Ü›X]š[š]
[œÝYŠNÂˆ	›ÙTš[š]
[œÝYŠNÂˆ›ÙÝš[™Ñ›Ü›X]š[š]
[œÝYŠNÂŸJNÂ˜ÛÛœÝ›ÙTˆHÊ×ÔT‘W×Ê‹È	ÛÛœÝXÝÜŠ–›ÙTˆ‹
[œÝYŠHOˆÂˆËÈ›ÙÝš[™Ñ›Ü›X]š[š]
[œÝYŠNÂˆ	›ÙT‹š[š]
[œÝYŠNÂˆ›ÙÝš[™Ñ›Ü›X]š[š]
[œÝYŠNÂŸJNÂ˜ÛÛœÝ›ÙÒQHÊ×ÔT‘W×Ê‹È	ÛÛœÝXÝÜŠ–›ÙÒQ‹
[œÝYŠHOˆÂˆ	›ÙÒQš[š]
[œÝYŠNÂˆ›ÙÝš[™Ñ›Ü›X]š[š]
[œÝYŠNÂŸJNÂ˜ÛÛœÝ›ÙÒQˆHÊ×ÔT‘W×Ê‹È	ÛÛœÝXÝÜŠ–›ÙÒQˆ‹
[œÝYŠHOˆÂˆ	›ÙÒQ‹š[š]
[œÝYŠNÂˆ›ÙÝš[™Ñ›Ü›X]š[š]
[œÝYŠNÂŸJNÂ˜ÛÛœÝ›Ù˜\ÙMHÊ×ÔT‘W×Ê‹È	ÛÛœÝXÝÜŠ–›Ù˜\ÙM‹
[œÝYŠHOˆÂˆËÈ›ÙÝš[™Ñ›Ü›X]š[š]
[œÝYŠNÂˆ	›Ù˜\ÙMš[š]
[œÝYŠNÂˆ›ÙÝš[™Ñ›Ü›X]š[š]
[œÝYŠNÂŸJNÂ˜ÛÛœÝ›Ù˜\ÙMT“HÊ×ÔT‘W×Ê‹È	ÛÛœÝXÝÜŠ–›Ù˜\ÙMT“‹
[œÝYŠHOˆÂˆËÈ›ÙÝš[™Ñ›Ü›X]š[š]
[œÝYŠNÂˆ	›Ù˜\ÙMT“š[š]
[œÝYŠNÂˆ›ÙÝš[™Ñ›Ü›X]š[š]
[œÝYŠNÂŸJNÂ˜ÛÛœÝ›ÙLMHÊ×ÔT‘W×Ê‹È	ÛÛœÝXÝÜŠ–›ÙLM‹
[œÝYŠHOˆÂˆËÈ›ÙÝš[™Ñ›Ü›X]š[š]
[œÝYŠNÂˆ	›ÙLMš[š]
[œÝYŠNÂˆ›ÙÝš[™Ñ›Ü›X]š[š]
[œÝYŠNÂŸJNÂ˜ÛÛœÝ›Ù•ÕHÊ×ÔT‘W×Ê‹È	ÛÛœÝXÝÜŠ–›Ù•Õ‹
[œÝYŠHOˆÂˆËÈ›ÙÝš[™Ñ›Ü›X]š[š]
[œÝYŠNÂˆ	›Ù•Õš[š]
[œÝYŠNÂˆ›ÙÝš[™Ñ›Ü›X]š[š]
[œÝYŠNÂŸJNÂ˜ÛÛœÝ›Ù[X™\ˆHÊ×ÔT‘W×Ê‹È	ÛÛœÝXÝÜŠ–›Ù[X™\ˆ‹
[œÝYŠHOˆÂˆ	›Ù[X™\‹š[š]
[œÝYŠNÂˆ›Ù\Kš[š]
[œÝYŠNÂˆ[œÝ—Þ›Ùœ›ØÙ\ÜÒ”ÓÓ”ØÚ[XHH
ÝœÛÛ‹\˜[\ÊHOˆ[X™\”›ØÙ\ÜÛÜŠ[œÝÝœÛÛ‹\˜[\ÊNÂˆ[œÝš\Ñš[š]HHYNÂŸK‹Ê×ÔT‘W×Ê‹È\š]™Y
ÂˆZ[•˜[YNˆ
[œÝ
HOˆÂˆÛÛœÝÈZ[š[][K^Û\Ú]™SZ[š[][HHHYÙÜ™YØ]PÚXÚÜÊ[œÝ
NÂˆ™]\›ˆX]›X^
Z[š[][HÏÈ[X™\‹“‘QÐUU‘WÒS‘’S’UK^Û\Ú]™SZ[š[][HÏÈ[X™\‹“‘QÐUU‘WÒS‘’S’UJNÂˆKˆX^˜[YNˆ
[œÝ
HOˆÂˆÛÛœÝÈX^[][K^Û\Ú]™SX^[][HHHYÙÜ™YØ]PÚXÚÜÊ[œÝ
NÂˆ™]\›ˆX]›Z[ŠX^[][HÏÈ[X™\‹”ÔÒUU‘WÒS‘’S’UK^Û\Ú]™SX^[][HÏÈ[X™\‹”ÔÒUU‘WÒS‘’S’UJNÂˆKˆ\Ò[ˆ
[œÝ
HOˆÂˆÛÛœÝÈ\Ò[][\SÙˆHHYÙÜ™YØ]PÚXÚÜÊ[œÝ
NÂˆ™]\›ˆHZ\Ò[H[][\SÙËœÛÛYJ[X™\‹š\ÔØY™R[YÙ\ŠNÂˆKˆ›Ü›X]ˆ
[œÝ
HOˆYÙÜ™YØ]PÚXÚÜÊ[œÝ
K™›Ü›X]ÏÈ[ŸKÂˆÝ
˜[YK\˜[\ÊHÂˆ™]\›ˆ\Ë˜ÚXÚÊÙÝ
˜[YK\˜[\ÊJNÂˆKˆÝJ˜[YK\˜[\ÊHÂˆ™]\›ˆ\Ë˜ÚXÚÊÙÝJ˜[YK\˜[\ÊJNÂˆKˆZ[Š˜[YK\˜[\ÊHÂˆ™]\›ˆ\Ë˜ÚXÚÊÙÝJ˜[YK\˜[\ÊJNÂˆKˆ
˜[YK\˜[\ÊHÂˆ™]\›ˆ\Ë˜ÚXÚÊÛ
˜[YK\˜[\ÊJNÂˆKˆJ˜[YK\˜[\ÊHÂˆ™]\›ˆ\Ë˜ÚXÚÊÛJ˜[YK\˜[\ÊJNÂˆKˆX^
˜[YK\˜[\ÊHÂˆ™]\›ˆ\Ë˜ÚXÚÊÛJ˜[YK\˜[\ÊJNÂˆKˆ[
\˜[\ÊHÂˆ™]\›ˆ\Ë˜ÚXÚÊ[
\˜[\ÊJNÂˆKˆØY™J\˜[\ÊHÂˆ™]\›ˆ\Ë˜ÚXÚÊ[
\˜[\ÊJNÂˆKˆÜÚ]]™J\˜[\ÊHÂˆ™]\›ˆ\Ë˜ÚXÚÊÙÝ
\˜[\ÊJNÂˆKˆ›Û›™YØ]]™J\˜[\ÊHÂˆ™]\›ˆ\Ë˜ÚXÚÊÙÝJ\˜[\ÊJNÂˆKˆ™YØ]]™J\˜[\ÊHÂˆ™]\›ˆ\Ë˜ÚXÚÊÛ
\˜[\ÊJNÂˆKˆ›ÛœÜÚ]]™J\˜[\ÊHÂˆ™]\›ˆ\Ë˜ÚXÚÊÛJ\˜[\ÊJNÂˆKˆ][\SÙŠ˜[YK\˜[\ÊHÂˆ™]\›ˆ\Ë˜ÚXÚÊÛ][\SÙŠ˜[YK\˜[\ÊJNÂˆKˆÝ\
˜[YK\˜[\ÊHÂˆ™]\›ˆ\Ë˜ÚXÚÊÛ][\SÙŠ˜[YK\˜[\ÊJNÂˆKˆš[š]J
HÂˆ™]\›ˆ\ÎÂˆKŸJJNÂ™[˜Ý[Ûˆ[X™\Š\˜[\ÊHÂˆ™]\›ˆÛ[X™\Š›Ù[X™\‹\˜[\ÊNÂŸB˜ÛÛœÝ›Ù[X™\‘›Ü›X]HÊ×ÔT‘W×Ê‹È	ÛÛœÝXÝÜŠ–›Ù[X™\‘›Ü›X]‹
[œÝYŠHOˆÂˆ	›Ù[X™\‘›Ü›X]š[š]
[œÝYŠNÂˆ›Ù[X™\‹š[š]
[œÝYŠNÂŸJNÂ™[˜Ý[Ûˆ[
\˜[\ÊHÂˆ™]\›ˆÚ[
›Ù[X™\‘›Ü›X]\˜[\ÊNÂŸB˜ÛÛœÝ›Ù›ÛÛX[ˆHÊ×ÔT‘W×Ê‹È	ÛÛœÝXÝÜŠ–›Ù›ÛÛX[ˆ‹
[œÝYŠHOˆÂˆ	›Ù›ÛÛX[‹š[š]
[œÝYŠNÂˆ›Ù\Kš[š]
[œÝYŠNÂˆ[œÝ—Þ›Ùœ›ØÙ\ÜÒ”ÓÓ”ØÚ[XHH
ÝœÛÛ‹\˜[\ÊHOˆ›ÛÛX[”›ØÙ\ÜÛÜŠ[œÝÝœÛÛŠNÂŸJNÂ™[˜Ý[Ûˆ›ÛÛX[Š\˜[\ÊHÂˆ™]\›ˆØ›ÛÛX[Š›Ù›ÛÛX[‹\˜[\ÊNÂŸB˜ÛÛœÝ›Ù[žHHÊ×ÔT‘W×Ê‹È	ÛÛœÝXÝÜŠ–›Ù[žH‹
[œÝYŠHOˆÂˆ	›Ù[žKš[š]
[œÝYŠNÂˆ›Ù\Kš[š]
[œÝYŠNÂˆ[œÝ—Þ›Ùœ›ØÙ\ÜÒ”ÓÓ”ØÚ[XHH
ÝœÛÛ‹\˜[\ÊHOˆ[žT›ØÙ\ÜÛÜŠ
NÂŸJNÂ™[˜Ý[Ûˆ[žJ
HÂˆ™]\›ˆØ[žJ›Ù[žJNÂŸB˜ÛÛœÝ›Ù[šÛ›ÝÛˆHÊ×ÔT‘W×Ê‹È	ÛÛœÝXÝÜŠ–›Ù[šÛ›ÝÛˆ‹
[œÝYŠHOˆÂˆ	›Ù[šÛ›ÝÛ‹š[š]
[œÝYŠNÂˆ›Ù\Kš[š]
[œÝYŠNÂˆ[œÝ—Þ›Ùœ›ØÙ\ÜÒ”ÓÓ”ØÚ[XHH
ÝœÛÛ‹\˜[\ÊHOˆ[šÛ›ÝÛ”›ØÙ\ÜÛÜŠ
NÂŸJNÂ™[˜Ý[Ûˆ[šÛ›ÝÛŠ
HÂˆ™]\›ˆÝ[šÛ›ÝÛŠ›Ù[šÛ›ÝÛŠNÂŸB˜ÛÛœÝ›Ù™]™\ˆHÊ×ÔT‘W×Ê‹È	ÛÛœÝXÝÜŠ–›Ù™]™\ˆ‹
[œÝYŠHOˆÂˆ	›Ù™]™\‹š[š]
[œÝYŠNÂˆ›Ù\Kš[š]
[œÝYŠNÂˆ[œÝ—Þ›Ùœ›ØÙ\ÜÒ”ÓÓ”ØÚ[XHH
ÝœÛÛ‹\˜[\ÊHOˆ™]™\”›ØÙ\ÜÛÜŠ[œÝÝœÛÛŠNÂŸJNÂ™[˜Ý[Ûˆ™]™\Š\˜[\ÊHÂˆ™]\›ˆÛ™]™\Š›Ù™]™\‹\˜[\ÊNÂŸB˜ÛÛœÝ›Ù\œ˜^HHÊ×ÔT‘W×Ê‹È	ÛÛœÝXÝÜŠ–›Ù\œ˜^H‹
[œÝYŠHOˆÂˆÙ[œÝ\™QY˜][Y[[Ú^™\Š
NÂˆ	›Ù\œ˜^Kš[š]
[œÝYŠNÂˆ›Ù\Kš[š]
[œÝYŠNÂˆ[œÝ—Þ›Ùœ›ØÙ\ÜÒ”ÓÓ”ØÚ[XHH
ÝœÛÛ‹\˜[\ÊHOˆ\œ˜^T›ØÙ\ÜÛÜŠ[œÝÝœÛÛ‹\˜[\ÊNÂˆ[œÝ™[[Y[HY‹™[[Y[ÂŸKÂˆZ[Š‹\˜[\ÊHÂˆ™]\›ˆ\Ë˜ÚXÚÊÛZ[“[™Ý
‹\˜[\ÊJNÂˆKˆ›Û™[\J\˜[\ÊHÂˆ™]\›ˆ\Ë˜ÚXÚÊÛZ[“[™Ý
K\˜[\ÊJNÂˆKˆX^
‹\˜[\ÊHÂˆ™]\›ˆ\Ë˜ÚXÚÊÛX^[™Ý
‹\˜[\ÊJNÂˆKˆ[™Ý
‹\˜[\ÊHÂˆ™]\›ˆ\Ë˜ÚXÚÊÛ[™Ý
‹\˜[\ÊJNÂˆKˆ[Ü˜\

HÂˆ™]\›ˆ\Ë™[[Y[ÂˆKŸJNÂ™[˜Ý[Ûˆ\œ˜^J[[Y[\˜[\ÊHÂˆ™]\›ˆØ\œ˜^J›Ù\œ˜^K[[Y[\˜[\ÊNÂŸB˜ÛÛœÝ›ÙØš™XÝHÊ×ÔT‘W×Ê‹È	ÛÛœÝXÝÜŠ–›ÙØš™XÝ‹
[œÝYŠHOˆÂˆÙ[œÝ\™QY˜][Y[[Ú^™\Š
NÂˆ	›ÙØš™XÝ’Uš[š]
[œÝYŠNÂˆ›Ù\Kš[š]
[œÝYŠNÂˆ[œÝ—Þ›Ùœ›ØÙ\ÜÒ”ÓÓ”ØÚ[XHH
ÝœÛÛ‹\˜[\ÊHOˆØš™XÝ›ØÙ\ÜÛÜŠ[œÝÝœÛÛ‹\˜[\ÊNÂˆ[œÝ[^žT›Ü
[œÝœÚ\H‹
Ù[ŠHOˆÙ[‹—Þ›Ù™Y‹œÚ\K˜[ÙJNÂŸKÂˆÙ^[ÙŠ
HÂˆ™]\›ˆÙ[[JØš™XÝšÙ^\Ê\Ë—Þ›Ù™Y‹œÚ\JJNÂˆKˆØ]Ú[
Ø]Ú[
HÂˆËÈY\™ÙQYœØ˜]\ˆ[ˆHÜ™XYˆÜ™XY[™È™XYÈÚ\X[™™\ÛÛš[™È]Ø[ˆZ[HÚÛHœ™\ÚÝX™YBˆ™]\›ˆ\Ë˜ÛÛ™JY\™ÙQYœÊ\Ë—Þ›Ù™Y‹ÈØ]Ú[ˆØ]Ú[JJNÂˆKˆ\ÜÝ›ÝYÚ

HÂˆ™]\›ˆ\Ë˜ÛÛ™JY\™ÙQYœÊ\Ë—Þ›Ù™Y‹ÈØ]Ú[ˆ[šÛ›ÝÛŠ
HJJNÂˆKˆÛÜÙJ
HÂˆ™]\›ˆ\Ë˜ÛÛ™JY\™ÙQYœÊ\Ë—Þ›Ù™Y‹ÈØ]Ú[ˆ[šÛ›ÝÛŠ
HJJNÂˆKˆÝšXÝ

HÂˆ™]\›ˆ\Ë˜ÛÛ™JY\™ÙQYœÊ\Ë—Þ›Ù™Y‹ÈØ]Ú[ˆ™]™\Š
HJJNÂˆKˆÝš\

HÂˆ™]\›ˆ\Ë˜ÛÛ™JY\™ÙQYœÊ\Ë—Þ›Ù™Y‹ÈØ]Ú[ˆ[™Yš[™YJJNÂˆKˆ^[™
[˜ÛÛZ[™ÊHÂˆ™]\›ˆ^[™
\Ë[˜ÛÛZ[™ÊNÂˆKˆØY™Q^[™
[˜ÛÛZ[™ÊHÂˆ™]\›ˆØY™Q^[™
\Ë[˜ÛÛZ[™ÊNÂˆKˆY\™ÙJÝ\ŠHÂˆ™]\›ˆY\™ÙJ\ËÝ\ŠNÂˆKˆXÚÊX\ÚÊHÂˆ™]\›ˆXÚÊ\ËX\ÚÊNÂˆKˆÛZ]
X\ÚÊHÂˆ™]\›ˆÛZ]
\ËX\ÚÊNÂˆKˆ\X[
‹‹˜\™ÜÊHÂˆ™]\›ˆ\X[
›ÙÜ[Û˜[\Ë\™ÜÖÌJNÂˆKˆ^XÝ\X[
‹‹˜\™ÜÊHÂˆ™]\›ˆ\X[
›Ù^XÝÜ[Û˜[\Ë\™ÜÖÌK™^XÝ\X[ŠNÂˆKˆ™\]Z\™Y
‹‹˜\™ÜÊHÂˆ™]\›ˆ™\]Z\™Y
›Ù›Û“Ü[Û˜[\Ë\™ÜÖÌJNÂˆKŸJNÂ™[˜Ý[ÛˆØš™XÝ
Ú\K\˜[\ÊHÂˆÛÛœÝYˆHÂˆ\Nˆ›Øš™XÝ‹ˆÚ\NˆÚ\HÏÈßKˆ‹‹››Ü›X[^™T\˜[\Ê\˜[\ÊKˆNÂˆ™]\›ˆ™]È›ÙØš™XÝ
YŠNÂŸB˜ÛÛœÝ›Ù[š[ÛˆHÊ×ÔT‘W×Ê‹È	ÛÛœÝXÝÜŠ–›Ù[š[Ûˆ‹
[œÝYŠHOˆÂˆ	›Ù[š[Û‹š[š]
[œÝYŠNÂˆ›Ù\Kš[š]
[œÝYŠNÂˆ[œÝ—Þ›Ùœ›ØÙ\ÜÒ”ÓÓ”ØÚ[XHH
ÝœÛÛ‹\˜[\ÊHOˆ[š[Û”›ØÙ\ÜÛÜŠ[œÝÝœÛÛ‹\˜[\ÊNÂˆ[œÝ›Ü[ÛœÈHY‹›Ü[ÛœÎÂŸJNÂ™[˜Ý[Ûˆ[š[ÛŠÜ[ÛœË\˜[\ÊHÂˆ™]\›ˆ™]È›Ù[š[ÛŠÂˆ\Nˆ[š[Ûˆ‹ˆÜ[ÛœÎˆÜ[ÛœËˆ‹‹››Ü›X[^™T\˜[\Ê\˜[\ÊKˆJNÂŸB˜ÛÛœÝ›Ù[\œÙXÝ[ÛˆHÊ×ÔT‘W×Ê‹È	ÛÛœÝXÝÜŠ–›Ù[\œÙXÝ[Ûˆ‹
[œÝYŠHOˆÂˆ	›Ù[\œÙXÝ[Û‹š[š]
[œÝYŠNÂˆ›Ù\Kš[š]
[œÝYŠNÂˆ[œÝ—Þ›Ùœ›ØÙ\ÜÒ”ÓÓ”ØÚ[XHH
ÝœÛÛ‹\˜[\ÊHOˆ[\œÙXÝ[Û”›ØÙ\ÜÛÜŠ[œÝÝœÛÛ‹\˜[\ÊNÂŸJNÂ™[˜Ý[Ûˆ[\œÙXÝ[ÛŠYšYÚ
HÂˆ™]\›ˆ™]È›Ù[\œÙXÝ[ÛŠÂˆ\Nˆš[\œÙXÝ[Ûˆ‹ˆYˆYˆšYÚˆšYÚˆJNÂŸB˜ÛÛœÝ›Ù[[HHÊ×ÔT‘W×Ê‹È	ÛÛœÝXÝÜŠ–›Ù[[H‹
[œÝYŠHOˆÂˆ	›Ù[[Kš[š]
[œÝYŠNÂˆ›Ù\Kš[š]
[œÝYŠNÂˆ[œÝ—Þ›Ùœ›ØÙ\ÜÒ”ÓÓ”ØÚ[XHH
ÝœÛÛ‹\˜[\ÊHOˆ[[T›ØÙ\ÜÛÜŠ[œÝÝœÛÛŠNÂˆ[œÝ™[[HHY‹™[šY\ÎÂˆËÈ™]\ÙHH\œÙY˜[YHÙ]ÛÈH[Y\šXÈÈ[[IÜÈ™]™\œÙK[X\[™ÈÙ^\ÈÝ^HÝ]ˆ[œÝ›Ü[ÛœÈHË‹‹š[œÝ—Þ›Ù˜[Y\×NÂˆÛÛœÝÙ^\ÈH™]ÈÙ]
Øš™XÝšÙ^\ÊY‹™[šY\ÊJNÂˆ[œÝ™^˜XÝH
˜[Y\Ë\˜[\ÊHOˆÂˆÛÛœÝ™]Ñ[šY\ÈHßNÂˆ›Üˆ
ÛÛœÝ˜[YHÙˆ˜[Y\ÊHÂˆYˆ
Ù^\Ëš\Ê˜[YJJHÂˆ™]Ñ[šY\ÖÝ˜[YWHHY‹™[šY\ÖÝ˜[YWNÂˆBˆ[ÙBˆ›ÝÈ™]È\œ›ÜŠÙ^H	Ý˜[Y_H›Ý›Ý[™[ˆ[[X
NÂˆBˆ™]\›ˆ™]È›Ù[[JÂˆ‹‹™Y‹ˆÚXÚÜÎˆ×Kˆ‹‹››Ü›X[^™T\˜[\Ê\˜[\ÊKˆ[šY\Îˆ™]Ñ[šY\ËˆJNÂˆNÂˆ[œÝ™^ÛYHH
˜[Y\Ë\˜[\ÊHOˆÂˆÛÛœÝ™]Ñ[šY\ÈHÈ‹‹™Y‹™[šY\ÈNÂˆ›Üˆ
ÛÛœÝ˜[YHÙˆ˜[Y\ÊHÂˆYˆ
Ù^\Ëš\Ê˜[YJJHÂˆ[]H™]Ñ[šY\ÖÝ˜[YWNÂˆBˆ[ÙBˆ›ÝÈ™]È\œ›ÜŠÙ^H	Ý˜[Y_H›Ý›Ý[™[ˆ[[X
NÂˆBˆ™]\›ˆ™]È›Ù[[JÂˆ‹‹™Y‹ˆÚXÚÜÎˆ×Kˆ‹‹››Ü›X[^™T\˜[\Ê\˜[\ÊKˆ[šY\Îˆ™]Ñ[šY\ËˆJNÂˆNÂŸJNÂ™[˜Ý[ÛˆÙ[[J˜[Y\Ë\˜[\ÊHÂˆÛÛœÝ[šY\ÈH\œ˜^Kš\Ð\œ˜^J˜[Y\ÊHÈØš™XÝ™œ›ÛQ[šY\Ê˜[Y\Ë›X\

ŠHOˆÝ‹—JJHˆ˜[Y\ÎÂˆ™]\›ˆ™]È›Ù[[JÂˆ\Nˆ™[[H‹ˆ[šY\Ëˆ‹‹››Ü›X[^™T\˜[\Ê\˜[\ÊKˆJNÂŸB˜ÛÛœÝ›Ù˜[œÙ›Ü›HHÊ×ÔT‘W×Ê‹È	ÛÛœÝXÝÜŠ–›Ù˜[œÙ›Ü›H‹
[œÝYŠHOˆÂˆÙ[œÝ\™QY˜][Y[[Ú^™\Š
NÂˆ	›Ù˜[œÙ›Ü›Kš[š]
[œÝYŠNÂˆ›Ù\Kš[š]
[œÝYŠNÂˆ[œÝ—Þ›Ùœ›ØÙ\ÜÒ”ÓÓ”ØÚ[XHH
ÝœÛÛ‹\˜[\ÊHOˆ˜[œÙ›Ü›T›ØÙ\ÜÛÜŠ[œÝÝœÛÛ‹\˜[\ÊNÂˆ[œÝ—Þ›Ùœ\œÙHH
^[ØYØÝ
HOˆÂˆYˆ
ØÝ™\™XÝ[ÛˆOOH˜˜XÚÝØ\™ŠHÂˆ›ÝÈ™]È	›Ù[˜ÛÙQ\œ›ÜŠ[œÝ˜ÛÛœÝXÝÜ‹›˜[YJNÂˆBˆ^[ØY˜Y\ÜÝYHH
\ÜÝYIJHOˆÂˆYˆ
\[Ùˆ\ÜÝYIHOOHœÝš[™ÈŠHÂˆ^[ØYš\ÜÝY\Ëœ\Ú
\ÜÝYJ\ÜÝYIK^[ØY˜[YKYŠJNÂˆBˆ[ÙHÂˆËÈ›Üˆ›ÙÈ˜XÚÝØ\™ÈÛÛ\]Xš[]BˆÛÛœÝÚ\ÜÝYHH\ÜÝYINÂˆYˆ
Ú\ÜÝYK™˜][
BˆÚ\ÜÝYK˜ÛÛ[YHH˜[ÙNÂˆÚ\ÜÝYK˜ÛÙHÏÈ
Ú\ÜÝYK˜ÛÙHH˜Ý\ÝÛHŠNÂˆYˆ
Jš[œ]ˆ[ˆÚ\ÜÝYJJBˆÚ\ÜÝYKš[œ]H^[ØY˜[YNÂˆÚ\ÜÝYKš[œÝÏÈ
Ú\ÜÝYKš[œÝH[œÝ
NÂˆËÈÚ\ÜÝYK˜ÛÛ[YHÏÏHYNÂˆ^[ØYš\ÜÝY\Ëœ\Ú
\ÜÝYJÚ\ÜÝYJJNÂˆBˆNÂˆÛÛœÝÝ]]HY‹˜[œÙ›Ü›J^[ØY˜[YK^[ØY
NÂˆYˆ
Ý]][œÝ[˜Ù[Ùˆ›ÛZ\ÙJHÂˆ™]\›ˆÝ]][Š
Ý]]
HOˆÂˆ^[ØY˜[YHHÝ]]Âˆ™]\›ˆ^[ØYÂˆJNÂˆBˆ^[ØY˜[YHHÝ]]Âˆ™]\›ˆ^[ØYÂˆNÂŸJNÂ™[˜Ý[Ûˆ˜[œÙ›Ü›J›ŠHÂˆ™]\›ˆ™]È›Ù˜[œÙ›Ü›JÂˆ\Nˆ˜[œÙ›Ü›H‹ˆ˜[œÙ›Ü›Nˆ›‹ˆJNÂŸB˜ÛÛœÝ›ÙÜ[Û˜[HÊ×ÔT‘W×Ê‹È	ÛÛœÝXÝÜŠ–›ÙÜ[Û˜[‹
[œÝYŠHOˆÂˆ	›ÙÜ[Û˜[š[š]
[œÝYŠNÂˆ›Ù\Kš[š]
[œÝYŠNÂˆ[œÝ—Þ›Ùœ›ØÙ\ÜÒ”ÓÓ”ØÚ[XHH
ÝœÛÛ‹\˜[\ÊHOˆÜ[Û˜[›ØÙ\ÜÛÜŠ[œÝÝœÛÛ‹\˜[\ÊNÂˆ[œÝ[Ü˜\H

HOˆ[œÝ—Þ›Ù™Y‹š[›™\•\NÂŸJNÂ™[˜Ý[ÛˆÜ[Û˜[
[›™\•\JHÂˆ™]\›ˆ™]È›ÙÜ[Û˜[
Âˆ\Nˆ›Ü[Û˜[‹ˆ[›™\•\Nˆ[›™\•\KˆJNÂŸB˜ÛÛœÝ›Ù^XÝÜ[Û˜[HÊ×ÔT‘W×Ê‹È	ÛÛœÝXÝÜŠ–›Ù^XÝÜ[Û˜[‹
[œÝYŠHOˆÂˆ	›Ù^XÝÜ[Û˜[š[š]
[œÝYŠNÂˆ›Ù\Kš[š]
[œÝYŠNÂˆ[œÝ—Þ›Ùœ›ØÙ\ÜÒ”ÓÓ”ØÚ[XHH
ÝœÛÛ‹\˜[\ÊHOˆÜ[Û˜[›ØÙ\ÜÛÜŠ[œÝÝœÛÛ‹\˜[\ÊNÂˆ[œÝ[Ü˜\H

HOˆ[œÝ—Þ›Ù™Y‹š[›™\•\NÂŸJNÂ™[˜Ý[Ûˆ^XÝÜ[Û˜[
[›™\•\JHÂˆ™]\›ˆ™]È›Ù^XÝÜ[Û˜[
Âˆ\Nˆ›Ü[Û˜[‹ˆ[›™\•\Nˆ[›™\•\KˆJNÂŸB˜ÛÛœÝ›Ù[X›HHÊ×ÔT‘W×Ê‹È	ÛÛœÝXÝÜŠ–›Ù[X›H‹
[œÝYŠHOˆÂˆ	›Ù[X›Kš[š]
[œÝYŠNÂˆ›Ù\Kš[š]
[œÝYŠNÂˆ[œÝ—Þ›Ùœ›ØÙ\ÜÒ”ÓÓ”ØÚ[XHH
ÝœÛÛ‹\˜[\ÊHOˆ[X›T›ØÙ\ÜÛÜŠ[œÝÝœÛÛ‹\˜[\ÊNÂˆ[œÝ[Ü˜\H

HOˆ[œÝ—Þ›Ù™Y‹š[›™\•\NÂŸJNÂ™[˜Ý[Ûˆ[X›J[›™\•\JHÂˆ™]\›ˆ™]È›Ù[X›JÂˆ\Nˆ›[X›H‹ˆ[›™\•\Nˆ[›™\•\KˆJNÂŸB˜ÛÛœÝ›ÙY˜][HÊ×ÔT‘W×Ê‹È	ÛÛœÝXÝÜŠ–›ÙY˜][‹
[œÝYŠHOˆÂˆ	›ÙY˜][š[š]
[œÝYŠNÂˆ›Ù\Kš[š]
[œÝYŠNÂˆ[œÝ—Þ›Ùœ›ØÙ\ÜÒ”ÓÓ”ØÚ[XHH
ÝœÛÛ‹\˜[\ÊHOˆY˜][›ØÙ\ÜÛÜŠ[œÝÝœÛÛ‹\˜[\ÊNÂˆ[œÝ[Ü˜\H

HOˆ[œÝ—Þ›Ù™Y‹š[›™\•\NÂˆ[œÝœ™[[Ý™QY˜][H[œÝ[Ü˜\ÂŸJNÂ™[˜Ý[ÛˆÙY˜][
[›™\•\KY˜][˜[YJHÂˆ™]\›ˆ™]È›ÙY˜][
Âˆ\Nˆ™Y˜][‹ˆ[›™\•\Nˆ[›™\•\KˆÙ]Y˜][˜[YJ
HÂˆ™]\›ˆ\[ÙˆY˜][˜[YHOOH™[˜Ý[ÛˆˆÈY˜][˜[YJ
HˆÚ[ÝÐÛÛ™JY˜][˜[YJNÂˆKˆJNÂŸB˜ÛÛœÝ›Ù™Y˜][HÊ×ÔT‘W×Ê‹È	ÛÛœÝXÝÜŠ–›Ù™Y˜][‹
[œÝYŠHOˆÂˆ	›Ù™Y˜][š[š]
[œÝYŠNÂˆ›Ù\Kš[š]
[œÝYŠNÂˆ[œÝ—Þ›Ùœ›ØÙ\ÜÒ”ÓÓ”ØÚ[XHH
ÝœÛÛ‹\˜[\ÊHOˆ™Y˜][›ØÙ\ÜÛÜŠ[œÝÝœÛÛ‹\˜[\ÊNÂˆ[œÝ[Ü˜\H

HOˆ[œÝ—Þ›Ù™Y‹š[›™\•\NÂŸJNÂ™[˜Ý[Ûˆ™Y˜][
[›™\•\KY˜][˜[YJHÂˆ™]\›ˆ™]È›Ù™Y˜][
Âˆ\Nˆœ™Y˜][‹ˆ[›™\•\Nˆ[›™\•\KˆÙ]Y˜][˜[YJ
HÂˆ™]\›ˆ\[ÙˆY˜][˜[YHOOH™[˜Ý[ÛˆˆÈY˜][˜[YJ
HˆÚ[ÝÐÛÛ™JY˜][˜[YJNÂˆKˆJNÂŸB˜ÛÛœÝ›Ù›Û“Ü[Û˜[HÊ×ÔT‘W×Ê‹È	ÛÛœÝXÝÜŠ–›Ù›Û“Ü[Û˜[‹
[œÝYŠHOˆÂˆ	›Ù›Û“Ü[Û˜[š[š]
[œÝYŠNÂˆ›Ù\Kš[š]
[œÝYŠNÂˆ[œÝ—Þ›Ùœ›ØÙ\ÜÒ”ÓÓ”ØÚ[XHH
ÝœÛÛ‹\˜[\ÊHOˆ›Û›Ü[Û˜[›ØÙ\ÜÛÜŠ[œÝÝœÛÛ‹\˜[\ÊNÂˆ[œÝ[Ü˜\H

HOˆ[œÝ—Þ›Ù™Y‹š[›™\•\NÂŸJNÂ™[˜Ý[Ûˆ›Û›Ü[Û˜[
[›™\•\K\˜[\ÊHÂˆ™]\›ˆ™]È›Ù›Û“Ü[Û˜[
Âˆ\Nˆ››Û›Ü[Û˜[‹ˆ[›™\•\Nˆ[›™\•\Kˆ‹‹››Ü›X[^™T\˜[\Ê\˜[\ÊKˆJNÂŸB˜ÛÛœÝ›ÙØ]ÚHÊ×ÔT‘W×Ê‹È	ÛÛœÝXÝÜŠ–›ÙØ]Ú‹
[œÝYŠHOˆÂˆ	›ÙØ]Úš[š]
[œÝYŠNÂˆ›Ù\Kš[š]
[œÝYŠNÂˆ[œÝ—Þ›Ùœ›ØÙ\ÜÒ”ÓÓ”ØÚ[XHH
ÝœÛÛ‹\˜[\ÊHOˆØ]Ú›ØÙ\ÜÛÜŠ[œÝÝœÛÛ‹\˜[\ÊNÂˆ[œÝ[Ü˜\H

HOˆ[œÝ—Þ›Ù™Y‹š[›™\•\NÂˆ[œÝœ™[[Ý™PØ]ÚH[œÝ[Ü˜\ÂŸJNÂ™[˜Ý[ÛˆØØ]Ú
[›™\•\KØ]Ú˜[YJHÂˆ™]\›ˆ™]È›ÙØ]Ú
Âˆ\Nˆ˜Ø]Ú‹ˆ[›™\•\Nˆ[›™\•\KˆØ]Ú˜[YNˆ
\[ÙˆØ]Ú˜[YHOOH™[˜Ý[ÛˆˆÈØ]Ú˜[YHˆÛÛœÝ[Ø]Ú
Ø]Ú˜[YJJKˆJNÂŸB˜ÛÛœÝ›Ù\HHÊ×ÔT‘W×Ê‹È	ÛÛœÝXÝÜŠ–›Ù\H‹
[œÝYŠHOˆÂˆ	›Ù\Kš[š]
[œÝYŠNÂˆ›Ù\Kš[š]
[œÝYŠNÂˆ[œÝ—Þ›Ùœ›ØÙ\ÜÒ”ÓÓ”ØÚ[XHH
ÝœÛÛ‹\˜[\ÊHOˆ\T›ØÙ\ÜÛÜŠ[œÝÝœÛÛ‹\˜[\ÊNÂˆ[œÝš[ˆHY‹š[ŽÂˆ[œÝ›Ý]HY‹›Ý]ÂŸJNÂ™[˜Ý[Ûˆ\J[—ËÝ]
HÂˆ™]\›ˆ™]È›Ù\JÂˆ\Nˆœ\H‹ˆ[Žˆ[—ËˆÝ]ˆÝ]ˆËÈ‹‹][››Ü›X[^™T\˜[\Ê\˜[\ÊKˆJNÂŸB˜ÛÛœÝ›Ù™XYÛ›HHÊ×ÔT‘W×Ê‹È	ÛÛœÝXÝÜŠ–›Ù™XYÛ›H‹
[œÝYŠHOˆÂˆ	›Ù™XYÛ›Kš[š]
[œÝYŠNÂˆ›Ù\Kš[š]
[œÝYŠNÂˆ[œÝ—Þ›Ùœ›ØÙ\ÜÒ”ÓÓ”ØÚ[XHH
ÝœÛÛ‹\˜[\ÊHOˆ™XYÛ›T›ØÙ\ÜÛÜŠ[œÝÝœÛÛ‹\˜[\ÊNÂˆ[œÝ[Ü˜\H

HOˆ[œÝ—Þ›Ù™Y‹š[›™\•\NÂŸJNÂ™[˜Ý[Ûˆ™XYÛ›J[›™\•\JHÂˆ™]\›ˆ™]È›Ù™XYÛ›JÂˆ\Nˆœ™XYÛ›H‹ˆ[›™\•\Nˆ[›™\•\KˆJNÂŸB˜ÛÛœÝ›ÙÝ\ÝÛHHÊ×ÔT‘W×Ê‹È	ÛÛœÝXÝÜŠ–›ÙÝ\ÝÛH‹
[œÝYŠHOˆÂˆ	›ÙÝ\ÝÛKš[š]
[œÝYŠNÂˆ›Ù\Kš[š]
[œÝYŠNÂˆ[œÝ—Þ›Ùœ›ØÙ\ÜÒ”ÓÓ”ØÚ[XHH
ÝœÛÛ‹\˜[\ÊHOˆÝ\ÝÛT›ØÙ\ÜÛÜŠ[œÝÝœÛÛ‹\˜[\ÊNÂŸJNÂ™[˜Ý[ÛˆÝ\ÝÛJ›‹Ü\˜[\ÊHÂˆ™]\›ˆØÝ\ÝÛJ›ÙÝ\ÝÛK›ˆÏÈ


HOˆYJKÜ\˜[\ÊNÂŸB™[˜Ý[Ûˆ™Yš[™J›‹Ü\˜[\ÈHßJHÂˆ™]\›ˆÜ™Yš[™J›ÙÝ\ÝÛK›‹Ü\˜[\ÊNÂŸB‹ËÈÝ\\”™Yš[™B™[˜Ý[ÛˆÝ\\”™Yš[™J›‹\˜[\ÊHÂˆ™]\›ˆÜÝ\\”™Yš[™J›‹\˜[\ÊNÂŸB‚˜ÛÛœÝ˜\ÚXÐ]]ØÚ[XHHØš™XÝ
Âˆ[XZ[ˆÝš[™Ê
Kˆ\UÚÙ[ŽˆÝš[™Ê
KŸJBˆœÝšXÝ

NÂ˜ÛÛœÝÐ]]”ØÚ[XHHØš™XÝ
ÂˆÊŠˆHÝ\œ™[Ð]]‹ŒXØÙ\ÜÈÚÙ[‹ˆÜ[Û˜[Ú[ˆ™Yœ™\ÚÜ™Y[X[È\™HÝ\YYˆ
‹ÂˆXØÙ\ÜÕÚÙ[ŽˆÝš[™Ê
K›Ü[Û˜[

KˆÊŠ‚ˆ
ˆH›Ý][™ÈÐ]]‹Œ™Yœ™\ÚÚÙ[‹ˆ]\ÜÚX[ˆ™]\›œÈH‘UÈ™Yœ™\ÚÚÙ[ˆÛˆ]™\žH™Yœ™\Ú[™[˜[Y]\ÈBˆ
ˆ™]š[Ý\ÈÛ™H8 %\œÚ\ÝH›Ý]Y˜[YHšXHÛ•ÚÙ[”™Yœ™\Ú‚ˆ
‹Âˆ™Yœ™\ÚÚÙ[ŽˆÝš[™Ê
K›Ü[Û˜[

KˆÊŠˆÐ]]‹Œ\ÛY[Y
œ›ÛHH]™[Ü\ˆÛÛœÛÛJKˆ™\]Z\™Y›ÜˆÚÙ[ˆ™Yœ™\Úˆ
‹ÂˆÛY[YˆÝš[™Ê
K›Ü[Û˜[

KˆÊŠˆÐ]]‹Œ\ÛY[ÙXÜ™]ˆÙ\™\‹\ÚYHÛ›H8 %™]™\ˆÚ\ÈHœ›ÝÜÙ\‹ˆ™\]Z\™Y›ÜˆÚÙ[ˆ™Yœ™\Úˆ
‹ÂˆÛY[ÙXÜ™]ˆÝš[™Ê
K›Ü[Û˜[

KˆÊŠˆXØÙ\ÜË]ÚÙ[ˆ^\žH\ÈH[š^[Y\Ý[\[ˆZ[\ÙXÛÛ™È
K™Ëˆ]K››ÝÊ
H
È^\™\Ò[ˆ
ˆL
Kˆ
‹Âˆ^\™\Ð]ˆ[X™\Š
K›Ü[Û˜[

KˆÊŠˆ]\ÜÚX[ˆÛÝYYˆYˆÙ]ÚÚ\ÈHXØÙ\ÜÚX›K\™\ÛÝ\˜Ù\ØÛÚÝ\[™›Ý]\ÈšXHHTHØ]]Ø^Kˆ
‹ÂˆÛÝYYˆÝš[™Ê
K›Ü[Û˜[

KˆÊŠˆÚ]HT“
K™ËˆÎ‹ËÞ[Ý\‹YÛXZ[‹˜]\ÜÚX[‹›™]
H\ÙYÈ\Ø[XšYÝX]HÚXÚÛÝYYÈ™\ÛÛ™Kˆ
‹ÂˆÚ]U\›ˆÝš[™Ê
K›Ü[Û˜[

KˆÊŠ‚ˆ
ˆØ[YY\ˆ]™\žHÝXØÙ\ÜÙ[ÚÙ[ˆ™Yœ™\ÚÚ]H›Ý]YÜ™Y[X[Ëˆ\œÚ\Ý\ÙHÛÈH™^›ØÙ\ÜÈÝ\ˆ
ˆ\Ù\ÈH]\Ý™Yœ™\ÚÚÙ[‹ˆX^H™H\Þ[˜ÎÈ]ØZ]Y™Y›Ü™HH™\]Y\Ý›ØÙYYË‚ˆ
‹ÂˆÛ•ÚÙ[”™Yœ™\ÚˆÝ\ÝÛJ˜[YHOˆ\[Ùˆ˜[YHOOH	Ù[˜Ý[Û‰ËÂˆY\ÜØYÙNˆ	ØÛ•ÚÙ[”™Yœ™\Ú]\Ý™HH[˜Ý[Û‹‰ËˆJBˆ›Ü[Û˜[

KŸJBˆœÝšXÝ

Bˆœ™Yš[™J]HOˆ]K˜XØÙ\ÜÕÚÙ[ˆOOH[™Yš[™Yˆ
]Kœ™Yœ™\ÚÚÙ[ˆOOH[™Yš[™Y	‰ˆ]K˜ÛY[YOOH[™Yš[™Y	‰ˆ]K˜ÛY[ÙXÜ™]OOH[™Yš[™Y
KÂˆY\ÜØYÙNˆ	ÓÐ]]‹Œ™\]Z\™\ÈZ]\ˆ[ˆXØÙ\ÜÕÚÙ[˜ÜˆH[™Yœ™\ÚÜ™Y[X[Ù]
™Yœ™\ÚÚÙ[˜ÛY[YÛY[ÙXÜ™]
K‰ËŸJBˆœ™Yš[™J]HOˆÂˆÛÛœÝ[žT™Yœ™\ÚšY[H]Kœ™Yœ™\ÚÚÙ[ˆOOH[™Yš[™Y]K˜ÛY[YOOH[™Yš[™Y]K˜ÛY[ÙXÜ™]OOH[™Yš[™YÂˆYˆ
X[žT™Yœ™\ÚšY[
HÂˆ™]\›ˆYNÂˆBˆ™]\›ˆ]Kœ™Yœ™\ÚÚÙ[ˆOOH[™Yš[™Y	‰ˆ]K˜ÛY[YOOH[™Yš[™Y	‰ˆ]K˜ÛY[ÙXÜ™]OOH[™Yš[™YÂŸKÂˆY\ÜØYÙNˆ	ÕÚ[ˆ\Ú[™ÈÐ]]‹ŒÚÙ[ˆ™Yœ™\Ú™Yœ™\ÚÚÙ[˜ÛY[Y[™ÛY[ÙXÜ™]]\Ý[™H›ÝšYYÙÙ]\‹‰ËŸJNÂ˜ÛÛœÝ•ÕØÚ[XHHØš™XÝ
ÂˆÊŠˆHÙ^Hœ›ÛHH\\ØÜš\Ü‹ˆ
‹Âˆ\ÜÝY\ŽˆÝš[™Ê
KˆÊŠˆHÚ\™YÙXÜ™]™XÙZ]™Y\š[™ÈH\[œÝ[][Ûˆ[™ÚZÙKˆ
‹ÂˆÙXÜ™]ˆÝš[™Ê
KˆÊŠˆÚÙ[ˆ^\žH[YH
Y˜][ÈZ[]\ÈY\ˆ\ÜÝZ[™ÊKˆ
‹Âˆ^\žU[YTÙXÛÛ™Îˆ[X™\Š
K›Ü[Û˜[

KŸJBˆœÝšXÝ

NÂ˜ÛÛœÝZY]Ø\™\ÔØÚ[XHHØš™XÝ
ÂˆËÈ\Û[Y\ØX›K[™^[[™H\\ØÜš\Y\Û[Û›ËY^XÚ]X[žBˆÛ‘\œ›ÜŽˆÜ[Û˜[
[žJ
JKˆËÈ\Û[Y\ØX›K[™^[[™H\\ØÜš\Y\Û[Û›ËY^XÚ]X[žBˆÛ”™\ÜÛœÙNˆÜ[Û˜[
[žJ
JKŸJBˆœÝšXÝ

NÂ˜ÛÛœÝÛÛ™šYÔØÚ[XHHØš™XÝ
ÂˆÜÝˆÝš[™Ê
K\›

K›Ü[Û˜[

KˆÝšXÝÑŽˆ›ÛÛX[Š
K›Ü[Û˜[

KˆÊŠˆYÈ	ÖP]\ÜÚX[‹UÚÙ[‰Îˆ	Û›ËXÚXÚÉØÈXXÚ™\]Y\ÝXY\ˆ
‹Âˆ›ÐÚXÚÐ]\ÜÚX[•ÚÙ[Žˆ›ÛÛX[Š
K›Ü[Û˜[

Kˆ˜\ÙT™\]Y\ÝÛÛ™šYÎˆ[žJ
K›Ü[Û˜[

Kˆ]][XØ][ÛŽˆ[š[ÛŠÛØš™XÝ
È˜\ÚXÎˆ˜\ÚXÐ]]ØÚ[XHJKØš™XÝ
ÈØ]]ŽˆÐ]]”ØÚ[XHJKØš™XÝ
ÈÝˆ•ÕØÚ[XHJWJBˆ›Ü[Û˜[

KˆZY]Ø\™\ÎˆZY]Ø\™\ÔØÚ[XK›Ü[Û˜[

KŸJBˆœÝšXÝ

NÂ‚‹ÊŠˆÛÜ\šYÚHÛÙHØ\ÈZÙ[ˆœ›ÛHHÜ[‹ËÝÝÝËÙXÛÛÚ]š[™›ËÚ˜]˜\ØÜš\X˜\ÙMš[
‹Â˜ÛÛœÝ˜\ÙMÙ\]Y[˜ÙHH	ÐPÑQ‘ÒR’ÓS“ÔT”ÕU•ÖV˜X˜ÙY™ÚZšÛ[›Ü\œÝ]Þ^ŒLŒÍMÎJËÏIÎÂ˜ÛÛœÝ]Ž[˜ÛÙHH
˜[YJHOˆÂˆ˜[YHH˜[YKœ™\XÙJ×—‹ÙË	×‰ÊNÂˆ]]^H	ÉÎÂˆ›Üˆ
]ˆHÈˆ˜[YK›[™ÝÈŠÊÊHÂˆÛÛœÝÈH˜[YK˜Ú\ÛÙP]
ŠNÂˆYˆ
ÈLŽ
HÂˆ]^
ÏHÝš[™Ë™œ›ÛPÚ\ÛÙJÊNÂˆBˆ[ÙHYˆ
ÈˆLÈ	‰ˆÈŒ
HÂˆ]^
ÏHÝš[™Ë™œ›ÛPÚ\ÛÙJ
ÈˆŠHNLŠNÂˆ]^
ÏHÝš[™Ë™œ›ÛPÚ\ÛÙJ
È	ˆŒÊHLŽ
NÂˆBˆ[ÙHÂˆ]^
ÏHÝš[™Ë™œ›ÛPÚ\ÛÙJ
ÈˆLŠHŒ
NÂˆ]^
ÏHÝš[™Ë™œ›ÛPÚ\ÛÙJ

ÈˆŠH	ˆŒÊHLŽ
NÂˆ]^
ÏHÝš[™Ë™œ›ÛPÚ\ÛÙJ
È	ˆŒÊHLŽ
NÂˆBˆBˆ™]\›ˆ]^ÂŸNÂ˜ÛÛœÝ[˜ÛÙHH
[œ]
HOˆÂˆ]Ý]]H	ÉÎÂˆ]ÚŒNÂˆ]ÚŒŽÂˆ]ÚŒÎÂˆ][˜ÌNÂˆ][˜ÌŽÂˆ][˜ÌÎÂˆ][˜ÍÂˆ]HHÂˆ[œ]H]Ž[˜ÛÙJ[œ]
NÂˆÚ[H
H[œ]›[™Ý
HÂˆÚŒHH[œ]˜Ú\ÛÙP]
JÊÊNÂˆÚŒˆH[œ]˜Ú\ÛÙP]
JÊÊNÂˆÚŒÈH[œ]˜Ú\ÛÙP]
JÊÊNÂˆ[˜ÌHHÚŒHˆŽÂˆ[˜ÌˆH

ÚŒH	ˆÊH
H
ÚŒˆˆ
NÂˆ[˜ÌÈH

ÚŒˆ	ˆMJHŠH
ÚŒÈˆŠNÂˆ[˜ÍHÚŒÈ	ˆŒÎÂˆYˆ
\Ó˜SŠÚŒŠJHÂˆ[˜ÌÈH[˜ÍHÂˆBˆ[ÙHYˆ
\Ó˜SŠÚŒÊJHÂˆ[˜ÍHÂˆBˆÝ]]
ÏH	Ø˜\ÙMÙ\]Y[˜ÙK˜Ú\]
[˜ÌJ_IØ˜\ÙMÙ\]Y[˜ÙK˜Ú\]
[˜ÌŠ_IØ˜\ÙMÙ\]Y[˜ÙK˜Ú\]
[˜ÌÊ_IØ˜\ÙMÙ\]Y[˜ÙK˜Ú\]
[˜Í
_XÂˆBˆ™]\›ˆÝ]]ÂŸNÂ˜ÛÛœÝÐ˜\ÙM\›H
˜\ÙM
HOˆ˜\ÙMœ™\XÙJ×
ËÙË	ËIÊKœ™\XÙJ×ËÙË	×ÉÊKœ™\XÙJÏJÉË	ÉÊNÂ‹ÊŠˆ˜\ÙM\›Y[˜ÛÙHHU‹NÝš[™È
™]\Ù\ÈH^\Ý[™ÈU‹NX]Ø\™H[˜ÛÙX
Kˆ›Üˆ•ÕXY\‹ØÛZ[\Ëˆ
‹Â˜ÛÛœÝ[˜ÛÙP˜\ÙM\›H
[œ]
HOˆÐ˜\ÙM\›
[˜ÛÙJ[œ]
JNÂ‹ÊŠˆ˜\ÙM\›Y[˜ÛÙH˜]Èž]\È
K™Ëˆ[ˆPPÈÚYÛ˜]\™JKˆ\ÛÛ[ÜœXÈšXHHÛØ˜[ØXˆ
‹Â˜ÛÛœÝž]\ÕÐ˜\ÙM\›H
ž]\ÊHOˆÂˆ]š[˜\žHH	ÉÎÂˆ›Üˆ
]HHÈHž]\Ë›[™ÝÈH
ÏHJHÂˆš[˜\žH
ÏHÝš[™Ë™œ›ÛPÚ\ÛÙJž]\ÖÚWJNÂˆBˆ™]\›ˆÐ˜\ÙM\›
ØJš[˜\žJJNÂŸNÂ‚™[˜Ý[ÛˆÜ™X]P˜\ÚXÐ]][XØ][Û•ÚÙ[Š]][XØ][Û‘]JHÂˆÛÛœÝÙÚ[ˆH]][XØ][Û‘]K™[XZ[ÂˆÛÛœÝÙXÜ™]H]][XØ][Û‘]K˜\UÚÙ[ŽÂˆÛÛœÝÚÙ[ˆH[˜ÛÙJ	ÛÙÚ[ŸN‰ÜÙXÜ™]X
NÂˆ™]\›ˆ˜\ÚXÈ	ÝÚÙ[ŸXÂŸB‚‹ÊŠˆH]Y\žK\Ýš[™È\˜[Y]\ˆ]]\Ý™H^ÛYYœ›ÛHH\Ú\ˆH]\ÜÚX[ˆ•ÕÜXËˆ
‹Â˜ÛÛœÝTÒÑVÓQQÔTSHH	ÚÝ	ÎÂ‹ÊŠˆY˜][ÚÙ[ˆY™][YNˆÈZ[]\Ë\È™XÛÛ[Y[™YžH]\ÜÚX[‹ˆ
‹Â˜ÛÛœÝQUSÑVT–WÕSQWÔÑPÓÓ‘ÈHNÂ‹ÊŠ‚ˆ
ˆ‘ÈÎNˆ\˜Ù[Y[˜ÛÙ[™Ëˆ[˜ÛÙUT’PÛÛ\Û™[X]™\ÈH	È

H
˜[™\ØØ\YÛÈÙH[˜ÛÙHÜÙH›Ý\‚ˆ
ˆÚ\˜XÝ\œÈ^XÚ]HÈX]Ú]\ÜÚX[‰ÜÈØ[›ÛšXØ[^˜][Û‹‚ˆ
‹Â™[˜Ý[Ûˆ[˜ÛÙT™˜ÌÎNŠ˜[YJHÂˆ™]\›ˆ[˜ÛÙUT’PÛÛ\Û™[
˜[YJKœ™\XÙJÖÈIÊ
J—KÙËÚ\ˆOˆ	IØÚ\‹˜Ú\ÛÙP]

KÔÝš[™ÊMŠKÕ\\Ø\ÙJ
_X
NÂŸB™[˜Ý[ÛˆØ[›ÛšXØ[^™SY]Ù
Y]Ù
HÂˆ™]\›ˆY]ÙÕ\\Ø\ÙJ
NÂŸB‹ÊŠ‚ˆ
ˆØ[›ÛšXØ[T’NˆXY[™ÈØ›È˜Z[[™ÈØ
[›\ÜÈH]\È\ÝØ
K[žH	˜[ˆH]™\XÙYÚ]ˆ
ˆ	L˜ˆ›Üˆš\˜HÛÝY\™H\È›ÈÛÛ^]ÛÈHØ[›ÛšXØ[T’H\ÈÚ[\HH]˜[YK‚ˆ
‹Â™[˜Ý[ÛˆØ[›ÛšXØ[^™U\šJ]˜[YJHÂˆYˆ
\]˜[YH]˜[YK›[™ÝOOH
HÂˆ™]\›ˆ	ËÉÎÂˆBˆ]]H]˜[YK˜Ú\]

HOOH	ËÉÈÈ]˜[YHˆÉÜ]˜[Y_XÂˆYˆ
]›[™ÝˆH	‰ˆ]™[™ÕÚ]
	ËÉÊJHÂˆ]H]œÛXÙJLJNÂˆBˆ™]\›ˆ]œ™\XÙJÉ‹ÙË	ÉL‰ÊNÂŸB‹ÊŠ‚ˆ
ˆØ[›ÛšXØ[]Y\žHÝš[™Îˆ\˜[Y]\œÈ
^ÛY[™ÈÝ
HÛÜYžH‘ÈÎN‹Y[˜ÛÙY˜[YKXXÚ\˜[Y]\‰ÜÈ˜[Y\Âˆ
ˆÛÜY[™‘ÈÎN‹Y[˜ÛÙY™\X]Y˜[Y\È›Ú[™YÚ][™˜[YO]˜[YXZ\œÈ›Ú[™YÚ]	˜ˆ›ÙBˆ
ˆ\˜[\È\™H™]™\ˆ[˜ÛYY‚ˆ
‹Â™[˜Ý[ÛˆØ[›ÛšXØ[^™T]Y\žTÝš[™ÊÙX\˜Ú\˜[\ÊHÂˆÛÛœÝÙ^\ÈHË‹‹›™]ÈÙ]
ÙX\˜Ú\˜[\ËšÙ^\Ê
JWK™š[\ŠÙ^HOˆÙ^HOOHTÒÑVÓQQÔTSJKœÛÜ

NÂˆ™]\›ˆÙ^\Âˆ›X\
Ù^HOˆÂˆÛÛœÝ˜[YHHÙX\˜Ú\˜[\Ë™Ù][
Ù^JKœÛÜ

K›X\
[˜ÛÙT™˜ÌÎNŠKš›Ú[Š	Ë	ÊNÂˆ™]\›ˆ	Ù[˜ÛÙT™˜ÌÎNŠÙ^J_OIÝ˜[Y_XÂˆJBˆš›Ú[Š	É‰ÊNÂŸB‹ÊŠˆÒKLMˆ^ÙˆQUÑ	˜Ø[›ÛšXØ[\šI˜Ø[›ÛšXØ[]Y\žTÝš[™Ø\Ú[™È\ÛÛ[ÜœXÈÙXÜž\Ëˆ
‹Â˜\Þ[˜È[˜Ý[ÛˆÜ™X]T]Y\žTÝš[™Ò\Ú
Y]Ù\›
HÂˆÛÛœÝ\œÙYH™]ÈT“
\›
NÂˆÛÛœÝØ[›ÛšXØ[™\]Y\ÝHÂˆØ[›ÛšXØ[^™SY]Ù
Y]Ù
KˆØ[›ÛšXØ[^™U\šJ\œÙYœ]˜[YJKˆØ[›ÛšXØ[^™T]Y\žTÝš[™Ê\œÙYœÙX\˜Ú\˜[\ÊKˆKš›Ú[Š	É‰ÊNÂˆÛÛœÝYÙ\ÝH]ØZ]ÛØ˜[\Ë˜Üž\ËœÝXK™YÙ\Ý
	ÔÒKLM‰Ë™]È^[˜ÛÙ\Š
K™[˜ÛÙJØ[›ÛšXØ[™\]Y\Ý
JNÂˆ™]\›ˆË‹‹›™]ÈZ[\œ˜^JYÙ\Ý
WK›X\
ž]HOˆž]KÔÝš[™ÊMŠKœYÝ\
‹	Ì	ÊJKš›Ú[Š	ÉÊNÂŸB‹ÊŠˆPPËTÒLMˆÚYÛ‹˜\ÙM\›Y[˜ÛÙY\Ú[™È\ÛÛ[ÜœXÈÙXÜž\Ëˆ
‹Â˜\Þ[˜È[˜Ý[ÛˆÚYÛ’ÌMŠÚYÛš[™Ò[œ]ÙXÜ™]
HÂˆÛÛœÝÙ^HH]ØZ]ÛØ˜[\Ë˜Üž\ËœÝXKš[\ÜÙ^J	Ü˜]ÉË™]È^[˜ÛÙ\Š
K™[˜ÛÙJÙXÜ™]
KÈ˜[YNˆ	ÒPPÉË\Úˆ	ÔÒKLM‰ÈK˜[ÙKÉÜÚYÛ‰×JNÂˆÛÛœÝÚYÛ˜]\™HH]ØZ]ÛØ˜[\Ë˜Üž\ËœÝXKœÚYÛŠ	ÒPPÉËÙ^K™]È^[˜ÛÙ\Š
K™[˜ÛÙJÚYÛš[™Ò[œ]
JNÂˆ™]\›ˆž]\ÕÐ˜\ÙM\›
™]ÈZ[\œ˜^JÚYÛ˜]\™JJNÂŸB˜\Þ[˜È[˜Ý[ÛˆÜ™X]R•Õ]][XØ][ÛŠ]][XØ][Û‘]K™\]Y\Ý]JHÂˆÛÛœÝÈY]Ù\›HH™\]Y\Ý]NÂˆÛÛœÝ›ÝÈHX]™›ÛÜŠ]K››ÝÊ
HÈL
NÂˆÛÛœÝ^\™HH›ÝÈ
È
]][XØ][Û‘]K™^\žU[YTÙXÛÛ™ÈÏÈQUSÑVT–WÕSQWÔÑPÓÓ‘ÊNÂˆÛÛœÝXY\ˆHÈ\ˆ	Ò•Õ	Ë[Îˆ	ÒÌM‰ÈNÂˆÛÛœÝÛZ[\ÈHÂˆ\ÜÎˆ]][XØ][Û‘]Kš\ÜÝY\‹ˆX]ˆ›ÝËˆ^ˆ^\™Kˆ\Úˆ]ØZ]Ü™X]T]Y\žTÝš[™Ò\Ú
Y]Ù\›
KˆNÂˆÛÛœÝÚYÛš[™Ò[œ]H	Ù[˜ÛÙP˜\ÙM\›
”ÓÓ‹œÝš[™ÚYžJXY\ŠJ_K‰Ù[˜ÛÙP˜\ÙM\›
”ÓÓ‹œÝš[™ÚYžJÛZ[\ÊJ_XÂˆÛÛœÝÚYÛ˜]\™HH]ØZ]ÚYÛ’ÌMŠÚYÛš[™Ò[œ]]][XØ][Û‘]KœÙXÜ™]
NÂˆ™]\›ˆ•Õ	ÜÚYÛš[™Ò[œ]K‰ÜÚYÛ˜]\™_XÂŸB‚™[˜Ý[ÛˆÜ™X]SÐ]]]][XØ][Û•ÚÙ[Š]][XØ][Û‘]JHÂˆ™]\›ˆ™X\™\ˆ	Ø]][XØ][Û‘]K˜XØÙ\ÜÕÚÙ[ŸXÂŸB‚˜\Þ[˜È[˜Ý[ÛˆÙ]]][XØ][Û•ÚÙ[Š]][XØ][Û‹™\]Y\Ý]JHÂˆYˆ
X]][XØ][ÛŠHÂˆ™]\›ˆ[™Yš[™YÂˆBˆYˆ
	Ø˜\ÚXÉÈ[ˆ]][XØ][ÛŠHÂˆ™]\›ˆÜ™X]P˜\ÚXÐ]][XØ][Û•ÚÙ[Š]][XØ][Û‹˜˜\ÚXÊNÂˆBˆYˆ
	ÚÝ	È[ˆ]][XØ][ÛŠHÂˆYˆ
\™\]Y\Ý]JHÂˆ›ÝÈ™]È\œ›ÜŠ	Ò•Õ]][XØ][Ûˆ™\]Z\™\È™\]Y\Ý]H
Y]Ù[™\›
HÈÛÛ\]HH]Y\žK\Ýš[™È\Ú‰ÊNÂˆBˆ™]\›ˆÜ™X]R•Õ]][XØ][ÛŠ]][XØ][Û‹šÝ™\]Y\Ý]JNÂˆBˆYˆ
X]][XØ][Û‹›Ø]]‹˜XØÙ\ÜÕÚÙ[ŠHÂˆ›ÝÈ™]È\œ›ÜŠ	ÓÐ]]‹Œ]][XØ][ÛˆÚ]Ý]]]Ë\™Yœ™\Ú™\]Z\™\È[ˆXØÙ\ÜÕÚÙ[˜‰ÊNÂˆBˆ™]\›ˆÜ™X]SÐ]]]][XØ][Û•ÚÙ[Š]][XØ][Û‹›Ø]]ŠNÂŸB‚˜ÛÛœÝÒÑS—ÕT“H	ÚÎ‹ËØ]]˜]\ÜÚX[‹˜ÛÛKÛØ]]ÝÚÙ[‰ÎÂ˜ÛÛœÝPÐÑTÔÒP“WÔ‘TÓÕTÑT×ÕT“H	ÚÎ‹ËØ\K˜]\ÜÚX[‹˜ÛÛKÛØ]]ÝÚÙ[‹ØXØÙ\ÜÚX›K\™\ÛÝ\˜Ù\ÉÎÂ˜ÛÛœÝ”ÓÓ—ÒPQT”ÈHÈ	ÐÛÛ[U\IÎˆ	Ø\XØ][Û‹ÚœÛÛ‰ËXØÙ\ˆ	Ø\XØ][Û‹ÚœÛÛ‰ÈNÂ™[˜Ý[ÛˆX\ÚÙ[”™\ÜÛœÙJ]JHÂˆ™]\›ˆÂˆXØÙ\ÜÕÚÙ[Žˆ]K˜XØÙ\Ü×ÝÚÙ[‹ˆ™Yœ™\ÚÚÙ[Žˆ]Kœ™Yœ™\ÚÝÚÙ[‹ˆ^\™\Ò[Žˆ]K™^\™\×Ú[‹ˆØÛÜNˆ]KœØÛÜKˆÚÙ[•\Nˆ]KÚÙ[—Ý\KˆNÂŸB‹ÊŠ‚ˆ
ˆ\ÜÝYHH™\]Y\ÝÚ]H˜]]™H™]Ú[™™]\›ˆH\œÙY”ÓÓˆ›ÙKˆ[›ZÙH^[ÜË™]ÚÙ\Âˆ
ˆ›Ý™Z™XÝÛˆH›Û‹LžÝ]\ËÛÈHÝ]\È\ÈÚXÚÙY^XÚ]H[™H\ØÜš\]™H\œ›Üˆ\È›ÝÛ‹‚ˆ
‹Â˜\Þ[˜È[˜Ý[Ûˆ™\]Y\ÝœÛÛŠ\›[š]
HÂˆÛÛœÝ™\ÜÛœÙHH]ØZ]™]Ú
\›[š]
NÂˆYˆ
\™\ÜÛœÙK›ÚÊHÂˆÛÛœÝ›ÙHH]ØZ]™\ÜÛœÙK^

K˜Ø]Ú


HOˆ	ÉÊNÂˆ›ÝÈ™]È\œ›ÜŠ™\]Y\ÝÈ	Ý\›H˜Z[YÚ]Ý]\È	Ü™\ÜÛœÙKœÝ]\ßH	Ü™\ÜÛœÙKœÝ]\Õ^IØ›ÙHÈˆ	Ø›Ù_Xˆ	ÉßX
NÂˆBˆ™]\›ˆ™\ÜÛœÙKšœÛÛŠ
NÂŸB‹ÊŠ‚ˆ
ˆ™Yœ™\Ú[ˆXØÙ\ÜÈÚÙ[‹ˆ]\ÜÚX[ˆ›Ý]\ÈH™Yœ™\ÚÚÙ[ˆÛˆ]™\žHØ[8 %\œÚ\ÝH™]\›™Yˆ
ˆ™Yœ™\ÚÚÙ[˜[™\ØØ\™HÛÛ™K‚ˆ
‹Â˜\Þ[˜È[˜Ý[Ûˆ™Yœ™\ÚÐ]]•ÚÙ[Š\˜[\ÊHÂˆÛÛœÝ]HH]ØZ]™\]Y\ÝœÛÛŠÒÑS—ÕT“ÂˆY]Ùˆ	ÔÔÕ	ËˆXY\œÎˆ”ÓÓ—ÒPQT”Ëˆ›ÙNˆ”ÓÓ‹œÝš[™ÚYžJÂˆÜ˜[Ý\Nˆ	Ü™Yœ™\ÚÝÚÙ[‰ËˆÛY[ÚYˆ\˜[\Ë˜ÛY[YˆÛY[ÜÙXÜ™]ˆ\˜[\Ë˜ÛY[ÙXÜ™]ˆ™Yœ™\ÚÝÚÙ[Žˆ\˜[\Ëœ™Yœ™\ÚÚÙ[‹ˆJKˆJNÂˆ™]\›ˆX\ÚÙ[”™\ÜÛœÙJ]JNÂŸB‹ÊŠˆ\ÝHš\˜HÚ]\ÈHXØÙ\ÜÈÚÙ[ˆØ[ˆ™XXÚˆHYÙˆXXÚ[žH\È]ÈÛÝYYˆ
‹Â˜\Þ[˜È[˜Ý[ÛˆÙ]XØÙ\ÜÚX›T™\ÛÝ\˜Ù\ÊXØÙ\ÜÕÚÙ[ŠHÂˆ™]\›ˆ™\]Y\ÝœÛÛŠPÐÑTÔÒP“WÔ‘TÓÕTÑT×ÕT“ÂˆY]Ùˆ	ÑÑU	ËˆXY\œÎˆÈ]]Üš^˜][ÛŽˆ™X\™\ˆ	ØXØÙ\ÜÕÚÙ[ŸXXØÙ\ˆ	Ø\XØ][Û‹ÚœÛÛ‰ÈKˆJNÂŸB‚˜ÛÛœÝÐUUÐVWÐTÑHH	ÚÎ‹ËØ\K˜]\ÜÚX[‹˜ÛÛKÙ^Úš\˜IÎÂ‹ÊŠˆ™Yœ™\Ú\ÈX[žH\È™Y›Ü™H^\™\Ð]ÈXœÛÜ˜ˆÛØÚÈÚÙ]ÈÈ[‹Y›YÚ][˜ÞKˆ
‹Â˜ÛÛœÝVT–WÔÒÑU×ÓTÈHŒÌÂ˜Û\ÜÈÐ]]“X[˜YÙ\ˆÂˆXØÙ\ÜÕÚÙ[ŽÂˆ™Yœ™\ÚÚÙ[ŽÂˆ^\™\Ð]ÂˆÛÝYYÂˆÛY[YÂˆÛY[ÙXÜ™]ÂˆÚ]U\›ÂˆÛ•ÚÙ[”™Yœ™\ÚÂˆÊŠˆÚ[™ÛKY›YÚÝX\™Îˆ][ÜÝÛ™H[‹Y›YÚ™Yœ™\ÚÈÛÝYY™\ÛÛ][Ûˆ]H[YKˆ
‹Âˆ™Yœ™\Ú›ÛZ\ÙNÂˆÛÝYY›ÛZ\ÙNÂˆÛÛœÝXÝÜŠÜ[ÛœÊHÂˆ\Ë˜XØÙ\ÜÕÚÙ[ˆHÜ[ÛœË˜XØÙ\ÜÕÚÙ[ŽÂˆ\Ëœ™Yœ™\ÚÚÙ[ˆHÜ[ÛœËœ™Yœ™\ÚÚÙ[ŽÂˆ\Ë™^\™\Ð]HÜ[ÛœË™^\™\Ð]Âˆ\Ë˜ÛÝYYHÜ[ÛœË˜ÛÝYYÂˆ\Ë˜ÛY[YHÜ[ÛœË˜ÛY[YÂˆ\Ë˜ÛY[ÙXÜ™]HÜ[ÛœË˜ÛY[ÙXÜ™]Âˆ\ËœÚ]U\›HÜ[ÛœËœÚ]U\›Âˆ\Ë›Û•ÚÙ[”™Yœ™\ÚHÜ[ÛœË›Û•ÚÙ[”™Yœ™\ÚÂˆBˆØ[”™Yœ™\Ú

HÂˆ™]\›ˆ\Ëœ™Yœ™\ÚÚÙ[ˆOOH[™Yš[™Y	‰ˆ\Ë˜ÛY[YOOH[™Yš[™Y	‰ˆ\Ë˜ÛY[ÙXÜ™]OOH[™Yš[™YÂˆBˆÊŠˆ™X\™\ˆÚÙ[˜›ØXÝ]™[H™Yœ™\Ú[™ÈYˆHÚÙ[ˆ\ÈZ\ÜÚ[™ÈÜˆÚ][ˆHÚÙ]ÈÚ[™ÝÈÙˆ^\žKˆ
‹Âˆ\Þ[˜ÈÙ]]]Üš^˜][Û’XY\Š
HÂˆÛÛœÝÚÙ[ˆH]ØZ]\Ë™[œÝ\™PXØÙ\ÜÕÚÙ[Š
NÂˆ™]\›ˆ™X\™\ˆ	ÝÚÙ[ŸXÂˆBˆÊŠˆHTKYØ]]Ø^H˜\ÙHT“›ÜˆH™\ÛÛ™YÛÝYY
Î‹ËØ\K˜]\ÜÚX[‹˜ÛÛKÙ^Úš\˜KÞØÛÝYYX
Kˆ
‹Âˆ\Þ[˜ÈÙ]˜\ÙU\›

HÂˆÛÛœÝÛÝYYH]ØZ]\Ëœ™\ÛÛ™PÛÝYY

NÂˆ™]\›ˆ	ÑÐUUÐVWÐTÑ_KÉØÛÝYYXÂˆBˆÊŠˆ›Ü˜ÙHH™Yœ™\Ú™YØ\™\ÜÈÙˆ^\žH
\ÙYžHHH™]žH]
KˆÚ[™ÛKY›YÚYˆ
‹Âˆ\Þ[˜È›Ü˜ÙT™Yœ™\Ú

HÂˆ™]\›ˆ\Ëœ™Yœ™\Ú

NÂˆBˆ™YYÔ™Yœ™\Ú

HÂˆYˆ
]\Ë˜Ø[”™Yœ™\Ú

JHÂˆ™]\›ˆ˜[ÙNÂˆBˆYˆ
\Ë˜XØÙ\ÜÕÚÙ[ˆOOH[™Yš[™Y
HÂˆ™]\›ˆYNÂˆBˆYˆ
\Ë™^\™\Ð]OOH[™Yš[™Y
HÂˆ™]\›ˆ˜[ÙNÂˆBˆ™]\›ˆ]K››ÝÊ
HH\Ë™^\™\Ð]HVT–WÔÒÑU×ÓTÎÂˆBˆ\Þ[˜È[œÝ\™PXØÙ\ÜÕÚÙ[Š
HÂˆYˆ
\Ë›™YYÔ™Yœ™\Ú

JHÂˆ]ØZ]\Ëœ™Yœ™\Ú

NÂˆBˆYˆ
\Ë˜XØÙ\ÜÕÚÙ[ˆOOH[™Yš[™Y
HÂˆ›ÝÈ™]È\œ›ÜŠ	Ó›ÈÐ]]‹ŒXØÙ\ÜÈÚÙ[ˆ\È]˜Z[X›H[™]Ø[››Ý™H™Yœ™\ÚYˆ›ÝšYH[ˆXØÙ\ÜÕÚÙ[˜Üˆ[™Yœ™\ÚÜ™Y[X[È
™Yœ™\ÚÚÙ[˜ÛY[YÛY[ÙXÜ™]
K‰ÊNÂˆBˆ™]\›ˆ\Ë˜XØÙ\ÜÕÚÙ[ŽÂˆBˆ\Þ[˜È™Yœ™\Ú

HÂˆYˆ
\Ëœ™Yœ™\Ú›ÛZ\ÙJHÂˆ™]\›ˆ\Ëœ™Yœ™\Ú›ÛZ\ÙNÂˆBˆ\Ëœ™Yœ™\Ú›ÛZ\ÙHH\Ë™Ô™Yœ™\Ú

NÂˆžHÂˆ]ØZ]\Ëœ™Yœ™\Ú›ÛZ\ÙNÂˆBˆš[˜[HÂˆ\Ëœ™Yœ™\Ú›ÛZ\ÙHH[™Yš[™YÂˆBˆBˆ\Þ[˜ÈÔ™Yœ™\Ú

HÂˆYˆ
]\Ë˜Ø[”™Yœ™\Ú

JHÂˆ›ÝÈ™]È\œ›ÜŠ	ÐØ[››Ý™Yœ™\ÚHÐ]]‹ŒXØÙ\ÜÈÚÙ[Žˆ™Yœ™\ÚÚÙ[˜ÛY[Y[™ÛY[ÙXÜ™]\™H™\]Z\™Y‰ÊNÂˆBˆÛÛœÝ™\ÜÛœÙHH]ØZ]™Yœ™\ÚÐ]]•ÚÙ[ŠÂˆÛY[Yˆ\Ë˜ÛY[YˆÛY[ÙXÜ™]ˆ\Ë˜ÛY[ÙXÜ™]ˆ™Yœ™\ÚÚÙ[Žˆ\Ëœ™Yœ™\ÚÚÙ[‹ˆJNÂˆ\Ë˜XØÙ\ÜÕÚÙ[ˆH™\ÜÛœÙK˜XØÙ\ÜÕÚÙ[ŽÂˆYˆ
™\ÜÛœÙKœ™Yœ™\ÚÚÙ[ŠHÂˆ\Ëœ™Yœ™\ÚÚÙ[ˆH™\ÜÛœÙKœ™Yœ™\ÚÚÙ[ŽÂˆBˆ\Ë™^\™\Ð]H]K››ÝÊ
H
È™\ÜÛœÙK™^\™\Ò[ˆ
ˆLÂˆ]ØZ]\Ë›Û•ÚÙ[”™Yœ™\ÚËŠÂˆXØÙ\ÜÕÚÙ[Žˆ\Ë˜XØÙ\ÜÕÚÙ[‹ˆ™Yœ™\ÚÚÙ[Žˆ\Ëœ™Yœ™\ÚÚÙ[‹ˆ^\™\Ð]ˆ\Ë™^\™\Ð]ˆJNÂˆBˆ\Þ[˜È™\ÛÛ™PÛÝYY

HÂˆYˆ
\Ë˜ÛÝYYOOH[™Yš[™Y
HÂˆ™]\›ˆ\Ë˜ÛÝYYÂˆBˆYˆ
\Ë˜ÛÝYY›ÛZ\ÙJHÂˆ™]\›ˆ\Ë˜ÛÝYY›ÛZ\ÙNÂˆBˆ\Ë˜ÛÝYY›ÛZ\ÙHH
\Þ[˜È

HOˆÂˆÛÛœÝÚÙ[ˆH]ØZ]\Ë™[œÝ\™PXØÙ\ÜÕÚÙ[Š
NÂˆÛÛœÝ™\ÛÝ\˜Ù\ÈH]ØZ]Ù]XØÙ\ÜÚX›T™\ÛÝ\˜Ù\ÊÚÙ[ŠNÂˆÛÛœÝ™\ÛÝ\˜ÙHH\ËœÙ[XÝ™\ÛÝ\˜ÙJ™\ÛÝ\˜Ù\ÊNÂˆ\Ë˜ÛÝYYH™\ÛÝ\˜ÙKšYÂˆ™]\›ˆ™\ÛÝ\˜ÙKšYÂˆJJ
NÂˆžHÂˆ™]\›ˆ]ØZ]\Ë˜ÛÝYY›ÛZ\ÙNÂˆBˆš[˜[HÂˆ\Ë˜ÛÝYY›ÛZ\ÙHH[™Yš[™YÂˆBˆBˆÙ[XÝ™\ÛÝ\˜ÙJ™\ÛÝ\˜Ù\ÊHÂˆYˆ
™\ÛÝ\˜Ù\Ë›[™ÝOOH
HÂˆ›ÝÈ™]È\œ›ÜŠ	Ó›ÈXØÙ\ÜÚX›Hš\˜H™\ÛÝ\˜Ù\ÈÙ\™H™]\›™Y›Üˆ\ÈÐ]]‹ŒÚÙ[‹ˆÚXÚÈHÜ˜[YØÛÜ\È[™]H\Ù\ˆ\ÈXØÙ\ÜÈÈ]X\ÝÛ™Hš\˜HÚ]K‰ÊNÂˆBˆYˆ
\ËœÚ]U\›OOH[™Yš[™Y
HÂˆÛÛœÝ\™Ù]HÐ]]“X[˜YÙ\‹››Ü›X[^™U\›
\ËœÚ]U\›
NÂˆÛÛœÝX]ÚH™\ÛÝ\˜Ù\Ë™š[™
™\ÛÝ\˜ÙHOˆÐ]]“X[˜YÙ\‹››Ü›X[^™U\›
™\ÛÝ\˜ÙK\›
HOOH\™Ù]
NÂˆYˆ
[X]Ú
HÂˆ›ÝÈ™]È\œ›ÜŠ›ÈXØÙ\ÜÚX›H™\ÛÝ\˜ÙHX]Ú\ÈÚ]U\›‰Ý\ËœÚ]U\›H‹ˆ]˜Z[X›Nˆ	Ü™\ÛÝ\˜Ù\Ë›X\
ˆOˆ‹\›
Kš›Ú[Š	Ë	Ê_K˜
NÂˆBˆ™]\›ˆX]ÚÂˆBˆYˆ
™\ÛÝ\˜Ù\Ë›[™ÝˆJHÂˆ›ÝÈ™]È\œ›ÜŠ][\HXØÙ\ÜÚX›Hš\˜H™\ÛÝ\˜Ù\È›Ý[™È\ÜÈÚ]U\›ÜˆÛÝYYÈ\Ø[XšYÝX]Kˆ]˜Z[X›Nˆ	Ü™\ÛÝ\˜Ù\Ë›X\
ˆOˆ‹\›
Kš›Ú[Š	Ë	Ê_K˜
NÂˆBˆ™]\›ˆ™\ÛÝ\˜Ù\ÖÌNÂˆBˆÝ]XÈ›Ü›X[^™U\›
\›
HÂˆ™]\›ˆ\›œ™\XÙJ×ÊÉË	ÉÊKÓÝÙ\Ø\ÙJ
NÂˆBŸB‚‹Êˆ\Û[Y\ØX›H\\ØÜš\Y\Û[Û›ËY^XÚ]X[žH
‹Â˜ÛÛœÝ\Õ[™Yš[™YH
ØšŠHOˆ\[ÙˆØšˆOOH	Ý[™Yš[™Y	ÎÂ˜ÛÛœÝ\Óš[H
˜[
HOˆ\Õ[™Yš[™Y
˜[
H˜[OOH[Â˜ÛÛœÝ\ÓØš™XÝH
›ŠHOˆZ\Óš[
›ŠH	‰ˆ\[Ùˆ›ˆOOH	ÛØš™XÝ	ÎÂ˜ÛÛœÝ\ÔÝš[™ÈH
˜[
HOˆ\[Ùˆ˜[OOH	ÜÝš[™ÉÎÂ˜ÛÛœÝ\Ó[X™\ˆH
˜[
HOˆ\[Ùˆ˜[OOH	Û[X™\‰ÎÂ˜ÛÛœÝQUSÑVÑTSÓ—ÔÕUTÈHLÂ˜ÛÛœÝQUSÑVÑTSÓ—ÓQTÔÐQÑHH	ÔÛÛY][™ÈÙ[Ü›Û™ÉÎÂ˜ÛÛœÝQUSÑVÑTSÓ—ÐÓÑHH	ÒS•T“SÔÑT•‘T—ÑT”“Ô‰ÎÂ˜ÛÛœÝQUSÑVÑTSÓ—ÔÕUT×ÕVH	Ò[\›˜[Ù\™\ˆ\œ›Ü‰ÎÂ‹ÊŠˆYš[™\ÈH˜\ÙH^Ù\[Û‹ÚXÚ\È[™YžHHY˜][^Ù\[ÛœÈ[™\‹ˆ
‹Â˜Û\ÜÈ^Ù\[Ûˆ^[™È\œ›ÜˆÂˆ™\ÜÛœÙNÂˆÊŠ‚ˆ
ˆ[œÝ[X]HHZ[ˆ^Ù\[Û‹‚ˆ
‚ˆ
ˆ^[\Bˆ
ˆ›ÝÈ™]È^Ù\[ÛŠ	ÛY\ÜØYÙIËÝ]\ËQÔ‘TUQTÕ
NÂˆ
ˆ›ÝÈ™]È^Ù\[ÛŠ	ØÝ\ÝÛHY\ÜØYÙIËÝ]\ËQÔ‘TUQTÕÂˆ
ˆØ]\ÙNˆ™]È\œ›ÜŠ	ÐØ]\ÙH\œ›Ü‰ÊKˆ
ˆJNÂˆ
‚ˆ
ˆ\˜[H™\ÜÛœÙHÝš[™ËØš™XÝ\ØÜšXš[™ÈH\œ›ÜˆÛÛ™][ÛˆÜˆH\œ›ÜˆØ]\ÙK‚ˆ
ˆ\˜[HÝ]\È™\ÜÛœÙHÝ]\ÈÛÙK‚ˆ
ˆ\˜[HÜ[ÛœÈ[ˆØš™XÝ\ÙYÈY[ˆ\œ›ÜˆØ]\ÙKˆÛÛ™šYÝ\™\È\œ›ÜˆÚZ[š[™ÈÝ\Üˆ
ˆ\ØYÙS›Ý\Âˆ
ˆHÛÛœÝXÝÜˆ\™Ý[Y[ÈYš[™HH™\ÜÛœÙH[™H™\ÜÛœÙHÝ]\ÈÛÙK‚ˆ
ˆHH™\ÜÛœÙX\™Ý[Y[
™\]Z\™Y
HYš[™\ÈH”ÓÓˆ™\ÜÛœÙH›ÙKˆ[\›˜]]™[K]Ø[ˆ[ÛÈ™Bˆ
ˆ[ˆ\œ›ÜˆØš™XÝ]\È\ÙYÈYš[™H[ˆ\œ›ÜˆØØ]\ÙWJÎ‹ËÛ›ÙZœË›Ü™ËÙ[‹Ø›ÙËÜ™[X\ÙKÝŒM‹ŽKŒÈÙ\œ›Ü‹XØ]\ÙJK‚ˆ
ˆHHÝ]\Ø\™Ý[Y[
Ü[Û˜[
HYš[™\ÈHÝ]\ÈÛÙK‚ˆ
ˆHHÜ[ÛœØ\™Ý[Y[
Ü[Û˜[
HYš[™\ÈY][Û˜[\œ›ÜˆÜ[ÛœËˆÝ\œ™[K]Ý\ÜÈHØ]\ÙX]šX]Kˆ
ˆ[™Ø[ˆ™H\ÙY\È[ˆ[\›˜]]™HØ^HÈÜXÚYžHH\œ›ÜˆØ]\ÙNˆÛÛœÝ\œ›ÜˆH™]È^Ù\[ÛŠ	Ù\ØÜš\[Û‰ËÈØ]\ÙNˆ™]È\œ›ÜŠ
HJNØˆ
‚ˆ
ˆžHY˜][H”ÓÓˆ™\ÜÛœÙH›ÙHÛÛZ[œÈÛÈ›Ü\Y\Î‚ˆ
ˆHÝ]\ÐÛÙXˆHÝ]\ÈÛÙK‚ˆ
ˆHY\ÜØYÙXˆHÚÜ\ØÜš\[ÛˆÙˆH\œ›ÜˆžHY˜][ÈÝ™\œšYH\Âˆ
ˆžHÝ\Z[™ÈHÝš[™È[ˆH™\ÜÛœÙX\˜[Y]\‹‚ˆ
‚ˆ
ˆHÝ]\Ø\™Ý[Y[\È™\]Z\™Y[™ÚÝ[™HH˜[YÝ]\ÈÛÙK‚ˆ
ˆ™\Ý˜XÝXÙH\ÈÈ\ÙHHÝ]\Ø[[H[\ÜYœ›ÛH™\ÝœËØÛÛ[[Û˜‚ˆ
ˆÙYHÎ‹ËÛ›ÙZœË›Ü™ËÙ[‹Ø›ÙËÜ™[X\ÙKÝŒM‹ŽKŒÈÙ\œ›Ü‹XØ]\ÙBˆ
ˆÙYHÎ‹ËÙÚ]X‹˜ÛÛKÛZXÜ›ÜÛÙÕ\TØÜš\Ú\ÜÝY\ËÍLMÂˆ
‹ÂˆÛÛœÝXÝÜŠ™\ÜÛœÙKÝ]\ËÜ[ÛœÊHÂˆÝ\\Š
NÂˆ\Ëœ™\ÜÛœÙHH™\ÜÛœÙNÂˆ\Ë›˜[YHH\Ëš[š]˜[YJ
NÂˆ\Ë˜Ø]\ÙHH\Ëš[š]Ø]\ÙJ™\ÜÛœÙKÜ[ÛœÊNÂˆ\Ë˜ÛÙHH\Ëš[š]ÛÙJ™\ÜÛœÙJNÂˆ\Ë›Y\ÜØYÙHH\Ëš[š]Y\ÜØYÙJ™\ÜÛœÙJNÂˆ\ËœÝ]\ÈH\Ëš[š]Ý]\Ê™\ÜÛœÙKÝ]\ÊNÂˆ\ËœÝ]\Õ^H\Ëš[š]Ý]\Õ^
™\ÜÛœÙK\ËœÝ]\ÊNÂˆBˆØ]\ÙNÂˆÛÙNÂˆÝ]\ÎÂˆÝ]\Õ^Âˆ[š]Y\ÜØYÙJ™\ÜÛœÙJHÂˆYˆ
\ÔÝš[™Ê™\ÜÛœÙJJHÂˆ™]\›ˆ™\ÜÛœÙNÂˆBˆYˆ
\ÓØš™XÝ
™\ÜÛœÙJH	‰ˆ\ÔÝš[™Ê™\ÜÛœÙK›Y\ÜØYÙJJHÂˆ™]\›ˆ™\ÜÛœÙK›Y\ÜØYÙNÂˆBˆËÈ\Û[Y\ØX›K[™^[[™H\\ØÜš\Y\Û[Û›Ë][›™XÙ\ÜØ\žKXÛÛ™][Û‚ˆYˆ
\Ë˜ÛÛœÝXÝÜŠHÂˆ™]\›ˆ\Ë˜ÛÛœÝXÝÜ‹›˜[YK›X]Ú
ÖÐKV—VØK^—JßÌNWJËÙÊOËš›Ú[Š	È	ÊHÏÈ	Ñ\œ›Ü‰ÎÂˆBˆ™]\›ˆQUSÑVÑTSÓ—ÓQTÔÐQÑNÂˆBˆ[š]Ø]\ÙJ™\ÜÛœÙKÜ[ÛœÊHÂˆYˆ
Ü[ÛœÏË˜Ø]\ÙJHÂˆ™]\›ˆÜ[ÛœË˜Ø]\ÙNÂˆBˆYˆ
\ÓØš™XÝ
™\ÜÛœÙJH	‰ˆ\ÓØš™XÝ
™\ÜÛœÙK˜Ø]\ÙJJHÂˆ™]\›ˆ™\ÜÛœÙK˜Ø]\ÙNÂˆBˆ™]\›ˆ[™Yš[™YÂˆBˆ[š]ÛÙJ™\ÜÛœÙJHÂˆYˆ
\ÓØš™XÝ
™\ÜÛœÙJH	‰ˆ\ÔÝš[™Ê™\ÜÛœÙK˜ÛÙJJHÂˆ™]\›ˆ™\ÜÛœÙK˜ÛÙNÂˆBˆ™]\›ˆQUSÑVÑTSÓ—ÐÓÑNÂˆBˆ[š]˜[YJ
HÂˆ™]\›ˆ\Ë˜ÛÛœÝXÝÜ‹›˜[YNÂˆBˆ[š]Ý]\Ê™\ÜÛœÙKÝ]\ÊHÂˆYˆ
Ý]\ÊHÂˆ™]\›ˆÝ]\ÎÂˆBˆYˆ
\ÓØš™XÝ
™\ÜÛœÙJH	‰ˆ\Ó[X™\Š™\ÜÛœÙKœÝ]\ÊJHÂˆ™]\›ˆ™\ÜÛœÙKœÝ]\ÎÂˆBˆYˆ
\ÓØš™XÝ
™\ÜÛœÙJH	‰ˆ\Ó[X™\Š™\ÜÛœÙKœÝ]\ÐÛÙJJHÂˆ™]\›ˆ™\ÜÛœÙKœÝ]\ÐÛÙNÂˆBˆ™]\›ˆQUSÑVÑTSÓ—ÔÕUTÎÂˆBˆ[š]Ý]\Õ^
™\ÜÛœÙKÝ]\ÊHÂˆYˆ
\ÓØš™XÝ
™\ÜÛœÙJH	‰ˆ\ÔÝš[™Ê™\ÜÛœÙKœÝ]\Õ^
JHÂˆ™]\›ˆ™\ÜÛœÙKœÝ]\Õ^ÂˆBˆ™]\›ˆÝ]\ÈÈ[™Yš[™YˆQUSÑVÑTSÓ—ÔÕUT×ÕVÂˆBŸB‚˜ÛÛœÝÕ’PÕÑÑ—Ñ“QÈH	ÞX]\ÜÚX[‹Y›Ü˜ÙKXXØÛÝ[ZY	ÎÂ˜ÛÛœÝUTÔÒPS—ÕÒÑS—ÐÒPÒ×Ñ“QÈH	ÖP]\ÜÚX[‹UÚÙ[‰ÎÂ˜ÛÛœÝUTÔÒPS—ÕÒÑS—ÐÒPÒ×Ó“ÐÒPÒ×ÕSQHH	Û›ËXÚXÚÉÎÂ˜Û\ÜÈ˜\ÙPÛY[ÂˆÛÛ™šYÎÂˆ[œÝ[˜ÙNÂˆØ]]“X[˜YÙ\ŽÂˆÛÛœÝXÝÜŠÛÛ™šYÊHÂˆ\Ë˜ÛÛ™šYÈHÛÛ™šYÎÂˆžHÂˆ\Ë˜ÛÛ™šYÈHÛÛ™šYÔØÚ[XKœ\œÙJÛÛ™šYÊNÂˆBˆØ]Ú
JHÂˆYˆ
H[œÝ[˜Ù[Ùˆ›Ù\œ›Üˆ	‰ˆKš\ÜÝY\ÖÌK›Y\ÜØYÙHOOH	Ò[˜[YT“	ÊHÂˆ›ÝÈ™]È\œ›ÜŠ	ÐÛÝ[—	Ý\œÙHHÜÝT“ˆ\š\È[ÝH›Ü™ÛÝÈY	Ú‹Ë×	ÈÜˆ	ÚÎ‹Ë×	È]H™YÚ[›š[™ÈÙˆHT“ÉËJNÂˆBˆ›ÝÈNÂˆBˆ\Ëš[œÝ[˜ÙHH^[ÜË˜Ü™X]JÂˆ\˜[\ÔÙ\šX[^™\Žˆ\Ëœ\˜[TÙ\šX[^™\‹˜š[™
\ÊKˆ‹‹˜ÛÛ™šYË˜˜\ÙT™\]Y\ÝÛÛ™šYËˆ˜\ÙUT“ˆÛÛ™šYËšÜÝˆXY\œÎˆ\Ëœ™[[Ý™U[™Yš[™Y›Ü\Y\ÊÂˆÔÕ’PÕÑÑ—Ñ“Q×NˆÛÛ™šYËœÝšXÝÑ‹ˆÐUTÔÒPS—ÕÒÑS—ÐÒPÒ×Ñ“Q×NˆÛÛ™šYË››ÐÚXÚÐ]\ÜÚX[•ÚÙ[ˆÈUTÔÒPS—ÕÒÑS—ÐÒPÒ×Ó“ÐÒPÒ×ÕSQHˆ[™Yš[™Yˆ‹‹˜ÛÛ™šYË˜˜\ÙT™\]Y\ÝÛÛ™šYÏËšXY\œËˆJKˆJNÂˆÛÛœÝØ]]ˆH\Ë˜ÛÛ™šYË˜]][XØ][Ûˆ	‰ˆ	ÛØ]]‰È[ˆ\Ë˜ÛÛ™šYË˜]][XØ][Û‚ˆÈ\Ë˜ÛÛ™šYË˜]][XØ][Û‹›Ø]]‚ˆˆ[™Yš[™YÂˆYˆ
]\Ë˜ÛÛ™šYËšÜÝ	‰ˆ[Ø]]ŠHÂˆ›ÝÈ™]È\œ›ÜŠ	ØÜÝ\È™\]Z\™Y[›\ÜÈ[ÝH\ÙHÐ]]‹ŒÚ]]]ÛX]XÈÛÝYY™\ÛÛ][Û‹ˆ›ÝšYHÜÝÜˆ\ÙH]][XØ][Û‹›Ø]]˜
Ü[Û˜[HÚ]ÛÝYYÜˆÚ]U\›
K‰ÊNÂˆBˆYˆ
Ø]]ŠHÂˆÛÛœÝ™YYÓX[˜YÙ\ˆHØ]]‹œ™Yœ™\ÚÚÙ[ˆOOH[™Yš[™YˆØ]]‹˜ÛÝYYOOH[™Yš[™YˆØ]]‹œÚ]U\›OOH[™Yš[™Yˆ\Ë˜ÛÛ™šYËšÜÝOOH[™Yš[™YÂˆYˆ
™YYÓX[˜YÙ\ŠHÂˆ\Ë›Ø]]“X[˜YÙ\ˆH™]ÈÐ]]“X[˜YÙ\ŠÂˆXØÙ\ÜÕÚÙ[ŽˆØ]]‹˜XØÙ\ÜÕÚÙ[‹ˆ™Yœ™\ÚÚÙ[ŽˆØ]]‹œ™Yœ™\ÚÚÙ[‹ˆÛY[YˆØ]]‹˜ÛY[YˆÛY[ÙXÜ™]ˆØ]]‹˜ÛY[ÙXÜ™]ˆ^\™\Ð]ˆØ]]‹™^\™\Ð]ˆÛÝYYˆØ]]‹˜ÛÝYYˆÚ]U\›ˆØ]]‹œÚ]U\›ˆÛ•ÚÙ[”™Yœ™\ÚˆØ]]‹›Û•ÚÙ[”™Yœ™\ÚˆJNÂˆBˆBˆBˆ\˜[TÙ\šX[^™\Š\˜[Y]\œÊHÂˆÛÛœÝ\ÈH×NÂˆØš™XÝ™[šY\Ê\˜[Y]\œÊK™›Ü‘XXÚ

ÚÙ^K˜[YWJHOˆÂˆYˆ
˜[YHOOH[\[Ùˆ˜[YHOOH	Ý[™Yš[™Y	ÊHÂˆ™]\›ŽÂˆBˆYˆ
\œ˜^Kš\Ð\œ˜^J˜[YJJHÂˆ˜[YHH˜[YKš›Ú[Š	Ë	ÊNÂˆBˆYˆ
˜[YH[œÝ[˜Ù[Ùˆ]JHÂˆ˜[YHH˜[YKÒTÓÔÝš[™Ê
NÂˆBˆ[ÙHYˆ
˜[YHOOH[	‰ˆ\[Ùˆ˜[YHOOH	ÛØš™XÝ	ÊHÂˆ˜[YHH”ÓÓ‹œÝš[™ÚYžJ˜[YJNÂˆBˆ[ÙHYˆ
˜[YH[œÝ[˜Ù[Ùˆ[˜Ý[ÛŠHÂˆÛÛœÝ\H˜[YJ
NÂˆ™]\›ˆ\	‰ˆ\Ëœ\Ú
\
NÂˆBˆ\Ëœ\Ú
	Ý\Ë™[˜ÛÙJÙ^J_OIÝ\Ë™[˜ÛÙJ˜[YJ_X
NÂˆJNÂˆ™]\›ˆ\Ëš›Ú[Š	É‰ÊNÂˆBˆ[˜ÛÙJ˜[YJHÂˆ™]\›ˆ[˜ÛÙUT’PÛÛ\Û™[
˜[YJBˆœ™\XÙJÉLÐKÙÚK	Î‰ÊBˆœ™\XÙJÉLÙË	É	ÊBˆœ™\XÙJÉLËÙÚK	Ë	ÊBˆœ™\XÙJÉLŒÙË	ÊÉÊBˆœ™\XÙJÉMP‹ÙÚK	ÖÉÊBˆœ™\XÙJÉMQÙÚK	×IÊNÂˆBˆ™[[Ý™U[™Yš[™Y›Ü\Y\ÊØšŠHÂˆ™]\›ˆØš™XÝ™[šY\ÊØšŠBˆ™š[\Š
Ë˜[YWJHOˆ\[Ùˆ˜[YHOOH	Ý[™Yš[™Y	ÊBˆœ™YXÙJ
XØÝ[][]Ü‹ÚÙ^K˜[YWJHOˆ
È‹‹˜XØÝ[][]Ü‹ÚÙ^WNˆ˜[YHJKßJNÂˆBˆ\Þ[˜ÈÙ[™™\]Y\Ý
™\]Y\ÝÛÛ™šYËØ[˜XÚÊHÂˆžHÂˆÛÛœÝ™\ÜÛœÙHH]ØZ]\ËœÙ[™™\]Y\Ý[™\ÜÛœÙJ™\]Y\ÝÛÛ™šYÊNÂˆ™]\›ˆ\Ëš[™TÝXØÙ\ÜÔ™\ÜÛœÙJ™\ÜÛœÙK™]KØ[˜XÚÊNÂˆBˆØ]Ú
JHÂˆ™]\›ˆ\Ëš[™Q˜Z[Y™\ÜÛœÙJKØ[˜XÚÊNÂˆBˆBˆ\Þ[˜ÈÙ[™™\]Y\Ý[™\ÜÛœÙJ™\]Y\ÝÛÛ™šYÊHÂˆžHÂˆ™]\›ˆ]ØZ]\Ë™^XÝ]T™\]Y\Ý
™\]Y\ÝÛÛ™šYÊNÂˆBˆØ]Ú
JHÂˆYˆ
\Ë›Ø]]“X[˜YÙ\Ë˜Ø[”™Yœ™\Ú

H	‰ˆ^[ÜËš\Ð^[ÜÑ\œ›ÜŠJH	‰ˆKœ™\ÜÛœÙOËœÝ]\ÈOOHJHÂˆ]ØZ]\Ë›Ø]]“X[˜YÙ\‹™›Ü˜ÙT™Yœ™\Ú

NÂˆ™]\›ˆ\Ë™^XÝ]T™\]Y\Ý
™\]Y\ÝÛÛ™šYÊNÂˆBˆ›ÝÈNÂˆBˆBˆ\Þ[˜È^XÝ]T™\]Y\Ý
™\]Y\ÝÛÛ™šYÊHÂˆ]]]Üš^˜][ÛŽÂˆ]˜\ÙUT“ÂˆYˆ
\Ë›Ø]]“X[˜YÙ\ŠHÂˆ]]Üš^˜][ÛˆH]ØZ]\Ë›Ø]]“X[˜YÙ\‹™Ù]]]Üš^˜][Û’XY\Š
NÂˆ˜\ÙUT“H]ØZ]\Ë›Ø]]“X[˜YÙ\‹™Ù]˜\ÙU\›

NÂˆBˆ[ÙHÂˆ]]Üš^˜][ÛˆH]ØZ]Ù]]][XØ][Û•ÚÙ[Š\Ë˜ÛÛ™šYË˜]][XØ][Û‹ÂˆY]Ùˆ™\]Y\ÝÛÛ™šYË›Y]ÙÏÈ	ÑÑU	Ëˆ\›ˆ\Ëš[œÝ[˜ÙK™Ù]\šJ™\]Y\ÝÛÛ™šYÊKˆJNÂˆBˆÛÛœÝ[ÙYšYY™\]Y\ÝÛÛ™šYÈHÂˆ‹‹œ™\]Y\ÝÛÛ™šYËˆ‹‹Š˜\ÙUT“ÈÈ˜\ÙUT“HˆßJKˆXY\œÎˆ\Ëœ™[[Ý™U[™Yš[™Y›Ü\Y\ÊÂˆ]]Üš^˜][ÛŽˆ]]Üš^˜][Û‹ˆ‹‹œ™\]Y\ÝÛÛ™šYËšXY\œËˆJKˆNÂˆ™]\›ˆ\Ëš[œÝ[˜ÙKœ™\]Y\Ý
[ÙYšYY™\]Y\ÝÛÛ™šYÊNÂˆBˆ[™TÝXØÙ\ÜÔ™\ÜÛœÙJ™\ÜÛœÙKØ[˜XÚÊHÂˆÛÛœÝØ[˜XÚÔ™\ÜÛœÙR[™\ˆHØ[˜XÚÈ	‰ˆ

]JHOˆØ[˜XÚÊ[]JJNÂˆÛÛœÝY˜][™\ÜÛœÙR[™\ˆH
]JHOˆ]NÂˆÛÛœÝ™\ÜÛœÙR[™\ˆHØ[˜XÚÔ™\ÜÛœÙR[™\ˆÏÈY˜][™\ÜÛœÙR[™\ŽÂˆ\Ë˜ÛÛ™šYË›ZY]Ø\™\ÏË›Û”™\ÜÛœÙOËŠ™\ÜÛœÙK™]JNÂˆ™]\›ˆ™\ÜÛœÙR[™\Š™\ÜÛœÙJNÂˆBˆ[™Q˜Z[Y™\ÜÛœÙJKØ[˜XÚÊHÂˆÛÛœÝ\œˆH\Ë˜Z[\œ›Ü’[™[™Ô™\ÜÛœÙJJNÂˆÛÛœÝØ[˜XÚÑ\œ›Ü’[™\ˆHØ[˜XÚÈ	‰ˆ

\œ›ÜŠHOˆØ[˜XÚÊ\œ›ÜŠJNÂˆÛÛœÝY˜][\œ›Ü’[™\ˆH
\œ›ÜŠHOˆÂˆ›ÝÈ\œ›ÜŽÂˆNÂˆÛÛœÝ\œ›Ü’[™\ˆHØ[˜XÚÑ\œ›Ü’[™\ˆÏÈY˜][\œ›Ü’[™\ŽÂˆ\Ë˜ÛÛ™šYË›ZY]Ø\™\ÏË›Û‘\œ›ÜËŠ\œŠNÂˆ™]\›ˆ\œ›Ü’[™\Š\œŠNÂˆBˆZ[\œ›Ü’[™[™Ô™\ÜÛœÙJJHÂˆYˆ
^[ÜËš\Ð^[ÜÑ\œ›ÜŠJH	‰ˆKœ™\ÜÛœÙJHÂˆ™]\›ˆ™]È^Ù\[ÛŠÂˆÛÙNˆK˜ÛÙKˆY\ÜØYÙNˆK›Y\ÜØYÙKˆ]NˆKœ™\ÜÛœÙK™]KˆÝ]\ÎˆKœ™\ÜÛœÙKœÝ]\ËˆÝ]\Õ^ˆKœ™\ÜÛœÙKœÝ]\Õ^ˆKKœ™\ÜÛœÙKœÝ]\ËÈØ]\ÙNˆHJNÂˆBˆYˆ
^[ÜËš\Ð^[ÜÑ\œ›ÜŠJJHÂˆ™]\›ˆNÂˆBˆYˆ
\ÓØš™XÝ
JH	‰ˆ\ÓØš™XÝ
Kœ™\ÜÛœÙJJHÂˆ™]\›ˆ™]È^Ù\[ÛŠKœ™\ÜÛœÙJNÂˆBˆYˆ
H[œÝ[˜Ù[Ùˆ\œ›ÜŠHÂˆ™]\›ˆ™]È^Ù\[ÛŠJNÂˆBˆ™]\›ˆ™]È^Ù\[ÛŠ	Õ[šÛ›ÝÛˆ\œ›ÜˆØØÝ\œ™Y‰ËLÈØ]\ÙNˆHJNÂˆBŸB‚˜\ˆZ[YU\\Ñ^ÜÈH™\]Z\™SZ[YU\\Ê
NÂ˜\ˆZ[YU\\ÈHÊ×ÔT‘W×Ê‹ÙÙ]Y˜][^Üœ›ÛPÚœÊZ[YU\\Ñ^ÜÊNÂ‚˜Û\ÜÈ[››Ý[˜Ù[Y[˜[›™\ˆÂˆÛY[ÂˆÛÛœÝXÝÜŠÛY[
HÂˆ\Ë˜ÛY[HÛY[ÂˆBˆ\Þ[˜ÈÙ]˜[›™\ŠØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ø[››Ý[˜Ù[Y[˜[›™\‰ËˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]˜[›™\Š\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ø[››Ý[˜Ù[Y[˜[›™\‰ËˆY]Ùˆ	ÔU	Ëˆ]NˆÂˆ\Ñ\ÛZ\ÜÚX›Nˆ\˜[Y]\œËš\Ñ\ÛZ\ÜÚX›Kˆ\Ñ[˜X›Yˆ\˜[Y]\œËš\Ñ[˜X›YˆY\ÜØYÙNˆ\˜[Y]\œË›Y\ÜØYÙKˆš\ÚXš[]Nˆ\˜[Y]\œËš\ÚXš[]KˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBŸB‚˜Û\ÜÈ\HÂˆÛY[ÂˆÛÛœÝXÝÜŠÛY[
HÂˆ\Ë˜ÛY[HÛY[ÂˆBˆ\Þ[˜ÈÙ]ÛÜšÛÙÜÐžR\ÜÝYRY[™ÛÜšÛÙÒY
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝÚ[\›˜[Ø\KÛ]\ÝÝÛÜšÛÙËØ[ÉËˆY]Ùˆ	ÔÔÕ	Ëˆ]NˆÂˆ™\]Y\ÝÎˆ\˜[Y]\œËœ™\]Y\ÝËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBŸB‚˜Û\ÜÈ\]TÛXÚY\ÈÂˆÛY[ÂˆÛÛœÝXÝÜŠÛY[
HÂˆ\Ë˜ÛY[HÛY[ÂˆBˆ\Þ[˜ÈÙ]ÛXÞJØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ù]K\ÛXÞIËˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]ÛXÚY\Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ù]K\ÛXÞKÜ›Ú™XÝ	ËˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆYÎˆ\˜[Y]\œÏËšYËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBŸB‚˜Û\ÜÈ\XØ][Û”›Û\ÈÂˆÛY[ÂˆÛÛœÝXÝÜŠÛY[
HÂˆ\Ë˜ÛY[HÛY[ÂˆBˆ\Þ[˜ÈÙ][\XØ][Û”›Û\ÊØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ø\XØ][Ûœ›ÛIËˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]\XØ][Û”›ÛJ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÙ^HH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËšÙ^NÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ø\XØ][Ûœ›ÛKÉÚÙ^_XˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBŸB‚˜Û\ÜÈ\ZYÜ˜][ÛˆÂˆÛY[ÂˆÛÛœÝXÝÜŠÛY[
HÂˆ\Ë˜ÛY[HÛY[ÂˆBˆ\Þ[˜È\]R\ÜÝYQšY[Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ]\ÜÚX[‹XÛÛ›™XÝÌKÛZYÜ˜][Û‹ÙšY[	ËˆY]Ùˆ	ÔU	ËˆXY\œÎˆÂˆ	Ð]\ÜÚX[‹PXØÛÝ[RY	Îˆ\˜[Y]\œË˜XØÛÝ[Yˆ	Ð]\ÜÚX[‹U˜[œÙ™\‹RY	Îˆ\˜[Y]\œË˜[œÙ™\’YˆKˆ]NˆÂˆ\]U˜[YS\Ýˆ\˜[Y]\œË\]U˜[YS\ÝˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È\]Q[]T›Ü\Y\Õ˜[YJ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ]\ÜÚX[‹XÛÛ›™XÝÌKÛZYÜ˜][Û‹Ü›Ü\Y\ËÉÜ\˜[Y]\œË™[]U\_XˆY]Ùˆ	ÔU	ËˆXY\œÎˆÂˆ	Ð]\ÜÚX[‹PXØÛÝ[RY	Îˆ\˜[Y]\œË˜XØÛÝ[Yˆ	Ð]\ÜÚX[‹U˜[œÙ™\‹RY	Îˆ\˜[Y]\œË˜[œÙ™\’Yˆ	ÐÛÛ[U\IÎˆ	Ø\XØ][Û‹ÚœÛÛ‰ËˆKˆ]Nˆ\˜[Y]\œË™[]Y\ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÛÜšÙ›ÝÔ[TÙX\˜Ú
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ]\ÜÚX[‹XÛÛ›™XÝÌKÛZYÜ˜][Û‹ÝÛÜšÙ›ÝËÜ[KÜÙX\˜Ú	ËˆY]Ùˆ	ÔÔÕ	ËˆXY\œÎˆÂˆ	Ð]\ÜÚX[‹U˜[œÙ™\‹RY	Îˆ\˜[Y]\œË˜[œÙ™\’YˆKˆ]NˆÂˆ^[™ˆ\˜[Y]\œË™^[™ˆ[RYÎˆ\˜[Y]\œËœ[RYËˆÛÜšÙ›ÝÑ[]RYˆ\˜[Y]\œËÛÜšÙ›ÝÑ[]RYˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBŸB‚˜Û\ÜÈ\›Ü\Y\ÈÂˆÛY[ÂˆÛÛœÝXÝÜŠÛY[
HÂˆ\Ë˜ÛY[HÛY[ÂˆBˆ\Þ[˜ÈÙ]YÛ”›Ü\Y\Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝYÛ’Ù^HH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œË˜YÛ’Ù^NÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ]\ÜÚX[‹XÛÛ›™XÝÌKØYÛœËÉØYÛ’Ù^_KÜ›Ü\Y\ØˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]YÛ”›Ü\J\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ]\ÜÚX[‹XÛÛ›™XÝÌKØYÛœËÉÜ\˜[Y]\œË˜YÛ’Ù^_KÜ›Ü\Y\ËÉÜ\˜[Y]\œËœ›Ü\RÙ^_XˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È]YÛ”›Ü\J\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ]\ÜÚX[‹XÛÛ›™XÝÌKØYÛœËÉÜ\˜[Y]\œË˜YÛ’Ù^_KÜ›Ü\Y\ËÉÜ\˜[Y]\œËœ›Ü\RÙ^_XˆY]Ùˆ	ÔU	Ëˆ]Nˆ\˜[Y]\œËœ›Ü\U˜[YKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È[]PYÛ”›Ü\J\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ]\ÜÚX[‹XÛÛ›™XÝÌKØYÛœËÉÜ\˜[Y]\œË˜YÛ’Ù^_KÜ›Ü\Y\ËÉÜ\˜[Y]\œËœ›Ü\RÙ^_XˆY]Ùˆ	ÑSUIËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]›Ü™ÙP\›Ü\RÙ^\ÊØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝÙ›Ü™ÙKÌKØ\Ü›Ü\Y\ÉËˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]›Ü™ÙP\›Ü\J\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝÙ›Ü™ÙKÌKØ\Ü›Ü\Y\ËÉÜ\˜[Y]\œËœ›Ü\RÙ^_XˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È]\›Ü\J\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝÙ›Ü™ÙKÌKØ\Ü›Ü\Y\ËÉÜ\˜[Y]\œËœ›Ü\RÙ^_XˆY]Ùˆ	ÔU	Ëˆ]Nˆ\˜[Y]\œËœ›Ü\U˜[YKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È[]P\›Ü\J\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝÙ›Ü™ÙKÌKØ\Ü›Ü\Y\ËÉÜ\˜[Y]\œËœ›Ü\RÙ^_XˆY]Ùˆ	ÑSUIËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBŸB‚˜Û\ÜÈ]Y]™XÛÜ™ÈÂˆÛY[ÂˆÛÛœÝXÝÜŠÛY[
HÂˆ\Ë˜ÛY[HÛY[ÂˆBˆ\Þ[˜ÈÙ]]Y]™XÛÜ™Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ø]Y][™ËÜ™XÛÜ™	ËˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆÙ™œÙ]ˆ\˜[Y]\œÏË›Ù™œÙ]ˆ[Z]ˆ\˜[Y]\œÏË›[Z]ˆš[\Žˆ\˜[Y]\œÏË™š[\‹ˆœ›ÛNˆ\˜[Y]\œÏË™œ›ÛKˆÎˆ\˜[Y]\œÏËËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBŸB‚˜Û\ÜÈ]˜]\œÈÂˆÛY[ÂˆÛÛœÝXÝÜŠÛY[
HÂˆ\Ë˜ÛY[HÛY[ÂˆBˆ\Þ[˜ÈÙ][Þ\Ý[P]˜]\œÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝ\HH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œË\NÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ø]˜]\‹ÉÝ\_KÜÞ\Ý[XˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]]˜]\œÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ý[š]™\œØ[Ø]˜]\‹Ý\KÉÜ\˜[Y]\œË\_KÛÝÛ™\‹ÉÜ\˜[Y]\œË™[]RYXˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÝÜ™P]˜]\Š\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ý[š]™\œØ[Ø]˜]\‹Ý\KÉÜ\˜[Y]\œË\_KÛÝÛ™\‹ÉÜ\˜[Y]\œË™[]RYXˆY]Ùˆ	ÔÔÕ	ËˆXY\œÎˆÂˆ	ÖP]\ÜÚX[‹UÚÙ[‰Îˆ	Û›ËXÚXÚÉËˆ	ÐÛÛ[U\IÎˆ\˜[Y]\œË›Z[YU\KˆKˆ\˜[\ÎˆÂˆˆ\˜[Y]\œËžˆNˆ\˜[Y]\œËžKˆÚ^™Nˆ\˜[Y]\œËœÚ^™HÏÈˆKˆ]Nˆ\˜[Y]\œË˜]˜]\‹ˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È[]P]˜]\Š\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ý[š]™\œØ[Ø]˜]\‹Ý\KÉÜ\˜[Y]\œË\_KÛÝÛ™\‹ÉÜ\˜[Y]\œË›ÝÛš[™ÓØš™XÝYKØ]˜]\‹ÉÜ\˜[Y]\œËšYXˆY]Ùˆ	ÑSUIËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]]˜]\’[XYÙPžU\J\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝ\HH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œË\NÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ý[š]™\œØ[Ø]˜]\‹ÝšY]ËÝ\KÉÝ\_XˆY]Ùˆ	ÑÑU	Ëˆ™\ÜÛœÙU\Nˆ	Ø\œ˜^XY™™\‰Ëˆ\˜[\ÎˆÂˆÚ^™Nˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œËœÚ^™Hˆ[™Yš[™Yˆ›Ü›X]ˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œË™›Ü›X]ˆ[™Yš[™YˆKˆNÂˆÛÛœÝÈ]Nˆ]˜]\‹XY\œÎˆÈ	ØÛÛ[]\IÎˆÛÛ[\UÚ][˜ÛÙ[™ÈKHH]ØZ]\Ë˜ÛY[œÙ[™™\]Y\Ý[™\ÜÛœÙJÛÛ™šYÊNÂˆÛÛœÝÛÛ[\HHÛÛ[\UÚ][˜ÛÙ[™ËœÜ]
	ÎÉÊVÌKš[J
NÂˆ™]\›ˆ\Ë˜ÛY[š[™TÝXØÙ\ÜÔ™\ÜÛœÙJÈÛÛ[\K]˜]\ˆKØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]]˜]\’[XYÙPžRQ
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ý[š]™\œØ[Ø]˜]\‹ÝšY]ËÝ\KÉÜ\˜[Y]\œË\_KØ]˜]\‹ÉÜ\˜[Y]\œËšYXˆY]Ùˆ	ÑÑU	Ëˆ™\ÜÛœÙU\Nˆ	Ø\œ˜^XY™™\‰Ëˆ\˜[\ÎˆÂˆÚ^™Nˆ\˜[Y]\œËœÚ^™Kˆ›Ü›X]ˆ\˜[Y]\œË™›Ü›X]ˆKˆNÂˆÛÛœÝÈ]Nˆ]˜]\‹XY\œÎˆÈ	ØÛÛ[]\IÎˆÛÛ[\UÚ][˜ÛÙ[™ÈKHH]ØZ]\Ë˜ÛY[œÙ[™™\]Y\Ý[™\ÜÛœÙJÛÛ™šYÊNÂˆÛÛœÝÛÛ[\HHÛÛ[\UÚ][˜ÛÙ[™ËœÜ]
	ÎÉÊVÌKš[J
NÂˆ™]\›ˆ\Ë˜ÛY[š[™TÝXØÙ\ÜÔ™\ÜÛœÙJÈÛÛ[\K]˜]\ˆKØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]]˜]\’[XYÙPžSÝÛ™\Š\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ý[š]™\œØ[Ø]˜]\‹ÝšY]ËÝ\KÉÜ\˜[Y]\œË\_KÛÝÛ™\‹ÉÜ\˜[Y]\œË™[]RYXˆY]Ùˆ	ÑÑU	Ëˆ™\ÜÛœÙU\Nˆ	Ø\œ˜^XY™™\‰Ëˆ\˜[\ÎˆÂˆÚ^™Nˆ\˜[Y]\œËœÚ^™Kˆ›Ü›X]ˆ\˜[Y]\œË™›Ü›X]ˆKˆNÂˆÛÛœÝÈ]Nˆ]˜]\‹XY\œÎˆÈ	ØÛÛ[]\IÎˆÛÛ[\UÚ][˜ÛÙ[™ÈKHH]ØZ]\Ë˜ÛY[œÙ[™™\]Y\Ý[™\ÜÛœÙJÛÛ™šYÊNÂˆÛÛœÝÛÛ[\HHÛÛ[\UÚ][˜ÛÙ[™ËœÜ]
	ÎÉÊVÌKš[J
NÂˆ™]\›ˆ\Ë˜ÛY[š[™TÝXØÙ\ÜÔ™\ÜÛœÙJÈÛÛ[\K]˜]\ˆKØ[˜XÚÊNÂˆBŸB‚˜Û\ÜÈÛ\ÜÚYšXØ][Û“]™[ÈÂˆÛY[ÂˆÛÛœÝXÝÜŠÛY[
HÂˆ\Ë˜ÛY[HÛY[ÂˆBˆ\Þ[˜ÈÙ][\Ù\‘]PÛ\ÜÚYšXØ][Û“]™[Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹ØÛ\ÜÚYšXØ][Û‹[]™[ÉËˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆÝ]\Îˆ\˜[Y]\œÏËœÝ]\ËˆÜ™\žNˆ\˜[Y]\œÏË›Ü™\žKˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBŸB‚™[˜Ý[Ûˆ\˜[TÙ\šX[^™\ŠÙ^K˜[Y\ÊHÂˆYˆ
˜[Y\ÈOOH[™Yš[™Y˜[Y\ÈOOH[
Bˆ™]\›ˆ[™Yš[™YÂˆYˆ
\œ˜^Kš\Ð\œ˜^J˜[Y\ÊJHÂˆYˆ
˜[Y\Ë›[™ÝOOH
Bˆ™]\›ˆ[™Yš[™YÂˆ™]\›ˆ˜[Y\Ë›X\

‹JHOˆ
HOOHÈÝš[™ÊŠHˆ	ÚÙ^_OIÔÝš[™ÊŠ_X
JKš›Ú[Š	É‰ÊNÂˆBˆ™]\›ˆ[˜ÛÙUT’PÛÛ\Û™[
Ýš[™Ê˜[Y\ÊJNÂŸB‚˜Û\ÜÈ\Ú›Ø\™ÈÂˆÛY[ÂˆÛÛœÝXÝÜŠÛY[
HÂˆ\Ë˜ÛY[HÛY[ÂˆBˆ\Þ[˜ÈÙ][\Ú›Ø\™Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ù\Ú›Ø\™	ËˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆš[\Žˆ\˜[Y]\œÏË™š[\‹ˆÝ\]ˆ\˜[Y]\œÏËœÝ\]ˆX^™\Ý[Îˆ\˜[Y]\œÏË›X^™\Ý[ËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÜ™X]Q\Ú›Ø\™
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ù\Ú›Ø\™	ËˆY]Ùˆ	ÔÔÕ	Ëˆ\˜[\ÎˆÂˆ^[™YZ[”\›Z\ÜÚ[ÛœÎˆ\˜[Y]\œË™^[™YZ[”\›Z\ÜÚ[ÛœËˆKˆ]NˆÂˆ\ØÜš\[ÛŽˆ\˜[Y]\œË™\ØÜš\[Û‹ˆY]\›Z\ÜÚ[ÛœÎˆ\˜[Y]\œË™Y]\›Z\ÜÚ[ÛœËˆ˜[YNˆ\˜[Y]\œË›˜[YKˆÚ\™T\›Z\ÜÚ[ÛœÎˆ\˜[Y]\œËœÚ\™T\›Z\ÜÚ[ÛœËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È[ÑY]\Ú›Ø\™Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ù\Ú›Ø\™Ø[ËÙY]	ËˆY]Ùˆ	ÔU	Ëˆ]NˆÂˆXÝ[ÛŽˆ\˜[Y]\œË˜XÝ[Û‹ˆÚ[™ÙSÝÛ™\‘]Z[Îˆ\˜[Y]\œË˜Ú[™ÙSÝÛ™\‘]Z[Ëˆ[]RYÎˆ\˜[Y]\œË™[]RYËˆ^[™YZ[”\›Z\ÜÚ[ÛœÎˆ\˜[Y]\œË™^[™YZ[”\›Z\ÜÚ[ÛœËˆ\›Z\ÜÚ[Û‘]Z[Îˆ\˜[Y]\œËœ\›Z\ÜÚ[Û‘]Z[ËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ][]˜Z[X›Q\Ú›Ø\™ØYÙ]ÊØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ù\Ú›Ø\™ÙØYÙ]ÉËˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]\Ú›Ø\™ÔYÚ[˜]Y
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ù\Ú›Ø\™ÜÙX\˜Ú	ËˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆ\Ú›Ø\™˜[YNˆ\˜[Y]\œÏË™\Ú›Ø\™˜[YKˆXØÛÝ[Yˆ\˜[Y]\œÏË˜XØÛÝ[YˆÜ›Ý\˜[YNˆ\˜[Y]\œÏË™Ü›Ý\˜[YKˆÜ›Ý\Yˆ\˜[Y]\œÏË™Ü›Ý\Yˆ›Ú™XÝYˆ\˜[Y]\œÏËœ›Ú™XÝYˆÜ™\žNˆ\˜[Y]\œÏË›Ü™\žKˆÝ\]ˆ\˜[Y]\œÏËœÝ\]ˆX^™\Ý[Îˆ\˜[Y]\œÏË›X^™\Ý[ËˆÝ]\Îˆ\˜[Y]\œÏËœÝ]\Ëˆ^[™ˆ\˜[Y]\œÏË™^[™ˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ][ØYÙ]Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝ\Ú›Ø\™YH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œË™\Ú›Ø\™YÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ù\Ú›Ø\™ÉÙ\Ú›Ø\™YKÙØYÙ]ˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆ[Ù[RÙ^Nˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈ	‰ˆ\˜[TÙ\šX[^™\Š	Û[Ù[RÙ^IË\˜[Y]\œË›[Ù[RÙ^JKˆ\šNˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈ	‰ˆ\˜[Y]\œË\šKˆØYÙ]Yˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈ	‰ˆ\˜[TÙ\šX[^™\Š	ÙØYÙ]Y	Ë\˜[Y]\œË™ØYÙ]Y
KˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈYØYÙ]
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ù\Ú›Ø\™ÉÜ\˜[Y]\œË™\Ú›Ø\™YKÙØYÙ]ˆY]Ùˆ	ÔÔÕ	Ëˆ]NˆÂˆÛÛÜŽˆ\˜[Y]\œË˜ÛÛÜ‹ˆYÛ›Ü™U\šP[™[Ù[RÙ^U˜[Y][ÛŽˆ\˜[Y]\œËšYÛ›Ü™U\šP[™[Ù[RÙ^U˜[Y][Û‹ˆ[Ù[RÙ^Nˆ\˜[Y]\œË›[Ù[RÙ^KˆÜÚ][ÛŽˆ\˜[Y]\œËœÜÚ][Û‹ˆ]Nˆ\˜[Y]\œË]Kˆ\šNˆ\˜[Y]\œË\šKˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È\]QØYÙ]
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ù\Ú›Ø\™ÉÜ\˜[Y]\œË™\Ú›Ø\™YKÙØYÙ]ÉÜ\˜[Y]\œË™ØYÙ]YXˆY]Ùˆ	ÔU	Ëˆ]NˆÂˆÛÛÜŽˆ\˜[Y]\œË˜ÛÛÜ‹ˆÜÚ][ÛŽˆ\˜[Y]\œËœÜÚ][Û‹ˆ]Nˆ\˜[Y]\œË]KˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È™[[Ý™QØYÙ]
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ù\Ú›Ø\™ÉÜ\˜[Y]\œË™\Ú›Ø\™YKÙØYÙ]ÉÜ\˜[Y]\œË™ØYÙ]YXˆY]Ùˆ	ÑSUIËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]\Ú›Ø\™][T›Ü\RÙ^\Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ù\Ú›Ø\™ÉÜ\˜[Y]\œË™\Ú›Ø\™YKÚ][\ËÉÜ\˜[Y]\œËš][RYKÜ›Ü\Y\ØˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]\Ú›Ø\™][T›Ü\J\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ù\Ú›Ø\™ÉÜ\˜[Y]\œË™\Ú›Ø\™YKÚ][\ËÉÜ\˜[Y]\œËš][RYKÜ›Ü\Y\ËÉÜ\˜[Y]\œËœ›Ü\RÙ^_XˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]\Ú›Ø\™][T›Ü\J\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ù\Ú›Ø\™ÉÜ\˜[Y]\œË™\Ú›Ø\™YKÚ][\ËÉÜ\˜[Y]\œËš][RYKÜ›Ü\Y\ËÉÜ\˜[Y]\œËœ›Ü\RÙ^_XˆY]Ùˆ	ÔU	ËˆXY\œÎˆÂˆ	ÐÛÛ[U\IÎˆ	Ø\XØ][Û‹ÚœÛÛ‰ËˆKˆ]Nˆ\˜[Y]\œËœ›Ü\U˜[YKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È[]Q\Ú›Ø\™][T›Ü\J\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ù\Ú›Ø\™ÉÜ\˜[Y]\œË™\Ú›Ø\™YKÚ][\ËÉÜ\˜[Y]\œËš][RYKÜ›Ü\Y\ËÉÜ\˜[Y]\œËœ›Ü\RÙ^_XˆY]Ùˆ	ÑSUIËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]\Ú›Ø\™
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝYH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËšYÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ù\Ú›Ø\™ÉÚYXˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È\]Q\Ú›Ø\™
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ù\Ú›Ø\™ÉÜ\˜[Y]\œËšYXˆY]Ùˆ	ÔU	Ëˆ\˜[\ÎˆÂˆ^[™YZ[”\›Z\ÜÚ[ÛœÎˆ\˜[Y]\œË™^[™YZ[”\›Z\ÜÚ[ÛœËˆKˆ]NˆÂˆ\ØÜš\[ÛŽˆ\˜[Y]\œË™\ØÜš\[Û‹ˆY]\›Z\ÜÚ[ÛœÎˆ\˜[Y]\œË™Y]\›Z\ÜÚ[ÛœËˆ˜[YNˆ\˜[Y]\œË›˜[YKˆÚ\™T\›Z\ÜÚ[ÛœÎˆ\˜[Y]\œËœÚ\™T\›Z\ÜÚ[ÛœËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È[]Q\Ú›Ø\™
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝYH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËšYÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ù\Ú›Ø\™ÉÚYXˆY]Ùˆ	ÑSUIËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÛÜQ\Ú›Ø\™
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ù\Ú›Ø\™ÉÜ\˜[Y]\œËšYKØÛÜXˆY]Ùˆ	ÔÔÕ	Ëˆ\˜[\ÎˆÂˆ^[™YZ[”\›Z\ÜÚ[ÛœÎˆ\˜[Y]\œË™^[™YZ[”\›Z\ÜÚ[ÛœËˆKˆ]NˆÂˆ\ØÜš\[ÛŽˆ\˜[Y]\œË™\ØÜš\[Û‹ˆY]\›Z\ÜÚ[ÛœÎˆ\˜[Y]\œË™Y]\›Z\ÜÚ[ÛœËˆ˜[YNˆ\˜[Y]\œË›˜[YKˆÚ\™T\›Z\ÜÚ[ÛœÎˆ\˜[Y]\œËœÚ\™T\›Z\ÜÚ[ÛœËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBŸB‚˜Û\ÜÈ[˜[ZXÓ[Ù[\ÈÂˆÛY[ÂˆÛÛœÝXÝÜŠÛY[
HÂˆ\Ë˜ÛY[HÛY[ÂˆBˆ\Þ[˜ÈÙ][Ù[\ÊØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ]\ÜÚX[‹XÛÛ›™XÝÌKØ\Û[Ù[KÙ[˜[ZXÉËˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È™YÚ\Ý\“[Ù[\Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ]\ÜÚX[‹XÛÛ›™XÝÌKØ\Û[Ù[KÙ[˜[ZXÉËˆY]Ùˆ	ÔÔÕ	Ëˆ]NˆÂˆ[Ù[\Îˆ\˜[Y]\œÏË›[Ù[\ËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È™[[Ý™S[Ù[\Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ]\ÜÚX[‹XÛÛ›™XÝÌKØ\Û[Ù[KÙ[˜[ZXÉËˆY]Ùˆ	ÑSUIËˆ\˜[\ÎˆÂˆ[Ù[RÙ^Nˆ\˜[Y]\œÏË›[Ù[RÙ^KˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBŸB‚˜Û\ÜÈšY[ØÚ[Y\ÈÂˆÛY[ÂˆÛÛœÝXÝÜŠÛY[
HÂˆ\Ë˜ÛY[HÛY[ÂˆBˆ\Þ[˜ÈÙ]šY[\ÜÛØÚX][Û”ØÚ[Y\Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹ØÛÛ™šYËÙšY[ØÚ[Y\ÉËˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆ›Ú™XÝYˆ\˜[Y]\œÏËœ›Ú™XÝYˆ]Y\žNˆ\˜[Y]\œÏËœ]Y\žKˆÝ\]ˆ\˜[Y]\œÏËœÝ\]ˆX^™\Ý[Îˆ\˜[Y]\œÏË›X^™\Ý[ËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÜ™X]QšY[\ÜÛØÚX][Û”ØÚ[YJ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹ØÛÛ™šYËÙšY[ØÚ[Y\ÉËˆY]Ùˆ	ÔÔÕ	Ëˆ]NˆÂˆ\ØÜš\[ÛŽˆ\˜[Y]\œË™\ØÜš\[Û‹ˆ˜[YNˆ\˜[Y]\œË›˜[YKˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È\]QšY[Ð\ÜÛØÚX]YÚ]ØÚ[Y\Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹ØÛÛ™šYËÙšY[ØÚ[Y\ËÙšY[ÉËˆY]Ùˆ	ÔU	Ëˆ]Nˆ\˜[Y]\œËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È™[[Ý™QšY[Ð\ÜÛØÚX]YÚ]ØÚ[Y\Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹ØÛÛ™šYËÙšY[ØÚ[Y\ËÙšY[ÉËˆY]Ùˆ	ÑSUIËˆ]Nˆ\˜[Y]\œËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È\]QšY[\ÜÛØÚX][Û”ØÚ[YR][T\˜[Y]\œÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹ØÛÛ™šYËÙšY[ØÚ[Y\ËÙšY[ËÜ\˜[Y]\œÉËˆY]Ùˆ	ÔU	Ëˆ]Nˆ\˜[Y]\œËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È™[[Ý™QšY[\ÜÛØÚX][Û”ØÚ[YR][T\˜[Y]\œÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹ØÛÛ™šYËÙšY[ØÚ[Y\ËÙšY[ËÜ\˜[Y]\œÉËˆY]Ùˆ	ÑSUIËˆ]Nˆ\˜[Y]\œËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]›Ú™XÝÕÚ]šY[ØÚ[Y\Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹ØÛÛ™šYËÙšY[ØÚ[Y\ËÜ›Ú™XÝÉËˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆÝ\]ˆ\˜[Y]\œËœÝ\]ˆX^™\Ý[Îˆ\˜[Y]\œË›X^™\Ý[Ëˆ›Ú™XÝYˆ\˜[Y]\œËœ›Ú™XÝYˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È\ÜÛØÚX]T›Ú™XÝÕÑšY[\ÜÛØÚX][Û”ØÚ[Y\Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹ØÛÛ™šYËÙšY[ØÚ[Y\ËÜ›Ú™XÝÉËˆY]Ùˆ	ÔU	Ëˆ]Nˆ\˜[Y]\œËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]šY[\ÜÛØÚX][Û”ØÚ[YPžRY
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ØÛÛ™šYËÙšY[ØÚ[Y\ËÉÜ\˜[Y]\œËšYXˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È\]QšY[\ÜÛØÚX][Û”ØÚ[YJ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ØÛÛ™šYËÙšY[ØÚ[Y\ËÉÜ\˜[Y]\œËšYXˆY]Ùˆ	ÔU	Ëˆ]NˆÂˆ\ØÜš\[ÛŽˆ\˜[Y]\œË™\ØÜš\[Û‹ˆ˜[YNˆ\˜[Y]\œË›˜[YKˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È[]QšY[\ÜÛØÚX][Û”ØÚ[YJ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ØÛÛ™šYËÙšY[ØÚ[Y\ËÉÜ\˜[Y]\œËšYXˆY]Ùˆ	ÑSUIËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙX\˜ÚšY[\ÜÛØÚX][Û”ØÚ[YQšY[Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ØÛÛ™šYËÙšY[ØÚ[Y\ËÉÜ\˜[Y]\œËšYKÙšY[ØˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆÝ\]ˆ\˜[Y]\œËœÝ\]ˆX^™\Ý[Îˆ\˜[Y]\œË›X^™\Ý[ËˆšY[Yˆ\˜[Y]\œË™šY[YˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]šY[\ÜÛØÚX][Û”ØÚ[YR][T\˜[Y]\œÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ØÛÛ™šYËÙšY[ØÚ[Y\ËÉÜ\˜[Y]\œËšYKÙšY[ËÉÜ\˜[Y]\œË™šY[YKÜ\˜[Y]\œØˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙX\˜ÚšY[\ÜÛØÚX][Û”ØÚ[YT›Ú™XÝÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ØÛÛ™šYËÙšY[ØÚ[Y\ËÉÜ\˜[Y]\œËšYKÜ›Ú™XÝØˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆÝ\]ˆ\˜[Y]\œËœÝ\]ˆX^™\Ý[Îˆ\˜[Y]\œË›X^™\Ý[Ëˆ›Ú™XÝYˆ\˜[Y]\œËœ›Ú™XÝYˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBŸB‚˜Û\ÜÈš[\œÈÂˆÛY[ÂˆÛÛœÝXÝÜŠÛY[
HÂˆ\Ë˜ÛY[HÛY[ÂˆBˆ\Þ[˜ÈÜ™X]Qš[\Š\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ùš[\‰ËˆY]Ùˆ	ÔÔÕ	Ëˆ\˜[\ÎˆÂˆ^[™ˆ\˜[Y]\œË™^[™ˆÝ™\œšYTÚ\™T\›Z\ÜÚ[ÛœÎˆ\˜[Y]\œË›Ý™\œšYTÚ\™T\›Z\ÜÚ[ÛœËˆKˆ]NˆÂˆ\›Þ[X]S\Ý\ÙYˆ\˜[Y]\œË˜\›Þ[X]S\Ý\ÙYˆ\ØÜš\[ÛŽˆ\˜[Y]\œË™\ØÜš\[Û‹ˆY]\›Z\ÜÚ[ÛœÎˆ\˜[Y]\œË™Y]\›Z\ÜÚ[ÛœËˆ˜]›Ý\š]Nˆ\˜[Y]\œË™˜]›Ý\š]Kˆ˜]›Ý\š]YÛÝ[ˆ\˜[Y]\œË™˜]›Ý\š]YÛÝ[ˆYˆ\˜[Y]\œËšYˆœ[ˆ\˜[Y]\œËšœ[ˆ˜[YNˆ\˜[Y]\œË›˜[YKˆÝÛ™\Žˆ\˜[Y]\œË›ÝÛ™\‹ˆÙX\˜Ú\›ˆ\˜[Y]\œËœÙX\˜Ú\›ˆÙ[Žˆ\˜[Y]\œËœÙ[‹ˆÚ\™T\›Z\ÜÚ[ÛœÎˆ\˜[Y]\œËœÚ\™T\›Z\ÜÚ[ÛœËˆÚ\™Y\Ù\œÎˆ\˜[Y]\œËœÚ\™Y\Ù\œËˆÝXœØÜš\[ÛœÎˆ\˜[Y]\œËœÝXœØÜš\[ÛœËˆšY]Õ\›ˆ\˜[Y]\œËšY]Õ\›ˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]˜]›Ý\š]Qš[\œÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ùš[\‹Ù˜]›Ý\š]IËˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆ^[™ˆ\˜[Y]\œÏË™^[™ˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]^Qš[\œÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ùš[\‹Û^IËˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆ^[™ˆ\˜[Y]\œÏË™^[™ˆ[˜ÛYQ˜]›Ý\š]\Îˆ\˜[Y]\œÏËš[˜ÛYQ˜]›Ý\š]\ËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]š[\œÔYÚ[˜]Y
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ùš[\‹ÜÙX\˜Ú	ËˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆš[\“˜[YNˆ\˜[Y]\œÏË™š[\“˜[YKˆXØÛÝ[Yˆ\˜[Y]\œÏË˜XØÛÝ[YˆÜ›Ý\˜[YNˆ\˜[Y]\œÏË™Ü›Ý\˜[YKˆÜ›Ý\Yˆ\˜[Y]\œÏË™Ü›Ý\Yˆ›Ú™XÝYˆ\˜[Y]\œÏËœ›Ú™XÝYˆYˆ\˜[Y]\œÏËšYˆÜ™\žNˆ\˜[Y]\œÏË›Ü™\žKˆÝ\]ˆ\˜[Y]\œÏËœÝ\]ˆX^™\Ý[Îˆ\˜[Y]\œÏË›X^™\Ý[Ëˆ^[™ˆ\˜[Y]\œÏË™^[™ˆÝ™\œšYTÚ\™T\›Z\ÜÚ[ÛœÎˆ\˜[Y]\œÏË›Ý™\œšYTÚ\™T\›Z\ÜÚ[ÛœËˆ\ÔÝXœÝš[™ÓX]Úˆ\˜[Y]\œÏËš\ÔÝXœÝš[™ÓX]ÚˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]š[\Š\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝYH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËšYÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ùš[\‹ÉÚYXˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆ^[™ˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈ	‰ˆ\˜[Y]\œË™^[™ˆÝ™\œšYTÚ\™T\›Z\ÜÚ[ÛœÎˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈ	‰ˆ\˜[Y]\œË›Ý™\œšYTÚ\™T\›Z\ÜÚ[ÛœËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È\]Qš[\Š\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ùš[\‹ÉÜ\˜[Y]\œËšYXˆY]Ùˆ	ÔU	Ëˆ\˜[\ÎˆÂˆ^[™ˆ\˜[Y]\œË™^[™ˆÝ™\œšYTÚ\™T\›Z\ÜÚ[ÛœÎˆ\˜[Y]\œË›Ý™\œšYTÚ\™T\›Z\ÜÚ[ÛœËˆKˆ]NˆÂˆ˜[YNˆ\˜[Y]\œË›˜[YKˆ\ØÜš\[ÛŽˆ\˜[Y]\œË™\ØÜš\[Û‹ˆœ[ˆ\˜[Y]\œËšœ[ˆ˜]›Ý\š]Nˆ\˜[Y]\œË™˜]›Ý\š]KˆÚ\™T\›Z\ÜÚ[ÛœÎˆ\˜[Y]\œËœÚ\™T\›Z\ÜÚ[ÛœËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È[]Qš[\Š\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝYH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËšYÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ùš[\‹ÉÚYXˆY]Ùˆ	ÑSUIËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]ÛÛ[[œÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝYH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËšYÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ùš[\‹ÉÚYKØÛÛ[[œØˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]ÛÛ[[œÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ùš[\‹ÉÜ\˜[Y]\œËšYKØÛÛ[[œØˆY]Ùˆ	ÔU	Ëˆ]Nˆ\˜[Y]\œË˜ÛÛ[[œËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È™\Ù]ÛÛ[[œÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝYH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËšYÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ùš[\‹ÉÚYKØÛÛ[[œØˆY]Ùˆ	ÑSUIËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]˜]›Ý\š]Q›Ü‘š[\Š\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝYH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËšYÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ùš[\‹ÉÚYKÙ˜]›Ý\š]XˆY]Ùˆ	ÔU	Ëˆ\˜[\ÎˆÂˆ^[™ˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈ	‰ˆ\˜[Y]\œË™^[™ˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È[]Q˜]›Ý\š]Q›Ü‘š[\Š\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝYH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËšYÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ùš[\‹ÉÚYKÙ˜]›Ý\š]XˆY]Ùˆ	ÑSUIËˆ\˜[\ÎˆÂˆ^[™ˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈ	‰ˆ\˜[Y]\œË™^[™ˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÚ[™ÙQš[\“ÝÛ™\Š\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ùš[\‹ÉÜ\˜[Y]\œËšYKÛÝÛ™\˜ˆY]Ùˆ	ÔU	Ëˆ]NˆÂˆXØÛÝ[Yˆ\˜[Y]\œË˜XØÛÝ[YˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBŸB‚˜Û\ÜÈš[\”Ú\š[™ÈÂˆÛY[ÂˆÛÛœÝXÝÜŠÛY[
HÂˆ\Ë˜ÛY[HÛY[ÂˆBˆ\Þ[˜ÈÙ]Y˜][Ú\™TØÛÜJØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ùš[\‹ÙY˜][Ú\™TØÛÜIËˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]Y˜][Ú\™TØÛÜJ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝØÛÜHH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËœØÛÜNÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ùš[\‹ÙY˜][Ú\™TØÛÜIËˆY]Ùˆ	ÔU	Ëˆ]NˆÂˆØÛÜKˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]Ú\™T\›Z\ÜÚ[ÛœÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝYH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËšYÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ùš[\‹ÉÚYKÜ\›Z\ÜÚ[Û˜ˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈYÚ\™T\›Z\ÜÚ[ÛŠ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ùš[\‹ÉÜ\˜[Y]\œËšYKÜ\›Z\ÜÚ[Û˜ˆY]Ùˆ	ÔÔÕ	Ëˆ]NˆÂˆ\Nˆ\˜[Y]\œË\Kˆ›Ú™XÝYˆ\˜[Y]\œËœ›Ú™XÝYˆÜ›Ý\˜[YNˆ\˜[Y]\œË™Ü›Ý\˜[YKˆ›Ú™XÝ›ÛRYˆ\˜[Y]\œËœ›Ú™XÝ›ÛRYˆXØÛÝ[Yˆ\˜[Y]\œË˜XØÛÝ[YˆšYÚÎˆ\˜[Y]\œËœšYÚËˆÜ›Ý\Yˆ\˜[Y]\œË™Ü›Ý\YˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]Ú\™T\›Z\ÜÚ[ÛŠ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ùš[\‹ÉÜ\˜[Y]\œËšYKÜ\›Z\ÜÚ[Û‹ÉÜ\˜[Y]\œËœ\›Z\ÜÚ[Û’YXˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È[]TÚ\™T\›Z\ÜÚ[ÛŠ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ùš[\‹ÉÜ\˜[Y]\œËšYKÜ\›Z\ÜÚ[Û‹ÉÜ\˜[Y]\œËœ\›Z\ÜÚ[Û’YXˆY]Ùˆ	ÑSUIËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBŸB‚˜Û\ÜÈÜ›Ý\[™\Ù\”XÚÙ\ˆÂˆÛY[ÂˆÛÛœÝXÝÜŠÛY[
HÂˆ\Ë˜ÛY[HÛY[ÂˆBˆ\Þ[˜Èš[™\Ù\œÐ[™Ü›Ý\Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹ÙÜ›Ý\\Ù\œXÚÙ\‰ËˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆ]Y\žNˆ\˜[Y]\œËœ]Y\žKˆX^™\Ý[Îˆ\˜[Y]\œË›X^™\Ý[ËˆÚÝÐ]˜]\Žˆ\˜[Y]\œËœÚÝÐ]˜]\‹ˆšY[Yˆ\˜[Y]\œË™šY[Yˆ›Ú™XÝYˆ\˜[Y]\œËœ›Ú™XÝYˆ\ÜÝYU\RYˆ\˜[Y]\œËš\ÜÝYU\RYˆ]˜]\”Ú^™Nˆ\˜[Y]\œË˜]˜]\”Ú^™KˆØ\ÙR[œÙ[œÚ]]™Nˆ\˜[Y]\œË˜Ø\ÙR[œÙ[œÚ]]™Kˆ^ÛYPÛÛ›™XÝYÛœÎˆ\˜[Y]\œË™^ÛYPÛÛ›™XÝYÛœËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBŸB‚˜Û\ÜÈÜ›Ý\ÈÂˆÛY[ÂˆÛÛœÝXÝÜŠÛY[
HÂˆ\Ë˜ÛY[HÛY[ÂˆBˆ\Þ[˜ÈÜ™X]QÜ›Ý\
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹ÙÜ›Ý\	ËˆY]Ùˆ	ÔÔÕ	Ëˆ]Nˆ\˜[Y]\œËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È™[[Ý™QÜ›Ý\
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹ÙÜ›Ý\	ËˆY]Ùˆ	ÑSUIËˆ\˜[\ÎˆÂˆÜ›Ý\˜[YNˆ\˜[Y]\œË™Ü›Ý\˜[YKˆÜ›Ý\Yˆ\˜[Y]\œË™Ü›Ý\YˆÝØ\Ü›Ý\ˆ\˜[Y]\œËœÝØ\Ü›Ý\ˆÝØ\Ü›Ý\Yˆ\˜[Y]\œËœÝØ\Ü›Ý\YˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È[ÑÙ]Ü›Ý\Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹ÙÜ›Ý\Ø[ÉËˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆÝ\]ˆ\˜[Y]\œÏËœÝ\]ˆX^™\Ý[Îˆ\˜[Y]\œÏË›X^™\Ý[ËˆÜ›Ý\Yˆ\˜[Y]\œÏË™Ü›Ý\YˆÜ›Ý\˜[YNˆ\˜[Y]\œÏË™Ü›Ý\˜[YKˆXØÙ\ÜÕ\Nˆ\˜[Y]\œÏË˜XØÙ\ÜÕ\Kˆ\XØ][Û’Ù^Nˆ\˜[Y]\œÏË˜\XØ][Û’Ù^KˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]\Ù\œÑœ›ÛQÜ›Ý\
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹ÙÜ›Ý\ÛY[X™\‰ËˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆÜ›Ý\˜[YNˆ\˜[Y]\œË™Ü›Ý\˜[YKˆÜ›Ý\Yˆ\˜[Y]\œË™Ü›Ý\Yˆ[˜ÛYR[˜XÝ]™U\Ù\œÎˆ\˜[Y]\œËš[˜ÛYR[˜XÝ]™U\Ù\œËˆÝ\]ˆ\˜[Y]\œËœÝ\]ˆX^™\Ý[Îˆ\˜[Y]\œË›X^™\Ý[ËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈY\Ù\•ÑÜ›Ý\
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹ÙÜ›Ý\Ý\Ù\‰ËˆY]Ùˆ	ÔÔÕ	Ëˆ\˜[\ÎˆÂˆÜ›Ý\˜[YNˆ\˜[Y]\œË™Ü›Ý\˜[YKˆÜ›Ý\Yˆ\˜[Y]\œË™Ü›Ý\YˆKˆ]NˆÂˆXØÛÝ[Yˆ\˜[Y]\œË˜XØÛÝ[Yˆ˜[YNˆ\˜[Y]\œË›˜[YKˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È™[[Ý™U\Ù\‘œ›ÛQÜ›Ý\
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹ÙÜ›Ý\Ý\Ù\‰ËˆY]Ùˆ	ÑSUIËˆ\˜[\ÎˆÂˆÜ›Ý\˜[YNˆ\˜[Y]\œË™Ü›Ý\˜[YKˆÜ›Ý\Yˆ\˜[Y]\œË™Ü›Ý\Yˆ\Ù\›˜[YNˆ\˜[Y]\œË\Ù\›˜[YKˆXØÛÝ[Yˆ\˜[Y]\œË˜XØÛÝ[YˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜Èš[™Ü›Ý\Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹ÙÜ›Ý\ËÜXÚÙ\‰ËˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆ]Y\žNˆ\˜[Y]\œÏËœ]Y\žKˆ^ÛYNˆ\˜[Y]\œÏË™^ÛYKˆ^ÛYRYˆ\˜[Y]\œÏË™^ÛYRYˆX^™\Ý[Îˆ\˜[Y]\œÏË›X^™\Ý[ËˆØ\ÙR[œÙ[œÚ]]™Nˆ\˜[Y]\œÏË˜Ø\ÙR[œÙ[œÚ]]™KˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBŸB‚˜Û\ÜÈ\ÜÝYP]XÚY[ÈÂˆÛY[ÂˆÛÛœÝXÝÜŠÛY[
HÂˆ\Ë˜ÛY[HÛY[ÂˆBˆ\Þ[˜ÈÙ]]XÚY[ÛÛ[
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝYH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËšYÂˆÛÛœÝ˜[™ÙHH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ[™Yš[™Yˆ\˜[Y]\œËœ˜[™ÙNÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ø]XÚY[ØÛÛ[ÉÚYXˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆ™Y\™XÝˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ˜[ÙHˆ\˜[Y]\œËœ™Y\™XÝÏÈ
˜[™ÙHOOH[™Yš[™YÈ˜[ÙHˆ[™Yš[™Y
KˆKˆXY\œÎˆÂˆ˜[™ÙNˆ˜[™ÙKˆKˆ™\ÜÛœÙU\Nˆ	Ø\œ˜^XY™™\‰ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]]XÚY[Y]JØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ø]XÚY[ÛY]IËˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]]XÚY[[X›˜Z[
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝYH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËšYÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ø]XÚY[Ý[X›˜Z[ÉÚYXˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆ™Y\™XÝˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈ	‰ˆ\˜[Y]\œËœ™Y\™XÝˆ˜[˜XÚÕÑY˜][ˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈ	‰ˆ\˜[Y]\œË™˜[˜XÚÕÑY˜][ˆÚYˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈ	‰ˆ\˜[Y]\œËÚYˆZYÚˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈ	‰ˆ\˜[Y]\œËšZYÚˆKˆ™\ÜÛœÙU\Nˆ	Ø\œ˜^XY™™\‰ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]]XÚY[
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝYH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËšYÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ø]XÚY[ÉÚYXˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È™[[Ý™P]XÚY[
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝYH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËšYÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ø]XÚY[ÉÚYXˆY]Ùˆ	ÑSUIËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È^[™]XÚY[›Ü’[X[œÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝYH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËšYÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ø]XÚY[ÉÚYKÙ^[™Ú[X[˜ˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È^[™]XÚY[›Ü“XXÚ[™\Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝYH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËšYÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ø]XÚY[ÉÚYKÙ^[™Ü˜]ØˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈY]XÚY[
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝ›Ü›Q]HH™]È›Ü›Q]J
NÂˆÛÛœÝ]XÚY[ÈH\œ˜^Kš\Ð\œ˜^J\˜[Y]\œË˜]XÚY[
HÈ\˜[Y]\œË˜]XÚY[ˆÜ\˜[Y]\œË˜]XÚY[NÂˆËÈ\Û[Y\ØX›K[™^[[™H\\ØÜš\Y\Û[ØÛÛœÚ\Ý[]\KZ[\ÜÂˆ]™XYX›NÂˆYˆ
\[ÙˆÚ[™ÝÈOOH	Ý[™Yš[™Y	ÊHÂˆÛÛœÝÈ™XYX›Nˆ›ÙT™XYX›HHH]ØZ][\Ü
	Û›ÙNœÝ™X[IÊNÂˆ™XYX›HH›ÙT™XYX›NÂˆBˆ›Üˆ]ØZ]
ÛÛœÝ]XÚY[Ùˆ]XÚY[ÊHÂˆÛÛœÝš[HH]ØZ]\Ë—ØÛÛ™\Ñš[J]XÚY[™XYX›JNÂˆYˆ
Jš[H[œÝ[˜Ù[Ùˆš[Hš[H[œÝ[˜Ù[Ùˆ›ØŠJHÂˆ›ÝÈ™]È\œ›ÜŠ[œÝ\ÜYš[H\H›Üˆ]XÚY[ˆ	Ý\[Ùˆš[_X
NÂˆBˆ›Ü›Q]K˜\[™
	Ùš[IËš[K]XÚY[™š[[˜[YJNÂˆBˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ú\ÜÝYKÉÜ\˜[Y]\œËš\ÜÝYRYÜ’Ù^_KØ]XÚY[ØˆY]Ùˆ	ÔÔÕ	ËˆXY\œÎˆÂˆ	ÖP]\ÜÚX[‹UÚÙ[‰Îˆ	Û›ËXÚXÚÉËˆ	ÐÛÛ[U\IÎˆ	Û][\\Ù›Ü›KY]IËˆKˆ]Nˆ›Ü›Q]KˆX^›ÙS[™Ýˆ[™š[š]KˆX^ÛÛ[[™Ýˆ[™š[š]KˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈØÛÛ™\Ñš[J]XÚY[ˆËÈ\Û[Y\ØX›K[™^[[™H\\ØÜš\Y\Û[ØÛÛœÚ\Ý[]\KZ[\ÜÂˆ™XYX›JHÂˆÛÛœÝÕZ[\œ˜^PÛÜHH
[œ]
HOˆÂˆYˆ
\œ˜^PY™™\‹š\ÕšY]Ê[œ]
JHÂˆÛÛœÝšY]ÈH[œ]ÂˆÛÛœÝÜ˜ÈH™]ÈZ[\œ˜^JšY]Ë˜Y™™\‹šY]Ë˜ž]SÙ™œÙ]šY]Ë˜ž]S[™Ý
NÂˆÛÛœÝÛÜHH™]ÈZ[\œ˜^JÜ˜Ë˜ž]S[™Ý
NÂˆÛÜKœÙ]
Ü˜ÊNÂˆ™]\›ˆÛÜNÂˆBˆÛÛœÝYˆH[œ]ÂˆÛÛœÝÜ˜ÈH™]ÈZ[\œ˜^JYŠNÂˆÛÛœÝÛÜHH™]ÈZ[\œ˜^JÜ˜Ë˜ž]S[™Ý
NÂˆÛÜKœÙ]
Ü˜ÊNÂˆ™]\›ˆÛÜNÂˆNÂˆÛÛœÝY\™ÙPÚ[šÜÈH
Ú[šÜÊHOˆÂˆÛÛœÝÝ[[™ÝHÚ[šÜËœ™YXÙJ
Ý[KÊHOˆÝ[H
ÈË˜ž]S[™Ý
NÂˆÛÛœÝY\™ÙYH™]ÈZ[\œ˜^JÝ[[™Ý
NÂˆ]Ù™œÙ]HÂˆ›Üˆ
ÛÛœÝÈÙˆÚ[šÜÊHÂˆY\™ÙYœÙ]
ËÙ™œÙ]
NÂˆÙ™œÙ]
ÏHË˜ž]S[™ÝÂˆBˆ™]\›ˆY\™ÙYÂˆNÂˆÛÛœÝZ[YU\HH]XÚY[›Z[YU\HÏÈ
Z[YU\\Ë›ÛÚÝ\
]XÚY[™š[[˜[YJH[™Yš[™Y
NÂˆYˆ
]XÚY[™š[H[œÝ[˜Ù[Ùˆ›Øˆ]XÚY[™š[H[œÝ[˜Ù[Ùˆš[JHÂˆ™]\›ˆ]XÚY[™š[NÂˆBˆYˆ
\[Ùˆ]XÚY[™š[HOOH	ÜÝš[™ÉÊHÂˆ™]\›ˆ™]Èš[JØ]XÚY[™š[WK]XÚY[™š[[˜[YKÈ\NˆZ[YU\HJNÂˆBˆYˆ
™XYX›H	‰ˆ]XÚY[™š[H[œÝ[˜Ù[Ùˆ™XYX›JHÂˆ™]\›ˆ\Ë—ÜÝ™X[UÐ›ØŠ]XÚY[™š[K]XÚY[™š[[˜[YKZ[YU\JNÂˆBˆYˆ
]XÚY[™š[H[œÝ[˜Ù[Ùˆ™XYX›TÝ™X[JHÂˆ™]\›ˆ\Ë—ÜÝ™X[UÐ›ØŠ]XÚY[™š[K]XÚY[™š[[˜[YKZ[YU\JNÂˆBˆYˆ
\œ˜^PY™™\‹š\ÕšY]Ê]XÚY[™š[JH]XÚY[™š[H[œÝ[˜Ù[Ùˆ\œ˜^PY™™\ŠHÂˆÛÛœÝÚ[šÈHÕZ[\œ˜^PÛÜJ]XÚY[™š[JNÂˆÛÛœÝY\™ÙYHY\™ÙPÚ[šÜÊØÚ[š×JNÂˆÛÛœÝ›ØˆH™]È›ØŠÛY\™ÙYKÈ\NˆZ[YU\HJNÂˆ™]\›ˆ™]Èš[JØ›Ø—K]XÚY[™š[[˜[YKÈ\NˆZ[YU\HJNÂˆBˆ›ÝÈ™]È\œ›ÜŠ	Õ[œÝ\ÜY]XÚY[š[H\K‰ÊNÂˆBˆ\Þ[˜ÈÜÝ™X[UÐ›ØŠˆËÈ\Û[Y\ØX›K[™^[[™H\\ØÜš\Y\Û[ØÛÛœÚ\Ý[]\KZ[\ÜÂˆÝ™X[Kš[[˜[YKZ[YU\JHÂˆÛÛœÝY\™ÙPÚ[šÜÈH
Ú[šÜÊHOˆÂˆÛÛœÝÝ[[™ÝHÚ[šÜËœ™YXÙJ
Ý[KÊHOˆÝ[H
ÈË˜ž]S[™Ý
NÂˆÛÛœÝY\™ÙYH™]ÈZ[\œ˜^JÝ[[™Ý
NÂˆ]Ù™œÙ]HÂˆ›Üˆ
ÛÛœÝÈÙˆÚ[šÜÊHÂˆY\™ÙYœÙ]
ËÙ™œÙ]
NÂˆÙ™œÙ]
ÏHË˜ž]S[™ÝÂˆBˆ™]\›ˆY\™ÙYÂˆNÂˆYˆ
\[ÙˆÚ[™ÝÈOOH	Ý[™Yš[™Y	È	‰ˆÝ™X[H[œÝ[˜Ù[Ùˆ
]ØZ][\Ü
	Û›ÙNœÝ™X[IÊJK”™XYX›JHÂˆ™]\›ˆ™]È›ÛZ\ÙJ
™\ÛÛ™K™Z™XÝ
HOˆÂˆÛÛœÝÚ[šÜÈH×NÂˆÝ™X[K›ÛŠ	Ù]IË
Ú[šÊHOˆÂˆÚ[šÜËœ\Ú
™]ÈZ[\œ˜^JÚ[šÊJNÂˆJNÂˆÝ™X[K›ÛŠ	Ù[™	Ë

HOˆÂˆÛÛœÝY\™ÙYHY\™ÙPÚ[šÜÊÚ[šÜÊNÂˆÛÛœÝ›ØˆH™]È›ØŠÛY\™ÙYKÈ\NˆZ[YU\HJNÂˆ™\ÛÛ™J™]Èš[JØ›Ø—Kš[[˜[YKÈ\NˆZ[YU\HJJNÂˆJNÂˆÝ™X[K›ÛŠ	Ù\œ›Ü‰Ë™Z™XÝ
NÂˆJNÂˆBˆYˆ
Ý™X[H[œÝ[˜Ù[Ùˆ™XYX›TÝ™X[JHÂˆÛÛœÝ™XY\ˆHÝ™X[K™Ù]™XY\Š
NÂˆÛÛœÝÚ[šÜÈH×NÂˆ]Û™HH˜[ÙNÂˆÚ[H
YÛ™JHÂˆÛÛœÝÈ˜[YKÛ™NˆÝ™X[QÛ™HHH]ØZ]™XY\‹œ™XY

NÂˆYˆ
˜[YJBˆÚ[šÜËœ\Ú
™]ÈZ[\œ˜^J˜[YJJNÂˆÛ™HHÝ™X[QÛ™NÂˆBˆÛÛœÝY\™ÙYHY\™ÙPÚ[šÜÊÚ[šÜÊNÂˆÛÛœÝ›ØˆH™]È›ØŠÛY\™ÙYKÈ\NˆZ[YU\HJNÂˆ™]\›ˆ™]Èš[JØ›Ø—Kš[[˜[YKÈ\NˆZ[YU\HJNÂˆBˆ›ÝÈ™]È\œ›ÜŠ	Õ[œÝ\ÜYÝ™X[H\K‰ÊNÂˆBŸB‚˜Û\ÜÈ\ÜÝYPÛÛ[Y[›Ü\Y\ÈÂˆÛY[ÂˆÛÛœÝXÝÜŠÛY[
HÂˆ\Ë˜ÛY[HÛY[ÂˆBˆ\Þ[˜ÈÙ]ÛÛ[Y[›Ü\RÙ^\Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ[Y[YH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œË˜ÛÛ[Y[YÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ØÛÛ[Y[ÉØÛÛ[Y[YKÜ›Ü\Y\ØˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]ÛÛ[Y[›Ü\J\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ØÛÛ[Y[ÉÜ\˜[Y]\œË˜ÛÛ[Y[YKÜ›Ü\Y\ËÉÜ\˜[Y]\œËœ›Ü\RÙ^_XˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]ÛÛ[Y[›Ü\J\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ØÛÛ[Y[ÉÜ\˜[Y]\œË˜ÛÛ[Y[YKÜ›Ü\Y\ËÉÜ\˜[Y]\œËœ›Ü\RÙ^_XˆY]Ùˆ	ÔU	Ëˆ]Nˆ\˜[Y]\œËœ›Ü\KˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È[]PÛÛ[Y[›Ü\J\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ØÛÛ[Y[ÉÜ\˜[Y]\œË˜ÛÛ[Y[YKÜ›Ü\Y\ËÉÜ\˜[Y]\œËœ›Ü\RÙ^_XˆY]Ùˆ	ÑSUIËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBŸB‚˜Û\ÜÈ\ÜÝYPÛÛ[Y[ÈÂˆÛY[ÂˆÛÛœÝXÝÜŠÛY[
HÂˆ\Ë˜ÛY[HÛY[ÂˆBˆ\Þ[˜ÈÙ]ÛÛ[Y[ÐžRYÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹ØÛÛ[Y[Û\Ý	ËˆY]Ùˆ	ÔÔÕ	Ëˆ\˜[\ÎˆÂˆ^[™ˆ\˜[Y]\œË™^[™ˆKˆ]NˆÂˆYÎˆ\˜[Y]\œËšYËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]ÛÛ[Y[Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝ\ÜÝYRYÜ’Ù^HH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËš\ÜÝYRYÜ’Ù^NÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ú\ÜÝYKÉÚ\ÜÝYRYÜ’Ù^_KØÛÛ[Y[ˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆÝ\]ˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈ	‰ˆ\˜[Y]\œËœÝ\]ˆX^™\Ý[Îˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈ	‰ˆ\˜[Y]\œË›X^™\Ý[ËˆÜ™\žNˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈ	‰ˆ\˜[Y]\œË›Ü™\žKˆ^[™ˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈ	‰ˆ\˜[Y]\œË™^[™ˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈYÛÛ[Y[
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ú\ÜÝYKÉÜ\˜[Y]\œËš\ÜÝYRYÜ’Ù^_KØÛÛ[Y[ˆY]Ùˆ	ÔÔÕ	Ëˆ\˜[\ÎˆÂˆ^[™ˆ\˜[Y]\œË™^[™ˆKˆ]NˆÂˆ]]ÜŽˆ\˜[Y]\œË˜]]Ü‹ˆ›ÙNˆ\˜[Y]\œË˜ÛÛ[Y[ˆÜ™X]Yˆ\˜[Y]\œË˜Ü™X]YˆYˆ\˜[Y]\œËšYˆœÙ]]ÜØ[”ÙYT™\]Y\Ýˆ\˜[Y]\œËšœÙ]]ÜØ[”ÙYT™\]Y\ÝˆœÙX›XÎˆ\˜[Y]\œËšœÙX›XËˆ\™[Yˆ\˜[Y]\œËœ\™[Yˆ›Ü\Y\Îˆ\˜[Y]\œËœ›Ü\Y\Ëˆ™[™\™Y›ÙNˆ\˜[Y]\œËœ™[™\™Y›ÙKˆÙ[Žˆ\˜[Y]\œËœÙ[‹ˆ\]P]]ÜŽˆ\˜[Y]\œË\]P]]Ü‹ˆ\]Yˆ\˜[Y]\œË\]Yˆš\ÚXš[]Nˆ\˜[Y]\œËš\ÚXš[]KˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]ÛÛ[Y[
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ú\ÜÝYKÉÜ\˜[Y]\œËš\ÜÝYRYÜ’Ù^_KØÛÛ[Y[ÉÜ\˜[Y]\œËšYXˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆ^[™ˆ\˜[Y]\œË™^[™ˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È\]PÛÛ[Y[
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ú\ÜÝYKÉÜ\˜[Y]\œËš\ÜÝYRYÜ’Ù^_KØÛÛ[Y[ÉÜ\˜[Y]\œËšYXˆY]Ùˆ	ÔU	Ëˆ\˜[\ÎˆÂˆ›ÝYžU\Ù\œÎˆ\˜[Y]\œË››ÝYžU\Ù\œËˆÝ™\œšYQY]X›Q›YÎˆ\˜[Y]\œË›Ý™\œšYQY]X›Q›YËˆ^[™ˆ\˜[Y]\œË™^[™ˆKˆ]NˆÂˆ›ÙNˆ\˜[Y]\œË˜ÛÛ[Y[ˆš\ÚXš[]Nˆ\˜[Y]\œËš\ÚXš[]Kˆ›Ü\Y\Îˆ\˜[Y]\œËœ›Ü\Y\ËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È[]PÛÛ[Y[
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ú\ÜÝYKÉÜ\˜[Y]\œËš\ÜÝYRYÜ’Ù^_KØÛÛ[Y[ÉÜ\˜[Y]\œËšYXˆY]Ùˆ	ÑSUIËˆ\˜[\ÎˆÂˆ\™[Yˆ\˜[Y]\œËœ\™[YˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBŸB‚˜Û\ÜÈ\ÜÝYPÝ\ÝÛQšY[\ÜÛØÚX][ÛœÈÂˆÛY[ÂˆÛÛœÝXÝÜŠÛY[
HÂˆ\Ë˜ÛY[HÛY[ÂˆBˆ\Þ[˜ÈÜ™X]P\ÜÛØÚX][ÛœÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹ÙšY[Ø\ÜÛØÚX][Û‰ËˆY]Ùˆ	ÔU	Ëˆ]NˆÂˆ\ÜÛØÚX][ÛÛÛ^Îˆ\˜[Y]\œÏË˜\ÜÛØÚX][ÛÛÛ^ËˆšY[Îˆ\˜[Y]\œÏË™šY[ËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È™[[Ý™P\ÜÛØÚX][ÛœÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹ÙšY[Ø\ÜÛØÚX][Û‰ËˆY]Ùˆ	ÑSUIËˆ]NˆÂˆ\ÜÛØÚX][ÛÛÛ^Îˆ\˜[Y]\œÏË˜\ÜÛØÚX][ÛÛÛ^ËˆšY[Îˆ\˜[Y]\œÏË™šY[ËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBŸB‚˜Û\ÜÈ\ÜÝYPÝ\ÝÛQšY[ÛÛ™šYÝ\˜][Û\ÈÂˆÛY[ÂˆÛÛœÝXÝÜŠÛY[
HÂˆ\Ë˜ÛY[HÛY[ÂˆBˆ\Þ[˜ÈÙ]Ý\ÝÛQšY[ÐÛÛ™šYÝ\˜][ÛœÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ø\ÙšY[ØÛÛ^ØÛÛ™šYÝ\˜][Û‹Û\Ý	ËˆY]Ùˆ	ÔÔÕ	Ëˆ\˜[\ÎˆÂˆYˆ\˜[Y]\œÏËšYˆšY[ÛÛ^Yˆ\˜[Y]\œÏË™šY[ÛÛ^Yˆ\ÜÝYRYˆ\˜[Y]\œÏËš\ÜÝYRYˆ›Ú™XÝÙ^SÜ’Yˆ\˜[Y]\œÏËœ›Ú™XÝÙ^SÜ’Yˆ\ÜÝYU\RYˆ\˜[Y]\œÏËš\ÜÝYU\RYˆÝ\]ˆ\˜[Y]\œÏËœÝ\]ˆX^™\Ý[Îˆ\˜[Y]\œÏË›X^™\Ý[ËˆKˆ]NˆÂˆšY[YÓÜ’Ù^\Îˆ\˜[Y]\œÏË™šY[YÓÜ’Ù^\ËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]Ý\ÝÛQšY[ÛÛ™šYÝ\˜][ÛŠ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ø\ÙšY[ÉÜ\˜[Y]\œË™šY[YÜ’Ù^_KØÛÛ^ØÛÛ™šYÝ\˜][Û˜ˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆYˆ\˜[Y]\œËšYˆšY[ÛÛ^Yˆ\˜[Y]\œË™šY[ÛÛ^Yˆ\ÜÝYRYˆ\˜[Y]\œËš\ÜÝYRYˆ›Ú™XÝÙ^SÜ’Yˆ\˜[Y]\œËœ›Ú™XÝÙ^SÜ’Yˆ\ÜÝYU\RYˆ\˜[Y]\œËš\ÜÝYU\RYˆÝ\]ˆ\˜[Y]\œËœÝ\]ˆX^™\Ý[Îˆ\˜[Y]\œË›X^™\Ý[ËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È\]PÝ\ÝÛQšY[ÛÛ™šYÝ\˜][ÛŠ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ø\ÙšY[ÉÜ\˜[Y]\œË™šY[YÜ’Ù^_KØÛÛ^ØÛÛ™šYÝ\˜][Û˜ˆY]Ùˆ	ÔU	Ëˆ]NˆÂˆÛÛ™šYÝ\˜][ÛœÎˆ\˜[Y]\œË˜ÛÛ™šYÝ\˜][ÛœËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBŸB‚˜Û\ÜÈ\ÜÝYPÝ\ÝÛQšY[ÛÛ^ÈÂˆÛY[ÂˆÛÛœÝXÝÜŠÛY[
HÂˆ\Ë˜ÛY[HÛY[ÂˆBˆ\Þ[˜ÈÙ]ÛÛ^Ñ›Ü‘šY[
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝšY[YH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œË™šY[YÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ÙšY[ÉÙšY[YKØÛÛ^ˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆ\Ð[žR\ÜÝYU\Nˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈ	‰ˆ\˜[Y]\œËš\Ð[žR\ÜÝYU\Kˆ\ÑÛØ˜[ÛÛ^ˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈ	‰ˆ\˜[Y]\œËš\ÑÛØ˜[ÛÛ^ˆÛÛ^Yˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈ	‰ˆ\˜[Y]\œË˜ÛÛ^YˆÝ\]ˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈ	‰ˆ\˜[Y]\œËœÝ\]ˆX^™\Ý[Îˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈ	‰ˆ\˜[Y]\œË›X^™\Ý[ËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÜ™X]PÝ\ÝÛQšY[ÛÛ^
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ÙšY[ÉÜ\˜[Y]\œË™šY[YKØÛÛ^ˆY]Ùˆ	ÔÔÕ	Ëˆ]NˆÂˆ\ØÜš\[ÛŽˆ\˜[Y]\œË™\ØÜš\[Û‹ˆYˆ\˜[Y]\œËšYˆ\ÜÝYU\RYÎˆ\˜[Y]\œËš\ÜÝYU\RYËˆ˜[YNˆ\˜[Y]\œË›˜[YKˆ›Ú™XÝYÎˆ\˜[Y]\œËœ›Ú™XÝYËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]Y˜][˜[Y\Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝšY[YH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œË™šY[YÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ÙšY[ÉÙšY[YKØÛÛ^ÙY˜][˜[YXˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆÛÛ^Yˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈ	‰ˆ\˜[Y]\œË˜ÛÛ^YˆÝ\]ˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈ	‰ˆ\˜[Y]\œËœÝ\]ˆX^™\Ý[Îˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈ	‰ˆ\˜[Y]\œË›X^™\Ý[ËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]Y˜][˜[Y\Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ÙšY[ÉÜ\˜[Y]\œË™šY[YKØÛÛ^ÙY˜][˜[YXˆY]Ùˆ	ÔU	Ëˆ]NˆÂˆY˜][˜[Y\Îˆ\˜[Y]\œË™Y˜][˜[Y\ËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]\ÜÝYU\SX\[™ÜÑ›ÜÛÛ^Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝšY[YH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œË™šY[YÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ÙšY[ÉÙšY[YKØÛÛ^Ú\ÜÝY]\[X\[™ØˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆÛÛ^Yˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈ	‰ˆ\˜[Y]\œË˜ÛÛ^YˆÝ\]ˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈ	‰ˆ\˜[Y]\œËœÝ\]ˆX^™\Ý[Îˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈ	‰ˆ\˜[Y]\œË›X^™\Ý[ËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]Ý\ÝÛQšY[ÛÛ^Ñ›Ü”›Ú™XÝÐ[™\ÜÝYU\\Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ÙšY[ÉÜ\˜[Y]\œË™šY[YKØÛÛ^ÛX\[™ØˆY]Ùˆ	ÔÔÕ	Ëˆ\˜[\ÎˆÂˆÝ\]ˆ\˜[Y]\œËœÝ\]ˆX^™\Ý[Îˆ\˜[Y]\œË›X^™\Ý[ËˆKˆ]NˆÂˆX\[™ÜÎˆ\˜[Y]\œË›X\[™ÜËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]›Ú™XÝÛÛ^X\[™Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝšY[YH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œË™šY[YÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ÙšY[ÉÙšY[YKØÛÛ^Ü›Ú™XÝX\[™ØˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆÛÛ^Yˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈ	‰ˆ\˜[Y]\œË˜ÛÛ^YˆÝ\]ˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈ	‰ˆ\˜[Y]\œËœÝ\]ˆX^™\Ý[Îˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈ	‰ˆ\˜[Y]\œË›X^™\Ý[ËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È\]PÝ\ÝÛQšY[ÛÛ^
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ÙšY[ÉÜ\˜[Y]\œË™šY[YKØÛÛ^ÉÜ\˜[Y]\œË˜ÛÛ^YXˆY]Ùˆ	ÔU	Ëˆ]NˆÂˆ\ØÜš\[ÛŽˆ\˜[Y]\œË™\ØÜš\[Û‹ˆ˜[YNˆ\˜[Y]\œË›˜[YKˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È[]PÝ\ÝÛQšY[ÛÛ^
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ÙšY[ÉÜ\˜[Y]\œË™šY[YKØÛÛ^ÉÜ\˜[Y]\œË˜ÛÛ^YXˆY]Ùˆ	ÑSUIËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈY\ÜÝYU\\ÕÐÛÛ^
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ÙšY[ÉÜ\˜[Y]\œË™šY[YKØÛÛ^ÉÜ\˜[Y]\œË˜ÛÛ^YKÚ\ÜÝY]\XˆY]Ùˆ	ÔU	Ëˆ]NˆÂˆ\ÜÝYU\RYÎˆ\˜[Y]\œËš\ÜÝYU\RYËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È™[[Ý™R\ÜÝYU\\Ñœ›ÛPÛÛ^
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ÙšY[ÉÜ\˜[Y]\œË™šY[YKØÛÛ^ÉÜ\˜[Y]\œË˜ÛÛ^YKÚ\ÜÝY]\KÜ™[[Ý™XˆY]Ùˆ	ÔÔÕ	Ëˆ]NˆÂˆ\ÜÝYU\RYÎˆ\˜[Y]\œËš\ÜÝYU\RYËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È\ÜÚYÛ”›Ú™XÝÕÐÝ\ÝÛQšY[ÛÛ^
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ÙšY[ÉÜ\˜[Y]\œË™šY[YKØÛÛ^ÉÜ\˜[Y]\œË˜ÛÛ^YKÜ›Ú™XÝˆY]Ùˆ	ÔU	Ëˆ]NˆÂˆ›Ú™XÝYÎˆ\˜[Y]\œËœ›Ú™XÝYËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È™[[Ý™PÝ\ÝÛQšY[ÛÛ^œ›ÛT›Ú™XÝÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ÙšY[ÉÜ\˜[Y]\œË™šY[YKØÛÛ^ÉÜ\˜[Y]\œË˜ÛÛ^YKÜ›Ú™XÝÜ™[[Ý™XˆY]Ùˆ	ÔÔÕ	Ëˆ]NˆÂˆ›Ú™XÝYÎˆ\˜[Y]\œËœ›Ú™XÝYËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBŸB‚˜Û\ÜÈ\ÜÝYPÝ\ÝÛQšY[Ü[ÛœÈÂˆÛY[ÂˆÛÛœÝXÝÜŠÛY[
HÂˆ\Ë˜ÛY[HÛY[ÂˆBˆ\Þ[˜ÈÙ]Ý\ÝÛQšY[Ü[ÛŠ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝYH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËšYÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ØÝ\ÝÛQšY[Ü[Û‹ÉÚYXˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]Ü[ÛœÑ›ÜÛÛ^
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ÙšY[ÉÜ\˜[Y]\œË™šY[YKØÛÛ^ÉÜ\˜[Y]\œË˜ÛÛ^YKÛÜ[Û˜ˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆÜ[Û’Yˆ\˜[Y]\œË›Ü[Û’YˆÛ›SÜ[ÛœÎˆ\˜[Y]\œË›Û›SÜ[ÛœËˆÝ\]ˆ\˜[Y]\œËœÝ\]ˆX^™\Ý[Îˆ\˜[Y]\œË›X^™\Ý[ËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÜ™X]PÝ\ÝÛQšY[Ü[ÛŠ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ÙšY[ÉÜ\˜[Y]\œË™šY[YKØÛÛ^ÉÜ\˜[Y]\œË˜ÛÛ^YKÛÜ[Û˜ˆY]Ùˆ	ÔÔÕ	Ëˆ]NˆÂˆÜ[ÛœÎˆ\˜[Y]\œË›Ü[ÛœËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È\]PÝ\ÝÛQšY[Ü[ÛŠ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ÙšY[ÉÜ\˜[Y]\œË™šY[YKØÛÛ^ÉÜ\˜[Y]\œË˜ÛÛ^YKÛÜ[Û˜ˆY]Ùˆ	ÔU	Ëˆ]NˆÂˆÜ[ÛœÎˆ\˜[Y]\œË›Ü[ÛœËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È™[Ü™\Ý\ÝÛQšY[Ü[ÛœÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ÙšY[ÉÜ\˜[Y]\œË™šY[YKØÛÛ^ÉÜ\˜[Y]\œË˜ÛÛ^YKÛÜ[Û‹Û[Ý™XˆY]Ùˆ	ÔU	Ëˆ]NˆÂˆY\Žˆ\˜[Y]\œË˜Y\‹ˆÝ\ÝÛQšY[Ü[Û’YÎˆ\˜[Y]\œË˜Ý\ÝÛQšY[Ü[Û’YËˆÜÚ][ÛŽˆ\˜[Y]\œËœÜÚ][Û‹ˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È[]PÝ\ÝÛQšY[Ü[ÛŠ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ÙšY[ÉÜ\˜[Y]\œË™šY[YKØÛÛ^ÉÜ\˜[Y]\œË˜ÛÛ^YKÛÜ[Û‹ÉÜ\˜[Y]\œË›Ü[Û’YXˆY]Ùˆ	ÑSUIËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È™\XÙPÝ\ÝÛQšY[Ü[ÛŠ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ÙšY[ÉÜ\˜[Y]\œË™šY[YKØÛÛ^ÉÜ\˜[Y]\œË˜ÛÛ^YKÛÜ[Û‹ÉÜ\˜[Y]\œË›Ü[Û’YKÚ\ÜÝYXˆY]Ùˆ	ÑSUIËˆ\˜[\ÎˆÂˆ™\XÙUÚ]ˆ\˜[Y]\œËœ™\XÙUÚ]ˆœ[ˆ\˜[Y]\œËšœ[ˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBŸB‚˜Û\ÜÈ\ÜÝYPÝ\ÝÛQšY[Ü[ÛœÐ\ÈÂˆÛY[ÂˆÛÛœÝXÝÜŠÛY[
HÂˆ\Ë˜ÛY[HÛY[ÂˆBˆ\Þ[˜ÈÙ][\ÜÝYQšY[Ü[ÛœÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝšY[Ù^HH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œË™šY[Ù^NÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ÙšY[ÉÙšY[Ù^_KÛÜ[Û˜ˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆÝ\]ˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈ	‰ˆ\˜[Y]\œËœÝ\]ˆX^™\Ý[Îˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈ	‰ˆ\˜[Y]\œË›X^™\Ý[ËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÜ™X]R\ÜÝYQšY[Ü[ÛŠ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ÙšY[ÉÜ\˜[Y]\œË™šY[Ù^_KÛÜ[Û˜ˆY]Ùˆ	ÔÔÕ	Ëˆ]NˆÂˆÛÛ™šYÎˆ\˜[Y]\œË˜ÛÛ™šYËˆ›Ü\Y\Îˆ\˜[Y]\œËœ›Ü\Y\Ëˆ˜[YNˆ\˜[Y]\œË˜[YKˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]Ù[XÝX›R\ÜÝYQšY[Ü[ÛœÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝšY[Ù^HH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œË™šY[Ù^NÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ÙšY[ÉÙšY[Ù^_KÛÜ[Û‹ÜÝYÙÙ\Ý[ÛœËÙY]ˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆÝ\]ˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈ	‰ˆ\˜[Y]\œËœÝ\]ˆX^™\Ý[Îˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈ	‰ˆ\˜[Y]\œË›X^™\Ý[Ëˆ›Ú™XÝYˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈ	‰ˆ\˜[Y]\œËœ›Ú™XÝYˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]š\ÚX›R\ÜÝYQšY[Ü[ÛœÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝšY[Ù^HH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œË™šY[Ù^NÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ÙšY[ÉÙšY[Ù^_KÛÜ[Û‹ÜÝYÙÙ\Ý[ÛœËÜÙX\˜ÚˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆÝ\]ˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈ	‰ˆ\˜[Y]\œËœÝ\]ˆX^™\Ý[Îˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈ	‰ˆ\˜[Y]\œË›X^™\Ý[Ëˆ›Ú™XÝYˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈ	‰ˆ\˜[Y]\œËœ›Ú™XÝYˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]\ÜÝYQšY[Ü[ÛŠ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ÙšY[ÉÜ\˜[Y]\œË™šY[Ù^_KÛÜ[Û‹ÉÜ\˜[Y]\œË›Ü[Û’YXˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È\]R\ÜÝYQšY[Ü[ÛŠ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ÙšY[ÉÜ\˜[Y]\œË™šY[Ù^_KÛÜ[Û‹ÉÜ\˜[Y]\œË›Ü[Û’YXˆY]Ùˆ	ÔU	Ëˆ]NˆÂˆÛÛ™šYÎˆ\˜[Y]\œË˜ÛÛ™šYËˆYˆ\˜[Y]\œËšYˆ›Ü\Y\Îˆ\˜[Y]\œËœ›Ü\Y\Ëˆ˜[YNˆ\˜[Y]\œË˜[YKˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È[]R\ÜÝYQšY[Ü[ÛŠ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ÙšY[ÉÜ\˜[Y]\œË™šY[Ù^_KÛÜ[Û‹ÉÜ\˜[Y]\œË›Ü[Û’YXˆY]Ùˆ	ÑSUIËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È™\XÙR\ÜÝYQšY[Ü[ÛŠ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ÙšY[ÉÜ\˜[Y]\œË™šY[Ù^_KÛÜ[Û‹ÉÜ\˜[Y]\œË›Ü[Û’YKÚ\ÜÝYXˆY]Ùˆ	ÑSUIËˆ\˜[\ÎˆÂˆ™\XÙUÚ]ˆ\˜[Y]\œËœ™\XÙUÚ]ˆœ[ˆ\˜[Y]\œËšœ[ˆÝ™\œšYTØÜ™Y[”ÙXÝ\š]Nˆ\˜[Y]\œË›Ý™\œšYTØÜ™Y[”ÙXÝ\š]KˆÝ™\œšYQY]X›Q›YÎˆ\˜[Y]\œË›Ý™\œšYQY]X›Q›YËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBŸB‚˜Û\ÜÈ\ÜÝYPÝ\ÝÛQšY[˜[Y\Ð\ÈÂˆÛY[ÂˆÛÛœÝXÝÜŠÛY[
HÂˆ\Ë˜ÛY[HÛY[ÂˆBˆ\Þ[˜È\]S][\PÝ\ÝÛQšY[˜[Y\Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ø\ÙšY[Ý˜[YIËˆY]Ùˆ	ÔÔÕ	Ëˆ\˜[\ÎˆÂˆÙ[™\˜]PÚ[™Ù[ÙÎˆ\˜[Y]\œË™Ù[™\˜]PÚ[™Ù[ÙËˆKˆ]NˆÂˆ\]\Îˆ\˜[Y]\œË\]\ËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È\]PÝ\ÝÛQšY[˜[YJ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ø\ÙšY[ÉÜ\˜[Y]\œË™šY[YÜ’Ù^_KÝ˜[YXˆY]Ùˆ	ÔU	Ëˆ\˜[\ÎˆÂˆÙ[™\˜]PÚ[™Ù[ÙÎˆ\˜[Y]\œË™Ù[™\˜]PÚ[™Ù[ÙËˆKˆ]NˆÂˆ\]\Îˆ\˜[Y]\œË\]\ËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBŸB‚˜Û\ÜÈ\ÜÝYQšY[ÛÛ™šYÝ\˜][ÛœÈÂˆÛY[ÂˆÛÛœÝXÝÜŠÛY[
HÂˆ\Ë˜ÛY[HÛY[ÂˆBˆ\Þ[˜ÈÙ][šY[ÛÛ™šYÝ\˜][ÛœÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹ÙšY[ÛÛ™šYÝ\˜][Û‰ËˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆÝ\]ˆ\˜[Y]\œÏËœÝ\]ˆX^™\Ý[Îˆ\˜[Y]\œÏË›X^™\Ý[ËˆYˆ\˜[Y]\œÏËšYˆ\ÑY˜][ˆ\˜[Y]\œÏËš\ÑY˜][ˆ]Y\žNˆ\˜[Y]\œÏËœ]Y\žKˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÜ™X]QšY[ÛÛ™šYÝ\˜][ÛŠ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹ÙšY[ÛÛ™šYÝ\˜][Û‰ËˆY]Ùˆ	ÔÔÕ	Ëˆ]NˆÂˆ˜[YNˆ\˜[Y]\œË›˜[YKˆ\ØÜš\[ÛŽˆ\˜[Y]\œË™\ØÜš\[Û‹ˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È\]QšY[ÛÛ™šYÝ\˜][ÛŠ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ÙšY[ÛÛ™šYÝ\˜][Û‹ÉÜ\˜[Y]\œËšYXˆY]Ùˆ	ÔU	Ëˆ]NˆÂˆ˜[YNˆ\˜[Y]\œË›˜[YKˆ\ØÜš\[ÛŽˆ\˜[Y]\œË™\ØÜš\[Û‹ˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È[]QšY[ÛÛ™šYÝ\˜][ÛŠ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝYH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËšYÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ÙšY[ÛÛ™šYÝ\˜][Û‹ÉÚYXˆY]Ùˆ	ÑSUIËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]šY[ÛÛ™šYÝ\˜][Û’][\Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝYH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËšYÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ÙšY[ÛÛ™šYÝ\˜][Û‹ÉÚYKÙšY[ØˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆÝ\]ˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈ	‰ˆ\˜[Y]\œËœÝ\]ˆX^™\Ý[Îˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈ	‰ˆ\˜[Y]\œË›X^™\Ý[ËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È\]QšY[ÛÛ™šYÝ\˜][Û’][\Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ÙšY[ÛÛ™šYÝ\˜][Û‹ÉÜ\˜[Y]\œËšYKÙšY[ØˆY]Ùˆ	ÔU	Ëˆ]NˆÂˆšY[ÛÛ™šYÝ\˜][Û’][\Îˆ\˜[Y]\œË™šY[ÛÛ™šYÝ\˜][Û’][\ËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ][šY[ÛÛ™šYÝ\˜][Û”ØÚ[Y\Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹ÙšY[ÛÛ™šYÝ\˜][ÛœØÚ[YIËˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆÝ\]ˆ\˜[Y]\œÏËœÝ\]ˆX^™\Ý[Îˆ\˜[Y]\œÏË›X^™\Ý[ËˆYˆ\˜[Y]\œÏËšYˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÜ™X]QšY[ÛÛ™šYÝ\˜][Û”ØÚ[YJ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹ÙšY[ÛÛ™šYÝ\˜][ÛœØÚ[YIËˆY]Ùˆ	ÔÔÕ	Ëˆ]NˆÂˆ˜[YNˆ\˜[Y]\œË›˜[YKˆ\ØÜš\[ÛŽˆ\˜[Y]\œË™\ØÜš\[Û‹ˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]šY[ÛÛ™šYÝ\˜][Û”ØÚ[YSX\[™ÜÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹ÙšY[ÛÛ™šYÝ\˜][ÛœØÚ[YKÛX\[™ÉËˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆÝ\]ˆ\˜[Y]\œÏËœÝ\]ˆX^™\Ý[Îˆ\˜[Y]\œÏË›X^™\Ý[ËˆšY[ÛÛ™šYÝ\˜][Û”ØÚ[YRYˆ\˜[Y]\œÏË™šY[ÛÛ™šYÝ\˜][Û”ØÚ[YRYˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]šY[ÛÛ™šYÝ\˜][Û”ØÚ[YT›Ú™XÝX\[™Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹ÙšY[ÛÛ™šYÝ\˜][ÛœØÚ[YKÜ›Ú™XÝ	ËˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆÝ\]ˆ\˜[Y]\œËœÝ\]ˆX^™\Ý[Îˆ\˜[Y]\œË›X^™\Ý[Ëˆ›Ú™XÝYˆ\˜[Y]\œËœ›Ú™XÝYˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È\ÜÚYÛ‘šY[ÛÛ™šYÝ\˜][Û”ØÚ[YUÔ›Ú™XÝ
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹ÙšY[ÛÛ™šYÝ\˜][ÛœØÚ[YKÜ›Ú™XÝ	ËˆY]Ùˆ	ÔU	Ëˆ]NˆÂˆšY[ÛÛ™šYÝ\˜][Û”ØÚ[YRYˆ\˜[Y]\œË™šY[ÛÛ™šYÝ\˜][Û”ØÚ[YRYˆ›Ú™XÝYˆ\˜[Y]\œËœ›Ú™XÝYˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È\]QšY[ÛÛ™šYÝ\˜][Û”ØÚ[YJ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ÙšY[ÛÛ™šYÝ\˜][ÛœØÚ[YKÉÜ\˜[Y]\œËšYXˆY]Ùˆ	ÔU	Ëˆ]NˆÂˆ˜[YNˆ\˜[Y]\œË›˜[YKˆ\ØÜš\[ÛŽˆ\˜[Y]\œË™\ØÜš\[Û‹ˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È[]QšY[ÛÛ™šYÝ\˜][Û”ØÚ[YJ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝYH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËšYÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ÙšY[ÛÛ™šYÝ\˜][ÛœØÚ[YKÉÚYXˆY]Ùˆ	ÑSUIËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]šY[ÛÛ™šYÝ\˜][Û”ØÚ[YSX\[™Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ÙšY[ÛÛ™šYÝ\˜][ÛœØÚ[YKÉÜ\˜[Y]\œËšYKÛX\[™ØˆY]Ùˆ	ÔU	Ëˆ]NˆÂˆX\[™ÜÎˆ\˜[Y]\œË›X\[™ÜËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È™[[Ý™R\ÜÝYU\\Ñœ›ÛQÛØ˜[šY[ÛÛ™šYÝ\˜][Û”ØÚ[YJ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ÙšY[ÛÛ™šYÝ\˜][ÛœØÚ[YKÉÜ\˜[Y]\œËšYKÛX\[™ËÙ[]XˆY]Ùˆ	ÔÔÕ	Ëˆ]NˆÂˆ\ÜÝYU\RYÎˆ\˜[Y]\œËš\ÜÝYU\RYËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBŸB‚˜Û\ÜÈ\ÜÝYQšY[ÈÂˆÛY[ÂˆÛÛœÝXÝÜŠÛY[
HÂˆ\Ë˜ÛY[HÛY[ÂˆBˆ\Þ[˜ÈÙ]šY[ÊØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹ÙšY[	ËˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÜ™X]PÝ\ÝÛQšY[
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹ÙšY[	ËˆY]Ùˆ	ÔÔÕ	Ëˆ]NˆÂˆ\ØÜš\[ÛŽˆ\˜[Y]\œÏË™\ØÜš\[Û‹ˆ˜[YNˆ\˜[Y]\œÏË›˜[YKˆÙX\˜Ú\’Ù^Nˆ\˜[Y]\œÏËœÙX\˜Ú\’Ù^Kˆ\Nˆ\˜[Y]\œÏË\KˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]šY[ÔYÚ[˜]Y
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹ÙšY[ÜÙX\˜Ú	ËˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆÝ\]ˆ\˜[Y]\œÏËœÝ\]ˆX^™\Ý[Îˆ\˜[Y]\œÏË›X^™\Ý[Ëˆ\Nˆ\˜[Y]\œÏË\KˆYˆ\˜[Y]\œÏËšYˆ]Y\žNˆ\˜[Y]\œÏËœ]Y\žKˆÜ™\žNˆ\˜[Y]\œÏË›Ü™\žKˆ^[™ˆ\˜[Y]\œÏË™^[™ˆ›Ú™XÝYÎˆ\˜[Y]\œÏËœ›Ú™XÝYËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]˜\ÚYšY[ÔYÚ[˜]Y
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹ÙšY[ÜÙX\˜ÚÝ˜\ÚY	ËˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆÝ\]ˆ\˜[Y]\œÏËœÝ\]ˆX^™\Ý[Îˆ\˜[Y]\œÏË›X^™\Ý[ËˆYˆ\˜[Y]\œÏËšYˆ]Y\žNˆ\˜[Y]\œÏËœ]Y\žKˆ^[™ˆ\˜[Y]\œÏË™^[™ˆÜ™\žNˆ\˜[Y]\œÏË›Ü™\žKˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È\]PÝ\ÝÛQšY[
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ÙšY[ÉÜ\˜[Y]\œË™šY[YXˆY]Ùˆ	ÔU	Ëˆ]NˆÂˆ\ØÜš\[ÛŽˆ\˜[Y]\œË™\ØÜš\[Û‹ˆ˜[YNˆ\˜[Y]\œË›˜[YKˆÙX\˜Ú\’Ù^Nˆ\˜[Y]\œËœÙX\˜Ú\’Ù^KˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È[]PÝ\ÝÛQšY[
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ÙšY[ÉÜ\˜[Y]\œËšYXˆY]Ùˆ	ÑSUIËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È™\ÝÜ™PÝ\ÝÛQšY[
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ÙšY[ÉÜ\˜[Y]\œËšYKÜ™\ÝÜ™XˆY]Ùˆ	ÔÔÕ	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È˜\ÚÝ\ÝÛQšY[
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ÙšY[ÉÜ\˜[Y]\œËšYKÝ˜\ÚˆY]Ùˆ	ÔÔÕ	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]›Ú™XÝšY[Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ü›Ú™XÝËÙšY[ÉËˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆÝ\]ˆ\˜[Y]\œËœÝ\]ˆX^™\Ý[Îˆ\˜[Y]\œË›X^™\Ý[Ëˆ›Ú™XÝYˆ\˜[Y]\œËœ›Ú™XÝYˆÛÜšÕ\RYˆ\˜[Y]\œËÛÜšÕ\RYˆšY[Yˆ\˜[Y]\œË™šY[YˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBŸB‚˜Û\ÜÈ\ÜÝYS[šÜÈÂˆÛY[ÂˆÛÛœÝXÝÜŠÛY[
HÂˆ\Ë˜ÛY[HÛY[ÂˆBˆ\Þ[˜È[šÒ\ÜÝY\Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ú\ÜÝYS[šÉËˆY]Ùˆ	ÔÔÕ	Ëˆ]NˆÂˆ\Nˆ\˜[Y]\œË\Kˆ[Ø\™\ÜÝYNˆ\˜[Y]\œËš[Ø\™\ÜÝYKˆÝ]Ø\™\ÜÝYNˆ\˜[Y]\œË›Ý]Ø\™\ÜÝYKˆÛÛ[Y[ˆ\˜[Y]\œË˜ÛÛ[Y[ˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]\ÜÝYS[šÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝ[šÒYH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œË›[šÒYÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ú\ÜÝYS[šËÉÛ[šÒYXˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È[]R\ÜÝYS[šÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝ[šÒYH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œË›[šÒYÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ú\ÜÝYS[šËÉÛ[šÒYXˆY]Ùˆ	ÑSUIËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBŸB‚˜Û\ÜÈ\ÜÝYS[šÕ\\ÈÂˆÛY[ÂˆÛÛœÝXÝÜŠÛY[
HÂˆ\Ë˜ÛY[HÛY[ÂˆBˆ\Þ[˜ÈÙ]\ÜÝYS[šÕ\\ÊØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ú\ÜÝYS[šÕ\IËˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÜ™X]R\ÜÝYS[šÕ\J\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ú\ÜÝYS[šÕ\IËˆY]Ùˆ	ÔÔÕ	Ëˆ]NˆÂˆYˆ\˜[Y]\œËšYˆ[Ø\™ˆ\˜[Y]\œËš[Ø\™ˆ˜[YNˆ\˜[Y]\œË›˜[YKˆÝ]Ø\™ˆ\˜[Y]\œË›Ý]Ø\™ˆÙ[Žˆ\˜[Y]\œËœÙ[‹ˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]\ÜÝYS[šÕ\J\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝ\ÜÝYS[šÕ\RYH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËš\ÜÝYS[šÕ\RYÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ú\ÜÝYS[šÕ\KÉÚ\ÜÝYS[šÕ\RYXˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È\]R\ÜÝYS[šÕ\J\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ú\ÜÝYS[šÕ\KÉÜ\˜[Y]\œËš\ÜÝYS[šÕ\RYXˆY]Ùˆ	ÔU	Ëˆ]NˆÂˆYˆ\˜[Y]\œËšYˆ[Ø\™ˆ\˜[Y]\œËš[Ø\™ˆ˜[YNˆ\˜[Y]\œË›˜[YKˆÝ]Ø\™ˆ\˜[Y]\œË›Ý]Ø\™ˆÙ[Žˆ\˜[Y]\œËœÙ[‹ˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È[]R\ÜÝYS[šÕ\J\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝ\ÜÝYS[šÕ\RYH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËš\ÜÝYS[šÕ\RYÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ú\ÜÝYS[šÕ\KÉÚ\ÜÝYS[šÕ\RYXˆY]Ùˆ	ÑSUIËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBŸB‚˜Û\ÜÈ\ÜÝYS˜]šYØ]Ü”Ù][™ÜÈÂˆÛY[ÂˆÛÛœÝXÝÜŠÛY[
HÂˆ\Ë˜ÛY[HÛY[ÂˆBˆ\Þ[˜ÈÙ]\ÜÝYS˜]šYØ]Ü‘Y˜][ÛÛ[[œÊØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹ÜÙ][™ÜËØÛÛ[[œÉËˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]\ÜÝYS˜]šYØ]Ü‘Y˜][ÛÛ[[œÊØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹ÜÙ][™ÜËØÛÛ[[œÉËˆY]Ùˆ	ÔU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBŸB‚˜Û\ÜÈ\ÜÝYS›ÝYšXØ][Û”ØÚ[Y\ÈÂˆÛY[ÂˆÛÛœÝXÝÜŠÛY[
HÂˆ\Ë˜ÛY[HÛY[ÂˆBˆ\Þ[˜ÈÙ]›ÝYšXØ][Û”ØÚ[Y\Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Û›ÝYšXØ][ÛœØÚ[YIËˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆÝ\]ˆ\˜[Y]\œÏËœÝ\]ˆX^™\Ý[Îˆ\˜[Y]\œÏË›X^™\Ý[ËˆYˆ\˜[Y]\œÏËšYˆ›Ú™XÝYˆ\˜[Y]\œÏËœ›Ú™XÝYˆÛ›QY˜][ˆ\˜[Y]\œÏË›Û›QY˜][ˆ^[™ˆ\˜[Y]\œÏË™^[™ˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÜ™X]S›ÝYšXØ][Û”ØÚ[YJ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Û›ÝYšXØ][ÛœØÚ[YIËˆY]Ùˆ	ÔÔÕ	Ëˆ]NˆÂˆ\ØÜš\[ÛŽˆ\˜[Y]\œË™\ØÜš\[Û‹ˆ˜[YNˆ\˜[Y]\œË›˜[YKˆ›ÝYšXØ][Û”ØÚ[YQ]™[Îˆ\˜[Y]\œË››ÝYšXØ][Û”ØÚ[YQ]™[ËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]›ÝYšXØ][Û”ØÚ[YUÔ›Ú™XÝX\[™ÜÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Û›ÝYšXØ][ÛœØÚ[YKÜ›Ú™XÝ	ËˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆÝ\]ˆ\˜[Y]\œÏËœÝ\]ˆX^™\Ý[Îˆ\˜[Y]\œÏË›X^™\Ý[Ëˆ›ÝYšXØ][Û”ØÚ[YRYˆ\˜[Y]\œÏË››ÝYšXØ][Û”ØÚ[YRYˆ›Ú™XÝYˆ\˜[Y]\œÏËœ›Ú™XÝYˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]›ÝYšXØ][Û”ØÚ[YJ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝYH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËšYÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Û›ÝYšXØ][ÛœØÚ[YKÉÚYXˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆ^[™ˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈ	‰ˆ\˜[Y]\œË™^[™ˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È\]S›ÝYšXØ][Û”ØÚ[YJ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Û›ÝYšXØ][ÛœØÚ[YKÉÜ\˜[Y]\œËšYXˆY]Ùˆ	ÔU	Ëˆ]NˆÂˆ\ØÜš\[ÛŽˆ\˜[Y]\œË™\ØÜš\[Û‹ˆ˜[YNˆ\˜[Y]\œË›˜[YKˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈY›ÝYšXØ][ÛœÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Û›ÝYšXØ][ÛœØÚ[YKÉÜ\˜[Y]\œËšYKÛ›ÝYšXØ][Û˜ˆY]Ùˆ	ÔU	Ëˆ]NˆÂˆ›ÝYšXØ][Û”ØÚ[YQ]™[Îˆ\˜[Y]\œË››ÝYšXØ][Û”ØÚ[YQ]™[ËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È[]S›ÝYšXØ][Û”ØÚ[YJ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Û›ÝYšXØ][ÛœØÚ[YKÉÜ\˜[Y]\œË››ÝYšXØ][Û”ØÚ[YRYXˆY]Ùˆ	ÑSUIËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È™[[Ý™S›ÝYšXØ][Û‘œ›ÛS›ÝYšXØ][Û”ØÚ[YJ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Û›ÝYšXØ][ÛœØÚ[YKÉÜ\˜[Y]\œË››ÝYšXØ][Û”ØÚ[YRYKÛ›ÝYšXØ][Û‹ÉÜ\˜[Y]\œË››ÝYšXØ][Û’YXˆY]Ùˆ	ÑSUIËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBŸB‚˜Û\ÜÈ\ÜÝYTš[Üš]Y\ÈÂˆÛY[ÂˆÛÛœÝXÝÜŠÛY[
HÂˆ\Ë˜ÛY[HÛY[ÂˆBˆ\Þ[˜ÈÙ]š[Üš]Y\ÊØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Üš[Üš]IËˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÜ™X]Tš[Üš]J\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Üš[Üš]IËˆY]Ùˆ	ÔÔÕ	Ëˆ]NˆÂˆ]˜]\’Yˆ\˜[Y]\œË˜]˜]\’Yˆ\ØÜš\[ÛŽˆ\˜[Y]\œË™\ØÜš\[Û‹ˆXÛÛ•\›ˆ\˜[Y]\œËšXÛÛ•\›ˆ˜[YNˆ\˜[Y]\œË›˜[YKˆÝ]\ÐÛÛÜŽˆ\˜[Y]\œËœÝ]\ÐÛÛÜ‹ˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]Y˜][š[Üš]J\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Üš[Üš]KÙY˜][	ËˆY]Ùˆ	ÔU	Ëˆ]NˆÂˆYˆ\˜[Y]\œÏËšYˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È[Ý™Tš[Üš]Y\Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Üš[Üš]KÛ[Ý™IËˆY]Ùˆ	ÔU	Ëˆ]NˆÂˆY\Žˆ\˜[Y]\œË˜Y\‹ˆYÎˆ\˜[Y]\œËšYËˆÜÚ][ÛŽˆ\˜[Y]\œËœÜÚ][Û‹ˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙX\˜Úš[Üš]Y\Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Üš[Üš]KÜÙX\˜Ú	ËˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆÝ\]ˆ\˜[Y]\œÏËœÝ\]ˆX^™\Ý[Îˆ\˜[Y]\œÏË›X^™\Ý[ËˆYˆ\˜[Y]\œÏËšYˆ›Ú™XÝYˆ\˜[TÙ\šX[^™\Š	Ü›Ú™XÝY	Ë\˜[Y]\œÏËœ›Ú™XÝY
Kˆš[Üš]S˜[YNˆ\˜[Y]\œÏËœš[Üš]S˜[YKˆÛ›QY˜][ˆ\˜[Y]\œÏË›Û›QY˜][ˆ^[™ˆ\˜[Y]\œÏË™^[™ˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]š[Üš]J\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝYH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËšYÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Üš[Üš]KÉÚYXˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È\]Tš[Üš]J\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Üš[Üš]KÉÜ\˜[Y]\œËšYXˆY]Ùˆ	ÔU	Ëˆ]NˆÂˆ]˜]\’Yˆ\˜[Y]\œË˜]˜]\’Yˆ\ØÜš\[ÛŽˆ\˜[Y]\œË™\ØÜš\[Û‹ˆXÛÛ•\›ˆ\˜[Y]\œËšXÛÛ•\›ˆ˜[YNˆ\˜[Y]\œË›˜[YKˆÝ]\ÐÛÛÜŽˆ\˜[Y]\œËœÝ]\ÐÛÛÜ‹ˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È[]Tš[Üš]J\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Üš[Üš]KÉÜ\˜[Y]\œËšYXˆY]Ùˆ	ÑSUIËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBŸB‚˜Û\ÜÈ\ÜÝYT›Ü\Y\ÈÂˆÛY[ÂˆÛÛœÝXÝÜŠÛY[
HÂˆ\Ë˜ÛY[HÛY[ÂˆBˆ\Þ[˜È[ÔÙ]\ÜÝY\Ô›Ü\Y\Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ú\ÜÝYKÜ›Ü\Y\ÉËˆY]Ùˆ	ÔÔÕ	Ëˆ]NˆÂˆ[]Y\ÒYÎˆ\˜[Y]\œÏË™[]Y\ÒYËˆ›Ü\Y\Îˆ\˜[Y]\œÏËœ›Ü\Y\ËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È[ÔÙ]\ÜÝYT›Ü\Y\ÐžR\ÜÝYJ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ú\ÜÝYKÜ›Ü\Y\ËÛ][IËˆY]Ùˆ	ÔÔÕ	Ëˆ]NˆÂˆ\ÜÝY\Îˆ\˜[Y]\œÏËš\ÜÝY\ËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È[ÔÙ]\ÜÝYT›Ü\J\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ú\ÜÝYKÜ›Ü\Y\ËÉÜ\˜[Y]\œËœ›Ü\RÙ^_XˆY]Ùˆ	ÔU	Ëˆ]NˆÂˆ˜[YNˆ\˜[Y]\œË˜[YKˆ^™\ÜÚ[ÛŽˆ\˜[Y]\œË™^™\ÜÚ[Û‹ˆš[\Žˆ\˜[Y]\œË™š[\‹ˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È[Ñ[]R\ÜÝYT›Ü\J\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ú\ÜÝYKÜ›Ü\Y\ËÉÜ\˜[Y]\œËœ›Ü\RÙ^_XˆY]Ùˆ	ÑSUIËˆ]NˆÂˆ[]RYÎˆ\˜[Y]\œË™[]RYËˆÝ\œ™[˜[YNˆ\˜[Y]\œË˜Ý\œ™[˜[YKˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]\ÜÝYT›Ü\RÙ^\Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝ\ÜÝYRYÜ’Ù^HH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËš\ÜÝYRYÜ’Ù^NÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ú\ÜÝYKÉÚ\ÜÝYRYÜ’Ù^_KÜ›Ü\Y\ØˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]\ÜÝYT›Ü\J\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ú\ÜÝYKÉÜ\˜[Y]\œËš\ÜÝYRYÜ’Ù^_KÜ›Ü\Y\ËÉÜ\˜[Y]\œËœ›Ü\RÙ^_XˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]\ÜÝYT›Ü\J\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ú\ÜÝYKÉÜ\˜[Y]\œËš\ÜÝYRYÜ’Ù^_KÜ›Ü\Y\ËÉÜ\˜[Y]\œËœ›Ü\RÙ^_XˆY]Ùˆ	ÔU	Ëˆ]Nˆ\˜[Y]\œËœ›Ü\U˜[YKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È[]R\ÜÝYT›Ü\J\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ú\ÜÝYKÉÜ\˜[Y]\œËš\ÜÝYRYÜ’Ù^_KÜ›Ü\Y\ËÉÜ\˜[Y]\œËœ›Ü\RÙ^_XˆY]Ùˆ	ÑSUIËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBŸB‚˜Û\ÜÈ\ÜÝYT™YXÝ[ÛˆÂˆÛY[ÂˆÛÛœÝXÝÜŠÛY[
HÂˆ\Ë˜ÛY[HÛY[ÂˆBˆ\Þ[˜È™YXÝ
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ü™YXÝ	ËˆY]Ùˆ	ÔÔÕ	Ëˆ]NˆÂˆ™YXÝ[ÛœÎˆ\˜[Y]\œËœ™YXÝ[ÛœËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]™YXÝ[Û”Ý]\Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ü™YXÝÜÝ]\ËÉÜ\˜[Y]\œËš›Ø’YXˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBŸB‚˜Û\ÜÈ\ÜÝYT™[[ÝS[šÜÈÂˆÛY[ÂˆÛÛœÝXÝÜŠÛY[
HÂˆ\Ë˜ÛY[HÛY[ÂˆBˆ\Þ[˜ÈÙ]™[[ÝR\ÜÝYS[šÜÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝ\ÜÝYRYÜ’Ù^HH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËš\ÜÝYRYÜ’Ù^NÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ú\ÜÝYKÉÚ\ÜÝYRYÜ’Ù^_KÜ™[[Ý[[šØˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆÛØ˜[Yˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈ	‰ˆ\˜[Y]\œË™ÛØ˜[YˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÜ™X]SÜ•\]T™[[ÝR\ÜÝYS[šÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ú\ÜÝYKÉÜ\˜[Y]\œËš\ÜÝYRYÜ’Ù^_KÜ™[[Ý[[šØˆY]Ùˆ	ÔÔÕ	Ëˆ]NˆÂˆÛØ˜[Yˆ\˜[Y]\œË™ÛØ˜[Yˆ\XØ][ÛŽˆ\˜[Y]\œË˜\XØ][Û‹ˆ™[][ÛœÚ\ˆ\˜[Y]\œËœ™[][ÛœÚ\ˆØš™XÝˆ\˜[Y]\œË›Øš™XÝˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È[]T™[[ÝR\ÜÝYS[šÐžQÛØ˜[Y
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝ\ÜÝYRYÜ’Ù^HH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËš\ÜÝYRYÜ’Ù^NÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ú\ÜÝYKÉÚ\ÜÝYRYÜ’Ù^_KÜ™[[Ý[[šØˆY]Ùˆ	ÑSUIËˆ\˜[\ÎˆÂˆÛØ˜[Yˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈ	‰ˆ\˜[Y]\œË™ÛØ˜[YˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]™[[ÝR\ÜÝYS[šÐžRY
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ú\ÜÝYKÉÜ\˜[Y]\œËš\ÜÝYRYÜ’Ù^_KÜ™[[Ý[[šËÉÜ\˜[Y]\œË›[šÒYXˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È\]T™[[ÝR\ÜÝYS[šÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ú\ÜÝYKÉÜ\˜[Y]\œËš\ÜÝYRYÜ’Ù^_KÜ™[[Ý[[šËÉÜ\˜[Y]\œË›[šÒYXˆY]Ùˆ	ÔU	Ëˆ]NˆÂˆÛØ˜[Yˆ\˜[Y]\œË™ÛØ˜[Yˆ\XØ][ÛŽˆ\˜[Y]\œË˜\XØ][Û‹ˆ™[][ÛœÚ\ˆ\˜[Y]\œËœ™[][ÛœÚ\ˆØš™XÝˆ\˜[Y]\œË›Øš™XÝˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È[]T™[[ÝR\ÜÝYS[šÐžRY
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ú\ÜÝYKÉÜ\˜[Y]\œËš\ÜÝYRYÜ’Ù^_KÜ™[[Ý[[šËÉÜ\˜[Y]\œË›[šÒYXˆY]Ùˆ	ÑSUIËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBŸB‚˜Û\ÜÈ\ÜÝYT™\ÛÛ][ÛœÈÂˆÛY[ÂˆÛÛœÝXÝÜŠÛY[
HÂˆ\Ë˜ÛY[HÛY[ÂˆBˆ\Þ[˜ÈÙ]™\ÛÛ][ÛœÊØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ü™\ÛÛ][Û‰ËˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÜ™X]T™\ÛÛ][ÛŠ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ü™\ÛÛ][Û‰ËˆY]Ùˆ	ÔÔÕ	Ëˆ]Nˆ\˜[Y]\œËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]Y˜][™\ÛÛ][ÛŠ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ü™\ÛÛ][Û‹ÙY˜][	ËˆY]Ùˆ	ÔU	Ëˆ]NˆÂˆYˆ\˜[Y]\œËšYˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È[Ý™T™\ÛÛ][ÛœÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ü™\ÛÛ][Û‹Û[Ý™IËˆY]Ùˆ	ÔU	Ëˆ]NˆÂˆY\Žˆ\˜[Y]\œË˜Y\‹ˆYÎˆ\˜[Y]\œËšYËˆÜÚ][ÛŽˆ\˜[Y]\œËœÜÚ][Û‹ˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙX\˜Ú™\ÛÛ][ÛœÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ü™\ÛÛ][Û‹ÜÙX\˜Ú	ËˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆÝ\]ˆ\˜[Y]\œÏËœÝ\]ˆX^™\Ý[Îˆ\˜[Y]\œÏË›X^™\Ý[ËˆYˆ\˜[Y]\œÏËšYˆÛ›QY˜][ˆ\˜[Y]\œÏË›Û›QY˜][ˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]™\ÛÛ][ÛŠ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ü™\ÛÛ][Û‹ÉÜ\˜[Y]\œËšYXˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È\]T™\ÛÛ][ÛŠ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ü™\ÛÛ][Û‹ÉÜ\˜[Y]\œËšYXˆY]Ùˆ	ÔU	Ëˆ]NˆÂˆ‹‹œ\˜[Y]\œËˆ˜[YNˆ\˜[Y]\œË›˜[YKˆYˆ[™Yš[™YˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È[]T™\ÛÛ][ÛŠ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ü™\ÛÛ][Û‹ÉÜ\˜[Y]\œËšYXˆY]Ùˆ	ÑSUIËˆ\˜[\ÎˆÂˆ™\XÙUÚ]ˆ\˜[Y]\œËœ™\XÙUÚ]ˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBŸB‚˜Û\ÜÈ\ÜÝY\ÈÂˆÛY[ÂˆÛÛœÝXÝÜŠÛY[
HÂˆ\Ë˜ÛY[HÛY[ÂˆBˆ\Þ[˜ÈÙ][ÐÚ[™Ù[ÙÜÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹ØÚ[™Ù[ÙËØ[Ù™]Ú	ËˆY]Ùˆ	ÔÔÕ	Ëˆ]NˆÂˆšY[YÎˆ\˜[Y]\œË™šY[YËˆ\ÜÝYRYÓÜ’Ù^\Îˆ\˜[Y]\œËš\ÜÝYRYÓÜ’Ù^\ËˆX^™\Ý[Îˆ\˜[Y]\œË›X^™\Ý[Ëˆ™^YÙUÚÙ[Žˆ\˜[Y]\œË›™^YÙUÚÙ[‹ˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]]™[ÊØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ù]™[ÉËˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÜ™X]R\ÜÝYJ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ú\ÜÝYIËˆY]Ùˆ	ÔÔÕ	Ëˆ\˜[\ÎˆÂˆ\]R\ÝÜžNˆ\˜[Y]\œË\]R\ÝÜžKˆKˆ]NˆÂˆšY[Îˆ\˜[Y]\œË™šY[Ëˆ\ÝÜžSY]Y]Nˆ\˜[Y]\œËš\ÝÜžSY]Y]Kˆ›Ü\Y\Îˆ\˜[Y]\œËœ›Ü\Y\Ëˆ˜[œÚ][ÛŽˆ\˜[Y]\œË˜[œÚ][Û‹ˆ\]Nˆ\˜[Y]\œË\]KˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È\˜Ú]™R\ÜÝY\Ð\Þ[˜Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ú\ÜÝYKØ\˜Ú]™IËˆY]Ùˆ	ÔÔÕ	Ëˆ]NˆÂˆœ[ˆ\˜[Y]\œËšœ[ˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È\˜Ú]™R\ÜÝY\Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ú\ÜÝYKØ\˜Ú]™IËˆY]Ùˆ	ÔU	Ëˆ]NˆÂˆ\ÜÝYRYÓÜ’Ù^\Îˆ\˜[Y]\œËš\ÜÝYRYÓÜ’Ù^\ËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÜ™X]R\ÜÝY\Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ú\ÜÝYKØ[ÉËˆY]Ùˆ	ÔÔÕ	Ëˆ]NˆÂˆ\ÜÝYU\]\Îˆ\˜[Y]\œÏËš\ÜÝYU\]\ËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È[Ñ™]Ú\ÜÝY\Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ú\ÜÝYKØ[Ù™]Ú	ËˆY]Ùˆ	ÔÔÕ	Ëˆ]NˆÂˆ^[™ˆ\˜[Y]\œË™^[™ˆšY[Îˆ\˜[Y]\œË™šY[ËˆšY[ÐžRÙ^\Îˆ\˜[Y]\œË™šY[ÐžRÙ^\Ëˆ\ÜÝYRYÓÜ’Ù^\Îˆ\˜[Y]\œËš\ÜÝYRYÓÜ’Ù^\Ëˆ›Ü\Y\Îˆ\˜[Y]\œËœ›Ü\Y\ËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]Ü™X]R\ÜÝYSY]J\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ú\ÜÝYKØÜ™X][Y]IËˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆ›Ú™XÝYÎˆ\˜[Y]\œÏËœ›Ú™XÝYËˆ›Ú™XÝÙ^\Îˆ\˜[Y]\œÏËœ›Ú™XÝÙ^\Ëˆ\ÜÝY]\RYÎˆ\˜[Y]\œÏËš\ÜÝY]\RYËˆ\ÜÝY]\S˜[Y\Îˆ\˜[Y]\œÏËš\ÜÝY]\S˜[Y\Ëˆ^[™ˆ\˜[Y]\œÏË™^[™ˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]Ü™X]R\ÜÝYSY]R\ÜÝYU\\Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ú\ÜÝYKØÜ™X][Y]KÉÜ\˜[Y]\œËœ›Ú™XÝYÜ’Ù^_KÚ\ÜÝY]\\ØˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆÝ\]ˆ\˜[Y]\œËœÝ\]ˆX^™\Ý[Îˆ\˜[Y]\œË›X^™\Ý[ËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]Ü™X]R\ÜÝYSY]R\ÜÝYU\RY
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ú\ÜÝYKØÜ™X][Y]KÉÜ\˜[Y]\œËœ›Ú™XÝYÜ’Ù^_KÚ\ÜÝY]\\ËÉÜ\˜[Y]\œËš\ÜÝYU\RYXˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆÝ\]ˆ\˜[Y]\œËœÝ\]ˆX^™\Ý[Îˆ\˜[Y]\œË›X^™\Ý[ËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]\ÜÝYS[Z]™\Ü
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ú\ÜÝYKÛ[Z]Ü™\Ü	ËˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆ\Ô™]\›š[™ÒÙ^\Îˆ\˜[Y]\œÏËš\Ô™]\›š[™ÒÙ^\ËˆKˆ]NˆÂˆ\ÜÝY\Ð\›ØXÚ[™Ó[Z]\˜[\Îˆ\˜[Y]\œÏËš\ÜÝY\Ð\›ØXÚ[™Ó[Z]\˜[\ËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È[˜\˜Ú]™R\ÜÝY\Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ú\ÜÝYKÝ[˜\˜Ú]™IËˆY]Ùˆ	ÔU	Ëˆ]NˆÂˆ\ÜÝYRYÓÜ’Ù^\Îˆ\˜[Y]\œËš\ÜÝYRYÓÜ’Ù^\ËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]\ÜÝYJ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝ\ÜÝYRYÜ’Ù^HH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËš\ÜÝYRYÜ’Ù^NÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ú\ÜÝYKÉÚ\ÜÝYRYÜ’Ù^_XˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆšY[Îˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œË™šY[Èˆ[™Yš[™YˆšY[ÐžRÙ^\Îˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œË™šY[ÐžRÙ^\Èˆ[™Yš[™Yˆ^[™ˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œË™^[™ˆ[™Yš[™Yˆ›Ü\Y\Îˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œËœ›Ü\Y\Èˆ[™Yš[™Yˆ\]R\ÝÜžNˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œË\]R\ÝÜžHˆ[™Yš[™YˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈY]\ÜÝYJ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ú\ÜÝYKÉÜ\˜[Y]\œËš\ÜÝYRYÜ’Ù^_XˆY]Ùˆ	ÔU	Ëˆ\˜[\ÎˆÂˆ›ÝYžU\Ù\œÎˆ\˜[Y]\œË››ÝYžU\Ù\œËˆÝ™\œšYTØÜ™Y[”ÙXÝ\š]Nˆ\˜[Y]\œË›Ý™\œšYTØÜ™Y[”ÙXÝ\š]KˆÝ™\œšYQY]X›Q›YÎˆ\˜[Y]\œË›Ý™\œšYQY]X›Q›YËˆ™]\›’\ÜÝYNˆ\˜[Y]\œËœ™]\›’\ÜÝYKˆ^[™ˆ\˜[Y]\œË™^[™ˆKˆ]NˆÂˆšY[Îˆ\˜[Y]\œË™šY[Ëˆ\ÝÜžSY]Y]Nˆ\˜[Y]\œËš\ÝÜžSY]Y]Kˆ›Ü\Y\Îˆ\˜[Y]\œËœ›Ü\Y\Ëˆ˜[œÚ][ÛŽˆ\˜[Y]\œË˜[œÚ][Û‹ˆ\]Nˆ\˜[Y]\œË\]KˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È[]R\ÜÝYJ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝ\ÜÝYRYÜ’Ù^HH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËš\ÜÝYRYÜ’Ù^NÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ú\ÜÝYKÉÚ\ÜÝYRYÜ’Ù^_XˆY]Ùˆ	ÑSUIËˆ\˜[\ÎˆÂˆ[]TÝX\ÚÜÎˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œË™[]TÝX\ÚÜÈˆ[™Yš[™YˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È\ÜÚYÛ’\ÜÝYJ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ú\ÜÝYKÉÜ\˜[Y]\œËš\ÜÝYRYÜ’Ù^_KØ\ÜÚYÛ™YXˆY]Ùˆ	ÔU	Ëˆ]NˆÂˆXØÛÝ[Yˆ\˜[Y]\œË˜XØÛÝ[YˆXØÛÝ[\Nˆ\˜[Y]\œË˜XØÛÝ[\KˆXÝ]™Nˆ\˜[Y]\œË˜XÝ]™Kˆ\XØ][Û”›Û\Îˆ\˜[Y]\œË˜\XØ][Û”›Û\Ëˆ]˜]\•\›Îˆ\˜[Y]\œË˜]˜]\•\›Ëˆ\Ü^S˜[YNˆ\˜[Y]\œË™\Ü^S˜[YKˆ[XZ[Y™\ÜÎˆ\˜[Y]\œË™[XZ[Y™\ÜËˆ^[™ˆ\˜[Y]\œË™^[™ˆÜ›Ý\Îˆ\˜[Y]\œË™Ü›Ý\ËˆÙ^Nˆ\˜[Y]\œËšÙ^KˆØØ[Nˆ\˜[Y]\œË›ØØ[Kˆ˜[YNˆ\˜[Y]\œË›˜[YKˆÙ[Žˆ\˜[Y]\œËœÙ[‹ˆ[YV›Û™Nˆ\˜[Y]\œË[YV›Û™KˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]Ú[™ÙSÙÜÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝ\ÜÝYRYÜ’Ù^HH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËš\ÜÝYRYÜ’Ù^NÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ú\ÜÝYKÉÚ\ÜÝYRYÜ’Ù^_KØÚ[™Ù[ÙØˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆÝ\]ˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œËœÝ\]ˆ[™Yš[™YˆX^™\Ý[Îˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œË›X^™\Ý[Èˆ[™Yš[™YˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]Ú[™ÙSÙÜÐžRYÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ú\ÜÝYKÉÜ\˜[Y]\œËš\ÜÝYRYÜ’Ù^_KØÚ[™Ù[ÙËÛ\ÝˆY]Ùˆ	ÔÔÕ	Ëˆ]NˆÂˆÚ[™Ù[ÙÒYÎˆ\˜[Y]\œË˜Ú[™Ù[ÙÒYËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]Y]\ÜÝYSY]J\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝ\ÜÝYRYÜ’Ù^HH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËš\ÜÝYRYÜ’Ù^NÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ú\ÜÝYKÉÚ\ÜÝYRYÜ’Ù^_KÙY]Y]XˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆÝ™\œšYTØÜ™Y[”ÙXÝ\š]Nˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œË›Ý™\œšYTØÜ™Y[”ÙXÝ\š]Hˆ[™Yš[™YˆÝ™\œšYQY]X›Q›YÎˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œË›Ý™\œšYQY]X›Q›YÈˆ[™Yš[™YˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È›ÝYžJ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ú\ÜÝYKÉÜ\˜[Y]\œËš\ÜÝYRYÜ’Ù^_KÛ›ÝYžXˆY]Ùˆ	ÔÔÕ	Ëˆ]NˆÂˆ[›ÙNˆ\˜[Y]\œËš[›ÙKˆ™\ÝšXÝˆ\˜[Y]\œËœ™\ÝšXÝˆÝXš™XÝˆ\˜[Y]\œËœÝXš™XÝˆ^›ÙNˆ\˜[Y]\œË^›ÙKˆÎˆ\˜[Y]\œËËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]˜[œÚ][ÛœÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝ\ÜÝYRYÜ’Ù^HH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËš\ÜÝYRYÜ’Ù^NÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ú\ÜÝYKÉÚ\ÜÝYRYÜ’Ù^_KÝ˜[œÚ][ÛœØˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆ^[™ˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œË™^[™ˆ[™Yš[™Yˆ˜[œÚ][Û’Yˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œË˜[œÚ][Û’Yˆ[™Yš[™YˆÚÚ\™[[ÝSÛ›PÛÛ™][ÛŽˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œËœÚÚ\™[[ÝSÛ›PÛÛ™][Ûˆˆ[™Yš[™Yˆ[˜ÛYU[˜]˜Z[X›U˜[œÚ][ÛœÎˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œËš[˜ÛYU[˜]˜Z[X›U˜[œÚ][ÛœÈˆ[™Yš[™YˆÛÜžSÜÐ˜\[™Ý]\Îˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œËœÛÜžSÜÐ˜\[™Ý]\Èˆ[™Yš[™YˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÕ˜[œÚ][ÛŠ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ú\ÜÝYKÉÜ\˜[Y]\œËš\ÜÝYRYÜ’Ù^_KÝ˜[œÚ][ÛœØˆY]Ùˆ	ÔÔÕ	Ëˆ]NˆÂˆšY[Îˆ\˜[Y]\œË™šY[Ëˆ\ÝÜžSY]Y]Nˆ\˜[Y]\œËš\ÝÜžSY]Y]Kˆ›Ü\Y\Îˆ\˜[Y]\œËœ›Ü\Y\Ëˆ˜[œÚ][ÛŽˆ\˜[Y]\œË˜[œÚ][Û‹ˆ\]Nˆ\˜[Y]\œË\]KˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È^Ü\˜Ú]™Y\ÜÝY\Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ú\ÜÝY\ËØ\˜Ú]™KÙ^Ü	ËˆY]Ùˆ	ÔU	Ëˆ]NˆÂˆ\˜Ú]™YžNˆ\˜[Y]\œË˜\˜Ú]™YžKˆ\˜Ú]™Y]T˜[™ÙNˆ\˜[Y]\œË˜\˜Ú]™Y]T˜[™ÙKˆ\ÜÝYU\\Îˆ\˜[Y]\œËš\ÜÝYU\\Ëˆ›Ú™XÝÎˆ\˜[Y]\œËœ›Ú™XÝËˆ™\Ü\œÎˆ\˜[Y]\œËœ™\Ü\œËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBŸB‚˜Û\ÜÈ\ÜÝYTÙX\˜ÚÂˆÛY[ÂˆÛÛœÝXÝÜŠÛY[
HÂˆ\Ë˜ÛY[HÛY[ÂˆBˆ\Þ[˜ÈÙ]\ÜÝYTXÚÙ\”™\ÛÝ\˜ÙJ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ú\ÜÝYKÜXÚÙ\‰ËˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆ]Y\žNˆ\˜[Y]\œÏËœ]Y\žKˆÝ\œ™[”Sˆ\˜[Y]\œÏË˜Ý\œ™[”SˆÝ\œ™[\ÜÝYRÙ^Nˆ\˜[Y]\œÏË˜Ý\œ™[\ÜÝYRÙ^KˆÝ\œ™[›Ú™XÝYˆ\˜[Y]\œÏË˜Ý\œ™[›Ú™XÝYˆÚÝÔÝX•\ÚÜÎˆ\˜[Y]\œÏËœÚÝÔÝX•\ÚÜËˆÚÝÔÝX•\ÚÔ\™[ˆ\˜[Y]\œÏËœÚÝÔÝX•\ÚÔ\™[ˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈX]Ú\ÜÝY\Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Úœ[ÛX]Ú	ËˆY]Ùˆ	ÔÔÕ	Ëˆ]NˆÂˆ\ÜÝYRYÎˆ\˜[Y]\œËš\ÜÝYRYËˆœ[Îˆ\˜[Y]\œËšœ[ËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙX\˜Ú›Ü’\ÜÝY\Õ\Ú[™Òœ[
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹ÜÙX\˜Ú	ËˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆœ[ˆ\˜[Y]\œËšœ[ˆÝ\]ˆ\˜[Y]\œËœÝ\]ˆX^™\Ý[Îˆ\˜[Y]\œË›X^™\Ý[Ëˆ˜[Y]T]Y\žNˆ\˜[Y]\œË˜[Y]T]Y\žKˆšY[Îˆ\˜[Y]\œË™šY[Ëˆ^[™ˆ\˜[Y]\œË™^[™ˆ›Ü\Y\Îˆ\˜[Y]\œËœ›Ü\Y\ËˆšY[ÐžRÙ^\Îˆ\˜[Y]\œË™šY[ÐžRÙ^\Ëˆ˜Z[˜\Ýˆ\˜[Y]\œË™˜Z[˜\ÝˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙX\˜Ú›Ü’\ÜÝY\Õ\Ú[™Òœ[ÜÝ
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹ÜÙX\˜Ú	ËˆY]Ùˆ	ÔÔÕ	Ëˆ]NˆÂˆ^[™ˆ\˜[Y]\œÏË™^[™ˆšY[Îˆ\˜[Y]\œÏË™šY[ËˆšY[ÐžRÙ^\Îˆ\˜[Y]\œÏË™šY[ÐžRÙ^\Ëˆœ[ˆ\˜[Y]\œÏËšœ[ˆX^™\Ý[Îˆ\˜[Y]\œÏË›X^™\Ý[Ëˆ›Ü\Y\Îˆ\˜[Y]\œÏËœ›Ü\Y\ËˆÝ\]ˆ\˜[Y]\œÏËœÝ\]ˆ˜[Y]T]Y\žNˆ\˜[Y]\œÏË˜[Y]T]Y\žKˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÛÝ[\ÜÝY\Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹ÜÙX\˜ÚØ\›Þ[X]KXÛÝ[	ËˆY]Ùˆ	ÔÔÕ	Ëˆ]NˆÂˆœ[ˆ\˜[Y]\œËšœ[ˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙX\˜Ú›Ü’\ÜÝY\ÒYÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹ÜÙX\˜ÚÚY	ËˆY]Ùˆ	ÔÔÕ	Ëˆ]NˆÂˆœ[ˆ\˜[Y]\œËšœ[ˆX^™\Ý[Îˆ\˜[Y]\œË›X^™\Ý[Ëˆ™^YÙUÚÙ[Žˆ\˜[Y]\œË›™^YÙUÚÙ[‹ˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙX\˜Ú›Ü’\ÜÝY\Õ\Ú[™Òœ[[š[˜ÙYÙX\˜Ú
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹ÜÙX\˜ÚÚœ[	ËˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆœ[ˆ\˜[Y]\œËšœ[ˆ™^YÙUÚÙ[Žˆ\˜[Y]\œË›™^YÙUÚÙ[‹ˆX^™\Ý[Îˆ\˜[Y]\œË›X^™\Ý[ËˆšY[Îˆ\˜[Y]\œË™šY[Ëˆ^[™ˆ\˜[Y]\œË™^[™ˆ›Ü\Y\Îˆ\˜[Y]\œËœ›Ü\Y\ËˆšY[ÐžRÙ^\Îˆ\˜[Y]\œË™šY[ÐžRÙ^\Ëˆ˜Z[˜\Ýˆ\˜[Y]\œË™˜Z[˜\Ýˆ™XÛÛ˜Ú[R\ÜÝY\Îˆ\˜[Y]\œËœ™XÛÛ˜Ú[R\ÜÝY\ËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙX\˜Ú›Ü’\ÜÝY\Õ\Ú[™Òœ[[š[˜ÙYÙX\˜ÚÜÝ
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹ÜÙX\˜ÚÚœ[	ËˆY]Ùˆ	ÔÔÕ	Ëˆ]NˆÂˆËÈÙÈY\™XØ][Ûˆ›ÝXÙBˆ^[™ˆ\˜[Y]\œË™^[™ˆšY[Îˆ\˜[Y]\œË™šY[ËˆšY[ÐžRÙ^\Îˆ\˜[Y]\œË™šY[ÐžRÙ^\Ëˆœ[ˆ\˜[Y]\œËšœ[ˆX^™\Ý[Îˆ\˜[Y]\œË›X^™\Ý[Ëˆ™^YÙUÚÙ[Žˆ\˜[Y]\œË›™^YÙUÚÙ[‹ˆ›Ü\Y\Îˆ\˜[Y]\œËœ›Ü\Y\Ëˆ™XÛÛ˜Ú[R\ÜÝY\Îˆ\˜[Y]\œËœ™XÛÛ˜Ú[R\ÜÝY\ËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBŸB‚˜Û\ÜÈ\ÜÝYTÙXÝ\š]S]™[ÂˆÛY[ÂˆÛÛœÝXÝÜŠÛY[
HÂˆ\Ë˜ÛY[HÛY[ÂˆBˆ\Þ[˜ÈÙ]\ÜÝYTÙXÝ\š]S]™[Y[X™\œÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝ\ÜÝYTÙXÝ\š]TØÚ[YRYH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËš\ÜÝYTÙXÝ\š]TØÚ[YRYÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ú\ÜÝY\ÙXÝ\š]\ØÚ[Y\ËÉÚ\ÜÝYTÙXÝ\š]TØÚ[YRYKÛY[X™\œØˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆÝ\]ˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈ	‰ˆ\˜[Y]\œËœÝ\]ˆX^™\Ý[Îˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈ	‰ˆ\˜[Y]\œË›X^™\Ý[Ëˆ\ÜÝYTÙXÝ\š]S]™[Yˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈ	‰ˆ\˜[Y]\œËš\ÜÝYTÙXÝ\š]S]™[Yˆ^[™ˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈ	‰ˆ\˜[Y]\œË™^[™ˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]\ÜÝYTÙXÝ\š]S]™[
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝYH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËšYÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ÜÙXÝ\š][]™[ÉÚYXˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBŸB‚˜Û\ÜÈ\ÜÝYTÙXÝ\š]TØÚ[Y\ÈÂˆÛY[ÂˆÛÛœÝXÝÜŠÛY[
HÂˆ\Ë˜ÛY[HÛY[ÂˆBˆ\Þ[˜ÈÙ]\ÜÝYTÙXÝ\š]TØÚ[Y\ÊØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ú\ÜÝY\ÙXÝ\š]\ØÚ[Y\ÉËˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÜ™X]R\ÜÝYTÙXÝ\š]TØÚ[YJ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ú\ÜÝY\ÙXÝ\š]\ØÚ[Y\ÉËˆY]Ùˆ	ÔÔÕ	Ëˆ]NˆÂˆ\ØÜš\[ÛŽˆ\˜[Y]\œË™\ØÜš\[Û‹ˆ]™[Îˆ\˜[Y]\œË›]™[Ëˆ˜[YNˆ\˜[Y]\œË›˜[YKˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]ÙXÝ\š]S]™[Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ú\ÜÝY\ÙXÝ\š]\ØÚ[Y\ËÛ]™[	ËˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆÝ\]ˆ\˜[Y]\œÏËœÝ\]ˆX^™\Ý[Îˆ\˜[Y]\œÏË›X^™\Ý[ËˆYˆ\˜[TÙ\šX[^™\Š	ÚY	Ë\˜[Y]\œÏËšY
KˆØÚ[YRYˆ\˜[TÙ\šX[^™\Š	ÜØÚ[YRY	Ë\˜[Y]\œÏËœØÚ[YRY
KˆÛ›QY˜][ˆ\˜[Y]\œÏË›Û›QY˜][ˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]Y˜][]™[Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ú\ÜÝY\ÙXÝ\š]\ØÚ[Y\ËÛ]™[ÙY˜][	ËˆY]Ùˆ	ÔU	Ëˆ]NˆÂˆY˜][˜[Y\Îˆ\˜[Y]\œÏË™Y˜][˜[Y\ËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]ÙXÝ\š]S]™[Y[X™\œÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ú\ÜÝY\ÙXÝ\š]\ØÚ[Y\ËÛ]™[ÛY[X™\‰ËˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆÝ\]ˆ\˜[Y]\œÏËœÝ\]ˆX^™\Ý[Îˆ\˜[Y]\œÏË›X^™\Ý[ËˆYˆ\˜[TÙ\šX[^™\Š	ÚY	Ë\˜[Y]\œÏËšY
KˆØÚ[YRYˆ\˜[TÙ\šX[^™\Š	ÜØÚ[YRY	Ë\˜[Y]\œÏËœØÚ[YRY
Kˆ]™[Yˆ\˜[TÙ\šX[^™\Š	Û]™[Y	Ë\˜[Y]\œÏË›]™[Y
Kˆ^[™ˆ\˜[Y]\œÏË™^[™ˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙX\˜Ú›Ú™XÝÕ\Ú[™ÔÙXÝ\š]TØÚ[Y\Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ú\ÜÝY\ÙXÝ\š]\ØÚ[Y\ËÜ›Ú™XÝ	ËˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆÝ\]ˆ\˜[Y]\œÏËœÝ\]ˆX^™\Ý[Îˆ\˜[Y]\œÏË›X^™\Ý[Ëˆ\ÜÝYTÙXÝ\š]TØÚ[YRYˆ\˜[Y]\œÏËš\ÜÝYTÙXÝ\š]TØÚ[YRYˆ›Ú™XÝYˆ\˜[Y]\œÏËœ›Ú™XÝYˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È\ÜÛØÚX]TØÚ[Y\ÕÔ›Ú™XÝÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ú\ÜÝY\ÙXÝ\š]\ØÚ[Y\ËÜ›Ú™XÝ	ËˆY]Ùˆ	ÔU	Ëˆ]NˆÂˆÛÓ™]ÔÙXÝ\š]S]™[X\[™ÜÎˆ\˜[Y]\œË›ÛÓ™]ÔÙXÝ\š]S]™[X\[™ÜËˆ›Ú™XÝYˆ\˜[Y]\œËœ›Ú™XÝYˆØÚ[YRYˆ\˜[Y]\œËœØÚ[YRYˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙX\˜ÚÙXÝ\š]TØÚ[Y\Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ú\ÜÝY\ÙXÝ\š]\ØÚ[Y\ËÜÙX\˜Ú	ËˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆÝ\]ˆ\˜[Y]\œÏËœÝ\]ˆX^™\Ý[Îˆ\˜[Y]\œÏË›X^™\Ý[ËˆYˆ\˜[TÙ\šX[^™\Š	ÚY	Ë\˜[Y]\œÏËšY
Kˆ›Ú™XÝYˆ\˜[TÙ\šX[^™\Š	Ü›Ú™XÝY	Ë\˜[Y]\œÏËœ›Ú™XÝY
KˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]\ÜÝYTÙXÝ\š]TØÚ[YJ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝYH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËšYÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ú\ÜÝY\ÙXÝ\š]\ØÚ[Y\ËÉÚYXˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È\]R\ÜÝYTÙXÝ\š]TØÚ[YJ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ú\ÜÝY\ÙXÝ\š]\ØÚ[Y\ËÉÜ\˜[Y]\œËšYXˆY]Ùˆ	ÔU	Ëˆ]NˆÂˆ\ØÜš\[ÛŽˆ\˜[Y]\œË™\ØÜš\[Û‹ˆ˜[YNˆ\˜[Y]\œË›˜[YKˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È[]TÙXÝ\š]TØÚ[YJ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ú\ÜÝY\ÙXÝ\š]\ØÚ[Y\ËÉÜ\˜[Y]\œËœØÚ[YRYXˆY]Ùˆ	ÑSUIËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈYÙXÝ\š]S]™[
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ú\ÜÝY\ÙXÝ\š]\ØÚ[Y\ËÉÜ\˜[Y]\œËœØÚ[YRYKÛ]™[ˆY]Ùˆ	ÔU	Ëˆ]NˆÂˆ]™[Îˆ\˜[Y]\œË›]™[ËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È\]TÙXÝ\š]S]™[
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ú\ÜÝY\ÙXÝ\š]\ØÚ[Y\ËÉÜ\˜[Y]\œËœØÚ[YRYKÛ]™[ÉÜ\˜[Y]\œË›]™[YXˆY]Ùˆ	ÔU	Ëˆ]NˆÂˆ\ØÜš\[ÛŽˆ\˜[Y]\œË™\ØÜš\[Û‹ˆ˜[YNˆ\˜[Y]\œË›˜[YKˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È™[[Ý™S]™[
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ú\ÜÝY\ÙXÝ\š]\ØÚ[Y\ËÉÜ\˜[Y]\œËœØÚ[YRYKÛ]™[ÉÜ\˜[Y]\œË›]™[YXˆY]Ùˆ	ÑSUIËˆ\˜[\ÎˆÂˆ™\XÙUÚ]ˆ\˜[Y]\œËœ™\XÙUÚ]ˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈYÙXÝ\š]S]™[Y[X™\œÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ú\ÜÝY\ÙXÝ\š]\ØÚ[Y\ËÉÜ\˜[Y]\œËœØÚ[YRYKÛ]™[ÉÜ\˜[Y]\œË›]™[YKÛY[X™\˜ˆY]Ùˆ	ÔU	Ëˆ]NˆÂˆY[X™\œÎˆ\˜[Y]\œË›Y[X™\œËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È™[[Ý™SY[X™\‘œ›ÛTÙXÝ\š]S]™[
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ú\ÜÝY\ÙXÝ\š]\ØÚ[Y\ËÉÜ\˜[Y]\œËœØÚ[YRYKÛ]™[ÉÜ\˜[Y]\œË›]™[YKÛY[X™\‹ÉÜ\˜[Y]\œË›Y[X™\’YXˆY]Ùˆ	ÑSUIËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBŸB‚˜Û\ÜÈ\ÜÝYU\T›Ü\Y\ÈÂˆÛY[ÂˆÛÛœÝXÝÜŠÛY[
HÂˆ\Ë˜ÛY[HÛY[ÂˆBˆ\Þ[˜ÈÙ]\ÜÝYU\T›Ü\RÙ^\Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝ\ÜÝYU\RYH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËš\ÜÝYU\RYÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ú\ÜÝY]\KÉÚ\ÜÝYU\RYKÜ›Ü\Y\ØˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]\ÜÝYU\T›Ü\J\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ú\ÜÝY]\KÉÜ\˜[Y]\œËš\ÜÝYU\RYKÜ›Ü\Y\ËÉÜ\˜[Y]\œËœ›Ü\RÙ^_XˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]\ÜÝYU\T›Ü\J\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ú\ÜÝY]\KÉÜ\˜[Y]\œËš\ÜÝYU\RYKÜ›Ü\Y\ËÉÜ\˜[Y]\œËœ›Ü\RÙ^_XˆY]Ùˆ	ÔU	Ëˆ]Nˆ\˜[Y]\œËœ›Ü\U˜[YKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È[]R\ÜÝYU\T›Ü\J\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ú\ÜÝY]\KÉÜ\˜[Y]\œËš\ÜÝYU\RYKÜ›Ü\Y\ËÉÜ\˜[Y]\œËœ›Ü\RÙ^_XˆY]Ùˆ	ÑSUIËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBŸB‚˜Û\ÜÈ\ÜÝYU\\ÈÂˆÛY[ÂˆÛÛœÝXÝÜŠÛY[
HÂˆ\Ë˜ÛY[HÛY[ÂˆBˆ\Þ[˜ÈÙ]\ÜÝYP[\\ÊØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ú\ÜÝY]\IËˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÜ™X]R\ÜÝYU\J\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ú\ÜÝY]\IËˆY]Ùˆ	ÔÔÕ	Ëˆ]NˆÂˆ\ØÜš\[ÛŽˆ\˜[Y]\œË™\ØÜš\[Û‹ˆY\˜\˜ÚS]™[ˆ\˜[Y]\œËšY\˜\˜ÚS]™[ˆ˜[YNˆ\˜[Y]\œË›˜[YKˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]\ÜÝYU\\Ñ›Ü”›Ú™XÝ
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ú\ÜÝY]\KÜ›Ú™XÝ	ËˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆ›Ú™XÝYˆ\˜[Y]\œËœ›Ú™XÝYˆ]™[ˆ\˜[Y]\œË›]™[ˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]\ÜÝYU\J\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝYH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËšYÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ú\ÜÝY]\KÉÚYXˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È\]R\ÜÝYU\J\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ú\ÜÝY]\KÉÜ\˜[Y]\œËšYXˆY]Ùˆ	ÔU	Ëˆ]NˆÂˆ]˜]\’Yˆ\˜[Y]\œË˜]˜]\’Yˆ\ØÜš\[ÛŽˆ\˜[Y]\œË™\ØÜš\[Û‹ˆ˜[YNˆ\˜[Y]\œË›˜[YKˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È[]R\ÜÝYU\J\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝYH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËšYÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ú\ÜÝY]\KÉÚYXˆY]Ùˆ	ÑSUIËˆ\˜[\ÎˆÂˆ[\›˜]]™R\ÜÝYU\RYˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œË˜[\›˜]]™R\ÜÝYU\RYˆ[™Yš[™YˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ][\›˜]]™R\ÜÝYU\\Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝYH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËšYÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ú\ÜÝY]\KÉÚYKØ[\›˜]]™\ØˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÜ™X]R\ÜÝYU\P]˜]\Š\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ú\ÜÝY]\KÉÜ\˜[Y]\œËšYKØ]˜]\Œ˜ˆY]Ùˆ	ÔÔÕ	ËˆXY\œÎˆÂˆ	ÖP]\ÜÚX[‹UÚÙ[‰Îˆ	Û›ËXÚXÚÉËˆ	ÐÛÛ[U\IÎˆ\˜[Y]\œË›Z[YU\KˆKˆ\˜[\ÎˆÂˆˆ\˜[Y]\œËžˆNˆ\˜[Y]\œËžKˆÚ^™Nˆ\˜[Y]\œËœÚ^™HÏÈˆKˆ]Nˆ\˜[Y]\œË˜]˜]\‹ˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBŸB‚˜Û\ÜÈ\ÜÝYU\TØÚ[Y\ÈÂˆÛY[ÂˆÛÛœÝXÝÜŠÛY[
HÂˆ\Ë˜ÛY[HÛY[ÂˆBˆ\Þ[˜ÈÙ][\ÜÝYU\TØÚ[Y\Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ú\ÜÝY]\\ØÚ[YIËˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆÝ\]ˆ\˜[Y]\œÏËœÝ\]ˆX^™\Ý[Îˆ\˜[Y]\œÏË›X^™\Ý[ËˆYˆ\˜[Y]\œÏËšYˆÜ™\žNˆ\˜[Y]\œÏË›Ü™\žKˆ^[™ˆ\˜[Y]\œÏË™^[™ˆ]Y\žTÝš[™Îˆ\˜[Y]\œÏËœ]Y\žTÝš[™ËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÜ™X]R\ÜÝYU\TØÚ[YJ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ú\ÜÝY]\\ØÚ[YIËˆY]Ùˆ	ÔÔÕ	Ëˆ]NˆÂˆ˜[YNˆ\˜[Y]\œË›˜[YKˆ\ØÜš\[ÛŽˆ\˜[Y]\œË™\ØÜš\[Û‹ˆY˜][\ÜÝYU\RYˆ\˜[Y]\œË™Y˜][\ÜÝYU\RYˆ\ÜÝYU\RYÎˆ\˜[Y]\œËš\ÜÝYU\RYËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]\ÜÝYU\TØÚ[Y\ÓX\[™Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ú\ÜÝY]\\ØÚ[YKÛX\[™ÉËˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆÝ\]ˆ\˜[Y]\œÏËœÝ\]ˆX^™\Ý[Îˆ\˜[Y]\œÏË›X^™\Ý[Ëˆ\ÜÝYU\TØÚ[YRYˆ\˜[Y]\œÏËš\ÜÝYU\TØÚ[YRYˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]\ÜÝYU\TØÚ[YQ›Ü”›Ú™XÝÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ú\ÜÝY]\\ØÚ[YKÜ›Ú™XÝ	ËˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆÝ\]ˆ\˜[Y]\œËœÝ\]ˆX^™\Ý[Îˆ\˜[Y]\œË›X^™\Ý[Ëˆ›Ú™XÝYˆ\˜[Y]\œËœ›Ú™XÝYˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È\ÜÚYÛ’\ÜÝYU\TØÚ[YUÔ›Ú™XÝ
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ú\ÜÝY]\\ØÚ[YKÜ›Ú™XÝ	ËˆY]Ùˆ	ÔU	Ëˆ]NˆÂˆ\ÜÝYU\TØÚ[YRYˆ\˜[Y]\œËš\ÜÝYU\TØÚ[YRYˆ›Ú™XÝYˆ\˜[Y]\œËœ›Ú™XÝYˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È\]R\ÜÝYU\TØÚ[YJ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ú\ÜÝY]\\ØÚ[YKÉÜ\˜[Y]\œËš\ÜÝYU\TØÚ[YRYXˆY]Ùˆ	ÔU	Ëˆ]NˆÂˆ˜[YNˆ\˜[Y]\œË›˜[YKˆ\ØÜš\[ÛŽˆ\˜[Y]\œË™\ØÜš\[Û‹ˆY˜][\ÜÝYU\RYˆ\˜[Y]\œË™Y˜][\ÜÝYU\RYˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È[]R\ÜÝYU\TØÚ[YJ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝ\ÜÝYU\TØÚ[YRYH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËš\ÜÝYU\TØÚ[YRYÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ú\ÜÝY]\\ØÚ[YKÉÚ\ÜÝYU\TØÚ[YRYXˆY]Ùˆ	ÑSUIËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈY\ÜÝYU\\ÕÒ\ÜÝYU\TØÚ[YJ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ú\ÜÝY]\\ØÚ[YKÉÜ\˜[Y]\œËš\ÜÝYU\TØÚ[YRYKÚ\ÜÝY]\XˆY]Ùˆ	ÔU	Ëˆ]NˆÂˆ\ÜÝYU\RYÎˆ\˜[Y]\œËš\ÜÝYU\RYËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È™[Ü™\’\ÜÝYU\\Ò[’\ÜÝYU\TØÚ[YJ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ú\ÜÝY]\\ØÚ[YKÉÜ\˜[Y]\œËš\ÜÝYU\TØÚ[YRYKÚ\ÜÝY]\KÛ[Ý™XˆY]Ùˆ	ÔU	Ëˆ]NˆÂˆ\ÜÝYU\RYÎˆ\˜[Y]\œËš\ÜÝYU\RYËˆY\Žˆ\˜[Y]\œË˜Y\‹ˆÜÚ][ÛŽˆ\˜[Y]\œËœÜÚ][Û‹ˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È™[[Ý™R\ÜÝYU\Qœ›ÛR\ÜÝYU\TØÚ[YJ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ú\ÜÝY]\\ØÚ[YKÉÜ\˜[Y]\œËš\ÜÝYU\TØÚ[YRYKÚ\ÜÝY]\KÉÜ\˜[Y]\œËš\ÜÝYU\RYXˆY]Ùˆ	ÑSUIËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBŸB‚˜Û\ÜÈ\ÜÝYU\TØÜ™Y[”ØÚ[Y\ÈÂˆÛY[ÂˆÛÛœÝXÝÜŠÛY[
HÂˆ\Ë˜ÛY[HÛY[ÂˆBˆ\Þ[˜ÈÙ]\ÜÝYU\TØÜ™Y[”ØÚ[Y\Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ú\ÜÝY]\\ØÜ™Y[œØÚ[YIËˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆÝ\]ˆ\˜[Y]\œÏËœÝ\]ˆX^™\Ý[Îˆ\˜[Y]\œÏË›X^™\Ý[ËˆYˆ\˜[Y]\œÏËšYˆ]Y\žTÝš[™Îˆ\˜[Y]\œÏËœ]Y\žTÝš[™ËˆÜ™\žNˆ\˜[Y]\œÏË›Ü™\žKˆ^[™ˆ\˜[Y]\œÏË™^[™ˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÜ™X]R\ÜÝYU\TØÜ™Y[”ØÚ[YJ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ú\ÜÝY]\\ØÜ™Y[œØÚ[YIËˆY]Ùˆ	ÔÔÕ	Ëˆ]NˆÂˆ˜[YNˆ\˜[Y]\œË›˜[YKˆ\ØÜš\[ÛŽˆ\˜[Y]\œË™\ØÜš\[Û‹ˆ\ÜÝYU\SX\[™ÜÎˆ\˜[Y]\œËš\ÜÝYU\SX\[™ÜËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]\ÜÝYU\TØÜ™Y[”ØÚ[YSX\[™ÜÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ú\ÜÝY]\\ØÜ™Y[œØÚ[YKÛX\[™ÉËˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆÝ\]ˆ\˜[Y]\œÏËœÝ\]ˆX^™\Ý[Îˆ\˜[Y]\œÏË›X^™\Ý[Ëˆ\ÜÝYU\TØÜ™Y[”ØÚ[YRYˆ\˜[Y]\œÏËš\ÜÝYU\TØÜ™Y[”ØÚ[YRYˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]\ÜÝYU\TØÜ™Y[”ØÚ[YT›Ú™XÝ\ÜÛØÚX][ÛœÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ú\ÜÝY]\\ØÜ™Y[œØÚ[YKÜ›Ú™XÝ	ËˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆÝ\]ˆ\˜[Y]\œËœÝ\]ˆX^™\Ý[Îˆ\˜[Y]\œË›X^™\Ý[Ëˆ›Ú™XÝYˆ\˜[Y]\œËœ›Ú™XÝYˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È\ÜÚYÛ’\ÜÝYU\TØÜ™Y[”ØÚ[YUÔ›Ú™XÝ
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ú\ÜÝY]\\ØÜ™Y[œØÚ[YKÜ›Ú™XÝ	ËˆY]Ùˆ	ÔU	Ëˆ]NˆÂˆ\ÜÝYU\TØÜ™Y[”ØÚ[YRYˆ\˜[Y]\œÏËš\ÜÝYU\TØÜ™Y[”ØÚ[YRYˆ›Ú™XÝYˆ\˜[Y]\œÏËœ›Ú™XÝYˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È\]R\ÜÝYU\TØÜ™Y[”ØÚ[YJ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ú\ÜÝY]\\ØÜ™Y[œØÚ[YKÉÜ\˜[Y]\œËš\ÜÝYU\TØÜ™Y[”ØÚ[YRYXˆY]Ùˆ	ÔU	Ëˆ]NˆÂˆ˜[YNˆ\˜[Y]\œË›˜[YKˆ\ØÜš\[ÛŽˆ\˜[Y]\œË™\ØÜš\[Û‹ˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È[]R\ÜÝYU\TØÜ™Y[”ØÚ[YJ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝ\ÜÝYU\TØÜ™Y[”ØÚ[YRYH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËš\ÜÝYU\TØÜ™Y[”ØÚ[YRYÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ú\ÜÝY]\\ØÜ™Y[œØÚ[YKÉÚ\ÜÝYU\TØÜ™Y[”ØÚ[YRYXˆY]Ùˆ	ÑSUIËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È\[™X\[™ÜÑ›Ü’\ÜÝYU\TØÜ™Y[”ØÚ[YJ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ú\ÜÝY]\\ØÜ™Y[œØÚ[YKÉÜ\˜[Y]\œËš\ÜÝYU\TØÜ™Y[”ØÚ[YRYKÛX\[™ØˆY]Ùˆ	ÔU	Ëˆ]NˆÂˆ\ÜÝYU\SX\[™ÜÎˆ\˜[Y]\œËš\ÜÝYU\SX\[™ÜËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È\]QY˜][ØÜ™Y[”ØÚ[YJ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ú\ÜÝY]\\ØÜ™Y[œØÚ[YKÉÜ\˜[Y]\œËš\ÜÝYU\TØÜ™Y[”ØÚ[YRYKÛX\[™ËÙY˜][ˆY]Ùˆ	ÔU	Ëˆ]NˆÂˆØÜ™Y[”ØÚ[YRYˆ\˜[Y]\œËœØÜ™Y[”ØÚ[YRYˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È™[[Ý™SX\[™ÜÑœ›ÛR\ÜÝYU\TØÜ™Y[”ØÚ[YJ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ú\ÜÝY]\\ØÜ™Y[œØÚ[YKÉÜ\˜[Y]\œËš\ÜÝYU\TØÜ™Y[”ØÚ[YRYKÛX\[™ËÜ™[[Ý™XˆY]Ùˆ	ÔÔÕ	Ëˆ]NˆÂˆ\ÜÝYU\RYÎˆ\˜[Y]\œËš\ÜÝYU\RYËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]›Ú™XÝÑ›Ü’\ÜÝYU\TØÜ™Y[”ØÚ[YJ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝ\ÜÝYU\TØÜ™Y[”ØÚ[YRYH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËš\ÜÝYU\TØÜ™Y[”ØÚ[YRYÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ú\ÜÝY]\\ØÜ™Y[œØÚ[YKÉÚ\ÜÝYU\TØÜ™Y[”ØÚ[YRYKÜ›Ú™XÝˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆÝ\]ˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈ	‰ˆ\˜[Y]\œËœÝ\]ˆX^™\Ý[Îˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈ	‰ˆ\˜[Y]\œË›X^™\Ý[Ëˆ]Y\žNˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈ	‰ˆ\˜[Y]\œËœ]Y\žKˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBŸB‚˜Û\ÜÈ\ÜÝYU›Ý\ÈÂˆÛY[ÂˆÛÛœÝXÝÜŠÛY[
HÂˆ\Ë˜ÛY[HÛY[ÂˆBˆ\Þ[˜ÈÙ]›Ý\Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝ\ÜÝYRYÜ’Ù^HH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËš\ÜÝYRYÜ’Ù^NÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ú\ÜÝYKÉÚ\ÜÝYRYÜ’Ù^_KÝ›Ý\ØˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈY›ÝJ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝ\ÜÝYRYÜ’Ù^HH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËš\ÜÝYRYÜ’Ù^NÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ú\ÜÝYKÉÚ\ÜÝYRYÜ’Ù^_KÝ›Ý\ØˆY]Ùˆ	ÔÔÕ	ËˆXY\œÎˆÂˆ	ÐÛÛ[U\IÎˆ	Ø\XØ][Û‹ÚœÛÛ‰ËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È™[[Ý™U›ÝJ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝ\ÜÝYRYÜ’Ù^HH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËš\ÜÝYRYÜ’Ù^NÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ú\ÜÝYKÉÚ\ÜÝYRYÜ’Ù^_KÝ›Ý\ØˆY]Ùˆ	ÑSUIËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBŸB‚˜Û\ÜÈ\ÜÝYUØ]Ú\œÈÂˆÛY[ÂˆÛÛœÝXÝÜŠÛY[
HÂˆ\Ë˜ÛY[HÛY[ÂˆBˆ\Þ[˜ÈÙ]\ÕØ]Ú[™Ò\ÜÝYP[Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ú\ÜÝYKÝØ]Ú[™ÉËˆY]Ùˆ	ÔÔÕ	Ëˆ]NˆÂˆ\ÜÝYRYÎˆ\˜[Y]\œÏËš\ÜÝYRYËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]\ÜÝYUØ]Ú\œÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝ\ÜÝYRYÜ’Ù^HH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËš\ÜÝYRYÜ’Ù^NÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ú\ÜÝYKÉÚ\ÜÝYRYÜ’Ù^_KÝØ]Ú\œØˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈYØ]Ú\Š\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ú\ÜÝYKÉÜ\˜[Y]\œËš\ÜÝYRYÜ’Ù^_KÝØ]Ú\œØˆY]Ùˆ	ÔÔÕ	ËˆXY\œÎˆÂˆ	ÐÛÛ[U\IÎˆ	Ø\XØ][Û‹ÚœÛÛ‰ËˆKˆ]Nˆ\˜[Y]\œË˜XØÛÝ[YˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È™[[Ý™UØ]Ú\Š\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ú\ÜÝYKÉÜ\˜[Y]\œËš\ÜÝYRYÜ’Ù^_KÝØ]Ú\œØˆY]Ùˆ	ÑSUIËˆ\˜[\ÎˆÂˆXØÛÝ[Yˆ\˜[Y]\œË˜XØÛÝ[YˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBŸB‚˜Û\ÜÈ\ÜÝYUÛÜšÛÙÔ›Ü\Y\ÈÂˆÛY[ÂˆÛÛœÝXÝÜŠÛY[
HÂˆ\Ë˜ÛY[HÛY[ÂˆBˆ\Þ[˜ÈÙ]ÛÜšÛÙÔ›Ü\RÙ^\Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ú\ÜÝYKÉÜ\˜[Y]\œËš\ÜÝYRYÜ’Ù^_KÝÛÜšÛÙËÉÜ\˜[Y]\œËÛÜšÛÙÒYKÜ›Ü\Y\ØˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]ÛÜšÛÙÔ›Ü\J\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ú\ÜÝYKÉÜ\˜[Y]\œËš\ÜÝYRYÜ’Ù^_KÝÛÜšÛÙËÉÜ\˜[Y]\œËÛÜšÛÙÒYKÜ›Ü\Y\ËÉÜ\˜[Y]\œËœ›Ü\RÙ^_XˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]ÛÜšÛÙÔ›Ü\J\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ú\ÜÝYKÉÜ\˜[Y]\œËš\ÜÝYRYÜ’Ù^_KÝÛÜšÛÙËÉÜ\˜[Y]\œËÛÜšÛÙÒYKÜ›Ü\Y\ËÉÜ\˜[Y]\œËœ›Ü\RÙ^_XˆY]Ùˆ	ÔU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È[]UÛÜšÛÙÔ›Ü\J\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ú\ÜÝYKÉÜ\˜[Y]\œËš\ÜÝYRYÜ’Ù^_KÝÛÜšÛÙËÉÜ\˜[Y]\œËÛÜšÛÙÒYKÜ›Ü\Y\ËÉÜ\˜[Y]\œËœ›Ü\RÙ^_XˆY]Ùˆ	ÑSUIËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBŸB‚˜Û\ÜÈ\ÜÝYUÛÜšÛÙÜÈÂˆÛY[ÂˆÛÛœÝXÝÜŠÛY[
HÂˆ\Ë˜ÛY[HÛY[ÂˆBˆ\Þ[˜ÈÙ]\ÜÝYUÛÜšÛÙÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝ\ÜÝYRYÜ’Ù^HH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËš\ÜÝYRYÜ’Ù^NÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ú\ÜÝYKÉÚ\ÜÝYRYÜ’Ù^_KÝÛÜšÛÙØˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆÝ\]ˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œËœÝ\]ˆ[™Yš[™YˆX^™\Ý[Îˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œË›X^™\Ý[Èˆ[™Yš[™YˆÝ\YY\Žˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œËœÝ\YY\ˆˆ[™Yš[™YˆÝ\Y™Y›Ü™Nˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œËœÝ\Y™Y›Ü™Hˆ[™Yš[™Yˆ^[™ˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œË™^[™ˆ[™Yš[™YˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈYÛÜšÛÙÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ú\ÜÝYKÉÜ\˜[Y]\œËš\ÜÝYRYÜ’Ù^_KÝÛÜšÛÙØˆY]Ùˆ	ÔÔÕ	Ëˆ\˜[\ÎˆÂˆ›ÝYžU\Ù\œÎˆ\˜[Y]\œË››ÝYžU\Ù\œËˆY\Ý\Ý[X]Nˆ\˜[Y]\œË˜Y\Ý\Ý[X]Kˆ™]Ñ\Ý[X]Nˆ\˜[Y]\œË›™]Ñ\Ý[X]Kˆ™YXÙPžNˆ\˜[Y]\œËœ™YXÙPžKˆ^[™ˆ\˜[Y]\œË™^[™ˆÝ™\œšYQY]X›Q›YÎˆ\˜[Y]\œË›Ý™\œšYQY]X›Q›YËˆKˆ]NˆÂˆ]]ÜŽˆ\˜[Y]\œË˜]]Ü‹ˆÛÛ[Y[ˆ\˜[Y]\œË˜ÛÛ[Y[ˆÜ™X]Yˆ\˜[Y]\œË˜Ü™X]YˆYˆ\˜[Y]\œËšYˆ\ÜÝYRYˆ\˜[Y]\œËš\ÜÝYRYˆ›Ü\Y\Îˆ\˜[Y]\œËœ›Ü\Y\ËˆÙ[Žˆ\˜[Y]\œËœÙ[‹ˆÝ\Yˆ\˜[Y]\œËœÝ\Yˆ[YTÜ[ˆ\˜[Y]\œË[YTÜ[ˆ[YTÜ[ÙXÛÛ™Îˆ\˜[Y]\œË[YTÜ[ÙXÛÛ™Ëˆ\]P]]ÜŽˆ\˜[Y]\œË\]P]]Ü‹ˆ\]Yˆ\˜[Y]\œË\]Yˆš\ÚXš[]Nˆ\˜[Y]\œËš\ÚXš[]KˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È[Ñ[]UÛÜšÛÙÜÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ú\ÜÝYKÉÜ\˜[Y]\œËš\ÜÝYRYÜ’Ù^_KÝÛÜšÛÙØˆY]Ùˆ	ÑSUIËˆ\˜[\ÎˆÂˆY\Ý\Ý[X]Nˆ\˜[Y]\œË˜Y\Ý\Ý[X]KˆÝ™\œšYQY]X›Q›YÎˆ\˜[Y]\œË›Ý™\œšYQY]X›Q›YËˆKˆ]NˆÂˆYÎˆ\˜[Y]\œËšYËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È[Ó[Ý™UÛÜšÛÙÜÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ú\ÜÝYKÉÜ\˜[Y]\œËš\ÜÝYRYÜ’Ù^_KÝÛÜšÛÙËÛ[Ý™XˆY]Ùˆ	ÔÔÕ	Ëˆ\˜[\ÎˆÂˆY\Ý\Ý[X]Nˆ\˜[Y]\œË˜Y\Ý\Ý[X]KˆÝ™\œšYQY]X›Q›YÎˆ\˜[Y]\œË›Ý™\œšYQY]X›Q›YËˆKˆ]Nˆ\˜[Y]\œËÛÜšÛÙÜËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]ÛÜšÛÙÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ú\ÜÝYKÉÜ\˜[Y]\œËš\ÜÝYRYÜ’Ù^_KÝÛÜšÛÙËÉÜ\˜[Y]\œËšYXˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆ^[™ˆ\˜[Y]\œË™^[™ˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È\]UÛÜšÛÙÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ú\ÜÝYKÉÜ\˜[Y]\œËš\ÜÝYRYÜ’Ù^_KÝÛÜšÛÙËÉÜ\˜[Y]\œËšYXˆY]Ùˆ	ÔU	Ëˆ\˜[\ÎˆÂˆ›ÝYžU\Ù\œÎˆ\˜[Y]\œË››ÝYžU\Ù\œËˆY\Ý\Ý[X]Nˆ\˜[Y]\œË˜Y\Ý\Ý[X]Kˆ™]Ñ\Ý[X]Nˆ\˜[Y]\œË›™]Ñ\Ý[X]Kˆ^[™ˆ\˜[Y]\œË™^[™ˆÝ™\œšYQY]X›Q›YÎˆ\˜[Y]\œË›Ý™\œšYQY]X›Q›YËˆKˆ]NˆÂˆÛÛ[Y[ˆ\˜[Y]\œË˜ÛÛ[Y[ˆš\ÚXš[]Nˆ\˜[Y]\œËš\ÚXš[]KˆÝ\Yˆ\˜[Y]\œËœÝ\Yˆ[YTÜ[ˆ\˜[Y]\œË[YTÜ[ˆ[YTÜ[ÙXÛÛ™Îˆ\˜[Y]\œË[YTÜ[ÙXÛÛ™Ëˆ›Ü\Y\Îˆ\˜[Y]\œËœ›Ü\Y\ËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È[]UÛÜšÛÙÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ú\ÜÝYKÉÜ\˜[Y]\œËš\ÜÝYRYÜ’Ù^_KÝÛÜšÛÙËÉÜ\˜[Y]\œËšYXˆY]Ùˆ	ÑSUIËˆ\˜[\ÎˆÂˆ›ÝYžU\Ù\œÎˆ\˜[Y]\œË››ÝYžU\Ù\œËˆY\Ý\Ý[X]Nˆ\˜[Y]\œË˜Y\Ý\Ý[X]Kˆ™]Ñ\Ý[X]Nˆ\˜[Y]\œË›™]Ñ\Ý[X]Kˆ[˜Ü™X\ÙPžNˆ\˜[Y]\œËš[˜Ü™X\ÙPžKˆÝ™\œšYQY]X›Q›YÎˆ\˜[Y]\œË›Ý™\œšYQY]X›Q›YËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]YÓÙ•ÛÜšÛÙÜÑ[]YÚ[˜ÙJ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹ÝÛÜšÛÙËÙ[]Y	ËˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆÚ[˜ÙNˆ\˜[Y]\œÏËœÚ[˜ÙKˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]ÛÜšÛÙÜÑ›Ü’YÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹ÝÛÜšÛÙËÛ\Ý	ËˆY]Ùˆ	ÔÔÕ	Ëˆ\˜[\ÎˆÂˆ^[™ˆ\˜[Y]\œÏË™^[™ˆKˆ]NˆÂˆYÎˆ\˜[Y]\œÏËšYËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]YÓÙ•ÛÜšÛÙÜÓ[ÙYšYYÚ[˜ÙJ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹ÝÛÜšÛÙËÝ\]Y	ËˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆÚ[˜ÙNˆ\˜[Y]\œÏËœÚ[˜ÙKˆ^[™ˆ\˜[Y]\œÏË™^[™ˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBŸB‚˜Û\ÜÈš\˜Q^™\ÜÚ[ÛœÈÂˆÛY[ÂˆÛÛœÝXÝÜŠÛY[
HÂˆ\Ë˜ÛY[HÛY[ÂˆBˆ\Þ[˜È[˜[\ÙQ^™\ÜÚ[ÛŠ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ù^™\ÜÚ[Û‹Ø[˜[\ÙIËˆY]Ùˆ	ÔÔÕ	Ëˆ\˜[\ÎˆÂˆÚXÚÎˆ\˜[Y]\œÏË˜ÚXÚËˆKˆ]NˆÂˆÛÛ^˜\šXX›\Îˆ\˜[Y]\œÏË˜ÛÛ^˜\šXX›\Ëˆ^™\ÜÚ[ÛœÎˆ\˜[Y]\œÏË™^™\ÜÚ[ÛœËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È]˜[X]Rš\˜Q^™\ÜÚ[ÛŠ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ù^™\ÜÚ[Û‹Ù]˜[	ËˆY]Ùˆ	ÔÔÕ	Ëˆ\˜[\ÎˆÂˆ^[™ˆ\˜[Y]\œË™^[™ˆKˆ]NˆÂˆÛÛ^ˆ\˜[Y]\œË˜ÛÛ^ˆ^™\ÜÚ[ÛŽˆ\˜[Y]\œË™^™\ÜÚ[Û‹ˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È]˜[X]Rš\˜Q^™\ÜÚ[Û•\Ú[™Ñ[š[˜ÙYÙX\˜Ú
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ù^™\ÜÚ[Û‹Ù]˜[X]IËˆY]Ùˆ	ÔÔÕ	Ëˆ\˜[\ÎˆÂˆ^[™ˆ\˜[Y]\œË™^[™ˆKˆ]NˆÂˆ^™\ÜÚ[ÛŽˆ\˜[Y]\œË™^™\ÜÚ[Û‹ˆÛÛ^ˆ\˜[Y]\œË˜ÛÛ^ˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBŸB‚˜Û\ÜÈš\˜TÙ][™ÜÈÂˆÛY[ÂˆÛÛœÝXÝÜŠÛY[
HÂˆ\Ë˜ÛY[HÛY[ÂˆBˆ\Þ[˜ÈÙ]\XØ][Û”›Ü\J\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ø\XØ][Û‹\›Ü\Y\ÉËˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆÙ^Nˆ\˜[Y]\œÏËšÙ^Kˆ\›Z\ÜÚ[Û“]™[ˆ\˜[Y]\œÏËœ\›Z\ÜÚ[Û“]™[ˆÙ^Qš[\Žˆ\˜[Y]\œÏËšÙ^Qš[\‹ˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]Y˜[˜ÙYÙ][™ÜÊØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ø\XØ][Û‹\›Ü\Y\ËØY˜[˜ÙY\Ù][™ÜÉËˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]\XØ][Û”›Ü\J\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ø\XØ][Û‹\›Ü\Y\ËÉÜ\˜[Y]\œËšYXˆY]Ùˆ	ÔU	Ëˆ]Nˆ\˜[Y]\œË˜›ÙKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]ÛÛ™šYÝ\˜][ÛŠØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹ØÛÛ™šYÝ\˜][Û‰ËˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBŸB‚˜Û\ÜÈ”SÂˆÛY[ÂˆÛÛœÝXÝÜŠÛY[
HÂˆ\Ë˜ÛY[HÛY[ÂˆBˆ\Þ[˜ÈÙ]]]ÐÛÛ\]JØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Úœ[Ø]]ØÛÛ\]Y]IËˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]]]ÐÛÛ\]TÜÝ
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Úœ[Ø]]ØÛÛ\]Y]IËˆY]Ùˆ	ÔÔÕ	Ëˆ]NˆÂˆ[˜ÛYPÛÛ\ÙYšY[Îˆ\˜[Y]\œÏËš[˜ÛYPÛÛ\ÙYšY[Ëˆ›Ú™XÝYÎˆ\˜[Y]\œÏËœ›Ú™XÝYËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]šY[]]ÐÛÛ\]Q›Ü”]Y\žTÝš[™Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Úœ[Ø]]ØÛÛ\]Y]KÜÝYÙÙ\Ý[ÛœÉËˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆšY[˜[YNˆ\˜[Y]\œÏË™šY[˜[YKˆšY[˜[YNˆ\˜[Y]\œÏË™šY[˜[YKˆ™YXØ]S˜[YNˆ\˜[Y]\œÏËœ™YXØ]S˜[YKˆ™YXØ]U˜[YNˆ\˜[Y]\œÏËœ™YXØ]U˜[YKˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È\œÙRœ[]Y\šY\Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Úœ[Ü\œÙIËˆY]Ùˆ	ÔÔÕ	Ëˆ\˜[\ÎˆÂˆ˜[Y][ÛŽˆ\˜[Y]\œË˜[Y][Û‹ˆKˆ]NˆÂˆ]Y\šY\Îˆ\˜[Y]\œËœ]Y\šY\ËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈZYÜ˜]T]Y\šY\Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Úœ[ÜÛX[™\‰ËˆY]Ùˆ	ÔÔÕ	Ëˆ]NˆÂˆ]Y\žTÝš[™ÜÎˆ\˜[Y]\œÏËœ]Y\žTÝš[™ÜËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈØ[š]\ÙRœ[]Y\šY\Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Úœ[ÜØ[š]^™IËˆY]Ùˆ	ÔÔÕ	Ëˆ]NˆÂˆ]Y\šY\Îˆ\˜[Y]\œÏËœ]Y\šY\ËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBŸB‚˜Û\ÜÈœ[[˜Ý[ÛœÐ\ÈÂˆÛY[ÂˆÛÛœÝXÝÜŠÛY[
HÂˆ\Ë˜ÛY[HÛY[ÂˆBˆ\Þ[˜ÈÙ]™XÛÛ\]][ÛœÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Úœ[Ù[˜Ý[Û‹ØÛÛ\]][Û‰ËˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆ[˜Ý[Û’Ù^Nˆ\˜[Y]\œÏË™[˜Ý[Û’Ù^KˆÝ\]ˆ\˜[Y]\œÏËœÝ\]ˆX^™\Ý[Îˆ\˜[Y]\œÏË›X^™\Ý[ËˆÜ™\žNˆ\˜[Y]\œÏË›Ü™\žKˆš[\Žˆ\˜[Y]\œÏË™š[\‹ˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È\]T™XÛÛ\]][ÛœÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Úœ[Ù[˜Ý[Û‹ØÛÛ\]][Û‰ËˆY]Ùˆ	ÔÔÕ	Ëˆ\˜[\ÎˆÂˆÚÚ\›Ý›Ý[™™XÛÛ\]][ÛœÎˆ\˜[Y]\œËœÚÚ\›Ý›Ý[™™XÛÛ\]][ÛœËˆKˆ]NˆÂˆ˜[Y\Îˆ\˜[Y]\œË˜[Y\ËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]™XÛÛ\]][ÛœÐžRQ
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Úœ[Ù[˜Ý[Û‹ØÛÛ\]][Û‹ÜÙX\˜Ú	ËˆY]Ùˆ	ÔÔÕ	Ëˆ\˜[\ÎˆÂˆÜ™\žNˆ\˜[Y]\œË›Ü™\žKˆKˆ]NˆÂˆ™XÛÛ\]][Û’QÎˆ\˜[Y]\œËœ™XÛÛ\]][Û’QËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBŸB‚˜Û\ÜÈX™[ÈÂˆÛY[ÂˆÛÛœÝXÝÜŠÛY[
HÂˆ\Ë˜ÛY[HÛY[ÂˆBˆ\Þ[˜ÈÙ][X™[Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹ÛX™[	ËˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆÝ\]ˆ\˜[Y]\œÏËœÝ\]ˆX^™\Ý[Îˆ\˜[Y]\œÏË›X^™\Ý[ËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBŸB‚˜Û\ÜÈXÙ[œÙSY]šXÜÈÂˆÛY[ÂˆÛÛœÝXÝÜŠÛY[
HÂˆ\Ë˜ÛY[HÛY[ÂˆBˆ\Þ[˜ÈÙ]XÙ[œÙJØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ú[œÝ[˜ÙKÛXÙ[œÙIËˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]\›Þ[X]SXÙ[œÙPÛÝ[
Ø[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹ÛXÙ[œÙKØ\›Þ[X]SXÙ[œÙPÛÝ[	ËˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]\›Þ[X]P\XØ][Û“XÙ[œÙPÛÝ[
\XØ][Û’Ù^KØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ÛXÙ[œÙKØ\›Þ[X]SXÙ[œÙPÛÝ[Ü›ÙXÝÉØ\XØ][Û’Ù^_XˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBŸB‚˜Û\ÜÈZYÜ˜][Û“ÙÛÛ›™XÝ[Ù[\ÕÑ›Ü™ÙHÂˆÛY[ÂˆÛÛœÝXÝÜŠÛY[
HÂˆ\Ë˜ÛY[HÛY[ÂˆBˆ\Þ[˜È™]ÚZYÜ˜][Û•\ÚÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ]\ÜÚX[‹XÛÛ›™XÝÌKÛZYÜ˜][Û‹ÉÜ\˜[Y]\œË˜ÛÛ›™XÝÙ^_KÉÜ\˜[Y]\œËšš\˜R\ÜÝYQšY[ÒÙ^_KÝ\ÚØˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBŸB‚˜Û\ÜÈ^\Ù[ˆÂˆÛY[ÂˆÛÛœÝXÝÜŠÛY[
HÂˆ\Ë˜ÛY[HÛY[ÂˆBˆ\Þ[˜ÈÙ]™Y™\™[˜ÙJ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Û^\™Y™\™[˜Ù\ÉËˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆÙ^Nˆ\˜[Y]\œËšÙ^KˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]™Y™\™[˜ÙJ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Û^\™Y™\™[˜Ù\ÉËˆY]Ùˆ	ÔU	ËˆXY\œÎˆÂˆ	ÐÛÛ[U\IÎˆ\[Ùˆ\˜[Y]\œË˜[YHOOH	ÜÝš[™ÉÈÈ	Ý^ÜZ[‰Èˆ	Ø\XØ][Û‹ÚœÛÛ‰ËˆKˆ\˜[\ÎˆÂˆÙ^Nˆ\˜[Y]\œËšÙ^KˆKˆ]Nˆ\˜[Y]\œË˜[YKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È™[[Ý™T™Y™\™[˜ÙJ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Û^\™Y™\™[˜Ù\ÉËˆY]Ùˆ	ÑSUIËˆ\˜[\ÎˆÂˆÙ^Nˆ\˜[Y]\œËšÙ^KˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]ØØ[JØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Û^\™Y™\™[˜Ù\ËÛØØ[IËˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]Ý\œ™[\Ù\Š\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Û^\Ù[‰ËˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆ^[™ˆ\˜[Y]\œÏË™^[™ˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBŸB‚˜Û\ÜÈ\›Z\ÜÚ[ÛœÈÂˆÛY[ÂˆÛÛœÝXÝÜŠÛY[
HÂˆ\Ë˜ÛY[HÛY[ÂˆBˆ\Þ[˜ÈÙ]^T\›Z\ÜÚ[ÛœÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Û^\\›Z\ÜÚ[ÛœÉËˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆ›Ú™XÝÙ^Nˆ\˜[Y]\œÏËœ›Ú™XÝÙ^Kˆ›Ú™XÝYˆ\˜[Y]\œÏËœ›Ú™XÝYˆ\ÜÝYRÙ^Nˆ\˜[Y]\œÏËš\ÜÝYRÙ^Kˆ\ÜÝYRYˆ\˜[Y]\œÏËš\ÜÝYRYˆ\›Z\ÜÚ[ÛœÎˆ\˜[Y]\œÏËœ\›Z\ÜÚ[ÛœËˆ›Ú™XÝ]ZYˆ\˜[Y]\œÏËœ›Ú™XÝ]ZYˆ›Ú™XÝÛÛ™šYÝ\˜][Û•]ZYˆ\˜[Y]\œÏËœ›Ú™XÝÛÛ™šYÝ\˜][Û•]ZYˆÛÛ[Y[Yˆ\˜[Y]\œÏË˜ÛÛ[Y[YˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ][\›Z\ÜÚ[ÛœÊØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ü\›Z\ÜÚ[ÛœÉËˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ][Ô\›Z\ÜÚ[ÛœÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ü\›Z\ÜÚ[ÛœËØÚXÚÉËˆY]Ùˆ	ÔÔÕ	Ëˆ]NˆÂˆXØÛÝ[Yˆ\˜[Y]\œÏË˜XØÛÝ[YˆÛØ˜[\›Z\ÜÚ[ÛœÎˆ\˜[Y]\œÏË™ÛØ˜[\›Z\ÜÚ[ÛœËˆ›Ú™XÝ\›Z\ÜÚ[ÛœÎˆ\˜[Y]\œÏËœ›Ú™XÝ\›Z\ÜÚ[ÛœËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]\›Z]Y›Ú™XÝÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ü\›Z\ÜÚ[ÛœËÜ›Ú™XÝ	ËˆY]Ùˆ	ÔÔÕ	Ëˆ]NˆÂˆ\›Z\ÜÚ[ÛœÎˆ\˜[Y]\œÏËœ\›Z\ÜÚ[ÛœËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBŸB‚˜Û\ÜÈ\›Z\ÜÚ[Û”ØÚ[Y\ÈÂˆÛY[ÂˆÛÛœÝXÝÜŠÛY[
HÂˆ\Ë˜ÛY[HÛY[ÂˆBˆ\Þ[˜ÈÙ][\›Z\ÜÚ[Û”ØÚ[Y\Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ü\›Z\ÜÚ[ÛœØÚ[YIËˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆ^[™ˆ\˜[Y]\œÏË™^[™ˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÜ™X]T\›Z\ÜÚ[Û”ØÚ[YJ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ü\›Z\ÜÚ[ÛœØÚ[YIËˆY]Ùˆ	ÔÔÕ	Ëˆ\˜[\ÎˆÂˆ^[™ˆ\˜[Y]\œÏË™^[™ˆKˆ]NˆÂˆ‹‹œ\˜[Y]\œËˆ^[™ˆ[™Yš[™YˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]\›Z\ÜÚ[Û”ØÚ[YJ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝØÚ[YRYH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËœØÚ[YRYÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ü\›Z\ÜÚ[ÛœØÚ[YKÉÜØÚ[YRYXˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆ^[™ˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œË™^[™ˆ[™Yš[™YˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È\]T\›Z\ÜÚ[Û”ØÚ[YJ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ü\›Z\ÜÚ[ÛœØÚ[YKÉÜ\˜[Y]\œËœØÚ[YRYXˆY]Ùˆ	ÔU	Ëˆ\˜[\ÎˆÂˆ^[™ˆ\˜[Y]\œË™^[™ˆKˆ]NˆÂˆ‹‹œ\˜[Y]\œËˆØÚ[YRYˆ[™Yš[™Yˆ^[™ˆ[™Yš[™YˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È[]T\›Z\ÜÚ[Û”ØÚ[YJ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ü\›Z\ÜÚ[ÛœØÚ[YKÉÜ\˜[Y]\œËœØÚ[YRYXˆY]Ùˆ	ÑSUIËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]\›Z\ÜÚ[Û”ØÚ[YQÜ˜[Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ü\›Z\ÜÚ[ÛœØÚ[YKÉÜ\˜[Y]\œËœØÚ[YRYKÜ\›Z\ÜÚ[Û˜ˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆ^[™ˆ\˜[Y]\œË™^[™ˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÜ™X]T\›Z\ÜÚ[Û‘Ü˜[
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ü\›Z\ÜÚ[ÛœØÚ[YKÉÜ\˜[Y]\œËœØÚ[YRYKÜ\›Z\ÜÚ[Û˜ˆY]Ùˆ	ÔÔÕ	Ëˆ\˜[\ÎˆÂˆ^[™ˆ\˜[Y]\œË™^[™ˆKˆ]NˆÂˆÛ\Žˆ\˜[Y]\œËšÛ\‹ˆYˆ\˜[Y]\œËšYˆ\›Z\ÜÚ[ÛŽˆ\˜[Y]\œËœ\›Z\ÜÚ[Û‹ˆÙ[Žˆ\˜[Y]\œËœÙ[‹ˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]\›Z\ÜÚ[Û”ØÚ[YQÜ˜[
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ü\›Z\ÜÚ[ÛœØÚ[YKÉÜ\˜[Y]\œËœØÚ[YRYKÜ\›Z\ÜÚ[Û‹ÉÜ\˜[Y]\œËœ\›Z\ÜÚ[Û’YXˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆ^[™ˆ\˜[Y]\œË™^[™ˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È[]T\›Z\ÜÚ[Û”ØÚ[YQ[]J\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ü\›Z\ÜÚ[ÛœØÚ[YKÉÜ\˜[Y]\œËœØÚ[YRYKÜ\›Z\ÜÚ[Û‹ÉÜ\˜[Y]\œËœ\›Z\ÜÚ[Û’YXˆY]Ùˆ	ÑSUIËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBŸB‚˜Û\ÜÈ[œÈÂˆÛY[ÂˆÛÛœÝXÝÜŠÛY[
HÂˆ\Ë˜ÛY[HÛY[ÂˆBˆ\Þ[˜ÈÙ][œÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ü[œËÜ[‰ËˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆ[˜ÛYU˜\ÚYˆ\˜[Y]\œÏËš[˜ÛYU˜\ÚYˆ[˜ÛYP\˜Ú]™Yˆ\˜[Y]\œÏËš[˜ÛYP\˜Ú]™YˆÝ\œÛÜŽˆ\˜[Y]\œÏË˜Ý\œÛÜ‹ˆX^™\Ý[Îˆ\˜[Y]\œÏË›X^™\Ý[ËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÜ™X]T[Š\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ü[œËÜ[‰ËˆY]Ùˆ	ÔÔÕ	Ëˆ\˜[\ÎˆÂˆ\ÙQÜ›Ý\Yˆ\˜[Y]\œË\ÙQÜ›Ý\YˆKˆ]NˆÂˆÜ›ÜÜÔ›Ú™XÝ™[X\Ù\Îˆ\˜[Y]\œË˜Ü›ÜÜÔ›Ú™XÝ™[X\Ù\ËˆÝ\ÝÛQšY[Îˆ\˜[Y]\œË˜Ý\ÝÛQšY[Ëˆ^Û\Ú[Û”[\Îˆ\˜[Y]\œË™^Û\Ú[Û”[\Ëˆ\ÜÝYTÛÝ\˜Ù\Îˆ\˜[Y]\œËš\ÜÝYTÛÝ\˜Ù\ËˆXYXØÛÝ[Yˆ\˜[Y]\œË›XYXØÛÝ[Yˆ˜[YNˆ\˜[Y]\œË›˜[YKˆ\›Z\ÜÚ[ÛœÎˆ\˜[Y]\œËœ\›Z\ÜÚ[ÛœËˆØÚY[[™Îˆ\˜[Y]\œËœØÚY[[™ËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ][Š\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ü[œËÜ[‹ÉÜ\˜[Y]\œËœ[’YXˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆ\ÙQÜ›Ý\Yˆ\˜[Y]\œË\ÙQÜ›Ý\YˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È\]T[Š\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ü[œËÜ[‹ÉÜ\˜[Y]\œËœ[’YXˆY]Ùˆ	ÔU	Ëˆ\˜[\ÎˆÂˆ\ÙQÜ›Ý\Yˆ\˜[Y]\œË\ÙQÜ›Ý\YˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È\˜Ú]™T[Š\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ü[œËÜ[‹ÉÜ\˜[Y]\œËœ[’YKØ\˜Ú]™XˆY]Ùˆ	ÔU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È\XØ]T[Š\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ü[œËÜ[‹ÉÜ\˜[Y]\œËœ[’YKÙ\XØ]XˆY]Ùˆ	ÔÔÕ	Ëˆ]NˆÂˆ˜[YNˆ\˜[Y]\œË›˜[YKˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È˜\Ú[Š\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ü[œËÜ[‹ÉÜ\˜[Y]\œËœ[’YKÝ˜\ÚˆY]Ùˆ	ÔU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBŸB‚˜Û\ÜÈš[Üš]TØÚ[Y\ÈÂˆÛY[ÂˆÛÛœÝXÝÜŠÛY[
HÂˆ\Ë˜ÛY[HÛY[ÂˆBˆ\Þ[˜ÈÙ]š[Üš]TØÚ[Y\Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Üš[Üš]\ØÚ[YIËˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆÝ\]ˆ\˜[Y]\œÏËœÝ\]ˆX^™\Ý[Îˆ\˜[Y]\œÏË›X^™\Ý[Ëˆš[Üš]RYˆ\˜[TÙ\šX[^™\Š	Üš[Üš]RY	Ë\˜[Y]\œÏËœš[Üš]RY
KˆØÚ[YRYˆ\˜[TÙ\šX[^™\Š	ÜØÚ[YRY	Ë\˜[Y]\œÏËœØÚ[YRY
KˆØÚ[YS˜[YNˆ\˜[Y]\œÏËœØÚ[YS˜[YKˆÛ›QY˜][ˆ\˜[Y]\œÏË›Û›QY˜][ˆÜ™\žNˆ\˜[Y]\œÏË›Ü™\žKˆ^[™ˆ\˜[Y]\œÏË™^[™ˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÜ™X]Tš[Üš]TØÚ[YJ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Üš[Üš]\ØÚ[YIËˆY]Ùˆ	ÔÔÕ	Ëˆ]NˆÂˆY˜][š[Üš]RYˆ\˜[Y]\œË™Y˜][š[Üš]RYˆ\ØÜš\[ÛŽˆ\˜[Y]\œË™\ØÜš\[Û‹ˆX\[™ÜÎˆ\˜[Y]\œË›X\[™ÜËˆ˜[YNˆ\˜[Y]\œË›˜[YKˆš[Üš]RYÎˆ\˜[Y]\œËœš[Üš]RYËˆ›Ú™XÝYÎˆ\˜[Y]\œËœ›Ú™XÝYËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÝYÙÙ\ÝYš[Üš]Y\Ñ›Ü“X\[™ÜÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Üš[Üš]\ØÚ[YKÛX\[™ÜÉËˆY]Ùˆ	ÔÔÕ	Ëˆ]NˆÂˆX^™\Ý[Îˆ\˜[Y]\œÏË›X^™\Ý[Ëˆš[Üš]Y\Îˆ\˜[Y]\œÏËœš[Üš]Y\Ëˆ›Ú™XÝÎˆ\˜[Y]\œÏËœ›Ú™XÝËˆØÚ[YRYˆ\˜[Y]\œÏËœØÚ[YRYˆÝ\]ˆ\˜[Y]\œÏËœÝ\]ˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]]˜Z[X›Tš[Üš]Y\ÐžTš[Üš]TØÚ[YJ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Üš[Üš]\ØÚ[YKÜš[Üš]Y\ËØ]˜Z[X›IËˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆÝ\]ˆ\˜[Y]\œËœÝ\]ˆX^™\Ý[Îˆ\˜[Y]\œË›X^™\Ý[Ëˆ]Y\žNˆ\˜[Y]\œËœ]Y\žKˆØÚ[YRYˆ\˜[Y]\œËœØÚ[YRYˆ^ÛYNˆ\˜[Y]\œË™^ÛYKˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È\]Tš[Üš]TØÚ[YJ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Üš[Üš]\ØÚ[YKÉÜ\˜[Y]\œËœØÚ[YRYXˆY]Ùˆ	ÔU	Ëˆ]NˆÂˆY˜][š[Üš]RYˆ\˜[Y]\œË™Y˜][š[Üš]RYˆ\ØÜš\[ÛŽˆ\˜[Y]\œË™\ØÜš\[Û‹ˆX\[™ÜÎˆ\˜[Y]\œË›X\[™ÜËˆ˜[YNˆ\˜[Y]\œË›˜[YKˆš[Üš]Y\Îˆ\˜[Y]\œËœš[Üš]Y\Ëˆ›Ú™XÝÎˆ\˜[Y]\œËœ›Ú™XÝËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È[]Tš[Üš]TØÚ[YJ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Üš[Üš]\ØÚ[YKÉÜ\˜[Y]\œËœØÚ[YRYXˆY]Ùˆ	ÑSUIËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]š[Üš]Y\ÐžTš[Üš]TØÚ[YJ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Üš[Üš]\ØÚ[YKÉÜ\˜[Y]\œËœØÚ[YRYKÜš[Üš]Y\ØˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆÝ\]ˆ\˜[Y]\œËœÝ\]ˆX^™\Ý[Îˆ\˜[Y]\œË›X^™\Ý[ËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]›Ú™XÝÐžTš[Üš]TØÚ[YJ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Üš[Üš]\ØÚ[YKÉÜ\˜[Y]\œËœØÚ[YRYKÜ›Ú™XÝØˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆÝ\]ˆ\˜[Y]\œËœÝ\]ˆX^™\Ý[Îˆ\˜[Y]\œË›X^™\Ý[Ëˆ›Ú™XÝYˆ\˜[TÙ\šX[^™\Š	Ü›Ú™XÝY	Ë\˜[Y]\œËœ›Ú™XÝY
Kˆ]Y\žNˆ\˜[Y]\œËœ]Y\žKˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBŸB‚˜Û\ÜÈ›Ú™XÝ]˜]\œÈÂˆÛY[ÂˆÛÛœÝXÝÜŠÛY[
HÂˆ\Ë˜ÛY[HÛY[ÂˆBˆ\Þ[˜È\]T›Ú™XÝ]˜]\Š\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ü›Ú™XÝÉÜ\˜[Y]\œËœ›Ú™XÝYÜ’Ù^_KØ]˜]\˜ˆY]Ùˆ	ÔU	Ëˆ]NˆÂˆš[S˜[YNˆ\˜[Y]\œË™š[S˜[YKˆYˆ\˜[Y]\œËšYˆ\Ñ[]X›Nˆ\˜[Y]\œËš\Ñ[]X›Kˆ\ÔÙ[XÝYˆ\˜[Y]\œËš\ÔÙ[XÝYˆ\ÔÞ\Ý[P]˜]\Žˆ\˜[Y]\œËš\ÔÞ\Ý[P]˜]\‹ˆÝÛ™\Žˆ\˜[Y]\œË›ÝÛ™\‹ˆ\›Îˆ\˜[Y]\œË\›ËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È[]T›Ú™XÝ]˜]\Š\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ü›Ú™XÝÉÜ\˜[Y]\œËœ›Ú™XÝYÜ’Ù^_KØ]˜]\‹ÉÜ\˜[Y]\œËšYXˆY]Ùˆ	ÑSUIËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÜ™X]T›Ú™XÝ]˜]\Š\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ü›Ú™XÝÉÜ\˜[Y]\œËœ›Ú™XÝYÜ’Ù^_KØ]˜]\Œ˜ˆY]Ùˆ	ÔÔÕ	ËˆXY\œÎˆÂˆ	ÖP]\ÜÚX[‹UÚÙ[‰Îˆ	Û›ËXÚXÚÉËˆ	ÐÛÛ[U\IÎˆ\˜[Y]\œË›Z[YU\KˆKˆ\˜[\ÎˆÂˆˆ\˜[Y]\œËžˆNˆ\˜[Y]\œËžKˆÚ^™Nˆ\˜[Y]\œËœÚ^™HÏÈˆKˆ]Nˆ\˜[Y]\œË˜]˜]\‹ˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ][›Ú™XÝ]˜]\œÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝ›Ú™XÝYÜ’Ù^HH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËœ›Ú™XÝYÜ’Ù^NÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ü›Ú™XÝÉÜ›Ú™XÝYÜ’Ù^_KØ]˜]\œØˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBŸB‚˜Û\ÜÈ›Ú™XÝØ]YÛÜšY\ÈÂˆÛY[ÂˆÛÛœÝXÝÜŠÛY[
HÂˆ\Ë˜ÛY[HÛY[ÂˆBˆ\Þ[˜ÈÙ][›Ú™XÝØ]YÛÜšY\ÊØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ü›Ú™XÝØ]YÛÜžIËˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÜ™X]T›Ú™XÝØ]YÛÜžJ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ü›Ú™XÝØ]YÛÜžIËˆY]Ùˆ	ÔÔÕ	Ëˆ]NˆÂˆ\ØÜš\[ÛŽˆ\˜[Y]\œË™\ØÜš\[Û‹ˆYˆ\˜[Y]\œËšYˆ˜[YNˆ\˜[Y]\œË›˜[YKˆÙ[Žˆ\˜[Y]\œËœÙ[‹ˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]›Ú™XÝØ]YÛÜžPžRY
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝYH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËšYÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ü›Ú™XÝØ]YÛÜžKÉÚYXˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È\]T›Ú™XÝØ]YÛÜžJ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ü›Ú™XÝØ]YÛÜžKÉÜ\˜[Y]\œËšYXˆY]Ùˆ	ÔU	Ëˆ]NˆÂˆ˜[YNˆ\˜[Y]\œË›˜[YKˆ\ØÜš\[ÛŽˆ\˜[Y]\œË™\ØÜš\[Û‹ˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È™[[Ý™T›Ú™XÝØ]YÛÜžJ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝYH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËšYÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ü›Ú™XÝØ]YÛÜžKÉÚYXˆY]Ùˆ	ÑSUIËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBŸB‚˜Û\ÜÈ›Ú™XÝÛ\ÜÚYšXØ][Û“]™[ÈÂˆÛY[ÂˆÛÛœÝXÝÜŠÛY[
HÂˆ\Ë˜ÛY[HÛY[ÂˆBˆ\Þ[˜ÈÙ]Y˜][›Ú™XÝÛ\ÜÚYšXØ][ÛŠ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ü›Ú™XÝÉÜ\˜[Y]\œËœ›Ú™XÝYÜ’Ù^_KØÛ\ÜÚYšXØ][Û‹[]™[ÙY˜][ˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È\]QY˜][›Ú™XÝÛ\ÜÚYšXØ][ÛŠ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ü›Ú™XÝÉÜ\˜[Y]\œËœ›Ú™XÝYÜ’Ù^_KØÛ\ÜÚYšXØ][Û‹[]™[ÙY˜][ˆY]Ùˆ	ÔU	Ëˆ]NˆÂˆYˆ\˜[Y]\œËšYˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È™[[Ý™QY˜][›Ú™XÝÛ\ÜÚYšXØ][ÛŠ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ü›Ú™XÝÉÜ\˜[Y]\œËœ›Ú™XÝYÜ’Ù^_KØÛ\ÜÚYšXØ][Û‹[]™[ÙY˜][ˆY]Ùˆ	ÑSUIËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBŸB‚˜Û\ÜÈ›Ú™XÝÛÛ\Û™[ÈÂˆÛY[ÂˆÛÛœÝXÝÜŠÛY[
HÂˆ\Ë˜ÛY[HÛY[ÂˆBˆ\Þ[˜Èš[™ÛÛ\Û™[Ñ›Ü”›Ú™XÝÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹ØÛÛ\Û™[	ËˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆ›Ú™XÝYÓÜ’Ù^\Îˆ\˜[Y]\œÏËœ›Ú™XÝYÓÜ’Ù^\ËˆÝ\]ˆ\˜[Y]\œÏËœÝ\]ˆX^™\Ý[Îˆ\˜[Y]\œÏË›X^™\Ý[ËˆÜ™\žNˆ\˜[Y]\œÏË›Ü™\žKˆ]Y\žNˆ\˜[Y]\œÏËœ]Y\žKˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÜ™X]PÛÛ\Û™[
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹ØÛÛ\Û™[	ËˆY]Ùˆ	ÔÔÕ	Ëˆ]NˆÂˆ\šNˆ\˜[Y]\œË˜\šKˆ\ÜÚYÛ™YNˆ\˜[Y]\œË˜\ÜÚYÛ™YKˆ\ÜÚYÛ™YU\Nˆ\˜[Y]\œË˜\ÜÚYÛ™YU\Kˆ\ØÜš\[ÛŽˆ\˜[Y]\œË™\ØÜš\[Û‹ˆYˆ\˜[Y]\œËšYˆ\Ð\ÜÚYÛ™YU\U˜[Yˆ\˜[Y]\œËš\Ð\ÜÚYÛ™YU\U˜[YˆXYˆ\˜[Y]\œË›XYˆXYXØÛÝ[Yˆ\˜[Y]\œË›XYXØÛÝ[YˆXY\Ù\“˜[YNˆ\˜[Y]\œË›XY\Ù\“˜[YKˆY]Y]Nˆ\˜[Y]\œË›Y]Y]Kˆ˜[YNˆ\˜[Y]\œË›˜[YKˆ›Ú™XÝˆ\˜[Y]\œËœ›Ú™XÝˆ›Ú™XÝYˆ\˜[Y]\œËœ›Ú™XÝYˆ™X[\ÜÚYÛ™YNˆ\˜[Y]\œËœ™X[\ÜÚYÛ™YKˆ™X[\ÜÚYÛ™YU\Nˆ\˜[Y]\œËœ™X[\ÜÚYÛ™YU\KˆÙ[Žˆ\˜[Y]\œËœÙ[‹ˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]ÛÛ\Û™[
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝYH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËšYÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ØÛÛ\Û™[ÉÚYXˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È\]PÛÛ\Û™[
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ØÛÛ\Û™[ÉÜ\˜[Y]\œËšYXˆY]Ùˆ	ÔU	Ëˆ]NˆÂˆ˜[YNˆ\˜[Y]\œË›˜[YKˆ\ØÜš\[ÛŽˆ\˜[Y]\œË™\ØÜš\[Û‹ˆXY\Ù\“˜[YNˆ\˜[Y]\œË›XY\Ù\“˜[YKˆXYXØÛÝ[Yˆ\˜[Y]\œË›XYXØÛÝ[Yˆ\ÜÚYÛ™YU\Nˆ\˜[Y]\œË˜\ÜÚYÛ™YU\Kˆ›Ú™XÝˆ\˜[Y]\œËœ›Ú™XÝˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È[]PÛÛ\Û™[
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝYH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËšYÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ØÛÛ\Û™[ÉÚYXˆY]Ùˆ	ÑSUIËˆ\˜[\ÎˆÂˆ[Ý™R\ÜÝY\ÕÎˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œË›[Ý™R\ÜÝY\ÕÈˆ[™Yš[™YˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]ÛÛ\Û™[™[]Y\ÜÝY\Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝYH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËšYÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ØÛÛ\Û™[ÉÚYKÜ™[]Y\ÜÝYPÛÝ[ØˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]›Ú™XÝÛÛ\Û™[ÔYÚ[˜]Y
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ü›Ú™XÝÉÜ\˜[Y]\œËœ›Ú™XÝYÜ’Ù^_KØÛÛ\Û™[ˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆÝ\]ˆ\˜[Y]\œËœÝ\]ˆX^™\Ý[Îˆ\˜[Y]\œË›X^™\Ý[ËˆÜ™\žNˆ\˜[Y]\œË›Ü™\žKˆÛÛ\Û™[ÛÝ\˜ÙNˆ\˜[Y]\œË˜ÛÛ\Û™[ÛÝ\˜ÙKˆ]Y\žNˆ\˜[Y]\œËœ]Y\žKˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]›Ú™XÝÛÛ\Û™[Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝ›Ú™XÝYÜ’Ù^HH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËœ›Ú™XÝYÜ’Ù^NÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ü›Ú™XÝÉÜ›Ú™XÝYÜ’Ù^_KØÛÛ\Û™[ØˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆÛÛ\Û™[ÛÝ\˜ÙNˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œË˜ÛÛ\Û™[ÛÝ\˜ÙHˆ[™Yš[™YˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBŸB‚˜Û\ÜÈ›Ú™XÝ[XZ[ÂˆÛY[ÂˆÛÛœÝXÝÜŠÛY[
HÂˆ\Ë˜ÛY[HÛY[ÂˆBˆ\Þ[˜ÈÙ]›Ú™XÝ[XZ[
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝ›Ú™XÝYH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËœ›Ú™XÝYÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ü›Ú™XÝÉÜ›Ú™XÝYKÙ[XZ[ˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È\]T›Ú™XÝ[XZ[
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ü›Ú™XÝÉÜ\˜[Y]\œËœ›Ú™XÝYKÙ[XZ[ˆY]Ùˆ	ÔU	Ëˆ]NˆÂˆ[XZ[Y™\ÜÎˆ\˜[Y]\œË™[XZ[Y™\ÜËˆ[XZ[Y™\ÜÔÝ]\Îˆ\˜[Y]\œË™[XZ[Y™\ÜÔÝ]\ËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBŸB‚˜Û\ÜÈ›Ú™XÝ™X]\™\ÈÂˆÛY[ÂˆÛÛœÝXÝÜŠÛY[
HÂˆ\Ë˜ÛY[HÛY[ÂˆBˆ\Þ[˜ÈÙ]™X]\™\Ñ›Ü”›Ú™XÝ
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝ›Ú™XÝYÜ’Ù^HH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËœ›Ú™XÝYÜ’Ù^NÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ü›Ú™XÝÉÜ›Ú™XÝYÜ’Ù^_KÙ™X]\™\ØˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙÙÛQ™X]\™Q›Ü”›Ú™XÝ
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ü›Ú™XÝÉÜ\˜[Y]\œËœ›Ú™XÝYÜ’Ù^_KÙ™X]\™\ËÉÜ\˜[Y]\œË™™X]\™RÙ^_XˆY]Ùˆ	ÔU	Ëˆ]NˆÂˆÝ]Nˆ\˜[Y]\œËœÝ]KˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBŸB‚˜Û\ÜÈ›Ú™XÝÙ^P[™˜[YU˜[Y][ÛˆÂˆÛY[ÂˆÛÛœÝXÝÜŠÛY[
HÂˆ\Ë˜ÛY[HÛY[ÂˆBˆ\Þ[˜È˜[Y]T›Ú™XÝÙ^J\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÙ^HH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œÏËšÙ^NÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ü›Ú™XÝ˜[Y]KÚÙ^IËˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆÙ^KˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]˜[Y›Ú™XÝÙ^J\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÙ^HH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œÏËšÙ^NÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ü›Ú™XÝ˜[Y]KÝ˜[Y›Ú™XÝÙ^IËˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆÙ^KˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]˜[Y›Ú™XÝ˜[YJ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝ˜[YHH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œË›˜[YNÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ü›Ú™XÝ˜[Y]KÝ˜[Y›Ú™XÝ˜[YIËˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆ˜[YKˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBŸB‚˜Û\ÜÈ›Ú™XÝ\›Z\ÜÚ[Û”ØÚ[Y\ÈÂˆÛY[ÂˆÛÛœÝXÝÜŠÛY[
HÂˆ\Ë˜ÛY[HÛY[ÂˆBˆ\Þ[˜ÈÙ]›Ú™XÝ\ÜÝYTÙXÝ\š]TØÚ[YJ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝ›Ú™XÝÙ^SÜ’YH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËœ›Ú™XÝÙ^SÜ’YÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ü›Ú™XÝÉÜ›Ú™XÝÙ^SÜ’YKÚ\ÜÝY\ÙXÝ\š][]™[ØÚ[YXˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]\ÜÚYÛ™Y\›Z\ÜÚ[Û”ØÚ[YJ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝ›Ú™XÝÙ^SÜ’YH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËœ›Ú™XÝÙ^SÜ’YÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ü›Ú™XÝÉÜ›Ú™XÝÙ^SÜ’YKÜ\›Z\ÜÚ[ÛœØÚ[YXˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆ^[™ˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈ	‰ˆ\˜[Y]\œË™^[™ˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È\ÜÚYÛ”\›Z\ÜÚ[Û”ØÚ[YJ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ü›Ú™XÝÉÜ\˜[Y]\œËœ›Ú™XÝÙ^SÜ’YKÜ\›Z\ÜÚ[ÛœØÚ[YXˆY]Ùˆ	ÔU	Ëˆ\˜[\ÎˆÂˆ^[™ˆ\˜[Y]\œË™^[™ˆKˆ]NˆÂˆYˆ\˜[Y]\œËšYˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]ÙXÝ\š]S]™[Ñ›Ü”›Ú™XÝ
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝ›Ú™XÝÙ^SÜ’YH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËœ›Ú™XÝÙ^SÜ’YÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ü›Ú™XÝÉÜ›Ú™XÝÙ^SÜ’YKÜÙXÝ\š][]™[ˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBŸB‚˜Û\ÜÈ›Ú™XÝ›Ü\Y\ÈÂˆÛY[ÂˆÛÛœÝXÝÜŠÛY[
HÂˆ\Ë˜ÛY[HÛY[ÂˆBˆ\Þ[˜ÈÙ]›Ú™XÝ›Ü\RÙ^\Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝ›Ú™XÝYÜ’Ù^HH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËœ›Ú™XÝYÜ’Ù^NÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ü›Ú™XÝÉÜ›Ú™XÝYÜ’Ù^_KÜ›Ü\Y\ØˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]›Ú™XÝ›Ü\J\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ü›Ú™XÝÉÜ\˜[Y]\œËœ›Ú™XÝYÜ’Ù^_KÜ›Ü\Y\ËÉÜ\˜[Y]\œËœ›Ü\RÙ^_XˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]›Ú™XÝ›Ü\J\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ü›Ú™XÝÉÜ\˜[Y]\œËœ›Ú™XÝYÜ’Ù^_KÜ›Ü\Y\ËÉÜ\˜[Y]\œËœ›Ü\RÙ^_XˆY]Ùˆ	ÔU	Ëˆ]Nˆ\˜[Y]\œËœ›Ü\U˜[YKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È[]T›Ú™XÝ›Ü\J\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ü›Ú™XÝÉÜ\˜[Y]\œËœ›Ú™XÝYÜ’Ù^_KÜ›Ü\Y\ËÉÜ\˜[Y]\œËœ›Ü\RÙ^_XˆY]Ùˆ	ÑSUIËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBŸB‚˜Û\ÜÈ›Ú™XÝ›ÛPXÝÜœÈÂˆÛY[ÂˆÛÛœÝXÝÜŠÛY[
HÂˆ\Ë˜ÛY[HÛY[ÂˆBˆ\Þ[˜ÈYXÝÜ•\Ù\œÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ü›Ú™XÝÉÜ\˜[Y]\œËœ›Ú™XÝYÜ’Ù^_KÜ›ÛKÉÜ\˜[Y]\œËšYXˆY]Ùˆ	ÔÔÕ	Ëˆ]NˆÂˆ\Ù\Žˆ\˜[Y]\œË\Ù\‹ˆÜ›Ý\ˆ\˜[Y]\œË™Ü›Ý\ˆÜ›Ý\Yˆ\˜[Y]\œË™Ü›Ý\YˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]XÝÜœÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ü›Ú™XÝÉÜ\˜[Y]\œËœ›Ú™XÝYÜ’Ù^_KÜ›ÛKÉÜ\˜[Y]\œËšYXˆY]Ùˆ	ÔU	Ëˆ]NˆÂˆØ]YÛÜš\ÙYXÝÜœÎˆ\˜[Y]\œË˜Ø]YÛÜš\ÙYXÝÜœËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È[]PXÝÜŠ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ü›Ú™XÝÉÜ\˜[Y]\œËœ›Ú™XÝYÜ’Ù^_KÜ›ÛKÉÜ\˜[Y]\œËšYXˆY]Ùˆ	ÑSUIËˆ\˜[\ÎˆÂˆ\Ù\Žˆ\˜[Y]\œË\Ù\‹ˆÜ›Ý\ˆ\˜[Y]\œË™Ü›Ý\ˆÜ›Ý\Yˆ\˜[Y]\œË™Ü›Ý\YˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]›Ú™XÝ›ÛPXÝÜœÑ›Ü”›ÛJ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝYH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËšYÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ü›ÛKÉÚYKØXÝÜœØˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈY›Ú™XÝ›ÛPXÝÜœÕÔ›ÛJ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ü›ÛKÉÜ\˜[Y]\œËšYKØXÝÜœØˆY]Ùˆ	ÔÔÕ	Ëˆ]NˆÂˆ\Ù\Žˆ\˜[Y]\œË\Ù\‹ˆÜ›Ý\Yˆ\˜[Y]\œË™Ü›Ý\YˆÜ›Ý\ˆ\˜[Y]\œË™Ü›Ý\ˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È[]T›Ú™XÝ›ÛPXÝÜœÑœ›ÛT›ÛJ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ü›ÛKÉÜ\˜[Y]\œËšYKØXÝÜœØˆY]Ùˆ	ÑSUIËˆ\˜[\ÎˆÂˆ\Ù\Žˆ\˜[Y]\œË\Ù\‹ˆÜ›Ý\Yˆ\˜[Y]\œË™Ü›Ý\YˆÜ›Ý\ˆ\˜[Y]\œË™Ü›Ý\ˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBŸB‚˜Û\ÜÈ›Ú™XÝ›Û\ÈÂˆÛY[ÂˆÛÛœÝXÝÜŠÛY[
HÂˆ\Ë˜ÛY[HÛY[ÂˆBˆ\Þ[˜ÈÙ]›Ú™XÝ›Û\Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝ›Ú™XÝYÜ’Ù^HH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËœ›Ú™XÝYÜ’Ù^NÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ü›Ú™XÝÉÜ›Ú™XÝYÜ’Ù^_KÜ›ÛXˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]›Ú™XÝ›ÛJ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ü›Ú™XÝÉÜ\˜[Y]\œËœ›Ú™XÝYÜ’Ù^_KÜ›ÛKÉÜ\˜[Y]\œËšYXˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆ^ÛYR[˜XÝ]™U\Ù\œÎˆ\˜[Y]\œË™^ÛYR[˜XÝ]™U\Ù\œËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]›Ú™XÝ›ÛQ]Z[Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝ›Ú™XÝYÜ’Ù^HH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËœ›Ú™XÝYÜ’Ù^NÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ü›Ú™XÝÉÜ›Ú™XÝYÜ’Ù^_KÜ›ÛY]Z[ØˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆÝ\œ™[Y[X™\Žˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œË˜Ý\œ™[Y[X™\ˆˆ[™Yš[™Yˆ^ÛYPÛÛ›™XÝYÛœÎˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œË™^ÛYPÛÛ›™XÝYÛœÈˆ[™Yš[™YˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ][›Ú™XÝ›Û\ÊØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ü›ÛIËˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÜ™X]T›Ú™XÝ›ÛJ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ü›ÛIËˆY]Ùˆ	ÔÔÕ	Ëˆ]NˆÂˆ\ØÜš\[ÛŽˆ\˜[Y]\œË™\ØÜš\[Û‹ˆ˜[YNˆ\˜[Y]\œË›˜[YKˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]›Ú™XÝ›ÛPžRY
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝYH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËšYÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ü›ÛKÉÚYXˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È\X[\]T›Ú™XÝ›ÛJ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ü›ÛKÉÜ\˜[Y]\œËšYXˆY]Ùˆ	ÔÔÕ	Ëˆ]NˆÂˆ\ØÜš\[ÛŽˆ\˜[Y]\œË™\ØÜš\[Û‹ˆ˜[YNˆ\˜[Y]\œË›˜[YKˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È[U\]T›Ú™XÝ›ÛJ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ü›ÛKÉÜ\˜[Y]\œËšYXˆY]Ùˆ	ÔU	Ëˆ]NˆÂˆ\ØÜš\[ÛŽˆ\˜[Y]\œË™\ØÜš\[Û‹ˆ˜[YNˆ\˜[Y]\œË›˜[YKˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È[]T›Ú™XÝ›ÛJ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝYH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËšYÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ü›ÛKÉÚYXˆY]Ùˆ	ÑSUIËˆ\˜[\ÎˆÂˆÝØ\ˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œËœÝØ\ˆ[™Yš[™YˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBŸB‚˜Û\ÜÈ›Ú™XÝÈÂˆÛY[ÂˆÛÛœÝXÝÜŠÛY[
HÂˆ\Ë˜ÛY[HÛY[ÂˆBˆ\Þ[˜ÈÜ™X]T›Ú™XÝ
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ü›Ú™XÝ	ËˆY]Ùˆ	ÔÔÕ	Ëˆ]NˆÂˆ\ÜÚYÛ™YU\Nˆ\˜[Y]\œË˜\ÜÚYÛ™YU\Kˆ]˜]\’Yˆ\˜[Y]\œË˜]˜]\’YˆØ]YÛÜžRYˆ\˜[Y]\œË˜Ø]YÛÜžRYˆ\ØÜš\[ÛŽˆ\˜[Y]\œË™\ØÜš\[Û‹ˆšY[ÛÛ™šYÝ\˜][Û”ØÚ[YNˆ\˜[Y]\œË™šY[ÛÛ™šYÝ\˜][Û”ØÚ[YKˆ\ÜÝYTÙXÝ\š]TØÚ[YNˆ\˜[Y]\œËš\ÜÝYTÙXÝ\š]TØÚ[YKˆ\ÜÝYU\TØÚ[YNˆ\˜[Y]\œËš\ÜÝYU\TØÚ[YKˆ\ÜÝYU\TØÜ™Y[”ØÚ[YNˆ\˜[Y]\œËš\ÜÝYU\TØÜ™Y[”ØÚ[YKˆÙ^Nˆ\˜[Y]\œËšÙ^KˆXYXØÛÝ[Yˆ\˜[Y]\œË›XYXØÛÝ[Yˆ˜[YNˆ\˜[Y]\œË›˜[YKˆ›ÝYšXØ][Û”ØÚ[YNˆ\˜[Y]\œË››ÝYšXØ][Û”ØÚ[YKˆ\›Z\ÜÚ[Û”ØÚ[YNˆ\˜[Y]\œËœ\›Z\ÜÚ[Û”ØÚ[YKˆ›Ú™XÝ[\]RÙ^Nˆ\˜[Y]\œËœ›Ú™XÝ[\]RÙ^Kˆ›Ú™XÝ\RÙ^Nˆ\˜[Y]\œËœ›Ú™XÝ\RÙ^Kˆ\›ˆ\˜[Y]\œË\›ˆÛÜšÙ›ÝÔØÚ[YNˆ\˜[Y]\œËÛÜšÙ›ÝÔØÚ[YKˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]™XÙ[
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ü›Ú™XÝÜ™XÙ[	ËˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆ^[™ˆ\˜[Y]\œÏË™^[™ˆ›Ü\Y\Îˆ\˜[Y]\œÏËœ›Ü\Y\ËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙX\˜Ú›Ú™XÝÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ü›Ú™XÝÜÙX\˜Ú	ËˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆÝ\]ˆ\˜[Y]\œÏËœÝ\]ˆX^™\Ý[Îˆ\˜[Y]\œÏË›X^™\Ý[ËˆÜ™\žNˆ\˜[Y]\œÏË›Ü™\žKˆYˆ\˜[Y]\œÏËšYˆÙ^\Îˆ\˜[Y]\œÏËšÙ^\Ëˆ]Y\žNˆ\˜[Y]\œÏËœ]Y\žKˆ\RÙ^Nˆ\˜[Y]\œÏË\RÙ^KˆØ]YÛÜžRYˆ\˜[Y]\œÏË˜Ø]YÛÜžRYˆXÝ[ÛŽˆ\˜[Y]\œÏË˜XÝ[Û‹ˆ^[™ˆ\˜[Y]\œÏË™^[™ˆÝ]\Îˆ\˜[Y]\œÏËœÝ]\Ëˆ›Ü\Y\Îˆ\˜[Y]\œÏËœ›Ü\Y\Ëˆ›Ü\T]Y\žNˆ\˜[Y]\œÏËœ›Ü\T]Y\žKˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]›Ú™XÝ
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝ›Ú™XÝYÜ’Ù^HH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËœ›Ú™XÝYÜ’Ù^NÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ü›Ú™XÝÉÜ›Ú™XÝYÜ’Ù^_XˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆ^[™ˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œË™^[™ˆ[™Yš[™Yˆ›Ü\Y\Îˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œËœ›Ü\Y\Èˆ[™Yš[™YˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È\]T›Ú™XÝ
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ü›Ú™XÝÉÜ\˜[Y]\œËœ›Ú™XÝYÜ’Ù^_XˆY]Ùˆ	ÔU	Ëˆ\˜[\ÎˆÂˆ^[™ˆ\˜[Y]\œË™^[™ˆKˆ]NˆÂˆ\ÜÚYÛ™YU\Nˆ\˜[Y]\œË˜\ÜÚYÛ™YU\Kˆ]˜]\’Yˆ\˜[Y]\œË˜]˜]\’YˆØ]YÛÜžRYˆ\˜[Y]\œË˜Ø]YÛÜžRYˆ\ØÜš\[ÛŽˆ\˜[Y]\œË™\ØÜš\[Û‹ˆ\ÜÝYTÙXÝ\š]TØÚ[YNˆ\˜[Y]\œËš\ÜÝYTÙXÝ\š]TØÚ[YKˆÙ^Nˆ\˜[Y]\œËšÙ^KˆXYXØÛÝ[Yˆ\˜[Y]\œË›XYXØÛÝ[Yˆ˜[YNˆ\˜[Y]\œË›˜[YKˆ›ÝYšXØ][Û”ØÚ[YNˆ\˜[Y]\œË››ÝYšXØ][Û”ØÚ[YKˆ\›Z\ÜÚ[Û”ØÚ[YNˆ\˜[Y]\œËœ\›Z\ÜÚ[Û”ØÚ[YKˆ›Ú™XÝ[\]RÙ^Nˆ\˜[Y]\œËœ›Ú™XÝ[\]RÙ^Kˆ›Ú™XÝ\RÙ^Nˆ\˜[Y]\œËœ›Ú™XÝ\RÙ^Kˆ™[X\ÙY›Ú™XÝÙ^\Îˆ\˜[Y]\œËœ™[X\ÙY›Ú™XÝÙ^\Ëˆ\›ˆ\˜[Y]\œË\›ˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È[]T›Ú™XÝ
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝ›Ú™XÝYÜ’Ù^HH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËœ›Ú™XÝYÜ’Ù^NÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ü›Ú™XÝÉÜ›Ú™XÝYÜ’Ù^_XˆY]Ùˆ	ÑSUIËˆ\˜[\ÎˆÂˆ[˜X›U[™Îˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œË™[˜X›U[™Èˆ[™Yš[™YˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È\˜Ú]™T›Ú™XÝ
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝ›Ú™XÝYÜ’Ù^HH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËœ›Ú™XÝYÜ’Ù^NÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ü›Ú™XÝÉÜ›Ú™XÝYÜ’Ù^_KØ\˜Ú]™XˆY]Ùˆ	ÔÔÕ	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È[]T›Ú™XÝ\Þ[˜Ú›Û›Ý\ÛJ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝ›Ú™XÝYÜ’Ù^HH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËœ›Ú™XÝYÜ’Ù^NÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ü›Ú™XÝÉÜ›Ú™XÝYÜ’Ù^_KÙ[]XˆY]Ùˆ	ÔÔÕ	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È™\ÝÜ™J\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝ›Ú™XÝYÜ’Ù^HH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËœ›Ú™XÝYÜ’Ù^NÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ü›Ú™XÝÉÜ›Ú™XÝYÜ’Ù^_KÜ™\ÝÜ™XˆY]Ùˆ	ÔÔÕ	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ][Ý]\Ù\Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝ›Ú™XÝYÜ’Ù^HH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËœ›Ú™XÝYÜ’Ù^NÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ü›Ú™XÝÉÜ›Ú™XÝYÜ’Ù^_KÜÝ]\Ù\ØˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]Y\˜\˜ÚJ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝ›Ú™XÝYH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËœ›Ú™XÝYÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ü›Ú™XÝÉÜ›Ú™XÝYKÚY\˜\˜ÚXˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]›ÝYšXØ][Û”ØÚ[YQ›Ü”›Ú™XÝ
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝ›Ú™XÝÙ^SÜ’YH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËœ›Ú™XÝÙ^SÜ’YÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ü›Ú™XÝÉÜ›Ú™XÝÙ^SÜ’YKÛ›ÝYšXØ][ÛœØÚ[YXˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆ^[™ˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œË™^[™ˆ[™Yš[™YˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBŸB‚˜Û\ÜÈ›Ú™XÝ[\]\ÈÂˆÛY[ÂˆÛÛœÝXÝÜŠÛY[
HÂˆ\Ë˜ÛY[HÛY[ÂˆBˆ\Þ[˜ÈÜ™X]T›Ú™XÝÚ]Ý\ÝÛU[\]J\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ü›Ú™XÝ][\]IËˆY]Ùˆ	ÔÔÕ	Ëˆ]NˆÂˆ]Z[Îˆ\˜[Y]\œÏË™]Z[Ëˆ[\]Nˆ\˜[Y]\œÏË[\]KˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈY][\]J\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ü›Ú™XÝ][\]KÙY]][\]IËˆY]Ùˆ	ÔU	Ëˆ]NˆÂˆ[\]Q\ØÜš\[ÛŽˆ\˜[Y]\œË[\]Q\ØÜš\[Û‹ˆ[\]QÙ[™\˜][Û“Ü[ÛœÎˆ\˜[Y]\œË[\]QÙ[™\˜][Û“Ü[ÛœËˆ[\]RÙ^Nˆ\˜[Y]\œË[\]RÙ^Kˆ[\]S˜[YNˆ\˜[Y]\œË[\]S˜[YKˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È]™U[\]J\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ü›Ú™XÝ][\]KÛ]™K][\]IËˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆ›Ú™XÝYˆ\˜[Y]\œËœ›Ú™XÝYˆ[\]RÙ^Nˆ\˜[Y]\œË[\]RÙ^KˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È™[[Ý™U[\]J\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ü›Ú™XÝ][\]KÜ™[[Ý™K][\]IËˆY]Ùˆ	ÑSUIËˆ\˜[\ÎˆÂˆ[\]RÙ^Nˆ\˜[Y]\œË[\]RÙ^KˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈØ]™U[\]J\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ü›Ú™XÝ][\]KÜØ]™K][\]IËˆY]Ùˆ	ÔÔÕ	Ëˆ]NˆÂˆ[\]Q\ØÜš\[ÛŽˆ\˜[Y]\œË[\]Q\ØÜš\[Û‹ˆ[\]Qœ›ÛT›Ú™XÝ™\]Y\Ýˆ\˜[Y]\œË[\]Qœ›ÛT›Ú™XÝ™\]Y\Ýˆ[\]S˜[YNˆ\˜[Y]\œË[\]S˜[YKˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBŸB‚˜Û\ÜÈ›Ú™XÝ\\ÈÂˆÛY[ÂˆÛÛœÝXÝÜŠÛY[
HÂˆ\Ë˜ÛY[HÛY[ÂˆBˆ\Þ[˜ÈÙ][›Ú™XÝ\\ÊØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ü›Ú™XÝÝ\IËˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ][XØÙ\ÜÚX›T›Ú™XÝ\\ÊØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ü›Ú™XÝÝ\KØXØÙ\ÜÚX›IËˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]›Ú™XÝ\PžRÙ^J\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝ›Ú™XÝ\RÙ^HH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËœ›Ú™XÝ\RÙ^NÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ü›Ú™XÝÝ\KÉÜ›Ú™XÝ\RÙ^_XˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]XØÙ\ÜÚX›T›Ú™XÝ\PžRÙ^J\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝ›Ú™XÝ\RÙ^HH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËœ›Ú™XÝ\RÙ^NÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ü›Ú™XÝÝ\KÉÜ›Ú™XÝ\RÙ^_KØXØÙ\ÜÚX›XˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBŸB‚˜Û\ÜÈ›Ú™XÝ™\œÚ[ÛœÈÂˆÛY[ÂˆÛÛœÝXÝÜŠÛY[
HÂˆ\Ë˜ÛY[HÛY[ÂˆBˆ\Þ[˜ÈÙ]›Ú™XÝ™\œÚ[ÛœÔYÚ[˜]Y
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝ›Ú™XÝYÜ’Ù^HH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËœ›Ú™XÝYÜ’Ù^NÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ü›Ú™XÝÉÜ›Ú™XÝYÜ’Ù^_KÝ™\œÚ[Û˜ˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆÝ\]ˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œËœÝ\]ˆ[™Yš[™YˆX^™\Ý[Îˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œË›X^™\Ý[Èˆ[™Yš[™YˆÜ™\žNˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œË›Ü™\žHˆ[™Yš[™Yˆ]Y\žNˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œËœ]Y\žHˆ[™Yš[™YˆÝ]\Îˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œËœÝ]\Èˆ[™Yš[™Yˆ^[™ˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œË™^[™ˆ[™Yš[™YˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]›Ú™XÝ™\œÚ[ÛœÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝ›Ú™XÝYÜ’Ù^HH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËœ›Ú™XÝYÜ’Ù^NÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ü›Ú™XÝÉÜ›Ú™XÝYÜ’Ù^_KÝ™\œÚ[ÛœØˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆ^[™ˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œË™^[™ˆ[™Yš[™YˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÜ™X]U™\œÚ[ÛŠ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ý™\œÚ[Û‰ËˆY]Ùˆ	ÔÔÕ	Ëˆ]NˆÂˆ\›Ý™\œÎˆ\˜[Y]\œË˜\›Ý™\œËˆ\˜Ú]™Yˆ\˜[Y]\œË˜\˜Ú]™Yˆ\ØÜš\[ÛŽˆ\˜[Y]\œË™\ØÜš\[Û‹ˆš]™\Žˆ\˜[Y]\œË™š]™\‹ˆ^[™ˆ\˜[Y]\œË™^[™ˆYˆ\˜[Y]\œËšYˆ\ÜÝY\ÔÝ]\Ñ›Ü‘š^™\œÚ[ÛŽˆ\˜[Y]\œËš\ÜÝY\ÔÝ]\Ñ›Ü‘š^™\œÚ[Û‹ˆ[Ý™U[™š^Y\ÜÝY\ÕÎˆ\˜[Y]\œË›[Ý™U[™š^Y\ÜÝY\ÕËˆ˜[YNˆ\˜[Y]\œË›˜[YKˆÜ\˜][ÛœÎˆ\˜[Y]\œË›Ü\˜][ÛœËˆÝ™\™YNˆ\˜[Y]\œË›Ý™\™YKˆ›Ú™XÝYˆ\˜[Y]\œËœ›Ú™XÝYˆ™[X\ÙQ]Nˆ\˜[Y]\œËœ™[X\ÙQ]Kˆ™[X\ÙYˆ\˜[Y]\œËœ™[X\ÙYˆÙ[Žˆ\˜[Y]\œËœÙ[‹ˆÝ\]Nˆ\˜[Y]\œËœÝ\]Kˆ\Ù\”™[X\ÙQ]Nˆ\˜[Y]\œË\Ù\”™[X\ÙQ]Kˆ\Ù\”Ý\]Nˆ\˜[Y]\œË\Ù\”Ý\]KˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]™\œÚ[ÛŠ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝYH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËšYÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ý™\œÚ[Û‹ÉÚYXˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆ^[™ˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œË™^[™ˆ[™Yš[™YˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È\]U™\œÚ[ÛŠ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ý™\œÚ[Û‹ÉÜ\˜[Y]\œËšYXˆY]Ùˆ	ÔU	Ëˆ]NˆÂˆ\›Ý™\œÎˆ\˜[Y]\œË˜\›Ý™\œËˆš]™\Žˆ\˜[Y]\œË™š]™\‹ˆ^[™ˆ\˜[Y]\œË™^[™ˆ\ØÜš\[ÛŽˆ\˜[Y]\œË™\ØÜš\[Û‹ˆ˜[YNˆ\˜[Y]\œË›˜[YKˆ\˜Ú]™Yˆ\˜[Y]\œË˜\˜Ú]™Yˆ™[X\ÙYˆ\˜[Y]\œËœ™[X\ÙYˆÝ\]Nˆ\˜[Y]\œËœÝ\]Kˆ™[X\ÙQ]Nˆ\˜[Y]\œËœ™[X\ÙQ]Kˆ›Ú™XÝYˆ\˜[Y]\œËœ›Ú™XÝYˆ[Ý™U[™š^Y\ÜÝY\ÕÎˆ\˜[Y]\œË›[Ý™U[™š^Y\ÜÝY\ÕËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈY\™ÙU™\œÚ[ÛœÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ý™\œÚ[Û‹ÉÜ\˜[Y]\œËšYKÛY\™Ù]ËÉÜ\˜[Y]\œË›[Ý™R\ÜÝY\ÕßXˆY]Ùˆ	ÔU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È[Ý™U™\œÚ[ÛŠ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ý™\œÚ[Û‹ÉÜ\˜[Y]\œËšYKÛ[Ý™XˆY]Ùˆ	ÔÔÕ	Ëˆ]NˆÂˆY\Žˆ\˜[Y]\œË˜Y\‹ˆÜÚ][ÛŽˆ\˜[Y]\œËœÜÚ][Û‹ˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]™\œÚ[Û”™[]Y\ÜÝY\Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝYH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËšYÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ý™\œÚ[Û‹ÉÚYKÜ™[]Y\ÜÝYPÛÝ[ØˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]™[]YÛÜšÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ý™\œÚ[Û‹ÉÜ\˜[Y]\œËšYKÜ™[]YÛÜšØˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÜ™X]T™[]YÛÜšÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ý™\œÚ[Û‹ÉÜ\˜[Y]\œËšYKÜ™[]YÛÜšØˆY]Ùˆ	ÔÔÕ	Ëˆ]NˆÂˆØ]YÛÜžNˆ\˜[Y]\œË˜Ø]YÛÜžKˆ\ÜÝYRYˆ\˜[Y]\œËš\ÜÝYRYˆ™[]YÛÜšÒYˆ\˜[Y]\œËœ™[]YÛÜšÒYˆ]Nˆ\˜[Y]\œË]Kˆ\›ˆ\˜[Y]\œË\›ˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È\]T™[]YÛÜšÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ý™\œÚ[Û‹ÉÜ\˜[Y]\œËšYKÜ™[]YÛÜšØˆY]Ùˆ	ÔU	Ëˆ]NˆÂˆØ]YÛÜžNˆ\˜[Y]\œË˜Ø]YÛÜžKˆ\ÜÝYRYˆ\˜[Y]\œËš\ÜÝYRYˆ™[]YÛÜšÒYˆ\˜[Y]\œËœ™[]YÛÜšÒYˆ]Nˆ\˜[Y]\œË]Kˆ\›ˆ\˜[Y]\œË\›ˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È[]P[™™\XÙU™\œÚ[ÛŠ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ý™\œÚ[Û‹ÉÜ\˜[Y]\œËšYKÜ™[[Ý™P[™ÝØ\ˆY]Ùˆ	ÔÔÕ	Ëˆ]NˆÂˆÝ\ÝÛQšY[™\XÙ[Y[\Ýˆ\˜[Y]\œË˜Ý\ÝÛQšY[™\XÙ[Y[\Ýˆ[Ý™PY™™XÝY\ÜÝY\ÕÎˆ\˜[Y]\œË›[Ý™PY™™XÝY\ÜÝY\ÕËˆ[Ý™Qš^\ÜÝY\ÕÎˆ\˜[Y]\œË›[Ý™Qš^\ÜÝY\ÕËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]™\œÚ[Û•[œ™\ÛÛ™Y\ÜÝY\Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝYH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËšYÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ý™\œÚ[Û‹ÉÚYKÝ[œ™\ÛÛ™Y\ÜÝYPÛÝ[ˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È[]T™[]YÛÜšÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ý™\œÚ[Û‹ÉÜ\˜[Y]\œË™\œÚ[Û’YKÜ™[]YÛÜšËÉÜ\˜[Y]\œËœ™[]YÛÜšÒYXˆY]Ùˆ	ÑSUIËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBŸB‚˜Û\ÜÈØÜ™Y[œÈÂˆÛY[ÂˆÛÛœÝXÝÜŠÛY[
HÂˆ\Ë˜ÛY[HÛY[ÂˆBˆ\Þ[˜ÈÙ]ØÜ™Y[œÑ›Ü‘šY[
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝšY[YH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œË™šY[YÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ÙšY[ÉÙšY[YKÜØÜ™Y[œØˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆÝ\]ˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈ	‰ˆ\˜[Y]\œËœÝ\]ˆX^™\Ý[Îˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈ	‰ˆ\˜[Y]\œË›X^™\Ý[Ëˆ^[™ˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈ	‰ˆ\˜[Y]\œË™^[™ˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]ØÜ™Y[œÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹ÜØÜ™Y[œÉËˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆÝ\]ˆ\˜[Y]\œÏËœÝ\]ˆX^™\Ý[Îˆ\˜[Y]\œÏË›X^™\Ý[ËˆYˆ\˜[Y]\œÏËšYˆ]Y\žTÝš[™Îˆ\˜[Y]\œÏËœ]Y\žTÝš[™ËˆØÛÜNˆ\˜[Y]\œÏËœØÛÜKˆÜ™\žNˆ\˜[Y]\œÏË›Ü™\žKˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÜ™X]TØÜ™Y[Š\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹ÜØÜ™Y[œÉËˆY]Ùˆ	ÔÔÕ	Ëˆ]NˆÂˆ˜[YNˆ\˜[Y]\œË›˜[YKˆ\ØÜš\[ÛŽˆ\˜[Y]\œË™\ØÜš\[Û‹ˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈYšY[ÑY˜][ØÜ™Y[Š\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝšY[YH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œË™šY[YÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ÜØÜ™Y[œËØYÑY˜][ÉÙšY[YXˆY]Ùˆ	ÔÔÕ	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È\]TØÜ™Y[Š\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ÜØÜ™Y[œËÉÜ\˜[Y]\œËœØÜ™Y[’YXˆY]Ùˆ	ÔU	Ëˆ]NˆÂˆ˜[YNˆ\˜[Y]\œË›˜[YKˆ\ØÜš\[ÛŽˆ\˜[Y]\œË™\ØÜš\[Û‹ˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È[]TØÜ™Y[Š\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝØÜ™Y[’YH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËœØÜ™Y[’YÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ÜØÜ™Y[œËÉÜØÜ™Y[’YXˆY]Ùˆ	ÑSUIËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]]˜Z[X›TØÜ™Y[‘šY[Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝØÜ™Y[’YH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËœØÜ™Y[’YÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ÜØÜ™Y[œËÉÜØÜ™Y[’YKØ]˜Z[X›QšY[ØˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBŸB‚˜Û\ÜÈØÜ™Y[”ØÚ[Y\ÈÂˆÛY[ÂˆÛÛœÝXÝÜŠÛY[
HÂˆ\Ë˜ÛY[HÛY[ÂˆBˆ\Þ[˜ÈÙ]ØÜ™Y[”ØÚ[Y\Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹ÜØÜ™Y[œØÚ[YIËˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆÝ\]ˆ\˜[Y]\œÏËœÝ\]ˆX^™\Ý[Îˆ\˜[Y]\œÏË›X^™\Ý[ËˆYˆ\˜[Y]\œÏËšYˆ^[™ˆ\˜[Y]\œÏË™^[™ˆ]Y\žTÝš[™Îˆ\˜[Y]\œÏËœ]Y\žTÝš[™ËˆÜ™\žNˆ\˜[Y]\œÏË›Ü™\žKˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÜ™X]TØÜ™Y[”ØÚ[YJ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝ˜[YHH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œË›˜[YNÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹ÜØÜ™Y[œØÚ[YIËˆY]Ùˆ	ÔÔÕ	Ëˆ]NˆÂˆ˜[YKˆ\ØÜš\[ÛŽˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈ	‰ˆ\˜[Y]\œË™\ØÜš\[Û‹ˆØÜ™Y[œÎˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈ	‰ˆ\˜[Y]\œËœØÜ™Y[œËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È\]TØÜ™Y[”ØÚ[YJ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ÜØÜ™Y[œØÚ[YKÉÜ\˜[Y]\œËœØÜ™Y[”ØÚ[YRYXˆY]Ùˆ	ÔU	Ëˆ]NˆÂˆ˜[YNˆ\˜[Y]\œË›˜[YKˆ\ØÜš\[ÛŽˆ\˜[Y]\œË™\ØÜš\[Û‹ˆØÜ™Y[œÎˆ\˜[Y]\œËœØÜ™Y[œËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È[]TØÜ™Y[”ØÚ[YJ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝØÜ™Y[”ØÚ[YRYH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËœØÜ™Y[”ØÚ[YRYÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ÜØÜ™Y[œØÚ[YKÉÜØÜ™Y[”ØÚ[YRYXˆY]Ùˆ	ÑSUIËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBŸB‚˜Û\ÜÈØÜ™Y[•X‘šY[ÈÂˆÛY[ÂˆÛÛœÝXÝÜŠÛY[
HÂˆ\Ë˜ÛY[HÛY[ÂˆBˆ\Þ[˜ÈÙ][ØÜ™Y[•X‘šY[Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ÜØÜ™Y[œËÉÜ\˜[Y]\œËœØÜ™Y[’YKÝXœËÉÜ\˜[Y]\œËX’YKÙšY[ØˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆ›Ú™XÝÙ^Nˆ\˜[Y]\œËœ›Ú™XÝÙ^KˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈYØÜ™Y[•X‘šY[
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ÜØÜ™Y[œËÉÜ\˜[Y]\œËœØÜ™Y[’YKÝXœËÉÜ\˜[Y]\œËX’YKÙšY[ØˆY]Ùˆ	ÔÔÕ	Ëˆ]NˆÂˆšY[Yˆ\˜[Y]\œË™šY[YˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È™[[Ý™TØÜ™Y[•X‘šY[
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ÜØÜ™Y[œËÉÜ\˜[Y]\œËœØÜ™Y[’YKÝXœËÉÜ\˜[Y]\œËX’YKÙšY[ËÉÜ\˜[Y]\œËšYXˆY]Ùˆ	ÑSUIËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È[Ý™TØÜ™Y[•X‘šY[
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ÜØÜ™Y[œËÉÜ\˜[Y]\œËœØÜ™Y[’YKÝXœËÉÜ\˜[Y]\œËX’YKÙšY[ËÉÜ\˜[Y]\œËšYKÛ[Ý™XˆY]Ùˆ	ÔÔÕ	Ëˆ]NˆÂˆY\Žˆ\˜[Y]\œË˜Y\‹ˆÜÚ][ÛŽˆ\˜[Y]\œËœÜÚ][Û‹ˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBŸB‚˜Û\ÜÈØÜ™Y[•XœÈÂˆÛY[ÂˆÛÛœÝXÝÜŠÛY[
HÂˆ\Ë˜ÛY[HÛY[ÂˆBˆ\Þ[˜ÈÙ][ÔØÜ™Y[•XœÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹ÜØÜ™Y[œËÝXœÉËˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆØÜ™Y[’Yˆ\˜[Y]\œÏËœØÜ™Y[’YˆX’Yˆ\˜[Y]\œÏËX’YˆÝ\]ˆ\˜[Y]\œÏËœÝ\]ˆX^™\Ý[ˆ\˜[Y]\œÏË›X^™\Ý[ˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ][ØÜ™Y[•XœÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝØÜ™Y[’YH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËœØÜ™Y[’YÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ÜØÜ™Y[œËÉÜØÜ™Y[’YKÝXœØˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆ›Ú™XÝÙ^Nˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈ	‰ˆ\˜[Y]\œËœ›Ú™XÝÙ^KˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈYØÜ™Y[•XŠ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ÜØÜ™Y[œËÉÜ\˜[Y]\œËœØÜ™Y[’YKÝXœØˆY]Ùˆ	ÔÔÕ	Ëˆ]NˆÂˆYˆ\˜[Y]\œËšYˆ˜[YNˆ\˜[Y]\œË›˜[YKˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È™[˜[YTØÜ™Y[•XŠ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ÜØÜ™Y[œËÉÜ\˜[Y]\œËœØÜ™Y[’YKÝXœËÉÜ\˜[Y]\œËX’YXˆY]Ùˆ	ÔU	Ëˆ]NˆÂˆYˆ\˜[Y]\œËšYˆ˜[YNˆ\˜[Y]\œË›˜[YKˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È[]TØÜ™Y[•XŠ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ÜØÜ™Y[œËÉÜ\˜[Y]\œËœØÜ™Y[’YKÝXœËÉÜ\˜[Y]\œËX’YXˆY]Ùˆ	ÑSUIËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È[Ý™TØÜ™Y[•XŠ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ÜØÜ™Y[œËÉÜ\˜[Y]\œËœØÜ™Y[’YKÝXœËÉÜ\˜[Y]\œËX’YKÛ[Ý™KÉÜ\˜[Y]\œËœÜßXˆY]Ùˆ	ÔÔÕ	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBŸB‚˜Û\ÜÈÙ\™\’[™›ÈÂˆÛY[ÂˆÛÛœÝXÝÜŠÛY[
HÂˆ\Ë˜ÛY[HÛY[ÂˆBˆ\Þ[˜ÈÙ]Ù\™\’[™›ÊØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹ÜÙ\™\’[™›ÉËˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBŸB‚˜Û\ÜÈÙ\šXÙT™YÚ\ÝžHÂˆÛY[ÂˆÛÛœÝXÝÜŠÛY[
HÂˆ\Ë˜ÛY[HÛY[ÂˆBˆ\Þ[˜ÈÙ\šXÙ\Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ]\ÜÚX[‹XÛÛ›™XÝÌKÜÙ\šXÙK\™YÚ\ÝžIËˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆÙ\šXÙRYÎˆ\˜[Y]\œËœÙ\šXÙRYËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBŸB‚˜Û\ÜÈÝ]\ÈÂˆÛY[ÂˆÛÛœÝXÝÜŠÛY[
HÂˆ\Ë˜ÛY[HÛY[ÂˆBˆ\Þ[˜ÈÙ]Ý]\Ù\ÐžRY
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝYH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËšYÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹ÜÝ]\Ù\ÉËˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆYˆ^[™ˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈ	‰ˆ\˜[Y]\œË™^[™ˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÜ™X]TÝ]\Ù\Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹ÜÝ]\Ù\ÉËˆY]Ùˆ	ÔÔÕ	Ëˆ]NˆÂˆÝ]\Ù\Îˆ\˜[Y]\œËœÝ]\Ù\ËˆØÛÜNˆ\˜[Y]\œËœØÛÜKˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È\]TÝ]\Ù\Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹ÜÝ]\Ù\ÉËˆY]Ùˆ	ÔU	Ëˆ]NˆÂˆÝ]\Ù\Îˆ\˜[Y]\œËœÝ]\Ù\ËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È[]TÝ]\Ù\ÐžRY
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝYH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËšYÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹ÜÝ]\Ù\ÉËˆY]Ùˆ	ÑSUIËˆ\˜[\ÎˆÂˆYˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]Ý]\Ù\ÐžS˜[YJ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹ÜÝ]\Ù\ËØžS˜[Y\ÉËˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆ˜[YNˆ\˜[TÙ\šX[^™\Š	Û˜[YIË\˜[Y]\œË›˜[YJKˆ›Ú™XÝYˆ\˜[Y]\œËœ›Ú™XÝYˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙX\˜Ú
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹ÜÝ]\Ù\ËÜÙX\˜Ú	ËˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆ^[™ˆ\˜[Y]\œÏË™^[™ˆ›Ú™XÝYˆ\˜[Y]\œÏËœ›Ú™XÝYˆÝ\]ˆ\˜[Y]\œÏËœÝ\]ˆX^™\Ý[Îˆ\˜[Y]\œÏË›X^™\Ý[ËˆÙX\˜ÚÝš[™Îˆ\˜[Y]\œÏËœÙX\˜ÚÝš[™ËˆÝ]\ÐØ]YÛÜžNˆ\˜[Y]\œÏËœÝ]\ÐØ]YÛÜžKˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]›Ú™XÝ\ÜÝYU\U\ØYÙ\Ñ›Ü”Ý]\Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ÜÝ]\Ù\ËÉÜ\˜[Y]\œËœÝ]\ÒYKÜ›Ú™XÝÉÜ\˜[Y]\œËœ›Ú™XÝYKÚ\ÜÝYU\U\ØYÙ\ØˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆ™^YÙUÚÙ[Žˆ\˜[Y]\œË›™^YÙUÚÙ[‹ˆX^™\Ý[Îˆ\˜[Y]\œË›X^™\Ý[ËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]›Ú™XÝ\ØYÙ\Ñ›Ü”Ý]\Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ÜÝ]\Ù\ËÉÜ\˜[Y]\œËœÝ]\ÒYKÜ›Ú™XÝ\ØYÙ\ØˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆ™^YÙUÚÙ[Žˆ\˜[Y]\œË›™^YÙUÚÙ[‹ˆX^™\Ý[Îˆ\˜[Y]\œË›X^™\Ý[ËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]ÛÜšÙ›ÝÕ\ØYÙ\Ñ›Ü”Ý]\Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ÜÝ]\Ù\ËÉÜ\˜[Y]\œËœÝ]\ÒYKÝÛÜšÙ›ÝÕ\ØYÙ\ØˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆ™^YÙUÚÙ[Žˆ\˜[Y]\œË›™^YÙUÚÙ[‹ˆX^™\Ý[Îˆ\˜[Y]\œË›X^™\Ý[ËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBŸB‚˜Û\ÜÈ\ÚÜÈÂˆÛY[ÂˆÛÛœÝXÝÜŠÛY[
HÂˆ\Ë˜ÛY[HÛY[ÂˆBˆ\Þ[˜ÈÙ]\ÚÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝ\ÚÒYH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œË\ÚÒYÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ý\ÚËÉÝ\ÚÒYXˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈØ[˜Ù[\ÚÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝ\ÚÒYH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œË\ÚÒYÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ý\ÚËÉÝ\ÚÒYKØØ[˜Ù[ˆY]Ùˆ	ÔÔÕ	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBŸB‚˜Û\ÜÈX[\Ò[”[ˆÂˆÛY[ÂˆÛÛœÝXÝÜŠÛY[
HÂˆ\Ë˜ÛY[HÛY[ÂˆBˆ\Þ[˜ÈÙ]X[\Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ü[œËÜ[‹ÉÜ\˜[Y]\œËœ[’YKÝX[XˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆÝ\œÛÜŽˆ\˜[Y]\œË˜Ý\œÛÜ‹ˆX^™\Ý[Îˆ\˜[Y]\œË›X^™\Ý[ËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈY]\ÜÚX[•X[J\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ü[œËÜ[‹ÉÜ\˜[Y]\œËœ[’YKÝX[KØ]\ÜÚX[˜ˆY]Ùˆ	ÔÔÕ	Ëˆ]NˆÂˆØ\XÚ]Nˆ\˜[Y]\œË˜Ø\XÚ]KˆYˆ\˜[Y]\œËšYˆ\ÜÝYTÛÝ\˜ÙRYˆ\˜[Y]\œËš\ÜÝYTÛÝ\˜ÙRYˆ[›š[™ÔÝ[Nˆ\˜[Y]\œËœ[›š[™ÔÝ[KˆÜš[[™Ýˆ\˜[Y]\œËœÜš[[™ÝˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]]\ÜÚX[•X[J\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ü[œËÜ[‹ÉÜ\˜[Y]\œËœ[’YKÝX[KØ]\ÜÚX[‹ÉÜ\˜[Y]\œË˜]\ÜÚX[•X[RYXˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È\]P]\ÜÚX[•X[J\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ü[œËÜ[‹ÉÜ\˜[Y]\œËœ[’YKÝX[KØ]\ÜÚX[‹ÉÜ\˜[Y]\œË˜]\ÜÚX[•X[RYXˆY]Ùˆ	ÔU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È™[[Ý™P]\ÜÚX[•X[J\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ü[œËÜ[‹ÉÜ\˜[Y]\œËœ[’YKÝX[KØ]\ÜÚX[‹ÉÜ\˜[Y]\œË˜]\ÜÚX[•X[RYXˆY]Ùˆ	ÑSUIËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÜ™X]T[“Û›UX[J\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ü[œËÜ[‹ÉÜ\˜[Y]\œËœ[’YKÝX[KÜ[›Û›XˆY]Ùˆ	ÔÔÕ	Ëˆ]NˆÂˆØ\XÚ]Nˆ\˜[Y]\œË˜Ø\XÚ]Kˆ\ÜÝYTÛÝ\˜ÙRYˆ\˜[Y]\œËš\ÜÝYTÛÝ\˜ÙRYˆY[X™\XØÛÝ[YÎˆ\˜[Y]\œË›Y[X™\XØÛÝ[YËˆ˜[YNˆ\˜[Y]\œË›˜[YKˆ[›š[™ÔÝ[Nˆ\˜[Y]\œËœ[›š[™ÔÝ[KˆÜš[[™Ýˆ\˜[Y]\œËœÜš[[™ÝˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ][“Û›UX[J\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ü[œËÜ[‹ÉÜ\˜[Y]\œËœ[’YKÝX[KÜ[›Û›KÉÜ\˜[Y]\œËœ[“Û›UX[RYXˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È\]T[“Û›UX[J\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ü[œËÜ[‹ÉÜ\˜[Y]\œËœ[’YKÝX[KÜ[›Û›KÉÜ\˜[Y]\œËœ[“Û›UX[RYXˆY]Ùˆ	ÔU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È[]T[“Û›UX[J\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ü[œËÜ[‹ÉÜ\˜[Y]\œËœ[’YKÝX[KÜ[›Û›KÉÜ\˜[Y]\œËœ[“Û›UX[RYXˆY]Ùˆ	ÑSUIËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBŸB‚˜Û\ÜÈ[YU˜XÚÚ[™ÈÂˆÛY[ÂˆÛÛœÝXÝÜŠÛY[
HÂˆ\Ë˜ÛY[HÛY[ÂˆBˆ\Þ[˜ÈÙ]Ù[XÝY[YU˜XÚÚ[™Ò[\[Y[][ÛŠØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹ØÛÛ™šYÝ\˜][Û‹Ý[Y]˜XÚÚ[™ÉËˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ[XÝ[YU˜XÚÚ[™Ò[\[Y[][ÛŠ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹ØÛÛ™šYÝ\˜][Û‹Ý[Y]˜XÚÚ[™ÉËˆY]Ùˆ	ÔU	Ëˆ]NˆÂˆÙ^Nˆ\˜[Y]\œÏËšÙ^Kˆ˜[YNˆ\˜[Y]\œÏË›˜[YKˆ\›ˆ\˜[Y]\œÏË\›ˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]]˜Z[X›U[YU˜XÚÚ[™Ò[\[Y[][ÛœÊØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹ØÛÛ™šYÝ\˜][Û‹Ý[Y]˜XÚÚ[™ËÛ\Ý	ËˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]Ú\™Y[YU˜XÚÚ[™ÐÛÛ™šYÝ\˜][ÛŠØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹ØÛÛ™šYÝ\˜][Û‹Ý[Y]˜XÚÚ[™ËÛÜ[ÛœÉËˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]Ú\™Y[YU˜XÚÚ[™ÐÛÛ™šYÝ\˜][ÛŠ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹ØÛÛ™šYÝ\˜][Û‹Ý[Y]˜XÚÚ[™ËÛÜ[ÛœÉËˆY]Ùˆ	ÔU	Ëˆ]NˆÂˆÛÜšÚ[™ÒÝ\œÔ\‘^Nˆ\˜[Y]\œËÛÜšÚ[™ÒÝ\œÔ\‘^KˆÛÜšÚ[™Ñ^\Ô\•ÙYZÎˆ\˜[Y]\œËÛÜšÚ[™Ñ^\Ô\•ÙYZËˆ[YQ›Ü›X]ˆ\˜[Y]\œË[YQ›Ü›X]ˆY˜][[š]ˆ\˜[Y]\œË™Y˜][[š]ˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBŸB‚˜Û\ÜÈRS[ÙYšXØ][ÛœÐ\ÈÂˆÛY[ÂˆÛÛœÝXÝÜŠÛY[
HÂˆ\Ë˜ÛY[HÛY[ÂˆBˆ\Þ[˜ÈÙ]ZS[ÙYšXØ][ÛœÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹ÝZS[ÙYšXØ][ÛœÉËˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆÝ\]ˆ\˜[Y]\œÏËœÝ\]ˆX^™\Ý[Îˆ\˜[Y]\œÏË›X^™\Ý[Ëˆ^[™ˆ\˜[Y]\œÏË™^[™ˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÜ™X]UZS[ÙYšXØ][ÛŠ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹ÝZS[ÙYšXØ][ÛœÉËˆY]Ùˆ	ÔÔÕ	Ëˆ]NˆÂˆ˜[YNˆ\˜[Y]\œË›˜[YKˆ\ØÜš\[ÛŽˆ\˜[Y]\œË™\ØÜš\[Û‹ˆ]Nˆ\˜[Y]\œË™]KˆÛÛ^Îˆ\˜[Y]\œË˜ÛÛ^ËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È\]UZS[ÙYšXØ][ÛŠ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ÝZS[ÙYšXØ][ÛœËÉÜ\˜[Y]\œËZS[ÙYšXØ][Û’YXˆY]Ùˆ	ÔU	Ëˆ]NˆÂˆÛÛ^Îˆ\˜[Y]\œË˜ÛÛ^Ëˆ]Nˆ\˜[Y]\œË™]Kˆ\ØÜš\[ÛŽˆ\˜[Y]\œË™\ØÜš\[Û‹ˆ˜[YNˆ\˜[Y]\œË›˜[YKˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È[]UZS[ÙYšXØ][ÛŠ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝZS[ÙYšXØ][Û’YH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËZS[ÙYšXØ][Û’YÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ÝZS[ÙYšXØ][ÛœËÉÝZS[ÙYšXØ][Û’YXˆY]Ùˆ	ÑSUIËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBŸB‚˜Û\ÜÈ\Ù\“˜]”›Ü\Y\ÈÂˆÛY[ÂˆÛÛœÝXÝÜŠÛY[
HÂˆ\Ë˜ÛY[HÛY[ÂˆBˆ\Þ[˜ÈÙ]\Ù\“˜]”›Ü\J\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ý\Ù\‹Û˜][Ü\›Ü\KÉÜ\˜[Y]\œËœ›Ü\RÙ^_XˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆXØÛÝ[Yˆ\˜[Y]\œË˜XØÛÝ[YˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]\Ù\“˜]”›Ü\J\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ý\Ù\‹Û˜][Ü\›Ü\KÉÜ\˜[Y]\œËœ›Ü\RÙ^_XˆY]Ùˆ	ÔU	Ëˆ\˜[\ÎˆÂˆXØÛÝ[Yˆ\˜[Y]\œË˜XØÛÝ[YˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBŸB‚˜Û\ÜÈ\Ù\”›Ü\Y\ÈÂˆÛY[ÂˆÛÛœÝXÝÜŠÛY[
HÂˆ\Ë˜ÛY[HÛY[ÂˆBˆ\Þ[˜ÈÙ]\Ù\”›Ü\RÙ^\Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ý\Ù\‹Ü›Ü\Y\ÉËˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆXØÛÝ[Yˆ\˜[Y]\œÏË˜XØÛÝ[Yˆ\Ù\’Ù^Nˆ\˜[Y]\œÏË\Ù\’Ù^Kˆ\Ù\›˜[YNˆ\˜[Y]\œÏË\Ù\›˜[YKˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]\Ù\”›Ü\J\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ý\Ù\‹Ü›Ü\Y\ËÉÜ\˜[Y]\œËœ›Ü\RÙ^_XˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆXØÛÝ[Yˆ\˜[Y]\œË˜XØÛÝ[Yˆ\Ù\’Ù^Nˆ\˜[Y]\œË\Ù\’Ù^Kˆ\Ù\›˜[YNˆ\˜[Y]\œË\Ù\›˜[YKˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]\Ù\”›Ü\J\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ý\Ù\‹Ü›Ü\Y\ËÉÜ\˜[Y]\œËœ›Ü\RÙ^_XˆY]Ùˆ	ÔU	Ëˆ\˜[\ÎˆÂˆXØÛÝ[Yˆ\˜[Y]\œË˜XØÛÝ[YˆKˆ]Nˆ\˜[Y]\œËœ›Ü\U˜[YKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È[]U\Ù\”›Ü\J\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹Ý\Ù\‹Ü›Ü\Y\ËÉÜ\˜[Y]\œËœ›Ü\RÙ^_XˆY]Ùˆ	ÑSUIËˆ\˜[\ÎˆÂˆXØÛÝ[Yˆ\˜[Y]\œË˜XØÛÝ[Yˆ\Ù\’Ù^Nˆ\˜[Y]\œË\Ù\’Ù^Kˆ\Ù\›˜[YNˆ\˜[Y]\œË\Ù\›˜[YKˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBŸB‚˜Û\ÜÈ\Ù\œÈÂˆÛY[ÂˆÛÛœÝXÝÜŠÛY[
HÂˆ\Ë˜ÛY[HÛY[ÂˆBˆ\Þ[˜ÈÙ]\Ù\Š\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ý\Ù\‰ËˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆXØÛÝ[Yˆ\˜[Y]\œË˜XØÛÝ[Yˆ^[™ˆ\˜[Y]\œË™^[™ˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÜ™X]U\Ù\Š\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ý\Ù\‰ËˆY]Ùˆ	ÔÔÕ	Ëˆ]NˆÂˆ[XZ[Y™\ÜÎˆ\˜[Y]\œË™[XZ[Y™\ÜËˆÙ^Nˆ\˜[Y]\œËšÙ^Kˆ˜[YNˆ\˜[Y]\œË›˜[YKˆ\ÜÝÛÜ™ˆ\˜[Y]\œËœ\ÜÝÛÜ™ˆ›ÙXÝÎˆ\˜[Y]\œËœ›ÙXÝËˆÙ[Žˆ\˜[Y]\œËœÙ[‹ˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È™[[Ý™U\Ù\Š\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ý\Ù\‰ËˆY]Ùˆ	ÑSUIËˆ\˜[\ÎˆÂˆXØÛÝ[Yˆ\˜[Y]\œË˜XØÛÝ[Yˆ\Ù\›˜[YNˆ\˜[Y]\œË\Ù\›˜[YKˆÙ^Nˆ\˜[Y]\œËšÙ^KˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È[ÑÙ]\Ù\œÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ý\Ù\‹Ø[ÉËˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆÝ\]ˆ\˜[Y]\œËœÝ\]ˆX^™\Ý[Îˆ\˜[Y]\œË›X^™\Ý[ËˆXØÛÝ[Yˆ\˜[TÙ\šX[^™\Š	ØXØÛÝ[Y	Ë\˜[Y]\œË˜XØÛÝ[Y
KˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È[ÑÙ]\Ù\œÓZYÜ˜][ÛŠ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ý\Ù\‹Ø[ËÛZYÜ˜][Û‰ËˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆÝ\]ˆ\˜[Y]\œËœÝ\]ˆX^™\Ý[Îˆ\˜[Y]\œË›X^™\Ý[Ëˆ\Ù\›˜[YNˆ\˜[TÙ\šX[^™\Š	Ý\Ù\›˜[YIË\˜[Y]\œË\Ù\›˜[YJKˆÙ^Nˆ\˜[TÙ\šX[^™\Š	ÚÙ^IË\˜[Y]\œËšÙ^JKˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]\Ù\‘Y˜][ÛÛ[[œÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ý\Ù\‹ØÛÛ[[œÉËˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆXØÛÝ[Yˆ\˜[Y]\œÏË˜XØÛÝ[Yˆ\Ù\›˜[YNˆ\˜[Y]\œÏË\Ù\›˜[YKˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]\Ù\ÛÛ[[œÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ý\Ù\‹ØÛÛ[[œÉËˆY]Ùˆ	ÔU	Ëˆ\˜[\ÎˆÂˆXØÛÝ[Yˆ\˜[Y]\œË˜XØÛÝ[YˆKˆ]Nˆ\˜[Y]\œË˜ÛÛ[[œËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È™\Ù]\Ù\ÛÛ[[œÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ý\Ù\‹ØÛÛ[[œÉËˆY]Ùˆ	ÑSUIËˆ\˜[\ÎˆÂˆXØÛÝ[Yˆ\˜[Y]\œË˜XØÛÝ[Yˆ\Ù\›˜[YNˆ\˜[Y]\œË\Ù\›˜[YKˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]\Ù\‘[XZ[
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝXØÛÝ[YH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œË˜XØÛÝ[YÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ý\Ù\‹Ù[XZ[	ËˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆXØÛÝ[YˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]\Ù\‘[XZ[[Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝXØÛÝ[YH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œË˜XØÛÝ[YÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ý\Ù\‹Ù[XZ[Ø[ÉËˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆXØÛÝ[YˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]\Ù\‘Ü›Ý\Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ý\Ù\‹ÙÜ›Ý\ÉËˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆXØÛÝ[Yˆ\˜[Y]\œË˜XØÛÝ[Yˆ\Ù\›˜[YNˆ\˜[Y]\œË\Ù\›˜[YKˆÙ^Nˆ\˜[Y]\œËšÙ^KˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ][\Ù\œÑY˜][
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ý\Ù\œÉËˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆÝ\]ˆ\˜[Y]\œÏËœÝ\]ˆX^™\Ý[Îˆ\˜[Y]\œÏË›X^™\Ý[ËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ][\Ù\œÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ý\Ù\œËÜÙX\˜Ú	ËˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆÝ\]ˆ\˜[Y]\œÏËœÝ\]ˆX^™\Ý[Îˆ\˜[Y]\œÏË›X^™\Ý[ËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBŸB‚˜Û\ÜÈ\Ù\”ÙX\˜ÚÂˆÛY[ÂˆÛÛœÝXÝÜŠÛY[
HÂˆ\Ë˜ÛY[HÛY[ÂˆBˆ\Þ[˜Èš[™[Ð\ÜÚYÛ˜X›U\Ù\œÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ý\Ù\‹Ø\ÜÚYÛ˜X›KÛ][T›Ú™XÝÙX\˜Ú	ËˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆ]Y\žNˆ\˜[Y]\œËœ]Y\žKˆ\Ù\›˜[YNˆ\˜[Y]\œË\Ù\›˜[YKˆXØÛÝ[Yˆ\˜[Y]\œË˜XØÛÝ[Yˆ›Ú™XÝÙ^\Îˆ\˜[Y]\œËœ›Ú™XÝÙ^\ËˆÝ\]ˆ\˜[Y]\œËœÝ\]ˆX^™\Ý[Îˆ\˜[Y]\œË›X^™\Ý[ËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜Èš[™\ÜÚYÛ˜X›U\Ù\œÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ý\Ù\‹Ø\ÜÚYÛ˜X›KÜÙX\˜Ú	ËˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆ]Y\žNˆ\˜[Y]\œÏËœ]Y\žKˆÙ\ÜÚ[Û’Yˆ\˜[Y]\œÏËœÙ\ÜÚ[Û’Yˆ\Ù\›˜[YNˆ\˜[Y]\œÏË\Ù\›˜[YKˆXØÛÝ[Yˆ\˜[Y]\œÏË˜XØÛÝ[Yˆ›Ú™XÝˆ\˜[Y]\œÏËœ›Ú™XÝˆ\ÜÝYRÙ^Nˆ\˜[Y]\œÏËš\ÜÝYRÙ^Kˆ\ÜÝYRYˆ\˜[Y]\œÏËš\ÜÝYRYˆÝ\]ˆ\˜[Y]\œÏËœÝ\]ˆX^™\Ý[Îˆ\˜[Y]\œÏË›X^™\Ý[ËˆXÝ[Û‘\ØÜš\Ü’Yˆ\˜[Y]\œÏË˜XÝ[Û‘\ØÜš\Ü’Yˆ™XÛÛ[Y[™ˆ\˜[Y]\œÏËœ™XÛÛ[Y[™ˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜Èš[™\Ù\œÕÚ][\›Z\ÜÚ[ÛœÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ý\Ù\‹Ü\›Z\ÜÚ[Û‹ÜÙX\˜Ú	ËˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆ]Y\žNˆ\˜[Y]\œËœ]Y\žKˆ\Ù\›˜[YNˆ\˜[Y]\œË\Ù\›˜[YKˆXØÛÝ[Yˆ\˜[Y]\œË˜XØÛÝ[Yˆ\›Z\ÜÚ[ÛœÎˆ\˜[Y]\œËœ\›Z\ÜÚ[ÛœËˆ\ÜÝYRÙ^Nˆ\˜[Y]\œËš\ÜÝYRÙ^Kˆ›Ú™XÝÙ^Nˆ\˜[Y]\œËœ›Ú™XÝÙ^KˆÝ\]ˆ\˜[Y]\œËœÝ\]ˆX^™\Ý[Îˆ\˜[Y]\œË›X^™\Ý[ËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜Èš[™\Ù\œÑ›Ü”XÚÙ\Š\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ý\Ù\‹ÜXÚÙ\‰ËˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆ]Y\žNˆ\˜[Y]\œËœ]Y\žKˆX^™\Ý[Îˆ\˜[Y]\œË›X^™\Ý[ËˆÚÝÐ]˜]\Žˆ\˜[Y]\œËœÚÝÐ]˜]\‹ˆ^ÛYPXØÛÝ[YÎˆ\˜[TÙ\šX[^™\Š	Ù^ÛYPXØÛÝ[YÉË\˜[Y]\œË™^ÛYPXØÛÝ[YÊKˆ]˜]\”Ú^™Nˆ\˜[Y]\œË˜]˜]\”Ú^™Kˆ^ÛYPÛÛ›™XÝ\Ù\œÎˆ\˜[Y]\œË™^ÛYPÛÛ›™XÝ\Ù\œËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜Èš[™\Ù\œÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ý\Ù\‹ÜÙX\˜Ú	ËˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆ]Y\žNˆ\˜[Y]\œÏËœ]Y\žKˆ\Ù\›˜[YNˆ\˜[Y]\œÏË\Ù\›˜[YKˆXØÛÝ[Yˆ\˜[Y]\œÏË˜XØÛÝ[YˆÝ\]ˆ\˜[Y]\œÏËœÝ\]ˆX^™\Ý[Îˆ\˜[Y]\œÏË›X^™\Ý[Ëˆ›Ü\Nˆ\˜[Y]\œÏËœ›Ü\KˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜Èš[™\Ù\œÐžT]Y\žJ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ý\Ù\‹ÜÙX\˜ÚÜ]Y\žIËˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆ]Y\žNˆ\˜[Y]\œËœ]Y\žKˆÝ\]ˆ\˜[Y]\œËœÝ\]ˆX^™\Ý[Îˆ\˜[Y]\œË›X^™\Ý[ËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜Èš[™\Ù\’Ù^\ÐžT]Y\žJ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ý\Ù\‹ÜÙX\˜ÚÜ]Y\žKÚÙ^IËˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆ]Y\žNˆ\˜[Y]\œËœ]Y\žKˆÝ\]ˆ\˜[Y]\œËœÝ\]ˆX^™\Ý[ˆ\˜[Y]\œË›X^™\Ý[\˜[Y]\œË›X^™\Ý[ËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜Èš[™\Ù\œÕÚ]œ›ÝÜÙT\›Z\ÜÚ[ÛŠ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹Ý\Ù\‹ÝšY]Ú\ÜÝYKÜÙX\˜Ú	ËˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆ]Y\žNˆ\˜[Y]\œÏËœ]Y\žKˆ\Ù\›˜[YNˆ\˜[Y]\œÏË\Ù\›˜[YKˆXØÛÝ[Yˆ\˜[Y]\œÏË˜XØÛÝ[Yˆ\ÜÝYRÙ^Nˆ\˜[Y]\œÏËš\ÜÝYRÙ^Kˆ›Ú™XÝÙ^Nˆ\˜[Y]\œÏËœ›Ú™XÝÙ^KˆÝ\]ˆ\˜[Y]\œÏËœÝ\]ˆX^™\Ý[Îˆ\˜[Y]\œÏË›X^™\Ý[ËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBŸB‚˜Û\ÜÈÙXšÛÚÜÈÂˆÛY[ÂˆÛÛœÝXÝÜŠÛY[
HÂˆ\Ë˜ÛY[HÛY[ÂˆBˆ\Þ[˜ÈÙ][˜[ZXÕÙXšÛÚÜÑ›Ü\
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹ÝÙXšÛÚÉËˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆÝ\]ˆ\˜[Y]\œÏËœÝ\]ˆX^™\Ý[Îˆ\˜[Y]\œÏË›X^™\Ý[ËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È™YÚ\Ý\‘[˜[ZXÕÙXšÛÚÜÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹ÝÙXšÛÚÉËˆY]Ùˆ	ÔÔÕ	Ëˆ]NˆÂˆÙXšÛÚÜÎˆ\˜[Y]\œËÙXšÛÚÜËˆ\›ˆ\˜[Y]\œË\›ˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È[]UÙXšÛÚÐžRY
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹ÝÙXšÛÚÉËˆY]Ùˆ	ÑSUIËˆ]NˆÂˆÙXšÛÚÒYÎˆ\˜[Y]\œËÙXšÛÚÒYËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]˜Z[YÙXšÛÚÜÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹ÝÙXšÛÚËÙ˜Z[Y	ËˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆX^™\Ý[Îˆ\˜[Y]\œÏË›X^™\Ý[ËˆY\Žˆ\˜[Y]\œÏË˜Y\‹ˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È™Yœ™\ÚÙXšÛÚÜÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹ÝÙXšÛÚËÜ™Yœ™\Ú	ËˆY]Ùˆ	ÔU	Ëˆ]NˆÂˆÙXšÛÚÒYÎˆ\˜[Y]\œËÙXšÛÚÒYËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBŸB‚˜Û\ÜÈÛÜšÙ›ÝÜÈÂˆÛY[ÂˆÛÛœÝXÝÜŠÛY[
HÂˆ\Ë˜ÛY[HÛY[ÂˆBˆ\Þ[˜ÈÜ™X]UÛÜšÙ›ÝÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹ÝÛÜšÙ›ÝÉËˆY]Ùˆ	ÔÔÕ	Ëˆ]NˆÂˆ\ØÜš\[ÛŽˆ\˜[Y]\œË™\ØÜš\[Û‹ˆ˜[YNˆ\˜[Y]\œË›˜[YKˆÝ]\Ù\Îˆ\˜[Y]\œËœÝ]\Ù\Ëˆ˜[œÚ][ÛœÎˆ\˜[Y]\œË˜[œÚ][ÛœËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]ÛÜšÙ›ÝÜÔYÚ[˜]Y
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹ÝÛÜšÙ›ÝËÜÙX\˜Ú	ËˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆÝ\]ˆ\˜[Y]\œÏËœÝ\]ˆX^™\Ý[Îˆ\˜[Y]\œÏË›X^™\Ý[ËˆÛÜšÙ›ÝÓ˜[YNˆ\˜[TÙ\šX[^™\Š	ÝÛÜšÙ›ÝÓ˜[YIË\˜[Y]\œÏËÛÜšÙ›ÝÓ˜[YJKˆ^[™ˆ\˜[Y]\œÏË™^[™ˆ]Y\žTÝš[™Îˆ\˜[Y]\œÏËœ]Y\žTÝš[™ËˆÜ™\žNˆ\˜[Y]\œÏË›Ü™\žKˆ\ÐXÝ]™Nˆ\˜[Y]\œÏËš\ÐXÝ]™KˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È[]R[˜XÝ]™UÛÜšÙ›ÝÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝ[]RYH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œË™[]RYÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ÝÛÜšÙ›ÝËÉÙ[]RYXˆY]Ùˆ	ÑSUIËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]ÛÜšÙ›ÝÔ›Ú™XÝ\ÜÝYU\U\ØYÙ\Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ÝÛÜšÙ›ÝËÉÜ\˜[Y]\œËÛÜšÙ›ÝÒYKÜ›Ú™XÝÉÜ\˜[Y]\œËœ›Ú™XÝYKÚ\ÜÝYU\U\ØYÙ\ØˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆ™^YÙUÚÙ[Žˆ\˜[Y]\œË›™^YÙUÚÙ[‹ˆX^™\Ý[Îˆ\˜[Y]\œË›X^™\Ý[ËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]›Ú™XÝ\ØYÙ\Ñ›Ü•ÛÜšÙ›ÝÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ÝÛÜšÙ›ÝËÉÜ\˜[Y]\œËÛÜšÙ›ÝÒYKÜ›Ú™XÝ\ØYÙ\ØˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆ™^YÙUÚÙ[Žˆ\˜[Y]\œË›™^YÙUÚÙ[‹ˆX^™\Ý[Îˆ\˜[Y]\œË›X^™\Ý[ËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]ÛÜšÙ›ÝÔØÚ[YU\ØYÙ\Ñ›Ü•ÛÜšÙ›ÝÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ÝÛÜšÙ›ÝËÉÜ\˜[Y]\œËÛÜšÙ›ÝÒYKÝÛÜšÙ›ÝÔØÚ[Y\ØˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆ™^YÙUÚÙ[Žˆ\˜[Y]\œË›™^YÙUÚÙ[‹ˆX^™\Ý[Îˆ\˜[Y]\œË›X^™\Ý[ËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È™XYÛÜšÙ›ÝÜÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹ÝÛÜšÙ›ÝÜÉËˆY]Ùˆ	ÔÔÕ	Ëˆ\˜[\ÎˆÂˆ\ÙU˜[œÚ][Û“[šÜÑ›Ü›X]ˆ\˜[Y]\œË\ÙU˜[œÚ][Û“[šÜÑ›Ü›X]ˆ\ÙP\›Ý˜[ÛÛ™šYÝ\˜][ÛŽˆ\˜[Y]\œË\ÙP\›Ý˜[ÛÛ™šYÝ\˜][Û‹ˆKˆ]NˆÂˆ›Ú™XÝ[™\ÜÝYU\\Îˆ\˜[Y]\œËœ›Ú™XÝ[™\ÜÝYU\\ËˆÛÜšÙ›ÝÒYÎˆ\˜[Y]\œËÛÜšÙ›ÝÒYËˆÛÜšÙ›ÝÓ˜[Y\Îˆ\˜[Y]\œËÛÜšÙ›ÝÓ˜[Y\ËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÛÜšÙ›ÝÐØ\Xš[]Y\Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹ÝÛÜšÙ›ÝÜËØØ\Xš[]Y\ÉËˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆÛÜšÙ›ÝÒYˆ\˜[Y]\œËÛÜšÙ›ÝÒYˆ›Ú™XÝYˆ\˜[Y]\œËœ›Ú™XÝYˆ\ÜÝYU\RYˆ\˜[Y]\œËš\ÜÝYU\RYˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÜ™X]UÛÜšÙ›ÝÜÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹ÝÛÜšÙ›ÝÜËØÜ™X]IËˆY]Ùˆ	ÔÔÕ	Ëˆ]NˆÂˆØÛÜNˆ\˜[Y]\œËœØÛÜKˆÝ]\Ù\Îˆ\˜[Y]\œËœÝ]\Ù\ËˆÛÜšÙ›ÝÜÎˆ\˜[Y]\œËÛÜšÙ›ÝÜËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È˜[Y]PÜ™X]UÛÜšÙ›ÝÜÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹ÝÛÜšÙ›ÝÜËØÜ™X]KÝ˜[Y][Û‰ËˆY]Ùˆ	ÔÔÕ	Ëˆ]NˆÂˆ^[ØYˆ\˜[Y]\œËœ^[ØYˆ˜[Y][Û“Ü[ÛœÎˆ\˜[Y]\œË˜[Y][Û“Ü[ÛœËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙX\˜ÚÛÜšÙ›ÝÜÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹ÝÛÜšÙ›ÝÜËÜÙX\˜Ú	ËˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆÝ\]ˆ\˜[Y]\œÏËœÝ\]ˆX^™\Ý[Îˆ\˜[Y]\œÏË›X^™\Ý[Ëˆ^[™ˆ\˜[Y]\œÏË™^[™ˆ]Y\žTÝš[™Îˆ\˜[Y]\œÏËœ]Y\žTÝš[™ËˆÜ™\žNˆ\˜[Y]\œÏË›Ü™\žKˆØÛÜNˆ\˜[Y]\œÏËœØÛÜKˆ\ÐXÝ]™Nˆ\˜[Y]\œÏËš\ÐXÝ]™KˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È\]UÛÜšÙ›ÝÜÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹ÝÛÜšÙ›ÝÜËÝ\]IËˆY]Ùˆ	ÔÔÕ	Ëˆ\˜[\ÎˆÂˆ^[™ˆ\˜[Y]\œË™^[™ˆKˆ]NˆÂˆÝ]\Ù\Îˆ\˜[Y]\œËœÝ]\Ù\ËˆÛÜšÙ›ÝÜÎˆ\˜[Y]\œËÛÜšÙ›ÝÜËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È˜[Y]U\]UÛÜšÙ›ÝÜÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹ÝÛÜšÙ›ÝÜËÝ\]KÝ˜[Y][Û‰ËˆY]Ùˆ	ÔÔÕ	Ëˆ]NˆÂˆ^[ØYˆ\˜[Y]\œËœ^[ØYˆ˜[Y][Û“Ü[ÛœÎˆ\˜[Y]\œË˜[Y][Û“Ü[ÛœËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È™XYÛÜšÙ›ÝÑœ›ÛR\ÝÜžJ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹ÝÛÜšÙ›ÝËÚ\ÝÜžIËˆY]Ùˆ	ÔÔÕ	Ëˆ]NˆÂˆ™\œÚ[ÛŽˆ\˜[Y]\œË™\œÚ[Û‹ˆÛÜšÙ›ÝÒYˆ\˜[Y]\œËÛÜšÙ›ÝÒYˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È\ÝÛÜšÙ›ÝÒ\ÝÜžJ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹ÝÛÜšÙ›ÝËÚ\ÝÜžKÛ\Ý	ËˆY]Ùˆ	ÔÔÕ	Ëˆ\˜[\ÎˆÂˆ^[™ˆ\˜[Y]\œË™^[™ˆKˆ]NˆÂˆÛÜšÙ›ÝÒYˆ\˜[Y]\œËÛÜšÙ›ÝÒYˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]Y˜][Y]ÜŠØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹ÝÛÜšÙ›ÝÜËÙY˜][Y]Ü‰ËˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È™XYÛÜšÙ›ÝÔ™]šY]ÜÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹ÝÛÜšÙ›ÝÜËÜ™]šY]ÉËˆY]Ùˆ	ÔÔÕ	Ëˆ]NˆÂˆ\ÜÝYU\RYÎˆ\˜[Y]\œËš\ÜÝYU\RYËˆ›Ú™XÝYˆ\˜[Y]\œËœ›Ú™XÝYˆÛÜšÙ›ÝÒYÎˆ\˜[Y]\œËÛÜšÙ›ÝÒYËˆÛÜšÙ›ÝÓ˜[Y\Îˆ\˜[Y]\œËÛÜšÙ›ÝÓ˜[Y\ËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBŸB‚˜Û\ÜÈÛÜšÙ›ÝÔØÚ[YQ˜YÈÂˆÛY[ÂˆÛÛœÝXÝÜŠÛY[
HÂˆ\Ë˜ÛY[HÛY[ÂˆBˆ\Þ[˜ÈÜ™X]UÛÜšÙ›ÝÔØÚ[YQ˜Yœ›ÛT\™[
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝYH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËšYÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ÝÛÜšÙ›ÝÜØÚ[YKÉÚYKØÜ™X]Y˜YˆY]Ùˆ	ÔÔÕ	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]ÛÜšÙ›ÝÔØÚ[YQ˜Y
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝYH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËšYÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ÝÛÜšÙ›ÝÜØÚ[YKÉÚYKÙ˜YˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È\]UÛÜšÙ›ÝÔØÚ[YQ˜Y
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ÝÛÜšÙ›ÝÜØÚ[YKÉÜ\˜[Y]\œËšYKÙ˜YˆY]Ùˆ	ÔU	Ëˆ]NˆÂˆ˜[YNˆ\˜[Y]\œË›˜[YKˆ\ØÜš\[ÛŽˆ\˜[Y]\œË™\ØÜš\[Û‹ˆY˜][ÛÜšÙ›ÝÎˆ\˜[Y]\œË™Y˜][ÛÜšÙ›ÝËˆ\ÜÝYU\SX\[™ÜÎˆ\˜[Y]\œËš\ÜÝYU\SX\[™ÜËˆ\]Q˜YY“™YYYˆ\˜[Y]\œË\]Q˜YY“™YYYˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È[]UÛÜšÙ›ÝÔØÚ[YQ˜Y
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝYH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËšYÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ÝÛÜšÙ›ÝÜØÚ[YKÉÚYKÙ˜YˆY]Ùˆ	ÑSUIËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]˜YY˜][ÛÜšÙ›ÝÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝYH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËšYÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ÝÛÜšÙ›ÝÜØÚ[YKÉÚYKÙ˜YÙY˜][ˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È\]Q˜YY˜][ÛÜšÙ›ÝÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ÝÛÜšÙ›ÝÜØÚ[YKÉÜ\˜[Y]\œËšYKÙ˜YÙY˜][ˆY]Ùˆ	ÔU	Ëˆ]NˆÂˆ\]Q˜YY“™YYYˆ\˜[Y]\œË\]Q˜YY“™YYYˆÛÜšÙ›ÝÎˆ\˜[Y]\œËÛÜšÙ›ÝËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È[]Q˜YY˜][ÛÜšÙ›ÝÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝYH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËšYÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ÝÛÜšÙ›ÝÜØÚ[YKÉÚYKÙ˜YÙY˜][ˆY]Ùˆ	ÑSUIËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]ÛÜšÙ›ÝÔØÚ[YQ˜Y\ÜÝYU\J\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ÝÛÜšÙ›ÝÜØÚ[YKÉÜ\˜[Y]\œËšYKÙ˜YÚ\ÜÝY]\KÉÜ\˜[Y]\œËš\ÜÝYU\_XˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]ÛÜšÙ›ÝÔØÚ[YQ˜Y\ÜÝYU\J\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ÝÛÜšÙ›ÝÜØÚ[YKÉÜ\˜[Y]\œËšYKÙ˜YÚ\ÜÝY]\KÉÜ\˜[Y]\œËš\ÜÝYU\_XˆY]Ùˆ	ÔU	Ëˆ]Nˆ\˜[Y]\œË™]Z[ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È[]UÛÜšÙ›ÝÔØÚ[YQ˜Y\ÜÝYU\J\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ÝÛÜšÙ›ÝÜØÚ[YKÉÜ\˜[Y]\œËšYKÙ˜YÚ\ÜÝY]\KÉÜ\˜[Y]\œËš\ÜÝYU\_XˆY]Ùˆ	ÑSUIËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈX›\Ú˜YÛÜšÙ›ÝÔØÚ[YJ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝYH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËšYÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ÝÛÜšÙ›ÝÜØÚ[YKÉÚYKÙ˜YÜX›\ÚˆY]Ùˆ	ÔÔÕ	Ëˆ\˜[\ÎˆÂˆ˜[Y]SÛ›Nˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈ	‰ˆ\˜[Y]\œË˜[Y]SÛ›KˆKˆ]NˆÂˆÝ]\ÓX\[™ÜÎˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈ	‰ˆ\˜[Y]\œËœÝ]\ÓX\[™ÜËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]˜YÛÜšÙ›ÝÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ÝÛÜšÙ›ÝÜØÚ[YKÉÜ\˜[Y]\œËšYKÙ˜YÝÛÜšÙ›ÝØˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆÛÜšÙ›ÝÓ˜[YNˆ\˜[Y]\œËÛÜšÙ›ÝÓ˜[YKˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È\]Q˜YÛÜšÙ›ÝÓX\[™Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ÝÛÜšÙ›ÝÜØÚ[YKÉÜ\˜[Y]\œËšYKÙ˜YÝÛÜšÙ›ÝØˆY]Ùˆ	ÔU	Ëˆ\˜[\ÎˆÂˆÛÜšÙ›ÝÓ˜[YNˆ\˜[Y]\œËÛÜšÙ›ÝÓ˜[YKˆKˆ]NˆÂˆY˜][X\[™Îˆ\˜[Y]\œË™Y˜][X\[™Ëˆ\ÜÝYU\\Îˆ\˜[Y]\œËš\ÜÝYU\\Ëˆ\]Q˜YY“™YYYˆ\˜[Y]\œË\]Q˜YY“™YYYˆÛÜšÙ›ÝÎˆ\˜[Y]\œËÛÜšÙ›ÝËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È[]Q˜YÛÜšÙ›ÝÓX\[™Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ÝÛÜšÙ›ÝÜØÚ[YKÉÜ\˜[Y]\œËšYKÙ˜YÝÛÜšÙ›ÝØˆY]Ùˆ	ÑSUIËˆ\˜[\ÎˆÂˆÛÜšÙ›ÝÓ˜[YNˆ\˜[Y]\œËÛÜšÙ›ÝÓ˜[YKˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBŸB‚˜Û\ÜÈÛÜšÙ›ÝÔØÚ[YT›Ú™XÝ\ÜÛØÚX][ÛœÈÂˆÛY[ÂˆÛÛœÝXÝÜŠÛY[
HÂˆ\Ë˜ÛY[HÛY[ÂˆBˆ\Þ[˜ÈÙ]ÛÜšÙ›ÝÔØÚ[YT›Ú™XÝ\ÜÛØÚX][ÛœÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹ÝÛÜšÙ›ÝÜØÚ[YKÜ›Ú™XÝ	ËˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆ›Ú™XÝYˆ\˜[TÙ\šX[^™\Š	Ü›Ú™XÝY	Ë\˜[Y]\œËœ›Ú™XÝY
KˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È\ÜÚYÛ”ØÚ[YUÔ›Ú™XÝ
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹ÝÛÜšÙ›ÝÜØÚ[YKÜ›Ú™XÝ	ËˆY]Ùˆ	ÔU	Ëˆ]NˆÂˆÛÜšÙ›ÝÔØÚ[YRYˆ\˜[Y]\œËÛÜšÙ›ÝÔØÚ[YRYˆ›Ú™XÝYˆ\˜[Y]\œËœ›Ú™XÝYˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBŸB‚˜Û\ÜÈÛÜšÙ›ÝÔØÚ[Y\ÈÂˆÛY[ÂˆÛÛœÝXÝÜŠÛY[
HÂˆ\Ë˜ÛY[HÛY[ÂˆBˆ\Þ[˜ÈÙ][ÛÜšÙ›ÝÔØÚ[Y\Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹ÝÛÜšÙ›ÝÜØÚ[YIËˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆÝ\]ˆ\˜[Y]\œÏËœÝ\]ˆX^™\Ý[Îˆ\˜[Y]\œÏË›X^™\Ý[ËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÜ™X]UÛÜšÙ›ÝÔØÚ[YJ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹ÝÛÜšÙ›ÝÜØÚ[YIËˆY]Ùˆ	ÔÔÕ	Ëˆ]NˆÂˆY˜][ÛÜšÙ›ÝÎˆ\˜[Y]\œË™Y˜][ÛÜšÙ›ÝËˆ\ØÜš\[ÛŽˆ\˜[Y]\œË™\ØÜš\[Û‹ˆ˜Yˆ\˜[Y]\œË™˜YˆYˆ\˜[Y]\œËšYˆ\ÜÝYU\SX\[™ÜÎˆ\˜[Y]\œËš\ÜÝYU\SX\[™ÜËˆ\ÜÝYU\\Îˆ\˜[Y]\œËš\ÜÝYU\\Ëˆ\Ý[ÙYšYYˆ\˜[Y]\œË›\Ý[ÙYšYYˆ\Ý[ÙYšYY\Ù\Žˆ\˜[Y]\œË›\Ý[ÙYšYY\Ù\‹ˆ˜[YNˆ\˜[Y]\œË›˜[YKˆÜšYÚ[˜[Y˜][ÛÜšÙ›ÝÎˆ\˜[Y]\œË›ÜšYÚ[˜[Y˜][ÛÜšÙ›ÝËˆÜšYÚ[˜[\ÜÝYU\SX\[™ÜÎˆ\˜[Y]\œË›ÜšYÚ[˜[\ÜÝYU\SX\[™ÜËˆÙ[Žˆ\˜[Y]\œËœÙ[‹ˆ\]Q˜YY“™YYYˆ\˜[Y]\œË\]Q˜YY“™YYYˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È™XYÛÜšÙ›ÝÔØÚ[Y\Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹ÝÛÜšÙ›ÝÜØÚ[YKÜ™XY	ËˆY]Ùˆ	ÔÔÕ	Ëˆ\˜[\ÎˆÂˆ^[™ˆ\˜[Y]\œË™^[™ˆKˆ]NˆÂˆ›Ú™XÝYÎˆ\˜[Y]\œËœ›Ú™XÝYËˆÛÜšÙ›ÝÔØÚ[YRYÎˆ\˜[Y]\œËÛÜšÙ›ÝÔØÚ[YRYËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È\]TØÚ[Y\Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹ÝÛÜšÙ›ÝÜØÚ[YKÝ\]IËˆY]Ùˆ	ÔÔÕ	Ëˆ]NˆÂˆY˜][ÛÜšÙ›ÝÒYˆ\˜[Y]\œË™Y˜][ÛÜšÙ›ÝÒYˆ\ØÜš\[ÛŽˆ\˜[Y]\œË™\ØÜš\[Û‹ˆYˆ\˜[Y]\œËšYˆ˜[YNˆ\˜[Y]\œË›˜[YKˆÝ]\ÓX\[™ÜÐžR\ÜÝYU\SÝ™\œšYNˆ\˜[Y]\œËœÝ]\ÓX\[™ÜÐžR\ÜÝYU\SÝ™\œšYKˆÝ]\ÓX\[™ÜÐžUÛÜšÙ›ÝÜÎˆ\˜[Y]\œËœÝ]\ÓX\[™ÜÐžUÛÜšÙ›ÝÜËˆ™\œÚ[ÛŽˆ\˜[Y]\œË™\œÚ[Û‹ˆÛÜšÙ›ÝÜÑ›Ü’\ÜÝYU\\Îˆ\˜[Y]\œËÛÜšÙ›ÝÜÑ›Ü’\ÜÝYU\\ËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È\]UÛÜšÙ›ÝÔØÚ[YSX\[™ÜÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹ÝÛÜšÙ›ÝÜØÚ[YKÝ\]KÛX\[™ÜÉËˆY]Ùˆ	ÔÔÕ	Ëˆ]NˆÂˆY˜][ÛÜšÙ›ÝÒYˆ\˜[Y]\œË™Y˜][ÛÜšÙ›ÝÒYˆYˆ\˜[Y]\œËšYˆÛÜšÙ›ÝÜÑ›Ü’\ÜÝYU\\Îˆ\˜[Y]\œËÛÜšÙ›ÝÜÑ›Ü’\ÜÝYU\\ËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]ÛÜšÙ›ÝÔØÚ[YJ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝYH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËšYÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ÝÛÜšÙ›ÝÜØÚ[YKÉÚYXˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆ™]\›‘˜YY‘^\ÝÎˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈ	‰ˆ\˜[Y]\œËœ™]\›‘˜YY‘^\ÝËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È\]UÛÜšÙ›ÝÔØÚ[YJ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ÝÛÜšÙ›ÝÜØÚ[YKÉÜ\˜[Y]\œËšYXˆY]Ùˆ	ÔU	Ëˆ]NˆÂˆ˜[YNˆ\˜[Y]\œË›˜[YKˆ\ØÜš\[ÛŽˆ\˜[Y]\œË™\ØÜš\[Û‹ˆY˜][ÛÜšÙ›ÝÎˆ\˜[Y]\œË™Y˜][ÛÜšÙ›ÝËˆ\ÜÝYU\SX\[™ÜÎˆ\˜[Y]\œËš\ÜÝYU\SX\[™ÜËˆ\]Q˜YY“™YYYˆ\˜[Y]\œË\]Q˜YY“™YYYˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È[]UÛÜšÙ›ÝÔØÚ[YJ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝYH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËšYÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ÝÛÜšÙ›ÝÜØÚ[YKÉÚYXˆY]Ùˆ	ÑSUIËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]Y˜][ÛÜšÙ›ÝÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝYH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËšYÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ÝÛÜšÙ›ÝÜØÚ[YKÉÚYKÙY˜][ˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆ™]\›‘˜YY‘^\ÝÎˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈ	‰ˆ\˜[Y]\œËœ™]\›‘˜YY‘^\ÝËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È\]QY˜][ÛÜšÙ›ÝÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ÝÛÜšÙ›ÝÜØÚ[YKÉÜ\˜[Y]\œËšYKÙY˜][ˆY]Ùˆ	ÔU	Ëˆ]NˆÂˆ\]Q˜YY“™YYYˆ\˜[Y]\œË\]Q˜YY“™YYYˆÛÜšÙ›ÝÎˆ\˜[Y]\œËÛÜšÙ›ÝËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È[]QY˜][ÛÜšÙ›ÝÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝYH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËšYÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ÝÛÜšÙ›ÝÜØÚ[YKÉÚYKÙY˜][ˆY]Ùˆ	ÑSUIËˆ\˜[\ÎˆÂˆ\]Q˜YY“™YYYˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈ	‰ˆ\˜[Y]\œË\]Q˜YY“™YYYˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]ÛÜšÙ›ÝÔØÚ[YR\ÜÝYU\J\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ÝÛÜšÙ›ÝÜØÚ[YKÉÜ\˜[Y]\œËšYKÚ\ÜÝY]\KÉÜ\˜[Y]\œËš\ÜÝYU\_XˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆ™]\›‘˜YY‘^\ÝÎˆ\˜[Y]\œËœ™]\›‘˜YY‘^\ÝËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]ÛÜšÙ›ÝÔØÚ[YR\ÜÝYU\J\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ÝÛÜšÙ›ÝÜØÚ[YKÉÜ\˜[Y]\œËšYKÚ\ÜÝY]\KÉÜ\˜[Y]\œËš\ÜÝYU\_XˆY]Ùˆ	ÔU	Ëˆ]Nˆ\˜[Y]\œË™]Z[ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È[]UÛÜšÙ›ÝÔØÚ[YR\ÜÝYU\J\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ÝÛÜšÙ›ÝÜØÚ[YKÉÜ\˜[Y]\œËšYKÚ\ÜÝY]\KÉÜ\˜[Y]\œËš\ÜÝYU\_XˆY]Ùˆ	ÑSUIËˆ\˜[\ÎˆÂˆ\]Q˜YY“™YYYˆ\˜[Y]\œË\]Q˜YY“™YYYˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]ÛÜšÙ›ÝÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝYH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËšYÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ÝÛÜšÙ›ÝÜØÚ[YKÉÚYKÝÛÜšÙ›ÝØˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆÛÜšÙ›ÝÓ˜[YNˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈ	‰ˆ\˜[Y]\œËÛÜšÙ›ÝÓ˜[YKˆ™]\›‘˜YY‘^\ÝÎˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈ	‰ˆ\˜[Y]\œËœ™]\›‘˜YY‘^\ÝËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È\]UÛÜšÙ›ÝÓX\[™Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ÝÛÜšÙ›ÝÜØÚ[YKÉÜ\˜[Y]\œËšYKÝÛÜšÙ›ÝØˆY]Ùˆ	ÔU	Ëˆ\˜[\ÎˆÂˆÛÜšÙ›ÝÓ˜[YNˆ\˜[Y]\œËÛÜšÙ›ÝÓ˜[YKˆKˆ]NˆÂˆY˜][X\[™Îˆ\˜[Y]\œË™Y˜][X\[™Ëˆ\ÜÝYU\\Îˆ\˜[Y]\œËš\ÜÝYU\\Ëˆ\]Q˜YY“™YYYˆ\˜[Y]\œË\]Q˜YY“™YYYˆÛÜšÙ›ÝÎˆ\˜[Y]\œËÛÜšÙ›ÝËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È[]UÛÜšÙ›ÝÓX\[™Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝYH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËšYÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ÝÛÜšÙ›ÝÜØÚ[YKÉÚYKÝÛÜšÙ›ÝØˆY]Ùˆ	ÑSUIËˆ\˜[\ÎˆÂˆÛÜšÙ›ÝÓ˜[YNˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈ	‰ˆ\˜[Y]\œËÛÜšÙ›ÝÓ˜[YKˆ\]Q˜YY“™YYYˆ\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈ	‰ˆ\˜[Y]\œË\]Q˜YY“™YYYˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]›Ú™XÝ\ØYÙ\Ñ›Ü•ÛÜšÙ›ÝÔØÚ[YJ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ÝÛÜšÙ›ÝÜØÚ[YKÉÜ\˜[Y]\œËÛÜšÙ›ÝÔØÚ[YRYKÜ›Ú™XÝ\ØYÙ\ØˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆ™^YÙUÚÙ[Žˆ\˜[Y]\œË›™^YÙUÚÙ[‹ˆX^™\Ý[Îˆ\˜[Y]\œË›X^™\Ý[ËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÝÚ]ÚÛÜšÙ›ÝÔØÚ[YQ›Ü”›Ú™XÝ
\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹ÝÛÜšÙ›ÝÜØÚ[YKÜ›Ú™XÝÜÝÚ]Ú	ËˆY]Ùˆ	ÔÔÕ	Ëˆ]NˆÂˆX\[™ÜÐžR\ÜÝYU\SÝ™\œšYNˆ\˜[Y]\œË›X\[™ÜÐžR\ÜÝYU\SÝ™\œšYKˆ›Ú™XÝYˆ\˜[Y]\œËœ›Ú™XÝYˆ\™Ù]ØÚ[YRYˆ\˜[Y]\œË\™Ù]ØÚ[YRYˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBŸB‚˜Û\ÜÈÛÜšÙ›ÝÔÝ]\ÐØ]YÛÜšY\ÈÂˆÛY[ÂˆÛÛœÝXÝÜŠÛY[
HÂˆ\Ë˜ÛY[HÛY[ÂˆBˆ\Þ[˜ÈÙ]Ý]\ÐØ]YÛÜšY\ÊØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹ÜÝ]\ØØ]YÛÜžIËˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]Ý]\ÐØ]YÛÜžJ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝYÜ’Ù^HH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËšYÜ’Ù^NÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ÜÝ]\ØØ]YÛÜžKÉÚYÜ’Ù^_XˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBŸB‚˜Û\ÜÈÛÜšÙ›ÝÔÝ]\Ù\ÈÂˆÛY[ÂˆÛÛœÝXÝÜŠÛY[
HÂˆ\Ë˜ÛY[HÛY[ÂˆBˆ\Þ[˜ÈÙ]Ý]\Ù\ÊØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹ÜÝ]\ÉËˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÙ]Ý]\Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝYÜ“˜[YHH\[Ùˆ\˜[Y]\œÈOOH	ÜÝš[™ÉÈÈ\˜[Y]\œÈˆ\˜[Y]\œËšYÜ“˜[YNÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ÜÝ]\ËÉÚYÜ“˜[Y_XˆY]Ùˆ	ÑÑU	ËˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBŸB‚˜Û\ÜÈÛÜšÙ›ÝÕ˜[œÚ][Û”›Ü\Y\ÈÂˆÛY[ÂˆÛÛœÝXÝÜŠÛY[
HÂˆ\Ë˜ÛY[HÛY[ÂˆBˆ\Þ[˜ÈÙ]ÛÜšÙ›ÝÕ˜[œÚ][Û”›Ü\Y\Ê\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ÝÛÜšÙ›ÝËÝ˜[œÚ][ÛœËÉÜ\˜[Y]\œË˜[œÚ][Û’YKÜ›Ü\Y\ØˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆ[˜ÛYT™\Ù\™YÙ^\Îˆ\˜[Y]\œËš[˜ÛYT™\Ù\™YÙ^\ËˆÙ^Nˆ\˜[Y]\œËšÙ^KˆÛÜšÙ›ÝÓ˜[YNˆ\˜[Y]\œËÛÜšÙ›ÝÓ˜[YKˆÛÜšÙ›ÝÓ[ÙNˆ\˜[Y]\œËÛÜšÙ›ÝÓ[ÙKˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜ÈÜ™X]UÛÜšÙ›ÝÕ˜[œÚ][Û”›Ü\J\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ÝÛÜšÙ›ÝËÝ˜[œÚ][ÛœËÉÜ\˜[Y]\œË˜[œÚ][Û’YKÜ›Ü\Y\ØˆY]Ùˆ	ÔÔÕ	Ëˆ\˜[\ÎˆÂˆÙ^Nˆ\˜[Y]\œËšÙ^KˆÛÜšÙ›ÝÓ˜[YNˆ\˜[Y]\œËÛÜšÙ›ÝÓ˜[YKˆÛÜšÙ›ÝÓ[ÙNˆ\˜[Y]\œËÛÜšÙ›ÝÓ[ÙKˆKˆ]NˆÂˆ‹‹œ\˜[Y]\œËˆ˜[œÚ][Û’Yˆ[™Yš[™YˆÙ^Nˆ[™Yš[™YˆÛÜšÙ›ÝÓ˜[YNˆ[™Yš[™YˆÛÜšÙ›ÝÓ[ÙNˆ[™Yš[™YˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È\]UÛÜšÙ›ÝÕ˜[œÚ][Û”›Ü\J\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ÝÛÜšÙ›ÝËÝ˜[œÚ][ÛœËÉÜ\˜[Y]\œË˜[œÚ][Û’YKÜ›Ü\Y\ØˆY]Ùˆ	ÔU	Ëˆ\˜[\ÎˆÂˆÙ^Nˆ\˜[Y]\œËšÙ^KˆÛÜšÙ›ÝÓ˜[YNˆ\˜[Y]\œËÛÜšÙ›ÝÓ˜[YKˆÛÜšÙ›ÝÓ[ÙNˆ\˜[Y]\œËÛÜšÙ›ÝÓ[ÙKˆKˆ]NˆÂˆ‹‹œ\˜[Y]\œËˆ˜[œÚ][Û’Yˆ[™Yš[™YˆÙ^Nˆ[™Yš[™YˆÛÜšÙ›ÝÓ˜[YNˆ[™Yš[™YˆÛÜšÙ›ÝÓ[ÙNˆ[™Yš[™YˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È[]UÛÜšÙ›ÝÕ˜[œÚ][Û”›Ü\J\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆÜ™\ÝØ\KÌ‹ÝÛÜšÙ›ÝËÝ˜[œÚ][ÛœËÉÜ\˜[Y]\œË˜[œÚ][Û’YKÜ›Ü\Y\ØˆY]Ùˆ	ÑSUIËˆ\˜[\ÎˆÂˆÙ^Nˆ\˜[Y]\œËšÙ^KˆÛÜšÙ›ÝÓ˜[YNˆ\˜[Y]\œËÛÜšÙ›ÝÓ˜[YKˆÛÜšÙ›ÝÓ[ÙNˆ\˜[Y]\œËÛÜšÙ›ÝÓ[ÙKˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBŸB‚˜Û\ÜÈÛÜšÙ›ÝÕ˜[œÚ][Û”[\ÈÂˆÛY[ÂˆÛÛœÝXÝÜŠÛY[
HÂˆ\Ë˜ÛY[HÛY[ÂˆBˆ\Þ[˜ÈÙ]ÛÜšÙ›ÝÕ˜[œÚ][Û”[PÛÛ™šYÝ\˜][ÛœÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹ÝÛÜšÙ›ÝËÜ[KØÛÛ™šYÉËˆY]Ùˆ	ÑÑU	Ëˆ\˜[\ÎˆÂˆÝ\]ˆ\˜[Y]\œËœÝ\]ˆX^™\Ý[Îˆ\˜[Y]\œË›X^™\Ý[Ëˆ\\Îˆ\˜[Y]\œË\\ËˆÙ^\Îˆ\˜[Y]\œËšÙ^\ËˆÛÜšÙ›ÝÓ˜[Y\Îˆ\˜[Y]\œËÛÜšÙ›ÝÓ˜[Y\ËˆÚ]YÜÎˆ\˜[Y]\œËÚ]YÜËˆ˜Yˆ\˜[Y]\œË™˜Yˆ^[™ˆ\˜[Y]\œË™^[™ˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È\]UÛÜšÙ›ÝÕ˜[œÚ][Û”[PÛÛ™šYÝ\˜][ÛœÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹ÝÛÜšÙ›ÝËÜ[KØÛÛ™šYÉËˆY]Ùˆ	ÔU	Ëˆ]NˆÂˆÛÜšÙ›ÝÜÎˆ\˜[Y]\œËÛÜšÙ›ÝÜËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBˆ\Þ[˜È[]UÛÜšÙ›ÝÕ˜[œÚ][Û”[PÛÛ™šYÝ\˜][ÛœÊ\˜[Y]\œËØ[˜XÚÊHÂˆÛÛœÝÛÛ™šYÈHÂˆ\›ˆ	ËÜ™\ÝØ\KÌ‹ÝÛÜšÙ›ÝËÜ[KØÛÛ™šYËÙ[]IËˆY]Ùˆ	ÔU	Ëˆ]NˆÂˆÛÜšÙ›ÝÜÎˆ\˜[Y]\œÏËÛÜšÙ›ÝÜËˆKˆNÂˆ™]\›ˆ\Ë˜ÛY[œÙ[™™\]Y\Ý
ÛÛ™šYËØ[˜XÚÊNÂˆBŸB‚˜Û\ÜÈ™\œÚ[ÛŒÛY[^[™È˜\ÙPÛY[Âˆ[››Ý[˜Ù[Y[˜[›™\ˆH™]È[››Ý[˜Ù[Y[˜[›™\Š\ÊNÂˆ\HH™]È\J\ÊNÂˆ\]TÛXÚY\ÈH™]È\]TÛXÚY\Ê\ÊNÂˆ\XØ][Û”›Û\ÈH™]È\XØ][Û”›Û\Ê\ÊNÂˆ\ZYÜ˜][ÛˆH™]È\ZYÜ˜][ÛŠ\ÊNÂˆ\›Ü\Y\ÈH™]È\›Ü\Y\Ê\ÊNÂˆ]Y]™XÛÜ™ÈH™]È]Y]™XÛÜ™Ê\ÊNÂˆ]˜]\œÈH™]È]˜]\œÊ\ÊNÂˆÛ\ÜÚYšXØ][Û“]™[ÈH™]ÈÛ\ÜÚYšXØ][Û“]™[Ê\ÊNÂˆ\Ú›Ø\™ÈH™]È\Ú›Ø\™Ê\ÊNÂˆ[˜[ZXÓ[Ù[\ÈH™]È[˜[ZXÓ[Ù[\Ê\ÊNÂˆšY[ØÚ[Y\ÈH™]ÈšY[ØÚ[Y\Ê\ÊNÂˆš[\œÈH™]Èš[\œÊ\ÊNÂˆš[\”Ú\š[™ÈH™]Èš[\”Ú\š[™Ê\ÊNÂˆÜ›Ý\[™\Ù\”XÚÙ\ˆH™]ÈÜ›Ý\[™\Ù\”XÚÙ\Š\ÊNÂˆÜ›Ý\ÈH™]ÈÜ›Ý\Ê\ÊNÂˆ\ÜÝYP]XÚY[ÈH™]È\ÜÝYP]XÚY[Ê\ÊNÂˆ\ÜÝYPÛÛ[Y[›Ü\Y\ÈH™]È\ÜÝYPÛÛ[Y[›Ü\Y\Ê\ÊNÂˆ\ÜÝYPÛÛ[Y[ÈH™]È\ÜÝYPÛÛ[Y[Ê\ÊNÂˆ\ÜÝYPÝ\ÝÛQšY[\ÜÛØÚX][ÛœÈH™]È\ÜÝYPÝ\ÝÛQšY[\ÜÛØÚX][ÛœÊ\ÊNÂˆ\ÜÝYPÝ\ÝÛQšY[ÛÛ™šYÝ\˜][Û\ÈH™]È\ÜÝYPÝ\ÝÛQšY[ÛÛ™šYÝ\˜][Û\Ê\ÊNÂˆ\ÜÝYPÝ\ÝÛQšY[ÛÛ^ÈH™]È\ÜÝYPÝ\ÝÛQšY[ÛÛ^Ê\ÊNÂˆ\ÜÝYPÝ\ÝÛQšY[Ü[ÛœÈH™]È\ÜÝYPÝ\ÝÛQšY[Ü[ÛœÊ\ÊNÂˆ\ÜÝYPÝ\ÝÛQšY[Ü[ÛœÐ\ÈH™]È\ÜÝYPÝ\ÝÛQšY[Ü[ÛœÐ\Ê\ÊNÂˆ\ÜÝYPÝ\ÝÛQšY[˜[Y\Ð\ÈH™]È\ÜÝYPÝ\ÝÛQšY[˜[Y\Ð\Ê\ÊNÂˆ\ÜÝYQšY[ÛÛ™šYÝ\˜][ÛœÈH™]È\ÜÝYQšY[ÛÛ™šYÝ\˜][ÛœÊ\ÊNÂˆ\ÜÝYQšY[ÈH™]È\ÜÝYQšY[Ê\ÊNÂˆ\ÜÝYS[šÜÈH™]È\ÜÝYS[šÜÊ\ÊNÂˆ\ÜÝYS[šÕ\\ÈH™]È\ÜÝYS[šÕ\\Ê\ÊNÂˆ\ÜÝYS˜]šYØ]Ü”Ù][™ÜÈH™]È\ÜÝYS˜]šYØ]Ü”Ù][™ÜÊ\ÊNÂˆ\ÜÝYS›ÝYšXØ][Û”ØÚ[Y\ÈH™]È\ÜÝYS›ÝYšXØ][Û”ØÚ[Y\Ê\ÊNÂˆ\ÜÝYTš[Üš]Y\ÈH™]È\ÜÝYTš[Üš]Y\Ê\ÊNÂˆ\ÜÝYT›Ü\Y\ÈH™]È\ÜÝYT›Ü\Y\Ê\ÊNÂˆ\ÜÝYT™YXÝ[ÛˆH™]È\ÜÝYT™YXÝ[ÛŠ\ÊNÂˆ\ÜÝYT™[[ÝS[šÜÈH™]È\ÜÝYT™[[ÝS[šÜÊ\ÊNÂˆ\ÜÝYT™\ÛÛ][ÛœÈH™]È\ÜÝYT™\ÛÛ][ÛœÊ\ÊNÂˆ\ÜÝY\ÈH™]È\ÜÝY\Ê\ÊNÂˆ\ÜÝYTÙX\˜ÚH™]È\ÜÝYTÙX\˜Ú
\ÊNÂˆ\ÜÝYTÙXÝ\š]S]™[H™]È\ÜÝYTÙXÝ\š]S]™[
\ÊNÂˆ\ÜÝYTÙXÝ\š]TØÚ[Y\ÈH™]È\ÜÝYTÙXÝ\š]TØÚ[Y\Ê\ÊNÂˆ\ÜÝYU\T›Ü\Y\ÈH™]È\ÜÝYU\T›Ü\Y\Ê\ÊNÂˆ\ÜÝYU\\ÈH™]È\ÜÝYU\\Ê\ÊNÂˆ\ÜÝYU\TØÚ[Y\ÈH™]È\ÜÝYU\TØÚ[Y\Ê\ÊNÂˆ\ÜÝYU\TØÜ™Y[”ØÚ[Y\ÈH™]È\ÜÝYU\TØÜ™Y[”ØÚ[Y\Ê\ÊNÂˆ\ÜÝYU›Ý\ÈH™]È\ÜÝYU›Ý\Ê\ÊNÂˆ\ÜÝYUØ]Ú\œÈH™]È\ÜÝYUØ]Ú\œÊ\ÊNÂˆ\ÜÝYUÛÜšÛÙÔ›Ü\Y\ÈH™]È\ÜÝYUÛÜšÛÙÔ›Ü\Y\Ê\ÊNÂˆ\ÜÝYUÛÜšÛÙÜÈH™]È\ÜÝYUÛÜšÛÙÜÊ\ÊNÂˆš\˜Q^™\ÜÚ[ÛœÈH™]Èš\˜Q^™\ÜÚ[ÛœÊ\ÊNÂˆš\˜TÙ][™ÜÈH™]Èš\˜TÙ][™ÜÊ\ÊNÂˆœ[H™]È”S
\ÊNÂˆœ[[˜Ý[ÛœÐ\ÈH™]Èœ[[˜Ý[ÛœÐ\Ê\ÊNÂˆX™[ÈH™]ÈX™[Ê\ÊNÂˆXÙ[œÙSY]šXÜÈH™]ÈXÙ[œÙSY]šXÜÊ\ÊNÂˆZYÜ˜][Û“ÙÛÛ›™XÝ[Ù[\ÕÑ›Ü™ÙHH™]ÈZYÜ˜][Û“ÙÛÛ›™XÝ[Ù[\ÕÑ›Ü™ÙJ\ÊNÂˆ^\Ù[ˆH™]È^\Ù[Š\ÊNÂˆ\›Z\ÜÚ[ÛœÈH™]È\›Z\ÜÚ[ÛœÊ\ÊNÂˆ\›Z\ÜÚ[Û”ØÚ[Y\ÈH™]È\›Z\ÜÚ[Û”ØÚ[Y\Ê\ÊNÂˆ[œÈH™]È[œÊ\ÊNÂˆš[Üš]TØÚ[Y\ÈH™]Èš[Üš]TØÚ[Y\Ê\ÊNÂˆ›Ú™XÝ]˜]\œÈH™]È›Ú™XÝ]˜]\œÊ\ÊNÂˆ›Ú™XÝØ]YÛÜšY\ÈH™]È›Ú™XÝØ]YÛÜšY\Ê\ÊNÂˆ›Ú™XÝÛ\ÜÚYšXØ][Û“]™[ÈH™]È›Ú™XÝÛ\ÜÚYšXØ][Û“]™[Ê\ÊNÂˆ›Ú™XÝÛÛ\Û™[ÈH™]È›Ú™XÝÛÛ\Û™[Ê\ÊNÂˆ›Ú™XÝ[XZ[H™]È›Ú™XÝ[XZ[
\ÊNÂˆ›Ú™XÝ™X]\™\ÈH™]È›Ú™XÝ™X]\™\Ê\ÊNÂˆ›Ú™XÝÙ^P[™˜[YU˜[Y][ÛˆH™]È›Ú™XÝÙ^P[™˜[YU˜[Y][ÛŠ\ÊNÂˆ›Ú™XÝ\›Z\ÜÚ[Û”ØÚ[Y\ÈH™]È›Ú™XÝ\›Z\ÜÚ[Û”ØÚ[Y\Ê\ÊNÂˆ›Ú™XÝ›Ü\Y\ÈH™]È›Ú™XÝ›Ü\Y\Ê\ÊNÂˆ›Ú™XÝ›ÛPXÝÜœÈH™]È›Ú™XÝ›ÛPXÝÜœÊ\ÊNÂˆ›Ú™XÝ›Û\ÈH™]È›Ú™XÝ›Û\Ê\ÊNÂˆ›Ú™XÝÈH™]È›Ú™XÝÊ\ÊNÂˆ›Ú™XÝ[\]\ÈH™]È›Ú™XÝ[\]\Ê\ÊNÂˆ›Ú™XÝ\\ÈH™]È›Ú™XÝ\\Ê\ÊNÂˆ›Ú™XÝ™\œÚ[ÛœÈH™]È›Ú™XÝ™\œÚ[ÛœÊ\ÊNÂˆØÜ™Y[œÈH™]ÈØÜ™Y[œÊ\ÊNÂˆØÜ™Y[”ØÚ[Y\ÈH™]ÈØÜ™Y[”ØÚ[Y\Ê\ÊNÂˆØÜ™Y[•X‘šY[ÈH™]ÈØÜ™Y[•X‘šY[Ê\ÊNÂˆØÜ™Y[•XœÈH™]ÈØÜ™Y[•XœÊ\ÊNÂˆÙ\™\’[™›ÈH™]ÈÙ\™\’[™›Ê\ÊNÂˆÙ\šXÙT™YÚ\ÝžHH™]ÈÙ\šXÙT™YÚ\ÝžJ\ÊNÂˆÝ]\ÈH™]ÈÝ]\Ê\ÊNÂˆ\ÚÜÈH™]È\ÚÜÊ\ÊNÂˆX[\Ò[”[ˆH™]ÈX[\Ò[”[Š\ÊNÂˆ[YU˜XÚÚ[™ÈH™]È[YU˜XÚÚ[™Ê\ÊNÂˆZS[ÙYšXØ][ÛœÐ\ÈH™]ÈRS[ÙYšXØ][ÛœÐ\Ê\ÊNÂˆ\Ù\“˜]”›Ü\Y\ÈH™]È\Ù\“˜]”›Ü\Y\Ê\ÊNÂˆ\Ù\”›Ü\Y\ÈH™]È\Ù\”›Ü\Y\Ê\ÊNÂˆ\Ù\œÈH™]È\Ù\œÊ\ÊNÂˆ\Ù\”ÙX\˜ÚH™]È\Ù\”ÙX\˜Ú
\ÊNÂˆÙXšÛÚÜÈH™]ÈÙXšÛÚÜÊ\ÊNÂˆÛÜšÙ›ÝÜÈH™]ÈÛÜšÙ›ÝÜÊ\ÊNÂˆÛÜšÙ›ÝÔØÚ[YQ˜YÈH™]ÈÛÜšÙ›ÝÔØÚ[YQ˜YÊ\ÊNÂˆÛÜšÙ›ÝÔØÚ[YT›Ú™XÝ\ÜÛØÚX][ÛœÈH™]ÈÛÜšÙ›ÝÔØÚ[YT›Ú™XÝ\ÜÛØÚX][ÛœÊ\ÊNÂˆÛÜšÙ›ÝÔØÚ[Y\ÈH™]ÈÛÜšÙ›ÝÔØÚ[Y\Ê\ÊNÂˆÛÜšÙ›ÝÔÝ]\ÐØ]YÛÜšY\ÈH™]ÈÛÜšÙ›ÝÔÝ]\ÐØ]YÛÜšY\Ê\ÊNÂˆÛÜšÙ›ÝÔÝ]\Ù\ÈH™]ÈÛÜšÙ›ÝÔÝ]\Ù\Ê\ÊNÂˆÛÜšÙ›ÝÕ˜[œÚ][Û”›Ü\Y\ÈH™]ÈÛÜšÙ›ÝÕ˜[œÚ][Û”›Ü\Y\Ê\ÊNÂˆÛÜšÙ›ÝÕ˜[œÚ][Û”[\ÈH™]ÈÛÜšÙ›ÝÕ˜[œÚ][Û”[\Ê\ÊNÂŸB‚‹ÊŠ‚ˆ
ˆÜ˜\\ˆ\›Ý[™Hš\˜KšœÈ™\œÚ[ÛŒÛY[›Üˆš\˜HTH[\˜XÝ[ÛœË‚ˆ
ˆ›ÝšY\ÈY]ÙÈ›Üˆ™]Ú[™È\ÜÝY\Ë™]šY]š[™È˜[œÚ][ÛœË[™˜[œÚ][Ûš[™È\ÜÝY\Ë‚ˆ
‹Â˜Û\ÜÈš\˜HÂˆÊŠˆH˜\ÙHT“ÙˆHš\˜H[œÝ[˜ÙH
K™Ë‹Î‹ËØÛÛ\[žK˜]\ÜÚX[‹›™]
H
‹Âˆ˜\ÙU\›ÂˆÊŠˆHTHÚÙ[ˆ\ÙY›Üˆ]][XØ][Ûˆ
‹ÂˆÚÙ[ŽÂˆÊŠˆH[XZ[Y™\ÜÈ\ÜÛØÚX]YÚ]Hš\˜HXØÛÝ[
‹Âˆ[XZ[ÂˆÊŠˆHš\˜KšœÈ™\œÚ[ÛŒÛY[[œÝ[˜ÙH›ÜˆXZÚ[™ÈTHØ[È
‹ÂˆÛY[ÂˆÊŠ‚ˆ
ˆÜ™X]\ÈH™]Èš\˜HÛY[[œÝ[˜ÙK‚ˆ
ˆ\˜[HÛÛ™ˆHÛÛ™šYÝ\˜][ÛˆØš™XÝÛÛZ[š[™Èš\˜HÛÛ›™XÝ[Ûˆ]Z[Âˆ
‹ÂˆÛÛœÝXÝÜŠÛÛ™ŠHÂˆ\Ë˜˜\ÙU\›HÛÛ™‹˜˜\ÙU\›Âˆ\ËÚÙ[ˆHÛÛ™‹ÚÙ[ŽÂˆ\Ë™[XZ[HÛÛ™‹™[XZ[Âˆ\Ë˜ÛY[H™]È™\œÚ[ÛŒÛY[
ÂˆÜÝˆ\Ë˜˜\ÙU\›ˆ]][XØ][ÛŽˆÂˆ˜\ÚXÎˆÂˆ[XZ[ˆ\Ë™[XZ[ˆ\UÚÙ[Žˆ\ËÚÙ[‹ˆKˆKˆJNÂˆBˆÊŠ‚ˆ
ˆ™]Ú\ÈHš\˜H\ÜÝYHžH]ÈQÜˆÙ^K‚ˆ
ˆ\˜[H\ÜÝYRYHH\ÜÝYHQÜˆÙ^H
K™Ë‹”“Ò‹LLŒÈŠBˆ
ˆ\˜[H]Y\žHHÜ[Û˜[]Y\žH\˜[Y]\œÈÈÝ\ÝÛZ^™HH™\ÜÛœÙBˆ
ˆ\˜[H]Y\žK™šY[ÈH\œ˜^HÙˆšY[˜[Y\ÈÈ[˜ÛYH[ˆH™\ÜÛœÙBˆ
ˆ\˜[H]Y\žK™^[™HÛÛ[XK\Ù\\˜]Y\ÝÙˆ[]Y\ÈÈ^[™ˆ
ˆ™]\›œÈH™\]Y\ÝYš\˜H\ÜÝYBˆ
ˆ›ÝÜÈ\œ›ÜˆYˆH\ÜÝYHÙ\È›Ý^\ÝÜˆH™\]Y\Ý˜Z[Âˆ
‹Âˆ\Þ[˜ÈÙ]\ÜÝYJ\ÜÝYRY]Y\žJHÂˆÛÛœÝ\˜[\ÈHÂˆ\ÜÝYRYÜ’Ù^Nˆ\ÜÝYRYˆNÂˆYˆ
]Y\žHOH[
HÂˆ\˜[\Ë™šY[ÈH]Y\žK™šY[ÈÏÈ×NÂˆ\˜[\Ë™^[™H]Y\žK™^[™ÏÈ[™Yš[™YÂˆBˆ™]\›ˆ\Ë˜ÛY[š\ÜÝY\Ë™Ù]\ÜÝYJ\˜[\ÊNÂˆBˆÊŠ‚ˆ
ˆ™]šY]™\È]˜Z[X›HÛÜšÙ›ÝÈ˜[œÚ][ÛœÈ›ÜˆHš\˜H\ÜÝYK‚ˆ
ˆ\˜[H\ÜÝYRYHH\ÜÝYHQÜˆÙ^H
K™Ë‹”“Ò‹LLŒÈŠBˆ
ˆ™]\›œÈH]˜Z[X›H˜[œÚ][ÛœÈ›ÜˆH\ÜÝYBˆ
ˆ›ÝÜÈ\œ›ÜˆYˆH\ÜÝYHÙ\È›Ý^\ÝÜˆH™\]Y\Ý˜Z[Âˆ
‹Âˆ\Þ[˜ÈÙ]\ÜÝYU˜[œÚ][ÛœÊ\ÜÝYRY
HÂˆÛÛœÝ\˜[\ÈHÂˆ\ÜÝYRYÜ’Ù^Nˆ\ÜÝYRYˆNÂˆ™]\›ˆ\Ë˜ÛY[š\ÜÝY\Ë™Ù]˜[œÚ][ÛœÊ\˜[\ÊNÂˆBˆÊŠ‚ˆ
ˆ˜[œÚ][ÛœÈHš\˜H\ÜÝYHÈH™]ÈÛÜšÙ›ÝÈÝ]K‚ˆ
ˆ\˜[H\ÜÝYRYHH\ÜÝYHQÜˆÙ^H
K™Ë‹”“Ò‹LLŒÈŠBˆ
ˆ\˜[H]HHH˜[œÚ][Ûˆ]H[˜ÛY[™ÈH\™Ù]˜[œÚ][ÛˆQˆ
ˆ™]\›œÈ[ˆ[\HØš™XÝÛˆÝXØÙ\ÜÂˆ
ˆ›ÝÜÈ\œ›ÜˆYˆH˜[œÚ][Ûˆ\È[˜[YÜˆH™\]Y\Ý˜Z[Âˆ
‹Âˆ\Þ[˜È˜[œÚ][Û’\ÜÝYJ\ÜÝYRY]JHÂˆÛÛœÝ\˜[\ÈHÂˆ\ÜÝYRYÜ’Ù^Nˆ\ÜÝYRYˆ˜[œÚ][ÛŽˆ]KˆNÂˆ™]\›ˆ\Ë˜ÛY[š\ÜÝY\Ë™Õ˜[œÚ][ÛŠ\˜[\ÊNÂˆBŸB‚‹ÊŠ‚ˆ
ˆXZ[ˆXÝ[ÛˆÛ\ÜÈ]Ü˜Ú\Ý˜]\Èš\˜H\ÜÝYH˜[œÚ][ÛœÈ˜\ÙYÛˆÚ]Xˆ]™[Ë‚ˆ
‚ˆ
ˆ\ÈÛ\ÜÈX[˜YÙ\ÈHÛÜšÙ›ÝÈÙˆ˜[œÚ][Ûš[™È][\Hš\˜H\ÜÝY\È[ˆ\˜[[ˆ
ˆ\Ú[™ÈÛÛ™šYÝ\˜][Ûˆœ›ÛHHXÝ[Ûˆ[œ]È[™HÚ]Xˆ]™[ÛÛ^È]\›Z[™Bˆ
ˆ\™Ù]Ý]\Ë‚ˆ
‹Â˜Û\ÜÈXÝ[ÛˆÂˆÊŠˆš\˜HTHÛY[[œÝ[˜ÙH›ÜˆXZÚ[™ÈTHØ[È
‹Âˆš\˜NÂˆÊŠˆÛÛ™šYÝ\˜][Ûˆ›ÜˆÛÛ›™XÝ[™ÈÈš\˜H
˜\ÙU\›ÚÙ[‹[XZ[
H
‹ÂˆÛÛ™šYÎÂˆÊŠˆ\œÙYXÝ[Ûˆ\™Ý[Y[È[˜ÛY[™È\ÜÝY\È\Ý[™˜[œÚ][ÛˆÛÛ™šYÝ\˜][Ûˆ
‹Âˆ\™ÝŽÂˆÊŠˆÚ]Xˆ]™[ÛÛ^›ÝšY[™È[™›Ü›X][ÛˆX›Ý]HšYÙÙ\š[™È]™[
‹ÂˆÚ]X‘]™[ÂˆÊŠ‚ˆ
ˆÜ™X]\ÈH™]ÈXÝ[Ûˆ[œÝ[˜ÙK‚ˆ
‚ˆ
ˆ\˜[HÚ]X‘]™[HHÚ]XˆXÝ[ÛœÈÛÛ^ÛÛZ[š[™È]™[[™›Ü›X][Û‚ˆ
ˆ\˜[H\™ÝˆH\œÙYXÝ[Ûˆ\™Ý[Y[È[˜ÛY[™Èš\˜HÛÛ™šYÝ\˜][Ûˆ[™\ÜÝYH\Ýˆ
‹ÂˆÛÛœÝXÝÜŠÚ]X‘]™[\™ÝŠHÂˆ\Ëšš\˜HH™]Èš\˜JÂˆ˜\ÙU\›ˆ\™Ý‹˜ÛÛ™šYË˜˜\ÙU\›ˆÚÙ[Žˆ\™Ý‹˜ÛÛ™šYËÚÙ[‹ˆ[XZ[ˆ\™Ý‹˜ÛÛ™šYË™[XZ[ˆJNÂˆ\Ë˜ÛÛ™šYÈH\™Ý‹˜ÛÛ™šYÎÂˆ\Ë˜\™ÝˆH\™ÝŽÂˆ\Ë™Ú]X‘]™[HÚ]X‘]™[ÂˆBˆÊŠ‚ˆ
ˆ˜[œÚ][ÛœÈHÚ[™ÛHš\˜H\ÜÝYHÈ]È\™Ù]Ý]K‚ˆ
‚ˆ
ˆ][\ÈÈ˜[œÚ][ÛˆH\ÜÝYH[™™]\›œÈHÝ]]]HÛˆÝXØÙ\ÜË‚ˆ
ˆÛˆ˜Z[\™KÙÜÈH\œ›Üˆ
Üˆ˜Z[ÈHXÝ[ÛˆYˆ˜Z[Û‘\œ›Üˆ\È[˜X›Y
Bˆ
ˆ[™™]\›œÈ[™Yš[™Y‚ˆ
‚ˆ
ˆ\˜[H\ÜÝYSØšˆHH\ÜÝYH[œÝ[˜ÙHÈ˜[œÚ][Û‚ˆ
ˆ™]\›œÈH\ÜÝYHÝ]]]HYˆÝXØÙ\ÜÙ[[™Yš[™YYˆH˜[œÚ][Ûˆ˜Z[Yˆ
‹Âˆ\Þ[˜È˜[œÚ][Û’\ÜÝYJ\ÜÝYSØšŠHÂˆ™]\›ˆ\ÜÝYSØš‚ˆ˜[œÚ][ÛŠ
Bˆ[Š\Þ[˜È

HOˆÂˆ™]\›ˆ\ÜÝYSØš‹™Ù]Ý]]Ê
NÂˆJBˆ˜Ø]Ú

\œ›ÜŠHOˆÂˆYˆ
\œ›Üˆ[œÝ[˜Ù[Ùˆ\œ›ÜŠHÂˆYˆ
\Ë˜\™Ý‹™˜Z[Û‘\œ›ÜŠHÂˆÙ]˜Z[Y
\œ›ÜŠNÂˆBˆ[ÙHÂˆØ\›š[™Ê˜Z[YÈ˜[œÚ][Ûˆ\ÜÝYH	Ú\ÜÝYSØš‹š\ÜÝY_Nˆ	Ù\œ›Ü‹›Y\ÜØYÙ_X
NÂˆBˆBˆ™]\›ˆ[™Yš[™YÂˆJNÂˆBˆÊŠ‚ˆ
ˆ^XÝ]\ÈHXÝ[ÛˆžH›ØÙ\ÜÚ[™È[ÜXÚYšYYš\˜H\ÜÝY\Ë‚ˆ
‚ˆ
ˆ\œÙ\ÈHÛÛ[XK\Ù\\˜]Y\ÜÝYH\ÝZ[È\ÜÝYHØš™XÝÈ›ÜˆXXÚˆ
ˆ[™˜[œÚ][ÛœÈ[H[ˆ\˜[[ˆ™\ÜÈÝXØÙ\ÜËÙ˜Z[\™HÛÝ[È[™ˆ
ˆÙ]ÈHXÝ[ÛˆÝ]]Ú]H™\Ý[Ë‚ˆ
‚ˆ
ˆ™]\›œÈYHYˆ]X\ÝÛ™H\ÜÝYHØ\È›ØÙ\ÜÙYÝXØÙ\ÜÙ[K[˜ÛY[™È[˜Ú[™ÙY\ÜÝY\Âˆ
‹Âˆ\Þ[˜È^XÝ]J
HÂˆÛÛœÝÈ\™Ý‹š\˜KÚ]X‘]™[HH\ÎÂˆÛÛœÝ\ÜÝYS\ÝH\™Ý‹š\ÜÝY\ËœÜ]
	Ë	ÊNÂˆ]ÝXØÙ\ÜÙ\ÈHÂˆ]˜Z[\™\ÈHÂˆÛÛœÝ\R\ÜÝYS\ÝH×NÂˆ›Üˆ
ÛÛœÝ\ÜÝYRÙ^HÙˆ\ÜÝYS\Ý
HÂˆÛÛœÝ›Ü›X[^™YÙ^HH\ÜÝYRÙ^Kš[J
NÂˆ\R\ÜÝYS\Ýœ\Ú
™]È\ÜÝYJ›Ü›X[^™YÙ^Kš\˜K\™Ý‹Ú]X‘]™[
Bˆ˜Z[

Bˆ[Š\Þ[˜È
\ÜÝYSØšŠHOˆ\Ë˜[œÚ][Û’\ÜÝYJ\ÜÝYSØšŠJBˆ˜Ø]Ú

\œ›ÜŠHOˆÂˆËÈ[™H\œ›ÜœÈœ›ÛHZ[

H
K™Ë‹\ÜÝYH›Ý›Ý[™
BˆYˆ
\œ›Üˆ[œÝ[˜Ù[Ùˆ\œ›ÜŠHÂˆYˆ
\™Ý‹™˜Z[Û‘\œ›ÜŠHÂˆÙ]˜Z[Y
˜Z[YÈ›ØÙ\ÜÈ\ÜÝYH	Û›Ü›X[^™YÙ^_Nˆ	Ù\œ›Ü‹›Y\ÜØYÙ_X
NÂˆBˆ[ÙHÂˆØ\›š[™Ê˜Z[YÈ›ØÙ\ÜÈ\ÜÝYH	Û›Ü›X[^™YÙ^_Nˆ	Ù\œ›Ü‹›Y\ÜØYÙ_X
NÂˆBˆBˆ™]\›ˆ[™Yš[™YÂˆJJNÂˆBˆÛÛœÝ\ÜÝYSÝ]]ÈH]ØZ]›ÛZ\ÙK˜[
\R\ÜÝYS\Ý
K[Š
S\Ý
HOˆS\Ý™š[\Š›ÛÛX[ŠJNÂˆ˜Z[\™\ÈH\ÜÝYS\Ý›[™ÝH\ÜÝYSÝ]]Ë›[™ÝÂˆÝXØÙ\ÜÙ\ÈH\ÜÝYSÝ]]Ë›[™ÝÂˆ[™›ÊÝXØÙ\ÜÙ\Îˆ	ÜÝXØÙ\ÜÙ\ßH˜Z[\™\Îˆ	Ù˜Z[\™\ßX
NÂˆÙ]Ý]]
	Ú\ÜÝYSÝ]]ÉË”ÓÓ‹œÝš[™ÚYžJ\ÜÝYSÝ]]ÊJNÂˆ™]\›ˆÝXØÙ\ÜÙ\ÈˆÂˆBŸB‚‹ÊŠ‚ˆ
ˆ™]šY]™\È[™˜[Y]\È[™\]Z\™Y[œ]È›ÜˆHÚ]XˆXÝ[Û‹‚ˆ
‚ˆ
ˆÛÛXÝÈš\˜H]][XØ][ÛˆÛÛ™šYÝ\˜][Ûˆœ›ÛH[š\›Û›Y[˜\šXX›\ÈÜˆXÝ[Ûˆ[œ]Ëˆ
ˆ˜[Y]\È]™\]Z\™Y˜[Y\È\™H™\Ù[[™\ÜÙ[X›\ÈHÛÛ\]H\™Ý[Y[ÈØš™XÝˆ
ˆ™YYYÈ[ˆHXÝ[Û‹‚ˆ
‚ˆ
ˆ™]\›œÈH˜[Y]YXÝ[Ûˆ\™Ý[Y[ÈÛÛZ[š[™Èš\˜HÛÛ™šYË\ÜÝYHÙ^\Ë[™Ù][™ÜÂˆ
ˆ›ÝÜÈÑ\œ›ÜŸHÚ[ˆ’TWÐTÑWÕT“\È›ÝYš[™Y[ˆ[š\›Û›Y[ÜˆXÝ[Ûˆ[œ]Âˆ
ˆ›ÝÜÈÑ\œ›ÜŸHÚ[ˆ’TWÐTWÕÒÑSˆ\È›ÝYš[™Y[ˆ[š\›Û›Y[ÜˆXÝ[Ûˆ[œ]Âˆ
ˆ›ÝÜÈÑ\œ›ÜŸHÚ[ˆ’TWÕTÑT—ÑSPRS\È›ÝYš[™Y[ˆ[š\›Û›Y[ÜˆXÝ[Ûˆ[œ]Âˆ
ˆ›ÝÜÈÑ\œ›ÜŸHÚ[ˆÒUP—ÕÓÔ’ÔÔPÑH[š\›Û›Y[˜\šXX›H\È›ÝYš[™Yˆ
‹Â™[˜Ý[ÛˆÙ][œ]Ê
HÂˆÛÛœÝ™\Ý[HßNÂˆÛÛœÝš\˜PÛÛ™šYÈHßNÂˆš\˜PÛÛ™šYË˜˜\ÙU\›H›ØÙ\ÜË™[‹’’TWÐTÑWÕT“ÏÈÙ][œ]
	Úš\˜WØ˜\ÙWÝ\›	ÊHÏÈ[ÂˆYˆ
Zš\˜PÛÛ™šYË˜˜\ÙU\›
HÂˆ›ÝÈ™]È\œ›ÜŠ	Ò’TWÐTÑWÕT“[ˆ›ÝYš[™YÜˆÝ\YY\ÈXÝ[Ûˆ[œ]š\˜WØ˜\ÙWÝ\›	ÊNÂˆBˆš\˜PÛÛ™šYËÚÙ[ˆH›ØÙ\ÜË™[‹’’TWÐTWÕÒÑSˆÏÈÙ][œ]
	Úš\˜WØ\WÝÚÙ[‰ÊHÏÈ[ÂˆYˆ
Zš\˜PÛÛ™šYËÚÙ[ŠHÂˆ›ÝÈ™]È\œ›ÜŠ	Ò’TWÐTWÕÒÑSˆ[ˆ›ÝYš[™YÜˆÝ\YY\ÈXÝ[Ûˆ[œ]š\˜WØ\WÝÚÙ[‰ÊNÂˆBˆš\˜PÛÛ™šYË™[XZ[H›ØÙ\ÜË™[‹’’TWÕTÑT—ÑSPRSÏÈÙ][œ]
	Úš\˜WÝ\Ù\—Ù[XZ[	ÊHÏÈ[ÂˆYˆ
Zš\˜PÛÛ™šYË™[XZ[
HÂˆ›ÝÈ™]È\œ›ÜŠ	Ò’TWÕTÑT—ÑSPRS[ˆ›ÝYš[™YÜˆÝ\YY\ÈXÝ[Ûˆ[œ]š\˜WÝ\Ù\—Ù[XZ[	ÊNÂˆBˆ™\Ý[˜ÛÛ™šYÈHš\˜PÛÛ™šYÎÂˆ™\Ý[š\ÜÝY\ÈHÙ][œ]
	Ú\ÜÝY\ÉÊNÂˆ™\Ý[™˜Z[Û‘\œ›ÜˆHÙ][œ]
	Ù˜Z[ÛÛ—Ù\œ›Ü‰ÊHOOH	ÝYIÎÂˆXYÊ\ÜÝY\ÈH	Ü™\Ý[š\ÜÝY\ßX
NÂˆËÈÚ]XˆÛÜšÜÜXÙBˆ]Ú]X•ÛÜšÜÜXÙT]H›ØÙ\ÜË™[‹‘ÒUP—ÕÓÔ’ÔÔPÑNÂˆYˆ
YÚ]X•ÛÜšÜÜXÙT]
HÂˆ›ÝÈ™]È\œ›ÜŠ	ÑÒUP—ÕÓÔ’ÔÔPÑH›ÝYš[™Y	ÊNÂˆBˆÚ]X•ÛÜšÜÜXÙT]H]œ™\ÛÛ™JÚ]X•ÛÜšÜÜXÙT]
NÂˆXYÊÒUP—ÕÓÔ’ÔÔPÑHH	ÉÙÚ]X•ÛÜšÜÜXÙT]IØ
NÂˆ\™XÝÜžQ^\ÝÔÞ[˜ÊÚ]X•ÛÜšÜÜXÙT]
NÂˆ™\Ý[šš\˜U˜[œÚ][ÛœÖX[[HÙ][œ]
	Úš\˜WÝ˜[œÚ][Ûœ×ÞX[[	ÊNÂˆXYÊš\˜H˜[œÚ][ÛœÈPSS[œ]ˆ‰Ü™\Ý[šš\˜U˜[œÚ][ÛœÖX[[X
NÂˆ™]\›ˆ™\Ý[ÂŸB‚˜\Þ[˜È[˜Ý[Ûˆ^XÊ
HÂˆ]ØZ]™]ÈXÝ[ÛŠÛÛ^Ù][œ]Ê
JK™^XÝ]J
NÂŸB™^XÊ
K˜Ø]Ú

\œ›ÜŠHOˆÂˆÙ]˜Z[Y
\œ›ÜŠNÂŸJNÂ‹ËÈÈÛÝ\˜ÙSX\[™ÕT“Z[™^šœË›X\