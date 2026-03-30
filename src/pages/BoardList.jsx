import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export default function BoardList() {
  const navigate = useNavigate()

  const [boards, setBoards] = useState(() => {
    try {
      const saved = localStorage.getItem('boards_index')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  useEffect(() => {
    localStorage.setItem('boards_index', JSON.stringify(boards))
  }, [boards])

  const createBoard = () => {
    const newBoard = {
      id: crypto.randomUUID(),
      title: `ボード ${boards.length + 1}`,
      createdAt: new Date().toISOString(),
    }
    localStorage.setItem(
      `board_${newBoard.id}`,
      JSON.stringify({ notes: [], connections: [] })
    )
    setBoards((prev) => [...prev, newBoard])
  }

  const deleteBoard = (e, id) => {
    e.stopPropagation()
    if (!window.confirm('このボードを削除してもよろしいですか？')) return
    localStorage.removeItem(`board_${id}`)
    setBoards((prev) => prev.filter((b) => b.id !== id))
  }

  return (
    <div className="board-list-page">
      <div className="board-list-header">
        <h1>📋 マイボード</h1>
        <button className="btn-primary" onClick={createBoard}>
          ＋ 新規作成
        </button>
      </div>

      <ul className="board-list">
        {boards.map((board) => (
          <li
            key={board.id}
            className="board-list-item"
            onClick={() => navigate(`/board/${board.id}`)}
          >
            <span className="board-title">📌 {board.title}</span>
            <button
              className="btn-delete"
              onClick={(e) => deleteBoard(e, board.id)}
            >
              🗑️
            </button>
          </li>
        ))}
      </ul>

      {boards.length === 0 && (
        <p className="empty-message">
          ボードがありません。
          <br />
          「＋ 新規作成」ボタンでボードを作りましょう！
        </p>
      )}
    </div>
  )
}
