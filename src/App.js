import React, { useCallback, useRef }from 'react';
import './App.scss';

const App = () => {
  const urlRef = useRef();
  const handleScanStart = useCallback(async e => {
    e.preventDefault();
    const url = urlRef.current.value;
    console.log(`URL: ${url}`);

    try {
      const response = await fetch('http://localhost:5000/scanURL', {
        method: 'POST',
        body: JSON.stringify({ url })
      });

      if (response.status === 200) {
        const scanTree = await response.text();
        console.log(JSON.parse(scanTree));
      }
    }
    catch(e) {
      console.log(e);
    }
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
