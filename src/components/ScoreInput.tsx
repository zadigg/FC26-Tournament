import { useState, useRef } from 'react'

interface ScoreInputProps {
  onSave: (scoreA: number, scoreB: number) => void
  onCancel?: () => void
  isGoldenGoal?: boolean
  initialA?: number | null
  initialB?: number | null
}

export function ScoreInput({
  onSave,
  onCancel,
  isGoldenGoal,
  initialA = null,
  initialB = null,
}: ScoreInputProps) {
  const initialScoreA = initialA ?? 0
  const initialScoreB = initialB ?? 0
  const [scoreA, setScoreA] = useState(initialScoreA)
  const [scoreB, setScoreB] = useState(initialScoreB)
  const [displayA, setDisplayA] = useState(initialA !== null ? String(initialA) : '0')
  const [displayB, setDisplayB] = useState(initialB !== null ? String(initialB) : '0')
  const inputARef = useRef<HTMLInputElement>(null)
  const inputBRef = useRef<HTMLInputElement>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Ensure we have valid numbers before saving
    const finalA = scoreA || 0
    const finalB = scoreB || 0
    
    if (isGoldenGoal) {
      const sa = finalA >= 1 ? 1 : 0
      const sb = finalB >= 1 ? 1 : 0
      if (sa + sb !== 1) return
      onSave(sa, sb)
    } else {
      if (finalA < 0 || finalB < 0) return
      onSave(finalA, finalB)
    }
  }
  
  const handleFocusA = () => {
    if (scoreA === 0) {
      setDisplayA('')
      inputARef.current?.select()
    }
  }
  
  const handleBlurA = () => {
    const value = displayA.trim()
    if (value === '' || value === '0') {
      setScoreA(0)
      setDisplayA('0')
    } else {
      const num = parseInt(value, 10)
      if (!isNaN(num)) {
        setScoreA(Math.max(0, num))
        setDisplayA(String(Math.max(0, num)))
      }
    }
  }
  
  const handleFocusB = () => {
    if (scoreB === 0) {
      setDisplayB('')
      inputBRef.current?.select()
    }
  }
  
  const handleBlurB = () => {
    const value = displayB.trim()
    if (value === '' || value === '0') {
      setScoreB(0)
      setDisplayB('0')
    } else {
      const num = parseInt(value, 10)
      if (!isNaN(num)) {
        setScoreB(Math.max(0, num))
        setDisplayB(String(Math.max(0, num)))
      }
    }
  }

  // Golden goal handlers
  const handleGoldenGoalFocusA = () => {
    if (scoreA === 0) {
      setDisplayA('')
      inputARef.current?.select()
    }
  }
  
  const handleGoldenGoalBlurA = () => {
    const value = displayA.trim()
    if (value === '' || value === '0') {
      setScoreA(0)
      setDisplayA('0')
    } else {
      const num = parseInt(value, 10)
      if (num === 1) {
        setScoreA(1)
        setScoreB(0)
        setDisplayA('1')
        setDisplayB('0')
      } else {
        setScoreA(0)
        setDisplayA('0')
      }
    }
  }
  
  const handleGoldenGoalFocusB = () => {
    if (scoreB === 0) {
      setDisplayB('')
      inputBRef.current?.select()
    }
  }
  
  const handleGoldenGoalBlurB = () => {
    const value = displayB.trim()
    if (value === '' || value === '0') {
      setScoreB(0)
      setDisplayB('0')
    } else {
      const num = parseInt(value, 10)
      if (num === 1) {
        setScoreB(1)
        setScoreA(0)
        setDisplayB('1')
        setDisplayA('0')
      } else {
        setScoreB(0)
        setDisplayB('0')
      }
    }
  }

  if (isGoldenGoal) {
    return (
      <form onSubmit={handleSubmit} className="mt-2 flex flex-wrap items-center gap-2">
        <span className="text-xs text-amber-400">First goal wins</span>
        <label className="flex items-center gap-1">
          <span className="text-sm text-slate-400">A</span>
          <input
            ref={inputARef}
            type="number"
            min={0}
            max={1}
            value={displayA}
            onChange={(e) => {
              const value = e.target.value
              setDisplayA(value)
              const v = parseInt(value, 10)
              if (v === 1) {
                setScoreA(1)
                setScoreB(0)
                setDisplayA('1')
                setDisplayB('0')
              } else if (value === '' || v === 0) {
                setScoreA(0)
                setDisplayA(value)
              }
            }}
            onFocus={handleGoldenGoalFocusA}
            onBlur={handleGoldenGoalBlurA}
            className="w-14 rounded border border-slate-600 bg-slate-800 px-2 py-1 text-center text-slate-100"
            inputMode="numeric"
          />
        </label>
        <span className="text-slate-500">–</span>
        <label className="flex items-center gap-1">
          <span className="text-sm text-slate-400">B</span>
          <input
            ref={inputBRef}
            type="number"
            min={0}
            max={1}
            value={displayB}
            onChange={(e) => {
              const value = e.target.value
              setDisplayB(value)
              const v = parseInt(value, 10)
              if (v === 1) {
                setScoreB(1)
                setScoreA(0)
                setDisplayB('1')
                setDisplayA('0')
              } else if (value === '' || v === 0) {
                setScoreB(0)
                setDisplayB(value)
              }
            }}
            onFocus={handleGoldenGoalFocusB}
            onBlur={handleGoldenGoalBlurB}
            className="w-14 rounded border border-slate-600 bg-slate-800 px-2 py-1 text-center text-slate-100"
            inputMode="numeric"
          />
        </label>
        <button
          type="submit"
          disabled={scoreA + scoreB !== 1}
          className="rounded bg-emerald-600 px-3 py-1 text-sm text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          Save
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="text-sm text-slate-400 hover:text-slate-300">
            Cancel
          </button>
        )}
      </form>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2 flex flex-wrap items-center gap-2">
      <label className="flex items-center gap-1">
        <input
          ref={inputARef}
          type="number"
          min={0}
          value={displayA}
          onChange={(e) => {
            const value = e.target.value
            setDisplayA(value)
            const num = parseInt(value, 10)
            if (!isNaN(num) && value !== '') {
              setScoreA(Math.max(0, num))
            }
          }}
          onFocus={handleFocusA}
          onBlur={handleBlurA}
          className="w-14 rounded border border-slate-600 bg-slate-800 px-2 py-1 text-center text-slate-100"
          inputMode="numeric"
        />
      </label>
      <span className="text-slate-500">–</span>
      <label className="flex items-center gap-1">
        <input
          ref={inputBRef}
          type="number"
          min={0}
          value={displayB}
          onChange={(e) => {
            const value = e.target.value
            setDisplayB(value)
            const num = parseInt(value, 10)
            if (!isNaN(num) && value !== '') {
              setScoreB(Math.max(0, num))
            }
          }}
          onFocus={handleFocusB}
          onBlur={handleBlurB}
          className="w-14 rounded border border-slate-600 bg-slate-800 px-2 py-1 text-center text-slate-100"
          inputMode="numeric"
        />
      </label>
      <button type="submit" className="rounded bg-emerald-600 px-3 py-1 text-sm text-white hover:bg-emerald-500">
        Save
      </button>
      {onCancel && (
        <button type="button" onClick={onCancel} className="text-sm text-slate-400 hover:text-slate-300">
          Cancel
        </button>
      )}
    </form>
  )
}
