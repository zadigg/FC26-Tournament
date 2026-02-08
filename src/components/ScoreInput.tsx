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
      <form onSubmit={handleSubmit} className="mt-3 flex flex-wrap items-center gap-3">
        <span className="text-xs font-semibold text-amber-600 px-2 py-1 rounded-full bg-amber-50">First goal wins</span>
        <div className="flex items-center gap-2">
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
            className="w-16 rounded-button border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-center text-lg font-bold text-gray-900 dark:text-gray-100 focus:border-amber-500 dark:focus:border-amber-500 focus:outline-none transition-colors"
            inputMode="numeric"
          />
          <span className="text-gray-400 dark:text-gray-500 font-semibold text-xl">–</span>
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
            className="w-16 rounded-button border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-center text-lg font-bold text-gray-900 dark:text-gray-100 focus:border-amber-500 dark:focus:border-amber-500 focus:outline-none transition-colors"
            inputMode="numeric"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={scoreA + scoreB !== 1}
            className="rounded-button bg-neobank-lime px-4 py-2 text-sm font-semibold text-white hover:bg-neobank-lime-dark disabled:opacity-50 transition-colors shadow-sm"
          >
            Save
          </button>
          {onCancel && (
            <button type="button" onClick={onCancel} className="rounded-button bg-gray-100 dark:bg-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
              Cancel
            </button>
          )}
        </div>
      </form>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
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
          className="w-16 rounded-button border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-center text-lg font-bold text-gray-900 dark:text-gray-100 focus:border-neobank-lime focus:outline-none transition-colors"
          inputMode="numeric"
        />
        <span className="text-gray-400 dark:text-gray-500 font-semibold text-xl">–</span>
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
          className="w-16 rounded-button border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-center text-lg font-bold text-gray-900 dark:text-gray-100 focus:border-neobank-lime focus:outline-none transition-colors"
          inputMode="numeric"
        />
      </div>
      <div className="flex gap-2">
        <button type="submit" className="rounded-button bg-neobank-lime px-4 py-2 text-sm font-semibold text-white hover:bg-neobank-lime-dark transition-colors shadow-sm">
          Save
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="rounded-button bg-gray-100 dark:bg-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}
