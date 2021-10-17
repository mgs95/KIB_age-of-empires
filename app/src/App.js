import { useRef, useEffect } from 'react';
import { init } from './viz/viz';
import './App.css';

const WIDTH = 1200;
const HEIGHT = 800;

function App() {
  const svgRef = useRef(null);

  useEffect(() => {
    if (svgRef.current) {
      init(svgRef.current, {
        width: WIDTH,
        height: HEIGHT,
      });
    }
  }, [svgRef]);

  return (
    <div className='App'>
      <div className='viz'>
        <svg ref={svgRef} width={WIDTH} height={HEIGHT}></svg>
      </div>
    </div>
  );
}

export default App;
