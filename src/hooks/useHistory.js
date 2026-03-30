import { useReducer, useCallback } from 'react'

function historyReducer(state, action) {
  switch (action.type) {
    case 'PUSH':
      return {
        past: [...state.past, state.present],
        present: action.payload,
        future: [],
      }
    case 'SET':
      return {
        ...state,
        present: action.payload,
      }
    case 'UNDO': {
      if (state.past.length === 0) return state
      const previous = state.past[state.past.length - 1]
      return {
        past: state.past.slice(0, -1),
        present: previous,
        future: [state.present, ...state.future],
      }
    }
    case 'REDO': {
      if (state.future.length === 0) return state
      const next = state.future[0]
      return {
        past: [...state.past, state.present],
        present: next,
        future: state.future.slice(1),
      }
    }
    default:
      return state
  }
}

export default function useHistory(initialState) {
  const [history, dispatch] = useReducer(historyReducer, {
    past: [],
    present: initialState,
    future: [],
  })

  const pushState = useCallback(
    (newState) => dispatch({ type: 'PUSH', payload: newState }),
    []
  )
  const setState = useCallback(
    (newState) => dispatch({ type: 'SET', payload: newState }),
    []
  )
  const undo = useCallback(() => dispatch({ type: 'UNDO' }), [])
  const redo = useCallback(() => dispatch({ type: 'REDO' }), [])

  return {
    state: history.present,
    setState,
    pushState,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  }
}
