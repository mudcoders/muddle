var React = require('react');
var ReactDOM = require('react-dom');
var Net = require('net');
var createReactClass = require('create-react-class');

var MuddleOutputLine = createReactClass({
    shouldComponentUpdate: function() {
        return true;//!this.lineIsFinalized();
    },
    lineIsFinalized: function() {
        return !this.props.line.finalized;
    },
    ansiToHtml: function(rawInput) {
        var ESC = String.fromCharCode(27);

        var output = rawInput
            .replace(new RegExp(ESC + '\\[(0;)?0m', 'g'), '<font class="reset">')
            .replace(new RegExp(ESC + '\\[(0;)?0;30m', 'g'), '<font class="black">')
            .replace(new RegExp(ESC + '\\[(0;)?0;31m', 'g'), '<font class="red">')
            .replace(new RegExp(ESC + '\\[(0;)?0;32m', 'g'), '<font class="green">')
            .replace(new RegExp(ESC + '\\[(0;)?0;33m', 'g'), '<font class="yellow">')
            .replace(new RegExp(ESC + '\\[(0;)?0;34m', 'g'), '<font class="blue">')
            .replace(new RegExp(ESC + '\\[(0;)?0;35m', 'g'), '<font class="magenta">')
            .replace(new RegExp(ESC + '\\[(0;)?0;36m', 'g'), '<font class="cyan">')
            .replace(new RegExp(ESC + '\\[(0;)?0;37m', 'g'), '<font class="lightgrey">')
            .replace(new RegExp(ESC + '\\[(0;)?1;30m', 'g'), '<font class="grey">')
            .replace(new RegExp(ESC + '\\[(0;)?1;31m', 'g'), '<font class="lightred">')
            .replace(new RegExp(ESC + '\\[(0;)?1;32m', 'g'), '<font class="lightgreen">')
            .replace(new RegExp(ESC + '\\[(0;)?1;33m', 'g'), '<font class="lightyellow">')
            .replace(new RegExp(ESC + '\\[(0;)?1;34m', 'g'), '<font class="lightblue">')
            .replace(new RegExp(ESC + '\\[(0;)?1;35m', 'g'), '<font class="lightmagenta">')
            .replace(new RegExp(ESC + '\\[(0;)?1;36m', 'g'), '<font class="lightcyan">')
            .replace(new RegExp(ESC + '\\[(0;)?1;37m', 'g'), '<font class="white">')
            ;

        var amountOfColors = (output.match(/<font/g) || []).length;

        // close out any open colors
        for (var x = 0; x < amountOfColors; x++) {
            output += '</font>';
        }

        return output;
    },
    getHtml: function() {
        return {
            __html: this.props.line ? this.ansiToHtml(this.props.line.message) : ''
        };
    },
    render: function() {
        return React.createElement('span', {
            dangerouslySetInnerHTML: this.getHtml(),
            key: this.props.line ? this.props.line.id : Math.random(),
        }, null); //, this.props.line ? this.props.line.message : '');
    }
});

var Muddle = createReactClass({
    connect: function(hostname, port) {
        this.socket = Net.connect(port, hostname, this.onConnect);
        this.socket.on('data', this.onSocketData);
        this.socket.on('end', this.onSocketDisconnect);
        this.echo = true;
    },
    onConnect: function(conn) {
      console.log("READY TO ROCK AND ROLL!");
    },
    onSocketData: function(data) {
        this.executeCommands(data);
        this.handleOutput(data.toString());
    },
    onSocketDisconnect: function() {
        var self = this;
        this.handleOutput("** You have been disconnected.\n")
        this.handleOutput("** Reconnecting in " + this.state.reconnectSeconds + " seconds.\n")
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = setTimeout(function() {
            self.connect(self.state.hostname, self.state.port);
        }, this.state.reconnectSeconds * 1000);
    },
    executeCommands: function(data) {
      var ECHO = 1;
      var IAC  = 255;
      var WILL = 251;
      var WONT = 252;

      var self = this;

      data.forEach(function(character, index) {
        if ( character == IAC && !!data[index + 2] ) {
          if ( data[index + 2] == ECHO ) {
            switch ( data[ index + 1 ] ) {
              case WILL:
                self.echo = false;
                break;
              case WONT:
                self.echo = true;
                break;
              default:
                // unsupported command
                console.log("Unsupported command: " + data[index + 1]);
                break;
            }
          }
        }
      });
    },
    handleOutput: function(message) {
        // strip unrenderable characters
        message = message.replace(/[^\x00-\x7E]/g, '');

        // completely drop CR newlines
        message = message.replace(/\r/g, '')

        // convert LF newlines to breaks
        message = message.replace(/\n/g, '<br />');

        // can't have an empty line, per-se
        if ( !message ) {
            message = ' ';
        }

        this.uniqueId++;

        this.state.output.push({
            id: this.uniqueId,
            message: message,
        });

        this.setState({
            output: this.state.output
        });
    },
    handleInput: function(message) {
        this.socket.write(message + '\n');
    },
    componentDidMount: function() {
        this.output = [];
        this.uniqueId = 0;
        this.connect(this.state.hostname, this.state.port);
    },
    renderLines: function(lines) {
        if (!lines) {
            return [];
        }
        return lines.map(function(line) {
            return React.createElement(MuddleOutputLine, { line: line });
        });
    },
    getInitialState: function() {
        return {
            hostname: 'oasis.mudcoders.com',
            port: 1234,
            reconnectSeconds: 2,
            output: [],
            inputMessage: '',
            inputMessageHistory: [],
            inputHistoryLines: 10
        };
    },
    handleKeyDown: function(e) {
        // don't render the newline in the input field
        if (e.keyCode === 13) {
          e.preventDefault();
          this.submitInput(e);
        }
    },
    submitInput: function(e) {
      var message = this.refs.input.textContent;

      this.resetInput();

      if ( this.echo ) {
        this.handleOutput(' ' + message + '\n');
      } else {
        this.handleOutput('\n');
      }

      this.handleInput(message);
    },
    focusInput: function() {
        this.refs.input.focus();
    },
    resetInput: function() {
        this.refs.input.textContent = "";
    },
    componentDidUpdate() {
        var elem = this.refs.outputWindow;

        if ( !elem ) {
            return;
        }

        elem.scrollTop = elem.scrollHeight;
        this.focusInput();
    },
    render: function() {
        return React.createElement('div', { className: 'muddle', onClick: this.focusInput, onKeyDown: this.focusInput }, [
            React.createElement('table', { key: Math.random(), className: 'main-frame' }, [
                React.createElement('tbody', { key: Math.random() }, [
                    React.createElement('tr', { key: Math.random(), className: 'titlebar' }, [
                        React.createElement('td', { key: Math.random(), colSpan: 2}, null)
                    ]),
                    React.createElement('tr', { key: Math.random(), className: 'output-window' }, [
                        React.createElement('td', { key: Math.random(), colSpan: 2}, [
                            React.createElement('div', { key: Math.random(), ref: 'outputWindow', id: 'output' }, [
                                this.renderLines(this.state.output),
                            ])
                        ])
                    ]),
                    React.createElement('tr', { key: Math.random(), className: 'input-window' }, [
                        React.createElement('td', { key: Math.random() }, [
                          React.createElement('div', { key: Math.random(), contentEditable: true, className: 'input' + (this.echo ? '' : ' password'), ref: 'input', onKeyDown: this.handleKeyDown })
                        ]),
                        React.createElement('td', { key: Math.random(), width: '150px' }, [
                            React.createElement('div', { key: Math.random(), className: 'button', ref: 'submit', onClick: this.submitInput }, 'Send')
                        ])
                    ])
                ])
            ])
        ]);
    }
});

ReactDOM.render(React.createElement(Muddle), document.getElementById('muddle'));
