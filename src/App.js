import React, { useCallback, useEffect, useRef } from 'react';
import socketIOClient from 'socket.io-client';

import './App.scss';

const ENDPOINT = 'http://127.0.0.1:5000'; // TODO: move to property file

const App = () => {
  const urlRef = useRef();
  const socketRef = useRef();

  useEffect(() => {
    socketRef.current = socketIOClient(ENDPOINT);
    socketRef.current.on('scan-progress', progress => {
      console.log(progress);
    });

    return () => socketRef.current.disconnect();
  }, []);

  const handleScanStart = useCallback(e => {
    e.preventDefault();
    socketRef.current.emit('url-scanned', urlRef.current.value);
  }, []);

  return (
    <div className="App">
      <form onSubmit={handleScanStart}>
        <p>
          Provide URL to scan:
        </p>
        <input type="url" name="url" placeholder="http://www.example.com" ref={urlRef}></input>
        <button className="start">Start</button>
      </form>
    </div>
  );
}

export default App;
