import { CityCopy } from './components/CityCopy'
import { SolarStepper } from './components/SolarStepper'
import { Stage } from './components/Stage'
import { TOTAL_STATES } from './data/cities'

export default function App() {
  return (
    <>
      <div className="sky" aria-hidden="true" />
      <Stage />
      <div className="grain" aria-hidden="true" />
      <main className="overlay">
        <h1 className="title">One Turning World</h1>
        <CityCopy />
        <SolarStepper />
      </main>
      {/* Scroll track: one viewport-sized step per scroll state. */}
      <div className="track" style={{ height: `calc(${TOTAL_STATES} * 120svh + 100svh)` }} aria-hidden="true" />
    </>
  )
}
