import { BrowserRouter, Routes, Route } from 'react-router-dom'
import BoardList from './pages/BoardList'
import BoardView from './pages/BoardView'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<BoardList />} />
        <Route path="/board/:boardId" element={<BoardView />} />
      </Routes>
    </BrowserRouter>
  )
}
